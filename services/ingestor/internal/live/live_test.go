package live

import (
	"context"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	"ingestor/internal/market"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestBookMedianOfFreshTicksOnlyForChangedSymbols(t *testing.T) {
	b := NewBook(60_000)
	b.Add(market.Tick{Symbol: "BTC", Source: "Coinbase", Price: 100, At: 900})
	b.Add(market.Tick{Symbol: "BTC", Source: "Kraken", Price: 102, At: 950})
	b.Add(market.Tick{Symbol: "ETH", Source: "Kraken", Price: math.NaN(), At: 950})
	b.Add(market.Tick{Symbol: "ETH", Source: "Kraken", Price: -1, At: 950})
	got := b.Flush(1_000)
	want := []market.LivePrice{{Symbol: "BTC", PriceUsd: 101, Sources: 2, At: 950}}
	if len(got) != 1 || got[0] != want[0] {
		t.Fatalf("flush = %+v, want %+v", got, want)
	}
	if again := b.Flush(1_000); len(again) != 0 {
		t.Fatalf("second flush should be empty, got %+v", again)
	}
}

func TestBookIgnoresStaleTicksAndUsesOddMedian(t *testing.T) {
	b := NewBook(1_000)
	b.Add(market.Tick{Symbol: "SOL", Source: "A", Price: 10, At: 0})
	b.Add(market.Tick{Symbol: "SOL", Source: "B", Price: 11, At: 5_000})
	b.Add(market.Tick{Symbol: "SOL", Source: "C", Price: 30, At: 5_000})
	b.Add(market.Tick{Symbol: "SOL", Source: "D", Price: 12, At: 5_000})
	got := b.Flush(5_500)
	if len(got) != 1 || got[0].PriceUsd != 12 || got[0].Sources != 3 {
		t.Fatalf("got %+v", got)
	}
	b.Add(market.Tick{Symbol: "OLD", Source: "A", Price: 1, At: 0})
	if got := b.Flush(10_000); len(got) != 0 {
		t.Fatalf("stale-only symbol must not be published: %+v", got)
	}
}

var assets = []market.Asset{
	{Symbol: "BTC", Venues: map[string]string{"Coinbase": "BTC-USD", "Kraken": "XBTUSD"}},
	{Symbol: "TRX", Venues: map[string]string{"Kraken": "TRXUSD"}},
	{Symbol: "XYZ", Venues: map[string]string{"Bitstamp": "xyzusd"}},
}

func TestCoinbaseFeedSubscribesListedProductsAndParsesTickers(t *testing.T) {
	f, ok := CoinbaseFeed(assets)
	if !ok || f.Name != "Coinbase" || len(f.Subscribe) != 1 {
		t.Fatalf("feed = %+v", f)
	}
	sub := string(f.Subscribe[0])
	if !strings.Contains(sub, `"ticker_batch"`) || !strings.Contains(sub, `"BTC-USD"`) || strings.Contains(sub, "TRX") {
		t.Fatalf("subscribe = %s", sub)
	}
	now := time.UnixMilli(5_000)
	ticks := f.Parse([]byte(`{"type":"ticker","product_id":"BTC-USD","price":"83500.5","time":"2026-10-01T08:00:00.123Z"}`), now)
	if len(ticks) != 1 || ticks[0].Symbol != "BTC" || ticks[0].Price != 83500.5 || ticks[0].At != time.Date(2026, 10, 1, 8, 0, 0, 123e6, time.UTC).UnixMilli() {
		t.Fatalf("ticks = %+v", ticks)
	}
	if ticks := f.Parse([]byte(`{"type":"ticker","product_id":"BTC-USD","price":"1","time":"bad"}`), now); len(ticks) != 1 || ticks[0].At != 5_000 {
		t.Fatalf("bad time should fall back to receive time: %+v", ticks)
	}
	for _, msg := range []string{`{"type":"heartbeat"}`, `{"type":"ticker","product_id":"ETH-USD","price":"1"}`, `{"type":"ticker","product_id":"BTC-USD","price":"x"}`, `not json`} {
		if ticks := f.Parse([]byte(msg), now); len(ticks) != 0 {
			t.Fatalf("%s → %+v", msg, ticks)
		}
	}
	if _, ok := CoinbaseFeed(assets[1:]); ok {
		t.Fatal("no Coinbase products → no feed")
	}
}

func TestKrakenFeedBatchesSubscriptionsAndParsesV2Tickers(t *testing.T) {
	many := make([]market.Asset, 0, 120)
	for i := 0; i < 120; i++ {
		many = append(many, market.Asset{Symbol: "A" + string(rune('A'+i%26)) + string(rune('A'+i/26)), Venues: map[string]string{"Kraken": "x"}})
	}
	f, ok := KrakenFeed(many)
	if !ok || len(f.Subscribe) != 3 || !strings.Contains(string(f.Subscribe[0]), `"event_trigger":"trades"`) {
		t.Fatalf("feed subs = %d", len(f.Subscribe))
	}
	ticks := f.Parse([]byte(`{"channel":"ticker","type":"update","data":[{"symbol":"BTC/USD","last":83519.1},{"symbol":"BTC/EUR","last":1},{"symbol":"ETH/USD"}]}`), time.UnixMilli(7))
	if len(ticks) != 1 || ticks[0] != (market.Tick{Symbol: "BTC", Source: "Kraken", Price: 83519.1, At: 7}) {
		t.Fatalf("ticks = %+v", ticks)
	}
	if ticks := f.Parse([]byte(`{"channel":"heartbeat"}`), time.Now()); len(ticks) != 0 {
		t.Fatal("heartbeat is not a tick")
	}
	if _, ok := KrakenFeed(assets[2:]); ok {
		t.Fatal("no Kraken pairs → no feed")
	}
	if feeds := DefaultFeeds(assets); len(feeds) != 2 {
		t.Fatalf("default feeds = %d", len(feeds))
	}
}

// wsServer accepts connections, records subscribe messages, sends one ticker, then closes the first
// connection to exercise reconnects.
func wsServer(t *testing.T) (*httptest.Server, func() []string) {
	var mu sync.Mutex
	var subs []string
	conns := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer c.CloseNow()
		_, msg, err := c.Read(r.Context())
		if err != nil {
			return
		}
		mu.Lock()
		subs = append(subs, string(msg))
		conns++
		n := conns
		mu.Unlock()
		_ = c.Write(r.Context(), websocket.MessageText, []byte(`{"type":"ticker","product_id":"BTC-USD","price":"100"}`))
		if n == 1 {
			c.Close(websocket.StatusGoingAway, "bye")
			return
		}
		<-r.Context().Done()
	}))
	return srv, func() []string {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), subs...)
	}
}

