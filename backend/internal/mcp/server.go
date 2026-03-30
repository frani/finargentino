package mcp

import (
	"context"
	"database/sql"
	"encoding/json"
	"finargentina-server/internal/db"
	"finargentina-server/internal/scraper"
	"fmt"
	"net/http"
	"time"
)

type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
	ID      interface{}     `json:"id"`
}

type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   interface{} `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

type Server struct {
	Service *db.Service
}

func NewServer(service *db.Service) *Server {
	return &Server{Service: service}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req JSONRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.sendError(w, nil, -32700, "Parse error")
		return
	}

	ctx := r.Context()
	var result interface{}
	var err error

	switch req.Method {
	case "resources/list":
		result, err = s.handleResourcesList(ctx)
	case "resources/read":
		result, err = s.handleResourcesRead(ctx, req.Params)
	case "tools/call":
		result, err = s.handleToolsCall(ctx, req.Params)
	default:
		s.sendError(w, req.ID, -32601, "Method not found")
		return
	}

	if err != nil {
		s.sendError(w, req.ID, -32603, err.Error())
		return
	}

	s.sendResult(w, req.ID, result)
}

func (s *Server) handleResourcesList(ctx context.Context) (interface{}, error) {
	entities, err := s.Service.GetEntities(ctx)
	if err != nil {
		return nil, err
	}

	var resources []map[string]interface{}
	for _, e := range entities {
		resources = append(resources, map[string]interface{}{
			"uri":  fmt.Sprintf("finargentina://statements/%d", e.Codigo),
			"name": fmt.Sprintf("Balances de %s", e.Denominacion),
			"annotations": map[string]interface{}{
				"latest_assets": e.LatestAssets,
			},
		})
	}

	return map[string]interface{}{
		"resources": resources,
	}, nil
}

func (s *Server) handleResourcesRead(ctx context.Context, params json.RawMessage) (interface{}, error) {
	var p struct {
		URI string `json:"uri"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, err
	}

	// finargentina://statements/{bco_code}
	var bcoCode string
	fmt.Sscanf(p.URI, "finargentina://statements/%s", &bcoCode)

	balances, err := s.Service.GetBalances(ctx, bcoCode)
	if err != nil {
		return nil, err
	}

	balancesJSON, _ := json.Marshal(balances)
	return map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"uri":      p.URI,
				"mimeType": "application/json",
				"text":     string(balancesJSON),
			},
		},
	}, nil
}

func (s *Server) handleToolsCall(ctx context.Context, params json.RawMessage) (interface{}, error) {
	var p struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, err
	}

	if p.Name == "sync_bcra_data" {
		go s.syncData()
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": "Sincronización iniciada en segundo plano."},
			},
		}, nil
	}

	if p.Name == "get_market_overview" {
		overview, err := s.Service.GetMarketOverview(ctx)
		if err != nil {
			return nil, err
		}
		overviewJSON, _ := json.Marshal(overview)
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": string(overviewJSON)},
			},
		}, nil
	}

	if p.Name == "get_last_sync_date" {
		lastSync, err := s.Service.GetLastSyncDate(ctx)
		if err != nil {
			return nil, err
		}
		var text string
		if lastSync.IsZero() {
			text = ""
		} else {
			text = lastSync.Format(time.RFC3339)
		}
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": text},
			},
		}, nil
	}

	if p.Name == "get_available_periods" {
		periods, err := s.Service.GetAvailablePeriods(ctx)
		if err != nil {
			return nil, err
		}
		periodsJSON, _ := json.Marshal(periods)
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": string(periodsJSON)},
			},
		}, nil
	}

	if p.Name == "get_latest_balances" {
		var balances []scraper.EntityBalance
		var err error

		var periodParams struct {
			Year  int `json:"year"`
			Month int `json:"month"`
		}
		json.Unmarshal(p.Arguments, &periodParams)

		if periodParams.Year > 0 && periodParams.Month > 0 {
			balances, err = s.Service.GetBalancesForPeriod(ctx, periodParams.Year, periodParams.Month)
		} else {
			balances, err = s.Service.GetLatestBalances(ctx)
		}

		if err != nil {
			return nil, err
		}
		balancesJSON, _ := json.Marshal(balances)
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": string(balancesJSON)},
			},
		}, nil
	}

	if p.Name == "sync_fx_rates" {
		go s.syncFXRates()
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": "Sincronización de FX iniciada en segundo plano."},
			},
		}, nil
	}

	if p.Name == "get_fx_rates" {
		rates, err := s.Service.GetLatestFXRates(ctx)
		if err != nil {
			return nil, err
		}
		ratesJSON, _ := json.Marshal(rates)
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": string(ratesJSON)},
			},
		}, nil
	}

	if p.Name == "get_fx_history" {
		var args struct {
			Ticker string `json:"ticker"`
			Days   int    `json:"days"`
		}
		json.Unmarshal(p.Arguments, &args)
		if args.Ticker == "" {
			args.Ticker = "ARS/USD"
		}
		history, err := s.Service.GetFXRateHistory(ctx, args.Ticker, args.Days)
		if err != nil {
			return nil, err
		}
		histJSON, _ := json.Marshal(history)
		return map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": string(histJSON)},
			},
		}, nil
	}

	return nil, fmt.Errorf("tool not found")

}

