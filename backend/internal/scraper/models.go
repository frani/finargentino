package scraper

type BCRAEntity struct {
	Codigo       int     `json:"codigo"`
	Denominacion string  `json:"denominacion"`
	LatestAssets float64 `json:"latest_assets,omitempty"`
}

type MarketPeriod struct {
	Year             int     `json:"year"`
	Month            int     `json:"month"`
	TotalAssets      float64 `json:"total_assets"`
	TotalLiabilities float64 `json:"total_liabilities"`
	TotalNetWorth    float64 `json:"total_net_worth"`
	AvgSolvency      float64 `json:"avg_solvency"`
	EntityCount      int     `json:"entity_count"`
}

type MarketOverview struct {
	History []MarketPeriod `json:"history"`
}

type BCRAApiResponse struct {
	Success   bool         `json:"success"`
	Entidades []BCRAEntity `json:"entidades"`
}

type LineItem struct {
	Label       string  `json:"label"`
	Indentation int     `json:"indentation"`
	Value       float64 `json:"value"`
}

type EntityBalance struct {
	EntityCode      string     `json:"entity_code"`
	EntityName      string     `json:"entity_name"`
	Year            int        `json:"year"`
	Month           int        `json:"month"`
	Assets          float64    `json:"assets"`
	Liabilities     float64    `json:"liabilities"`
	NetWorth        float64    `json:"net_worth"`
	DebtorsCount    int        `json:"debtors_count,omitempty"`
	TotalDebtAmount float64    `json:"total_debt_amount,omitempty"`
	DebtSit1        float64    `json:"debt_sit_1,omitempty"`
	DebtSit2        float64    `json:"debt_sit_2,omitempty"`
	DebtSit3        float64    `json:"debt_sit_3,omitempty"`
	DebtSit4        float64    `json:"debt_sit_4,omitempty"`
	DebtSit5        float64    `json:"debt_sit_5,omitempty"`
	DebtSit11       float64    `json:"debt_sit_11,omitempty"`
	LineItems       []LineItem `json:"line_items"`
}
