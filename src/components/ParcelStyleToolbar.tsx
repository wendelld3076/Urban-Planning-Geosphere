import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  X, 
  Eye, 
  Sliders, 
  Check, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Type
} from 'lucide-react';
import { GisLayer, ShapefileData, ParcelStyleConfig } from '../types';
import { updateParcelStyles, applyAttributeFilter, DEFAULT_PARCEL_STYLE } from '../services/ImportParcelService';
import { ShapefileFilter } from './ShapefileFilter';

export interface ParcelStyleToolbarProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeLayer?: GisLayer | null;
  shapefileData?: ShapefileData | null;
  shapefileName?: string | null;
  allLayers?: GisLayer[];
  onSelectLayer?: (layerId: string) => void;
  onUpdateLayerStyle?: (layerId: string, style: Partial<ParcelStyleConfig>) => void;
  sidebarTheme?: 'light' | 'dark';
  embedded?: boolean;
}

const FILL_COLOR_PRESETS = [
  { name: 'Sky Blue', hex: '#3B82F6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Slate', hex: '#64748B' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Orange', hex: '#FB923C' }
];

const STROKE_COLOR_PRESETS = [
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Bright Yellow', hex: '#FACC15' },
  { name: 'Neon Cyan', hex: '#06B6D4' },
  { name: 'Neon Lime', hex: '#4ADE80' },
  { name: 'Hot Pink', hex: '#F43F5E' },
  { name: 'Obsidian', hex: '#0F172A' }
];

const LABEL_COLOR_PRESETS = [
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Bright Yellow', hex: '#FACC15' },
  { name: 'Neon Lime', hex: '#4ADE80' },
  { name: 'Neon Cyan', hex: '#06B6D4' },
  { name: 'Sky Blue', hex: '#38BDF8' },
  { name: 'Amber Gold', hex: '#F59E0B' },
  { name: 'Hot Coral', hex: '#F43F5E' },
  { name: 'Deep Obsidian', hex: '#0F172A' }
];

export function ParcelStyleToolbar({
  isOpen = true,
  onClose,
  activeLayer,
  shapefileData,
  shapefileName,
  allLayers = [],
  onSelectLayer,
  onUpdateLayerStyle,
  sidebarTheme = 'dark',
  embedded = false
}: ParcelStyleToolbarProps) {
  const isLight = sidebarTheme === 'light';

  // Extract source data: either from activeLayer or standalone shapefileData
  const currentShapefileData = activeLayer?.shapefileData || shapefileData;
  const currentFeatures = currentShapefileData?.features || [];
  const currentFields = currentShapefileData?.allFields || currentShapefileData?.fields || [];
  const currentName = activeLayer?.name || shapefileName || 'Imported Parcels';
  const layerId = activeLayer?.id;

  // Local style state initialized from activeLayer or defaults
  const [showFill, setShowFill] = useState<boolean>(
    activeLayer?.showFill !== undefined ? activeLayer.showFill : DEFAULT_PARCEL_STYLE.showFill
  );
  const [fillColor, setFillColor] = useState<string>(
    activeLayer?.fillColor || activeLayer?.customColor || DEFAULT_PARCEL_STYLE.fillColor
  );
  const [fillOpacity, setFillOpacity] = useState<number>(
    activeLayer?.fillOpacity !== undefined 
      ? activeLayer.fillOpacity 
      : (activeLayer?.opacity !== undefined ? activeLayer.opacity : DEFAULT_PARCEL_STYLE.fillOpacity)
  );
  const [strokeColor, setStrokeColor] = useState<string>(
    activeLayer?.strokeColor || DEFAULT_PARCEL_STYLE.strokeColor
  );
  const [strokeWidth, setStrokeWidth] = useState<number>(
    activeLayer?.strokeWidth !== undefined ? activeLayer.strokeWidth : DEFAULT_PARCEL_STYLE.strokeWidth
  );
  const [showBorder, setShowBorder] = useState<boolean>(
    activeLayer?.showBorder !== undefined 
      ? activeLayer.showBorder 
      : (activeLayer?.showStroke !== undefined ? activeLayer.showStroke : (DEFAULT_PARCEL_STYLE.showBorder ?? true))
  );
  const [borderOpacity, setBorderOpacity] = useState<number>(
    activeLayer?.borderOpacity !== undefined 
      ? activeLayer.borderOpacity 
      : (activeLayer?.strokeOpacity !== undefined ? activeLayer.strokeOpacity : (DEFAULT_PARCEL_STYLE.borderOpacity ?? 1.0))
  );

  // Filter state
  const [selectedField, setSelectedField] = useState<string>(
    activeLayer?.filterField || ''
  );
  const [selectedTarget, setSelectedTarget] = useState<string>(
    activeLayer?.filterValue || 'ALL'
  );
  const [filterStats, setFilterStats] = useState<{ matchedCount: number; totalCount: number }>({
    matchedCount: currentFeatures.length,
    totalCount: currentFeatures.length
  });

  // 3D Attribute Label state
  const [showLabel, setShowLabel] = useState<boolean>(
    activeLayer?.showLabel !== undefined ? activeLayer.showLabel : (DEFAULT_PARCEL_STYLE.showLabel || false)
  );
  const [labelField, setLabelField] = useState<string>(
    activeLayer?.labelField || ''
  );
  const [labelFontHeight, setLabelFontHeight] = useState<number>(
    activeLayer?.labelFontHeight !== undefined ? activeLayer.labelFontHeight : 14
  );
  const [labelFontStyle, setLabelFontStyle] = useState<'normal' | 'bold' | 'italic' | 'bold italic'>(
    activeLayer?.labelFontStyle || 'bold'
  );
  const [labelFontFamily, setLabelFontFamily] = useState<string>(
    activeLayer?.labelFontFamily || 'sans-serif'
  );
  const [labelFontColor, setLabelFontColor] = useState<string>(
    activeLayer?.labelFontColor || '#FFFFFF'
  );
  const [labelOutlineColor, setLabelOutlineColor] = useState<string>(
    activeLayer?.labelOutlineColor || '#000000'
  );
  const [labelOutlineWidth, setLabelOutlineWidth] = useState<number>(
    activeLayer?.labelOutlineWidth !== undefined ? activeLayer.labelOutlineWidth : 2.5
  );
  const [labelElevationOffset, setLabelElevationOffset] = useState<number>(
    activeLayer?.labelElevationOffset !== undefined ? activeLayer.labelElevationOffset : 5
  );

  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Sync state when activeLayer ID changes (switching layers)
  useEffect(() => {
    if (activeLayer) {
      if (activeLayer.showFill !== undefined) setShowFill(activeLayer.showFill);
      if (activeLayer.fillColor) setFillColor(activeLayer.fillColor);
      if (activeLayer.fillOpacity !== undefined) setFillOpacity(activeLayer.fillOpacity);
      if (activeLayer.strokeColor) setStrokeColor(activeLayer.strokeColor);
      if (activeLayer.strokeWidth !== undefined) setStrokeWidth(activeLayer.strokeWidth);
      if (activeLayer.showBorder !== undefined) setShowBorder(activeLayer.showBorder);
      else if (activeLayer.showStroke !== undefined) setShowBorder(activeLayer.showStroke);
      if (activeLayer.borderOpacity !== undefined) setBorderOpacity(activeLayer.borderOpacity);
      else if (activeLayer.strokeOpacity !== undefined) setBorderOpacity(activeLayer.strokeOpacity);
      if (activeLayer.filterField !== undefined) setSelectedField(activeLayer.filterField);
      if (activeLayer.filterValue !== undefined) setSelectedTarget(activeLayer.filterValue);

      // Labels
      if (activeLayer.showLabel !== undefined) setShowLabel(activeLayer.showLabel);
      if (activeLayer.labelField !== undefined) setLabelField(activeLayer.labelField);
      if (activeLayer.labelFontHeight !== undefined) setLabelFontHeight(activeLayer.labelFontHeight);
      if (activeLayer.labelFontStyle !== undefined) setLabelFontStyle(activeLayer.labelFontStyle);
      if (activeLayer.labelFontFamily !== undefined) setLabelFontFamily(activeLayer.labelFontFamily);
      if (activeLayer.labelFontColor) setLabelFontColor(activeLayer.labelFontColor);
      if (activeLayer.labelOutlineColor) setLabelOutlineColor(activeLayer.labelOutlineColor);
      if (activeLayer.labelOutlineWidth !== undefined) setLabelOutlineWidth(activeLayer.labelOutlineWidth);
      if (activeLayer.labelElevationOffset !== undefined) setLabelElevationOffset(activeLayer.labelElevationOffset);
    }
  }, [activeLayer?.id]);

  // Sync filter stats when layer ID changes
  useEffect(() => {
    const viewer = (window as any).cesiumViewer;
    if (viewer) {
      const stats = applyAttributeFilter(viewer, selectedField, selectedTarget, layerId);
      setFilterStats(stats);
    }
  }, [layerId]);

  // Helper to apply style updates to Cesium and notify parent
  const applyStyles = (updated: Partial<ParcelStyleConfig>) => {
    const nextStyle: ParcelStyleConfig = {
      showFill: updated.showFill !== undefined ? updated.showFill : showFill,
      fillColor: updated.fillColor !== undefined ? updated.fillColor : fillColor,
      fillOpacity: updated.fillOpacity !== undefined ? updated.fillOpacity : fillOpacity,
      strokeColor: updated.strokeColor !== undefined ? updated.strokeColor : strokeColor,
      strokeWidth: updated.strokeWidth !== undefined ? updated.strokeWidth : strokeWidth,
      showBorder: updated.showBorder !== undefined ? updated.showBorder : showBorder,
      borderOpacity: updated.borderOpacity !== undefined ? updated.borderOpacity : borderOpacity,
      filterField: updated.filterField !== undefined ? updated.filterField : selectedField,
      filterValue: updated.filterValue !== undefined ? updated.filterValue : selectedTarget,

      showLabel: updated.showLabel !== undefined ? updated.showLabel : showLabel,
      labelField: updated.labelField !== undefined ? updated.labelField : (labelField || selectedField),
      labelFontHeight: updated.labelFontHeight !== undefined ? updated.labelFontHeight : labelFontHeight,
      labelFontStyle: updated.labelFontStyle !== undefined ? updated.labelFontStyle : labelFontStyle,
      labelFontFamily: updated.labelFontFamily !== undefined ? updated.labelFontFamily : labelFontFamily,
      labelFontColor: updated.labelFontColor !== undefined ? updated.labelFontColor : labelFontColor,
      labelOutlineColor: updated.labelOutlineColor !== undefined ? updated.labelOutlineColor : labelOutlineColor,
      labelOutlineWidth: updated.labelOutlineWidth !== undefined ? updated.labelOutlineWidth : labelOutlineWidth,
      labelElevationOffset: updated.labelElevationOffset !== undefined ? updated.labelElevationOffset : labelElevationOffset,
    };
    const viewer = (window as any).cesiumViewer;
    if (viewer) {
      updateParcelStyles(viewer, nextStyle, layerId);
    }
    if (layerId && onUpdateLayerStyle) {
      onUpdateLayerStyle(layerId, nextStyle);
    }
  };

  const handleShowFillChange = (val: boolean) => {
    setShowFill(val);
    applyStyles({ showFill: val });
  };

  const handleFillColorChange = (val: string) => {
    setFillColor(val);
    applyStyles({ fillColor: val });
  };

  const handleFillOpacityChange = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setFillOpacity(clamped);
    applyStyles({ fillOpacity: clamped });
  };

  const handleStrokeColorChange = (val: string) => {
    setStrokeColor(val);
    applyStyles({ strokeColor: val });
  };

  const handleStrokeWidthChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(20, val));
    setStrokeWidth(clamped);
    applyStyles({ strokeWidth: clamped });
  };

  const handleShowBorderChange = (val: boolean) => {
    setShowBorder(val);
    applyStyles({ showBorder: val });
  };

  const handleBorderOpacityChange = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setBorderOpacity(clamped);
    applyStyles({ borderOpacity: clamped });
  };

  // Label handlers
  const handleShowLabelChange = (val: boolean) => {
    setShowLabel(val);
    applyStyles({ showLabel: val });
  };

  const handleLabelFieldChange = (field: string) => {
    setLabelField(field);
    applyStyles({ labelField: field || selectedField });
  };

  const handleLabelFontHeightChange = (height: number) => {
    const clamped = Math.max(6, Math.min(72, height));
    setLabelFontHeight(clamped);
    applyStyles({ labelFontHeight: clamped });
  };

  const handleLabelFontStyleChange = (style: 'normal' | 'bold' | 'italic' | 'bold italic') => {
    setLabelFontStyle(style);
    applyStyles({ labelFontStyle: style });
  };

  const handleLabelFontFamilyChange = (family: string) => {
    setLabelFontFamily(family);
    applyStyles({ labelFontFamily: family });
  };

  const handleLabelFontColorChange = (color: string) => {
    setLabelFontColor(color);
    applyStyles({ labelFontColor: color });
  };

  const handleLabelOutlineColorChange = (color: string) => {
    setLabelOutlineColor(color);
    applyStyles({ labelOutlineColor: color });
  };

  const handleLabelOutlineWidthChange = (width: number) => {
    const clamped = Math.max(0, Math.min(10, width));
    setLabelOutlineWidth(clamped);
    applyStyles({ labelOutlineWidth: clamped });
  };

  const handleLabelElevationOffsetChange = (offset: number) => {
    const clamped = Math.max(0, Math.min(500, offset));
    setLabelElevationOffset(clamped);
    applyStyles({ labelElevationOffset: clamped });
  };

  const handleSelectField = (field: string) => {
    setSelectedField(field);
    setSelectedTarget('ALL');
    const viewer = (window as any).cesiumViewer;
    if (viewer) {
      const stats = applyAttributeFilter(viewer, field, 'ALL', layerId);
      setFilterStats(stats);
    }
    // Whatever filtered attribute is selected, if label is enabled or using auto filter, update label
    const effectiveLabelField = (!labelField || labelField === selectedField) ? field : labelField;
    applyStyles({
      filterField: field,
      filterValue: 'ALL',
      labelField: effectiveLabelField
    });
  };

  const handleSelectTarget = (target: string) => {
    setSelectedTarget(target);
    const viewer = (window as any).cesiumViewer;
    if (viewer) {
      const stats = applyAttributeFilter(viewer, selectedField, target, layerId);
      setFilterStats(stats);
    }
    if (layerId && onUpdateLayerStyle) {
      onUpdateLayerStyle(layerId, { filterField: selectedField, filterValue: target });
    }
  };

  const handleClearFilter = () => {
    setSelectedField('');
    setSelectedTarget('ALL');
    const viewer = (window as any).cesiumViewer;
    if (viewer) {
      const stats = applyAttributeFilter(viewer, '', 'ALL', layerId);
      setFilterStats(stats);
    }
    if (layerId && onUpdateLayerStyle) {
      onUpdateLayerStyle(layerId, { filterField: '', filterValue: 'ALL' });
    }
  };

  // Reset to default styling
  const handleResetDefaults = () => {
    setShowFill(DEFAULT_PARCEL_STYLE.showFill);
    setFillColor(DEFAULT_PARCEL_STYLE.fillColor);
    setFillOpacity(DEFAULT_PARCEL_STYLE.fillOpacity);
    setStrokeColor(DEFAULT_PARCEL_STYLE.strokeColor);
    setStrokeWidth(DEFAULT_PARCEL_STYLE.strokeWidth);
    setShowBorder(DEFAULT_PARCEL_STYLE.showBorder ?? true);
    setBorderOpacity(DEFAULT_PARCEL_STYLE.borderOpacity ?? 1.0);
    setSelectedField('');
    setSelectedTarget('ALL');

    // Reset labels
    setShowLabel(false);
    setLabelField('');
    setLabelFontHeight(14);
    setLabelFontStyle('bold');
    setLabelFontFamily('sans-serif');
    setLabelFontColor('#FFFFFF');
    setLabelOutlineColor('#000000');
    setLabelOutlineWidth(2.5);
    setLabelElevationOffset(5);

    const viewer = (window as any).cesiumViewer;
    if (viewer) {
      updateParcelStyles(viewer, DEFAULT_PARCEL_STYLE, layerId);
      const stats = applyAttributeFilter(viewer, '', 'ALL', layerId);
      setFilterStats(stats);
    }
    if (layerId && onUpdateLayerStyle) {
      onUpdateLayerStyle(layerId, {
        ...DEFAULT_PARCEL_STYLE,
        filterField: '',
        filterValue: 'ALL'
      });
    }
  };

  if (!isOpen && !embedded) return null;

  const bodyContent = (
    <div className={`space-y-4 text-xs ${embedded ? '' : 'p-4 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar'}`}>
      {/* Multi-Layer Selector if multiple layers exist */}
      {allLayers.length > 1 && onSelectLayer && (
        <div className={`p-3 rounded-xl border space-y-1.5 ${
          isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
        }`}>
          <label className={`block text-[10px] font-mono uppercase tracking-wider ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            Active Shapefile / GIS Layer
          </label>
          <select
            value={activeLayer?.id || ''}
            onChange={(e) => onSelectLayer(e.target.value)}
            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium ${
              isLight 
                ? 'bg-white border-slate-300 text-slate-800' 
                : 'bg-slate-950 border-slate-700 text-slate-200'
            }`}
          >
            {allLayers.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* SECTION 1: POLYGON FILL STYLING */}
      <div className={`p-3 rounded-xl border space-y-3 ${
        isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
      }`}>
        {/* Fill Toggle Checkbox */}
        <div className="flex items-center justify-between">
          <label 
            htmlFor="parcel-show-fill-checkbox" 
            className="flex items-center gap-2 cursor-pointer select-none font-semibold text-xs"
          >
            <input
              id="parcel-show-fill-checkbox"
              type="checkbox"
              checked={showFill}
              onChange={(e) => handleShowFillChange(e.target.checked)}
              className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-sky-500 cursor-pointer"
            />
            <span>Show Fill</span>
          </label>

          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            showFill 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {showFill ? 'Fill Enabled' : 'Outline Only'}
          </span>
        </div>

        {/* Fill Color Picker & Presets */}
        {showFill && (
          <div className="space-y-2.5 pt-1 border-t border-slate-800/40">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-mono uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Fill Color
              </span>
              <div className="flex items-center gap-2">
                <input
                  id="parcel-fill-color-picker"
                  type="color"
                  value={fillColor}
                  onChange={(e) => handleFillColorChange(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 p-0.5 cursor-pointer bg-transparent"
                  title="Choose custom fill color"
                />
                <span className="font-mono text-[11px] font-bold text-sky-400">
                  {fillColor.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Fill Color Preset Swatches */}
            <div className="flex flex-wrap gap-1.5">
              {FILL_COLOR_PRESETS.map(preset => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleFillColorChange(preset.hex)}
                  className={`w-6 h-6 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
                    fillColor.toLowerCase() === preset.hex.toLowerCase()
                      ? 'border-white ring-2 ring-sky-500 scale-110'
                      : 'border-black/30 hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.name}
                >
                  {fillColor.toLowerCase() === preset.hex.toLowerCase() && (
                    <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>

            {/* Fill Opacity Slider with Keyboard Editable Number */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Fill Opacity
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    id="parcel-fill-opacity-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(fillOpacity * 100)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleFillOpacityChange(Math.max(0, Math.min(100, val)) / 100);
                      }
                    }}
                    className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500' 
                        : 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                    title="Type opacity percentage (0 - 100)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">%</span>
                </div>
              </div>
              <input
                id="parcel-fill-opacity-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fillOpacity}
                onChange={(e) => handleFillOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: BORDER STROKE & GROUND POLYLINE STYLING */}
      <div className={`p-3 rounded-xl border space-y-3 ${
        isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
      }`}>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs">
            <input
              id="parcel-show-border-toggle"
              type="checkbox"
              checked={showBorder}
              onChange={(e) => handleShowBorderChange(e.target.checked)}
              className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-sky-500 cursor-pointer"
            />
            <span>Show Border</span>
          </label>

          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            showBorder 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {showBorder ? 'Border Enabled' : 'No Border'}
          </span>
        </div>

        {showBorder && (
          <div className="space-y-2.5 pt-1 border-t border-slate-800/40">
            {/* Stroke Color Picker */}
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-mono uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Stroke Color
              </span>
              <div className="flex items-center gap-2">
                <input
                  id="parcel-stroke-color-picker"
                  type="color"
                  value={strokeColor}
                  onChange={(e) => handleStrokeColorChange(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 p-0.5 cursor-pointer bg-transparent"
                  title="Choose border stroke color"
                />
                <span className="font-mono text-[11px] font-bold text-sky-400">
                  {strokeColor.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Stroke Color Presets */}
            <div className="flex flex-wrap gap-1.5">
              {STROKE_COLOR_PRESETS.map(preset => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleStrokeColorChange(preset.hex)}
                  className={`w-6 h-6 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
                    strokeColor.toLowerCase() === preset.hex.toLowerCase()
                      ? 'border-sky-400 ring-2 ring-sky-500 scale-110'
                      : 'border-slate-700 hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.name}
                >
                  {strokeColor.toLowerCase() === preset.hex.toLowerCase() && (
                    <Check className={`w-3.5 h-3.5 ${preset.hex === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                  )}
                </button>
              ))}
            </div>

            {/* Stroke Width Slider with Keyboard Editable Number */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Stroke Width
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    id="parcel-stroke-width-input"
                    type="number"
                    min="0.5"
                    max="20"
                    step="0.5"
                    value={strokeWidth}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleStrokeWidthChange(Math.max(0.5, Math.min(20, val)));
                      }
                    }}
                    className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500' 
                        : 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                    title="Type stroke width in pixels (0.5 - 20)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">px</span>
                </div>
              </div>
              <input
                id="parcel-stroke-width-slider"
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={strokeWidth}
                onChange={(e) => handleStrokeWidthChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                <span>0.5 px</span>
                <span>5.0 px</span>
                <span>10.0 px</span>
              </div>
            </div>

            {/* Border Opacity Slider with Keyboard Editable Number */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Border Opacity
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    id="parcel-border-opacity-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(borderOpacity * 100)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleBorderOpacityChange(Math.max(0, Math.min(100, val)) / 100);
                      }
                    }}
                    className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500' 
                        : 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                    title="Type border opacity percentage (0 - 100)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">%</span>
                </div>
              </div>
              <input
                id="parcel-border-opacity-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={borderOpacity}
                onChange={(e) => handleBorderOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                <span>0% (Transparent)</span>
                <span>50%</span>
                <span>100% (Solid)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: ATTRIBUTE QUERY & VISIBILITY FILTER */}
      <div className={`p-3 rounded-xl border ${
        isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
      }`}>
        <ShapefileFilter
          features={currentFeatures}
          allFields={currentFields}
          selectedField={selectedField}
          onSelectField={handleSelectField}
          selectedTarget={selectedTarget}
          onSelectTarget={handleSelectTarget}
          matchedCount={filterStats.matchedCount}
          totalCount={filterStats.totalCount}
          onClearFilter={handleClearFilter}
          sidebarTheme={sidebarTheme}
        />
      </div>

      {/* SECTION 4: 3D ATTRIBUTE LABEL STYLING */}
      <div className={`p-3 rounded-xl border space-y-3 ${
        isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
      }`}>
        {/* Label Toggle */}
        <div className="flex items-center justify-between">
          <label 
            htmlFor="parcel-show-label-checkbox" 
            className="flex items-center gap-2 cursor-pointer select-none font-semibold text-xs"
          >
            <input
              id="parcel-show-label-checkbox"
              type="checkbox"
              checked={showLabel}
              onChange={(e) => handleShowLabelChange(e.target.checked)}
              className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-sky-500 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-sky-400" />
              <span>3D Attribute Labels</span>
            </span>
          </label>

          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            showLabel 
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {showLabel ? 'Active' : 'Disabled'}
          </span>
        </div>

        {showLabel && (
          <div className="space-y-3 pt-1 border-t border-slate-800/40">
            {/* Attribute Field Source */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Label Attribute Source
                </span>
                {selectedField && (
                  <span className="text-[10px] text-sky-400 font-bold truncate max-w-[120px]" title={selectedField}>
                    Filtered: {selectedField}
                  </span>
                )}
              </div>
              <select
                id="parcel-label-field-select"
                value={labelField}
                onChange={(e) => handleLabelFieldChange(e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono font-medium ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                <option value="">Auto: Follow Filtered Attribute ({selectedField || 'None Selected'})</option>
                {currentFields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 leading-tight">
                Whatever filtered attribute is selected, its value will float directly above each polygon in 3D.
              </p>
            </div>

            {/* Font Height / Size with typing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Font Height (Size)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    id="parcel-label-font-height-input"
                    type="number"
                    min="6"
                    max="72"
                    step="1"
                    value={labelFontHeight}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        handleLabelFontHeightChange(Math.max(6, Math.min(72, val)));
                      }
                    }}
                    className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500' 
                        : 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                    title="Type font height in pixels (6 - 72)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">px</span>
                </div>
              </div>
              <input
                id="parcel-label-font-height-slider"
                type="range"
                min="8"
                max="48"
                step="1"
                value={labelFontHeight}
                onChange={(e) => handleLabelFontHeightChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                <span>8 px</span>
                <span>24 px</span>
                <span>48 px</span>
              </div>
            </div>

            {/* Font Style & Family */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className={`block text-[10px] font-mono uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Font Style
                </span>
                <select
                  id="parcel-label-font-style-select"
                  value={labelFontStyle}
                  onChange={(e) => handleLabelFontStyleChange(e.target.value as any)}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <option value="bold">Bold</option>
                  <option value="normal">Regular</option>
                  <option value="italic">Italic</option>
                  <option value="bold italic">Bold Italic</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className={`block text-[10px] font-mono uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Font Family
                </span>
                <select
                  id="parcel-label-font-family-select"
                  value={labelFontFamily}
                  onChange={(e) => handleLabelFontFamilyChange(e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <option value="sans-serif">Sans-Serif</option>
                  <option value="monospace">Monospace</option>
                  <option value="serif">Serif</option>
                  <option value="Arial">Arial</option>
                  <option value="Roboto">Roboto</option>
                </select>
              </div>
            </div>

            {/* Font Color Picker & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-mono uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Font Color
                </span>
                <div className="flex items-center gap-2">
                  <input
                    id="parcel-label-font-color-picker"
                    type="color"
                    value={labelFontColor}
                    onChange={(e) => handleLabelFontColorChange(e.target.value)}
                    className="w-7 h-7 rounded border border-slate-700 p-0.5 cursor-pointer bg-transparent"
                    title="Choose custom font color"
                  />
                  <span className="font-mono text-[11px] font-bold text-sky-400">
                    {labelFontColor.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Font Color Presets */}
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => handleLabelFontColorChange(preset.hex)}
                    className={`w-6 h-6 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
                      labelFontColor.toLowerCase() === preset.hex.toLowerCase()
                        ? 'border-sky-400 ring-2 ring-sky-500 scale-110'
                        : 'border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  >
                    {labelFontColor.toLowerCase() === preset.hex.toLowerCase() && (
                      <Check className={`w-3.5 h-3.5 ${preset.hex === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Elevation Offset above shape with typing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Hover Elevation Offset
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    id="parcel-label-elevation-offset-input"
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={labelElevationOffset}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleLabelElevationOffsetChange(Math.max(0, Math.min(500, val)));
                      }
                    }}
                    className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500' 
                        : 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                    title="Type elevation offset in meters (0 - 500)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">m</span>
                </div>
              </div>
              <input
                id="parcel-label-elevation-offset-slider"
                type="range"
                min="0"
                max="50"
                step="1"
                value={labelElevationOffset}
                onChange={(e) => handleLabelElevationOffsetChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                <span>0 m</span>
                <span>25 m</span>
                <span>50 m</span>
              </div>
            </div>

            {/* Outline / Halo Contrast Width with typing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  Halo / Outline Width
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    id="parcel-label-outline-width-input"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={labelOutlineWidth}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleLabelOutlineWidthChange(Math.max(0, Math.min(10, val)));
                      }
                    }}
                    className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500' 
                        : 'bg-slate-900 border-slate-700 text-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                    title="Type outline width in pixels (0 - 10)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">px</span>
                </div>
              </div>
              <input
                id="parcel-label-outline-width-slider"
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={labelOutlineWidth}
                onChange={(e) => handleLabelOutlineWidthChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                <span>0 px</span>
                <span>4.0 px</span>
                <span>8.0 px</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Action Bar */}
      <div className="pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={handleResetDefaults}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
            isLight 
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-sky-600/30 transition-colors"
          >
            {embedded ? 'Close' : 'Done'}
          </button>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div id="parcel-style-embedded-panel" className="w-full space-y-3.5 text-xs select-none">
        {/* Header / Active Layer banner */}
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
          isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-900/60 border-white/5'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 border border-sky-500/20">
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold">
                Layer Styling & Filter
              </div>
              <div className="text-xs font-bold text-sky-400 truncate" title={currentName}>
                {currentName}
              </div>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors border-0 ${
                isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Empty state if no active layer or features */}
        {!currentShapefileData && (!allLayers || allLayers.length === 0) ? (
          <div className={`p-5 rounded-xl border text-center space-y-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-900/40 border-white/5 text-slate-400'
          }`}>
            <Layers className="w-7 h-7 mx-auto text-sky-400/60" />
            <p className="text-xs font-bold text-slate-200">No GIS or Shapefile Layer Active</p>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              Import a Shapefile (.zip) or GIS layer from the left sidebar to customize polygon fill color, opacity, outline border stroke, and filter attributes.
            </p>
          </div>
        ) : (
          bodyContent
        )}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        id="parcel-style-toolbar-panel"
        className={`fixed z-40 top-20 right-4 sm:right-6 w-84 sm:w-96 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all ${
          isLight
            ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-400/30'
            : 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/80'
        }`}
      >
        {/* Panel Header */}
        <div className={`p-3.5 border-b flex items-center justify-between gap-2 rounded-t-2xl ${
          isLight ? 'bg-slate-100/60 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider truncate flex items-center gap-1.5">
                <span>Layer Style & Filter</span>
              </h3>
              <p className="text-[11px] font-mono text-sky-400 truncate" title={currentName}>
                {currentName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors border-0 ${
                isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={isMinimized ? 'Expand panel' : 'Minimize panel'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors border-0 ${
                isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title="Close style panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel Body */}
        {!isMinimized && bodyContent}
      </motion.div>
    </AnimatePresence>
  );
}

export default ParcelStyleToolbar;
