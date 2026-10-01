// Package candles keeps OHLCV candles for the whole universe up to date via exchanges' public REST
// endpoints, within per-exchange rate limits, writing to the shared Postgres "candles" table.
package candles

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"

	"ingestor/internal/market"
)

// ErrNotListed means the exchange does not have this product; try the next venue.
var ErrNotListed = errors.New("not listed")

// Fetcher loads recent candles of one product from one exchange.
type Fetcher interface {
	Source() string
	Fetch(ctx context.Context, venueID string, tf market.Timeframe) ([]market.Bar, error)
}

// Endpoints are overridable for tests.
type Endpoints struct {
	Coinbase string
	Kraken   string
	Bitstamp string
}

var DefaultEndpoints = Endpoints{
	Coinbase: "https://api.exchange.coinbase.com",
	Kraken:   "https://api.kraken.com",
	Bitstamp: "https://www.bitstamp.net",
}

const maxBody = 8 << 20

func getJSON(ctx context.Context, client *http.Client, source, rawURL string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "market-ingestor/1.0")
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w", source, err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return fmt.Errorf("%s: %w", source, ErrNotListed)
	}
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: HTTP %d", source, res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(out)
}

func sortBars(bars []market.Bar) []market.Bar {
	sort.Slice(bars, func(i, j int) bool { return bars[i].Time < bars[j].Time })
	return bars
}

// Coinbase: GET /products/{id}/candles → [[time, low, high, open, close, volume], …] newest first.
type coinbase struct {
	client *http.Client
	base   string
}

func NewCoinbase(client *http.Client, e Endpoints) Fetcher { return coinbase{client, e.Coinbase} }
func (coinbase) Source() string                            { return "Coinbase" }

func (c coinbase) Fetch(ctx context.Context, id string, tf market.Timeframe) ([]market.Bar, error) {
	var rows [][6]float64
	u := fmt.Sprintf("%s/products/%s/candles?granularity=%d", c.base, url.PathEscape(id), tf.Seconds())
	if err := getJSON(ctx, c.client, "Coinbase", u, &rows); err != nil {
		return nil, err
	}
	bars := make([]market.Bar, 0, len(rows))
	for _, r := range rows {
		bars = append(bars, market.Bar{Time: int64(r[0]), Low: r[1], High: r[2], Open: r[3], Close: r[4], Volume: r[5]})
	}
	return sortBars(bars), nil
}

// Kraken: GET /0/public/OHLC?pair=ALTNAME&interval=MIN → {error, result:{PAIR:[[t,o,h,l,c,vwap,vol,count]…], last}}.
type kraken struct {
	client *http.Client
	base   string
}

func NewKraken(client *http.Client, e Endpoints) Fetcher { return kraken{client, e.Kraken} }
func (kraken) Source() string                            { return "Kraken" }

func (k kraken) Fetch(ctx context.Context, altname string, tf market.Timeframe) ([]market.Bar, error) {
	var body struct {
		Error  []string                   `json:"error"`
		Result map[string]json.RawMessage `json:"result"`
	}
	u := fmt.Sprintf("%s/0/public/OHLC?pair=%s&interval=%d", k.base, url.QueryEscape(altname), tf.Seconds()/60)
	if err := getJSON(ctx, k.client, "Kraken", u, &body); err != nil {
		return nil, err
	}
	if len(body.Error) > 0 {
		if body.Error[0] == "EQuery:Unknown asset pair" {
			return nil, fmt.Errorf("Kraken: %w", ErrNotListed)
		}
		return nil, fmt.Errorf("Kraken: %v", body.Error)
	}
	for key, raw := range body.Result {
		if key == "last" {
			continue
		}
		var rows [][]any
		if err := json.Unmarshal(raw, &rows); err != nil {
			return nil, fmt.Errorf("Kraken: %w", err)
		}
		bars := make([]market.Bar, 0, len(rows))
		for _, r := range rows {
			if b, ok := krakenRow(r); ok {
				bars = append(bars, b)
			}
		}
		return sortBars(bars), nil
	}
	return nil, errors.New("Kraken: empty result")
}

func krakenRow(r []any) (market.Bar, bool) {
	if len(r) < 7 {
		return market.Bar{}, false
	}
	t, ok := r[0].(float64)
	if !ok {
		return market.Bar{}, false
	}
	vals := make([]float64, 0, 5)
	for _, i := range []int{1, 2, 3, 4, 6} {
		s, ok := r[i].(string)
		if !ok {
			return market.Bar{}, false
		}
		v, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return market.Bar{}, false
		}
		vals = append(vals, v)
	}
	return market.Bar{Time: int64(t), Open: vals[0], High: vals[1], Low: vals[2], Close: vals[3], Volume: vals[4]}, true
}

// Bitstamp: GET /api/v2/ohlc/{pair}/?step=SECONDS&limit=300 → {data:{ohlc:[{timestamp,open,high,low,close,volume}]}} (strings).
type bitstamp struct {
	client *http.Client
	base   string
}

func NewBitstamp(client *http.Client, e Endpoints) Fetcher { return bitstamp{client, e.Bitstamp} }
func (bitstamp) Source() string                            { return "Bitstamp" }

func (b bitstamp) Fetch(ctx context.Context, pair string, tf market.Timeframe) ([]market.Bar, error) {
	var body struct {
		Data struct {
			OHLC []map[string]string `json:"ohlc"`
		} `json:"data"`
	}
	u := fmt.Sprintf("%s/api/v2/ohlc/%s/?step=%d&limit=300", b.base, url.PathEscape(pair), tf.Seconds())
	if err := getJSON(ctx, b.client, "Bitstamp", u, &body); err != nil {
		return nil, err
	}
	bars := make([]market.Bar, 0, len(body.Data.OHLC))
	for _, row := range body.Data.OHLC {
		var v [6]float64
		ok := true
		for i, k := range []string{"timestamp", "open", "high", "low", "close", "volume"} {
			f, err := strconv.ParseFloat(row[k], 64)
			if err != nil {
				ok = false
				break
			}
			v[i] = f
		}
		if ok {
			bars = append(bars, market.Bar{Time: int64(v[0]), Open: v[1], High: v[2], Low: v[3], Close: v[4], Volume: v[5]})
		}
	}
	return sortBars(bars), nil
}

// NewHTTPClient returns a client with a sane timeout for REST polling.
func NewHTTPClient() *http.Client { return &http.Client{Timeout: 15 * time.Second} }
