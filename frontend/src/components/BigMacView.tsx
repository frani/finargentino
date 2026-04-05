import React, { useEffect, useState, useMemo } from 'react';
import { useMCP } from '../hooks/useMCP';
import { RetroButton } from './RetroUI';
import { 
  RefreshCw, TrendingUp, TrendingDown, Minus, 
  ChevronDown, Check, Globe, AlertCircle, 
  ArrowRight, ArrowLeft, Info, Activity
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  ReferenceLine, AreaChart, Area 
} from 'recharts';

export interface BigMacPrice {
  date: string;
  iso_a3: string;
  name: string;
  local_price: number;
  dollar_ex: number;
  dollar_price: number;
  usd_raw: number;
}

export function BigMacView() {
  const { call } = useMCP();
  const [data, setData] = useState<BigMacPrice[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(() => {
    const saved = localStorage.getItem('bigmacSelectedCountries');
    return saved ? JSON.parse(saved) : ['ARG', 'USA', 'BRA'];
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('bigmacSelectedCountries', JSON.stringify(selectedCountries));
  }, [selectedCountries]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await call('tools/call', { name: 'get_big_mac', arguments: { iso_a3: "" } });
      if (response && response.content && response.content[0].text) {
        const parsed = JSON.parse(response.content[0].text);
        setData(parsed);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await call('tools/call', { name: 'sync_big_mac' });
      alert("Sincronización del Índice Big Mac iniciada en segundo plano.");
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const countries = useMemo(() => {
    return Array.from(new Set(data.map(d => d.iso_a3)))
      .map(iso_a3 => {
        const item = data.find(d => d.iso_a3 === iso_a3);
        return { iso_a3, name: item?.name || iso_a3 };
      })
      .sort((a, b) => {
        if (a.iso_a3 === 'ARG') return -1;
        if (b.iso_a3 === 'ARG') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [data]);

  // ARG specifics
  const argHistory = useMemo(() => 
    data.filter(d => d.iso_a3 === 'ARG').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  , [data]);

  const latestArg = argHistory[argHistory.length - 1];
  
  const latestUS = useMemo(() => {
    const usData = data.filter(d => d.iso_a3 === 'USA').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return usData.length > 0 ? usData[usData.length - 1] : null;
  }, [data]);

  const valuationStats = useMemo(() => {
    if (!latestArg) return null;

    const p_ars = latestArg.local_price;
    const tc_actual = latestArg.dollar_ex;
    const p_usd_now = latestUS?.dollar_price || 5.79; // Fair Parity

    // Purchasing Power Parity exchange rate
    const tc_ppp = p_ars / p_usd_now;
    
    // Gap / Overvaluation (Brecha %)
    // Positive = Subvaluado (Barato), Negative = Sobrevaluado (Caro)
    const brecha = ((tc_actual / tc_ppp) - 1) * 100;

    // Historical levels (in $ USD adjusted)
    const targets = {
      muy_barato_2005: 2.62,
      equilibrio_2000: 4.55,
      paridad_us: p_usd_now
    };

    const tc_targets = {
      "2005 (Baratísimo)": p_ars / targets.muy_barato_2005,
      "2000 (Equilibrio)": p_ars / targets.equilibrio_2000,
      "Paridad US (Justo)": p_ars / targets.paridad_us
    };

    return {
      p_ars,
      tc_actual,
      p_usd_now,
      tc_ppp,
      brecha,
      tc_targets,
      isCheap: brecha > 0,
      isVeryCheap: latestArg.dollar_price < 2.62,
      isExpensive: latestArg.dollar_price > p_usd_now
    };
  }, [latestArg, latestUS]);

  const chartData = useMemo(() => {
    return Array.from(new Set(data.map(d => d.date)))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map(date => {
        const entry: any = { date };
        selectedCountries.forEach(iso => {
          const d = data.find(item => item.date === date && item.iso_a3 === iso);
          if (d) {
            entry[`val_${iso}`] = d.usd_raw;
            entry[`price_${iso}`] = d.dollar_price;
            entry[`name_${iso}`] = d.name;
          }
        });
        return entry;
      });
  }, [data, selectedCountries]);

  const toggleCountry = (iso: string) => {
    setSelectedCountries(prev => 
      prev.includes(iso) 
        ? (prev.length > 1 ? prev.filter(c => c !== iso) : prev)
        : [...prev, iso]
    );
  };

  return (
    <div className="p-4 flex flex-col gap-6 font-sans h-full overflow-auto ">
      {/* Header Bar */}
      <div className="flex flex-wrap justify-between items-center bg-retro-bg p-3 border-2 border-black shadow-button shrink-0 gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <RetroButton 
              className="flex items-center gap-2 text-xs py-1 px-3 min-w-[200px] justify-between"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-3 h-3" />
                <span>Comparar Países ({selectedCountries.length})</span>
              </div>
              <ChevronDown className={`w-3 h-3 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
            </RetroButton>

            {isPickerOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-retro-bg border-4 border-black shadow-retro z-50 p-2 max-h-[400px] overflow-y-auto">
                <div className="text-[10px] font-bold uppercase mb-2 border-b-2 border-black pb-1 flex justify-between items-center">
                  <span>Seleccionar Países</span>
                  <span className="text-retro-blue">INDEX</span>
                </div>
                <div className="flex flex-col gap-1">
                  {countries.map(c => (
                    <label key={c.iso_a3} className="flex items-center justify-between hover:bg-white/60 p-1 cursor-pointer group active:bg-white/80">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={selectedCountries.includes(c.iso_a3)}
                          onChange={() => toggleCountry(c.iso_a3)}
                          className="w-3 h-3 border-2 border-black accent-retro-blue"
                        />
                        <span className={`text-[10px] font-bold ${c.iso_a3 === 'ARG' ? 'text-blue-700' : ''}`}>
                          {c.name} {c.iso_a3 === 'ARG' && '🇦🇷'}
                        </span>
                      </div>
                      {selectedCountries.includes(c.iso_a3) && <Check className="w-3 h-3 text-retro-blue" />}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-black/5 border border-black/10 rounded">
            <Activity className="w-3 h-3 text-retro-blue" />
            <p className="text-[10px] font-bold uppercase tracking-tight">Inflación en Dólares: <span className={valuationStats?.isExpensive ? 'text-red-600' : 'text-green-600'}>{valuationStats?.isExpensive ? 'ACTIVA' : 'REDUCIDA'}</span></p>
          </div>
        </div>
        <div className="flex gap-2">
          <RetroButton onClick={fetchData} disabled={loading || syncing} className="px-2 py-1 flex items-center gap-1 group">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
            <span className="text-[10px] font-bold uppercase">Refrescar</span>
          </RetroButton>
          <RetroButton onClick={handleSync} disabled={syncing} className="px-2 py-1 font-bold text-[10px] uppercase bg-pastel-yellow">
            Sincronizar Tool
          </RetroButton>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center gap-4 font-black italic">
          <div className="w-16 h-16 border-8 border-retro-blue border-t-white animate-spin rounded-full shadow-button"></div>
          <p className="text-retro-blue text-xl animate-pulse uppercase tracking-[0.2em]">Calculando Paridad...</p>
        </div>
      ) : (
        <>
          {/* Main Valuation Analysis */}
          {valuationStats && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Primary Gauge */}
              <div className="lg:col-span-2 bg-gradient-to-br from-white to-retro-bg-tint border-4 border-black p-6 shadow-window flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 italic text-[10px] font-bold pointer-events-none">
                  purchasing power parity model v2.1
                </div>
                
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-black uppercase italic text-retro-blue tracking-tighter">Valuación del Peso (ARS)</h2>
                    <p className="text-xs font-bold opacity-60">Basado en Índice Big Mac • Argentina vs USA</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-4xl font-black ${valuationStats.isCheap ? 'text-green-600' : 'text-red-600'}`}>
                      {valuationStats.brecha > 0 ? '+' : ''}{valuationStats.brecha.toFixed(1)}%
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      {valuationStats.isCheap ? 'Dólar Subvaluado (BARATO)' : 'Dólar Sobrevaluado (CARO)'}
                    </p>
                  </div>
                </div>

                {/* The Meter */}
                <div className="relative mt-8">
                  {/* Labels */}
                   <div className="flex justify-between">
                     <div className="text-center">
                        <span className="text-[9px] font-bold opacity-40">año 2005</span>
                        <span className="text-[10px] font-black block text-green-700">MUY BARATO</span>
                     </div>
                     <div className="text-center -translate-x-1/2">
                        <span className="text-[9px] font-bold opacity-40">Nivel 2000</span>
                        <span className="text-[10px] font-black block text-yellow-600">EQUILIBRIO</span>
                     </div>
                     <div className="text-center">
                        <span className="text-[9px] font-bold opacity-40">Inflación en USD</span>
                        <span className="text-[10px] font-black block text-red-700">MUY CARO</span>
                     </div>
                   </div>
                   {/* Track */}
                   <div className="h-6 w-full bg-gradient-to-r from-green-300 via-yellow-200 to-red-400 border-2 border-black rounded-full shadow-inner relative">
                      {/* Zero point / Fair Parity */}
                      <div className="absolute left-1/2 top-0 h-8 w-1 bg-black -translate-y-1"></div>
                      
                      {/* Marker for current level */}
                      {/* We'll map the range -100% to 100% gap */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-20"
                        style={{ left: `${Math.max(5, Math.min(95, 50 + (valuationStats.brecha / 2)))}%` }}
                      >
                        <div className="relative">
                          <div className="w-6 h-6 bg-white border-2 border-black rounded-full flex items-center justify-center -translate-x-1/2">
                          </div>
                          <div className="absolute -top-8 left-0 -translate-x-1/2 whitespace-nowrap bg-black text-white px-2 py-0.5 text-[10px] font-bold">
                            ESTAS AQUÍ
                          </div>
                          <div className="absolute -bottom-8 left-0 -translate-x-1/2 text-center">
                            <span className="text-xs font-black uppercase block whitespace-nowrap">TC: ${valuationStats.tc_actual.toFixed(0)}</span>
                            <span className="text-[9px] font-bold block opacity-50 whitespace-nowrap">Actual</span>
                          </div>
                        </div>
                      </div>
                   </div>
                   
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20">
                  <div className="bg-white border-2 border-black p-2 shadow-button">
                    <span className="text-[9px] font-black opacity-50 block uppercase">Precio Local</span>
                    <span className="text-lg font-black">{valuationStats.p_ars.toLocaleString('es-AR')} ARS</span>
                  </div>
                  <div className="bg-white border-2 border-black p-2 shadow-button">
                    <span className="text-[9px] font-black opacity-50 block uppercase">Precio en USA</span>
                    <span className="text-lg font-black">{valuationStats.p_usd_now.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                  <div className="bg-white border-2 border-black p-2 shadow-button">
                    <span className="text-[9px] font-black opacity-50 block uppercase">TC PPP (Fair)</span>
                    <span className="text-lg font-black">{valuationStats.tc_ppp.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-pastel-pink border-2 border-black p-2 shadow-button">
                    <span className="text-[9px] font-black opacity-50 block uppercase">Precio en ARG</span>
                    <span className="text-lg font-black">{latestArg.dollar_price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold opacity-70 leading-relaxed italic">
                    Fecha de los datos: {new Date(latestArg.date).toLocaleDateString('es-AR')}
                  </p>
                  <p className="text-[10px] font-bold opacity-70 leading-relaxed italic">
                    Fuente: The Economist
                  </p>
                </div>
              </div>

              {/* Targets List */}
              <div className="bg-retro-blue border-4 border-black p-4 shadow-window text-white flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/20 pb-2">
                  <Info className="w-4 h-4" />
                  <h3 className="font-black uppercase italic text-sm tracking-widest">Targets Históricos</h3>
                </div>
                <p className="text-[10px] font-bold opacity-70 leading-relaxed italic">
                  Dólar necesario para nivelar el precio local a referencias históricas ajustadas por inflación US:
                </p>
                <div className="flex flex-col gap-3">
                  {Object.entries(valuationStats.tc_targets).map(([label, val]) => (
                    <div key={label} className="bg-black/20 border border-white/10 p-3 flex justify-between items-center group hover:bg-black/40 transition-colors">
                      <div>
                        <span className="text-[10px] font-black block opacity-60 uppercase">{label}</span>
                        <span className="text-xl font-black italic tracking-tighter">${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-black ${valuationStats.tc_actual > val ? 'text-green-400' : 'text-orange-400'}`}>
                          {((valuationStats.tc_actual / val - 1) * 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%
                        </span>
                        <span className="text-[8px] font-bold opacity-50">GAP</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto bg-white/10 p-2 border border-dashed border-white/30 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-3 h-3 text-pastel-yellow" />
                    <span className="text-[10px] font-black uppercase">Nota</span>
                  </div>
                  <p className="text-[9px] font-bold opacity-60 leading-tight">
                    Si el P_ars / TC_actual &gt; P_usd_now, Argentina tiene inflación en dólares (es más cara que EE.UU.).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Evolution Chart */}
          <div className="bg-white border-4 border-black p-4 shadow-window flex flex-col gap-4 flex-1 min-h-[500px]">
             <div className="flex justify-between items-center border-b-2 border-black pb-2">
               <div>
                <h3 className="font-black uppercase italic text-retro-blue tracking-tight">Evolución de Valuación Real (Raw Index %)</h3>
                <p className="text-[10px] font-bold opacity-40 uppercase">Tendencia de encarecimiento relativo</p>
               </div>
               <div className="flex items-center gap-4 text-[10px] font-bold uppercase overflow-x-auto">
                 {selectedCountries.map((iso, idx) => (
                   <div key={iso} className="flex items-center gap-1 shrink-0">
                     <div className="w-3 h-3 border border-black shadow-[1px_1px_0px_black]" style={{ backgroundColor: ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 6] }}></div>
                     <span>{iso}</span>
                   </div>
                 ))}
               </div>
             </div>
             
             <div className="flex-1 min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).getFullYear().toString()}
                      style={{ fontSize: '10px', fontStyle: 'italic', fontWeight: '900' }} 
                      stroke="#000"
                    />
                    <YAxis 
                      yAxisId="left"
                      style={{ fontSize: '10px', fontWeight: '900' }} 
                      tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                      stroke="#000"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      style={{ fontSize: '10px', fontWeight: '900' }} 
                      tickFormatter={(val) => `$${val}`}
                      stroke="#000"
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        border: '4px solid black', 
                        borderRadius: 0, 
                        boxShadow: '6px 6px 0px rgba(0,0,0,1)',
                        padding: '12px',
                        fontFamily: 'monospace'
                      }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      itemStyle={{ fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}
                    />
                    {selectedCountries.map((iso, idx) => (
                      <React.Fragment key={iso}>
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey={`val_${iso}`} 
                          name={`Val. ${iso}`}
                          stroke={['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 6]} 
                          strokeWidth={iso === 'ARG' ? 5 : 2} 
                          dot={false} 
                          activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }}
                        />
                        <Line 
                          yAxisId="right"
                          type="stepAfter" 
                          dataKey={`price_${iso}`} 
                          name={`USD ${iso}`}
                          stroke={['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 6]} 
                          strokeWidth={1} 
                          strokeDasharray="4 4"
                          dot={false} 
                          opacity={0.4}
                        />
                      </React.Fragment>
                    ))}
                    <ReferenceLine yAxisId="left" y={0} stroke="#000" strokeWidth={3} label={{ position: 'right', value: 'FAIR PARITY', fontSize: 10, fontWeight: 900, fill: '#000' }} />
                  </LineChart>
                </ResponsiveContainer>
             </div>

             <div className="flex gap-4 border-t-2 border-black pt-4 overflow-x-auto">
               <div className="bg-black text-white p-3 flex-1 min-w-[200px] shadow-button">
                 <h4 className="text-[10px] font-black uppercase mb-1 flex items-center gap-2">
                   <TrendingUp className="w-3 h-3 text-pastel-pink" /> 
                   Interpretación para el Algoritmo
                 </h4>
                 <ul className="text-[9px] font-bold opacity-80 list-disc list-inside flex flex-col gap-1">
                   <li>P_ars / TC_actual &gt; P_usd_now = Inflación en USD</li>
                   <li>Brecha Positiva = Peso Subvaluado (Favorable para exportar)</li>
                   <li>Brecha Negativa = Peso Appreciado (Favorable para importar)</li>
                 </ul>
               </div>
               <div className="bg-pastel-yellow p-3 flex-1 min-w-[200px] shadow-button border-2 border-black">
                 <h4 className="text-[10px] font-black uppercase mb-1 flex items-center gap-2 text-retro-blue">
                   <Activity className="w-3 h-3" /> 
                   Fórmula PPP Aplicada
                 </h4>
                 <code className="text-[9px] font-black opacity-80 block bg-white/50 p-1 mt-2">
                   TC_ppp = P_ars / P_usd_now
                 </code>
                 <code className="text-[9px] font-black opacity-80 block bg-white/50 p-1 mt-1">
                   Gap % = ((TC_actual / TC_ppp) - 1) * 100
                 </code>
               </div>
             </div>
          </div>
        </>
      )}
    </div>
  );
}
