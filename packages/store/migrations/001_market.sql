-- Market data only. No personal data is stored in this database.

CREATE TABLE IF NOT EXISTS candles (
  symbol       text        NOT NULL,
  timeframe    text        NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '1h', '1d')),
  bucket_start timestamptz NOT NULL,
  open         double precision NOT NULL,
  high         double precision NOT NULL,
  low          double precision NOT NULL,
  close        double precision NOT NULL,
  volume       double precision NOT NULL,
  source       text        NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, timeframe, bucket_start)
);

-- Aggregated reference quotes (median of sources), one row per asset per snapshot.
CREATE TABLE IF NOT EXISTS asset_quotes (
  symbol             text        NOT NULL,
  taken_at           timestamptz NOT NULL,
  price_usd_micros   bigint      NOT NULL,
  change_24h_bps     integer,
  volume_usd_micros  numeric     NOT NULL,
  sources            text[]      NOT NULL,
  max_deviation_bps  integer     NOT NULL,
  PRIMARY KEY (symbol, taken_at)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  taken_at     timestamptz NOT NULL,
  source       text        NOT NULL,
  vnd_per_usd  bigint      NOT NULL,
  PRIMARY KEY (source, taken_at)
);

CREATE INDEX IF NOT EXISTS asset_quotes_taken_at_idx ON asset_quotes (taken_at);
