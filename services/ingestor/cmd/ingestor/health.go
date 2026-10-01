package main

import (
	"sync"
	"time"

	"ingestor/internal/candles"
	"ingestor/internal/live"
)

type health struct {
	mu     sync.Mutex
	start  time.Time
	assets int
	hot    int
}

type healthReport struct {
	UptimeSeconds int64           `json:"uptimeSeconds"`
	Assets        int             `json:"assets"`
	Hot           int             `json:"hot"`
	CandlesOK     int64           `json:"candlesOk"`
	CandlesFailed int64           `json:"candlesFailed"`
	CandlesQueued int64           `json:"candlesQueued"`
	Feeds         map[string]bool `json:"feeds,omitempty"`
	LastPublish   *time.Time      `json:"lastPublish,omitempty"`
}

func (h *health) setAssets(assets, hot int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.assets, h.hot = assets, hot
}

func (h *health) report(runner *candles.Runner, liveMgr *live.Manager) healthReport {
	h.mu.Lock()
	defer h.mu.Unlock()
	ok, failed, queued := runner.Stats()
	r := healthReport{UptimeSeconds: int64(time.Since(h.start).Seconds()), Assets: h.assets, Hot: h.hot, CandlesOK: ok, CandlesFailed: failed, CandlesQueued: queued}
	if liveMgr != nil {
		feeds, last := liveMgr.Status()
		r.Feeds = feeds
		if !last.IsZero() {
			r.LastPublish = &last
		}
	}
	return r
}
