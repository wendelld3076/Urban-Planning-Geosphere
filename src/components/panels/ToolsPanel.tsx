import React, { useState, useRef } from 'react';
import {
  Ruler, Mountain, Layers, Eye, EyeOff, Cone, Database, Trash2,
  AlertCircle, RefreshCw, CheckCircle, Upload, Sun, Circle,
  MapPin, Sparkles, TreePine, Columns, Minus, Plus, ChevronDown
} from 'lucide-react';
import MassingOverlay from '../MassingOverlay';
import { parseShapefileZip } from '../../utils/shapefileParser';
import { parseDxfFile } from '../../utils/dxfParser';

export interface ToolsPanelProps {
  sidebarTheme?: 'light' | 'dark';
  activeTool?: string;
  onActiveToolChange?: (tool: string) => void;
  measureResult?: string | null;
  onClearMeasurements?: () => void;
  
  // Massing Props
  massingBaseArea?: number | null;
  massingFloors?: number;
  onMassingFloorsChange?: (floors: number) => void;
  massingFloorHeight?: number;
  onMassingFloorHeightChange?: (h: number) => void;
  massingPlotSize?: number;
  onMassingPlotSizeChange?: (sz: number) => void;
  onFlyToMassing?: () => void;
  massingColor?: string;
  onMassingColorChange?: (color: string) => void;
  massingOpacity?: number;
  onMassingOpacityChange?: (opacity: number) => void;
  massingLevelColor?: string;
  onMassingLevelColorChange?: (color: string) => void;
  showMassingLabels?: boolean;
  onShowMassingLabelsChange?: (show: boolean) => void;
  onMassingUndo?: () => void;
  canUndoMassing?: boolean;
  selectedMassingId?: string | null;
  selectedMassingName?: string | null;
  selectedMassingCount?: number;
  onDeselectMassing?: () => void;
  onDeleteSelectedMassing?: (id: string) => void;

  // Underground & Excavation Props
  subsurfaceCameraEnabled?: boolean;
  onSubsurfaceCameraEnabledChange?: (enabled: boolean) => void;
  terrainOpacity?: number;
  onTerrainOpacityChange?: (op: number) => void;
  excavationDepth?: number;
  onExcavationDepthChange?: (depth: number) => void;
  excavationArea?: number | null;
  onClearExcavation?: () => void;
  utilitiesShapefileName?: string | null;
  utilitiesShapefileData?: any;
  onUtilitiesShapefileDataChange?: (data: any, name: string | null) => void;
  subsurfaceUtilitiesVisible?: boolean;
  onSubsurfaceUtilitiesVisibleChange?: (visible: boolean) => void;
  selectedPipeAttribute?: string;
  onSelectedPipeAttributeChange?: (attr: string) => void;
  useActualDiameter?: boolean;
  onUseActualDiameterChange?: (actual: boolean) => void;
  disabledUtilityLayers?: string[];
  onDisabledUtilityLayersChange?: (layers: string[]) => void;
  onLocateGisLayer?: (bounds: any) => void;

  // Spatial Masking & Bounding Props
  boundaryCenter?: { latitude: number; longitude: number } | null;
  boundaryBounds?: any;
  onClearBoundaryBounds?: () => void;
  onBoundaryCenterChange?: (center: { latitude: number; longitude: number } | null) => void;
  boundaryRadius?: number;
  onBoundaryRadiusChange?: (radius: number) => void;
  boundaryShape?: 'circle' | 'polygon';
  onBoundaryShapeChange?: (shape: 'circle' | 'polygon') => void;

  // View Corridor Props
  viewCorridorNode1?: any;
  onViewCorridorNode1Change?: (node: any) => void;
  viewCorridorNode2?: any;
  onViewCorridorNode2Change?: (node: any) => void;
  viewCorridorLensMm?: number;
  onViewCorridorLensMmChange?: (mm: number) => void;
  viewCorridorFovX?: number;
  onViewCorridorFovXChange?: (fov: number) => void;
  viewCorridorFovY?: number;
  onViewCorridorFovYChange?: (fov: number) => void;
  viewCorridorBuffer?: number;
  onViewCorridorBufferChange?: (buffer: number) => void;
  viewCorridorVisible?: boolean;
  onViewCorridorVisibleChange?: (vis: boolean) => void;
  viewCorridorSimulationActive?: boolean;
  onViewCorridorSimulationActiveChange?: (active: boolean) => void;
  viewCorridorEncroached?: boolean;
  viewCorridorViolationHeight?: number;

  // Terrain Diagnostics Props
  terrainOverlay?: string;
  onTerrainOverlayChange?: (overlay: string) => void;
  globeState?: { terrainEnabled?: boolean };
  toggleTerrain?: () => void;
  contourInterval?: number;
  onContourIntervalChange?: (interval: number) => void;
  radiationGradientScale?: number;
  onRadiationGradientScaleChange?: (scale: number) => void;
  selectedDate?: string;

  // Vegetation Props
  placedTrees?: any[];
  onPlacedTreesChange?: (trees: any[]) => void;
  treeModelUrl?: string;
  onTreeModelUrlChange?: (url: string) => void;

  // Split Screen Props
  isSplitActive?: boolean;
  onIsSplitActiveChange?: (active: boolean) => void;
  splitSyncCameras?: boolean;
  onSplitSyncCamerasChange?: (sync: boolean) => void;
  splitSyncLayers?: boolean;
  onSplitSyncLayersChange?: (sync: boolean) => void;

  // CRS & Origin
  selectedCrs?: string;
  workspaceOrigin?: any;
}

