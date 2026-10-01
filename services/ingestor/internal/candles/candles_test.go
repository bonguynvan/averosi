package candles

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/time/rate"

	"ingestor/internal/market"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func server(t *testing.T, routes map[string]string) Endpoints {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for prefix, body := range routes {
			if strings.HasPrefix(r.URL.RequestURI(), prefix) {
				if body == "404" {
					http.NotFound(w, r)
					return
				}
				if body == "500" {
					http.Error(w, "down", http.StatusInternalServerError)
					return
				}
				_, _ = io.WriteString(w, body)
				return
			}
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	return Endpoints{Coinbase: srv.URL, Kraken: srv.URL, Bitstamp: srv.URL}
}

func TestCoinbaseFetchSortsAscendingAndMapsColumns(t *testing.T) {
	e := server(t, map[string]string{"/products/BTC-USD/candles?granularity=3600": `[[7200,1,5,2,4,10],[3600,0.5,3,1,2,9]]`, "/products/NOPE-USD": "404"})
	f := NewCoinbase(http.DefaultClient, e)
	bars, err := f.Fetch(context.Background(), "BTC-USD", market.TF1h)
	if err != nil {
		t.Fatal(err)
	}
	want := []market.Bar{{Time: 3600, Open: 1, High: 3, Low: 0.5, Close: 2, Volume: 9}, {Time: 7200, Open: 2, High: 5, Low: 1, Close: 4, Volume: 10}}
	if len(bars) != 2 || bars[0] != want[0] || bars[1] != want[1] {
		t.Fatalf("bars = %+v", bars)
	}
	if _, err := f.Fetch(context.Background(), "NOPE-USD", market.TF1h); !errors.Is(err, ErrNotListed) {
		t.Fatalf("err = %v", err)
	}
}

func TestKrakenFetchParsesStringsAndErrors(t *testing.T) {
	e := server(t, map[string]string{
		"/0/public/OHLC?pair=XBTUSD&interval=1": `{"error":[],"result":{"XXBTZUSD":[[60,"1","3","0.5","2","1.5","7",3],[120,"2","x","1","2","1","1",1]],"last":120}}`,
		"/0/public/OHLC?pair=NOPEUSD":           `{"error":["EQuery:Unknown asset pair"]}`,
		"/0/public/OHLC?pair=BUSYUSD":           `{"error":["EGeneral:Too many requests"]}`,
		"/0/public/OHLC?pair=EMPTYUSD":          `{"error":[],"result":{"last":1}}`,
	})
	f := NewKraken(http.DefaultClient, e)
	bars, err := f.Fetch(context.Background(), "XBTUSD", market.TF1m)
	if err != nil || len(bars) != 1 || bars[0] != (market.Bar{Time: 60, Open: 1, High: 3, Low: 0.5, Close: 2, Volume: 7}) {
		t.Fatalf("bars = %+v, err = %v", bars, err)
	}
	if _, err := f.Fetch(context.Background(), "NOPEUSD", market.TF1m); !errors.Is(err, ErrNotListed) {
		t.Fatalf("unknown pair: %v", err)
	}
	if _, err := f.Fetch(context.Background(), "BUSYUSD", market.TF1m); err == nil || !strings.Contains(err.Error(), "Too many") {
		t.Fatalf("api error: %v", err)
	}
	if _, err := f.Fetch(context.Background(), "EMPTYUSD", market.TF1m); err == nil {
		t.Fatal("empty result must fail")
	}
}

func TestBitstampFetchSkipsMalformedRows(t *testing.T) {
	e := server(t, map[string]string{
		"/api/v2/ohlc/xyzusd/?step=86400": `{"data":{"ohlc":[{"timestamp":"86400","open":"1","high":"2","low":"0.5","close":"1.5","volume":"3"},{"timestamp":"0","open":"bad"}]}}`,
		"/api/v2/ohlc/down/":              "500",
	})
	f := NewBitstamp(http.DefaultClient, e)
	bars, err := f.Fetch(context.Background(), "xyzusd", market.TF1d)
	if err != nil || len(bars) != 1 || bars[0].Close != 1.5 || bars[0].Time != 86400 {
		t.Fatalf("bars = %+v err = %v", bars, err)
	}
	if _, err := f.Fetch(context.Background(), "down", market.TF1d); err == nil || !strings.Contains(err.Error(), "HTTP 500") {
		t.Fatalf("err = %v", err)
	}
}

func asset(symbol string, venues ...string) market.Asset {
	v := map[string]string{}
	for _, src := range venues {
		v[src] = symbol + "@" + src
	}
	return market.Asset{Symbol: symbol, Venues: v}
}

func TestPlannerTiersPriorityInflightAndRetry(t *testing.T) {
	p := NewPlanner(DefaultIntervals, time.Minute)
	p.SetUniverse([]market.Asset{asset("BTC", "Coinbase"), asset("ABC", "Kraken")})
	p.SetHot([]string{"BTC"})
	now := time.Unix(1_000_000, 0)

	due := p.Due(now, 100)
	if len(due) != 7 { // BTC: 5 timeframes (hot); ABC: 1h and 1d (cold)
		t.Fatalf("due = %d", len(due))
	}
	if !due[0].Hot || due[0].TF != market.TF1m || due[5].Hot {
		t.Fatalf("order = %+v", due)
	}
	if again := p.Due(now, 100); len(again) != 0 {
		t.Fatalf("in-flight tasks were handed out twice: %d", len(again))
	}
	for _, task := range due {
		p.Done(task, now, task.Asset.Symbol == "BTC", 500)
	}
	// 31s later only BTC 1m (30s interval) is due; ABC failed → retried after 1 minute.
	if next := p.Due(now.Add(31*time.Second), 100); len(next) != 1 || next[0].TF != market.TF1m || next[0].LastBucket != 500 {
		t.Fatalf("next = %+v", next)
	}
	retry := p.Due(now.Add(61*time.Second), 100)
	symbols := map[string]int{}
	for _, task := range retry {
		symbols[task.Asset.Symbol]++
	}
	if symbols["ABC"] != 2 {
		t.Fatalf("retry = %+v", retry)
	}
	limited := NewPlanner(DefaultIntervals, time.Minute)
	limited.SetUniverse([]market.Asset{asset("BTC", "Coinbase")})
	limited.SetHot([]string{"BTC"})
	if got := limited.Due(now, 3); len(got) != 3 {
		t.Fatalf("limit ignored: %d", len(got))
	}
}

func TestPlannerBecomingHotAndLeavingUniverse(t *testing.T) {
	p := NewPlanner(DefaultIntervals, time.Minute)
	p.SetUniverse([]market.Asset{asset("SOL", "Coinbase")})
	now := time.Unix(0, 0)
	for _, task := range p.Due(now, 100) {
		p.Done(task, now, true, 0)
	}
	p.SetHot([]string{"SOL"})                                   // someone opened the chart
	if due := p.Due(now.Add(time.Second), 100); len(due) != 3 { // 1m, 5m, 15m start immediately
		t.Fatalf("due = %+v", due)
	}
	p.SetUniverse(nil)
	p.Done(Task{Asset: asset("SOL"), TF: market.TF1m}, now, true, 1) // no panic after removal
	if due := p.Due(now.Add(time.Hour), 100); len(due) != 0 {
		t.Fatalf("removed asset still scheduled: %+v", due)
	}
}

func TestHotSet(t *testing.T) {
	universe := []market.Asset{asset("BTC"), asset("ETH"), asset("SOL"), asset("XRP")}
	got := HotSet([]string{"ETH", "GONE", "BTC", "SOL"}, []string{"XRP", "BTC", "GONE"}, universe, 2)
	if strings.Join(got, ",") != "ETH,BTC,XRP" {
		t.Fatalf("hot = %v", got)
	}
	if got := HotSet(nil, nil, universe, 3); strings.Join(got, ",") != "BTC,ETH,SOL" {
		t.Fatalf("fallback = %v", got)
	}
}

type fakeFetcher struct {
	source string
	bars   []market.Bar
	err    error
	calls  atomic.Int64
}

func (f *fakeFetcher) Source() string { return f.source }
func (f *fakeFetcher) Fetch(_ context.Context, _ string, _ market.Timeframe) ([]market.Bar, error) {
	f.calls.Add(1)
	return f.bars, f.err
}

type fakeStore struct {
	mu      sync.Mutex
	written map[string][]market.Bar
	dirty   []string
	err     error
}

func (s *fakeStore) UpsertCandles(_ context.Context, symbol string, tf market.Timeframe, source string, bars []market.Bar) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return 0, s.err
	}
	s.written[symbol+"|"+string(tf)+"|"+source] = bars
	return int64(len(bars)), nil
}

