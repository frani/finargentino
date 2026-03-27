package scraper

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gocolly/colly/v2"
)

const (
	EntitiesApiURL = "https://www.bcra.gob.ar/api-nomina-entidades.php?action=nomina_AAA00&lang=es"
	BaseBalanceURL = "https://www.bcra.gob.ar/entidades-financieras-estados-contables/?bco=%s&nom=%s"
)

var monthMap = map[string]int{
	"enero":      1,
	"febrero":    2,
	"marzo":      3,
	"abril":      4,
	"mayo":       5,
	"junio":      6,
	"julio":      7,
	"agosto":     8,
	"septiembre": 9,
	"octubre":    10,
	"noviembre":  11,
	"diciembre":  12,
}

func FetchEntities() ([]BCRAEntity, error) {
	resp, err := http.Get(EntitiesApiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var apiResp BCRAApiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, err
	}

	return apiResp.Entidades, nil
}

func ScrapeEntityBalance(entity BCRAEntity) ([]EntityBalance, error) {
	// Pad entity code with zeros to 5 digits
	paddedCode := fmt.Sprintf("%05d", entity.Codigo)
	urlEncodedName := url.QueryEscape(entity.Denominacion)
	targetURL := fmt.Sprintf(BaseBalanceURL, paddedCode, urlEncodedName)

	c := colly.NewCollector()
	
	var periods []struct {
		Year  int
		Month int
	}

	// label -> row info
	type rowInfo struct {
		Label       string
		Indentation int
		Values      []float64
	}
	var rows []rowInfo

	// General period parsing from any table header or cell
	c.OnHTML("th, td", func(e *colly.HTMLElement) {
		text := strings.TrimSpace(e.Text)
		if strings.Contains(text, "-") {
			parts := strings.Split(text, "-")
			if len(parts) == 2 {
				m := 0
				mon := strings.ToLower(parts[0])
				switch {
				case strings.HasPrefix(mon, "en"): m = 1
				case strings.HasPrefix(mon, "fe"): m = 2
				case strings.HasPrefix(mon, "ma"): m = 3
				case strings.HasPrefix(mon, "ab"): m = 4
				case strings.HasPrefix(mon, "my"): m = 5
				case strings.HasPrefix(mon, "jn"): m = 6
				case strings.HasPrefix(mon, "jl"): m = 7
				case strings.HasPrefix(mon, "ag"): m = 8
				case strings.HasPrefix(mon, "se"): m = 9
				case strings.HasPrefix(mon, "oc"): m = 10
				case strings.HasPrefix(mon, "no"): m = 11
				case strings.HasPrefix(mon, "di"): m = 12
				}
				y, _ := strconv.Atoi(parts[1])
				if y > 2000 && m > 0 {
					found := false
					for _, p := range periods {
						if p.Year == y && p.Month == m {
							found = true
							break
						}
					}
					if !found {
						periods = append(periods, struct{ Year, Month int }{y, m})
					}
				}
			}
		}
	})

	// Parse table rows globally
	c.OnHTML("tr", func(e *colly.HTMLElement) {
		var label string
		var indent int
		var vals []float64

		e.ForEach("td", func(i int, el *colly.HTMLElement) {
			if i == 0 {
				raw := el.Text
				trimmed := strings.TrimLeft(raw, " \t\n\r\u00a0")
				indent = (len(raw) - len(trimmed)) / 3 
				label = strings.TrimSpace(trimmed)
			} else {
				valStr := strings.Join(strings.Fields(el.Text), "")
				if valStr != "" && !strings.Contains(valStr, "[") {
					vals = append(vals, parseAmount(valStr))
				}
			}
		})

		if label != "" && len(vals) > 0 {
			// Filter out audit report and meta-info rows that are not relevant for financial analysis
			upperLabel := strings.ToUpper(label)
			if strings.Contains(upperLabel, "FAVORABLE") || 
			   strings.Contains(upperLabel, "SALVEDAD") || 
			   strings.Contains(upperLabel, "CIERRE DE EJERCICIO") ||
			   strings.Contains(upperLabel, "ABSTENCION") ||
			   strings.Contains(upperLabel, "ADVERSA") ||
			   strings.Contains(upperLabel, "ENFASIS") {
				return
			}
			rows = append(rows, rowInfo{Label: label, Indentation: indent, Values: vals})
		}
	})

	err := c.Visit(targetURL)
	if err != nil {
		fmt.Printf("[Scraper] Error visiting %s: %v\n", targetURL, err)
		return nil, err
	}

	if len(periods) == 0 {
		fmt.Printf("[Scraper] No periods found for %s (%s)\n", entity.Denominacion, targetURL)
		return nil, nil
	}

	var results []EntityBalance
	for i, p := range periods {
		b := EntityBalance{
			EntityCode: strconv.Itoa(entity.Codigo),
			EntityName: entity.Denominacion,
			Year:       p.Year,
			Month:      p.Month,
			LineItems:  []LineItem{},
		}

		for _, r := range rows {
			if i < len(r.Values) {
				val := r.Values[i]
				cleanLabel := strings.ToUpper(strings.Join(strings.Fields(r.Label), ""))
				switch cleanLabel {
				case "ACTIVO":
					b.Assets = val
				case "PASIVO":
					b.Liabilities = val
				case "PATRIMONIONETO":
					b.NetWorth = val
				}
				b.LineItems = append(b.LineItems, LineItem{
					Label:       r.Label,
					Indentation: r.Indentation,
					Value:       val,
				})
			}
		}

		results = append(results, b)
	}

	fmt.Printf("[Scraper] Parsed %d periods for %s\n", len(results), entity.Denominacion)
	return results, nil
}

func parseAmount(s string) float64 {
	// Remove dots (thousands separator) and replace comma with dot (decimal separator if exists)
	// In BCRA HTML it seems they use dots as thousands and no visible decimals in some views, 
	// or dots as decimal? Let's assume standard Arg format: . thousands, , decimal
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", ".")
	val, _ := strconv.ParseFloat(s, 64)
	return val
}
