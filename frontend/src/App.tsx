import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useMCP } from './hooks/useMCP';
import { Window, RetroButton } from './components/RetroUI';
import { RefreshCw, DollarSign, Menu, X, Sprout } from 'lucide-react';
import { EntityAnalysis } from './components/EntityAnalysis';
import { MarketOverview } from './components/MarketOverview';
import { ComparativeTable } from './components/ComparativeTable';
import { DollarView } from './components/DollarView';
import { Home } from './components/Home';
import { AgroView } from './components/AgroView';
import { WallOfFame } from './components/WallOfFame';
import { StartMenu } from './components/StartMenu';
import { BigMacView } from './components/BigMacView';
import { useMCPContext } from './contexts/MCPContext';

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen p-2 md:p-4 flex flex-col gap-2 md:gap-4 font-sans text-black h-screen overflow-hidden bg-transparent">
      {/* Top Bar - simplified, no explorer */}
      <div className="window py-1 px-2 flex justify-between items-center bg-retro-bg shrink-0 z-50">
        <div className="flex gap-1 md:gap-2 text-xs items-center">
          <div>
            <StartMenu />
          </div>
          
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
          </div>
        </div>
        <div className="text-[9px] md:text-[10px] font-bold bg-pastel-yellow border-black border px-1 py-1 shadow-button truncate max-w-[120px] sm:max-w-none">
          Argentino v0.4.0
        </div>
      </div>

      {/* Content Area - full width, no sidebar */}
      <div className="flex-1 overflow-hidden relative">

        <div className="h-full overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Taskbar - Windows style bottom bar with Start menu */}
      <div className="bg-retro-bg border-t-2 border-white shadow-button p-1 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2">
          {/* Quick info in taskbar */}

          {/* Quick info in taskbar */}
          <span className="text-[9px] md:text-[10px] truncate mr-2 hidden sm:inline border-l border-black/20 pl-2">
            Los Valores de los bancos se muestran en Miles y en ARS (pesos)
          </span>
        </div>
        
        <div className="flex gap-2 md:gap-4 shrink-0 text-[9px] md:text-[10px] bg-retro-bg border border-black/30 shadow-button-pressed px-2 py-0.5">
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
            <RouteWindow title="Análisis Macroeconómico del Sistema" className="bg-pastel-yellow h-full">
              {loadingMarket ? (
                <div className="p-10 text-center animate-pulse italic">Cargando datos maestros...</div>
              ) : (
                <MarketOverview data={marketData} topEntities={topEntities} />
              )}
            </RouteWindow>
          } />
          
          <Route path="/entidades" element={
            <RouteWindow 
              title={
                <div className="flex items-center gap-2">
                  <span>Bancos</span>
                </div>
              } 
              className="bg-pastel-pink h-full"
            >
              <ComparativeTable />
            </RouteWindow>
          } />

          <Route path="/dolar" element={
            <RouteWindow
              title={
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Cotización del Dólar en Argentina</span>
                </div>
              }
              className="bg-pastel-yellow h-full"
            >
              <DollarView />
            </RouteWindow>
          } />
          
          <Route path="/agro" element={
            <RouteWindow
              title={
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4" />
                  <span>Mercado de Granos</span>
                </div>
              }
              className="bg-pastel-green h-full"
            >
              <AgroView />
            </RouteWindow>
          } />

          <Route path="/bigmac" element={
            <RouteWindow
              title={
                <div className="flex items-center gap-2">
                  <span>Índice Big Mac</span>
                </div>
              }
              className="bg-pastel-yellow h-full"
            >
              <BigMacView />
            </RouteWindow>
          } />

          <Route path="/wall-of-fame" element={<WallOfFame />} />

          <Route path="/entidades/:id" element={<EntityDetailWrapper />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

function RouteWindow({ children, title, className }: { children: React.ReactNode, title: React.ReactNode, className?: string }) {
  const location = useLocation();
  return (
    <Window key={location.key} title={title} className={className}>
      {children}
    </Window>
  );
}

// Wrapper to fetch entity data based on ID
function EntityDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const { entities, fetchBalances, balancesCache, addToRecentlyViewed } = useMCPContext();
  const [localBalances, setLocalBalances] = useState<any[]>(balancesCache[id || ''] || []);
  const [loading, setLoading] = useState(!balancesCache[id || '']);
  const navigate = useNavigate();
  const location = useLocation();

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
    <Window key={location.key} title={`Detalle: ${entityName}`} className="bg-pastel-blue h-full overflow-y-auto">
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