func (s *fakeStore) MarkDirty(_ context.Context, symbol string, tf market.Timeframe) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dirty = append(s.dirty, symbol+"|"+string(tf))
	return nil
}

func bars(times ...int64) []market.Bar {
	out := make([]market.Bar, len(times))
	for i, t := range times {
		out[i] = market.Bar{Time: t, Open: 1, High: 1, Low: 1, Close: 1}
	}
	return out
}

func TestRunnerSyncFallsBackAcrossVenuesAndWritesOnlyFreshBars(t *testing.T) {
	cb := &fakeFetcher{source: "Coinbase", err: errors.New("Coinbase: HTTP 503")}
	kr := &fakeFetcher{source: "Kraken", bars: bars(3600, 7200, 10800)}
	st := &fakeStore{written: map[string][]market.Bar{}}
	unlimited := func() *rate.Limiter { return rate.NewLimiter(rate.Inf, 1) }
	r := NewRunner(NewPlanner(DefaultIntervals, time.Minute), []Venue{{cb, unlimited()}, {kr, unlimited()}}, st, quiet, 1)

	newest, err := r.sync(context.Background(), Task{Asset: asset("ETH", "Coinbase", "Kraken"), TF: market.TF1h, LastBucket: 10800})
	if err != nil || newest != 10800 {
		t.Fatalf("newest = %d err = %v", newest, err)
	}
	if got := st.written["ETH|1h|Kraken"]; len(got) != 2 || got[0].Time != 7200 {
		t.Fatalf("written = %+v", got)
	}
	if strings.Join(st.dirty, ",") != "ETH|1h" {
		t.Fatalf("dirty = %v", st.dirty)
	}
	if _, err := r.sync(context.Background(), Task{Asset: asset("ZZZ", "Bitstamp"), TF: market.TF1h}); err == nil {
		t.Fatal("asset on no configured venue must fail")
	}
	st.err = errors.New("db down")
	if _, err := r.sync(context.Background(), Task{Asset: asset("ETH", "Kraken"), TF: market.TF1h}); err == nil {
		t.Fatal("store errors must surface")
	}
	empty := NewRunner(NewPlanner(DefaultIntervals, time.Minute), []Venue{{&fakeFetcher{source: "Kraken"}, unlimited()}}, st, quiet, 1)
	if _, err := empty.sync(context.Background(), Task{Asset: asset("ETH", "Kraken"), TF: market.TF1h}); err == nil || !strings.Contains(err.Error(), "no bars") {
		t.Fatalf("empty series: %v", err)
	}
}

