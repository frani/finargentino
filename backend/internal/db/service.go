package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"finargentina-server/internal/scraper"
	"fmt"
	"time"
)

type Service struct {
	DB *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{DB: db}
}

func (s *Service) SaveEntity(ctx context.Context, e scraper.BCRAEntity) (int, error) {
	var id int
	query := `
		INSERT INTO entities (bco_code, name, updated_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		ON CONFLICT (bco_code) DO UPDATE 
		SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`
	err := s.DB.QueryRowContext(ctx, query, fmt.Sprintf("%d", e.Codigo), e.Denominacion).Scan(&id)
	return id, err
}

func (s *Service) SaveBalance(ctx context.Context, b *scraper.EntityBalance) error {
	entityID, err := s.SaveEntity(ctx, scraper.BCRAEntity{
		Codigo:       atoi(b.EntityCode),
		Denominacion: b.EntityName,
	})
	if err != nil {
		return fmt.Errorf("error saving entity: %w", err)
	}

	lineItemsJSON, _ := json.Marshal(b.LineItems)

	query := `
		INSERT INTO financial_statements (entity_id, period_year, period_month, assets, liabilities, net_worth, details)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (entity_id, period_year, period_month) DO UPDATE 
		SET assets = EXCLUDED.assets, 
		    liabilities = EXCLUDED.liabilities, 
		    net_worth = EXCLUDED.net_worth,
		    details = EXCLUDED.details
	`
	_, err = s.DB.ExecContext(ctx, query, entityID, b.Year, b.Month, b.Assets, b.Liabilities, b.NetWorth, lineItemsJSON)
	return err
}

func (s *Service) GetEntities(ctx context.Context) ([]scraper.BCRAEntity, error) {
	query := `
		SELECT e.bco_code, e.name, COALESCE(latest.assets, 0)
		FROM entities e
		LEFT JOIN (
			SELECT DISTINCT ON (entity_id) entity_id, assets
			FROM financial_statements
			ORDER BY entity_id, period_year DESC, period_month DESC
		) latest ON e.id = latest.entity_id
		ORDER BY latest.assets DESC NULLS LAST, e.name ASC
	`
	rows, err := s.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entities []scraper.BCRAEntity
	for rows.Next() {
		var e scraper.BCRAEntity
		var codeStr string
		if err := rows.Scan(&codeStr, &e.Denominacion, &e.LatestAssets); err != nil {
			return nil, err
		}
		e.Codigo = atoi(codeStr)
		entities = append(entities, e)
	}
	return entities, nil
}

func (s *Service) GetBalances(ctx context.Context, bcoCode string) ([]scraper.EntityBalance, error) {
	query := `
		SELECT e.bco_code, e.name, fs.period_year, fs.period_month, fs.assets, fs.liabilities, fs.net_worth,
		       COALESCE(ds.debtor_count, 0), COALESCE(ds.total_debt_amount, 0),
		       COALESCE(ds.debt_sit_1, 0), COALESCE(ds.debt_sit_2, 0), COALESCE(ds.debt_sit_3, 0),
		       COALESCE(ds.debt_sit_4, 0), COALESCE(ds.debt_sit_5, 0), COALESCE(ds.debt_sit_11, 0),
		       fs.details
		FROM financial_statements fs
		JOIN entities e ON fs.entity_id = e.id
		LEFT JOIN debtor_summaries ds ON e.id = ds.entity_id AND ds.period_date = MAKE_DATE(fs.period_year, fs.period_month, 1)
		WHERE e.bco_code = $1
		ORDER BY fs.period_year DESC, fs.period_month DESC
	`
	rows, err := s.DB.QueryContext(ctx, query, bcoCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []scraper.EntityBalance
	for rows.Next() {
		var b scraper.EntityBalance
		var detailsJSON []byte
		if err := rows.Scan(
			&b.EntityCode, &b.EntityName, &b.Year, &b.Month, 
			&b.Assets, &b.Liabilities, &b.NetWorth, 
			&b.DebtorsCount, &b.TotalDebtAmount, &b.DebtSit1, &b.DebtSit2, &b.DebtSit3, &b.DebtSit4, &b.DebtSit5, &b.DebtSit11,
			&detailsJSON,
		); err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			json.Unmarshal(detailsJSON, &b.LineItems)
		}
		balances = append(balances, b)
	}
	return balances, nil
}

func (s *Service) GetAvailablePeriods(ctx context.Context) ([]map[string]int, error) {
	query := `
		SELECT DISTINCT period_year, period_month
		FROM financial_statements
		ORDER BY period_year DESC, period_month DESC
	`
	rows, err := s.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var periods []map[string]int
	for rows.Next() {
		var y, m int
		if err := rows.Scan(&y, &m); err != nil {
			return nil, err
		}
		periods = append(periods, map[string]int{"year": y, "month": m})
	}
	return periods, nil
}

