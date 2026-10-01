-- Prices move from micro-units (1e-6 USD) to nano-units (1e-9 USD) so sub-cent assets stay exact.
ALTER TABLE asset_quotes RENAME COLUMN price_usd_micros TO price_usd_nanos;
ALTER TABLE asset_quotes RENAME COLUMN volume_usd_micros TO volume_usd_nanos;
UPDATE asset_quotes SET price_usd_nanos = price_usd_nanos * 1000, volume_usd_nanos = volume_usd_nanos * 1000;
