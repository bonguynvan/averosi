package live

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"ingestor/internal/market"
)

// Publisher sends realtime prices to subscribers (Redis pub/sub in production).
type Publisher interface {
	PublishLive(ctx context.Context, prices []market.LivePrice) error
}

// Manager owns the feeds for the current universe and flushes the book on an interval.
// SetAssets restarts the feeds when the universe changes (daily at most).
type Manager struct {
	log      *slog.Logger
	pub      Publisher
	book     *Book
	flush    time.Duration
	opts     StreamOptions
	mu       sync.Mutex
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	statusMu sync.Mutex
	status   map[string]bool
	lastPub  time.Time
	feeds    func([]market.Asset) []Feed
}

// NewManager creates a manager; call Start once, then SetAssets whenever the universe changes.
func NewManager(log *slog.Logger, pub Publisher, maxTickAge, flush time.Duration, opts StreamOptions) *Manager {
	return &Manager{log: log, pub: pub, book: NewBook(maxTickAge.Milliseconds()), flush: flush, opts: opts, status: map[string]bool{}, feeds: DefaultFeeds}
}

// DefaultFeeds builds the Coinbase and Kraken feeds for the assets they list.
func DefaultFeeds(assets []market.Asset) []Feed {
	var feeds []Feed
	if f, ok := CoinbaseFeed(assets); ok {
		feeds = append(feeds, f)
	}
	if f, ok := KrakenFeed(assets); ok {
		feeds = append(feeds, f)
	}
	return feeds
}

// Start runs the flush loop until ctx ends.
func (m *Manager) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(m.flush)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				m.stopFeeds()
				return
			case now := <-ticker.C:
				m.publish(ctx, now)
			}
		}
	}()
}

func (m *Manager) publish(ctx context.Context, now time.Time) {
	updates := m.book.Flush(now.UnixMilli())
	if len(updates) == 0 {
		return
	}
	if err := m.pub.PublishLive(ctx, updates); err != nil {
		m.log.Warn("publish live failed", "error", err)
		return
	}
	m.statusMu.Lock()
	m.lastPub = now
	m.statusMu.Unlock()
}

// SetAssets (re)starts one stream per feed for the given universe.
func (m *Manager) SetAssets(parent context.Context, assets []market.Asset) {
	m.stopFeeds()
	m.mu.Lock()
	defer m.mu.Unlock()
	ctx, cancel := context.WithCancel(parent)
	m.cancel = cancel
	for _, feed := range m.feeds(assets) {
		m.wg.Add(1)
		go func(f Feed) {
			defer m.wg.Done()
			Run(ctx, f, m.onTicks, m.onStatus, m.log, m.opts)
		}(feed)
	}
}

func (m *Manager) stopFeeds() {
	m.mu.Lock()
	cancel := m.cancel
	m.cancel = nil
	m.mu.Unlock()
	if cancel != nil {
		cancel()
		m.wg.Wait()
	}
}

func (m *Manager) onTicks(ticks []market.Tick) {
	for _, t := range ticks {
		m.book.Add(t)
	}
}

func (m *Manager) onStatus(feed string, open bool) {
	m.statusMu.Lock()
	m.status[feed] = open
	m.statusMu.Unlock()
	m.log.Info("stream", "feed", feed, "open", open)
}

// Status reports per-feed connection state and the last successful publish.
func (m *Manager) Status() (feeds map[string]bool, lastPublish time.Time) {
	m.statusMu.Lock()
	defer m.statusMu.Unlock()
	feeds = make(map[string]bool, len(m.status))
	for k, v := range m.status {
		feeds[k] = v
	}
	return feeds, m.lastPub
}
