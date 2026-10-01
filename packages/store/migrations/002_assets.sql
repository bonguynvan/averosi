-- Asset universe discovered from exchanges' public USD (fiat) catalogs. Market data only.

CREATE TABLE IF NOT EXISTS assets (
  symbol      text        PRIMARY KEY,
  name        text        NOT NULL,
  sources     text[]      NOT NULL,
  -- Exchange product ids by source name, e.g. {"Coinbase":"BTC-USD","Kraken":"XBTUSD"}.
  venues      jsonb       NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_active_idx ON assets (active);
