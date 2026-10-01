package live

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/coder/websocket"

	"ingestor/internal/market"
)

// StreamOptions tune reconnects; zero values fall back to defaults.
type StreamOptions struct {
	Backoff     []time.Duration // the last value repeats
	IdleTimeout time.Duration   // reconnect when no message arrives for this long
	ReadLimit   int64
}

var defaultBackoff = []time.Duration{time.Second, 2 * time.Second, 5 * time.Second, 15 * time.Second, 30 * time.Second}

// StatusFunc receives "open"/"closed" transitions for health reporting.
type StatusFunc func(feed string, open bool)

// Run keeps one feed connected until ctx ends: subscribe, read, parse, hand ticks to onTicks.
func Run(ctx context.Context, feed Feed, onTicks func([]market.Tick), onStatus StatusFunc, log *slog.Logger, opts StreamOptions) {
	backoff := opts.Backoff
	if len(backoff) == 0 {
		backoff = defaultBackoff
	}
	idle := opts.IdleTimeout
	if idle == 0 {
		idle = 60 * time.Second
	}
	readLimit := opts.ReadLimit
	if readLimit == 0 {
		readLimit = 4 << 20
	}

	for attempt := 0; ctx.Err() == nil; {
		connected, err := session(ctx, feed, onTicks, onStatus, idle, readLimit)
		if ctx.Err() != nil {
			return
		}
		if connected {
			attempt = 0
		}
		log.Warn("stream closed", "feed", feed.Name, "error", errString(err))
		delay := backoff[min(attempt, len(backoff)-1)]
		attempt++
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}

// session runs one connection. connected reports whether at least one message arrived.
func session(ctx context.Context, feed Feed, onTicks func([]market.Tick), onStatus StatusFunc, idle time.Duration, readLimit int64) (connected bool, err error) {
	dialCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	conn, _, err := websocket.Dial(dialCtx, feed.URL, nil)
	cancel()
	if err != nil {
		return false, err
	}
	defer conn.CloseNow()
	conn.SetReadLimit(readLimit)

	for _, msg := range feed.Subscribe {
		if err := conn.Write(ctx, websocket.MessageText, msg); err != nil {
			return false, err
		}
	}
	onStatus(feed.Name, true)
	defer onStatus(feed.Name, false)

	for {
		readCtx, cancelRead := context.WithTimeout(ctx, idle)
		_, data, err := conn.Read(readCtx)
		cancelRead()
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) && ctx.Err() == nil {
				return connected, errors.New("idle timeout")
			}
			return connected, err
		}
		connected = true
		if ticks := feed.Parse(data, time.Now()); len(ticks) > 0 {
			onTicks(ticks)
		}
	}
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
