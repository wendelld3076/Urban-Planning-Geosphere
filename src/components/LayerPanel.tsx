import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, X, Eye, EyeOff, Globe, Building2, HardHat, Mountain, Check } from 'lucide-react';
import { MapLayer } from '../types';

export interface LayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isSidebarExpanded: boolean;
  sidebarTheme?: 'light' | 'dark';
  layers?: MapLayer[];
  onToggleLayer?: (id: string) => void;
}

export function LayerPanel({
  isOpen,
  onClose,
  isSidebarExpanded,
  sidebarTheme = 'dark',
  layers = [],
  onToggleLayer
}: LayerPanelProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        id="secondary-layer-panel"
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
            <Layers className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
            <h3 className="font-semibold text-white text-sm tracking-wide">3D Layer Control</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            title="Close Layer Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider px-1">
            Active Spatial Layers
          </div>

          <div className="space-y-2">
            {layers.length > 0 ? (
              layers.map((layer) => {
                const isVisible = layer.enabled ?? (layer as any).visible ?? true;
                return (
                  <div 
                    key={layer.id}
                    onClick={() => onToggleLayer?.(layer.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isVisible 
                        ? 'bg-slate-950/80 border-sky-500/40 text-white shadow-md' 
                        : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-md ${isVisible ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{layer.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">{layer.type || '3D Tile'}</div>
                      </div>
                    </div>

                    <button 
                      type="button"
                      className={`p-1.5 rounded-lg border-0 bg-transparent transition-colors ${
                        isVisible ? 'text-sky-400 hover:text-sky-300' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="space-y-2">
                {[
                  { id: 'photorealistic-3d-buildings', name: 'Google Photorealistic 3D Tiles', type: '3D Tileset', visible: true, icon: Building2 },
                  { id: 'subsurface-utilities', name: 'Subsurface Utilities Grid', type: 'BIM / IFC', visible: true, icon: HardHat },
                  { id: 'cesium-world-terrain', name: 'Cesium World Terrain Elevation', type: 'Terrain Mesh', visible: true, icon: Mountain },
                  { id: 'vector-zoning-bounds', name: 'Zoning & Boundary Polygons', type: 'GeoJSON Vector', visible: true, icon: Globe },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div 
                      key={item.id}
                      className="p-3 rounded-lg border bg-slate-950/70 border-slate-800 text-white flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-sky-500/20 text-sky-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">{item.type}</div>
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default LayerPanel;
