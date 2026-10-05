import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Sliders, Info, Percent, Sparkles, 
  Navigation, CheckCircle2, AlertTriangle, Car, Landmark,
  ChevronLeft, ChevronRight, Eye, Ruler, Trash2
} from 'lucide-react';

interface MassingOverlayProps {
  isVisible: boolean;
  baseArea: number | null;
  floors: number;
  onFloorsChange: (floors: number) => void;
  floorHeight?: number;
  onFloorHeightChange?: (height: number) => void;
  plotSize: number;
  onPlotSizeChange: (plotSize: number) => void;
  onFlyToMassing: () => void;
  activeTool: string;
  massingColor: string;
  onMassingColorChange: (color: string) => void;
  massingOpacity?: number;
  onMassingOpacityChange?: (opacity: number) => void;
  levelColor?: string;
  onLevelColorChange?: (color: string) => void;
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  selectedMassingId?: string | null;
  selectedMassingName?: string | null;
  selectedCount?: number;
  onDeselectMassing?: () => void;
  onDeleteSelectedMassing?: (id: string) => void;
  isSidebarExpanded?: boolean;
  inline?: boolean;
}

const ZONING_PRESETS = [
  { label: 'Concept', color: '#ffffff', description: 'Conceptual (White) - Clean volumetric massing' },
  { label: 'Resi', color: '#f59e0b', description: 'Residential (Amber) - Housing & apartments' },
  { label: 'Comm', color: '#ef4444', description: 'Commercial (Red) - Retail, offices & business' },
  { label: 'Mixed', color: '#8b5cf6', description: 'Mixed-Use (Purple) - Combined uses' },
  { label: 'Indus', color: '#6b7280', description: 'Industrial (Gray) - Warehouses & factories' },
  { label: 'Insti', color: '#3b82f6', description: 'Institutional (Blue) - Schools & civic' },
  { label: 'Parks', color: '#10b981', description: 'Open Space (Green) - Parks & plazas' },
];

