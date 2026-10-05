import React, { useState, useEffect } from 'react';
import { 
  Ruler, 
  Mountain, 
  Layers, 
  Cone, 
  PenTool, 
  HardHat, 
  Scissors,
  RotateCcw,
  MoreHorizontal,
  Palette,
  ToolCase,
  ChevronRight,
  Satellite
} from 'lucide-react';
import { useDeviceType } from '../hooks/useDeviceType';
import type { ActiveToolType } from '../types';

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1400,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}

export { ActiveToolType };

export interface ViewportToolbarProps {
  sidebarTheme?: 'light' | 'dark';
  activeTool: ActiveToolType;
  onActiveToolChange: (tool: ActiveToolType) => void;
  onCleanupMeasurements?: () => void;
  hasShapefile?: boolean;
  isParcelStyleOpen?: boolean;
  onToggleParcelStyle?: () => void;
  isArcGisImageryOpen?: boolean;
  onToggleArcGisImagery?: () => void;
}

export default function ViewportToolbar({
  sidebarTheme = 'dark',
  activeTool,
  onActiveToolChange,
  onCleanupMeasurements,
  hasShapefile = false,
  isParcelStyleOpen = false,
  onToggleParcelStyle,
  isArcGisImageryOpen = false,
  onToggleArcGisImagery
}: ViewportToolbarProps) {
  const { width, height, isTablet, isMobile } = useDeviceType();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('viewport_toolbar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('viewport_toolbar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const isCompact = isTablet || isMobile || width < 1024;
  const isTwoRowMode = !isCompact && (width < 1200 || height < 750);

  const isLight = sidebarTheme === 'light';

  const isSecondaryToolActive = ['view-corridor', 'parametric-massing', 'subsurface-excavation', '3d-tiles-clip'].includes(activeTool);

  // Helper for button classes matching right sidebar button size and vertical layout
  const getButtonClass = (isActive: boolean, activeColor = 'bg-blue-600 text-white shadow-blue-500/20') => {
    const base = 'flex flex-col items-center justify-center gap-1 rounded-xl font-medium cursor-pointer transition-all duration-200 select-none min-w-[54px] min-h-[48px] px-2.5 py-1.5 border-0';
    if (isActive) {
      return `${base} ${activeColor} shadow-md`;
    }
    if (isLight) {
      return `${base} text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200`;
    }
    return `${base} text-slate-300 hover:text-white hover:bg-slate-800/70 active:bg-slate-800`;
  };

  // Collapse button located on the far left of the toolbar (matching sketch)
  const collapseBtn = (
    <button
      type="button"
      onClick={handleToggleCollapse}
      title="Collapse Tools"
      aria-label="Collapse Tools"
      className={`group flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 select-none min-w-[28px] min-h-[48px] px-1 border-0 ${
        isLight
          ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/10 active:bg-white/15'
      }`}
    >
      <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 text-amber-400" />
    </button>
  );

  const divider = (
    <div className={`w-[1px] h-7 self-center mx-0.5 shrink-0 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />
  );

  const distanceBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === 'distance' ? 'none' : 'distance');
        setIsMoreOpen(false);
      }}
      title="Measure Path Distance"
      className={getButtonClass(activeTool === 'distance', 'bg-blue-600 text-white shadow-blue-500/20')}
    >
      <Ruler className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Distance</span>
    </button>
  );

  const heightBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === 'height' ? 'none' : 'height');
        setIsMoreOpen(false);
      }}
      title="Measure 3D Vertical Height"
      className={getButtonClass(activeTool === 'height', 'bg-amber-600 text-white shadow-amber-500/20')}
    >
      <Mountain className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Height</span>
    </button>
  );

  const areaBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === 'area' ? 'none' : 'area');
        setIsMoreOpen(false);
      }}
      title="Measure Surface Area"
      className={getButtonClass(activeTool === 'area', 'bg-emerald-600 text-white shadow-emerald-500/20')}
    >
      <Layers className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Area</span>
    </button>
  );

  const viewCorridorBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === 'view-corridor' ? 'none' : 'view-corridor');
        setIsMoreOpen(false);
      }}
      title="Create View Corridor Analysis"
      className={getButtonClass(activeTool === 'view-corridor', 'bg-cyan-600 text-white shadow-cyan-500/20')}
    >
      <Cone className="w-4 h-4 rotate-90 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">View Corridor</span>
    </button>
  );

  const drawBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === 'parametric-massing' ? 'none' : 'parametric-massing');
        setIsMoreOpen(false);
      }}
      title="Draw Conceptual Massing Polygon"
      className={getButtonClass(activeTool === 'parametric-massing', 'bg-purple-600 text-white shadow-purple-500/20')}
    >
      <PenTool className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Draw</span>
    </button>
  );

  const excavateBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === 'subsurface-excavation' ? 'none' : 'subsurface-excavation');
        setIsMoreOpen(false);
      }}
      title="Underground Utilities Excavation Pit"
      className={getButtonClass(activeTool === 'subsurface-excavation', 'bg-amber-700 text-white shadow-amber-600/30')}
    >
      <HardHat className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Excavate</span>
    </button>
  );

  const clipBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange(activeTool === '3d-tiles-clip' ? 'none' : '3d-tiles-clip');
        setIsMoreOpen(false);
      }}
      title="3d tiles clipping polygon (does not work with Google 3d Photorealistic tiles and OSM 3d Buildings, use DXF boundary clipping instead)"
      className={getButtonClass(activeTool === '3d-tiles-clip', 'bg-rose-600 text-white shadow-rose-500/20')}
    >
      <Scissors className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Clip</span>
    </button>
  );

  const resetBtn = (
    <button
      type="button"
      onClick={() => {
        onActiveToolChange('none');
        setIsMoreOpen(false);
        if (onCleanupMeasurements) onCleanupMeasurements();
      }}
      title="clear active tool"
      className="flex flex-col items-center justify-center gap-1 rounded-xl font-medium cursor-pointer transition-all duration-200 select-none min-w-[54px] min-h-[48px] px-2.5 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 active:bg-rose-500/25 border border-rose-500/20"
    >
      <RotateCcw className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Clear</span>
    </button>
  );

  const parcelStyleBtn = (hasShapefile || onToggleParcelStyle) ? (
    <button
      type="button"
      onClick={() => {
        if (onToggleParcelStyle) onToggleParcelStyle();
        setIsMoreOpen(false);
      }}
      title="Layer Style & Attribute Filter"
      className={getButtonClass(Boolean(isParcelStyleOpen), 'bg-sky-600 text-white shadow-sky-500/20')}
    >
      <Palette className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Style</span>
    </button>
  ) : null;

  const arcgisImageryBtn = onToggleArcGisImagery ? (
    <button
      type="button"
      onClick={() => {
        onToggleArcGisImagery();
        setIsMoreOpen(false);
      }}
      title="ArcGIS Aerial Imagery Selector"
      className={getButtonClass(Boolean(isArcGisImageryOpen), 'bg-cyan-600 text-white shadow-cyan-500/20')}
    >
      <Satellite className="w-4 h-4 shrink-0" />
      <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">Imagery</span>
    </button>
  ) : null;

  if (isCollapsed) {
    return (
      <div 
        id="viewport-measurement-toolbar-collapsed"
        className={`absolute top-3 sm:top-4 z-30 transition-all duration-300 rounded-2xl shadow-2xl backdrop-blur-md right-3 sm:right-4 p-1.5 ${
          isLight
            ? 'sidebar-theme-light bg-white/95 text-slate-900 border border-slate-200 shadow-slate-300/40'
            : 'bg-slate-950/90 border border-slate-800/80 text-slate-100 shadow-black/60'
        }`}
      >
        <button
          type="button"
          onClick={handleToggleCollapse}
          title="Tools"
          aria-label="Tools"
          className={`flex items-center gap-2 rounded-xl font-medium cursor-pointer transition-all duration-200 select-none min-h-[48px] px-3.5 py-1.5 border-0 ${
            activeTool !== 'none'
              ? 'bg-blue-600 text-white shadow-blue-500/25 shadow-md'
              : isLight
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/70 active:bg-slate-800'
          }`}
        >
          <ToolCase className={`w-5 h-5 shrink-0 ${activeTool !== 'none' ? 'text-white' : 'text-blue-400'}`} />
          <span className="text-xs font-semibold tracking-tight whitespace-nowrap">Tools</span>
          {activeTool !== 'none' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title={`Active tool: ${activeTool}`} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div 
      id="viewport-measurement-toolbar"
      className={`absolute top-3 sm:top-4 z-30 transition-all duration-300 rounded-2xl shadow-2xl backdrop-blur-md right-3 sm:right-4 ${
        isTwoRowMode ? 'flex flex-col items-end gap-1.5 p-2' : 'flex items-center gap-1.5 p-1.5'
      } ${
        isLight
          ? 'sidebar-theme-light bg-white/95 text-slate-900 border border-slate-200 shadow-slate-300/40'
          : 'bg-slate-950/90 border border-slate-800/80 text-slate-100 shadow-black/60'
      }`}
    >
      {isCompact ? (
        /* Tablet & Compact Mode: Icon-Only Primary Tools + "..." More Tools Dropdown */
        <div className="relative flex items-center gap-1.5">
          {collapseBtn}
          {divider}
          {distanceBtn}
          {heightBtn}
          {areaBtn}
          {clipBtn}
          {parcelStyleBtn}
          {arcgisImageryBtn}

          {/* More Tools Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(prev => !prev)}
            title="More Analysis Tools"
            className={getButtonClass(
              isMoreOpen || isSecondaryToolActive,
              'bg-cyan-600 text-white shadow-cyan-500/20'
            )}
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-medium tracking-tight whitespace-nowrap">More</span>
          </button>

          {resetBtn}

          {/* Dropdown Menu for Secondary Tools */}
          {isMoreOpen && (
            <div 
              className={`absolute top-full right-0 mt-2 p-2 rounded-2xl shadow-2xl border flex flex-col gap-1.5 z-50 backdrop-blur-xl min-w-[180px] ${
                isLight 
                  ? 'bg-white/95 border-slate-200 text-slate-900' 
                  : 'bg-slate-950/95 border-slate-800 text-slate-100'
              }`}
            >
              <div className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-1 text-slate-400 border-b border-white/10">
                More Tools
              </div>
              <div className="flex flex-col gap-1">
                {viewCorridorBtn}
                {drawBtn}
                {excavateBtn}
              </div>
            </div>
          )}
        </div>
      ) : isTwoRowMode ? (
        /* 2 Vertical Tier Layout for medium/small desktop screens */
        <>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {collapseBtn}
            {divider}
            {distanceBtn}
            {heightBtn}
            {areaBtn}
            {clipBtn}
            {parcelStyleBtn}
            {arcgisImageryBtn}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {viewCorridorBtn}
            {drawBtn}
            {excavateBtn}
            {resetBtn}
          </div>
        </>
      ) : (
        /* Single Row Layout for wide desktop screens */
        <>
          {collapseBtn}
          {divider}
          {distanceBtn}
          {heightBtn}
          {areaBtn}
          {clipBtn}
          {viewCorridorBtn}
          {drawBtn}
          {excavateBtn}
          {parcelStyleBtn}
          {arcgisImageryBtn}
          {resetBtn}
        </>
      )}
    </div>
  );
}

