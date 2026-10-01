// Package store reads and writes the same Postgres tables and Redis keys as packages/store (TypeScript).
// Keep the key names in sync with packages/store/src/cache.ts KEYS.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"ingestor/internal/market"
)

const (
	KeyLive    = "market:live"
	KeyRank    = "market:rank"
	KeyDemand  = "market:demand"
	KeyTaDirty = "ta:dirty"
)

// Store bundles the Postgres pool and the Redis client.
type Store struct {
	pg  *pgxpool.Pool
	rdb *redis.Client
}

// Open connects to both stores (small pool: this service writes in short bursts).
func Open(ctx context.Context, databaseURL, redisURL string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database url: %w", err)
	}
	cfg.MaxConns = 4
	pg, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("redis url: %w", err)
	}
	return &Store{pg: pg, rdb: redis.NewClient(opt)}, nil
}

func (s *Store) Close() {
	s.pg.Close()
	_ = s.rdb.Close()
}

// Ping checks both connections.
func (s *Store) Ping(ctx context.Context) error {
	if err := s.pg.Ping(ctx); err != nil {
		return fmt.Errorf("postgres: %w", err)
	}
	return s.rdb.Ping(ctx).Err()
}

// ActiveAssets reads the universe written by the TypeScript worker. Before its first migration the
// table does not exist yet; that is reported as an empty universe.
func (s *Store) ActiveAssets(ctx context.Context) ([]market.Asset, error) {
	rows, err := s.pg.Query(ctx, `SELECT symbol, sources, venues FROM assets WHERE active ORDER BY symbol`)
	if err != nil {
		if isUndefinedTable(err) {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()
	var assets []market.Asset
	for rows.Next() {
		var a market.Asset
		var venues []byte
		if err := rows.Scan(&a.Symbol, &a.Sources, &venues); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(venues, &a.Venues); err != nil {
			return nil, fmt.Errorf("venues of %s: %w", a.Symbol, err)
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

// UpsertCandles writes bars; rows whose values did not change are left untouched (no dead tuples).
func (s *Store) UpsertCandles(ctx context.Context, symbol string, tf market.Timeframe, source string, bars []market.Bar) (int64, error) {
	if len(bars) == 0 {
		return 0, nil
	}
	n := len(bars)
	times, open, high, low, closeP, volume := make([]int64, n), make([]float64, n), make([]float64, n), make([]float64, n), make([]float64, n), make([]float64, n)
	for i, b := range bars {
		times[i], open[i], high[i], low[i], closeP[i], volume[i] = b.Time, b.Open, b.High, b.Low, b.Close, b.Volume
	}
	tag, err := s.pg.Exec(ctx, `
		INSERT INTO candles (symbol, timeframe, bucket_start, open, high, low, close, volume, source)
		SELECT $1, $2, to_timestamp(t), o, h, l, c, v, $3
		FROM unnest($4::bigint[], $5::float8[], $6::float8[], $7::float8[], $8::float8[], $9::float8[]) AS x(t, o, h, l, c, v)
		ON CONFLICT (symbol, timeframe, bucket_start) DO UPDATE SET
			open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close,
			volume = EXCLUDED.volume, source = EXCLUDED.source, updated_at = now()
		WHERE (candles.open, candles.high, candles.low, candles.close, candles.volume, candles.source)
			IS DISTINCT FROM (EXCLUDED.open, EXCLUDED.high, EXCLUDED.low, EXCLUDED.close, EXCLUDED.volume, EXCLUDED.source)`,
		symbol, string(tf), source, times, open, high, low, closeP, volume)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// MarkDirty asks the TypeScript worker to recompute indicators for this series.
func (s *Store) MarkDirty(ctx context.Context, symbol string, tf market.Timeframe) error {
	return s.rdb.SAdd(ctx, KeyTaDirty, symbol+"|"+string(tf)).Err()
}

// PublishLive sends realtime prices as a plain JSON array (decodable by packages/store decode()).
func (s *Store) PublishLive(ctx context.Context, prices []market.LivePrice) error {
	payload, err := json.Marshal(prices)
	if err != nil {
		return err
	}
	return s.rdb.Publish(ctx, KeyLive, payload).Err()
}

// Rank returns symbols by 24h volume as last published by the worker (empty if none yet).
func (s *Store) Rank(ctx context.Context) ([]string, error) {
	raw, err := s.rdb.Get(ctx, KeyRank).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var symbols []string
	if err := json.Unmarshal(raw, &symbols); err != nil {
		return nil, fmt.Errorf("rank: %w", err)
	}
	return symbols, nil
}

// Demand returns symbols viewed since `since` and trims older entries.
func (s *Store) Demand(ctx context.Context, since time.Time) ([]string, error) {
	cutoff := strconv.FormatInt(since.UnixMilli(), 10)
	if err := s.rdb.ZRemRangeByScore(ctx, KeyDemand, "-inf", "("+cutoff).Err(); err != nil {
		return nil, err
	}
	return s.rdb.ZRangeByScore(ctx, KeyDemand, &redis.ZRangeBy{Min: cutoff, Max: "+inf"}).Result()
}
