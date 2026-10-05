import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  ChevronRight, ChevronLeft, ChevronDown, BarChart3, PieChart as PieIcon, 
  TrendingUp, Info, Sliders, Layers, Search, MapPin, ArrowUpRight, ArrowDownRight,
  Plus, Minus, Activity, Database
} from 'lucide-react';
import { ShapefileData, ShapefileFeature } from '../types';

export type ViewFilterMode = 'top10' | 'bottom10' | 'all';

export interface AnalyticsViewProps {
  shapefileData: ShapefileData | null;
  selectedMetric: string;
  onFeatureClick: (feature: ShapefileFeature) => void;
  sidebarTheme?: 'light' | 'dark';
}

export function AnalyticsView({
  shapefileData,
  selectedMetric,
  onFeatureClick,
  sidebarTheme = 'dark'
}: AnalyticsViewProps) {
  const [viewMode, setViewMode] = useState<ViewFilterMode>('top10');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isBarChartExpanded, setIsBarChartExpanded] = useState(false);
  const [isPieChartExpanded, setIsPieChartExpanded] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // Helper to extract clean labels for zones
  const getFeatureLabel = (feature: ShapefileFeature, index: number): string => {
    const props = feature.properties;
    const nameKeys = ['name', 'NAME', 'Name', 'zone', 'ZONE', 'Zone', 'label', 'LABEL', 'Label', 'municipali', 'muni', 'county', 'id', 'ID', 'Id', 'OBJECTID', 'objectid'];
    for (const k of nameKeys) {
      if (props[k] !== undefined && props[k] !== null && props[k] !== '') {
        return String(props[k]);
      }
    }
    return `Zone #${index + 1}`;
  };

  // 1. Calculate Summary aggregates across ALL features
  const stats = useMemo(() => {
    if (!shapefileData) return null;

    const features = shapefileData.features;
    let total = 0;
    let maxVal = -Infinity;
    let maxFeature: ShapefileFeature | null = null;
    let minVal = Infinity;
    let minFeature: ShapefileFeature | null = null;
    let totalArea = 0;
    let hasArea = false;

    // Detect if there's an area property
    const areaKeys = ['area', 'AREA', 'Area', 'sq_km', 'SQ_KM', 'acres', 'ACRES'];
    let detectedAreaKey = '';
    
    if (features.length > 0) {
      for (const k of areaKeys) {
        if (features[0].properties[k] !== undefined) {
          detectedAreaKey = k;
          hasArea = true;
          break;
        }
      }
    }

    features.forEach((feat, index) => {
      const val = Number(feat.properties[selectedMetric]) || 0;
      total += val;
      if (val > maxVal) {
        maxVal = val;
        maxFeature = feat;
      }
      if (val < minVal) {
        minVal = val;
        minFeature = feat;
      }

      if (hasArea) {
        totalArea += Number(feat.properties[detectedAreaKey]) || 0;
      }
    });

    const average = features.length > 0 ? total / features.length : 0;
    const density = hasArea && totalArea > 0 ? total / totalArea : null;

    return {
      total,
      average,
      density,
      maxZoneName: maxFeature ? getFeatureLabel(maxFeature, features.indexOf(maxFeature)) : 'None',
      maxZoneValue: maxVal !== -Infinity ? maxVal : 0,
      maxFeature,
      minZoneName: minFeature ? getFeatureLabel(minFeature, features.indexOf(minFeature)) : 'None',
      minZoneValue: minVal !== Infinity ? minVal : 0,
      minFeature,
      hasArea,
      areaUnit: detectedAreaKey.toLowerCase().includes('sq') ? 'km²' : 'units'
    };
  }, [shapefileData, selectedMetric]);

  // 2. Process all features for Charting & Filtering
  const allFeaturesData = useMemo(() => {
    if (!shapefileData) return [];

    const features = shapefileData.features;

    let minVal = Infinity;
    let maxVal = -Infinity;
    features.forEach(feat => {
      const val = Number(feat.properties[selectedMetric]) || 0;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    });

    if (minVal === Infinity) minVal = 0;
    if (maxVal === -Infinity) maxVal = 1;
    if (minVal === maxVal) maxVal = minVal + 1;

    const getFeatureColor = (value: number, min: number, max: number): string => {
      const valNum = isNaN(value) ? 0 : value;
      const minNum = isNaN(min) ? 0 : min;
      const maxNum = isNaN(max) ? 1 : max;
      const range = (maxNum - minNum) || 1;
      const t = Math.max(0, Math.min(1, (valNum - minNum) / range));
      const r = Math.round(254 + (220 - 254) * t) || 0;
      const g = Math.round(240 + (38 - 240) * t) || 0;
      const b = Math.round(138 + (38 - 138) * t) || 0;
      return `rgb(${r}, ${g}, ${b})`;
    };

    const mapped = features.map((feat, idx) => {
      const val = Number(feat.properties[selectedMetric]) || 0;
      return {
        id: idx,
        name: getFeatureLabel(feat, idx),
        value: val,
        feature: feat,
        color: getFeatureColor(val, minVal, maxVal)
      };
    });

    // Default sorted descending
    return mapped.sort((a, b) => b.value - a.value);
  }, [shapefileData, selectedMetric]);

  // Active dataset depending on view mode filter
  const displayedChartData = useMemo(() => {
    if (!allFeaturesData.length) return [];
    if (viewMode === 'top10') {
      return allFeaturesData.slice(0, 10);
    }
    if (viewMode === 'bottom10') {
      return [...allFeaturesData].sort((a, b) => a.value - b.value).slice(0, 10);
    }
    return allFeaturesData;
  }, [allFeaturesData, viewMode]);

  // Filtered dataset for Table view
  const tableData = useMemo(() => {
    let source = displayedChartData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = source.filter(item => item.name.toLowerCase().includes(q));
    }
    return source;
  }, [displayedChartData, searchQuery]);

  // Handle empty state gracefully
  if (!shapefileData || shapefileData.features.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 text-center space-y-3 my-2">
        <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto text-blue-400">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            No GIS Shapefile Dataset
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Upload a Shapefile (.zip) in the Left Sidebar <strong className="text-blue-300 font-mono">Import</strong> tab or select an active GIS layer to view spatial analytics, ranking metrics, and zone breakdowns.
          </p>
        </div>
        <div className="pt-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-[10px] font-mono text-blue-300">
            <Database className="w-3 h-3 text-blue-400" /> Waiting for GIS Data
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      {/* Selected Metric Badge */}
      <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-slate-300 leading-relaxed">
          Visualizing <strong className="text-amber-400 font-mono font-bold uppercase">{selectedMetric}</strong> across <span className="font-mono text-blue-400 font-bold">{shapefileData.features.length} zones</span>. Click on any zone item or chart bar to fly to its map coordinates.
        </div>
      </div>

      {/* Interactive View Mode Filter Control */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
          <Sliders className="w-3 h-3 text-blue-400" />
          <span>Filter View Mode</span>
        </div>
        <div className="bg-slate-900/80 p-1 rounded-xl border border-white/10 flex items-center justify-between text-[11px] font-mono font-bold gap-1">
          <button
            type="button"
            onClick={() => setViewMode('top10')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-0 ${
              viewMode === 'top10'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ArrowUpRight className="w-3 h-3 text-amber-300" />
            <span>Top 10</span>
            <span className={`text-[9px] px-1 rounded-full ${viewMode === 'top10' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {Math.min(10, allFeaturesData.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('bottom10')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-0 ${
              viewMode === 'bottom10'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ArrowDownRight className="w-3 h-3 text-rose-300" />
            <span>Bottom 10</span>
            <span className={`text-[9px] px-1 rounded-full ${viewMode === 'bottom10' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {Math.min(10, allFeaturesData.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-0 ${
              viewMode === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Layers className="w-3 h-3 text-emerald-300" />
            <span>All Data</span>
            <span className={`text-[9px] px-1 rounded-full ${viewMode === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {allFeaturesData.length}
            </span>
          </button>
        </div>
      </div>

      {/* 1. SUMMARY STATISTICS ACCORDION */}
      {stats && (
        <div className="bg-slate-900/40 border border-white/5 rounded-xl overflow-hidden">
          <div 
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="p-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider">
                Summary Statistics
              </span>
            </div>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white transition-colors border-0 bg-transparent"
            >
              {isSummaryExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>

          <AnimatePresence>
            {isSummaryExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-3 grid grid-cols-2 gap-2"
              >
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Total Value</div>
                  <div className="text-sm font-extrabold text-blue-400 font-mono mt-0.5">
                    {stats.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Mean / Average</div>
                  <div className="text-sm font-extrabold text-indigo-400 font-mono mt-0.5">
                    {stats.average.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>

                <div 
                  onClick={() => stats.maxFeature && onFeatureClick(stats.maxFeature)}
                  className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 cursor-pointer hover:border-amber-500/30 transition-all group"
                >
                  <div className="text-[10px] text-amber-400 uppercase font-mono font-bold flex items-center justify-between">
                    <span>Highest Zone</span>
                    <MapPin className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-xs font-bold text-slate-200 truncate mt-0.5 font-sans">
                    {stats.maxZoneName}
                  </div>
                  <div className="text-[10px] font-mono font-semibold text-amber-400 mt-0.5">
                    {stats.maxZoneValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>

                <div 
                  onClick={() => stats.minFeature && onFeatureClick(stats.minFeature)}
                  className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 cursor-pointer hover:border-rose-500/30 transition-all group"
                >
                  <div className="text-[10px] text-rose-400 uppercase font-mono font-bold flex items-center justify-between">
                    <span>Lowest Zone</span>
                    <MapPin className="w-3 h-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-xs font-bold text-slate-200 truncate mt-0.5 font-sans">
                    {stats.minZoneName}
                  </div>
                  <div className="text-[10px] font-mono font-semibold text-rose-400 mt-0.5">
                    {stats.minZoneValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 2. BAR CHART VISUALIZATION ACCORDION */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl overflow-hidden">
        <div 
          onClick={() => setIsBarChartExpanded(!isBarChartExpanded)}
          className="p-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider">
              {viewMode === 'top10' ? 'Top 10 Zones Bar Chart' : viewMode === 'bottom10' ? 'Bottom 10 Zones Bar Chart' : 'All Zones Comparison'}
            </span>
          </div>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-white transition-colors border-0 bg-transparent"
          >
            {isBarChartExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {isBarChartExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3"
            >
              {viewMode === 'all' && displayedChartData.length > 15 && (
                <div className="text-[10px] font-mono text-slate-400 mb-2 flex items-center justify-between">
                  <span>← Scroll horizontally to explore all {displayedChartData.length} zones →</span>
                </div>
              )}
              <div className={viewMode === 'all' ? 'overflow-x-auto custom-scrollbar pb-2' : ''}>
                <div style={{ width: viewMode === 'all' && displayedChartData.length > 15 ? `${Math.max(300, displayedChartData.length * 28)}px` : '100%', height: '180px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={9}
                        tickLine={false}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#334155',
                          borderRadius: '0.5rem',
                          fontSize: '11px',
                          color: '#f8fafc'
                        }}
                        formatter={(val: any) => [
                          typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val, 
                          selectedMetric.toUpperCase()
                        ]}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[4, 4, 0, 0]} 
                        onClick={(entry) => entry && entry.feature && onFeatureClick(entry.feature)}
                        cursor="pointer"
                      >
                        {displayedChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. ZONE DISTRIBUTION PIE CHART ACCORDION */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl overflow-hidden">
        <div 
          onClick={() => setIsPieChartExpanded(!isPieChartExpanded)}
          className="p-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <PieIcon className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider">
              Zone Distribution Share
            </span>
          </div>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-white transition-colors border-0 bg-transparent"
          >
            {isPieChartExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {isPieChartExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 flex items-center justify-center h-44"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayedChartData.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(entry: any) => entry && entry.feature && onFeatureClick(entry.feature)}
                    cursor="pointer"
                  >
                    {displayedChartData.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-pie-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '11px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any) => [
                      typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val, 
                      selectedMetric.toUpperCase()
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. ZONE BREAKDOWN TABLE ACCORDION */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl overflow-hidden">
        <div 
          onClick={() => setIsTableExpanded(!isTableExpanded)}
          className="p-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider">
              Filtered Zone Rankings
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              {tableData.length} items
            </span>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white transition-colors border-0 bg-transparent"
            >
              {isTableExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isTableExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 space-y-2"
            >
              {/* Search Bar inside Zone Table */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search zone by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {tableData.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => onFeatureClick(item.feature)}
                    className="bg-slate-950/50 hover:bg-slate-900 border border-white/5 hover:border-blue-500/30 p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-slate-500 w-5">
                        #{idx + 1}
                      </span>
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-300 font-sans">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold font-mono text-slate-100">
                        {item.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                      <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                        <MapPin className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                ))}

                {tableData.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-500 font-mono italic">
                    No matching zones found.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export interface AnalyticsDashboardProps {
  shapefileData: ShapefileData | null;
  selectedMetric: string;
  onFeatureClick: (feature: ShapefileFeature) => void;
  sidebarTheme?: 'light' | 'dark';
}

export default function AnalyticsDashboard({
  shapefileData,
  selectedMetric,
  onFeatureClick,
  sidebarTheme = 'dark'
}: AnalyticsDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!shapefileData) return null;

  return (
    <motion.div
      initial={false}
      animate={{ x: isOpen ? 0 : 396 }}
      transition={{ type: 'spring', damping: 22, stiffness: 160 }}
      className="absolute top-[88px] right-4 bottom-14 z-20 flex items-stretch pointer-events-none"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute -left-4.5 top-12 z-[70] w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer pointer-events-auto ${
          isOpen
            ? 'bg-slate-900 border-2 border-slate-700 text-slate-200 hover:text-white hover:bg-blue-600 hover:border-blue-400 shadow-[0_4px_20px_rgba(0,0,0,0.6)]'
            : 'bg-blue-600 text-white hover:bg-blue-500 border-2 border-slate-900 shadow-[0_4px_20px_rgba(59,130,246,0.4)]'
        }`}
        title={isOpen ? "Collapse Analytics Panel" : "Expand Analytics Panel"}
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5 font-bold stroke-[3]" />
        ) : (
          <ChevronLeft className="w-5 h-5 font-bold stroke-[3]" />
        )}
      </button>

      <div className={`w-96 rounded-xl flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 ${
        sidebarTheme === 'light'
          ? 'sidebar-theme-light bg-white/95 text-slate-900 border border-slate-200 shadow-xl'
          : 'bg-slate-950/90 border border-white/10 text-slate-100 shadow-2xl backdrop-blur-md'
      }`}>
        <div className="p-4 border-b border-white/5 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
              Analytics & Metrics
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-semibold font-mono">
              {shapefileData.features.length} zones
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-0"
              title="Collapse Panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <AnalyticsView 
            shapefileData={shapefileData} 
            selectedMetric={selectedMetric} 
            onFeatureClick={onFeatureClick} 
            sidebarTheme={sidebarTheme} 
          />
        </div>
      </div>
    </motion.div>
  );
}