func TestRunnerRunProcessesDueTasksUntilCancelled(t *testing.T) {
	st := &fakeStore{written: map[string][]market.Bar{}}
	planner := NewPlanner(DefaultIntervals, time.Minute)
	planner.SetUniverse([]market.Asset{asset("BTC", "Coinbase"), asset("BAD", "Kraken")})
	venues := []Venue{
		{&fakeFetcher{source: "Coinbase", bars: bars(60)}, rate.NewLimiter(rate.Inf, 1)},
		{&fakeFetcher{source: "Kraken", err: errors.New("down")}, rate.NewLimiter(rate.Inf, 1)},
	}
	r := NewRunner(planner, venues, st, quiet, 2)
	ctx, cancel := context.WithCancel(context.Background())
	go r.Run(ctx, 10*time.Millisecond)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if ok, failed, _ := r.Stats(); ok >= 2 && failed >= 2 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	if ok, failed, _ := r.Stats(); ok < 2 || failed < 2 {
		t.Fatalf("ok = %d failed = %d", ok, failed)
	}
}

func TestSince(t *testing.T) {
	if got := Since(bars(1, 2, 3), 2); len(got) != 2 {
		t.Fatalf("got %v", got)
	}
	if got := Since(bars(1, 2), 9); got != nil {
		t.Fatalf("got %v", got)
	}
}
