package db

import (
	"context"
	"fmt"
	"time"
)

type BigMacIndexRow struct {
	Date        time.Time `json:"date"`
	IsoA3       string    `json:"iso_a3"`
	Name        string    `json:"name"`
	LocalPrice  float64   `json:"local_price"`
	DollarEx    float64   `json:"dollar_ex"`
	DollarPrice float64   `json:"dollar_price"`
	USDRaw      float64   `json:"usd_raw"`
}

func (s *Service) SaveBigMacIndex(ctx context.Context, rows []BigMacIndexRow) error {
	query := `
		INSERT INTO big_mac_index (date, iso_a3, name, local_price, dollar_ex, dollar_price, usd_raw)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (date, iso_a3) DO NOTHING
	`
	for _, r := range rows {
		if _, err := s.DB.ExecContext(ctx, query, r.Date, r.IsoA3, r.Name, r.LocalPrice, r.DollarEx, r.DollarPrice, r.USDRaw); err != nil {
			return fmt.Errorf("SaveBigMacIndex: %w", err)
		}
	}
	return nil
}

func (s *Service) GetLatestBigMac(ctx context.Context) (*BigMacIndexRow, error) {
	query := `
		SELECT date, iso_a3, name, local_price, dollar_ex, dollar_price, usd_raw
		FROM big_mac_index
		WHERE iso_a3 = 'ARG'
		ORDER BY date DESC
		LIMIT 1
	`
	var r BigMacIndexRow
	err := s.DB.QueryRowContext(ctx, query).Scan(&r.Date, &r.IsoA3, &r.Name, &r.LocalPrice, &r.DollarEx, &r.DollarPrice, &r.USDRaw)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Service) GetBigMacHistory(ctx context.Context, isoA3 string) ([]BigMacIndexRow, error) {
	query := `
		SELECT date, iso_a3, name, local_price, dollar_ex, dollar_price, usd_raw
		FROM big_mac_index
		WHERE $1 = '' OR iso_a3 = $1
		ORDER BY date ASC
	`
	rows, err := s.DB.QueryContext(ctx, query, isoA3)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []BigMacIndexRow
	for rows.Next() {
		var r BigMacIndexRow
		if err := rows.Scan(&r.Date, &r.IsoA3, &r.Name, &r.LocalPrice, &r.DollarEx, &r.DollarPrice, &r.USDRaw); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}
