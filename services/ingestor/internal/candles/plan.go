package candles

import (
	"sort"
	"sync"
	"time"

	"ingestor/internal/market"
)

// Tier decides how often an asset's candles are refreshed.
type Tier int

const (
	Cold Tier = iota // most of the universe: hourly and daily candles only
	Hot              // top by volume + assets someone is viewing: all timeframes, near real time
)

// Intervals per tier and timeframe; 0 means "not synced in this tier".
type Intervals map[Tier]map[market.Timeframe]time.Duration

// DefaultIntervals keep ~300 assets within a few requests per second in total.
var DefaultIntervals = Intervals{
	Hot:  {market.TF1m: 30 * time.Second, market.TF5m: time.Minute, market.TF15m: 2 * time.Minute, market.TF1h: 5 * time.Minute, market.TF1d: 30 * time.Minute},
	Cold: {market.TF1h: time.Hour, market.TF1d: 6 * time.Hour},
}

// Task is one (asset, timeframe) refresh.
type Task struct {
	Asset      market.Asset
	TF         market.Timeframe
	Hot        bool
	LastBucket int64 // newest bucket already stored by this process (0 = none yet)
}

type key struct {
	symbol string
	tf     market.Timeframe
}

type state struct {
	lastRun    time.Time
	inflight   bool
	lastBucket int64
}

// Planner tracks when each series last ran. Safe for concurrent use.
type Planner struct {
	mu        sync.Mutex
	intervals Intervals
	retry     time.Duration
	assets    []market.Asset
	hot       map[string]bool
	states    map[key]*state
}

// NewPlanner creates a planner; retry is the minimum wait after a failed refresh.
func NewPlanner(intervals Intervals, retry time.Duration) *Planner {
	return &Planner{intervals: intervals, retry: retry, hot: map[string]bool{}, states: map[key]*state{}}
}

// SetUniverse replaces the asset list; series of assets no longer present are forgotten.
func (p *Planner) SetUniverse(assets []market.Asset) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.assets = append([]market.Asset(nil), assets...)
	present := make(map[string]bool, len(assets))
	for _, a := range assets {
		present[a.Symbol] = true
	}
	for k := range p.states {
		if !present[k.symbol] {
			delete(p.states, k)
		}
	}
}

// SetHot replaces the hot set.
func (p *Planner) SetHot(symbols []string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.hot = make(map[string]bool, len(symbols))
	for _, s := range symbols {
		p.hot[s] = true
	}
}

// Due returns up to limit tasks that should run now (hot first, then shorter timeframes) and marks
// them in flight so they are not handed out twice.
func (p *Planner) Due(now time.Time, limit int) []Task {
	p.mu.Lock()
	defer p.mu.Unlock()
	var due []Task
	for _, a := range p.assets {
		tier := Cold
		if p.hot[a.Symbol] {
			tier = Hot
		}
		for _, tf := range market.Timeframes {
			interval := p.intervals[tier][tf]
			if interval == 0 {
				continue
			}
			st := p.stateFor(key{a.Symbol, tf})
			if st.inflight || (!st.lastRun.IsZero() && now.Sub(st.lastRun) < interval) {
				continue
			}
			due = append(due, Task{Asset: a, TF: tf, Hot: tier == Hot, LastBucket: st.lastBucket})
		}
	}
	sort.SliceStable(due, func(i, j int) bool {
		if due[i].Hot != due[j].Hot {
			return due[i].Hot
		}
		return due[i].TF.Seconds() < due[j].TF.Seconds()
	})
	if len(due) > limit {
		due = due[:limit]
	}
	for _, t := range due {
		p.states[key{t.Asset.Symbol, t.TF}].inflight = true
	}
	return due
}

func (p *Planner) stateFor(k key) *state {
	st, ok := p.states[k]
	if !ok {
		st = &state{}
		p.states[k] = st
	}
	return st
}

// Done records a finished task. A failure is retried after the retry delay (not immediately).
func (p *Planner) Done(t Task, now time.Time, ok bool, newestBucket int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	st, exists := p.states[key{t.Asset.Symbol, t.TF}]
	if !exists {
		return // asset left the universe meanwhile
	}
	st.inflight = false
	if ok {
		st.lastRun = now
		st.lastBucket = max(st.lastBucket, newestBucket)
		return
	}
	interval := p.intervals[Hot][t.TF]
	if !t.Hot {
		interval = p.intervals[Cold][t.TF]
	}
	// Pretend the last run happened so that the next attempt comes after `retry`.
	st.lastRun = now.Add(p.retry - interval)
}

// HotSet = the top n of rank (by volume) plus everything in demand, restricted to the universe.
// Without a rank yet, the first n assets of the universe stand in.
func HotSet(rank, demand []string, universe []market.Asset, n int) []string {
	inUniverse := make(map[string]bool, len(universe))
	for _, a := range universe {
		inUniverse[a.Symbol] = true
	}
	seen := map[string]bool{}
	var out []string
	add := func(s string) {
		if inUniverse[s] && !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	if len(rank) == 0 {
		for _, a := range universe {
			rank = append(rank, a.Symbol)
		}
	}
	for _, s := range rank {
		if len(out) >= n {
			break
		}
		add(s)
	}
	for _, s := range demand {
		add(s)
	}
	return out
}