export default function MassingOverlay({
  isVisible,
  baseArea,
  floors,
  onFloorsChange,
  floorHeight = 3.5,
  onFloorHeightChange,
  plotSize,
  onPlotSizeChange,
  onFlyToMassing,
  activeTool,
  massingColor = '#ffffff',
  onMassingColorChange,
  massingOpacity = 1.0,
  onMassingOpacityChange,
  levelColor = '#808080',
  onLevelColorChange,
  showLabels,
  onShowLabelsChange,
  onUndo,
  canUndo,
  selectedMassingId = null,
  selectedMassingName = null,
  selectedCount = 0,
  onDeselectMassing,
  onDeleteSelectedMassing,
  isSidebarExpanded = true,
  inline = false,
}: MassingOverlayProps) {
  if (!isVisible) return null;

  const hasPlacedMass = baseArea !== null && baseArea > 0;
  const gfa = hasPlacedMass ? baseArea * floors : 0;
  const parkingSpaces = hasPlacedMass ? Math.ceil(gfa / 60) : 0;
  const far = hasPlacedMass && plotSize > 0 ? gfa / plotSize : 0;

  // Zoning check thresholds (informative guidelines)
  const isFarWarning = far > 8.0;
  const isHighRise = floors >= 12;

  const contentBody = (
    <div className={inline ? "space-y-3" : "flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar"}>
      {/* Tool Active status or hint */}
      {selectedMassingId ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Editing Selected Model</span>
            <span>Modifying target floors or zoning will update this 3D massing layer in real time.</span>
          </div>
          <button
            type="button"
            onClick={onFlyToMassing}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors cursor-pointer border-0 bg-transparent"
            title="Fly to extruded building"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      ) : !hasPlacedMass ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">No Polygon Placed</span>
            {activeTool === 'parametric-massing' ? (
              <span>Click on the 3D globe to place vertices. Right-click to close boundary and extrude the 3D mass.</span>
            ) : (
              <span>Click "Draw Conceptual Massing Polygon" above to draw a boundary on the terrain.</span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Massing Model Rendered</span>
            <span>Extruded volumetric mass is active. Zoom or fly to study height and local shadows.</span>
          </div>
          <button
            type="button"
            onClick={onFlyToMassing}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors cursor-pointer border-0 bg-transparent"
            title="Fly to extruded building"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inputs & Sliders */}
      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3.5 space-y-4">
        {/* Storeys / Target Floors Input & Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Target Floors
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="200"
                step="1"
                value={floors}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onFloorsChange(isNaN(val) ? 1 : Math.max(1, val));
                }}
                className="w-16 bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-xs text-amber-400 font-bold font-mono text-right focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-400 font-mono">Flrs</span>
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={floors}
            onChange={(e) => onFloorsChange(parseInt(e.target.value) || 1)}
            className="w-full accent-amber-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>1 Flr</span>
            <span>Total Ht: {(floors * floorHeight).toFixed(1)}m</span>
            <span>50 Flrs</span>
          </div>
        </div>

        {/* Target Floor Height Input & Slider */}
        <div className="space-y-1.5 border-t border-white/5 pt-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              Target Floor Height
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1.0"
                max="20.0"
                step="0.1"
                value={floorHeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onFloorHeightChange?.(isNaN(val) ? 3.5 : Math.max(0.5, val));
                }}
                className="w-16 bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-xs text-amber-400 font-bold font-mono text-right focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-400 font-mono">m</span>
            </div>
          </div>
          <input
            type="range"
            min="2.0"
            max="10.0"
            step="0.1"
            value={floorHeight}
            onChange={(e) => onFloorHeightChange?.(parseFloat(e.target.value) || 3.5)}
            className="w-full accent-amber-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>2.0m</span>
            <span>Storey Step</span>
            <span>10.0m</span>
          </div>
        </div>

        {/* Transparency / Opacity Slider */}
        <div className="space-y-1.5 border-t border-white/5 pt-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              Transparency
            </span>
            <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
              {Math.round((1 - massingOpacity) * 100)}% ({Math.round(massingOpacity * 100)}% Opacity)
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={massingOpacity}
            onChange={(e) => onMassingOpacityChange?.(parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-slate-950 h-1 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>90% Clear</span>
            <span>30% Transp</span>
            <span>Opaque</span>
          </div>
        </div>

        {/* Plot Size Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
              Zoning Plot Size
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              m²
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="100"
              max="100000"
              step="100"
              value={plotSize}
              onChange={(e) => onPlotSizeChange(Math.max(100, parseInt(e.target.value) || 0))}
              className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white text-right font-mono focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onPlotSizeChange(2000)}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md text-[9px] font-mono cursor-pointer border-0"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Building Zone & Color Picker */}
        <div className="space-y-1.5 border-t border-white/5 pt-3.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <span className="text-xs">🎨</span>
              Zoning Color Picker
            </span>
            <span 
              className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono"
              style={{ 
                backgroundColor: `${massingColor}20`, 
                color: massingColor,
                border: `1px solid ${massingColor}40`
              }}
            >
              {ZONING_PRESETS.find(z => z.color.toLowerCase() === massingColor.toLowerCase())?.label || 'Custom'}
            </span>
          </div>

          {/* Grid of presets */}
          <div className="grid grid-cols-3 gap-1.5">
            {ZONING_PRESETS.map((preset) => {
              const isSelected = massingColor.toLowerCase() === preset.color.toLowerCase();
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onMassingColorChange(preset.color)}
                  className={`py-1 px-1.5 rounded-lg border text-[9px] font-medium flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/10 border-white/30 text-white shadow'
                      : 'bg-slate-950/40 border-transparent text-slate-400 hover:bg-slate-950/60 hover:text-slate-200'
                  }`}
                  title={preset.description}
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full border border-white/10 shadow-sm" 
                    style={{ backgroundColor: preset.color }}
                  />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Color Picker Input */}
          <div className="flex items-center gap-2 mt-2 bg-slate-950/40 p-1.5 rounded-lg border border-white/5">
            <div className="relative w-7 h-7 rounded-md overflow-hidden border border-white/10 flex-shrink-0">
              <input
                type="color"
                value={massingColor}
                onChange={(e) => onMassingColorChange(e.target.value)}
                className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer opacity-100 bg-transparent"
                title="Choose custom color"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-slate-500 block font-mono">Custom Hex</span>
              <input
                type="text"
                value={massingColor.toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('#') && val.length <= 7) {
                    onMassingColorChange(val);
                  } else if (!val.startsWith('#') && val.length <= 6) {
                    onMassingColorChange('#' + val);
                  }
                }}
                placeholder="#FFFFFF"
                className="w-full bg-transparent border-0 p-0 text-[10px] text-slate-300 font-mono focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Levels Outline Color Picker */}
        <div className="space-y-1.5 border-t border-white/5 pt-3.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <span className="text-xs">📐</span>
              Levels Outline Color
            </span>
            <span 
              className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono"
              style={{ 
                backgroundColor: `${levelColor}20`, 
                color: levelColor,
                border: `1px solid ${levelColor}40`
              }}
            >
              {levelColor.toUpperCase()}
            </span>
          </div>

          {/* Grid of level outline color presets */}
          <div className="grid grid-cols-5 gap-1">
            {[
              { label: 'Grey', color: '#808080' },
              { label: 'Slate', color: '#475569' },
              { label: 'White', color: '#ffffff' },
              { label: 'Gold', color: '#f59e0b' },
              { label: 'Cyan', color: '#06b6d4' },
            ].map((preset) => {
              const isSelected = levelColor.toLowerCase() === preset.color.toLowerCase();
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onLevelColorChange?.(preset.color)}
                  className={`py-1 px-1 rounded-md border text-[9px] font-medium flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/10 border-white/30 text-white shadow'
                      : 'bg-slate-950/40 border-transparent text-slate-400 hover:bg-slate-950/60 hover:text-slate-200'
                  }`}
                  title={`Set outline color to ${preset.label}`}
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full border border-white/10 shadow-sm" 
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="text-[8px]">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Level Outline Color Picker Input */}
          <div className="flex items-center gap-2 mt-1.5 bg-slate-950/40 p-1.5 rounded-lg border border-white/5">
            <div className="relative w-7 h-7 rounded-md overflow-hidden border border-white/10 flex-shrink-0">
              <input
                type="color"
                value={levelColor}
                onChange={(e) => onLevelColorChange?.(e.target.value)}
                className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer opacity-100 bg-transparent"
                title="Choose custom level outline color"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-slate-500 block font-mono">Outline Hex</span>
              <input
                type="text"
                value={levelColor.toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('#') && val.length <= 7) {
                    onLevelColorChange?.(val);
                  } else if (!val.startsWith('#') && val.length <= 6) {
                    onLevelColorChange?.('#' + val);
                  }
                }}
                placeholder="#808080"
                className="w-full bg-transparent border-0 p-0 text-[10px] text-slate-300 font-mono focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Display & History Settings */}
      <div className="flex items-center justify-between bg-slate-900/40 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-300">
        {/* Show Labels Toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => onShowLabelsChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 accent-amber-500 cursor-pointer"
          />
          <span className="font-medium text-[11px] text-slate-300">Show Labels in 3D</span>
        </label>

        {/* Undo Button */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold font-mono flex items-center gap-1 transition-all ${
            canUndo
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer'
              : 'bg-slate-950/20 text-slate-600 cursor-not-allowed border border-white/5'
          }`}
          title="Undo last created massing layer"
        >
          ↩ Undo
        </button>
      </div>

      {/* Real-time Analytics Dashboard */}
      <div className="space-y-2.5">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block font-semibold">
          Live Analytics Metrics
        </span>

        <div className="grid grid-cols-1 gap-2">
          {/* Metric 1: Footprint Area */}
          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-w-0">
            <div className="flex justify-between items-start gap-2 min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-medium truncate">
                Footprint
              </span>
              <span className="text-[9px] text-slate-500 font-mono shrink-0">m² surface area</span>
            </div>
            <span className="text-lg font-bold text-slate-100 font-mono block mt-1 tracking-tight break-all">
              {hasPlacedMass ? `${baseArea.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : '—'}
            </span>
          </div>

          {/* Metric 2: GFA */}
          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-w-0">
            <div className="flex justify-between items-start gap-2 min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-medium truncate">
                Gross GFA
              </span>
              <span className="text-[9px] text-slate-500 font-mono shrink-0">m² total space</span>
            </div>
            <span className="text-lg font-bold text-amber-400 font-mono block mt-1 tracking-tight break-all">
              {hasPlacedMass ? `${gfa.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : '—'}
            </span>
          </div>

          {/* Metric 3: Parking Spaces */}
          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-w-0">
            <div className="flex justify-between items-start gap-2 min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-medium truncate flex items-center gap-1">
                <Car className="w-3 h-3 text-blue-400 shrink-0" />
                Parking Req
              </span>
              <span className="text-[9px] text-slate-500 font-mono shrink-0">1 bay / 60m² GFA</span>
            </div>
            <span className="text-lg font-bold text-slate-100 font-mono block mt-1 tracking-tight break-all">
              {hasPlacedMass ? `${parkingSpaces}` : '—'}
            </span>
          </div>

          {/* Metric 4: FAR Indicator */}
          <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-w-0 relative overflow-hidden">
            <div className="flex justify-between items-start gap-2 min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-medium truncate">
                FAR Floor Ratio
              </span>
              <span className="text-[9px] text-slate-500 font-mono shrink-0">ratio of plot</span>
            </div>
            <span className={`text-lg font-bold font-mono block mt-1 tracking-tight break-all ${isFarWarning ? 'text-red-400' : 'text-emerald-400'}`}>
              {hasPlacedMass ? `${far.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings and Info Badges */}
      <div className="space-y-2">
        {isFarWarning && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-2.5 text-[11px] flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Excessive FAR Warning:</strong> Current FAR of {far.toFixed(1)} exceeds maximum standard zoning density of 8.0. Reduce floors or increase plot size.
            </span>
          </div>
        )}
        {isHighRise && (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl p-2.5 text-[11px] flex gap-2">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
            <span>
              <strong>High-Rise Class:</strong> At {floors} storeys, building triggers high-rise physical safety and solar shadow compliance audits.
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div
        id="panel-parametric-massing"
        className="p-3.5 bg-slate-900 border border-amber-500/80 ring-2 ring-amber-500/30 bg-amber-950/20 rounded-xl space-y-3 text-left shadow-inner shadow-amber-500/10 transition-all text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-amber-500/20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-amber-500/20 border border-amber-400/30 rounded-lg text-amber-400 flex-shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono truncate">
                {selectedCount > 1 ? `Selected (${selectedCount} Massings)` : selectedMassingId ? 'Selected Massing' : 'Parametric Massing Parameters'}
              </h3>
              <p className="text-[10px] text-slate-400 truncate">
                {selectedCount > 1 ? 'Multi-Selection Active (CTRL+Click)' : selectedMassingName || 'Volumetric GIS Modeling Engine'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(selectedMassingId || selectedCount > 0) && (
              <>
                <button
                  type="button"
                  onClick={() => onDeselectMassing?.()}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-mono font-semibold text-slate-300 transition-colors border-0 cursor-pointer"
                  title="Deselect active selection"
                >
                  Deselect
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSelectedMassing?.(selectedMassingId || '')}
                  className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border-0 cursor-pointer flex items-center gap-1 px-2"
                  title="Delete selected massing layers"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {selectedCount > 1 && <span className="text-[10px] font-bold font-mono">{selectedCount}</span>}
                </button>
              </>
            )}
          </div>
        </div>

        {contentBody}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        id="parametric-massing-overlay-panel"
        className={`fixed z-40 transition-all duration-300 flex flex-col bg-slate-900/90 backdrop-blur-md rounded-xl border border-amber-500/30 shadow-2xl overflow-hidden
          ${isSidebarExpanded ? 'left-[340px]' : 'left-20'} 
          top-28 bottom-14 w-80 md:w-96 max-h-[calc(100vh-11rem)] text-white`}
      >
        {/* Pinned Header */}
        <div className="flex-shrink-0 p-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 border border-amber-400/30 rounded-lg text-amber-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
                {selectedCount > 1 ? `Selected (${selectedCount} Massings)` : selectedMassingId ? 'Selected Massing' : 'Parametric Massing'}
              </h3>
              <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                {selectedCount > 1 ? 'Multi-Selection Active (CTRL+Click)' : selectedMassingName || 'Volumetric GIS Modeling Engine'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(selectedMassingId || selectedCount > 0) && (
              <>
                <button
                  type="button"
                  onClick={() => onDeselectMassing?.()}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-mono font-semibold text-slate-300 transition-colors border-0 cursor-pointer"
                  title="Deselect active selection"
                >
                  Deselect
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSelectedMassing?.(selectedMassingId || '')}
                  className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border-0 cursor-pointer flex items-center gap-1 px-2"
                  title="Delete selected massing layers"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {selectedCount > 1 && <span className="text-[10px] font-bold font-mono">{selectedCount}</span>}
                </button>
              </>
            )}
          </div>
        </div>

        {contentBody}
      </motion.div>
    </AnimatePresence>
  );
}