func (s *Service) GetBalancesForPeriod(ctx context.Context, year, month int) ([]scraper.EntityBalance, error) {
	query := `
		SELECT e.bco_code, e.name, fs.period_year, fs.period_month, fs.assets, fs.liabilities, fs.net_worth,
		       COALESCE(ds.debtor_count, 0), COALESCE(ds.total_debt_amount, 0),
		       COALESCE(ds.debt_sit_1, 0), COALESCE(ds.debt_sit_2, 0), COALESCE(ds.debt_sit_3, 0),
		       COALESCE(ds.debt_sit_4, 0), COALESCE(ds.debt_sit_5, 0), COALESCE(ds.debt_sit_11, 0),
		       fs.details
		FROM entities e
		JOIN financial_statements fs ON e.id = fs.entity_id
		LEFT JOIN debtor_summaries ds ON e.id = ds.entity_id AND ds.period_date = MAKE_DATE(fs.period_year, fs.period_month, 1)
		WHERE fs.period_year = $1 AND fs.period_month = $2
		ORDER BY fs.assets DESC
	`
	rows, err := s.DB.QueryContext(ctx, query, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []scraper.EntityBalance
	for rows.Next() {
		var b scraper.EntityBalance
		var detailsJSON []byte
		if err := rows.Scan(
			&b.EntityCode, &b.EntityName, &b.Year, &b.Month, 
			&b.Assets, &b.Liabilities, &b.NetWorth, 
			&b.DebtorsCount, &b.TotalDebtAmount, &b.DebtSit1, &b.DebtSit2, &b.DebtSit3, &b.DebtSit4, &b.DebtSit5, &b.DebtSit11,
			&detailsJSON,
		); err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			json.Unmarshal(detailsJSON, &b.LineItems)
		}
		balances = append(balances, b)
	}
	return balances, nil
}

func (s *Service) GetLatestBalances(ctx context.Context) ([]scraper.EntityBalance, error) {
	query := `
		SELECT DISTINCT ON (e.id) e.bco_code, e.name, fs.period_year, fs.period_month, fs.assets, fs.liabilities, fs.net_worth,
		       COALESCE(ds.debtor_count, 0), COALESCE(ds.total_debt_amount, 0),
		       COALESCE(ds.debt_sit_1, 0), COALESCE(ds.debt_sit_2, 0), COALESCE(ds.debt_sit_3, 0),
		       COALESCE(ds.debt_sit_4, 0), COALESCE(ds.debt_sit_5, 0), COALESCE(ds.debt_sit_11, 0),
		       fs.details
		FROM entities e
		JOIN financial_statements fs ON e.id = fs.entity_id
		LEFT JOIN debtor_summaries ds ON e.id = ds.entity_id AND ds.period_date = MAKE_DATE(fs.period_year, fs.period_month, 1)
		ORDER BY e.id, fs.period_year DESC, fs.period_month DESC
	`
	rows, err := s.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []scraper.EntityBalance
	for rows.Next() {
		var b scraper.EntityBalance
		var detailsJSON []byte
		if err := rows.Scan(
			&b.EntityCode, &b.EntityName, &b.Year, &b.Month, 
			&b.Assets, &b.Liabilities, &b.NetWorth, 
			&b.DebtorsCount, &b.TotalDebtAmount, &b.DebtSit1, &b.DebtSit2, &b.DebtSit3, &b.DebtSit4, &b.DebtSit5, &b.DebtSit11,
			&detailsJSON,
		); err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			json.Unmarshal(detailsJSON, &b.LineItems)
		}
		balances = append(balances, b)
	}
	return balances, nil
}

func (s *Service) GetMarketOverview(ctx context.Context) (*scraper.MarketOverview, error) {
	query := `
		SELECT 
			period_year, 
			period_month, 
			SUM(assets) as total_assets, 
			SUM(liabilities) as total_liabilities, 
			SUM(net_worth) as total_net_worth,
			CASE WHEN SUM(assets) > 0 THEN (SUM(net_worth) / SUM(assets)) * 100 ELSE 0 END as avg_solvency,
			COUNT(DISTINCT entity_id) as entity_count
		FROM financial_statements
		GROUP BY period_year, period_month
		ORDER BY period_year ASC, period_month ASC
	`
	rows, err := s.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var overview scraper.MarketOverview
	for rows.Next() {
		var p scraper.MarketPeriod
		if err := rows.Scan(&p.Year, &p.Month, &p.TotalAssets, &p.TotalLiabilities, &p.TotalNetWorth, &p.AvgSolvency, &p.EntityCount); err != nil {
			return nil, err
		}
		overview.History = append(overview.History, p)
	}
	return &overview, nil
}

func (s *Service) GetLastSyncDate(ctx context.Context) (time.Time, error) {
	var lastSync sql.NullTime
	query := `SELECT MAX(updated_at) FROM entities`
	err := s.DB.QueryRowContext(ctx, query).Scan(&lastSync)
	if err != nil {
		// Use empty time.Time if error or table is empty
		return time.Time{}, nil
	}
	return lastSync.Time, nil
}

