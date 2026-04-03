import React, { useEffect, useState, useMemo } from 'react';
import { useMCPContext } from '../contexts/MCPContext';
import { calculateMetrics, AVAILABLE_COLUMNS, Balance } from '../utils/financialMetrics';
import { Link } from 'react-router-dom';
import { Window, RetroButton } from './RetroUI';
import { Settings2, Search, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';

export const ComparativeTable: React.FC = () => {
  const { callMCP } = (useMCPContext() as any); // callMCP might not be exported in context, checking...
  const { fetchEntities } = useMCPContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestBalances, setLatestBalances] = useState<Balance[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<{year: number, month: number}[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<{year: number, month: number} | null>(null);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('comparativeTableColumns');
    return saved ? JSON.parse(saved) : ['assets', 'solvencia', 'roa', 'roe'];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('comparativeTableColumns', JSON.stringify(selectedColumnIds));
  }, [selectedColumnIds]);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const apiBaseUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiBaseUrl}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: 'get_available_periods' },
            id: Date.now(),
          }),
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const content = data.result?.content?.[0]?.text;
        if (content) {
          try {
            const periods = JSON.parse(content);
            if (Array.isArray(periods)) {
              setAvailablePeriods(periods);
              if (periods.length > 0) {
                setSelectedPeriod(periods[0]);
              }
            }
          } catch (e) {
            console.error("JSON parse error in periods:", e);
          }
        }
      } catch (e: any) {
        console.error("Error fetching periods:", e);
      }
    };
    fetchPeriods();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const apiBaseUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiBaseUrl}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { 
              name: 'get_latest_balances',
              arguments: selectedPeriod ? { year: selectedPeriod.year, month: selectedPeriod.month } : {}
            },
            id: Date.now(),
          }),
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const content = data.result?.content?.[0]?.text;
        if (content) {
          try {
            const rawBalances = JSON.parse(content);
            if (Array.isArray(rawBalances)) {
              setLatestBalances(rawBalances);
            }
          } catch (e) {
            console.error("JSON parse error in balances:", e);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedPeriod]);

  const metricsData = useMemo(() => {
    if (!Array.isArray(latestBalances)) return [];
    return latestBalances.map(b => b ? calculateMetrics(b) : null).filter(Boolean) as any[];
  }, [latestBalances]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(metricsData)) return [];
    let result = metricsData.filter(m => 
      m && ((m.entity_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.entity_code || '').toString().includes(searchTerm))
    );

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [metricsData, searchTerm, sortConfig]);

  const toggleColumn = (id: string) => {
    setSelectedColumnIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatValue = (key: string, value: any) => {
    if (value === undefined || value === null) return '-';
    
    const col = AVAILABLE_COLUMNS.find(c => c.id === key);
    if (!col) return value;

    if (key === 'assets' || key === 'netWorth' || key === 'netInc' || key === 'total_debt_amount' || key.startsWith('debt_sit_')) {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact' }).format(value);
    }
    
    if (key === 'debtors_count') {
        return new Intl.NumberFormat('es-AR').format(value);
    }

    if (typeof value === 'number') {
        if (key === 'leverage' || key === 'interestCoverage') return value.toFixed(2) + 'x';
        return value.toFixed(2) + '%';
    }

    return value;
  };

  if (loading) return <div className="p-10 text-center animate-pulse italic">Cargando datos comparativos...</div>;
  if (error) return <div className="p-10 text-center text-red-500 bg-white border-2 border-red-500 m-4 shadow-button">Error: {error}</div>;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 bg-retro-bg p-2 border-2 border-black shadow-button shrink-0">
        <div className="flex items-center gap-2 bg-white border-2 border-black px-2 py-1 flex-1 min-w-[200px] shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)]">
          <Search className="w-4 h-4 opacity-50" />
          <input 
            type="text" 
            placeholder="Filtrar entidades..." 
            className="bg-transparent outline-none text-xs font-bold w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase opacity-60">Periodo:</span>
          <select 
            className="bg-white border-2 border-black text-xs font-bold px-2 py-1 outline-none cursor-pointer hover:bg-gray-50 focus:ring-1 focus:ring-black shadow-button"
            value={selectedPeriod ? `${selectedPeriod.year}-${selectedPeriod.month}` : ''}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number);
              setSelectedPeriod({ year, month });
            }}
          >
            {availablePeriods.map(p => (
              <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                {new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(p.year, p.month - 1))}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <RetroButton 
            className="flex items-center gap-2 text-xs py-1 px-3"
            onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
          >
            <Settings2 className="w-3 h-3" />
            Configurar Columnas
            <ChevronDown className={`w-3 h-3 transition-transform ${isColumnPickerOpen ? 'rotate-180' : ''}`} />
          </RetroButton>

          {isColumnPickerOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-retro-bg border-2 border-black shadow-retro z-50 p-2 max-h-[400px] overflow-y-auto">
              <div className="text-[10px] font-bold uppercase mb-2 border-b border-black/20 pb-1">Seleccionar Columnas</div>
              {Object.entries(
                AVAILABLE_COLUMNS.reduce((acc, col) => {
                  if (!acc[col.category]) acc[col.category] = [];
                  acc[col.category].push(col);
                  return acc;
                }, {} as Record<string, typeof AVAILABLE_COLUMNS>)
              ).map(([category, cols]) => (
                <div key={category} className="mb-3">
                  <div className="text-[9px] font-black text-retro-blue mb-1">{category}</div>
                  <div className="flex flex-col gap-1">
                    {cols.map(col => (
                      <label key={col.id} className="flex items-center gap-2 hover:bg-white/40 p-1 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedColumnIds.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                          className="w-3 h-3 border-2 border-black accent-retro-blue"
                        />
                        <span className="text-[10px] font-bold">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto bg-white border-2 border-black shadow-button">
        <table className="w-full border-collapse text-xs text-left relative">
          <thead className="sticky top-0 z-20 shadow-[0_2px_0_0_black]">
            <tr className="bg-gray-100">
              <th className="p-2 border-b-2 border-r-2 border-black bg-gray-200 sticky left-0 z-30">
                <div className="flex items-center gap-1 cursor-pointer hover:text-retro-blue" onClick={() => handleSort('entity_name')}>
                  Denominación
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {selectedColumnIds.map(id => {
                const col = AVAILABLE_COLUMNS.find(c => c.id === id);
                return (
                  <th key={id} className="p-2 border-b-2 border-black bg-gray-100 text-right min-w-[120px]">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-retro-blue" onClick={() => handleSort(id)}>
                      {col?.label}
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                );
              })}
              <th className="p-2 border-b-2 border-black bg-gray-200 text-center w-24">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? filteredData.map((row, i) => (
              <tr key={row.entity_code || i} className="border-b border-gray-300 hover:bg-pastel-blue transition-colors group">
                <td 
                  className="p-2 font-bold bg-white group-hover:bg-pastel-blue sticky left-0 border-r-2 border-black/10 z-10 truncate max-w-[200px]"
                >
                  <Link 
                    to={`/entidades/${row.entity_code}`} 
                    className="hover:underline hover:text-retro-blue truncate block"
                    title={row.entity_name || ''}
                  >
                    {(row.entity_name || '').replace('Balances de ', '') || 'Entidad Desconocida'}
                  </Link>
                </td>
                {selectedColumnIds.map(id => (
                  <td key={id} className={`p-2 font-mono text-right ${(row as any)[id] < 0 ? 'text-red-500' : ''}`}>
                    {formatValue(id, (row as any)[id])}
                  </td>
                ))}
                <td className="p-2 text-center group-hover:bg-pastel-blue">
                  <Link to={`/entidades/${row.entity_code}`}>
                    <RetroButton className="text-[10px] py-0 px-2">Ver Detalles</RetroButton>
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={selectedColumnIds.length + 2} className="p-10 text-center italic opacity-40">
                  No se encontraron entidades con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-pastel-yellow border-2 border-black p-1 text-[9px] font-bold flex justify-between shadow-button">
        <span>Mostrando {filteredData.length} entidades</span>
        <span>Último periodo disponible reportado</span>
      </div>
    </div>
  );
};
