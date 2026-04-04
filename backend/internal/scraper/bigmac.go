package scraper

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type BigMacPrice struct {
	Date        time.Time `json:"date"`
	IsoA3       string    `json:"iso_a3"`
	Name        string    `json:"name"`
	LocalPrice  float64   `json:"local_price"`
	DollarEx    float64   `json:"dollar_ex"`
	DollarPrice float64   `json:"dollar_price"`
	USDRaw      float64   `json:"usd_raw"`
}

func FetchBigMacIndex() ([]BigMacPrice, error) {
	url := "https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-full-index.csv"
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching big mac data: %w", err)
	}
	defer resp.Body.Close()

	reader := csv.NewReader(resp.Body)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("error parsing big mac csv: %w", err)
	}

	var rows []BigMacPrice
	// Skipping header
	for i, record := range records {
		if i == 0 {
			continue
		}
		
		if len(record) < 8 {
			continue
		}

		isoA3 := record[1]
		name := record[3]

		dateStr := record[0]
		localPriceStr := record[4]
		dollarExStr := record[5]
		dollarPriceStr := record[6]
		usdRawStr := record[7]

		date, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		localPrice, _ := strconv.ParseFloat(localPriceStr, 64)
		dollarEx, _ := strconv.ParseFloat(dollarExStr, 64)
		dollarPrice, _ := strconv.ParseFloat(dollarPriceStr, 64)
		usdRaw, _ := strconv.ParseFloat(usdRawStr, 64)

		rows = append(rows, BigMacPrice{
			Date:        date,
			IsoA3:       isoA3,
			Name:        name,
			LocalPrice:  localPrice,
			DollarEx:    dollarEx,
			DollarPrice: dollarPrice,
			USDRaw:      usdRaw,
		})
	}
	
	return rows, nil
}