// FXRateRow represents a single row in the fx_rates table.
type FXRateRow struct {
	Ticker    string    `json:"ticker"`
	Side      string    `json:"side"`
	Value     float64   `json:"value"`
	SourceTS  time.Time `json:"source_ts"`
	FetchedAt time.Time `json:"fetched_at"`
}

// SaveFXRates upserts a batch of FX rate rows.
// Duplicate snapshots (ticker+side+source_ts) are silently ignored.
func (s *Service) SaveFXRates(ctx context.Context, rows []FXRateRow) error {
	query := `
		INSERT INTO fx_rates (ticker, side, value, source_ts)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (ticker, side, source_ts) DO NOTHING
	`
	for _, r := range rows {
		if _, err := s.DB.ExecContext(ctx, query, r.Ticker, r.Side, r.Value, r.SourceTS); err != nil {
			return fmt.Errorf("SaveFXRates %s/%s: %w", r.Ticker, r.Side, err)
		}
	}
	return nil
}

// GetLatestFXRates returns the most recent compra+venta for each ticker.
func (s *Service) GetLatestFXRates(ctx context.Context) ([]FXRateRow, error) {
	query := `
		SELECT DISTINCT ON (ticker, side)
			ticker, side, value, source_ts, fetched_at
		FROM fx_rates
		ORDER BY ticker, side, source_ts DESC
	`
	rows, err := s.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []FXRateRow
	for rows.Next() {
		var r FXRateRow
		if err := rows.Scan(&r.Ticker, &r.Side, &r.Value, &r.SourceTS, &r.FetchedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}

// GetFXRateHistory returns the last N days of snapshots for a given ticker.
func (s *Service) GetFXRateHistory(ctx context.Context, ticker string, days int) ([]FXRateRow, error) {
	if days <= 0 {
		days = 30
	}
	query := `
		SELECT ticker, side, value, source_ts, fetched_at
		FROM fx_rates
		WHERE ticker = $1
		  AND source_ts >= NOW() - ($2 * interval '1 day')
		ORDER BY source_ts ASC, side ASC
	`
	rows, err := s.DB.QueryContext(ctx, query, ticker, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []FXRateRow
	for rows.Next() {
		var r FXRateRow
		if err := rows.Scan(&r.Ticker, &r.Side, &r.Value, &r.SourceTS, &r.FetchedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}

// AgroPriceRow represents a single row in the agro_prices table.
type AgroPriceRow struct {
	Ticker    string    `json:"ticker"`
	Price     float64   `json:"price"`
	Unit      string    `json:"unit"`
	SourceTS  time.Time `json:"source_ts"`
	FetchedAt time.Time `json:"fetched_at"`
}

// SaveAgroPrices upserts a batch of agricultural price rows.
func (s *Service) SaveAgroPrices(ctx context.Context, rows []AgroPriceRow) error {
	query := `
		INSERT INTO agro_prices (ticker, price, unit, source_ts)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (ticker, source_ts) DO NOTHING
	`
	for _, r := range rows {
		if _, err := s.DB.ExecContext(ctx, query, r.Ticker, r.Price, r.Unit, r.SourceTS); err != nil {
			return fmt.Errorf("SaveAgroPrices %s: %w", r.Ticker, err)
		}
	}
	return nil
}

// GetLatestAgroPrices returns the most recent price for each agricultural commodity.
func (s *Service) GetLatestAgroPrices(ctx context.Context) ([]AgroPriceRow, error) {
	query := `
		SELECT DISTINCT ON (ticker)
			ticker, price, unit, source_ts, fetched_at
		FROM agro_prices
		ORDER BY ticker, source_ts DESC
	`
	rows, err := s.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AgroPriceRow
	for rows.Next() {
		var r AgroPriceRow
		if err := rows.Scan(&r.Ticker, &r.Price, &r.Unit, &r.SourceTS, &r.FetchedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}

// GetAgroPriceHistory returns snapshots for a given grain, either by last N days or a specific date range.
func (s *Service) GetAgroPriceHistory(ctx context.Context, ticker string, days int, start, end string) ([]AgroPriceRow, error) {
	var query string
	var args []interface{}
	args = append(args, ticker)

	if start != "" && end != "" {
		query = `
			SELECT ticker, price, unit, source_ts, fetched_at
			FROM agro_prices
			WHERE ticker = $1
			  AND source_ts BETWEEN $2 AND $3
			ORDER BY source_ts ASC
		`
		args = append(args, start, end)
	} else {
		if days <= 0 {
			days = 90
		}
		query = `
			SELECT ticker, price, unit, source_ts, fetched_at
			FROM agro_prices
			WHERE ticker = $1
			  AND source_ts >= NOW() - ($2 * interval '1 day')
			ORDER BY source_ts ASC
		`
		args = append(args, days)
	}

	rows, err := s.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AgroPriceRow
	for rows.Next() {
		var r AgroPriceRow
		if err := rows.Scan(&r.Ticker, &r.Price, &r.Unit, &r.SourceTS, &r.FetchedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}

func atoi(s string) int {
	var i int
	fmt.Sscanf(s, "%d", &i)
	return i
}
