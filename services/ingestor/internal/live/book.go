// Package live turns exchange WebSocket tickers into one realtime reference price per asset.
package live

import (
	"math"
	"sort"
	"sync"

	"ingestor/internal/market"
)

// Book keeps the latest tick per (symbol, source) and yields the median of fresh ticks.
// Same semantics as the former TypeScript LivePriceBook: stale ticks are ignored, never shown as live.
type Book struct {
	mu     sync.Mutex
	maxAge int64 // ms
	latest map[string]map[string]market.Tick
	dirty  map[string]struct{}
}

// NewBook creates a book that ignores ticks older than maxAgeMs at flush time.
func NewBook(maxAgeMs int64) *Book {
	return &Book{maxAge: maxAgeMs, latest: map[string]map[string]market.Tick{}, dirty: map[string]struct{}{}}
}

// Add records a tick; invalid prices are dropped.
func (b *Book) Add(t market.Tick) {
	if math.IsNaN(t.Price) || math.IsInf(t.Price, 0) || t.Price <= 0 {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	bySource, ok := b.latest[t.Symbol]
	if !ok {
		bySource = map[string]market.Tick{}
		b.latest[t.Symbol] = bySource
	}
	bySource[t.Source] = t
	b.dirty[t.Symbol] = struct{}{}
}

// Flush returns updates (sorted by symbol) for symbols that received ticks since the last flush.
func (b *Book) Flush(nowMs int64) []market.LivePrice {
	b.mu.Lock()
	defer b.mu.Unlock()
	symbols := make([]string, 0, len(b.dirty))
	for s := range b.dirty {
		symbols = append(symbols, s)
	}
	b.dirty = map[string]struct{}{}
	sort.Strings(symbols)

	out := make([]market.LivePrice, 0, len(symbols))
	for _, s := range symbols {
		prices := make([]float64, 0, 2)
		var at int64
		for _, t := range b.latest[s] {
			if nowMs-t.At > b.maxAge {
				continue
			}
			prices = append(prices, t.Price)
			if t.At > at {
				at = t.At
			}
		}
		if len(prices) == 0 {
			continue
		}
		out = append(out, market.LivePrice{Symbol: s, PriceUsd: median(prices), Sources: len(prices), At: at})
	}
	return out
}

func median(values []float64) float64 {
	sort.Float64s(values)
	mid := len(values) / 2
	if len(values)%2 == 1 {
		return values[mid]
	}
	return (values[mid-1] + values[mid]) / 2
}