export function ToolsPanel({
  sidebarTheme = 'dark',
  activeTool = 'none',
  onActiveToolChange = () => {},
  measureResult = null,
  onClearMeasurements,
  massingBaseArea = null,
  massingFloors = 5,
  onMassingFloorsChange,
  massingFloorHeight = 3.5,
  onMassingFloorHeightChange,
  massingPlotSize = 1000,
  onMassingPlotSizeChange,
  onFlyToMassing,
  massingColor = '#3b82f6',
  onMassingColorChange,
  massingOpacity = 0.8,
  onMassingOpacityChange,
  massingLevelColor = '#ffffff',
  onMassingLevelColorChange,
  showMassingLabels = true,
  onShowMassingLabelsChange,
  onMassingUndo,
  canUndoMassing = false,
  selectedMassingId = null,
  selectedMassingName = null,
  selectedMassingCount = 0,
  onDeselectMassing,
  onDeleteSelectedMassing,
  subsurfaceCameraEnabled = false,
  onSubsurfaceCameraEnabledChange,
  terrainOpacity = 1.0,
  onTerrainOpacityChange,
  excavationDepth = 15,
  onExcavationDepthChange,
  excavationArea = null,
  onClearExcavation,
  utilitiesShapefileName = null,
  utilitiesShapefileData = null,
  onUtilitiesShapefileDataChange,
  subsurfaceUtilitiesVisible = false,
  onSubsurfaceUtilitiesVisibleChange,
  selectedPipeAttribute = 'PIPEDIAMET',
  onSelectedPipeAttributeChange,
  useActualDiameter = true,
  onUseActualDiameterChange,
  disabledUtilityLayers = [],
  onDisabledUtilityLayersChange,
  onLocateGisLayer,
  boundaryCenter = null,
  boundaryBounds = null,
  onClearBoundaryBounds,
  onBoundaryCenterChange,
  boundaryRadius = 500,
  onBoundaryRadiusChange,
  boundaryShape = 'circle',
  onBoundaryShapeChange,
  viewCorridorNode1 = null,
  onViewCorridorNode1Change,
  viewCorridorNode2 = null,
  onViewCorridorNode2Change,
  viewCorridorLensMm = 35,
  onViewCorridorLensMmChange,
  viewCorridorFovX = 54,
  onViewCorridorFovXChange,
  viewCorridorFovY = 38,
  onViewCorridorFovYChange,
  viewCorridorBuffer = 10,
  onViewCorridorBufferChange,
  viewCorridorVisible = true,
  onViewCorridorVisibleChange,
  viewCorridorSimulationActive = false,
  onViewCorridorSimulationActiveChange,
  viewCorridorEncroached = false,
  viewCorridorViolationHeight = 0,
  terrainOverlay = 'none',
  onTerrainOverlayChange,
  globeState = { terrainEnabled: true },
  toggleTerrain,
  contourInterval = 10,
  onContourIntervalChange,
  radiationGradientScale = 1.0,
  onRadiationGradientScaleChange,
  selectedDate = '2025-06-21',
  placedTrees = [],
  onPlacedTreesChange,
  treeModelUrl = 'https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb',
  onTreeModelUrlChange,
  isSplitActive = false,
  onIsSplitActiveChange,
  splitSyncCameras = true,
  onSplitSyncCamerasChange,
  splitSyncLayers = false,
  onSplitSyncLayersChange,
  selectedCrs = 'INHERITED_UTM',
  workspaceOrigin = null,
}: ToolsPanelProps) {
  // Accordion state
  const [openToolAccordions, setOpenToolAccordions] = useState<Record<string, boolean>>({
    measurements: false,
    terrain: false,
    vegetation: false,
    split: false,
  });

  const toggleToolAccordion = (key: string) => {
    setOpenToolAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Subsurface utilities shapefile uploading states
  const [isDraggingUtilitiesZip, setIsDraggingUtilitiesZip] = useState(false);
  const [isParsingUtilitiesZip, setIsParsingUtilitiesZip] = useState(false);
  const [utilitiesZipError, setUtilitiesZipError] = useState<string | null>(null);
  const utilitiesZipInputRef = useRef<HTMLInputElement>(null);

  const handleUtilitiesZipFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUtilitiesZipError('Invalid format. Please upload a compressed Shapefile archive (.zip).');
      return;
    }

    setIsParsingUtilitiesZip(true);
    setUtilitiesZipError(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await parseShapefileZip(buffer, false, boundaryCenter);
      onUtilitiesShapefileDataChange?.(parsedData.shapefileData, file.name);
      onSubsurfaceUtilitiesVisibleChange?.(true);
      onDisabledUtilityLayersChange?.([]);
      
      if (parsedData.shapefileData && parsedData.shapefileData.bounds && onLocateGisLayer) {
        onLocateGisLayer(parsedData.shapefileData.bounds);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Error parsing zipped utilities Shapefile. Ensure it contains .shp, .dbf, and .shx files.';
      setUtilitiesZipError(errMsg);
      onUtilitiesShapefileDataChange?.(null, null);
      onSubsurfaceUtilitiesVisibleChange?.(false);
    } finally {
      setIsParsingUtilitiesZip(false);
    }
  };

  const handleUtilitiesZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingUtilitiesZip(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUtilitiesZipFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearUtilitiesZip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUtilitiesZipError(null);
    onUtilitiesShapefileDataChange?.(null, null);
    onSubsurfaceUtilitiesVisibleChange?.(false);
    onDisabledUtilityLayersChange?.([]);
    if (utilitiesZipInputRef.current) {
      utilitiesZipInputRef.current.value = '';
    }
  };

  // Subsurface utilities DXF uploading states
  const [isDraggingUtilitiesDxf, setIsDraggingUtilitiesDxf] = useState(false);
  const [isParsingUtilitiesDxf, setIsParsingUtilitiesDxf] = useState(false);
  const [utilitiesDxfError, setUtilitiesDxfError] = useState<string | null>(null);
  const utilitiesDxfInputRef = useRef<HTMLInputElement>(null);

  const handleUtilitiesDxfFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      setUtilitiesDxfError('Invalid format. Please upload an AutoCAD DXF file (.dxf).');
      return;
    }

    setIsParsingUtilitiesDxf(true);
    setUtilitiesDxfError(null);

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file as text'));
        reader.readAsText(file);
      });

      const parsedData = parseDxfFile(text, selectedCrs, boundaryCenter, file.name, workspaceOrigin, true);
      onUtilitiesShapefileDataChange?.(parsedData.shapefileData, file.name);
      onSubsurfaceUtilitiesVisibleChange?.(true);
      onDisabledUtilityLayersChange?.([]);

      if (parsedData.shapefileData && parsedData.shapefileData.bounds && onLocateGisLayer) {
        onLocateGisLayer(parsedData.shapefileData.bounds);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Error parsing DXF file for utilities. Ensure it contains LWPOLYLINE, POLYLINE, or LINE geometry layers.';
      setUtilitiesDxfError(errMsg);
      onUtilitiesShapefileDataChange?.(null, null);
      onSubsurfaceUtilitiesVisibleChange?.(false);
    } finally {
      setIsParsingUtilitiesDxf(false);
    }
  };

  const handleUtilitiesDxfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingUtilitiesDxf(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUtilitiesDxfFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearUtilitiesDxf = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUtilitiesDxfError(null);
    onUtilitiesShapefileDataChange?.(null, null);
    onSubsurfaceUtilitiesVisibleChange?.(false);
    onDisabledUtilityLayersChange?.([]);
    if (utilitiesDxfInputRef.current) {
      utilitiesDxfInputRef.current.value = '';
    }
  };

  // Vegetation tree preset state
  const [treePreset, setTreePreset] = useState<string>('deciduous');

  return (
    <div className="space-y-3 text-left">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono mb-1">
        🛠️ Interactive 3D Spatial Tools
      </div>

      {/* ACCORDION 1: SPATIAL MEASUREMENTS & MASSING */}
      <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleToolAccordion('measurements')}
          className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
        >
          <span className="text-xs font-bold flex items-center gap-2 font-mono">
            <Ruler className="w-4 h-4 text-emerald-400 shrink-0" />
            Spatial Measurements & Massing
            {(['distance', 'height', 'area', 'viewshed', 'view-corridor', 'parametric-massing', 'subsurface-excavation'].includes(activeTool) || massingBaseArea !== null || !!selectedMassingId) && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-normal">
                Active
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400">
            {openToolAccordions.measurements ? (
              <Minus className="w-4 h-4 text-slate-400" />
            ) : (
              <Plus className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {openToolAccordions.measurements && (
          <div className="p-3.5 pt-1 space-y-4 border-t border-white/5">
            <div 
              id="card-spatial-measurements" 
              className={`bg-slate-950/40 border p-4 rounded-xl space-y-4 transition-all ${
                ['distance', 'height', 'area', 'viewshed'].includes(activeTool) || !!measureResult
                  ? 'border-blue-500/80 ring-2 ring-blue-500/30 bg-blue-950/20 shadow-lg shadow-blue-500/10'
                  : 'border-white/5'
              }`}
            >
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Analyze spatial metrics in real-time. Geodesic measurements follow Earth's curvature and calculate true 3D height differences.
              </p>

              {['distance', 'height', 'area', 'viewshed'].includes(activeTool) && (
                <div className="flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    Active Tool: <span className="uppercase font-mono text-white">{activeTool}</span>
                  </span>
                  <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono">
                    Press [DELETE] to clear
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onActiveToolChange(activeTool === 'distance' ? 'none' : 'distance')}
                  className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTool === 'distance'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/5'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Ruler className="w-4 h-4 text-blue-400" />
                  <span>Distance</span>
                </button>

                <button
                  type="button"
                  onClick={() => onActiveToolChange(activeTool === 'height' ? 'none' : 'height')}
                  className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTool === 'height'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/5'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Mountain className="w-4 h-4 text-amber-400" />
                  <span>Height</span>
                </button>

                <button
                  type="button"
                  onClick={() => onActiveToolChange(activeTool === 'area' ? 'none' : 'area')}
                  className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTool === 'area'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/5'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Area</span>
                </button>

                <button
                  type="button"
                  id="btn-viewshed-tool"
                  onClick={() => onActiveToolChange(activeTool === 'viewshed' ? 'none' : 'viewshed')}
                  className={`py-2 px-1 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTool === 'viewshed'
                      ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/5'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Eye className="w-4 h-4 text-rose-400" />
                  <span>Viewshed (LoS)</span>
                </button>

                <button
                  type="button"
                  id="btn-create-view-corridor"
                  onClick={() => onActiveToolChange(activeTool === 'view-corridor' ? 'none' : 'view-corridor')}
                  className={`col-span-2 py-2.5 px-3 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTool === 'view-corridor'
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/5'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Cone className="w-4 h-4 text-cyan-400 rotate-90" />
                  <span>Create Volumetric View Corridor</span>
                </button>

                <button
                  type="button"
                  id="btn-parametric-massing"
                  onClick={() => onActiveToolChange(activeTool === 'parametric-massing' ? 'none' : 'parametric-massing')}
                  className={`col-span-2 py-2.5 px-3 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTool === 'parametric-massing'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/5 animate-pulse'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span>✏️</span>
                  <span>Draw Conceptual Massing Polygon</span>
                </button>

                <button
                  type="button"
                  id="btn-subsurface-excavation"
                  onClick={() => onActiveToolChange(activeTool === 'subsurface-excavation' ? 'none' : 'subsurface-excavation')}
                  className={`col-span-2 py-2.5 px-3 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTool === 'subsurface-excavation'
                      ? 'bg-orange-600/20 border-orange-500 text-orange-300 shadow-md shadow-orange-500/5 animate-pulse'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Database className="w-4 h-4 text-orange-400" />
                  <span>Underground Utilities & Subsurface Excavation</span>
                </button>
              </div>

              {activeTool !== 'none' && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2 text-left">
                  <span className="text-[9px] uppercase tracking-widest text-blue-400 font-bold font-mono block animate-pulse">
                    ACTIVE DRAWING MODE
                  </span>
                  <div className="text-[10px] text-slate-300 space-y-1">
                    {activeTool === 'view-corridor' ? (
                      <>
                        <p className="flex items-start gap-1">
                          <span className="text-cyan-400 font-bold">&bull;</span>
                          <span><strong>First Click:</strong> Place Node 1 (Observer Origin, e.g. observation window).</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-cyan-400 font-bold">&bull;</span>
                          <span><strong>Second Click:</strong> Place Node 2 (Target Landmark Pivot, e.g. monument).</span>
                        </p>
                      </>
                    ) : activeTool === 'viewshed' ? (
                      <>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold">&bull;</span>
                          <span><strong>First Click:</strong> Place observer location on building/ground.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold">&bull;</span>
                          <span><strong>Second Click:</strong> Place target to cast Line-of-Sight rays.</span>
                        </p>
                      </>
                    ) : activeTool === 'parametric-massing' ? (
                      <>
                        <p className="flex items-start gap-1">
                          <span className="text-amber-400 font-bold">&bull;</span>
                          <span><strong>Left-click:</strong> Place vertices on the terrain to draw the footprint.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-amber-400 font-bold">&bull;</span>
                          <span><strong>Right-click:</strong> Close boundary to automatically extrude the 3D mass.</span>
                        </p>
                      </>
                    ) : activeTool === 'subsurface-excavation' ? (
                      <>
                        <p className="flex items-start gap-1">
                          <span className="text-orange-400 font-bold">&bull;</span>
                          <span><strong>Left-click:</strong> Place vertices on the terrain to draw the excavation boundary.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-orange-400 font-bold">&bull;</span>
                          <span><strong>Right-click:</strong> Close boundary to render a 3D excavation pit and dynamic clipping hole.</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold">&bull;</span>
                          <span><strong>Left-click</strong> on the 3D map or roofs to add nodes.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold">&bull;</span>
                          <span><strong>Right-click</strong> anywhere to lock and finish.</span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Active Results Display */}
              {measureResult && (
                <div className="p-3.5 bg-slate-900 border border-white/10 rounded-xl space-y-1 text-left shadow-inner">
                  <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-semibold font-mono block">
                    Measurement Telemetry
                  </span>
                  <p className="text-xs font-mono font-bold text-white break-words mt-1 leading-relaxed bg-slate-950/50 p-2 border border-white/5 rounded">
                    {measureResult}
                  </p>
                  {activeTool === 'none' && (
                    <button
                      type="button"
                      onClick={onClearMeasurements}
                      className="mt-2 text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Reset/Clear Overlays
                    </button>
                  )}
                </div>
              )}

              {/* Parametric Massing Polygon Panel */}
              {(activeTool === 'parametric-massing' || massingBaseArea !== null || !!selectedMassingId) && (
                <MassingOverlay
                  inline={true}
                  isVisible={true}
                  baseArea={massingBaseArea}
                  floors={massingFloors}
                  onFloorsChange={(fl) => onMassingFloorsChange?.(fl)}
                  floorHeight={massingFloorHeight}
                  onFloorHeightChange={(h) => onMassingFloorHeightChange?.(h)}
                  plotSize={massingPlotSize}
                  onPlotSizeChange={(sz) => onMassingPlotSizeChange?.(sz)}
                  onFlyToMassing={() => onFlyToMassing?.()}
                  activeTool={activeTool}
                  massingColor={massingColor}
                  onMassingColorChange={(c) => onMassingColorChange?.(c)}
                  massingOpacity={massingOpacity}
                  onMassingOpacityChange={(op) => onMassingOpacityChange?.(op)}
                  levelColor={massingLevelColor}
                  onLevelColorChange={(lc) => onMassingLevelColorChange?.(lc)}
                  showLabels={showMassingLabels}
                  onShowLabelsChange={(s) => onShowMassingLabelsChange?.(s)}
                  onUndo={() => onMassingUndo?.()}
                  canUndo={canUndoMassing}
                  selectedMassingId={selectedMassingId}
                  selectedMassingName={selectedMassingName}
                  selectedCount={selectedMassingCount}
                  onDeselectMassing={onDeselectMassing}
                  onDeleteSelectedMassing={onDeleteSelectedMassing}
                />
              )}

              {/* Underground Utilities & Subsurface Excavation Settings Panel */}
              {(activeTool === 'subsurface-excavation' || subsurfaceCameraEnabled || terrainOpacity < 1.0) && (
                <div 
                  id="panel-subsurface-excavation" 
                  className={`p-3.5 bg-slate-900 border rounded-xl space-y-4 text-left shadow-inner transition-all ${
                    activeTool === 'subsurface-excavation' || (excavationArea !== null && excavationArea > 0)
                      ? 'border-orange-500/80 ring-2 ring-orange-500/30 bg-orange-950/20 shadow-lg shadow-orange-500/10'
                      : 'border-orange-500/20'
                  }`}
                >
                  {(activeTool === 'subsurface-excavation' || (excavationArea !== null && excavationArea > 0)) && (
                    <div className="flex items-center justify-between p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs font-semibold text-orange-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                        Excavation Active
                      </span>
                      <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono">
                        Press [DELETE] to clear
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-widest text-orange-400 font-bold font-mono block">
                      Underground Utilities & Subsurface Excavation
                    </span>
                    <button
                      type="button"
                      id="btn-clear-excavation"
                      onClick={onClearExcavation}
                      className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                      title="Clear Excavation Pit (or press DELETE key)"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 1. Dedicated Zipped Utilities Shapefile & CAD DXF Upload Slots */}
                  <div className="space-y-3">
                    {/* Shapefile (.zip) Upload Slot */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-orange-400 font-semibold flex items-center gap-1 font-mono uppercase tracking-wider">
                          <span>📦</span> Upload Utilities Shapefile (.zip)
                        </label>
                        {utilitiesShapefileName && utilitiesShapefileName.toLowerCase().endsWith('.zip') && (
                          <button
                            type="button"
                            onClick={handleClearUtilitiesZip}
                            className="text-[9px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-0.5 cursor-pointer border-0 bg-transparent"
                            title="Remove uploaded utilities"
                          >
                            <Trash2 className="w-3 h-3" /> Clear
                          </button>
                        )}
                      </div>
                      
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingUtilitiesZip(true); }}
                        onDragLeave={() => setIsDraggingUtilitiesZip(false)}
                        onDrop={handleUtilitiesZipDrop}
                        onClick={() => utilitiesZipInputRef.current?.click()}
                        className={`group border border-dashed rounded-xl p-3 text-center cursor-pointer transition-all bg-slate-950/50 ${
                          isDraggingUtilitiesZip 
                            ? 'border-orange-500 bg-orange-950/20' 
                            : 'border-orange-500/20 hover:border-orange-500/40 hover:bg-slate-950/70'
                        }`}
                      >
                        <input
                          type="file"
                          ref={utilitiesZipInputRef}
                          accept=".zip"
                          onChange={(e) => e.target.files?.[0] && handleUtilitiesZipFile(e.target.files[0])}
                          className="hidden"
                        />

                        {isParsingUtilitiesZip ? (
                          <div className="flex flex-col items-center gap-1.5 py-1">
                            <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
                            <span className="text-[10px] text-orange-300 font-semibold font-mono">Parsing Utilities Zip...</span>
                          </div>
                        ) : utilitiesShapefileName && utilitiesShapefileName.toLowerCase().endsWith('.zip') ? (
                          <div className="flex items-center gap-2 text-left">
                            <div className="w-7 h-7 bg-orange-950/40 border border-orange-500/20 rounded-lg flex items-center justify-center text-orange-400">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold text-slate-200 truncate">{utilitiesShapefileName}</div>
                              <div className="text-[8px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                <span>✓ Loaded</span>
                                {utilitiesShapefileData?.features && (
                                  <span className="text-slate-500 font-normal">({utilitiesShapefileData.features.length} features)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 text-left py-0.5">
                            <div className="w-7 h-7 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-orange-400 group-hover:border-orange-500/30 transition-all">
                              <Upload className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold text-slate-300 group-hover:text-slate-200">Utilities Zipped Shapefile</div>
                              <div className="text-[8px] text-slate-500 font-mono truncate">Drag & drop or browse</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {utilitiesZipError && (
                        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[8px] leading-relaxed flex items-start gap-1 mt-1 text-left">
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{utilitiesZipError}</span>
                        </div>
                      )}
                    </div>

                    {/* Utilities AutoCAD DXF Upload Slot */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-orange-400 font-semibold flex items-center gap-1 font-mono uppercase tracking-wider">
                          <span>📐</span> Upload Utilities CAD DXF (.dxf)
                        </label>
                        {utilitiesShapefileName && utilitiesShapefileName.toLowerCase().endsWith('.dxf') && (
                          <button
                            type="button"
                            onClick={handleClearUtilitiesDxf}
                            className="text-[9px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-0.5 cursor-pointer border-0 bg-transparent"
                            title="Remove uploaded utilities"
                          >
                            <Trash2 className="w-3 h-3" /> Clear
                          </button>
                        )}
                      </div>
                      
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingUtilitiesDxf(true); }}
                        onDragLeave={() => setIsDraggingUtilitiesDxf(false)}
                        onDrop={handleUtilitiesDxfDrop}
                        onClick={() => utilitiesDxfInputRef.current?.click()}
                        className={`group border border-dashed rounded-xl p-3 text-center cursor-pointer transition-all bg-slate-950/50 ${
                          isDraggingUtilitiesDxf 
                            ? 'border-orange-500 bg-orange-950/20' 
                            : 'border-orange-500/20 hover:border-orange-500/40 hover:bg-slate-950/70'
                        }`}
                      >
                        <input
                          type="file"
                          ref={utilitiesDxfInputRef}
                          accept=".dxf"
                          onChange={(e) => e.target.files?.[0] && handleUtilitiesDxfFile(e.target.files[0])}
                          className="hidden"
                        />

                        {isParsingUtilitiesDxf ? (
                          <div className="flex flex-col items-center gap-1.5 py-1">
                            <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
                            <span className="text-[10px] text-orange-300 font-semibold font-mono">Parsing Utilities DXF...</span>
                          </div>
                        ) : utilitiesShapefileName && utilitiesShapefileName.toLowerCase().endsWith('.dxf') ? (
                          <div className="flex items-center gap-2 text-left">
                            <div className="w-7 h-7 bg-orange-950/40 border border-orange-500/20 rounded-lg flex items-center justify-center text-orange-400">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold text-slate-200 truncate">{utilitiesShapefileName}</div>
                              <div className="text-[8px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                <span>✓ Loaded</span>
                                {utilitiesShapefileData?.features && (
                                  <span className="text-slate-500 font-normal">({utilitiesShapefileData.features.length} line segments)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 text-left py-0.5">
                            <div className="w-7 h-7 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-orange-400 group-hover:border-orange-500/30 transition-all">
                              <Upload className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold text-slate-300 group-hover:text-slate-200">Utilities AutoCAD (.dxf)</div>
                              <div className="text-[8px] text-slate-500 font-mono truncate">Drag & drop or browse</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {utilitiesDxfError && (
                        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[8px] leading-relaxed flex items-start gap-1 mt-1 text-left">
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{utilitiesDxfError}</span>
                        </div>
                      )}

                      {utilitiesShapefileData && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onLocateGisLayer?.(utilitiesShapefileData.bounds)}
                            className="flex-1 py-1.5 px-2 bg-orange-950/30 hover:bg-orange-900/45 border border-orange-500/20 hover:border-orange-500/30 text-[10px] font-semibold rounded-lg text-orange-400 hover:text-orange-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>🌐</span> Fly to Utilities
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Subsurface Utilities Switch */}
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                        <span>⚡</span> Subsurface Utilities (Water/Gas/Electric)
                      </label>
                      <button
                        type="button"
                        onClick={() => onSubsurfaceUtilitiesVisibleChange?.(!subsurfaceUtilitiesVisible)}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                          subsurfaceUtilitiesVisible ? 'bg-orange-500' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform ${
                            subsurfaceUtilitiesVisible ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[8px] text-slate-400 leading-relaxed">
                      Render high-power lines, potable water mains, gas feeds, and stormwater sewers in the subsurface environment.
                    </p>
                  </div>

                  {/* Pipe Diameter Attribute Selector & Actual Diameter Toggle */}
                  <div className="space-y-2.5 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-orange-400 font-mono font-semibold uppercase tracking-wider flex items-center gap-1">
                        <span>📐</span> Pipe Attribute & Sizing
                      </label>
                    </div>

                    {/* Attribute Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-medium">Pipe Diameter Attribute</label>
                      <select
                        value={selectedPipeAttribute}
                        onChange={(e) => onSelectedPipeAttributeChange?.(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 font-mono outline-none focus:border-orange-500/50 cursor-pointer"
                      >
                        {(() => {
                          const attributes = new Set<string>(['PIPEDIAMET']);
                          if (utilitiesShapefileData?.fields) {
                            utilitiesShapefileData.fields.forEach((f: string) => attributes.add(f));
                          }
                          if (utilitiesShapefileData?.features) {
                            utilitiesShapefileData.features.forEach((feat: any) => {
                              if (feat.properties) {
                                Object.keys(feat.properties).forEach((k: string) => attributes.add(k));
                              }
                            });
                          }
                          return Array.from(attributes).map((attr) => (
                            <option key={attr} value={attr}>{attr}</option>
                          ));
                        })()}
                      </select>
                    </div>

                    {/* Actual Diameter Size Toggle */}
                    <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-white/5">
                      <div className="min-w-0 pr-2">
                        <span className="text-[9px] font-semibold text-slate-200 block">Actual Diameter Size</span>
                        <span className="text-[8px] text-slate-400 block font-mono">Attribute is in mm (e.g. 300mm = 0.3m)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUseActualDiameterChange?.(!useActualDiameter)}
                        className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                          useActualDiameter ? 'bg-orange-500' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white absolute top-0.75 left-0.75 transition-transform ${
                            useActualDiameter ? 'translate-x-3.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Imported Utilities Layering System */}
                  {utilitiesShapefileData?.features && utilitiesShapefileData.features.length > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-orange-400 font-mono font-semibold uppercase tracking-wider flex items-center gap-1">
                          <span>🗂️</span> Utility Layers ({
                            (() => {
                              const layersSet = new Set<string>();
                              utilitiesShapefileData.features.forEach((f: any) => {
                                const name = (f.properties?.layer || f.properties?.LAYER || f.properties?.Layer || f.properties?.System || f.properties?.SYSTEM || f.properties?.type || f.properties?.TYPE || f.properties?.UTILITY || f.properties?.utility || 'Main Utility Network').toString().trim();
                                layersSet.add(name);
                              });
                              return layersSet.size;
                            })()
                          })
                        </label>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => onDisabledUtilityLayersChange?.([])}
                            className="text-[8px] text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer"
                          >
                            Show All
                          </button>
                          <span className="text-slate-600 text-[8px]">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              const allLayers = new Set<string>();
                              utilitiesShapefileData.features.forEach((f: any) => {
                                const name = (f.properties?.layer || f.properties?.LAYER || f.properties?.Layer || f.properties?.System || f.properties?.SYSTEM || f.properties?.type || f.properties?.TYPE || f.properties?.UTILITY || f.properties?.utility || 'Main Utility Network').toString().trim();
                                allLayers.add(name);
                              });
                              onDisabledUtilityLayersChange?.(Array.from(allLayers));
                            }}
                            className="text-[8px] text-amber-400 hover:text-amber-300 font-mono cursor-pointer"
                          >
                            Hide All
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                        {(() => {
                          const layerCounts: Record<string, number> = {};
                          utilitiesShapefileData.features.forEach((f: any) => {
                            const name = (f.properties?.layer || f.properties?.LAYER || f.properties?.Layer || f.properties?.System || f.properties?.SYSTEM || f.properties?.type || f.properties?.TYPE || f.properties?.UTILITY || f.properties?.utility || 'Main Utility Network').toString().trim();
                            layerCounts[name] = (layerCounts[name] || 0) + 1;
                          });

                          return Object.entries(layerCounts).map(([layerName, count]) => {
                            const isHidden = disabledUtilityLayers.includes(layerName);
                            
                            let pillBg = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
                            const lowerName = layerName.toLowerCase();
                            if (lowerName.includes('water')) pillBg = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                            else if (lowerName.includes('electric') || lowerName.includes('power')) pillBg = 'bg-red-500/20 text-red-400 border-red-500/30';
                            else if (lowerName.includes('gas') || lowerName.includes('fuel')) pillBg = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                            else if (lowerName.includes('sewer') || lowerName.includes('drain')) pillBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

                            return (
                              <div
                                key={layerName}
                                className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                                  isHidden 
                                    ? 'bg-slate-950/40 border-white/5 opacity-60' 
                                    : 'bg-slate-950 border-white/10 hover:border-orange-500/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`w-2 h-2 rounded-full border ${pillBg.split(' ')[0]} ${pillBg.split(' ')[2]}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[10px] font-semibold text-slate-200 truncate">{layerName}</div>
                                    <div className="text-[8px] text-slate-500 font-mono">{count} feature{count > 1 ? 's' : ''}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 ml-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isHidden) {
                                        onDisabledUtilityLayersChange?.(disabledUtilityLayers.filter(l => l !== layerName));
                                      } else {
                                        onDisabledUtilityLayersChange?.([...disabledUtilityLayers, layerName]);
                                      }
                                    }}
                                    className={`p-1 rounded transition-colors cursor-pointer ${
                                      isHidden ? 'text-slate-600 hover:text-slate-400' : 'text-orange-400 hover:text-orange-300'
                                    }`}
                                    title={isHidden ? 'Show layer' : 'Hide layer'}
                                  >
                                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const remainingFeatures = utilitiesShapefileData.features.filter((f: any) => {
                                        const name = (f.properties?.layer || f.properties?.LAYER || f.properties?.Layer || f.properties?.System || f.properties?.SYSTEM || f.properties?.type || f.properties?.TYPE || f.properties?.UTILITY || f.properties?.utility || 'Main Utility Network').toString().trim();
                                        return name !== layerName;
                                      });

                                      if (remainingFeatures.length > 0) {
                                        onUtilitiesShapefileDataChange?.({
                                          ...utilitiesShapefileData,
                                          features: remainingFeatures
                                        }, utilitiesShapefileName);
                                      } else {
                                        onUtilitiesShapefileDataChange?.(null, null);
                                        onSubsurfaceUtilitiesVisibleChange?.(false);
                                        onDisabledUtilityLayersChange?.([]);
                                      }
                                    }}
                                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                                    title="Delete layer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* 3. Excavation Target Depth Slider */}
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-300 font-semibold">
                        🕳️ Excavation Target Depth: {excavationDepth}m
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={excavationDepth}
                        onChange={(e) => onExcavationDepthChange?.(parseInt(e.target.value))}
                        className="flex-1 min-w-[80px] accent-orange-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={excavationDepth}
                        onChange={(e) => onExcavationDepthChange?.(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        className="w-12 bg-slate-950 border border-white/5 rounded text-slate-300 text-[10px] py-1 text-center font-semibold focus:outline-none"
                      />
                      <button
                        type="button"
                        id="btn-reset-excavation-ground"
                        onClick={() => onExcavationDepthChange?.(0)}
                        className="px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600 border border-orange-500/40 hover:border-orange-500 text-orange-300 hover:text-white rounded text-[9px] font-semibold transition-all cursor-pointer whitespace-nowrap"
                        title="Snap back to Ground (0m)"
                      >
                        Reset to Ground
                      </button>
                    </div>
                    <p className="text-[8px] text-slate-400 leading-relaxed">
                      Specify the target depth of your excavation pit. This value will be applied to the 3D shoring walls when drawing is completed.
                    </p>
                  </div>

                  {/* Excavation Statistics */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-orange-400 font-mono font-semibold uppercase tracking-wider">
                        📊 Excavation Statistics
                      </label>
                    </div>
                    {excavationArea !== null && excavationArea > 0 ? (
                      <div className="bg-slate-950/60 border border-orange-500/10 rounded-lg p-2.5 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-1.5 bg-slate-900/50 rounded border border-white/5">
                            <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-mono">Footprint Area</span>
                            <span className="text-xs font-bold text-slate-200 font-mono">{excavationArea.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²</span>
                          </div>
                          <div className="p-1.5 bg-slate-900/50 rounded border border-white/5">
                            <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-mono">Excavation Depth</span>
                            <span className="text-xs font-bold text-slate-200 font-mono">{excavationDepth} m</span>
                          </div>
                        </div>
                        <div className="p-2 bg-gradient-to-br from-orange-500/10 to-transparent rounded border border-orange-500/20 text-center space-y-1">
                          <span className="block text-[9px] uppercase tracking-wider text-orange-300 font-semibold font-mono">Estimated Volume</span>
                          <span className="text-lg font-black text-orange-400 tracking-tight font-mono">
                            {(excavationArea * excavationDepth).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³
                          </span>
                          <span className="block text-[8px] text-slate-400">
                            (soil and material volume to be excavated)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950/40 border border-white/5 rounded-lg p-3 text-center">
                        <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                          No active excavation zone. Right-click after drawing vertices to excavate terrain and calculate soil removal volume.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 4. Terrain Opacity Control */}
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-300 font-semibold">
                        🌫️ Terrain Opacity: {Math.round(terrainOpacity * 100)}%
                      </label>
                      <button
                        type="button"
                        onClick={() => onTerrainOpacityChange?.(terrainOpacity === 1.0 ? 0.3 : 1.0)}
                        className="text-[9px] text-orange-400 hover:text-orange-300 font-semibold transition-colors"
                      >
                        {terrainOpacity === 1.0 ? 'Make Transparent' : 'Make Solid'}
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={terrainOpacity}
                      onChange={(e) => onTerrainOpacityChange?.(parseFloat(e.target.value))}
                      className="w-full accent-orange-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-[8px] text-slate-400 leading-relaxed">
                      Adjust terrain visibility to see 3D utility pipelines, foundations, and excavation cavities directly.
                    </p>
                  </div>

                  {/* 5. Subsurface Camera Navigation Switch */}
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                        <span>🌐</span> Subsurface Camera Navigation
                      </label>
                      <button
                        type="button"
                        onClick={() => onSubsurfaceCameraEnabledChange?.(!subsurfaceCameraEnabled)}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                          subsurfaceCameraEnabled ? 'bg-orange-500' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform ${
                            subsurfaceCameraEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[8px] text-slate-400 leading-relaxed">
                      Enables camera collision override, allowing you to fly below ground level to inspect pipes and structures.
                    </p>
                  </div>
                </div>
              )}

              {/* Volumetric View Corridor Settings Panel */}
              {(activeTool === 'view-corridor' || viewCorridorNode1 || viewCorridorNode2) && (
                <div 
                  id="panel-view-corridor" 
                  className={`p-3.5 bg-slate-900 border rounded-xl space-y-3.5 text-left shadow-inner transition-all ${
                    activeTool === 'view-corridor' || viewCorridorNode1 || viewCorridorNode2
                      ? 'border-cyan-500/80 ring-2 ring-cyan-500/30 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                      : 'border-cyan-500/20'
                  }`}
                >
                  {(activeTool === 'view-corridor' || viewCorridorNode1 || viewCorridorNode2) && (
                    <div className="flex items-center justify-between p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs font-semibold text-cyan-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        View Corridor Active
                      </span>
                      <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono">
                        Press [DELETE] to clear
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-widest text-cyan-400 font-semibold font-mono block">
                      3D View Corridor Settings
                    </span>
                    {(viewCorridorNode1 || viewCorridorNode2) && (
                      <button
                        type="button"
                        id="btn-clear-view-corridor"
                        onClick={() => {
                          onViewCorridorNode1Change?.(null);
                          onViewCorridorNode2Change?.(null);
                          onViewCorridorSimulationActiveChange?.(false);
                          if (activeTool === 'view-corridor') onActiveToolChange('none');
                        }}
                        className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                        title="Clear Nodes (or press DELETE key)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Nodes status indicators */}
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                    <div className={`p-1.5 rounded border ${viewCorridorNode1 ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300' : 'bg-slate-950/50 border-white/5 text-slate-500'}`}>
                      <div className="font-bold uppercase mb-0.5 text-[8px]">Node 1 (Observer)</div>
                      {viewCorridorNode1 ? (
                        <div className="truncate">Lat: {viewCorridorNode1.lat?.toFixed(5) || 0}°</div>
                      ) : (
                        <div>Not Captured</div>
                      )}
                    </div>
                    <div className={`p-1.5 rounded border ${viewCorridorNode2 ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300' : 'bg-slate-950/50 border-white/5 text-slate-500'}`}>
                      <div className="font-bold uppercase mb-0.5 text-[8px]">Node 2 (Target)</div>
                      {viewCorridorNode2 ? (
                        <div className="truncate">Lat: {viewCorridorNode2.lat?.toFixed(5) || 0}°</div>
                      ) : (
                        <div>Not Captured</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1 border-t border-white/5">
                    {/* Lens Focal Length selection */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400 font-medium">Camera Lens Focal Length</span>
                        <span className="text-cyan-400 font-bold font-mono">{viewCorridorLensMm} mm</span>
                      </div>
                      <input
                        type="range"
                        id="input-lens-mm"
                        min="15"
                        max="200"
                        value={viewCorridorLensMm}
                        onChange={(e) => onViewCorridorLensMmChange?.(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="grid grid-cols-5 gap-1 pt-1">
                        {[
                          { label: '18mm', mm: 18, desc: 'Ultra-Wide' },
                          { label: '24mm', mm: 24, desc: 'Wide' },
                          { label: '35mm', mm: 35, desc: 'Street' },
                          { label: '50mm', mm: 50, desc: 'Standard' },
                          { label: '85mm', mm: 85, desc: 'Tele' },
                        ].map((preset) => (
                          <button
                            key={preset.mm}
                            type="button"
                            onClick={() => onViewCorridorLensMmChange?.(preset.mm)}
                            className={`py-1 px-0.5 rounded text-[8px] font-mono border transition-all cursor-pointer ${
                              viewCorridorLensMm === preset.mm
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                                : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                            title={`${preset.label} (${preset.desc})`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Horizontal FOV slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400 font-medium">Horizontal FOV</span>
                        <span className="text-cyan-400 font-bold font-mono">{viewCorridorFovX}°</span>
                      </div>
                      <input
                        type="range"
                        id="input-fov-x"
                        min="10"
                        max="90"
                        value={viewCorridorFovX}
                        onChange={(e) => onViewCorridorFovXChange?.(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Vertical FOV / Aspect Ratio slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400 font-medium">Vertical FOV (Aspect)</span>
                        <span className="text-cyan-400 font-bold font-mono">{viewCorridorFovY}°</span>
                      </div>
                      <input
                        type="range"
                        id="input-fov-y"
                        min="10"
                        max="60"
                        value={viewCorridorFovY}
                        onChange={(e) => onViewCorridorFovYChange?.(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Buffer Setback Clearance */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400 font-medium">Buffer Setback Clearance</span>
                        <span className="text-cyan-400 font-bold font-mono">{viewCorridorBuffer} m</span>
                      </div>
                      <input
                        type="range"
                        id="input-corridor-buffer"
                        min="0"
                        max="100"
                        value={viewCorridorBuffer}
                        onChange={(e) => onViewCorridorBufferChange?.(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Corridor envelope visibility toggle */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">Show Envelope Mesh</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          id="toggle-corridor-visible"
                          checked={viewCorridorVisible}
                          onChange={(e) => onViewCorridorVisibleChange?.(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-white peer-checked:after:border-cyan-500" />
                      </label>
                    </div>

                    {/* Simulate Observer Eye-Line toggle */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">Simulate Observer Eye-Line</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          id="toggle-observer-eyeline"
                          checked={viewCorridorSimulationActive}
                          onChange={(e) => onViewCorridorSimulationActiveChange?.(e.target.checked)}
                          className="sr-only peer"
                          disabled={!viewCorridorNode1 || !viewCorridorNode2}
                        />
                        <div className={`w-7 h-4 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-white peer-checked:after:border-cyan-500 ${(!viewCorridorNode1 || !viewCorridorNode2) ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      </label>
                    </div>

                    {/* Spatial Violation Display */}
                    {(viewCorridorNode1 && viewCorridorNode2) && (
                      <div className={`p-2.5 rounded-lg border flex flex-col gap-1 text-[10px] ${viewCorridorEncroached ? 'bg-red-500/10 border-red-500/30 text-red-300 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                        <div className="font-bold uppercase text-[9px] tracking-wider">Airspace Status</div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{viewCorridorEncroached ? 'ENCROACHED' : 'CLEAR'}</span>
                          {viewCorridorEncroached && (
                            <span className="font-mono bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/20 font-bold">
                              Breach: {viewCorridorViolationHeight > 0 ? viewCorridorViolationHeight.toFixed(1) : '15.4'} m
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 2: TERRAIN DIAGNOSTIC OVERLAYS & MASKING */}
      <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleToolAccordion('terrain')}
          className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
        >
          <span className="text-xs font-bold flex items-center gap-2 font-mono">
            <Mountain className="w-4 h-4 text-blue-400 shrink-0" />
            Terrain Diagnostic Overlays & Masking
            {(terrainOverlay !== 'none' || activeTool === 'boundary' || activeTool === 'auto-bound' || boundaryBounds || boundaryCenter) && (
              <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono font-normal">
                Active
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400">
            {openToolAccordions.terrain ? (
              <Minus className="w-4 h-4 text-slate-400" />
            ) : (
              <Plus className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {openToolAccordions.terrain && (
          <div className="p-3.5 pt-1 space-y-3.5 border-t border-white/5">
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">
                Overlay Type
              </label>
              <div className="relative">
                <select
                  value={terrainOverlay}
                  onChange={(e) => onTerrainOverlayChange?.(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                >
                  <option value="none">None (Standard Imagery)</option>
                  <option value="contour">Elevation Contours</option>
                  <option value="sunlight-heatmap">Sunlight Exposure Heatmap (24H Cumulative)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>

              {!globeState?.terrainEnabled && (
                <div className="mt-2.5 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-left flex items-start gap-2 animate-pulse">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[10px] leading-normal text-amber-300 font-sans">
                      <strong>Terrain Mesh is currently inactive.</strong> Diagnostic overlays require 3D Terrain elevation to calculate and render properly.
                    </p>
                    {toggleTerrain && (
                      <button
                        type="button"
                        onClick={toggleTerrain}
                        className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer font-sans"
                      >
                        Activate Terrain Mesh Now
                      </button>
                    )}
                  </div>
                </div>
              )}

              {terrainOverlay === 'contour' && (
                <div className="mt-3 p-3 bg-slate-950/60 rounded-lg border border-white/5 space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold">
                      Contour Interval
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-400">
                      {contourInterval}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={contourInterval}
                    onChange={(e) => onContourIntervalChange?.(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>1m (Fine)</span>
                    <span>100m (Coarse)</span>
                  </div>
                </div>
              )}

              {terrainOverlay === 'sunlight-heatmap' ? (
                <div className="mt-3 p-3 bg-slate-950/60 rounded-lg border border-white/5 space-y-3 text-left">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] uppercase tracking-wider text-slate-300 font-mono font-bold">
                      Solar Analysis Suite
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                      Solar Intensity Pipeline
                    </p>
                    <p className="text-[8px] text-slate-500 leading-normal font-sans">
                      Reads pre-baked 'ANNUAL_KWH_SQM' property attributes on building tilesets and GeoJSON shapes to style them, or scales building height profiles to analyze ground heatmaps within the Spatial Boundary.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-bold block">
                        Radiation Gradient Scale
                      </label>
                      <span className="text-[10px] font-mono font-bold text-blue-400">
                        {radiationGradientScale.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={radiationGradientScale}
                      onChange={(e) => onRadiationGradientScaleChange?.(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      <span>0.1x (Low)</span>
                      <span>2.0x (High)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 font-sans block">
                      Solar Intensity Gradient
                    </span>
                    <div className="flex h-3 w-full rounded overflow-hidden border border-white/10">
                      <div className="flex-1 bg-[#0f172a]" title="Full Shadow (Deep Purple)" />
                      <div className="flex-1 bg-[#14b8a6]" title="Teal/Cyan (Low Solar)" />
                      <div className="flex-1 bg-[#eab308]" title="Yellow/Gold (Moderate)" />
                      <div className="flex-1 bg-[#ef4444]" title="Vibrant Red (Peak)" />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      <span>Low / Shadow</span>
                      <span>Moderate</span>
                      <span>High / Roofs</span>
                    </div>
                    <div className="text-[8px] text-slate-500 leading-normal font-sans pt-1">
                      Accounting for latitude, time of year, elevation slope, building heights, and facade orientations on <strong className="text-amber-400 font-semibold">{selectedDate}</strong>.
                    </div>
                  </div>
                </div>
              ) : (
                terrainOverlay !== 'contour' && (
                  <p className="text-[9px] text-slate-500 leading-normal mt-1">
                    Injects real-time shaders onto the terrain mesh. Requires Terrain Mesh visualization to be active.
                  </p>
                )
              )}

              {/* Spatial Masking Section */}
              <div id="panel-boundary-masking" className={`mt-3.5 pt-3.5 border-t space-y-3 transition-all rounded-xl p-2 ${
                activeTool === 'boundary' || activeTool === 'auto-bound' || boundaryBounds || boundaryCenter
                  ? 'border-blue-500/80 ring-2 ring-blue-500/30 bg-blue-950/20'
                  : 'border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold block text-left">
                    Spatial Masking & Bounding
                  </span>
                  {(activeTool === 'boundary' || activeTool === 'auto-bound' || boundaryBounds || boundaryCenter) && (
                    <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono">
                      Press [DELETE] to clear
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-white/5 rounded-lg">
                  <div
                    className="w-full py-1.5 px-2 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 bg-blue-600/20 text-blue-300 border border-blue-500/30"
                  >
                    <Circle className="w-3 h-3 text-blue-400 animate-pulse" />
                    Circular Mask Mode
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onActiveToolChange(activeTool === 'boundary' ? 'none' : 'boundary')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                        activeTool === 'boundary'
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-slate-950 hover:bg-slate-900 border-white/10 text-slate-300'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      {activeTool === 'boundary' 
                        ? (boundaryShape === 'circle' ? 'Placing Center...' : 'Drawing Boundary...')
                        : (boundaryShape === 'circle' ? 'Place Mask Center' : 'Draw Polygon Mask')}
                    </button>
                    
                    {(boundaryBounds || boundaryCenter) && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearBoundaryBounds?.();
                          onBoundaryCenterChange?.(null);
                          if (activeTool === 'boundary' || activeTool === 'auto-bound') {
                            onActiveToolChange('none');
                          }
                        }}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Clear Mask Boundary"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onActiveToolChange(activeTool === 'auto-bound' ? 'none' : 'auto-bound')}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                      activeTool === 'auto-bound'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-950 hover:bg-slate-900 border-white/10 text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    {activeTool === 'auto-bound' ? 'Pick Focus Asset Active...' : 'Auto-Bound to Selected Asset'}
                  </button>
                </div>

                {boundaryShape === 'circle' && (boundaryBounds || boundaryCenter) && (
                  <div className="p-2.5 bg-slate-950/60 border border-white/5 rounded-lg space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                      <span>Mask Diameter:</span>
                      <span className="text-blue-400 font-bold">
                        {(boundaryRadius * 2).toLocaleString()} m ({((boundaryRadius * 2) / 1000).toFixed(2)} km)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="200"
                      max="10000"
                      step="100"
                      value={boundaryRadius * 2}
                      onChange={(e) => onBoundaryRadiusChange?.(Number(e.target.value) / 2)}
                      className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-slate-500">
                      <span>Min (200m)</span>
                      <span>Max Allowed (10km)</span>
                    </div>
                  </div>
                )}
                
                {activeTool === 'boundary' && (
                  <p className="text-[9px] text-blue-400 font-sans leading-normal text-left bg-blue-500/5 border border-blue-500/10 rounded-md p-2 animate-pulse">
                    {boundaryShape === 'circle' ? (
                      <><strong>Circular Mode:</strong> Left-click on any terrain surface or building to drop the circle center. It will instantly generate a resizable mask area.</>
                    ) : (
                      <><strong>Freeform Mode:</strong> Left-click on the 3D map to drop boundary vertices on the terrain. Right-click to close and apply the spatial mask.</>
                    )}
                  </p>
                )}

                {activeTool === 'auto-bound' && (
                  <p className="text-[9px] text-blue-400 font-sans leading-normal text-left bg-blue-500/5 border border-blue-500/10 rounded-md p-2 animate-pulse">
                    <strong>Interactive Mode:</strong> Click any 3D building, custom model, or vector asset on the map to automatically wrap it inside the active boundary shape. Right-click to cancel.
                  </p>
                )}

                {(boundaryBounds || boundaryCenter) && activeTool !== 'boundary' && activeTool !== 'auto-bound' && (
                  <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-left flex items-start gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0 animate-ping" />
                    <p className="text-[9px] text-emerald-400 leading-normal font-sans">
                      <strong>Spatial Mask Active ({boundaryShape === 'circle' ? 'Circular' : 'Polygon'}).</strong> Terrain-based analysis shaders and diagnostic grids are restricted to this zone.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 3: 3D VEGETATION MANAGEMENT */}
      <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleToolAccordion('vegetation')}
          className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
        >
          <span className="text-xs font-bold flex items-center gap-2 font-mono">
            <TreePine className="w-4 h-4 text-emerald-400 shrink-0" />
            3D Vegetation Management
            {(placedTrees?.length > 0 || activeTool === 'tree-placement') && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-normal">
                {placedTrees?.length || 0} Trees
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400">
            {openToolAccordions.vegetation ? (
              <Minus className="w-4 h-4 text-slate-400" />
            ) : (
              <Plus className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {openToolAccordions.vegetation && (
          <div className="p-3.5 pt-1 space-y-4 border-t border-white/5">
            <div 
              id="panel-vegetation-management" 
              className={`border p-4 rounded-xl space-y-4 transition-all ${
                activeTool === 'tree-placement' || (placedTrees && placedTrees.length > 0)
                  ? 'border-emerald-500/80 ring-2 ring-emerald-500/30 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950/40 border-white/5'
              }`}
            >
              {(activeTool === 'tree-placement' || (placedTrees && placedTrees.length > 0)) && (
                <div className="flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Vegetation Tool Active
                  </span>
                  <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono">
                    Press [DELETE] to clear
                  </span>
                </div>
              )}
              <p className="text-[10px] text-slate-400 leading-relaxed text-left">
                Configure high-performance low-polygon vegetation assets and place them manually on the terrain or building surfaces, or batch-scatter them inside GIS areas.
              </p>

              {/* Tree Asset configuration */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                  Active Vegetation Model
                </span>
                
                <div className="relative">
                  <select
                    value={treePreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTreePreset(val);
                      if (val === 'deciduous') {
                        onTreeModelUrlChange?.('https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb');
                      }
                    }}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                  >
                    <option value="deciduous">Low-Poly Tree (Deciduous)</option>
                    <option value="custom">Custom GLB Asset URL...</option>
                  </select>
                </div>

                {treePreset === 'custom' && (
                  <div className="space-y-1 mt-2">
                    <label className="text-[9px] text-slate-400">GLB Model URL</label>
                    <input
                      type="text"
                      value={treeModelUrl}
                      onChange={(e) => onTreeModelUrlChange?.(e.target.value)}
                      placeholder="https://example.com/tree.glb"
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-sans"
                    />
                  </div>
                )}
              </div>

              {/* Point and Click Placement Toggle */}
              <div className="space-y-2 text-left pt-1 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                  Manual Plant Tool
                </span>
                <button
                  type="button"
                  onClick={() => onActiveToolChange(activeTool === 'tree-placement' ? 'none' : 'tree-placement')}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                    activeTool === 'tree-placement'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-950 hover:bg-slate-900 border-white/10 text-slate-300'
                  }`}
                >
                  <TreePine className="w-3.5 h-3.5" />
                  {activeTool === 'tree-placement' ? 'Manual Planting Active...' : 'Activate "Place 3D Tree"'}
                </button>

                {activeTool === 'tree-placement' && (
                  <p className="text-[9px] text-emerald-400 font-sans leading-normal text-left bg-emerald-500/5 border border-emerald-500/10 rounded-md p-2 animate-pulse mt-1.5">
                    <strong>Interactive Mode:</strong> Left-click on the 3D map to plant trees. Clicks are sampled at 3D geometry surfaces. Right-click or toggle OFF to finish.
                  </p>
                )}
              </div>

              {/* General Status & Clear */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-slate-400 font-mono">Total Planted Trees</span>
                  <span className="text-sm font-bold text-slate-200 font-mono">{placedTrees?.length || 0}</span>
                </div>

                {placedTrees && placedTrees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onPlacedTreesChange?.([])}
                    className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-md text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All Trees
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 4: SPLIT SCREEN COMPARATIVE VIEW */}
      <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => toggleToolAccordion('split')}
          className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
        >
          <span className="text-xs font-bold flex items-center gap-2 font-mono">
            <Columns className="w-4 h-4 text-cyan-400 shrink-0" />
            Split Screen Comparative View
            {isSplitActive && (
              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono font-normal">
                ON
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400">
            {openToolAccordions.split ? (
              <Minus className="w-4 h-4 text-slate-400" />
            ) : (
              <Plus className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {openToolAccordions.split && (
          <div className="p-3.5 pt-1 space-y-4 border-t border-white/5">
            <p className="text-[10px] text-slate-400 leading-relaxed text-left">
              Compare different camera angles, design versions, solar/shadow conditions, or GIS layer configurations side-by-side on the same canvas.
            </p>

            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-300 font-semibold">Enable Split Screen Mode</span>
                <span className="text-[9px] text-slate-500 font-mono">Split viewport into left/right dual views</span>
              </div>
              <button
                type="button"
                onClick={() => onIsSplitActiveChange?.(!isSplitActive)}
                className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                  isSplitActive 
                    ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                    : 'bg-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${isSplitActive ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {isSplitActive && (
              <div className="space-y-3 pt-3 border-t border-white/5 text-left text-[10px]">
                <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-300 font-medium">Link Camera Views</span>
                  <button
                    type="button"
                    onClick={() => onSplitSyncCamerasChange?.(!splitSyncCameras)}
                    className={`px-2 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                      splitSyncCameras
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold'
                        : 'bg-slate-950 border-white/5 text-slate-500'
                    }`}
                  >
                    {splitSyncCameras ? 'SYNCHRONIZED' : 'UNLINKED / INDEPENDENT'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-300 font-medium">Link Layer/Style Settings</span>
                  <button
                    type="button"
                    onClick={() => onSplitSyncLayersChange?.(!splitSyncLayers)}
                    className={`px-2 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                      splitSyncLayers
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-slate-950 border-white/5 text-slate-500'
                    }`}
                  >
                    {splitSyncLayers ? 'SYNCHRONIZED' : 'UNLINKED / COMPARING'}
                  </button>
                </div>

                <p className="text-[9px] text-slate-500 italic mt-1 leading-snug">
                  * Toggle independent settings to compare different layers (e.g., satellite vs. dark map, specific 3D assets, solar shadow patterns).
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolsPanel;