type fakePub struct {
	mu  sync.Mutex
	got [][]market.LivePrice
}

func (p *fakePub) PublishLive(_ context.Context, prices []market.LivePrice) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.got = append(p.got, prices)
	return nil
}

func (p *fakePub) count() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.got)
}

func TestManagerStreamsReconnectsAndPublishes(t *testing.T) {
	srv, subs := wsServer(t)
	defer srv.Close()
	pub := &fakePub{}
	m := NewManager(quiet, pub, time.Minute, 20*time.Millisecond, StreamOptions{Backoff: []time.Duration{10 * time.Millisecond}, IdleTimeout: time.Second})
	m.feeds = func(a []market.Asset) []Feed {
		f, _ := CoinbaseFeed(a)
		f.URL = "ws" + strings.TrimPrefix(srv.URL, "http")
		return []Feed{f}
	}
	ctx, cancel := context.WithCancel(context.Background())
	m.Start(ctx)
	m.SetAssets(ctx, assets)

	deadline := time.Now().Add(3 * time.Second)
	for (len(subs()) < 2 || pub.count() == 0) && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if len(subs()) < 2 {
		t.Fatalf("expected a reconnect, subscriptions = %d", len(subs()))
	}
	if pub.count() == 0 || pub.got[0][0].Symbol != "BTC" {
		t.Fatalf("published = %+v", pub.got)
	}
	feeds, last := m.Status()
	if !feeds["Coinbase"] || last.IsZero() {
		t.Fatalf("status = %v %v", feeds, last)
	}
	cancel()
}

func TestRunGivesUpOnCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	done := make(chan struct{})
	go func() {
		Run(ctx, Feed{Name: "x", URL: "ws://127.0.0.1:1"}, func([]market.Tick) {}, func(string, bool) {}, quiet, StreamOptions{})
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after cancel")
	}
}
