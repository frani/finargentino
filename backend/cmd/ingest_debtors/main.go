package main

import (
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
	"context"
	"path/filepath"

	"finargentina-server/internal/db"
	_ "github.com/joho/godotenv/autoload"
)

func main() {
	// Look for the CSV file (YYYY-MM-DEUDORES.csv) in the root directory (../)
	matches, err := filepath.Glob("../*-DEUDORES.csv")
	if err != nil || len(matches) == 0 {
		log.Fatal("No se encontró el archivo CSV de deudores. Por favor ejecuta el script de análisis primero.")
	}

	csvPath := matches[len(matches)-1] // Take latest
	fmt.Printf("Ingestando datos desde: %s\n", csvPath)

	// Extract date from filename: YYYY-MM-DEUDORES.csv
	parts := strings.Split(filepath.Base(csvPath), "-")
	if len(parts) < 2 {
		log.Fatal("Nombre de archivo CSV inválido")
	}
	periodDateStr := parts[0] + "-" + parts[1] + "-01"
	periodDate, err := time.Parse("2006-01-02", periodDateStr)
	if err != nil {
		log.Fatalf("Error parsing date from filename: %v", err)
	}

	file, err := os.Open(csvPath)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		log.Fatal(err)
	}

	// Connect to DB
	database, err := db.Connect()
	if err != nil {
		log.Fatalf("Could not connect to DB: %v", err)
	}
	defer database.Close()

	// Ensure schema is updated
	if err := db.InitSchema(database); err != nil {
		log.Printf("Warning: InitSchema failed (might be okay if already current): %v", err)
	}

	tx, err := database.BeginTx(context.Background(), nil)
	if err != nil {
		log.Fatal(err)
	}

	stmt, err := tx.Prepare(`
		INSERT INTO debtor_summaries (
			entity_id, bco_code, period_date, debtor_count, total_debt_amount,
			debt_sit_1, debt_sit_2, debt_sit_3, debt_sit_4, debt_sit_5, debt_sit_11
		)
		SELECT e.id, $1::VARCHAR, $2::DATE, $3::INTEGER, $4::NUMERIC, $5::NUMERIC, $6::NUMERIC, $7::NUMERIC, $8::NUMERIC, $9::NUMERIC, $10::NUMERIC
		FROM entities e
		WHERE e.bco_code = $1
		ON CONFLICT (entity_id, period_date) DO UPDATE 
		SET debtor_count = EXCLUDED.debtor_count, 
		    total_debt_amount = EXCLUDED.total_debt_amount,
		    debt_sit_1 = EXCLUDED.debt_sit_1,
		    debt_sit_2 = EXCLUDED.debt_sit_2,
		    debt_sit_3 = EXCLUDED.debt_sit_3,
		    debt_sit_4 = EXCLUDED.debt_sit_4,
		    debt_sit_5 = EXCLUDED.debt_sit_5,
		    debt_sit_11 = EXCLUDED.debt_sit_11
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer stmt.Close()

	// Build column index map from header row
	header := records[0]
	colIdx := map[string]int{}
	for i, h := range header {
		colIdx[h] = i
	}

	getFloat := func(record []string, col string) float64 {
		idx, ok := colIdx[col]
		if !ok || idx >= len(record) {
			return 0
		}
		v, _ := strconv.ParseFloat(record[idx], 64)
		return v
	}
	getInt := func(record []string, col string) int {
		idx, ok := colIdx[col]
		if !ok || idx >= len(record) {
			return 0
		}
		v, _ := strconv.Atoi(record[idx])
		return v
	}

	// Skip header, process data rows
	inserted := 0
	for i, record := range records {
		if i == 0 {
			continue
		}
		if len(record) < 2 {
			continue
		}

		bcoInt, _ := strconv.Atoi(record[0])
		bcoCode := fmt.Sprintf("%d", bcoInt)
		count := getInt(record, "CANTIDAD_DEUDORES")
		amount := getFloat(record, "MONTO_TOTAL")
		sit1 := getFloat(record, "MONTO_SIT_1")
		sit2 := getFloat(record, "MONTO_SIT_2")
		sit3 := getFloat(record, "MONTO_SIT_3")
		sit4 := getFloat(record, "MONTO_SIT_4")
		sit5 := getFloat(record, "MONTO_SIT_5")
		sit11 := getFloat(record, "MONTO_SIT_11")

		_, err := stmt.Exec(bcoCode, periodDate, count, amount, sit1, sit2, sit3, sit4, sit5, sit11)
		if err != nil {
			log.Printf("Error insertando entidad %s: %v", bcoCode, err)
		} else {
			inserted++
		}
	}
	fmt.Printf("Filas procesadas: %d, insertadas exitosamente: %d\n", len(records)-1, inserted)

	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}

	fmt.Println("¡Ingestión completada!")
}
