export interface LineItem {
  label: string;
  indentation: number;
  value: number;
}

export interface Balance {
  entity_code: string;
  entity_name: string;
  year: number;
  month: number;
  assets: number;
  liabilities: number;
  net_worth: number;
  line_items?: LineItem[];
}

export const getValue = (b: Balance, labels: string[]) => {
  const normalize = (s: string) => 
    s.normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "") // Remove accents
     .replace(/[\s\.\-]+/g, '')
     .toUpperCase();

  const targetLabels = labels.map(normalize);

  // 1. Try exact matches first across all items for all targets
  const exactItem = b.line_items?.find(li => {
    const normalizedItemLabel = normalize(li.label);
    return targetLabels.some(tl => normalizedItemLabel === tl);
  });
  if (exactItem) return exactItem.value;

  // 2. Fallback to include/contains matches
  const partialItem = b.line_items?.find(li => {
    const normalizedItemLabel = normalize(li.label);
    return targetLabels.some(tl => normalizedItemLabel.includes(tl));
  });
  return partialItem?.value || 0;
};

export const calculateMetrics = (b: Balance, prev?: Balance) => {
  // Basic components
  const assets = b.assets || getValue(b, ["ACTIVO", "TOTAL DEL ACTIVO"]);
  const netWorth = b.net_worth || getValue(b, ["PATRIMONIONETO", "PATRIMONIO", "TOTAL DEL PATRIMONIO"]);
  const liabilities = b.liabilities || (assets - netWorth);
  const netIncome = getValue(b, ["RDOS. INTEGRALES ACUM. DEL PERIODO", "RESULTADO DEL EJERCICIO", "RESULTADO NETO", "RESULTADO DEL", "RESULTADO FINAL", "RDOS", "RESULTADO"]);
  
  // Asset Quality components
  const loans = getValue(b, ["PRESTAMOS", "PRESTAMOS AL SECTOR", "TOTAL DE PRESTAMOS"]);
  const nonPerforming = getValue(b, ["CARTERA IRREGULAR", "PRESTAMOS EN MORA", "EN MORA", "SITUACION 3", "SITUACION 4", "SITUACION 5"]);
  const provisions = Math.abs(getValue(b, ["PREVISIONES", "PREVISIONES POR RIESGO"]));
  const wholesaleLoans = getValue(b, ["SECTOR MAYORISTA", "PRESTAMOS AL SECTOR PUBLICO", "TITULOS PUBLICOS"]);

  // Income/Expense components
  const financialIncome = getValue(b, ["INGRESOS FINANCIEROS", "INGRESOS FINANCIEROS - POR INTERESES", "INGRESOS POR INTERESES", "INTERESES GANADOS"]);
  const financialExpenses = Math.abs(getValue(b, ["EGRESOS FINANCIEROS", "EGRESOS FINANCIEROS - POR INTERESES", "EGRESOS POR INTERESES", "INTERESES PAGADOS"]));
  const serviceIncome = getValue(b, ["INGRESOS POR SERVICIOS", "COMISIONES GANADAS"]);
  const serviceExpenses = Math.abs(getValue(b, ["EGRESOS POR SERVICIOS", "COMISIONES PAGADAS"]));
  
  const badDebtExp = Math.abs(getValue(b, ["CARGO POR INCOBRABILIDAD", "CARGO POR RIESGO"]));
  const adminExp = Math.abs(getValue(b, ["GASTOS DE ADMINISTRACION", "GASTOS ADMINISTRATIVOS", "ADMINISTRACION"]));
  const personalExp = Math.abs(getValue(b, ["GASTOS DE PERSONAL", "GASTOS DE ESTRUCTURA", "PERSONAL"]));
  
  // Efficiency calculation components
  const totalOperatingExpenses = adminExp + personalExp;
  // Calc ordinary margin if not explicitly found
  let ordinaryMargin = getValue(b, ["MARGEN ORDINARIO", "RESULTADO POR INTERMEDIACION", "RESULTADO BRUTO", "MARGEN DE INTERESES"]);
  if (ordinaryMargin === 0) {
    ordinaryMargin = (financialIncome - financialExpenses) + (serviceIncome - serviceExpenses);
  }

  // Asset Productivity
  const securities = getValue(b, ["TITULOS VALORES", "INVERSIONES", "TITULOS PUBLICOS"]);
  const productiveAssets = (loans || (assets * 0.7)) + securities;

  // Liquidity components
  const deposits = getValue(b, ["DEPOSITOS", "TOTAL DE DEPOSITOS"]);
  const previousDeposits = prev ? getValue(prev, ["DEPOSITOS", "TOTAL DE DEPOSITOS"]) : 0;
  const sightDeposits = getValue(b, ["DEPOSITOS A LA VISTA", "CUENTA CORRIENTE", "CAJA DE AHORRO"]);
  const cash = getValue(b, ["EFECTIVO", "DISPONIBILIDADES", "CAJA Y BANCOS", "CAJA"]);

  const amortizaciones = Math.abs(getValue(b, ["AMORTIZACIONES", "DEPRECIACION"]));

  // Regulatory
  const tier1Capital = getValue(b, ["CAPITAL BASICO", "RPC", "CAPITAL NIVEL 1", "RESPONSABILIDAD PATRIMONIAL"]);
  const rwa = getValue(b, ["ACTIVOS PONDERADOS POR RIESGO", "APR", "COMPLEMENTARIO"]) || (assets * 0.8);

  return {
    // 1. Solvencia y Capital
    tier1Ratio: rwa > 0 ? (tier1Capital / rwa) * 100 : 0,
    leverage: netWorth > 0 ? (assets / netWorth) : 0,
    solvencia: assets > 0 ? (netWorth / assets) * 100 : 0,

    // 2. Calidad de Activos
    morosidad: loans > 0 ? (nonPerforming / loans) * 100 : 0,
    cobertura: nonPerforming > 0 ? (provisions / nonPerforming) * 100 : 0,
    cargaIncob: (financialIncome > 0) ? (badDebtExp / financialIncome) * 100 : 0,
    concentracion: loans > 0 ? (wholesaleLoans / loans) * 100 : (wholesaleLoans / assets) * 100,

    // 3. Gestión y Eficiencia
    eficiencia: ordinaryMargin > 0 ? (totalOperatingExpenses / ordinaryMargin) * 100 : 0,
    gastosPersAct: assets > 0 ? ((personalExp || adminExp) / assets) * 100 : 0,
    activosProdAct: assets > 0 ? (productiveAssets / assets) * 100 : 0,

    // 4. Rentabilidad
    nim: productiveAssets > 0 ? ((financialIncome - financialExpenses) / productiveAssets) * 100 : 0,
    roe: netWorth > 0 ? (netIncome / netWorth) * 100 : 0,
    roa: assets > 0 ? (netIncome / assets) * 100 : 0,

    // 5. Liquidez
    ltd: deposits > 0 ? (loans / deposits) * 100 : 0,
    liqInmediata: sightDeposits > 0 ? (cash / sightDeposits) * 100 : (cash / (deposits * 0.4 || 1)) * 100,

    // 6. Cash Flow / Otros
    interestCoverage: financialExpenses > 0 ? ((netIncome + financialExpenses) / financialExpenses) : 0,
    autoFinanciacion: assets > 0 ? ((netIncome + amortizaciones) / assets) * 100 : 0,
    retencionDep: previousDeposits > 0 ? (deposits / previousDeposits) * 100 : 0,
    
    // Raw values for charts
    assets,
    netWorth,
    liabilities,
    periodo: `${b.month}/${b.year}`,
    entity_name: b.entity_name,
    entity_code: b.entity_code,
    // Extra details for Sankey
    finInc: financialIncome,
    srvInc: serviceIncome,
    othInc: getValue(b, ["OTROS INGRESOS OPERATIVOS", "OTROS INGRESOS"]),
    finExp: financialExpenses,
    srvExp: serviceExpenses,
    admExp: adminExp,
    perExp: personalExp,
    provExp: badDebtExp,
    taxExp: Math.abs(getValue(b, ["IMPUESTO A LAS GANANCIAS", "IMPUESTOS"])),
    othExp: Math.abs(getValue(b, ["OTROS EGRESOS OPERATIVOS", "OTROS EGRESOS"])),
    amortExp: amortizaciones,
    netInc: netIncome
  };
};

