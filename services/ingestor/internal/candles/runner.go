package candles

import (
	"context"
	"errors"
	"log/slog"
	"sync/atomic"
	"time"

	"golang.org/x/time/rate"

	"ingestor/internal/market"
)

// Store is where candles go (Postgres) and how indicator recomputation is requested (Redis).
type Store interface {
	UpsertCandles(ctx context.Context, symbol string, tf market.Timeframe, source string, bars []market.Bar) (int64, error)
	MarkDirty(ctx context.Context, symbol string, tf market.Timeframe) error
}

// Venue is one exchange with its own rate limit, tried in the order given to the runner.
type Venue struct {
	Fetcher Fetcher
	Limiter *rate.Limiter
}

// Runner hands due tasks to a fixed pool of workers.
type Runner struct {
	planner *Planner
	venues  []Venue
	store   Store
	log     *slog.Logger
	workers int
	ok      atomic.Int64
	failed  atomic.Int64
	queued  atomic.Int64
}

func NewRunner(planner *Planner, venues []Venue, store Store, log *slog.Logger, workers int) *Runner {
	return &Runner{planner: planner, venues: venues, store: store, log: log, workers: workers}
}

// Stats for /healthz.
func (r *Runner) Stats() (ok, failed, queued int64) {
	return r.ok.Load(), r.failed.Load(), r.queued.Load()
}

// Run blocks until ctx ends.
func (r *Runner) Run(ctx context.Context, tick time.Duration) {
	tasks := make(chan Task, r.workers*2)
	for i := 0; i < r.workers; i++ {
		go func() {
			for t := range tasks {
				r.execute(ctx, t)
				r.queued.Add(-1)
			}
		}()
	}
	defer close(tasks)

	ticker := time.NewTicker(tick)
	defer ticker.Stop()
	for {
		// Only take what the pool can start soon; the rest stays due for the next tick.
		for _, t := range r.planner.Due(time.Now(), cap(tasks)-len(tasks)) {
			r.queued.Add(1)
			select {
			case tasks <- t:
			case <-ctx.Done():
				return
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (r *Runner) execute(ctx context.Context, t Task) {
	newest, err := r.sync(ctx, t)
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		r.failed.Add(1)
		r.log.Warn("candle sync failed", "symbol", t.Asset.Symbol, "tf", string(t.TF), "error", err)
	} else {
		r.ok.Add(1)
	}
	r.planner.Done(t, time.Now(), err == nil, newest)
}

// sync tries each venue that lists the asset, in order, and stores the first successful series.
// Only buckets at or after the previous newest bucket are written (the closing bar may still change).
func (r *Runner) sync(ctx context.Context, t Task) (int64, error) {
	var lastErr error = errors.New("no venue lists this asset")
	for _, v := range r.venues {
		id := t.Asset.Venue(v.Fetcher.Source())
		if id == "" {
			continue
		}
		if err := v.Limiter.Wait(ctx); err != nil {
			return 0, err
		}
		bars, err := v.Fetcher.Fetch(ctx, id, t.TF)
		if err != nil {
			lastErr = err
			continue
		}
		if len(bars) == 0 {
			lastErr = errors.New(v.Fetcher.Source() + ": no bars")
			continue
		}
		fresh := Since(bars, t.LastBucket-t.TF.Seconds())
		written, err := r.store.UpsertCandles(ctx, t.Asset.Symbol, t.TF, v.Fetcher.Source(), fresh)
		if err != nil {
			return 0, err
		}
		if written > 0 {
			if err := r.store.MarkDirty(ctx, t.Asset.Symbol, t.TF); err != nil {
				r.log.Warn("mark dirty failed", "symbol", t.Asset.Symbol, "error", err)
			}
		}
		return bars[len(bars)-1].Time, nil
	}
	return 0, lastErr
}

// Since keeps bars with Time >= from (bars are ascending).
func Since(bars []market.Bar, from int64) []market.Bar {
	for i, b := range bars {
		if b.Time >= from {
			return bars[i:]
		}
	}
	return nil
}
