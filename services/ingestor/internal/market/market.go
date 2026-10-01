// Package market holds the shared data types of the ingestor. They mirror the TypeScript contracts in
// packages/store (tables candles/assets, Redis keys) and packages/core (Bar, LivePrice).
package market

import "fmt"

// Asset is one entry of the universe the TypeScript worker discovers (table assets).
type Asset struct {
	Symbol  string
	Sources []string
	// Venues maps a source name to that exchange's product id, e.g. "Coinbase" → "BTC-USD".
	Venues map[string]string
}

// Venue returns the product id on a source, or "" when the asset is not listed there.
func (a Asset) Venue(source string) string { return a.Venues[source] }

// Bar is one OHLCV candle; Time is the bucket start in unix seconds.
type Bar struct {
	Time   int64
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume float64
}

// Timeframe is one of the candle resolutions stored in Postgres.
type Timeframe string

const (
	TF1m  Timeframe = "1m"
	TF5m  Timeframe = "5m"
	TF15m Timeframe = "15m"
	TF1h  Timeframe = "1h"
	TF1d  Timeframe = "1d"
)

// Timeframes in ascending order (also the order of priority when several are due).
var Timeframes = []Timeframe{TF1m, TF5m, TF15m, TF1h, TF1d}

// Seconds is the bucket length.
func (tf Timeframe) Seconds() int64 {
	switch tf {
	case TF1m:
		return 60
	case TF5m:
		return 300
	case TF15m:
		return 900
	case TF1h:
		return 3600
	case TF1d:
		return 86400
	}
	panic(fmt.Sprintf("unknown timeframe %q", string(tf)))
}

// LivePrice is the realtime reference price published on Redis "market:live" (JSON array).
// Field names match packages/store LivePrice.
type LivePrice struct {
	Symbol   string  `json:"symbol"`
	PriceUsd float64 `json:"priceUsd"`
	Sources  int     `json:"sources"`
	At       int64   `json:"at"` // unix ms
}

// Tick is one observed last-trade price from one source.
type Tick struct {
	Symbol string
	Source string
	Price  float64
	At     int64 // unix ms
}
