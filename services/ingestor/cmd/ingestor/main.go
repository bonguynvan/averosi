// Command ingestor streams realtime prices and keeps candles for the whole asset universe up to date.
// It shares Postgres/Redis with the TypeScript worker (universe, overview, indicators) and web (read-only).
// Only this process and the worker contact exchanges; browsers never do (LEGAL_REGISTER R11).
package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"golang.org/x/time/rate"

	"ingestor/internal/candles"
	"ingestor/internal/config"
	"ingestor/internal/live"
	"ingestor/internal/market"
	"ingestor/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		log.Error("config", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, cfg.DatabaseURL, cfg.RedisURL)
	if err != nil {
		log.Error("store", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	if err := run(ctx, cfg, st, log); err != nil && ctx.Err() == nil {
		log.Error("ingestor stopped", "error", err)
		os.Exit(1)
	}
	log.Info("ingestor stopped")
}

func run(ctx context.Context, cfg config.Config, st *store.Store, log *slog.Logger) error {
	assets, err := waitForUniverse(ctx, st, log)
	if err != nil {
		return err
	}

	client := candles.NewHTTPClient()
	venues := []candles.Venue{
		{Fetcher: candles.NewCoinbase(client, candles.DefaultEndpoints), Limiter: rate.NewLimiter(rate.Limit(cfg.CoinbaseRPS), 1)},
		{Fetcher: candles.NewKraken(client, candles.DefaultEndpoints), Limiter: rate.NewLimiter(rate.Limit(cfg.KrakenRPS), 1)},
		{Fetcher: candles.NewBitstamp(client, candles.DefaultEndpoints), Limiter: rate.NewLimiter(rate.Limit(cfg.BitstampRPS), 1)},
	}
	planner := candles.NewPlanner(candles.DefaultIntervals, time.Minute)
	planner.SetUniverse(assets)
	runner := candles.NewRunner(planner, venues, st, log, cfg.Workers)

	var liveMgr *live.Manager
	if cfg.Realtime {
		liveMgr = live.NewManager(log, st, time.Minute, time.Second, live.StreamOptions{})
		liveMgr.Start(ctx)
		liveMgr.SetAssets(ctx, assets)
	}

	state := &health{start: time.Now()}
	state.setAssets(len(assets), 0)
	go serveHealth(ctx, cfg.HealthAddr, state, runner, liveMgr, log)
	go runner.Run(ctx, time.Second)

	log.Info("ingestor started", "assets", len(assets), "hot", cfg.HotCount, "realtime", cfg.Realtime)
	return refreshLoop(ctx, cfg, st, planner, liveMgr, state, assets, log)
}

// waitForUniverse polls until the worker has stored at least one asset.
func waitForUniverse(ctx context.Context, st *store.Store, log *slog.Logger) ([]market.Asset, error) {
	for {
		assets, err := st.ActiveAssets(ctx)
		if err == nil && len(assets) > 0 {
			return assets, nil
		}
		log.Info("waiting for asset universe", "error", errString(err))
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(10 * time.Second):
		}
	}
}

// refreshLoop updates the hot set every 30s and the universe every 5 min (restarting feeds on change).
func refreshLoop(ctx context.Context, cfg config.Config, st *store.Store, planner *candles.Planner, liveMgr *live.Manager, state *health, assets []market.Asset, log *slog.Logger) error {
	hotTicker := time.NewTicker(30 * time.Second)
	defer hotTicker.Stop()
	universeTicker := time.NewTicker(5 * time.Minute)
	defer universeTicker.Stop()

	updateHot := func() {
		rank, err := st.Rank(ctx)
		if err != nil {
			log.Warn("rank", "error", err)
		}
		demand, err := st.Demand(ctx, time.Now().Add(-cfg.DemandTTL))
		if err != nil {
			log.Warn("demand", "error", err)
		}
		hot := candles.HotSet(rank, demand, assets, cfg.HotCount)
		planner.SetHot(hot)
		state.setAssets(len(assets), len(hot))
	}
	updateHot()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-hotTicker.C:
			updateHot()
		case <-universeTicker.C:
			next, err := st.ActiveAssets(ctx)
			if err != nil || len(next) == 0 {
				log.Warn("universe refresh skipped", "error", errString(err))
				continue
			}
			if !sameSymbols(assets, next) {
				assets = next
				planner.SetUniverse(assets)
				if liveMgr != nil {
					liveMgr.SetAssets(ctx, assets)
				}
				log.Info("universe changed", "assets", len(assets))
				updateHot()
			}
		}
	}
}

func sameSymbols(a, b []market.Asset) bool {
	return slices.EqualFunc(a, b, func(x, y market.Asset) bool { return x.Symbol == y.Symbol && slices.Equal(x.Sources, y.Sources) })
}

func serveHealth(ctx context.Context, addr string, state *health, runner *candles.Runner, liveMgr *live.Manager, log *slog.Logger) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		report := state.report(runner, liveMgr)
		w.Header().Set("Content-Type", "application/json")
		if report.Assets == 0 {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(report)
	})
	srv := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error("health server", "error", err)
	}
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
