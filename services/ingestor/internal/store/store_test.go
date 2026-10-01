package store

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"ingestor/internal/market"
)

// Integration tests run only against dedicated test stores (same guard as packages/store):
// the database name must contain "test" and Redis must use logical DB 15.
func testStore(t *testing.T) *Store {
	t.Helper()
	db, rd := os.Getenv("TEST_DATABASE_URL"), os.Getenv("TEST_REDIS_URL")
	if !regexp.MustCompile(`/[^/?]*test[^/?]*(\?|$)`).MatchString(db) || !regexp.MustCompile(`/15$`).MatchString(rd) {
		t.Skip("TEST_DATABASE_URL (…test…) and TEST_REDIS_URL (…/15) not set")
	}
	ctx := context.Background()
	s, err := Open(ctx, db, rd)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	files, _ := filepath.Glob("../../../../packages/store/migrations/*.sql")
	sort.Strings(files)
	for _, f := range files {
		ddl, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := s.pg.Exec(ctx, string(ddl)); err != nil {
			t.Fatalf("%s: %v", f, err)
		}
	}
	if _, err := s.pg.Exec(ctx, `DELETE FROM candles WHERE symbol LIKE 'GOTEST%'; DELETE FROM assets WHERE symbol LIKE 'GOTEST%'`); err != nil {
		t.Fatal(err)
	}
	if err := s.rdb.Del(ctx, KeyRank, KeyDemand, KeyTaDirty).Err(); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAssetsAndCandles(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if _, err := s.pg.Exec(ctx, `INSERT INTO assets (symbol, name, sources, venues, active) VALUES
		('GOTESTA', 'A', '{Coinbase,Kraken}', '{"Coinbase":"GOTESTA-USD","Kraken":"GOTESTAUSD"}', true),
		('GOTESTB', 'B', '{Kraken,Gemini}', '{"Kraken":"GOTESTBUSD"}', false)`); err != nil {
		t.Fatal(err)
	}
	assets, err := s.ActiveAssets(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var found *market.Asset
	for i := range assets {
		if assets[i].Symbol == "GOTESTB" {
			t.Fatal("inactive asset returned")
		}
		if assets[i].Symbol == "GOTESTA" {
			found = &assets[i]
		}
	}
	if found == nil || found.Venue("Kraken") != "GOTESTAUSD" || len(found.Sources) != 2 {
		t.Fatalf("asset = %+v", found)
	}

	bars := []market.Bar{{Time: 3600, Open: 1, High: 2, Low: 0.5, Close: 1.5, Volume: 9}, {Time: 7200, Open: 1.5, High: 2, Low: 1, Close: 2, Volume: 3}}
	if n, err := s.UpsertCandles(ctx, "GOTESTA", market.TF1h, "Coinbase", bars); err != nil || n != 2 {
		t.Fatalf("insert n = %d err = %v", n, err)
	}
	if n, err := s.UpsertCandles(ctx, "GOTESTA", market.TF1h, "Coinbase", bars); err != nil || n != 0 {
		t.Fatalf("unchanged rows must not be rewritten: n = %d err = %v", n, err)
	}
	bars[1].Close = 2.5
	if n, err := s.UpsertCandles(ctx, "GOTESTA", market.TF1h, "Coinbase", bars); err != nil || n != 1 {
		t.Fatalf("forming bar update n = %d err = %v", n, err)
	}
	if n, err := s.UpsertCandles(ctx, "GOTESTA", market.TF1h, "Coinbase", nil); err != nil || n != 0 {
		t.Fatal("empty upsert must be a no-op")
	}
	var close float64
	var bucket time.Time
	if err := s.pg.QueryRow(ctx, `SELECT close, bucket_start FROM candles WHERE symbol='GOTESTA' AND timeframe='1h' ORDER BY bucket_start DESC LIMIT 1`).Scan(&close, &bucket); err != nil {
		t.Fatal(err)
	}
	if close != 2.5 || bucket.Unix() != 7200 {
		t.Fatalf("stored close = %v at %v", close, bucket)
	}
}

func TestRedisContracts(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if rank, err := s.Rank(ctx); err != nil || rank != nil {
		t.Fatalf("missing rank → nil, got %v %v", rank, err)
	}
	s.rdb.Set(ctx, KeyRank, `["BTC","ETH"]`, time.Minute)
	if rank, err := s.Rank(ctx); err != nil || len(rank) != 2 || rank[0] != "BTC" {
		t.Fatalf("rank = %v err = %v", rank, err)
	}
	s.rdb.Set(ctx, KeyRank, `not json`, time.Minute)
	if _, err := s.Rank(ctx); err == nil {
		t.Fatal("bad rank JSON must fail")
	}

	now := time.UnixMilli(1_000_000)
	for sym, at := range map[string]int64{"OLD": 1_000, "NEW": 999_000} {
		if err := s.rdb.ZAdd(ctx, KeyDemand, redisZ(at, sym)).Err(); err != nil {
			t.Fatal(err)
		}
	}
	demand, err := s.Demand(ctx, now.Add(-10*time.Second))
	if err != nil || len(demand) != 1 || demand[0] != "NEW" {
		t.Fatalf("demand = %v err = %v", demand, err)
	}
	if n, _ := s.rdb.ZCard(ctx, KeyDemand).Result(); n != 1 {
		t.Fatalf("old demand not trimmed: %d", n)
	}

	if err := s.MarkDirty(ctx, "BTC", market.TF1h); err != nil {
		t.Fatal(err)
	}
	if ok, _ := s.rdb.SIsMember(ctx, KeyTaDirty, "BTC|1h").Result(); !ok {
		t.Fatal("dirty entry missing")
	}

	sub := s.rdb.Subscribe(ctx, KeyLive)
	defer sub.Close()
	if _, err := sub.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	if err := s.PublishLive(ctx, []market.LivePrice{{Symbol: "BTC", PriceUsd: 1.5, Sources: 2, At: 7}}); err != nil {
		t.Fatal(err)
	}
	msg, err := sub.ReceiveMessage(ctx)
	if err != nil || msg.Payload != `[{"symbol":"BTC","priceUsd":1.5,"sources":2,"at":7}]` {
		t.Fatalf("payload = %q err = %v", msg.Payload, err)
	}
	if err := s.Ping(ctx); err != nil {
		t.Fatal(err)
	}
}

func redisZ(score int64, member string) redis.Z {
	return redis.Z{Score: float64(score), Member: member}
}
