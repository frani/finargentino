CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    bco_code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_statements (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    assets NUMERIC(15, 2) DEFAULT 0,
    liabilities NUMERIC(15, 2) DEFAULT 0,
    net_worth NUMERIC(15, 2) DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id, period_year, period_month)
);

-- FX rates: historical snapshots of USD exchange rates in Argentina
-- ticker examples: ARS/USD, ARS_BLUE/USD, ARS_CCL/USD, ARS_MEP/USD,
--                  ARS_CRYPTO/USD, ARS_TARJETA/USD, ARS_MAYORISTA/USD
CREATE TABLE IF NOT EXISTS fx_rates (
    id          BIGSERIAL PRIMARY KEY,
    ticker      VARCHAR(30)    NOT NULL,
    side        VARCHAR(10)    NOT NULL CHECK (side IN ('compra', 'venta')),
    value       NUMERIC(15, 4) NOT NULL,
    source_ts   TIMESTAMP WITH TIME ZONE NOT NULL,
    fetched_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Avoid inserting duplicate snapshots (same ticker + side + source timestamp)
CREATE UNIQUE INDEX IF NOT EXISTS ux_fx_rates_ticker_side_ts
    ON fx_rates (ticker, side, source_ts);

-- Index for efficient latest-rate queries
CREATE INDEX IF NOT EXISTS idx_fx_rates_ticker_ts
    ON fx_rates (ticker, source_ts DESC);

-- Agricultural commodity prices (Soja, Maiz, Trigo, etc.)
-- ticker examples: SOJA, MAIZ, TRIGO, GIRASOL, SORGO
CREATE TABLE IF NOT EXISTS agro_prices (
    id          BIGSERIAL PRIMARY KEY,
    ticker      VARCHAR(30)    NOT NULL,
    price       NUMERIC(15, 4) NOT NULL,
    unit        VARCHAR(10)    DEFAULT 'USD/TN', -- standard is USD per tonne
    source_ts   TIMESTAMP WITH TIME ZONE NOT NULL,
    fetched_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_agro_prices_ticker_ts
    ON agro_prices (ticker, source_ts);

-- Index for efficient latest queries
CREATE INDEX IF NOT EXISTS idx_agro_prices_ticker_ts
    ON agro_prices (ticker, source_ts DESC);

-- Debtor summaries per entity and period
CREATE TABLE IF NOT EXISTS debtor_summaries (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    bco_code VARCHAR(10) NOT NULL, -- To easily link by bank code
    period_date DATE NOT NULL,      -- Full date representating the period (e.g. YYYY-MM-01)
    debtor_count INTEGER NOT NULL,
    total_debt_amount NUMERIC(20, 2) NOT NULL,
    debt_sit_1 NUMERIC(20, 2) DEFAULT 0,
    debt_sit_2 NUMERIC(20, 2) DEFAULT 0,
    debt_sit_3 NUMERIC(20, 2) DEFAULT 0,
    debt_sit_4 NUMERIC(20, 2) DEFAULT 0,
    debt_sit_5 NUMERIC(20, 2) DEFAULT 0,
    debt_sit_11 NUMERIC(20, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id, period_date)
);

-- Index for period queries
CREATE INDEX IF NOT EXISTS idx_debtor_summaries_period_date ON debtor_summaries(period_date);