func (s *Server) syncData() {
	logPrefix := "[Sync]"
	fmt.Println(logPrefix, "Starting sync...")
	
	ctx := context.Background()
	
	// Fetch updated_at map from DB
	rows, err := s.Service.DB.QueryContext(ctx, "SELECT bco_code, updated_at FROM entities")
	if err != nil {
		fmt.Println(logPrefix, "Error fetching entities from DB:", err)
		// We can gracefully continue without the map, or maybe return.
		// Let's just create an empty map on error.
	}
	
	updateTimes := make(map[int]time.Time)
	if err == nil {
		for rows.Next() {
			var codeStr string
			var updatedAt sql.NullTime
			if err := rows.Scan(&codeStr, &updatedAt); err == nil {
				var code int
				fmt.Sscanf(codeStr, "%d", &code)
				if updatedAt.Valid {
					updateTimes[code] = updatedAt.Time
				}
			}
		}
		rows.Close()
	}

	entities, err := scraper.FetchEntities()
	if err != nil {
		fmt.Println(logPrefix, "Error fetching entities:", err)
		return
	}

	for _, e := range entities {
		if lastUpdated, exists := updateTimes[e.Codigo]; exists {
			if time.Since(lastUpdated) < 24*time.Hour {
				fmt.Println(logPrefix, "Skipping:", e.Denominacion, "(recently updated)")
				continue
			}
		}

		fmt.Println(logPrefix, "Scraping:", e.Denominacion)
		balances, err := scraper.ScrapeEntityBalance(e)
		if err != nil {
			fmt.Println(logPrefix, "Error scraping", e.Codigo, ":", err)
			continue
		}
		for _, b := range balances {
			if b.Year == 0 {
				continue
			}
			if err := s.Service.SaveBalance(context.Background(), &b); err != nil {
				fmt.Println(logPrefix, "Error saving", e.Codigo, b.Year, b.Month, ":", err)
			}
		}
	}
	fmt.Println(logPrefix, "Sync completed.")
}

func (s *Server) sendError(w http.ResponseWriter, id interface{}, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: map[string]interface{}{
			"code":    code,
			"message": message,
		},
	})
}

func (s *Server) sendResult(w http.ResponseWriter, id interface{}, result interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	})
}

// casaToTicker maps dolarapi.com "casa" values to our ticker convention.
var casaToTicker = map[string]string{
	"oficial":         "ARS/USD",
	"blue":            "ARS_BLUE/USD",
	"bolsa":           "ARS_MEP/USD",
	"contadoconliqui": "ARS_CCL/USD",
	"mayorista":       "ARS_MAYORISTA/USD",
	"cripto":          "ARS_CRYPTO/USD",
	"tarjeta":         "ARS_TARJETA/USD",
}

// dolarAPIResponse is the shape returned by https://dolarapi.com/v1/dolares
type dolarAPIResponse struct {
	Casa                string   `json:"casa"`
	Nombre              string   `json:"nombre"`
	Compra              *float64 `json:"compra"`
	Venta               *float64 `json:"venta"`
	FechaActualizacion  string   `json:"fechaActualizacion"`
}

func (s *Server) syncFXRates() {
	logPrefix := "[SyncFX]"
	fmt.Println(logPrefix, "Fetching FX rates from dolarapi.com...")

	resp, err := http.Get("https://dolarapi.com/v1/dolares")
	if err != nil {
		fmt.Println(logPrefix, "HTTP error:", err)
		return
	}
	defer resp.Body.Close()

	var apiRates []dolarAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiRates); err != nil {
		fmt.Println(logPrefix, "Decode error:", err)
		return
	}

	ctx := context.Background()
	var rows []db.FXRateRow

	for _, r := range apiRates {
		ticker, ok := casaToTicker[r.Casa]
		if !ok {
			ticker = "ARS_" + r.Casa + "/USD"
		}

		// Parse source timestamp; fall back to now if malformed.
		sourceTS, err := time.Parse(time.RFC3339, r.FechaActualizacion)
		if err != nil {
			sourceTS = time.Now().UTC()
		}

		if r.Compra != nil {
			rows = append(rows, db.FXRateRow{
				Ticker:   ticker,
				Side:     "compra",
				Value:    *r.Compra,
				SourceTS: sourceTS,
			})
		}
		if r.Venta != nil {
			rows = append(rows, db.FXRateRow{
				Ticker:   ticker,
				Side:     "venta",
				Value:    *r.Venta,
				SourceTS: sourceTS,
			})
		}
	}

	if err := s.Service.SaveFXRates(ctx, rows); err != nil {
		fmt.Println(logPrefix, "Save error:", err)
		return
	}
	fmt.Println(logPrefix, "Saved", len(rows), "FX rate rows.")
}

