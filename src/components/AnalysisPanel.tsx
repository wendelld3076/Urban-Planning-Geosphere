import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cone, Sun, PenTool, HardHat, Ruler, Mountain, Layers, X, Sparkles, Check } from 'lucide-react';
import { ActiveToolType } from './ViewportToolbar';

export interface AnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isSidebarExpanded: boolean;
  sidebarTheme?: 'light' | 'dark';
  activeTool?: ActiveToolType;
  onActiveToolChange?: (tool: ActiveToolType) => void;
}

export function AnalysisPanel({
  isOpen,
  onClose,
  isSidebarExpanded,
  sidebarTheme = 'dark',
  activeTool = 'none',
  onActiveToolChange
}: AnalysisPanelProps) {
  if (!isOpen) return null;

  const tools = [
    { id: 'view-corridor', name: 'View Corridor Cone', icon: Cone, color: 'text-cyan-400', desc: '3D sightline frustum & view obstruction ray-casting' },
    { id: 'parametric-massing', name: 'Parametric Massing', icon: PenTool, color: 'text-purple-400', desc: 'Conceptual zoning volumes, floor-area ratio & GFA calculation' },
    { id: 'subsurface-excavation', name: 'Underground Excavation', icon: HardHat, color: 'text-amber-500', desc: '3D clipping pit & subsurface utility inspection' },
    { id: 'distance', name: '3D Path Distance', icon: Ruler, color: 'text-blue-400', desc: 'Euclidean & terrain-following line measurement' },
    { id: 'height', name: 'Vertical Height', icon: Mountain, color: 'text-amber-400', desc: '3D vertical clearance & building height tool' },
    { id: 'area', name: 'Surface Polygon Area', icon: Layers, color: 'text-emerald-400', desc: 'Geodesic area & perimeter calculation' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        id="secondary-analysis-panel"
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
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
            <h3 className="font-semibold text-white text-sm tracking-wide">Spatial Analysis Tools</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            title="Close Analysis Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider px-1">
            Active Measurement & Simulation
          </div>

          <div className="space-y-2">
            {tools.map((item) => {
              const Icon = item.icon;
              const isActive = activeTool === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onActiveToolChange?.(isActive ? 'none' : (item.id as ActiveToolType))}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-purple-950/40 border-purple-500/50 text-white shadow-lg shadow-purple-500/10'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span className="truncate">{item.name}</span>
                        {isActive && <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-normal line-clamp-2 mt-0.5">{item.desc}</div>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-purple-500 border-purple-400 text-white' : 'border-slate-700 bg-slate-900'
                  }`}>
                    {isActive && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default AnalysisPanel;
