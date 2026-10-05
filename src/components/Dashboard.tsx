import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, X, TrendingUp, BarChart3, PieChart as PieIcon, 
  Building2, Layers, Compass, Globe, Sparkles
} from 'lucide-react';
import { ShapefileData } from '../types';

export interface DashboardProps {
  isOpen: boolean;
  onClose: () => void;
  isSidebarExpanded: boolean;
  sidebarTheme?: 'light' | 'dark';
  shapefileData?: ShapefileData | null;
  selectedMetric?: string;
  onFeatureClick?: (feature: any) => void;
}

export function Dashboard({
  isOpen,
  onClose,
  isSidebarExpanded,
  sidebarTheme = 'dark',
  shapefileData,
  selectedMetric = 'population'
}: DashboardProps) {
  if (!isOpen) return null;

  const totalZones = shapefileData?.features?.length || 18;
  const metricsCount = shapefileData ? Object.keys(shapefileData.features[0]?.properties || {}).length : 6;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        id="secondary-dashboard-panel"
        className={`fixed z-40 transition-all duration-300 flex flex-col backdrop-blur-md rounded-xl border shadow-2xl overflow-hidden
          ${isSidebarExpanded ? 'left-[340px]' : 'left-20'} 
          top-28 bottom-14 w-80 md:w-96 max-h-[calc(100vh-11rem)]
          ${
            sidebarTheme === 'light'
              ? 'sidebar-theme-light bg-white/95 border-slate-300 text-slate-900'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-100 shadow-black/80'
          }`}
      >
        {/* Pinned Header */}
        <div className="flex-shrink-0 p-3.5 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
            <h3 className="font-semibold text-white text-sm tracking-wide">Urban Analytics Dashboard</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            title="Close Dashboard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
          {/* Summary Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-cyan-400" /> Active Zones
              </span>
              <span className="text-lg font-bold font-mono text-cyan-300">{totalZones}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-emerald-400" /> GIS Attributes
              </span>
              <span className="text-lg font-bold font-mono text-emerald-300">{metricsCount}</span>
            </div>
          </div>

          {/* Metric Selector Indicator */}
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Active Layer Metric
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold uppercase">
                {selectedMetric}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Spatial choropleth rendering active for {selectedMetric}. Hover over any GIS feature on the 3D globe to view exact values.
            </p>
          </div>

          {/* Urban Density Highlights */}
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg space-y-2">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Site Highlights
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400">Max FAR Index</span>
                <span className="font-mono text-cyan-300 font-semibold">12.4 FAR</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400">Green Canopy Ratio</span>
                <span className="font-mono text-emerald-300 font-semibold">34.2%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Solar Potential</span>
                <span className="font-mono text-amber-300 font-semibold">High (1,640 kWh/m²)</span>
              </div>
            </div>
          </div>

          {/* Quick Info Banner */}
          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 text-[11px] text-blue-300 flex items-start gap-2">
            <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              This panel dynamically stays aligned to the left safe-zone below the Time of Day toolbar without obscuring any map viewports.
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default Dashboard;
