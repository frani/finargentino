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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, BarChart3, Globe, PieChart as PieIcon } from 'lucide-react';

interface MarketPeriod {
  year: number;
  month: number;
  total_assets: number;
  total_liabilities: number;
  total_net_worth: number;
  avg_solvency: number;
  entity_count: number;
}

interface MarketOverviewProps {
  data: MarketPeriod[];
  topEntities: { name: string; assets: number }[];
}

const COLORS = ['#000080', '#008080', '#800080', '#808000', '#008000', '#800000', '#FF00FF', '#00FFFF', '#C0C0C0'];

export const MarketOverview: React.FC<MarketOverviewProps> = ({ data, topEntities }) => {
  if (!data || data.length === 0) {
    return <div className="p-8 text-center animate-pulse text-retro-blue font-bold">Cargando datos del mercado...</div>;
  }

  const latest = data[data.length - 1];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(val);
  };

  const chartData = data.map(p => ({
    periodo: `${p.month}/${p.year}`,
    ...p
  }));

  // Pie Chart Data: Top 7 + Others
  const top7 = topEntities.slice(0, 7);
  const totalTop7 = top7.reduce((acc, curr) => acc + curr.assets, 0);
  const othersAssets = latest.total_assets - totalTop7;
  
  const pieData = [
    ...top7.map(e => ({ name: e.name, value: e.assets })),
    { name: 'Otros (Sistema)', value: othersAssets > 0 ? othersAssets : 0 }
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Macro Stats */}
      <div className="window bg-pastel-yellow">
        <div className="title-bar !bg-retro-blue flex items-center gap-2">
          <Globe className="w-4 h-4" />
          <span>Resumen Macro - Sistema Financiero Argentino ({latest.month}/{latest.year})</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Activo Total Sistema", val: formatCurrency(latest.total_assets), color: "text-retro-blue" },
            { label: "Patrimonio Neto Total", val: formatCurrency(latest.total_net_worth), color: "text-retro-green" },
            { label: "Solvencia Promedio", val: latest.avg_solvency.toFixed(1) + "%", color: "text-purple-700" },
            { label: "Entidades Registradas", val: latest.entity_count, color: "text-black" }
          ].map((s, i) => (
            <div key={i} className="bg-white p-3 border-2 border-black shadow-button flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold opacity-60 text-center">{s.label}</span>
              <span className={`text-xl font-bold ${s.color}`}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Evolution */}
        <div className="window bg-white h-[400px]">
          <div className="title-bar !bg-retro-blue flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Evolución del Tamaño del Sistema</span>
          </div>
          <div className="p-4 h-full pb-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodo" />
                <YAxis tickFormatter={(val) => `$${(val / 1e12).toFixed(1)}T`} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Legend />
                <Area type="monotone" dataKey="total_assets" stroke="#000080" fill="#000080" fillOpacity={0.1} name="Activo Total" />
                <Area type="monotone" dataKey="total_net_worth" stroke="#008000" fill="#008000" fillOpacity={0.1} name="P. Neto Total" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Solvency Trend */}
        <div className="window bg-white h-[400px]">
          <div className="title-bar !bg-purple-700 flex items-center gap-2 text-white">
            <TrendingUp className="w-4 h-4" />
            <span>Tendencia de Solvencia del Sistema (%)</span>
          </div>
          <div className="p-4 h-full pb-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodo" />
                <YAxis unit="%" domain={[0, 'auto']} tickFormatter={(val) => `${val.toFixed(1)}%`} />
                <Tooltip formatter={(val: number) => [`${val.toFixed(2)}%`, "Solvencia"]} />
                <Legend />
                <Line type="monotone" dataKey="avg_solvency" stroke="#7e22ce" strokeWidth={3} name="Solvencia Promedio (%)" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Ranking */}
        <div className="window bg-white h-[450px]">
          <div className="title-bar !bg-black flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Ranking de Entidades (Top 10 por Activos)</span>
          </div>
          <div className="p-4 h-full pb-12">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEntities} layout="vertical" margin={{ left: 160 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(val) => `$${(val / 1e12).toFixed(1)}T`} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Legend />
                <Bar dataKey="assets" fill="#000080" name="Activos Totales" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Share Pie */}
        <div className="window bg-white h-[450px]">
          <div className="title-bar !bg-retro-green flex items-center gap-2">
            <PieIcon className="w-4 h-4" />
            <span>Market Share (Activos)</span>
          </div>
          <div className="p-4 h-full pb-12">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
