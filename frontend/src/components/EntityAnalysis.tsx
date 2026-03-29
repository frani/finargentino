import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Sankey
} from 'recharts';
import { TrendingUp, BarChart3, Calculator } from 'lucide-react';

interface LineItem {
  label: string;
  indentation: number;
  value: number;
}

interface Balance {
  entity_code: string;
  entity_name: string;
  year: number;
  month: number;
  assets: number;
  liabilities: number;
  net_worth: number;
  line_items?: LineItem[];
}

interface EntityAnalysisProps {
  balances: Balance[];
}

export const EntityAnalysis: React.FC<EntityAnalysisProps> = ({ balances }) => {
  // Helper to find value by label (normalized matching)
  const getValue = (b: Balance, labels: string[]) => {
    const normalize = (s: string) => s.replace(/[\s\.\-]+/g, '').toUpperCase();
    const targetLabels = labels.map(normalize);

    const item = b.line_items?.find(li => {
      const normalizedItemLabel = normalize(li.label);
      // Try exact match first, then include
      if (targetLabels.some(tl => normalizedItemLabel === tl)) return true;
      return targetLabels.some(tl => normalizedItemLabel.includes(tl));
    });
    return item?.value || 0;
  };

  // Sort balances chronologically
  const sortedBalances = [...balances].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const latest = [...balances].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month))[0];

  const calculateMetrics = (b: Balance, prev?: Balance) => {
    // Basic components
    const assets = b.assets || getValue(b, ["ACTIVO", "TOTAL DEL ACTIVO"]);
    const netWorth = b.net_worth || getValue(b, ["PATRIMONIONETO", "PATRIMONIO", "TOTAL DEL PATRIMONIO"]);
    const liabilities = b.liabilities || (assets - netWorth);
    const netIncome = getValue(b, ["RESULTADODEL", "RESULTADONETO", "RDOS", "RESULTADO", "RESULTADO FINAL"]);
    
    // Asset Quality components
    const loans = getValue(b, ["PRESTAMOS", "PRESTAMOS AL SECTOR", "TOTAL DE PRESTAMOS"]);
    const nonPerforming = getValue(b, ["CARTERA IRREGULAR", "PRESTAMOS EN MORA", "EN MORA", "SITUACION 3", "SITUACION 4", "SITUACION 5"]);
    const provisions = Math.abs(getValue(b, ["PREVISIONES", "PREVISIONES POR RIESGO"]));
    const wholesaleLoans = getValue(b, ["SECTOR MAYORISTA", "PRESTAMOS AL SECTOR PUBLICO", "TITULOS PUBLICOS"]);

    // Income/Expense components
    const financialIncome = getValue(b, ["INGRESOS FINANCIEROS", "INGRESOS FINANCIEROS - POR INTERESES", "INGRESOS POR INTERESES", "INTERESES GANADOS"]);
    const financialExpenses = Math.abs(getValue(b, ["EGRESOS FINANCIEROS", "EGRESOS FINANCIEROS - POR INTERESES", "EGRESOS POR INTERESES", "INTERESES PAGADOS"]));
    const badDebtExp = Math.abs(getValue(b, ["CARGO POR INCOBRABILIDAD", "CARGO POR RIESGO"]));
    const adminExp = Math.abs(getValue(b, ["GASTOS DE ADMINISTRACION", "GASTOS ADMINISTRATIVOS"]));
    const personalExp = Math.abs(getValue(b, ["GASTOS DE PERSONAL", "GASTOS DE ESTRUCTURA"]));
    const ordinaryMargin = getValue(b, ["MARGEN ORDINARIO", "RESULTADO POR INTERMEDIACION", "RESULTADO BRUTO", "MARGEN DE INTERESES"]);

    // Efficiency/Productivity components
    const securities = getValue(b, ["TITULOS VALORES", "INVERSIONES", "TITULOS PUBLICOS"]);
    const productiveAssets = (loans || (assets * 0.7)) + securities; // Proxy if loans missing

    // Liquidity components
    const deposits = getValue(b, ["DEPOSITOS", "TOTAL DE DEPOSITOS"]);
    const previousDeposits = prev ? getValue(prev, ["DEPOSITOS", "TOTAL DE DEPOSITOS"]) : 0;
    const sightDeposits = getValue(b, ["DEPOSITOS A LA VISTA", "CUENTA CORRIENTE", "CAJA DE AHORRO"]);
    const cash = getValue(b, ["EFECTIVO", "DISPONIBILIDADES", "CAJA Y BANCOS", "CAJA"]);

    const amortizaciones = Math.abs(getValue(b, ["AMORTIZACIONES", "DEPRECIACION"]));

    // Regulatory (Might be partial/missing in common balance sheets)
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
      eficiencia: ordinaryMargin > 0 ? (adminExp / ordinaryMargin) * 100 : 0,
      gastosPersAct: assets > 0 ? (personalExp / assets) * 100 : 0,
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
      // Extra details for Sankey
      finInc: getValue(b, ["INGRESOS FINANCIEROS", "INTERESES GANADOS", "INGRESOS FINANCIEROS - POR INTERESES", "INGRESOS POR INTERESES"]),
      srvInc: getValue(b, ["INGRESOS POR SERVICIOS", "COMISIONES GANADAS"]),
      othInc: getValue(b, ["OTROS INGRESOS OPERATIVOS", "OTROS INGRESOS"]),
      finExp: Math.abs(getValue(b, ["EGRESOS FINANCIEROS", "INTERESES PAGADOS", "EGRESOS FINANCIEROS - POR INTERESES", "EGRESOS POR INTERESES"])),
      srvExp: Math.abs(getValue(b, ["EGRESOS POR SERVICIOS", "COMISIONES PAGADAS"])),
      admExp: Math.abs(getValue(b, ["GASTOS DE ADMINISTRACION", "GASTOS ADMINISTRATIVOS"])),
      perExp: Math.abs(getValue(b, ["GASTOS DE PERSONAL", "GASTOS DE ESTRUCTURA"])),
      provExp: Math.abs(getValue(b, ["CARGO POR INCOBRABILIDAD", "CARGO POR RIESGO", "PREVISIONES"])),
      taxExp: Math.abs(getValue(b, ["IMPUESTO A LAS GANANCIAS", "IMPUESTOS"])),
      othExp: Math.abs(getValue(b, ["OTROS EGRESOS OPERATIVOS", "OTROS EGRESOS"])),
      amortExp: Math.abs(getValue(b, ["AMORTIZACIONES", "DEPRECIACION"])),
      netInc: getValue(b, ["RESULTADODEL", "RESULTADONETO", "RESULTADO FINAL", "RESULTADO NETO", "RESULTADO DEL EJERCICIO"])
    };
  };

  const processedData = sortedBalances.map((b, i) => calculateMetrics(b, i > 0 ? sortedBalances[i-1] : undefined));
  const current = processedData[processedData.length - 1];

  const formatCurrency = (val: number) => {
    if (val === 0 || val === undefined) return "-";
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(val);
  };

  const formatDateLabel = (year: number, month: number) => {
    if (!year || !month) return "N/A";
    try {
      return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' })
        .format(new Date(year, month - 1))
        .replace(/^\w/, c => c.toUpperCase());
    } catch (e) {
      return `${month}/${year}`;
    }
  };

  const cleanLabel = (label: string) => {
    let clean = label;
    if (label.includes(" - ")) {
      const parts = label.split(" - ");
      clean = parts[parts.length - 1].trim();
    }

    const fixSpaced = (s: string) => {
      // Try splitting by double spaces first (multiple spaced words)
      if (s.includes("  ")) {
        return s.split(/\s{2,}/).map(word => {
          const wSpaces = (word.match(/ /g) || []).length;
          if (wSpaces > 0 && wSpaces >= (word.length - wSpaces - 1)) {
            return word.replace(/\s+/g, '');
          }
          return word;
        }).join(" ");
      }

      const spaces = (s.match(/ /g) || []).length;
      if (spaces > 0 && spaces >= (s.length - spaces - 1)) {
        return s.replace(/\s+/g, '');
      }
      return s;
    };

    let result = fixSpaced(clean);

    // Specific corrections for known mangled financial labels
    const check = result.replace(/[\.\s\-]/g, '').toUpperCase();
    
    if (check.includes("RDOSINTEGRALESACUM") && check.includes("PERIODO")) {
      return "RDOS. INTEGRALES ACUM. DEL PERIODO";
    }
    
    if (check === "PATRIMONIONETO" || check === "PATIMONIONETO") {
      return "PATRIMONIO NETO";
    }

    const corrections: Record<string, string> = {
      "RESULTADONETO": "RESULTADO NETO",
      "TOTALDELACTIVO": "TOTAL DEL ACTIVO",
      "TOTALDELPASIVO": "TOTAL DEL PASIVO",
      "MARGENORDINARIO": "MARGEN ORDINARIO",
    };

    return corrections[result] || result;
  };

  const allRows: { originalLabel: string; displayLabel: string; indentation: number }[] = [];
  const rowMap = new Map<string, any>();

  const referenceBalance = balances.reduce((prev, current) => 
    (prev.line_items?.length || 0) > (current.line_items?.length || 0) ? prev : current
  , balances[0]);

  const isIrrelevant = (label: string) => {
    const norm = label.replace(/[\s\.\-]+/g, '').toUpperCase();
    return norm.includes("FAVORABLE") || 
           norm.includes("SALVEDAD") || 
           norm.includes("CIERREDEEJERCICIO") ||
           norm.includes("ABSTENCION") || 
           norm.includes("ADVERSA") || 
           norm.includes("ENFASIS");
  };

  referenceBalance.line_items?.filter(item => !isIrrelevant(item.label)).forEach(item => {
    if (!rowMap.has(item.label)) {
      const displayLabel = cleanLabel(item.label);
      const row = { originalLabel: item.label, displayLabel, indentation: item.indentation };
      rowMap.set(item.label, row);
      allRows.push(row);
    }
  });

  const RatioBox: React.FC<{ title: string; children: React.ReactNode; color: string; headerColor: string }> = ({ title, children, color, headerColor }) => (
    <div className={`window ${color} flex flex-col`}>
      <div className={`title-bar ${headerColor} !text-black !font-bold flex items-center gap-2 border-b-2 border-black`}>
        <Calculator className="w-3 h-3" />
        <span className="text-[11px] uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-3 grid grid-cols-1 gap-2 bg-white/40 flex-1">
        {children}
      </div>
    </div>
  );

  const RatioItem: React.FC<{ label: string; value: string; desc?: string }> = ({ label, value, desc }) => (
    <div className="flex justify-between items-center bg-white/80 p-1.5 border border-black/10 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase opacity-70 leading-none">{label}</span>
        {desc && <span className="text-[8px] italic opacity-50 leading-none mt-0.5">{desc}</span>}
      </div>
      <span className="text-sm font-black font-mono">{value}</span>
    </div>
  );

  const getSankeyData = () => {
    if (!latest) return null;
    const d = calculateMetrics(latest);

    const nodes: { name: string }[] = [];
    const links: { source: number, target: number, value: number, color: string }[] = [];

    const getNode = (name: string) => {
      let idx = nodes.findIndex(n => n.name === name);
      if (idx === -1) {
        nodes.push({ name });
        idx = nodes.length - 1;
      }
      return idx;
    };

    const totalIncomes = (d.finInc || 0) + (d.srvInc || 0) + (d.othInc || 0);
    const opCostsSum = (d.admExp || 0) + (d.perExp || 0) + (d.othExp || 0) + (d.amortExp || 0);
    const expenses = (d.finExp || 0) + (d.srvExp || 0) + opCostsSum + (d.provExp || 0) + (d.taxExp || 0);
    
    // Fallback: Infer net income if it's strictly 0
    let actualNetInc = d.netInc;
    if (!actualNetInc || actualNetInc === 0) {
      actualNetInc = totalIncomes - expenses;
    }

    let ajustes = actualNetInc - (totalIncomes - expenses);

    let computedIncomes = totalIncomes + (ajustes > 0 ? ajustes : 0);
    let directCosts = (d.finExp || 0) + (d.srvExp || 0);
    let opCosts = opCostsSum + (d.provExp || 0) + (d.taxExp || 0) + (ajustes < 0 ? Math.abs(ajustes) : 0);

    // 1. SOURCES -> 'Ingresos'
    if (d.finInc > 0) links.push({ source: getNode("Ingresos Fin."), target: getNode("Ingresos"), value: d.finInc, color: "#fcd34d" });
    if (d.srvInc > 0) links.push({ source: getNode("Ing. Servicios"), target: getNode("Ingresos"), value: d.srvInc, color: "#60a5fa" });
    if (d.othInc > 0) links.push({ source: getNode("Otros Ingresos"), target: getNode("Ingresos"), value: d.othInc, color: "#c084fc" });
    if (ajustes > 0) links.push({ source: getNode("Ajustes Positivos"), target: getNode("Ingresos"), value: ajustes, color: "#a7f3d0" });

    // 2. MIDDLE SPLIT -> 'Ingresos' splits into 'Costo de Ingresos' and 'Margen Bruto'
    let grossMargin = computedIncomes - directCosts;

    if (grossMargin >= 0) {
      if (directCosts > 0) {
        links.push({ source: getNode("Ingresos"), target: getNode("Costo de Ingresos"), value: directCosts, color: "#fca5a5" });
        // Force the Cost node to stop at the middle column (Depth 2) by flowing it to an invisible spacer
        links.push({ source: getNode("Costo de Ingresos"), target: getNode("_spacer_costo"), value: directCosts, color: "transparent" });
      }
      if (grossMargin > 0) links.push({ source: getNode("Ingresos"), target: getNode("Margen Bruto"), value: grossMargin, color: "#4ade80" });

      // 3. FINAL SPLIT -> 'Margen Bruto' splits into Operative Costs and 'Ganancia Neta'
      if (grossMargin >= opCosts) {
         let netProfit = grossMargin - opCosts;
         if (netProfit > 0) {
           links.push({ source: getNode("Margen Bruto"), target: getNode("Ganancia Neta"), value: netProfit, color: "#16a34a" });
         } else {
           links.push({ source: getNode("Margen Bruto"), target: getNode("Ganancia Neta (Cero)"), value: Math.max(10, computedIncomes * 0.001), color: "#9ca3af" });
         }

         if (opCostsSum > 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Gastos Operativos"), value: opCostsSum, color: "#f87171" });
         if (d.provExp > 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Previsiones"), value: d.provExp, color: "#fca5a5" });
         if (d.taxExp > 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Impuestos"), value: d.taxExp, color: "#9ca3af" });
         if (ajustes < 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Ajustes Negativos"), value: Math.abs(ajustes), color: "#6b7280" });
      } else {
         // Loss at Operating level
         let loss = opCosts - grossMargin;
         links.push({ source: getNode("Pérdida Neta"), target: getNode("Margen Bruto"), value: loss, color: "#dc2626" });
         
         if (opCostsSum > 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Gastos Operativos"), value: opCostsSum, color: "#f87171" });
         if (d.provExp > 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Previsiones"), value: d.provExp, color: "#fca5a5" });
         if (d.taxExp > 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Impuestos"), value: d.taxExp, color: "#9ca3af" });
         if (ajustes < 0) links.push({ source: getNode("Margen Bruto"), target: getNode("Ajustes Negativos"), value: Math.abs(ajustes), color: "#6b7280" });
      }
    } else {
      // Very rare negative Gross Margin
      let grossLoss = Math.abs(grossMargin);
      links.push({ source: getNode("Pérdida Bruta"), target: getNode("Ingresos"), value: grossLoss, color: "#dc2626" });
      links.push({ source: getNode("Ingresos"), target: getNode("Costo de Ingresos"), value: directCosts, color: "#fca5a5" });
      links.push({ source: getNode("Costo de Ingresos"), target: getNode("_spacer_costo"), value: directCosts, color: "transparent" });

      if (opCosts > 0) {
         if (opCostsSum > 0) links.push({ source: getNode("Pérdida Operativa"), target: getNode("Gastos Operativos"), value: opCostsSum, color: "#f87171" });
         if (d.provExp > 0) links.push({ source: getNode("Pérdida Operativa"), target: getNode("Previsiones"), value: d.provExp, color: "#fca5a5" });
         if (d.taxExp > 0) links.push({ source: getNode("Pérdida Operativa"), target: getNode("Impuestos"), value: d.taxExp, color: "#9ca3af" });
         if (ajustes < 0) links.push({ source: getNode("Pérdida Operativa"), target: getNode("Ajustes Negativos"), value: Math.abs(ajustes), color: "#6b7280" });
      }
    }

    return { nodes, links };
  };

  const sankeyData = getSankeyData();

  if (!latest) return <div className="p-4 italic text-center text-retro-blue">No hay datos disponibles.</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Sankey Waterfall / Cashflow */}
      <div className="window bg-white shadow-button">
        <div className="title-bar !bg-retro-green !text-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Flujo de Resultados (Sankey) - {formatDateLabel(latest.year, latest.month)}</span>
          </div>
          <span className="text-[10px] font-mono opacity-60">VALORES EN PESOS</span>
        </div>
        <div className="p-12 h-[600px] bg-white">
          {sankeyData && sankeyData.links.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                nodeWidth={25}
                nodePadding={60}
                margin={{ top: 40, right: 180, bottom: 40, left: 10 }}
                link={(props: any) => {
                  const { sourceX, targetX, sourceY, targetY, linkWidth, payload } = props;
                  const linkColor = payload.color || "#cccccc";
                  // Control points for a smooth cubic bezier curve
                  const cX = sourceX + (targetX - sourceX) / 2;
                  
                  return (
                    <path
                      d={`
                        M${sourceX},${sourceY}
                        C${cX},${sourceY}
                         ${cX},${targetY}
                         ${targetX},${targetY}
                      `}
                      stroke={linkColor}
                      strokeWidth={Math.max(2, linkWidth || 1)}
                      strokeOpacity={0.5}
                      fill="none"
                    />
                  );
                }}
                node={(props: any) => {
                  const { x, y, width, height, payload, containerWidth } = props;
                  
                  if (payload.name.startsWith("_spacer")) return <g />;
                  
                  const isOut = x + width + 10 > containerWidth - 180;
                  
                  let nodeColor = "#9ca3af"; // default grey
                  if (payload.name === "Ingresos") nodeColor = "#3b82f6"; // Blue
                  else if (payload.name === "Margen Bruto") nodeColor = "#4ade80"; // Light green
                  else if (payload.name === "Ganancia Neta") nodeColor = "#16a34a"; // Dark green
                  else if (payload.name.includes("Pérdida") || payload.name.includes("Costo") || payload.name.includes("Gasto") || payload.name.includes("Prev") || payload.name.includes("Impuest") || payload.name.includes("Ajustes Neg")) nodeColor = "#ef4444"; // Red for all expenses/losses
                  else if (payload.name.includes("Ing") && !payload.name.includes("Costo")) nodeColor = "#facc15"; // Yellow for sources
                  
                  return (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={nodeColor}
                        stroke="#000"
                        strokeWidth={1}
                      />
                      <text
                        x={isOut ? x - 12 : x + width + 12}
                        y={y + height / 2 - 6}
                        textAnchor={isOut ? 'end' : 'start'}
                        fill="black"
                        fontSize={11}
                        fontWeight="bold"
                        fontFamily="monospace"
                        dominantBaseline="middle"
                      >
                        {payload.name}
                      </text>
                      <text
                        x={isOut ? x - 12 : x + width + 12}
                        y={y + height / 2 + 8}
                        textAnchor={isOut ? 'end' : 'start'}
                        fill="#333"
                        fontSize={10}
                        fontWeight="bold"
                        fontFamily="monospace"
                        dominantBaseline="middle"
                      >
                        $ {(payload.value / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M
                      </text>
                    </g>
                  );
                }}
              >
                <Tooltip 
                  formatter={(val: number) => [formatCurrency(val), ""]}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #000', fontSize: '10px', fontFamily: 'monospace' }}
                />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-retro-blue italic">
              No hay suficientes datos para generar el flujo de caja.
            </div>
          )}
        </div>
      </div>


      {/* 6 Grid of Ratios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Solvencia y Capital */}
        <RatioBox title="Solvencia y Capital" color="bg-pastel-blue" headerColor="!bg-pastel-blue-dark">
          <RatioItem label="Capital Tier 1" value={current.tier1Ratio !== 0 ? `${current.tier1Ratio.toFixed(2)}%` : "N/D"} desc="Basic / RWA" />
          <RatioItem label="Apalancamiento" value={`${current.leverage.toFixed(2)}x`} desc="Activo / PN" />
          <RatioItem label="Ratio de Solvencia" value={`${current.solvencia.toFixed(2)}%`} desc="PN / Activo" />
        </RatioBox>

        {/* 2. Calidad de Activos */}
        <RatioBox title="Calidad de Activos" color="bg-pastel-pink" headerColor="!bg-pastel-pink-dark">
          <RatioItem label="Morosidad (NPL)" value={`${current.morosidad.toFixed(2)}%`} desc="Mora / Cartera" />
          <RatioItem label="Cobertura" value={current.cobertura !== 0 ? `${current.cobertura.toFixed(1)}%` : "N/D"} desc="Prev / Mora" />
          <RatioItem label="Carga Incob." value={`${current.cargaIncob.toFixed(2)}%`} desc="Cargo / Ing. Fin" />
          <RatioItem label="Concentración" value={`${current.concentracion.toFixed(1)}%`} desc="Mayorista / Total" />
        </RatioBox>

        {/* 3. Gestión y Eficiencia */}
        <RatioBox title="Gestión y Eficiencia" color="bg-pastel-yellow" headerColor="!bg-pastel-yellow-dark">
          <RatioItem label="Eficiencia" value={`${current.eficiencia.toFixed(1)}%`} desc="Cost-to-Income" />
          <RatioItem label="Gastos Personal/Act" value={`${current.gastosPersAct.toFixed(2)}%`} desc="Carga Humana" />
          <RatioItem label="Activos Prod/Act" value={`${current.activosProdAct.toFixed(1)}%`} desc="Generan Interés" />
        </RatioBox>

        {/* 4. Rentabilidad */}
        <RatioBox title="Rentabilidad" color="bg-pastel-green" headerColor="!bg-pastel-green-dark">
          <RatioItem label="NIM" value={`${current.nim.toFixed(2)}%`} desc="Margen Neto" />
          <RatioItem label="ROE" value={`${current.roe.toFixed(2)}%`} desc="Neto / PN" />
          <RatioItem label="ROA" value={`${current.roa.toFixed(2)}%`} desc="Neto / Activo" />
        </RatioBox>

        {/* 5. Liquidez */}
        <RatioBox title="Liquidez" color="bg-pastel-purple" headerColor="!bg-pastel-purple-dark">
          <RatioItem label="LTD (Loans/Deps)" value={`${current.ltd.toFixed(1)}%`} desc="Prést / Depo" />
          <RatioItem label="Liq. Inmediata" value={`${current.liqInmediata.toFixed(1)}%`} desc="Disp / Vista" />
        </RatioBox>

        {/* 6. Cash Flow / Otros */}
        <RatioBox title="Cash Flow & otros" color="bg-retro-bg" headerColor="!bg-gray-400">
          <RatioItem label="Cobertura Interés" value={`${current.interestCoverage.toFixed(1)}x`} desc="EBIT / Gastos Fin" />
          <RatioItem label="Autofinanciación" value={`${current.autoFinanciacion.toFixed(2)}%`} desc="Neto / Activo" />
          <RatioItem label="Retención Dep." value={current.retencionDep !== 0 ? `${current.retencionDep.toFixed(1)}%` : "N/D"} desc="Estabilidad flujo" />
        </RatioBox>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="window bg-white h-[350px]">
          <div className="title-bar !bg-retro-blue flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Patrimonio y Pasivos</span>
          </div>
          <div className="p-4 h-full pb-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodo" />
                <YAxis tickFormatter={(val) => `${(val / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 0 })} M`} />
                <Tooltip formatter={(val: number, name: string) => [`${(val / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 0 })} M`, name]} />
                <Legend />
                <Area type="monotone" dataKey="assets" stroke="#000080" fill="#000080" fillOpacity={0.1} name="Activo" />
                <Area type="monotone" dataKey="liabilities" stroke="#ff0000" fill="#ff0000" fillOpacity={0.05} name="Pasivo" />
                <Area type="monotone" dataKey="netWorth" stroke="#008000" fill="#008000" fillOpacity={0.05} name="P. Neto" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="window bg-white h-[350px]">
          <div className="title-bar !bg-pastel-pink !text-black flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Rentabilidad (%)</span>
          </div>
          <div className="p-4 h-full pb-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodo" />
                <YAxis unit="%" />
                <Tooltip formatter={(val: number, name: string) => [`${val.toFixed(2)}%`, name]} />
                <Legend />
                <Line type="monotone" dataKey="roa" stroke="#10b981" strokeWidth={2} name="ROA (%)" />
                <Line type="monotone" dataKey="roe" stroke="#ec4899" strokeWidth={2} name="ROE (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="window bg-white shadow-button">
        <div className="title-bar !bg-black flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          <span>Estado de Situación Patrimonial y de Resultados (Detallado)</span>
        </div>
        <div className="p-0 overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-retro">
          <table className="w-full border-collapse text-[11px] font-mono leading-tight">
            <thead className="sticky top-0 bg-gray-200 z-10 shadow-sm">
              <tr className="border-b-2 border-black">
                <th className="p-2 border-r border-black text-left w-[45%] bg-gray-300">Rubro / Cuenta</th>
                {sortedBalances.map(b => (
                  <th key={`${b.month}-${b.year}`} className="p-2 border-r border-black text-right whitespace-nowrap min-w-[100px]">
                    {formatDateLabel(b.year, b.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={`border-b border-gray-200 hover:bg-yellow-50 ${row.indentation <= 1 ? 'font-bold bg-gray-50' : ''}`}>
                  <td className="p-1 border-r border-gray-300 truncate whitespace-pre" style={{ paddingLeft: `${row.indentation * 12 + 4}px` }}>
                    {row.displayLabel}
                  </td>
                  {sortedBalances.map(b => {
                    const item = b.line_items?.find(li => li.label === row.originalLabel);
                    return (
                      <td key={`${b.month}-${b.year}`} className={`p-1 border-r border-gray-200 text-right ${item && item.value < 0 ? 'text-red-600' : ''}`}>
                        {item ? formatCurrency(item.value) : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
