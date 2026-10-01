package live

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"ingestor/internal/market"
)

// Feed describes one exchange's public ticker WebSocket: URL, subscription messages and parser.
type Feed struct {
	Name      string
	URL       string
	Subscribe [][]byte // sent in order after connecting
	Parse     func(msg []byte, receivedAt time.Time) []market.Tick
}

const (
	CoinbaseURL = "wss://ws-feed.exchange.coinbase.com"
	KrakenURL   = "wss://ws.kraken.com/v2"
	// Kraken accepts long symbol lists, but smaller subscribe batches fail independently.
	krakenBatch = 50
)

// CoinbaseFeed subscribes to "ticker_batch" (one update per product every ~5s, enough for hundreds of
// products) plus a single-product heartbeat that keeps the idle watchdog quiet.
func CoinbaseFeed(assets []market.Asset) (Feed, bool) {
	products := make([]string, 0, len(assets))
	symbolOf := map[string]string{}
	for _, a := range assets {
		if id := a.Venue("Coinbase"); id != "" {
			products = append(products, id)
			symbolOf[id] = a.Symbol
		}
	}
	if len(products) == 0 {
		return Feed{}, false
	}
	sub, _ := json.Marshal(map[string]any{
		"type": "subscribe",
		"channels": []map[string]any{
			{"name": "ticker_batch", "product_ids": products},
			{"name": "heartbeat", "product_ids": products[:1]},
		},
	})
	return Feed{Name: "Coinbase", URL: CoinbaseURL, Subscribe: [][]byte{sub}, Parse: func(msg []byte, receivedAt time.Time) []market.Tick {
		return parseCoinbase(msg, receivedAt, symbolOf)
	}}, true
}

func parseCoinbase(msg []byte, receivedAt time.Time, symbolOf map[string]string) []market.Tick {
	var m struct {
		Type      string `json:"type"`
		ProductID string `json:"product_id"`
		Price     string `json:"price"`
		Time      string `json:"time"`
	}
	if json.Unmarshal(msg, &m) != nil || m.Type != "ticker" {
		return nil
	}
	symbol, ok := symbolOf[m.ProductID]
	price, err := strconv.ParseFloat(m.Price, 64)
	if !ok || err != nil {
		return nil
	}
	at := receivedAt
	if t, err := time.Parse(time.RFC3339Nano, m.Time); err == nil {
		at = t
	}
	return []market.Tick{{Symbol: symbol, Source: "Coinbase", Price: price, At: at.UnixMilli()}}
}

// KrakenFeed subscribes to the v2 ticker channel, triggered by trades only (not every best-bid change).
// Kraken v2 uses common tickers ("BTC/USD", "DOGE/USD"), so our symbol + "/USD" is the pair name.
func KrakenFeed(assets []market.Asset) (Feed, bool) {
	pairs := make([]string, 0, len(assets))
	for _, a := range assets {
		if a.Venue("Kraken") != "" {
			pairs = append(pairs, a.Symbol+"/USD")
		}
	}
	if len(pairs) == 0 {
		return Feed{}, false
	}
	var subs [][]byte
	for i := 0; i < len(pairs); i += krakenBatch {
		end := min(i+krakenBatch, len(pairs))
		sub, _ := json.Marshal(map[string]any{
			"method": "subscribe",
			"params": map[string]any{"channel": "ticker", "symbol": pairs[i:end], "event_trigger": "trades", "snapshot": true},
		})
		subs = append(subs, sub)
	}
	return Feed{Name: "Kraken", URL: KrakenURL, Subscribe: subs, Parse: parseKraken}, true
}

func parseKraken(msg []byte, receivedAt time.Time) []market.Tick {
	var m struct {
		Channel string `json:"channel"`
		Data    []struct {
			Symbol string   `json:"symbol"`
			Last   *float64 `json:"last"`
		} `json:"data"`
	}
	if json.Unmarshal(msg, &m) != nil || m.Channel != "ticker" {
		return nil
	}
	ticks := make([]market.Tick, 0, len(m.Data))
	for _, d := range m.Data {
		base, ok := strings.CutSuffix(d.Symbol, "/USD")
		if !ok || d.Last == nil {
			continue
		}
		ticks = append(ticks, market.Tick{Symbol: base, Source: "Kraken", Price: *d.Last, At: receivedAt.UnixMilli()})
	}
	return ticks
}
