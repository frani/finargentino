import React, { useEffect, useState } from 'react';
import { useMCP } from '../hooks/useMCP';
import { RetroButton } from './RetroUI';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, Check, Globe } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

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

  const countries = Array.from(new Set(data.map(d => d.iso_a3)))
    .map(iso_a3 => {
      const item = data.find(d => d.iso_a3 === iso_a3);
      return { iso_a3, name: item?.name || iso_a3 };
    })
    .sort((a, b) => {
      if (a.iso_a3 === 'ARG') return -1;
      if (b.iso_a3 === 'ARG') return 1;
      return a.name.localeCompare(b.name);
    });

  const filteredData = data.filter(d => selectedCountries.includes(d.iso_a3)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // For the detail cards, we show the first selected country's latest info
  const firstCountryData = data.filter(d => d.iso_a3 === selectedCountries[0]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestData = firstCountryData.length > 0 ? firstCountryData[firstCountryData.length - 1] : null;

  const chartData = Array.from(new Set(data.map(d => d.date)))
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

  const toggleCountry = (iso: string) => {
    setSelectedCountries(prev => 
      prev.includes(iso) 
        ? (prev.length > 1 ? prev.filter(c => c !== iso) : prev)
        : [...prev, iso]
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4 font-sans h-full">
      <div className="flex justify-between items-center bg-retro-bg p-2 border-2 border-black shadow-button shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <RetroButton 
              className="flex items-center gap-2 text-xs py-1 px-3 min-w-[200px] justify-between"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-3 h-3" />
                <span>Elegir Países ({selectedCountries.length})</span>
              </div>
              <ChevronDown className={`w-3 h-3 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
            </RetroButton>

            {isPickerOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-retro-bg border-2 border-black shadow-retro z-50 p-2 max-h-[400px] overflow-y-auto">
                <div className="text-[10px] font-bold uppercase mb-2 border-b border-black/20 pb-1">Seleccionar Países</div>
                <div className="flex flex-col gap-1">
                  {countries.map(c => (
                    <label key={c.iso_a3} className="flex items-center justify-between hover:bg-white/40 p-1 cursor-pointer group">
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
          <p className="text-[10px] font-bold opacity-50 italic">Fuente: The Economist (Raw Index %)</p>
        </div>
        <div className="flex gap-2">
          <RetroButton onClick={fetchData} disabled={loading || syncing} className="px-2 py-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </RetroButton>
          <RetroButton onClick={handleSync} disabled={syncing} className="px-2 py-1 font-bold text-[10px] uppercase">
            Sync Data
          </RetroButton>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center font-bold text-retro-blue animate-pulse">
          Cargando datos...
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="bg-white border-2 border-black p-4 text-center shadow-button">
            <p className="font-bold mb-2">No hay datos disponibles.</p>
            <RetroButton onClick={handleSync}>Sincronizar Ahora</RetroButton>
          </div>
        </div>
      ) : (
        <>
          {latestData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-pastel-pink border-2 border-black p-3 shadow-button flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mb-1">Precio Actual (ARS)</span>
                <span className="text-3xl font-black">${latestData.local_price.toFixed(2)}</span>
                <span className="text-xs font-bold mt-1">Fecha: {new Date(latestData.date).toLocaleDateString()}</span>
              </div>
              
              <div className="bg-pastel-blue border-2 border-black p-3 shadow-button flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mb-1">Precio en Dólares (USD)</span>
                <span className="text-3xl font-black">${latestData.dollar_price.toFixed(2)}</span>
                <span className="text-xs font-bold mt-1">Tipo de cambio usado: ${latestData.dollar_ex.toFixed(2)}</span>
              </div>

              <div className={`${latestData.usd_raw > 0 ? 'bg-pastel-yellow' : 'bg-pastel-green'} border-2 border-black p-3 shadow-button flex flex-col items-center`}>
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mb-1">Estado de Valuación (vs USD)</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {latestData.usd_raw > 0 ? (
                    <TrendingUp className="text-red-600 w-8 h-8" />
                  ) : latestData.usd_raw < 0 ? (
                    <TrendingDown className="text-green-600 w-8 h-8" />
                  ) : (
                    <Minus className="text-gray-600 w-8 h-8" />
                  )}
                  <span className="text-2xl font-black">
                    {(Math.abs(latestData.usd_raw) * 100).toFixed(1)}%
                  </span>
                </div>
                <span className="text-sm font-bold uppercase mt-1 text-center">
                  {latestData.usd_raw > 0 ? 'Sobrevaluado' : latestData.usd_raw < 0 ? 'Subvaluado' : 'A la par'}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white border-2 border-black p-2 shadow-button flex-1 min-h-[400px]">
            <h3 className="font-bold border-b-2 border-black pb-1 mb-2 text-sm italic">Comparativa Histórica de Valuación (Raw Index %)</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => new Date(val).getFullYear().toString()}
                  style={{ fontSize: '10px', fontWeight: 'bold' }} 
                />
                <YAxis 
                  yAxisId="left"
                  style={{ fontSize: '10px', fontWeight: 'bold' }} 
                  tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  style={{ fontSize: '10px', fontWeight: 'bold' }} 
                  tickFormatter={(val) => `$${val}`}
                />
                <RechartsTooltip 
                  contentStyle={{ 
                    border: '2px solid black', 
                    borderRadius: 0, 
                    boxShadow: '4px 4px 0px rgba(0,0,0,1)',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  formatter={(value: number, name: string) => {
                    if (name.startsWith('val_')) {
                      const iso = name.replace('val_', '');
                      return [`${(value * 100).toFixed(1)}%`, `Valuación ${iso}`];
                    }
                    if (name.startsWith('price_')) {
                      const iso = name.replace('price_', '');
                      return [`$${value.toFixed(2)}`, `Precio USD ${iso}`];
                    }
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}/>
                {selectedCountries.map((iso, idx) => (
                  <Line 
                    key={`val_${iso}`}
                    yAxisId="left"
                    type="monotone" 
                    dataKey={`val_${iso}`} 
                    name={`val_${iso}`}
                    stroke={['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 6]} 
                    strokeWidth={idx === 0 ? 4 : 2} 
                    dot={false} 
                    activeDot={{ r: 4 }}
                  />
                ))}
                {selectedCountries.map((iso, idx) => (
                  <Line 
                    key={`price_${iso}`}
                    yAxisId="right"
                    type="stepAfter" 
                    dataKey={`price_${iso}`} 
                    name={`Precio USD (${iso})`}
                    stroke={['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 6]} 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    dot={false} 
                    opacity={0.6}
                  />
                ))}
                <ReferenceLine yAxisId="left" y={0} stroke="#000" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
