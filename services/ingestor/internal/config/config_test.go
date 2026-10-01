package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestDefaults(t *testing.T) {
	cfg, err := Load(env(map[string]string{"DATABASE_URL": "postgres://x", "REDIS_URL": "redis://y"}))
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.Realtime || cfg.HotCount != 40 || cfg.Workers != 4 || cfg.DemandTTL != 10*time.Minute || cfg.HealthAddr != ":8090" || cfg.KrakenRPS != 0.8 {
		t.Fatalf("cfg = %+v", cfg)
	}
}

func TestOverridesAndValidation(t *testing.T) {
	cfg, err := Load(env(map[string]string{"DATABASE_URL": "p", "REDIS_URL": "r", "REALTIME": "off", "HOT_COUNT": "80", "COINBASE_RPS": "3.5"}))
	if err != nil || cfg.Realtime || cfg.HotCount != 80 || cfg.CoinbaseRPS != 3.5 {
		t.Fatalf("cfg = %+v err = %v", cfg, err)
	}
	_, err = Load(env(map[string]string{"DATABASE_URL": "p", "REDIS_URL": "r", "HOT_COUNT": "0", "KRAKEN_RPS": "abc"}))
	if err == nil || !strings.Contains(err.Error(), "HOT_COUNT") || !strings.Contains(err.Error(), "KRAKEN_RPS") {
		t.Fatalf("err = %v", err)
	}
	if _, err := Load(env(map[string]string{})); err == nil {
		t.Fatal("missing URLs must fail")
	}
}
