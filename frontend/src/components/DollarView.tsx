import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, DollarSign, Clock, DatabaseZap } from 'lucide-react';
import { RetroButton } from './RetroUI';
import { useMCP } from '../hooks/useMCP';

// Shape stored in our DB (db.FXRateRow)
interface FXRateRow {
  ticker: string;
  side: 'compra' | 'venta';
  value: number;
  source_ts: string;
  fetched_at: string;
}

// Aggregated view: one entry per ticker with both sides
interface AggregatedRate {
  ticker: string;
  compra: number | null;
  venta: number | null;
  source_ts: string;
}

// Metadata for display
const TICKER_META: Record<string, {
  emoji: string;
  nombre: string;
  bg: string;
  description: string;
  tag: string;
}> = {
  'ARS/USD':          { emoji: '🏛️', nombre: 'Oficial',       bg: 'bg-pastel-blue',   description: 'Tipo de cambio regulado por el BCRA',     tag: 'BCRA'     },
  'ARS_BLUE/USD':     { emoji: '💵', nombre: 'Blue',           bg: 'bg-pastel-green',  description: 'Mercado informal / paralelo',              tag: 'INFORMAL' },
  'ARS_MEP/USD':      { emoji: '📈', nombre: 'Bolsa (MEP)',    bg: 'bg-pastel-pink',   description: 'MEP — compra/venta de bonos en pesos',    tag: 'MEP'      },
  'ARS_CCL/USD':      { emoji: '🌐', nombre: 'CCL',            bg: 'bg-pastel-yellow', description: 'Contado Con Liquidación',                  tag: 'CCL'      },
  'ARS_MAYORISTA/USD':{ emoji: '🏦', nombre: 'Mayorista',      bg: 'bg-retro-bg',      description: 'Interbancario — operaciones mayoristas',  tag: 'MAY'      },
  'ARS_CRYPTO/USD':   { emoji: '₿',  nombre: 'Cripto',         bg: 'bg-pastel-yellow', description: 'Vía stable coins (USDT / DAI)',            tag: 'CRYPTO'   },
  'ARS_TARJETA/USD':  { emoji: '💳', nombre: 'Tarjeta',        bg: 'bg-pastel-pink',   description: 'Oficial + Imp. PAÍS + percepción AFIP',   tag: 'TARJETA'  },
};

const TICKER_ORDER = [
  'ARS/USD', 'ARS_BLUE/USD', 'ARS_MEP/USD', 'ARS_CCL/USD',
  'ARS_MAYORISTA/USD', 'ARS_CRYPTO/USD', 'ARS_TARJETA/USD',
];

const fmt = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(val)
    : '—';

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
};

function SpreadBadge({ compra, venta }: { compra: number | null; venta: number | null }) {
  if (!compra || !venta) return null;
  const spread = ((venta - compra) / compra) * 100;
  return (
    <span className="text-[9px] font-mono bg-black/10 px-1 border border-black/20 ml-1">
      spread {spread.toFixed(1)}%
    </span>
  );
}

function BreachaBadge({ venta, oficialVenta }: { venta: number | null; oficialVenta: number | null }) {
  if (!venta || !oficialVenta) return null;
  const brecha = ((venta - oficialVenta) / oficialVenta) * 100;
  return (
    <span className={`text-[9px] font-mono px-1 border ${brecha > 0 ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'}`}>
      {brecha > 0 ? '+' : ''}{brecha.toFixed(1)}% vs oficial
    </span>
  );
}

function VariationIcon({ a, b }: { a: number | null; b: number | null }) {
  if (!a || !b) return <Minus className="w-3 h-3 text-gray-400" />;
  return a < b
    ? <TrendingUp className="w-3 h-3 text-green-700" />
    : <TrendingDown className="w-3 h-3 text-red-600" />;
}

// Aggregate flat rows → one object per ticker
function aggregate(rows: FXRateRow[]): AggregatedRate[] {
  const map: Record<string, AggregatedRate> = {};
  for (const r of rows) {
    if (!map[r.ticker]) {
      map[r.ticker] = { ticker: r.ticker, compra: null, venta: null, source_ts: r.source_ts };
    }
    if (r.side === 'compra') map[r.ticker].compra = r.value;
    if (r.side === 'venta')  map[r.ticker].venta  = r.value;
    // keep the most recent source_ts
    if (r.source_ts > map[r.ticker].source_ts) map[r.ticker].source_ts = r.source_ts;
  }
  // Sort by canonical order, extras at the end
  return [
    ...TICKER_ORDER.filter(t => map[t]).map(t => map[t]),
    ...Object.values(map).filter(r => !TICKER_ORDER.includes(r.ticker)),
  ];
}

