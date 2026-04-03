import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useParams, useNavigate, Navigate } from 'react-router-dom';
import { useMCP } from './hooks/useMCP';
import { Window, RetroButton } from './components/RetroUI';
import { RefreshCw, LayoutGrid, Globe, ChevronRight, Search, Landmark, Menu, X, DollarSign } from 'lucide-react';
import { EntityAnalysis } from './components/EntityAnalysis';
import { MarketOverview } from './components/MarketOverview';
import { ComparativeTable } from './components/ComparativeTable';
import { DollarView } from './components/DollarView';
import { Home } from './components/Home';
import { AgroView } from './components/AgroView';
import { useMCPContext } from './contexts/MCPContext';
import { Sprout } from 'lucide-react';

function App() {
  const { call } = useMCP();
  const { 
    entities, 
    marketData, 
    loadingEntities, 
    loadingMarket, 
    fetchEntities, 
    fetchMarketData,
    lastSyncDate,
    fetchLastSyncDate,
    recentlyViewed
  } = useMCPContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const syncData = async () => {
    try {
      await call('tools/call', { name: 'sync_bcra_data' });
      alert("Sincronización global iniciada (BCRA, Agro, FX)!");
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEntities();
    fetchMarketData();
    fetchLastSyncDate();
  }, [fetchEntities, fetchMarketData, fetchLastSyncDate]);

  const lastSyncDateObj = lastSyncDate ? new Date(lastSyncDate) : null;
  // Threshold: 1 hour (3600000 ms)
  const isSyncDisabled = lastSyncDateObj ? (new Date().getTime() - lastSyncDateObj.getTime() < 1 * 60 * 60 * 1000) : false;

  const topEntities = entities
    .filter(e => e.annotations?.latest_assets)
    .slice(0, 10)
    .map(e => ({
      name: e.name.replace('Balances de ', ''),
      assets: e.annotations?.latest_assets || 0
    }));

  const globalLoading = loadingEntities || loadingMarket;

  const renderLayout = (children: React.ReactNode) => (
    <div className="min-h-screen p-2 md:p-4 flex flex-col gap-2 md:gap-4 font-sans text-black h-screen overflow-hidden bg-retro-bg-tint">
      {/* Top Menu */}
      <div className="window py-1 px-2 flex justify-between items-center bg-retro-bg shrink-0 z-50">
        <div className="flex gap-1 md:gap-2 text-xs items-center">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1 border-2 border-black shadow-button bg-retro-bg active:shadow-button-pressed"
          >
            {sidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
          </button>
          <Link to="/">
            <RetroButton className="font-bold px-2 hidden sm:block">Inicio</RetroButton>
          </Link>
          <div className="hidden sm:block w-[1px] bg-gray-600 self-stretch mx-1 shadow-button" />
          <RetroButton onClick={() => window.location.reload()} disabled={globalLoading} className="px-2">
            <RefreshCw className={`w-3 h-3 ${globalLoading ? 'animate-spin' : ''}`} />
          </RetroButton>
          <div className="flex items-center gap-2 border-l border-black/10 pl-2">
            <RetroButton onClick={syncData} className="px-1 md:px-2 text-[10px] md:text-xs" disabled={isSyncDisabled || globalLoading}>
              <span className="hidden xs:inline">Sincronizar Todo</span>
              <span className="xs:hidden">Sync</span>
            </RetroButton>
            {lastSyncDateObj && (
              <span className="text-[10px] opacity-70 hidden sm:inline ml-1 border-l border-black/20 pl-2">
                Última sync: {lastSyncDateObj.toLocaleString()}
              </span>
            )}
            <RetroButton className="px-1 md:px-2 text-[10px] md:text-xs bg-pastel-green">
              <a href="https://github.com/frani/argentino" target="_blank" rel="noopener noreferrer">Github</a>
            </RetroButton>
          </div>
        </div>
        <div className="text-[9px] md:text-[10px] font-bold bg-pastel-yellow border-black border px-1 py-1 shadow-button truncate max-w-[120px] sm:max-w-none">
          Argentino v0.4.0
        </div>
      </div>

      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 overflow-hidden relative">
        {/* Sidebar / Explorer */}
        <div className={`
          ${sidebarOpen ? 'flex' : 'hidden md:flex'} 
          absolute md:relative z-40 inset-0 md:inset-auto 
          md:col-span-3 h-full overflow-y-auto 
          bg-retro-bg-tint/95 md:bg-transparent p-4 md:p-0
        `}>
          <Window title="Explorador" className="bg-pastel-pink/50 h-full w-full">
            <div className="flex flex-col gap-1">
              {[
                { to: "/", icon: LayoutGrid, label: "Inicio", end: true },
                { to: "/general", icon: Globe, label: "Vista General" },
                { to: "/entidades", icon: Landmark, label: "Bancos" },
                { to: "/dolar", icon: DollarSign, label: "Cotización Dólar" },
                { to: "/agro", icon: Sprout, label: "Agro" }
              ].map(link => (
                <NavLink 
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({isActive}) => `flex items-center gap-2 p-2 border border-transparent ${isActive ? 'bg-retro-blue text-white shadow-button' : 'hover:bg-retro-blue/20'}`}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="font-bold text-sm">{link.label}</span>
                </NavLink>
              ))}

              <div className="mt-4 border-t-2 border-black/5 pt-2 px-1">
                <span className="text-[9px] uppercase font-bold opacity-50">Visto Recientemente</span>
                <div className="flex flex-col gap-1 mt-1">
                  {recentlyViewed.length > 0 ? (
                    recentlyViewed.map(e => (
                      <NavLink
                        key={e.id}
                        to={`/entidades/${e.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={({isActive}) => `flex items-center gap-2 p-1 text-[11px] truncate ${isActive ? 'bg-retro-green text-black border-black border' : 'hover:bg-retro-green/20'}`}
                      >
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">{e.name}</span>
                      </NavLink>
                    ))
                  ) : (
                    <div className="text-[10px] italic opacity-40 p-2">Ninguna entidad visitada</div>
                  )}
                </div>
              </div>
            </div>
          </Window>
        </div>

        {/* Content Area */}
        <div className="col-span-12 md:col-span-9 h-full overflow-y-auto">
          {children}
        </div>
      </div>

      <div className="bg-retro-bg border-t-2 border-white shadow-button p-1 text-[9px] md:text-[10px] flex justify-between shrink-0">
        <span className="truncate mr-2">Los Valores de los bancos se muestran en Miles y en ARS (pesos)</span>
        <div className="flex gap-2 md:gap-4 shrink-0">
          <span>{new Date().toLocaleDateString()}</span>
          <span className="hidden xs:inline">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      {renderLayout(
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/general" element={
            <Window title="Análisis Macroeconómico del Sistema" className="bg-pastel-yellow h-full">
              {loadingMarket ? (
                <div className="p-10 text-center animate-pulse italic">Cargando datos maestros...</div>
              ) : (
                <MarketOverview data={marketData} topEntities={topEntities} />
              )}
            </Window>
          } />
          
          <Route path="/entidades" element={
            <Window 
              title={
                <div className="flex items-center gap-2">
                  <span>Bancos</span>
                </div>
              } 
              className="bg-pastel-pink h-full"
            >
              <ComparativeTable />
            </Window>
          } />

          <Route path="/dolar" element={
            <Window
              title={
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Cotización del Dólar en Argentina</span>
                </div>
              }
              className="bg-pastel-yellow h-full"
            >
              <DollarView />
            </Window>
          } />
          
          <Route path="/agro" element={
            <Window
              title={
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4" />
                  <span>Mercado de Granos</span>
                </div>
              }
              className="bg-pastel-green h-full"
            >
              <AgroView />
            </Window>
          } />

          <Route path="/entidades/:id" element={<EntityDetailWrapper />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

// Wrapper to fetch entity data based on ID
function EntityDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const { entities, fetchBalances, balancesCache, addToRecentlyViewed } = useMCPContext();
  const [localBalances, setLocalBalances] = useState<any[]>(balancesCache[id || ''] || []);
  const [loading, setLoading] = useState(!balancesCache[id || '']);
  const navigate = useNavigate();

  const entity = entities.find(e => e.uri.endsWith(`/${id}`));
  const entityName = entity?.name.replace('Balances de ', '') || `Entidad ${id}`;

  useEffect(() => {
    if (entityName && id && !entityName.startsWith('Entidad ')) {
      addToRecentlyViewed(id, entityName);
    }
  }, [id, entityName, addToRecentlyViewed]);

  useEffect(() => {
    const fetch = async () => {
      if (!id) return;
      if (balancesCache[id]) {
        setLocalBalances(balancesCache[id]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const data = await fetchBalances(id);
      setLocalBalances(data);
      setLoading(false);
    };
    fetch();
  }, [id, fetchBalances, balancesCache]);

  return (
    <Window title={`Detalle: ${entityName}`} className="bg-pastel-blue h-full overflow-y-auto">
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="p-10 text-center animate-pulse italic text-retro-blue font-bold">
            Recuperando estados contables...
          </div>
        ) : localBalances.length > 0 ? (
          <EntityAnalysis 
            balances={localBalances} 
            headerContent={
              <RetroButton onClick={() => navigate('/entidades')} className="w-fit font-bold text-xs">
                ← Volver a Bancos
              </RetroButton>
            }
          />
        ) : (
          <div className="p-10 text-center italic text-red-500 bg-white border-2 border-red-500 shadow-button">
            No se encontraron datos para la entidad {id}.
          </div>
        )}
      </div>
    </Window>
  );
}

export default App;
