// Package config reads the ingestor's environment. Secrets (URLs with passwords) come only from env.
package config

import (
	"errors"
	"fmt"
	"strconv"
	"time"
)

type Config struct {
	DatabaseURL string
	RedisURL    string
	HealthAddr  string
	Realtime    bool
	// HotCount assets (by 24h volume) get all timeframes near real time; the rest only 1h/1d.
	HotCount int
	// Assets viewed within DemandTTL are treated as hot too.
	DemandTTL time.Duration
	Workers   int
	// Requests per second per exchange, below their published public limits.
	CoinbaseRPS float64
	KrakenRPS   float64
	BitstampRPS float64
}

// Load parses the environment through getenv (os.Getenv in production, a map in tests).
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL: getenv("DATABASE_URL"),
		RedisURL:    getenv("REDIS_URL"),
		HealthAddr:  orDefault(getenv("HEALTH_ADDR"), ":8090"),
	}
	if cfg.DatabaseURL == "" || cfg.RedisURL == "" {
		return Config{}, errors.New("DATABASE_URL and REDIS_URL are required")
	}
	var errs []error
	cfg.Realtime = orDefault(getenv("REALTIME"), "on") == "on"
	cfg.HotCount = intVar(getenv, "HOT_COUNT", 40, 1, 1000, &errs)
	cfg.Workers = intVar(getenv, "CANDLE_WORKERS", 4, 1, 32, &errs)
	cfg.DemandTTL = time.Duration(intVar(getenv, "DEMAND_TTL_MINUTES", 10, 1, 1440, &errs)) * time.Minute
	cfg.CoinbaseRPS = floatVar(getenv, "COINBASE_RPS", 5, &errs)
	cfg.KrakenRPS = floatVar(getenv, "KRAKEN_RPS", 0.8, &errs)
	cfg.BitstampRPS = floatVar(getenv, "BITSTAMP_RPS", 2, &errs)
	return cfg, errors.Join(errs...)
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func intVar(getenv func(string) string, name string, def, lo, hi int, errs *[]error) int {
	raw := getenv(name)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < lo || v > hi {
		*errs = append(*errs, fmt.Errorf("%s must be an integer in [%d, %d]", name, lo, hi))
		return def
	}
	return v
}

func floatVar(getenv func(string) string, name string, def float64, errs *[]error) float64 {
	raw := getenv(name)
	if raw == "" {
		return def
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v <= 0 || v > 50 {
		*errs = append(*errs, fmt.Errorf("%s must be a number in (0, 50]", name))
		return def
	}
	return v
}