export function DollarView() {
  const { call } = useMCP();
  const [rates, setRates]         = useState<AggregatedRate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await call('tools/call', { name: 'get_fx_rates' });
      const text: string = result?.content?.[0]?.text ?? '[]';
      const rows: FXRateRow[] = JSON.parse(text) ?? [];
      setRates(aggregate(rows));
      setLastFetch(new Date());
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [call]);

  const syncAndRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await call('tools/call', { name: 'sync_fx_rates' });
      // Give the backend goroutine a moment to finish
      await new Promise(r => setTimeout(r, 2000));
      await fetchRates();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [call, fetchRates]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const oficialVenta = rates.find(r => r.ticker === 'ARS/USD')?.venta ?? null;
  const noData       = !loading && rates.length === 0;

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="flex items-center gap-1 text-[10px] opacity-50">
              <Clock className="w-3 h-3" />
              {lastFetch.toLocaleTimeString('es-AR')}
            </span>
          )}
          <RetroButton onClick={fetchRates} disabled={loading || syncing} className="px-2 py-1 text-xs">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </RetroButton>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border-2 border-red-500 shadow-button text-red-800 text-sm font-bold">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="p-10 text-center animate-pulse italic font-bold text-retro-blue">
          Cargando cotizaciones desde la base de datos...
        </div>
      )}

      {/* Empty state: no data yet in DB */}
      {noData && !error && (
        <div className="window border-2 border-black shadow-button bg-pastel-yellow p-6 flex flex-col items-center gap-4 text-center">
          <DatabaseZap className="w-12 h-12 opacity-40" />
          <div>
            <p className="font-bold text-sm">No hay cotizaciones en la base de datos aún.</p>
            <p className="text-xs opacity-60 mt-1">
              Hacé clic en <strong>Sync BD</strong> para obtener los datos desde dolarapi.com y guardarlos.
            </p>
          </div>
          <RetroButton onClick={syncAndRefresh} disabled={syncing} className="px-4 py-2 font-bold flex items-center gap-2">
            <DatabaseZap className="w-4 h-4" />
            {syncing ? 'Sincronizando...' : 'Obtener cotizaciones ahora'}
          </RetroButton>
        </div>
      )}

      {/* Cards grid */}
      {!loading && rates.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {rates.map(rate => {
              const meta = TICKER_META[rate.ticker] ?? {
                emoji: '💱', nombre: rate.ticker, bg: 'bg-retro-bg',
                description: rate.ticker, tag: '?',
              };
              const isOficial = rate.ticker === 'ARS/USD';

              return (
                <div
                  key={rate.ticker}
                  className={`window flex flex-col border-2 border-black shadow-button ${meta.bg} hover:translate-y-[-1px] transition-transform`}
                >
                  <div className="p-1 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{meta.emoji}</span>
                      <span className="font-bold text-xs">{meta.nombre}</span>
                    </div>
                  </div>

                  <div className="window-content flex flex-col gap-2 p-3">
                    <p className="text-[10px] opacity-60 italic">{meta.description}</p>
                    <p className="text-[9px] font-mono opacity-40">{rate.ticker}</p>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold opacity-40 tracking-wider">Compra</span>
                        <span className="text-sm font-bold font-mono text-green-800">{fmt(rate.compra)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold opacity-40 tracking-wider">Venta</span>
                        <span className="text-sm font-bold font-mono text-red-800">{fmt(rate.venta)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      <SpreadBadge compra={rate.compra} venta={rate.venta} />
                      {!isOficial && (
                        <BreachaBadge venta={rate.venta} oficialVenta={oficialVenta} />
                      )}
                    </div>

                    <div className="mt-1 border-t border-black/10 pt-1">
                      <span className="text-[9px] opacity-40 font-mono flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {fmtDate(rate.source_ts)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary table */}
          <div className="window border-2 border-black shadow-button bg-white">
            <div className="title-bar shrink-0">
              <span>Resumen Comparativo</span>
            </div>
            <div className="window-content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-retro-bg border-b-2 border-black">
                    <th className="p-2 text-left font-bold">Ticker</th>
                    <th className="p-2 text-left font-bold hidden sm:table-cell">Tipo</th>
                    <th className="p-2 text-right font-bold">Compra</th>
                    <th className="p-2 text-right font-bold">Venta</th>
                    <th className="p-2 text-right font-bold hidden sm:table-cell">Spread</th>
                    <th className="p-2 text-right font-bold hidden md:table-cell">Brecha vs Oficial</th>
                    <th className="p-2 text-right font-bold hidden lg:table-cell">Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate, i) => {
                    const meta    = TICKER_META[rate.ticker];
                    const spread  = rate.compra && rate.venta ? ((rate.venta - rate.compra) / rate.compra) * 100 : null;
                    const brecha  = oficialVenta && rate.venta && rate.ticker !== 'ARS/USD'
                      ? ((rate.venta - oficialVenta) / oficialVenta) * 100 : null;
                    return (
                      <tr key={rate.ticker} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-pastel-blue`}>
                        <td className="p-2 font-mono font-bold text-[10px]">{rate.ticker}</td>
                        <td className="p-2 hidden sm:table-cell">
                          <span className="flex items-center gap-1">
                            <span>{meta?.emoji ?? '💱'}</span>
                            <span className="font-bold">{meta?.nombre ?? rate.ticker}</span>
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono text-green-800">{fmt(rate.compra)}</td>
                        <td className="p-2 text-right font-mono font-bold text-red-800">{fmt(rate.venta)}</td>
                        <td className="p-2 text-right font-mono hidden sm:table-cell">
                          {spread != null ? `${spread.toFixed(2)}%` : '—'}
                        </td>
                        <td className="p-2 text-right font-mono hidden md:table-cell">
                          {brecha != null ? (
                            <span className={brecha > 0 ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                              {brecha > 0 ? '+' : ''}{brecha.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-2 text-right font-mono text-gray-500 hidden lg:table-cell text-[10px]">
                          {fmtDate(rate.source_ts)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