export const AVAILABLE_COLUMNS = [
  { id: 'assets', label: 'Activo Total', category: 'Raw' },
  { id: 'netWorth', label: 'Patrimonio Neto', category: 'Raw' },
  { id: 'netInc', label: 'Resultado Neto', category: 'Raw' },
  { id: 'solvencia', label: 'Solvencia (%)', category: 'Solvencia' },
  { id: 'leverage', label: 'Apalancamiento (x)', category: 'Solvencia' },
  { id: 'tier1Ratio', label: 'Capital Tier 1 (%)', category: 'Solvencia' },
  { id: 'morosidad', label: 'Morosidad (%)', category: 'Calidad' },
  { id: 'cobertura', label: 'Cobertura (%)', category: 'Calidad' },
  { id: 'eficiencia', label: 'Eficiencia (%)', category: 'Gestión' },
  { id: 'gastosPersAct', label: 'Gastos Administrativos / Activo (%)', category: 'Gestión' },
  { id: 'roa', label: 'ROA (%)', category: 'Rentabilidad' },
  { id: 'roe', label: 'ROE (%)', category: 'Rentabilidad' },
  { id: 'nim', label: 'NIM (%)', category: 'Rentabilidad' },
  { id: 'ltd', label: 'LTD (%)', category: 'Liquidez' },
  { id: 'liqInmediata', label: 'Liq. Inmediata (%)', category: 'Liquidez' },
];
