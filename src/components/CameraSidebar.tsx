import React, { useState, useRef, useEffect } from 'react';
import * as Cesium from 'cesium';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, Eye, Compass, Sliders, Plus, Minus, Download, Trash2, 
  ChevronRight, ChevronLeft, ChevronDown, Camera, Play, Square, Film, Trash, RefreshCw, Sun, Moon, X,
  BarChart3, Activity, Bookmark, Cone, Focus, ScanEye, Target, Ruler, Sparkles, Image, PlayCircle, GripVertical, FileJson, Check,
  Palette, Satellite, ArrowUpToLine, Navigation
} from 'lucide-react';
import { LocationPreset, ShapefileData, ShapefileFeature, PolygonData, GisLayer, ParcelStyleConfig } from '../types';
import { useDeviceType } from '../hooks/useDeviceType';
import { AnalyticsView } from './AnalyticsDashboard';
import { SimulationPanel, SimulationPanelProps } from './panels/SimulationPanel';
import { ToolsPanel, ToolsPanelProps } from './panels/ToolsPanel';
import { AiRenderPanel, AiRenderPanelProps } from './panels/AiRenderPanel';
import { ParcelStyleToolbar } from './ParcelStyleToolbar';
import { ArcGisImageryPicker } from './ArcGisImageryPicker';

export type RightSidebarTab = 'analytics' | 'style' | 'imagery' | 'camera' | 'simulation' | 'tools' | 'ai-render';

export interface CameraSidebarProps extends Partial<SimulationPanelProps>, Partial<ToolsPanelProps>, Partial<AiRenderPanelProps> {
  projectionMode: 'perspective' | 'orthographic';
  onProjectionModeChange: (mode: 'perspective' | 'orthographic') => void;
  fovAngle: number;
  onFovAngleChange: (angle: number) => void;
  savedViews: LocationPreset[];
  onTriggerSaveView: () => void;
  onDeleteSavedView: (id: string) => void;
  onUpdateSavedView?: (id: string) => void;
  onReorderSavedViews?: (views: LocationPreset[]) => void;
  onImportSavedViews: (views: LocationPreset[]) => void;
  onTriggerExportViewport: () => void;
  onFlyTo: (preset: LocationPreset) => void;
  
  // Active Tool state for Viewshed and View Corridor
  activeTool?: string;
  onActiveToolChange?: (tool: string) => void;

  // Exporter Resolution and Safe Frame props
  exportResolution?: string;
  onExportResolutionChange?: (res: string) => void;
  showSafeFrame?: boolean;
  onShowSafeFrameChange?: (show: boolean) => void;
  
  // Cinematic Path Props
  cameraKeyframes?: any[];
  onAddKeyframe?: () => void;
  onDeleteKeyframe?: (index: number) => void;
  onToggleKeyframeBezier?: (index: number) => void;
  onClearKeyframes?: () => void;
  onPlayPath?: () => void;
  onStopPath?: () => void;
  onExportVideo?: () => void;
  videoExportResolution?: '1080p' | '4k';
  onVideoExportResolutionChange?: (res: '1080p' | '4k') => void;
  isPlayingPath?: boolean;
  isRecordingVideo?: boolean;
  onFlyToKeyframe?: (index: number) => void;
  onReorderKeyframes?: (fromIndex: number, toIndex: number) => void;
  sidebarTheme?: 'light' | 'dark';
  onSidebarThemeChange?: (theme: 'light' | 'dark') => void;

  // Analytics Props
  shapefileData?: ShapefileData | null;
  selectedMetric?: string;
  onFeatureClick?: (feature: ShapefileFeature) => void;

  // Controlled tab & collapse
  activeTab?: RightSidebarTab;
  onActiveTabChange?: (tab: RightSidebarTab) => void;
  isCollapsed?: boolean;
  onIsCollapsedChange?: (collapsed: boolean) => void;

  // Layer Style & Filter Props
  activeParcelLayer?: GisLayer | null;
  allGisLayers?: GisLayer[];
  shapefileName?: string | null;
  onSelectParcelLayer?: (id: string) => void;
  onUpdateGisLayerStyle?: (layerId: string, style: Partial<ParcelStyleConfig>) => void;

  // Cesium Viewer instance
  viewer?: Cesium.Viewer | null;
}

export default function CameraSidebar({
  sidebarTheme = 'dark',
  onSidebarThemeChange,
  activeTool = 'none',
  onActiveToolChange = () => {},
  projectionMode,
  onProjectionModeChange,
  fovAngle,
  onFovAngleChange,
  savedViews = [],
  onTriggerSaveView,
  onDeleteSavedView,
  onUpdateSavedView,
  onReorderSavedViews,
  onImportSavedViews,
  onTriggerExportViewport,
  onFlyTo,
  exportResolution = '4K',
  onExportResolutionChange,
  showSafeFrame = false,
  onShowSafeFrameChange,
  cameraKeyframes = [],
  onAddKeyframe,
  onDeleteKeyframe,
  onToggleKeyframeBezier,
  onClearKeyframes,
  onPlayPath,
  onStopPath,
  onExportVideo,
  videoExportResolution: propVideoExportResolution,
  onVideoExportResolutionChange,
  isPlayingPath = false,
  isRecordingVideo = false,
  onFlyToKeyframe,
  onReorderKeyframes,
  shapefileData = null,
  selectedMetric = '',
  onFeatureClick = () => {},

  // Simulation props
  sunHour = 12,
  onSunHourChange = () => {},
  sunShadowsEnabled = false,
  onSunShadowsEnabledChange = () => {},
  shadowDarkness = 0.6,
  onShadowDarknessChange,
  softShadows = false,
  onSoftShadowsChange,
  shadowBias = 0.0005,
  onShadowBiasChange,
  normalOffsetBias = 0.0005,
  onNormalOffsetBiasChange,
  shadowMaxDistance = 5000,
  onShadowMaxDistanceChange,
  shadowMapResolution = 2048,
  onShadowMapResolutionChange,
  realisticLighting = false,
  onRealisticLightingChange,
  ambientLightingIntensity = 0.5,
  onAmbientLightingIntensityChange,
  nightAmbientIntensity = 0.1,
  onNightAmbientIntensityChange,
  hdrPipelineEnabled = false,
  onHdrPipelineEnabledChange,
  sunLightAmbientPbr = 1.0,
  onSunLightAmbientPbrChange,
  iblReflectionFactor = 1.0,
  onIblReflectionFactorChange,
  zenithLuminance = 1.0,
  onZenithLuminanceChange,
  ssaoEnabled = false,
  onSsaoEnabledChange,
  ssaoIntensity = 1.0,
  onSsaoIntensityChange,
  eyeAdaptationTonemap = false,
  onEyeAdaptationTonemapChange,
  bloomGlareEnabled = false,
  onBloomGlareEnabledChange,
  selectedDate = '2025-06-21',
  onSelectedDateChange = () => {},
  solarPathEnabled = false,
  onSolarPathEnabledChange,
  solarPathRadius = 1000,
  onSolarPathRadiusChange,
  activeAnalysisCenter = null,
  onActiveAnalysisCenterChange,
  simulationTimezone = 'Etc/GMT+0',
  onSimulationTimezoneChange,
  activeTimezoneOffset,
  detectedTimezone,
  polygonData,
  selectedPreset,
  rtxUltraEnabled,

  // Tools props
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

  // AI Render props
  aiScreenshotDataUrl = null,
  onTriggerAiScreenshot,
  onClearAiScreenshot,

  // Controlled tab & collapse
  activeTab: propActiveTab,
  onActiveTabChange,
  isCollapsed: propIsCollapsed,
  onIsCollapsedChange,

  // Layer Style props
  activeParcelLayer = null,
  allGisLayers = [],
  shapefileName = null,
  onSelectParcelLayer,
  onUpdateGisLayerStyle,
  viewer = null,
}: CameraSidebarProps) {
  const isLight = sidebarTheme === 'light';
  const { isTablet, isMobile, width } = useDeviceType();
  const isDrawerMode = isTablet || isMobile || width < 1024;

  const [internalIsCollapsed, setInternalIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1280;
    }
    return false;
  });

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isCollapsed) : val;
    setInternalIsCollapsed(nextVal);
    onIsCollapsedChange?.(nextVal);
  };

  const [internalActiveTab, setInternalActiveTab] = useState<RightSidebarTab>(() => {
    return shapefileData ? 'analytics' : 'camera';
  });

  const activeTab = propActiveTab !== undefined ? propActiveTab : internalActiveTab;
  const setActiveTab = (tab: RightSidebarTab) => {
    setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  };

  // Automatically switch to analytics tab when shapefile data is loaded if desired
  useEffect(() => {
    if (shapefileData && shapefileData.features.length > 0 && !propActiveTab) {
      setActiveTab('analytics');
    }
  }, [shapefileData]);

  useEffect(() => {
    if (propIsCollapsed === undefined && (isTablet || isMobile || width < 1280)) {
      setIsCollapsed(true);
    }
  }, [isTablet, isMobile, width, propIsCollapsed]);

  const [importViewsError, setImportViewsError] = useState<string | null>(null);
  const [internalVideoResolution, setInternalVideoResolution] = useState<'1080p' | '4k'>('1080p');
  const videoExportResolution = propVideoExportResolution ?? internalVideoResolution;
  const handleVideoExportResolutionChange = (res: '1080p' | '4k') => {
    setInternalVideoResolution(res);
    onVideoExportResolutionChange?.(res);
  };
  const [isProjectionExpanded, setIsProjectionExpanded] = useState(false);
  const [isVisibilityExpanded, setIsVisibilityExpanded] = useState(false);
  const [isCinematicExpanded, setIsCinematicExpanded] = useState(false);
  const [isSavedViewsExpanded, setIsSavedViewsExpanded] = useState(false);
  const [isExportExpanded, setIsExportExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state for reorganizing Saved Views
  const [draggedViewIndex, setDraggedViewIndex] = useState<number | null>(null);
  const [dragOverViewIndex, setDragOverViewIndex] = useState<number | null>(null);

  // Export Saved Views filename modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState('');

  const areAllSectionsCollapsed = !isProjectionExpanded && !isVisibilityExpanded && !isCinematicExpanded && !isSavedViewsExpanded && !isExportExpanded;

  const toggleAllSections = () => {
    const shouldExpand = areAllSectionsCollapsed;
    setIsProjectionExpanded(shouldExpand);
    setIsVisibilityExpanded(shouldExpand);
    setIsCinematicExpanded(shouldExpand);
    setIsSavedViewsExpanded(shouldExpand);
    setIsExportExpanded(shouldExpand);
  };

  const handleViewsImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportViewsError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          const isValid = data.every(
            (item) => item.id && item.name && typeof item.longitude === 'number' && typeof item.latitude === 'number'
          );
          if (isValid) {
            onImportSavedViews(data);
          } else {
            setImportViewsError('Invalid format. Expected location presets array.');
          }
        } else {
          setImportViewsError('Invalid format. Must be a JSON array.');
        }
      } catch (err) {
        setImportViewsError('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleOpenExportModal = () => {
    if (savedViews.length === 0) return;
    const defaultName = `saved_views_${new Date().toISOString().slice(0, 10)}`;
    setExportFileName(defaultName);
    setIsExportModalOpen(true);
  };

  const handleConfirmExportSavedViews = () => {
    if (savedViews.length === 0) return;
    const baseName = exportFileName.trim() || `saved_views_${Date.now()}`;
    const finalName = baseName.replace(/\.json$/i, '') + '.json';

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedViews, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', finalName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setIsExportModalOpen(false);
  };

  // Drag and Drop reorder handlers for saved views
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedViewIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverViewIndex !== index) {
      setDragOverViewIndex(index);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, index: number) => {
    if (dragOverViewIndex === index) {
      setDragOverViewIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedViewIndex === null || draggedViewIndex === dropIndex) {
      setDraggedViewIndex(null);
      setDragOverViewIndex(null);
      return;
    }

    const updated = [...savedViews];
    const [movedItem] = updated.splice(draggedViewIndex, 1);
    updated.splice(dropIndex, 0, movedItem);

    onReorderSavedViews?.(updated);
    setDraggedViewIndex(null);
    setDragOverViewIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedViewIndex(null);
    setDragOverViewIndex(null);
  };

  if (isDrawerMode && isCollapsed) {
    return (
      <button
        id="camera-sidebar-drawer-toggle"
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="fixed top-3.5 right-3.5 z-40 px-3.5 py-2.5 bg-slate-950/90 border border-white/15 hover:border-blue-400/50 rounded-xl text-xs font-semibold text-slate-100 shadow-2xl hover:bg-slate-900 transition-all flex items-center gap-2 cursor-pointer backdrop-blur-md font-mono min-w-[44px] min-h-[44px]"
        title="Open Right Control Deck"
      >
        <Video className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="font-semibold tracking-wide">Deck</span>
      </button>
    );
  }

  return (
    <>
      {isDrawerMode && !isCollapsed && (
        <div
          onClick={() => setIsCollapsed(true)}
          className="fixed inset-0 bg-black/65 z-40 backdrop-blur-sm transition-opacity duration-300"
        />
      )}
      <motion.aside
        id="camera-sidebar-container"
        animate={isDrawerMode ? { x: 0 } : { width: isCollapsed ? 64 : 340 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`${
          isDrawerMode 
            ? 'fixed top-0 right-0 bottom-0 z-50 h-full w-[340px] max-w-[85vw] flex flex-col overflow-visible shadow-2xl' 
            : 'h-full flex flex-col z-30 flex-shrink-0 overflow-visible relative'
        } ${
          sidebarTheme === 'light'
            ? 'sidebar-theme-light bg-white/95 text-slate-900 border-l border-slate-200 shadow-xl'
            : 'bg-slate-950/90 backdrop-blur-xl border-l border-white/10 text-slate-100 shadow-2xl'
        }`}
      >
        {/* Floating Expand/Collapse Toggle Button positioned cleanly on outer left edge */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute -left-4.5 top-1/2 -translate-y-1/2 z-[70] w-9 h-9 rounded-full border-2 border-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all cursor-pointer ${
            isCollapsed
              ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.4)]'
              : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:bg-blue-600 hover:border-blue-400'
          }`}
          title={isCollapsed ? "Expand Control Deck" : "Collapse Control Deck"}
        >
          {isCollapsed ? (
            <ChevronLeft className="w-5 h-5 font-bold stroke-[3]" />
          ) : (
            <ChevronRight className="w-5 h-5 font-bold stroke-[3]" />
          )}
        </button>

      {/* COLLAPSED STATE */}
      {isCollapsed ? (
        <div className={`flex flex-col items-center h-full justify-between py-6 px-3 gap-6 w-16 overflow-hidden select-none transition-colors duration-300 relative ${
          sidebarTheme === 'light' ? 'bg-white border-l border-slate-200' : ''
        }`}>
          {/* Top Indicator Icon */}
          <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
            <Video className="w-4 h-4 text-blue-400" />
          </div>

          {/* Middle Vertical Category Tabs List */}
          <div className="flex flex-col gap-2 bg-white/5 border border-white/5 rounded-2xl p-1.5 my-auto">
            {[
              { id: 'analytics', icon: BarChart3, label: 'Analytics & Metrics', color: 'text-blue-400' },
              { id: 'style', icon: Palette, label: 'Layer Style & Filter', color: 'text-sky-400' },
              { id: 'imagery', icon: Satellite, label: 'ArcGIS Aerial Imagery', color: 'text-cyan-400' },
              { id: 'camera', icon: Camera, label: 'Camera & Viewports', color: 'text-sky-400' },
              { id: 'simulation', icon: PlayCircle, label: 'Simulation & Lighting', color: 'text-amber-400' },
              { id: 'tools', icon: Ruler, label: 'Spatial Tools', color: 'text-emerald-400' },
              { id: 'ai-render', icon: Sparkles, label: 'AI Visualizer', color: 'text-purple-400' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as RightSidebarTab);
                    setIsCollapsed(false);
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer border-0 ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={tab.label}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute right-12 bg-slate-900 border border-white/10 text-xs text-slate-200 px-2.5 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-medium font-sans">
                    {tab.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* EXPANDED STATE */
        <div className="w-[340px] h-full flex flex-col p-5 gap-4 overflow-y-auto overflow-x-hidden">

            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0 select-none border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex flex-col min-w-0">
                  <h2 className="text-sm font-extrabold tracking-tight uppercase text-slate-100 leading-tight truncate">
                    CONTROLS
                  </h2>
                  <span className="text-[10px] text-blue-400 font-mono font-bold tracking-wider uppercase truncate">
                    Analytics & Tools
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleAllSections}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center border-0"
                  title={areAllSectionsCollapsed ? "Un-collapse All" : "Collapse All"}
                >
                  {areAllSectionsCollapsed ? (
                    <Plus className="w-3.5 h-3.5 text-slate-300" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </button>
              </div>
            </div>

            {/* Main Category Tabs Bar (Matching Left Sidebar style) */}
            <div className="grid grid-cols-7 gap-1 border border-white/5 text-[9px] font-mono font-medium text-slate-400 bg-white/5 rounded-xl p-1 flex-shrink-0 select-none">
              {[
                { id: 'analytics', icon: BarChart3, label: 'Stats', fullLabel: 'Analytics & Metrics', color: 'text-blue-400' },
                { id: 'style', icon: Palette, label: 'Style', fullLabel: 'Layer Style & Filter', color: 'text-sky-400' },
                { id: 'imagery', icon: Satellite, label: 'Imagery', fullLabel: 'ArcGIS Aerial Imagery', color: 'text-cyan-400' },
                { id: 'camera', icon: Camera, label: 'Camera', fullLabel: 'Camera & Viewports', color: 'text-sky-400' },
                { id: 'simulation', icon: PlayCircle, label: 'Sim', fullLabel: 'Simulation & Lighting', color: 'text-amber-400' },
                { id: 'tools', icon: Ruler, label: 'Tools', fullLabel: 'Spatial Tools', color: 'text-emerald-400' },
                { id: 'ai-render', icon: Sparkles, label: 'AI', fullLabel: 'AI Visualizer & Render', color: 'text-purple-400' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as RightSidebarTab)}
                    className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border-0 ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                        : 'hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={tab.fullLabel}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
                    <span className="truncate text-[8px] tracking-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Sidebar Content Scroll Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
              
              {/* TAB 1: ANALYTICS & METRICS */}
              {activeTab === 'analytics' && (
                <div className="space-y-4">
                  <AnalyticsView 
                    shapefileData={shapefileData || null} 
                    selectedMetric={selectedMetric} 
                    onFeatureClick={onFeatureClick} 
                    sidebarTheme={sidebarTheme} 
                  />
                </div>
              )}

              {/* TAB: LAYER STYLE & ATTRIBUTE FILTER */}
              {activeTab === 'style' && (
                <div className="space-y-4">
                  <ParcelStyleToolbar
                    isOpen={true}
                    embedded={true}
                    activeLayer={activeParcelLayer || allGisLayers?.find(l => l.id === activeParcelLayer?.id) || allGisLayers?.[0] || null}
                    shapefileData={shapefileData}
                    shapefileName={shapefileName}
                    allLayers={allGisLayers || []}
                    onSelectLayer={onSelectParcelLayer}
                    onUpdateLayerStyle={onUpdateGisLayerStyle}
                    sidebarTheme={sidebarTheme}
                    onClose={() => {
                      setActiveTab(shapefileData ? 'analytics' : 'camera');
                    }}
                  />
                </div>
              )}

              {/* TAB: ARCGIS AERIAL IMAGERY CATALOG */}
              {activeTab === 'imagery' && (
                <div className="space-y-4">
                  <ArcGisImageryPicker
                    mode="embedded"
                    sidebarTheme={sidebarTheme}
                    viewer={viewer}
                    onClose={() => {
                      setActiveTab(shapefileData ? 'analytics' : 'camera');
                    }}
                  />
                </div>
              )}

              {/* TAB 2: CAMERA & LENS (Contains Projection, Sight & Visibility, Cinematic Flight, Saved Perspectives, Export) */}
              {activeTab === 'camera' && (
                <div className="space-y-4">
                  {/* Section 1: Projection & Lens */}
                  <div className="space-y-3">
                    <div 
                      onClick={() => setIsProjectionExpanded(!isProjectionExpanded)}
                      className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-sky-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Projection & Lens
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {projectionMode === 'perspective' ? `${fovAngle}° FOV` : 'Axonometric'}
                        </span>
                        <button
                          type="button"
                          className="p-0.5 text-slate-400 hover:text-white transition-colors border-0 bg-transparent flex items-center justify-center"
                        >
                          {isProjectionExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isProjectionExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-slate-900/40 border border-white/5 p-3.5 rounded-xl space-y-4 overflow-hidden text-left"
                        >
                          {/* Projection Mode Switcher */}
                          <div className="space-y-2">
                            <label className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold block">
                              Projection Mode
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-white/5 select-none">
                              <button
                                type="button"
                                onClick={() => onProjectionModeChange('perspective')}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 border-0 ${
                                  projectionMode === 'perspective'
                                    ? 'bg-blue-600 text-white shadow shadow-blue-500/10'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Perspective</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onProjectionModeChange('orthographic')}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 border-0 ${
                                  projectionMode === 'orthographic'
                                    ? 'bg-blue-600 text-white shadow shadow-blue-500/10'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Axonometric</span>
                              </button>
                            </div>
                          </div>

                          {/* Focal Length / FOV */}
                          <div className="space-y-3 border-t border-white/5 pt-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                                Focal Length
                              </label>
                              {projectionMode === 'perspective' && (
                                <span className="text-[10px] bg-blue-500/10 text-blue-400 font-mono font-bold px-1.5 py-0.5 rounded border border-blue-500/20">
                                  {fovAngle}° FOV
                                </span>
                              )}
                            </div>

                            <div className={`space-y-3 transition-all duration-200 ${projectionMode === 'orthographic' ? 'opacity-30 pointer-events-none select-none' : ''}`}>
                              <div className="relative">
                                <select
                                  disabled={projectionMode === 'orthographic'}
                                  value={[75, 60, 40, 28, 18].includes(fovAngle) ? String(fovAngle) : 'custom'}
                                  onChange={(e) => {
                                    if (e.target.value !== 'custom') {
                                      onFovAngleChange(Number(e.target.value));
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono font-medium"
                                >
                                  <option value="75">Ultra-Wide (18mm) — 75°</option>
                                  <option value="60">Standard Wide (24mm) — 60°</option>
                                  <option value="40">Human Eye (50mm) — 40°</option>
                                  <option value="28">Portrait/Detail (85mm) — 28°</option>
                                  <option value="18">Telephoto (135mm) — 18°</option>
                                  {![75, 60, 40, 28, 18].includes(fovAngle) && (
                                    <option value="custom">Custom — {fovAngle}°</option>
                                  )}
                                </select>
                                <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400">
                                  <Sliders className="w-3.5 h-3.5" />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <input
                                  type="range"
                                  min="10"
                                  max="120"
                                  value={fovAngle}
                                  disabled={projectionMode === 'orthographic'}
                                  onChange={(e) => onFovAngleChange(Number(e.target.value))}
                                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                                />
                                <div className="flex justify-between text-[9px] text-slate-500 font-mono select-none">
                                  <span>10° (Narrow)</span>
                                  <span>120° (Wide)</span>
                                </div>
                              </div>
                            </div>

                            {projectionMode === 'orthographic' && (
                              <p className="p-2.5 bg-slate-900/40 rounded-lg text-[10px] text-slate-500 font-mono leading-relaxed text-center select-none">
                                Focal length controls are inactive in Axonometric projection mode.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section 2: Sight & Visibility Analysis */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <div 
                      onClick={() => setIsVisibilityExpanded(!isVisibilityExpanded)}
                      className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Focus className="w-4 h-4 text-rose-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Sight & Visibility Analysis
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTool === 'viewshed' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                            Viewshed Active
                          </span>
                        )}
                        {activeTool === 'view-corridor' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                            Corridor Active
                          </span>
                        )}
                        <button
                          type="button"
                          className="p-0.5 text-slate-400 hover:text-white transition-colors border-0 bg-transparent flex items-center justify-center"
                        >
                          {isVisibilityExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isVisibilityExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-slate-900/40 border border-white/5 p-3.5 rounded-xl space-y-3 overflow-hidden text-left"
                        >
                          <div className="grid grid-cols-1 gap-2.5">
                            {/* Viewshed (LoS) Button */}
                            <button
                              type="button"
                              id="camera-sidebar-viewshed-btn"
                              onClick={() => onActiveToolChange(activeTool === 'viewshed' ? 'none' : 'viewshed')}
                              className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 group ${
                                activeTool === 'viewshed'
                                  ? 'bg-rose-600/20 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                                  : 'bg-slate-900/60 border-white/5 text-slate-300 hover:bg-slate-800/80 hover:border-white/15'
                              }`}
                            >
                              <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                                activeTool === 'viewshed' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20'
                              }`}>
                                <ScanEye className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold font-mono tracking-tight">Viewshed Analysis (LoS)</span>
                                  {activeTool === 'viewshed' && (
                                    <span className="text-[9px] font-mono font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded">ACTIVE</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                                  Cast 3D Line-of-Sight rays to evaluate terrain & building view obstructions.
                                </p>
                              </div>
                            </button>

                            {/* Volumetric View Corridor Button */}
                            <button
                              type="button"
                              id="camera-sidebar-view-corridor-btn"
                              onClick={() => onActiveToolChange(activeTool === 'view-corridor' ? 'none' : 'view-corridor')}
                              className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 group ${
                                activeTool === 'view-corridor'
                                  ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                                  : 'bg-slate-900/60 border-white/5 text-slate-300 hover:bg-slate-800/80 hover:border-white/15'
                              }`}
                            >
                              <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                                activeTool === 'view-corridor' ? 'bg-cyan-600 text-white' : 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20'
                              }`}>
                                <Cone className="w-4 h-4 rotate-90" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold font-mono tracking-tight">Volumetric View Corridor</span>
                                  {activeTool === 'view-corridor' && (
                                    <span className="text-[9px] font-mono font-bold bg-cyan-500 text-white px-1.5 py-0.5 rounded">ACTIVE</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                                  Construct 3D sightline frustum cones to protect urban view corridors.
                                </p>
                              </div>
                            </button>
                          </div>

                          {/* Contextual Active Tool Guidance */}
                          {activeTool === 'viewshed' && (
                            <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-lg text-[10px] font-mono text-rose-200 space-y-1.5">
                              <div className="font-bold flex items-center gap-1.5 text-rose-300">
                                <Target className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                                <span>Viewshed Tool Active</span>
                              </div>
                              <p className="text-[10px] text-rose-200/80 leading-relaxed font-sans">
                                Click on the 3D globe to place an observer point. Line-of-sight rays will highlight visible vs obscured geometry in real-time.
                              </p>
                              <button
                                type="button"
                                onClick={() => onActiveToolChange('none')}
                                className="w-full py-1 px-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-mono font-bold transition-colors cursor-pointer border-0 mt-1"
                              >
                                Cancel / Exit Viewshed Tool
                              </button>
                            </div>
                          )}

                          {activeTool === 'view-corridor' && (
                            <div className="p-2.5 bg-cyan-950/30 border border-cyan-500/30 rounded-lg text-[10px] font-mono text-cyan-200 space-y-1.5">
                              <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                                <Target className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                                <span>View Corridor Tool Active</span>
                              </div>
                              <p className="text-[10px] text-cyan-200/80 leading-relaxed font-sans">
                                Click two points in the 3D viewport: first for observer origin and second for the landmark view target.
                              </p>
                              <button
                                type="button"
                                onClick={() => onActiveToolChange('none')}
                                className="w-full py-1 px-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-mono font-bold transition-colors cursor-pointer border-0 mt-1"
                              >
                                Cancel / Exit View Corridor Tool
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section 3: Cinematic Flight */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <div 
                      onClick={() => setIsCinematicExpanded(!isCinematicExpanded)}
                      className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-purple-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Cinematic Flight Path
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {cameraKeyframes.length} KF
                        </span>
                        <button
                          type="button"
                          className="p-0.5 text-slate-400 hover:text-white transition-colors border-0 bg-transparent flex items-center justify-center"
                        >
                          {isCinematicExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isCinematicExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-slate-900/40 border border-white/5 p-3.5 rounded-xl space-y-4 overflow-hidden text-left"
                        >
                          {/* Action Buttons: Add, Clear */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={onAddKeyframe}
                              disabled={isPlayingPath || isRecordingVideo}
                              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-white/20 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5 text-blue-400" /> Keyframe
                            </button>
                            <button
                              type="button"
                              onClick={onClearKeyframes}
                              disabled={cameraKeyframes.length === 0 || isPlayingPath || isRecordingVideo}
                              className="py-2 px-3 bg-slate-900 hover:bg-rose-950/20 border border-white/10 hover:border-rose-900/30 text-rose-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                              title="Clear Path"
                            >
                              <Trash className="w-3.5 h-3.5" /> Clear
                            </button>
                          </div>

                          {/* Path Playback & Video Exporter Controls */}
                          {cameraKeyframes.length > 0 && (
                            <div className="space-y-3 bg-slate-900/40 border border-white/5 p-3 rounded-xl">
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                                {cameraKeyframes.map((kf, idx) => (
                                  <div 
                                    key={idx}
                                    className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors ${
                                      idx === 0 
                                        ? 'bg-emerald-950/20 border border-emerald-500/30' 
                                        : 'bg-slate-950/60 border border-white/5'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {idx === 0 ? (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/40 flex-shrink-0"></span>
                                      ) : idx === cameraKeyframes.length - 1 ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"></span>
                                      ) : (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                      )}
                                      <span className="font-mono font-bold text-slate-200">KF {idx + 1}</span>
                                      {idx === 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                          START
                                        </span>
                                      )}
                                      {idx > 0 && idx === cameraKeyframes.length - 1 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                          END
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-500 font-mono truncate">Alt: {Math.round(kf.alt || 0)}m</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {/* Jump / Fly to keyframe view */}
                                      <button
                                        type="button"
                                        onClick={() => onFlyToKeyframe?.(idx)}
                                        disabled={isPlayingPath || isRecordingVideo}
                                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-white/5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        title={idx === 0 ? "Jump to Start of Path (KF 1)" : `Fly to Keyframe ${idx + 1}`}
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Make this keyframe the Start of the Path */}
                                      {idx > 0 && onReorderKeyframes && (
                                        <button
                                          type="button"
                                          onClick={() => onReorderKeyframes(idx, 0)}
                                          disabled={isPlayingPath || isRecordingVideo}
                                          className="p-1 rounded bg-slate-900 hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-300 transition-colors border border-white/5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Set as Start of Path"
                                        >
                                          <ArrowUpToLine className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); onToggleKeyframeBezier?.(idx); }}
                                        disabled={isPlayingPath || isRecordingVideo}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                          kf.isBezier 
                                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30' 
                                            : 'bg-slate-900 text-slate-400 border-white/5 hover:bg-slate-800'
                                        }`}
                                      >
                                        <span className="font-mono text-[9px]">〰</span>
                                        <span>Smooth</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => onDeleteKeyframe?.(idx)}
                                        disabled={isPlayingPath || isRecordingVideo}
                                        className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Delete Keyframe"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Path Start info indicator */}
                              <div className="text-[10px] text-slate-300 flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                                <Navigation className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                <span><strong className="text-emerald-400">Path Origin:</strong> Flight path always starts at KF 1.</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {isPlayingPath ? (
                                  <button
                                    type="button"
                                    onClick={onStopPath}
                                    className="col-span-2 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <Square className="w-3.5 h-3.5 fill-current" /> Stop Flight
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={onPlayPath}
                                      disabled={isRecordingVideo}
                                      className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                                    >
                                      <Play className="w-3.5 h-3.5 fill-current" /> Play Path
                                    </button>
                                    <button
                                      type="button"
                                      onClick={onExportVideo}
                                      disabled={isRecordingVideo}
                                      className="py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                                      title={videoExportResolution === '4k' ? "Export Ultra HD 4K Video (3840x2160)" : "Export High-Quality 1080p Video (1920x1080)"}
                                    >
                                      <Film className="w-3.5 h-3.5" /> Exporter
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Video Export Resolution Selector (Under the Exporter) */}
                              <div className="pt-2 border-t border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] uppercase font-mono tracking-wider font-semibold flex items-center gap-1 text-slate-400">
                                    <Film className="w-3 h-3 text-amber-400" />
                                    <span>Export Video Resolution</span>
                                  </label>
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                    isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/5 text-slate-400 border-white/5'
                                  }`}>
                                    {videoExportResolution === '4k' ? '3840 × 2160' : '1920 × 1080'}
                                  </span>
                                </div>
                                <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-lg border ${
                                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/70 border-white/10'
                                }`}>
                                  <button
                                    type="button"
                                    onClick={() => handleVideoExportResolutionChange('1080p')}
                                    disabled={isRecordingVideo || isPlayingPath}
                                    className={`py-1.5 px-2 rounded-md text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                                      videoExportResolution === '1080p'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                        : isLight 
                                          ? 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                                          : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                                  >
                                    <span className="font-bold">1080p</span>
                                    <span className="text-[10px] opacity-70 font-normal">FHD</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVideoExportResolutionChange('4k')}
                                    disabled={isRecordingVideo || isPlayingPath}
                                    className={`py-1.5 px-2 rounded-md text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                                      videoExportResolution === '4k'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                        : isLight
                                          ? 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                                          : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                                  >
                                    <span className="font-bold">4K</span>
                                    <span className="text-[10px] opacity-70 font-normal">UHD</span>
                                  </button>
                                </div>
                              </div>

                              {isRecordingVideo && (
                                <div className="text-[9px] font-mono text-amber-400 text-center animate-pulse flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                                  <span>EXPORTING NATIVE {videoExportResolution.toUpperCase()} RECORDER...</span>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section 4: Saved Perspectives */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <div 
                      onClick={() => setIsSavedViewsExpanded(!isSavedViewsExpanded)}
                      className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Saved Perspectives
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {savedViews.length} Views
                        </span>
                        <button
                          type="button"
                          className="p-0.5 text-slate-400 hover:text-white transition-colors border-0 bg-transparent flex items-center justify-center"
                        >
                          {isSavedViewsExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isSavedViewsExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-slate-900/40 border border-white/5 p-3.5 rounded-xl space-y-4 overflow-hidden text-left"
                        >
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={onTriggerSaveView}
                              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 shadow-md shadow-blue-500/10"
                            >
                              <Plus className="w-3.5 h-3.5" /> Save View
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenExportModal}
                              disabled={savedViews.length === 0}
                              className="py-2 px-3 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Export Saved Views with Custom Filename"
                            >
                              <Download className="w-3.5 h-3.5" /> Export
                            </button>
                          </div>

                          {/* Import Views */}
                          <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                            <label className="text-[10px] text-slate-400 font-semibold block font-mono uppercase">Import Views (.json)</label>
                            <input
                              type="file"
                              accept=".json"
                              ref={fileInputRef}
                              onChange={handleViewsImport}
                              className="block w-full text-xs text-slate-500
                                file:mr-2 file:py-1 file:px-2
                                file:rounded-md file:border-0
                                file:text-[10px] file:font-semibold
                                file:bg-white/5 file:text-slate-300
                                hover:file:bg-white/10 file:cursor-pointer"
                            />
                            {importViewsError && (
                              <p className="text-[9px] text-red-400 font-medium">{importViewsError}</p>
                            )}
                          </div>

                          {/* List of saved views with Drag-and-Drop Reordering */}
                          {savedViews.length > 0 ? (
                            <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-white/5">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
                                <span>Reorder by dragging items:</span>
                                <span>{savedViews.length} views</span>
                              </div>
                              {savedViews.map((view, index) => {
                                const isDragging = draggedViewIndex === index;
                                const isOver = dragOverViewIndex === index;
                                return (
                                  <div
                                    key={view.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragLeave={(e) => handleDragLeave(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`p-2.5 bg-slate-950/50 hover:bg-white/10 border rounded-xl flex items-center justify-between gap-2.5 group transition-all cursor-move select-none ${
                                      isDragging
                                        ? 'opacity-40 border-dashed border-blue-500 scale-[0.98]'
                                        : isOver
                                        ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                                        : 'border-white/5'
                                    }`}
                                  >
                                    <div className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0 flex items-center">
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => onFlyTo(view)}
                                      className="flex-1 text-left cursor-pointer bg-transparent border-0 p-0 flex items-center gap-2.5 min-w-0"
                                      title="Fly to view"
                                    >
                                      {view.thumbnail ? (
                                        <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-white/10 shadow-inner">
                                          <img src={view.thumbnail} alt={view.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      ) : (
                                        <div className="w-16 h-12 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center flex-shrink-0 text-[8px] text-slate-500 font-mono font-bold">
                                          NO_IMG
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-200 truncate group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                          <span className="truncate">{view.name}</span>
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                                          H:{view.heading.toFixed(0)}&deg; P:{view.pitch.toFixed(0)}&deg; Alt:{view.height.toFixed(0)}m
                                        </div>
                                      </div>
                                    </button>
                                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUpdateSavedView?.(view.id);
                                        }}
                                        className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 opacity-60 group-hover:opacity-100 transition-all cursor-pointer border-0 flex items-center justify-center"
                                        title="Update saved view"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteSavedView(view.id);
                                        }}
                                        className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 opacity-60 group-hover:opacity-100 transition-all cursor-pointer border-0 flex items-center justify-center"
                                        title="Delete View"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 text-center py-4 italic select-none">
                              No custom views saved yet. Align camera and click "Save View".
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section 5: Export & Capture */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <div 
                      onClick={() => setIsExportExpanded(!isExportExpanded)}
                      className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-amber-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Export & Capture
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {exportResolution}
                        </span>
                        <button
                          type="button"
                          className="p-0.5 text-slate-400 hover:text-white transition-colors border-0 bg-transparent flex items-center justify-center"
                        >
                          {isExportExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExportExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-slate-900/40 border border-white/5 p-3.5 rounded-xl space-y-4 overflow-hidden text-left"
                        >
                          {/* Target Resolution */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                              Target Resolution (16:9)
                            </label>
                            <select
                              value={exportResolution}
                              onChange={(e) => onExportResolutionChange?.(e.target.value)}
                              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="1K">1K (1920 x 1080)</option>
                              <option value="2K">2K (2560 x 1440)</option>
                              <option value="4K">4K (3840 x 2160)</option>
                              <option value="8K">8K (7680 x 4320)</option>
                            </select>
                          </div>

                          {/* Show 16:9 Safe Frame Switch */}
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-300">Show 16:9 Safe Frame</span>
                              <span className="text-[9px] text-slate-500 font-mono">Capture boundary helper</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onShowSafeFrameChange?.(!showSafeFrame)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                showSafeFrame ? 'bg-emerald-600' : 'bg-slate-800'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  showSafeFrame ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={onTriggerExportViewport}
                            className="w-full py-2.5 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                          >
                            <Camera className="w-4 h-4 text-emerald-400" />
                            <span>Export Viewport Image</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* TAB 3: SIMULATION & LIGHTING */}
              {activeTab === 'simulation' && (
                <div className="space-y-4">
                  <SimulationPanel
                    sidebarTheme={sidebarTheme}
                    sunHour={sunHour}
                    onSunHourChange={onSunHourChange}
                    sunShadowsEnabled={sunShadowsEnabled}
                    onSunShadowsEnabledChange={onSunShadowsEnabledChange}
                    shadowDarkness={shadowDarkness}
                    onShadowDarknessChange={onShadowDarknessChange}
                    softShadows={softShadows}
                    onSoftShadowsChange={onSoftShadowsChange}
                    shadowBias={shadowBias}
                    onShadowBiasChange={onShadowBiasChange}
                    normalOffsetBias={normalOffsetBias}
                    onNormalOffsetBiasChange={onNormalOffsetBiasChange}
                    shadowMaxDistance={shadowMaxDistance}
                    onShadowMaxDistanceChange={onShadowMaxDistanceChange}
                    shadowMapResolution={shadowMapResolution}
                    onShadowMapResolutionChange={onShadowMapResolutionChange}
                    realisticLighting={realisticLighting}
                    onRealisticLightingChange={onRealisticLightingChange}
                    ambientLightingIntensity={ambientLightingIntensity}
                    onAmbientLightingIntensityChange={onAmbientLightingIntensityChange}
                    nightAmbientIntensity={nightAmbientIntensity}
                    onNightAmbientIntensityChange={onNightAmbientIntensityChange}
                    hdrPipelineEnabled={hdrPipelineEnabled}
                    onHdrPipelineEnabledChange={onHdrPipelineEnabledChange}
                    sunLightAmbientPbr={sunLightAmbientPbr}
                    onSunLightAmbientPbrChange={onSunLightAmbientPbrChange}
                    iblReflectionFactor={iblReflectionFactor}
                    onIblReflectionFactorChange={onIblReflectionFactorChange}
                    zenithLuminance={zenithLuminance}
                    onZenithLuminanceChange={onZenithLuminanceChange}
                    ssaoEnabled={ssaoEnabled}
                    onSsaoEnabledChange={onSsaoEnabledChange}
                    ssaoIntensity={ssaoIntensity}
                    onSsaoIntensityChange={onSsaoIntensityChange}
                    eyeAdaptationTonemap={eyeAdaptationTonemap}
                    onEyeAdaptationTonemapChange={onEyeAdaptationTonemapChange}
                    bloomGlareEnabled={bloomGlareEnabled}
                    onBloomGlareEnabledChange={onBloomGlareEnabledChange}
                    selectedDate={selectedDate}
                    onSelectedDateChange={onSelectedDateChange}
                    solarPathEnabled={solarPathEnabled}
                    onSolarPathEnabledChange={onSolarPathEnabledChange}
                    solarPathRadius={solarPathRadius}
                    onSolarPathRadiusChange={onSolarPathRadiusChange}
                    activeAnalysisCenter={activeAnalysisCenter}
                    onActiveAnalysisCenterChange={onActiveAnalysisCenterChange}
                    simulationTimezone={simulationTimezone}
                    onSimulationTimezoneChange={onSimulationTimezoneChange}
                    activeTimezoneOffset={activeTimezoneOffset}
                    detectedTimezone={detectedTimezone}
                    polygonData={polygonData}
                    selectedPreset={selectedPreset}
                    rtxUltraEnabled={rtxUltraEnabled}
                  />
                </div>
              )}

              {/* TAB 4: SPATIAL TOOLS */}
              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <ToolsPanel
                    sidebarTheme={sidebarTheme}
                    activeTool={activeTool}
                    onActiveToolChange={onActiveToolChange}
                    measureResult={measureResult}
                    onClearMeasurements={onClearMeasurements}
                    massingBaseArea={massingBaseArea}
                    massingFloors={massingFloors}
                    onMassingFloorsChange={onMassingFloorsChange}
                    massingFloorHeight={massingFloorHeight}
                    onMassingFloorHeightChange={onMassingFloorHeightChange}
                    massingPlotSize={massingPlotSize}
                    onMassingPlotSizeChange={onMassingPlotSizeChange}
                    onFlyToMassing={onFlyToMassing}
                    massingColor={massingColor}
                    onMassingColorChange={onMassingColorChange}
                    massingOpacity={massingOpacity}
                    onMassingOpacityChange={onMassingOpacityChange}
                    massingLevelColor={massingLevelColor}
                    onMassingLevelColorChange={onMassingLevelColorChange}
                    showMassingLabels={showMassingLabels}
                    onShowMassingLabelsChange={onShowMassingLabelsChange}
                    onMassingUndo={onMassingUndo}
                    canUndoMassing={canUndoMassing}
                    selectedMassingId={selectedMassingId}
                    selectedMassingName={selectedMassingName}
                    selectedMassingCount={selectedMassingCount}
                    onDeselectMassing={onDeselectMassing}
                    onDeleteSelectedMassing={onDeleteSelectedMassing}
                    subsurfaceCameraEnabled={subsurfaceCameraEnabled}
                    onSubsurfaceCameraEnabledChange={onSubsurfaceCameraEnabledChange}
                    terrainOpacity={terrainOpacity}
                    onTerrainOpacityChange={onTerrainOpacityChange}
                    excavationDepth={excavationDepth}
                    onExcavationDepthChange={onExcavationDepthChange}
                    excavationArea={excavationArea}
                    onClearExcavation={onClearExcavation}
                    utilitiesShapefileName={utilitiesShapefileName}
                    utilitiesShapefileData={utilitiesShapefileData}
                    onUtilitiesShapefileDataChange={onUtilitiesShapefileDataChange}
                    subsurfaceUtilitiesVisible={subsurfaceUtilitiesVisible}
                    onSubsurfaceUtilitiesVisibleChange={onSubsurfaceUtilitiesVisibleChange}
                    selectedPipeAttribute={selectedPipeAttribute}
                    onSelectedPipeAttributeChange={onSelectedPipeAttributeChange}
                    useActualDiameter={useActualDiameter}
                    onUseActualDiameterChange={onUseActualDiameterChange}
                    disabledUtilityLayers={disabledUtilityLayers}
                    onDisabledUtilityLayersChange={onDisabledUtilityLayersChange}
                    onLocateGisLayer={onLocateGisLayer}
                    boundaryCenter={boundaryCenter}
                    boundaryBounds={boundaryBounds}
                    onClearBoundaryBounds={onClearBoundaryBounds}
                    onBoundaryCenterChange={onBoundaryCenterChange}
                    boundaryRadius={boundaryRadius}
                    onBoundaryRadiusChange={onBoundaryRadiusChange}
                    boundaryShape={boundaryShape}
                    onBoundaryShapeChange={onBoundaryShapeChange}
                    viewCorridorNode1={viewCorridorNode1}
                    onViewCorridorNode1Change={onViewCorridorNode1Change}
                    viewCorridorNode2={viewCorridorNode2}
                    onViewCorridorNode2Change={onViewCorridorNode2Change}
                    viewCorridorLensMm={viewCorridorLensMm}
                    onViewCorridorLensMmChange={onViewCorridorLensMmChange}
                    viewCorridorFovX={viewCorridorFovX}
                    onViewCorridorFovXChange={onViewCorridorFovXChange}
                    viewCorridorFovY={viewCorridorFovY}
                    onViewCorridorFovYChange={onViewCorridorFovYChange}
                    viewCorridorBuffer={viewCorridorBuffer}
                    onViewCorridorBufferChange={onViewCorridorBufferChange}
                    viewCorridorVisible={viewCorridorVisible}
                    onViewCorridorVisibleChange={onViewCorridorVisibleChange}
                    viewCorridorSimulationActive={viewCorridorSimulationActive}
                    onViewCorridorSimulationActiveChange={onViewCorridorSimulationActiveChange}
                    viewCorridorEncroached={viewCorridorEncroached}
                    viewCorridorViolationHeight={viewCorridorViolationHeight}
                    terrainOverlay={terrainOverlay}
                    onTerrainOverlayChange={onTerrainOverlayChange}
                    globeState={globeState}
                    toggleTerrain={toggleTerrain}
                    contourInterval={contourInterval}
                    onContourIntervalChange={onContourIntervalChange}
                    radiationGradientScale={radiationGradientScale}
                    onRadiationGradientScaleChange={onRadiationGradientScaleChange}
                    selectedDate={selectedDate}
                    placedTrees={placedTrees}
                    onPlacedTreesChange={onPlacedTreesChange}
                    treeModelUrl={treeModelUrl}
                    onTreeModelUrlChange={onTreeModelUrlChange}
                    isSplitActive={isSplitActive}
                    onIsSplitActiveChange={onIsSplitActiveChange}
                    splitSyncCameras={splitSyncCameras}
                    onSplitSyncCamerasChange={onSplitSyncCamerasChange}
                    splitSyncLayers={splitSyncLayers}
                    onSplitSyncLayersChange={onSplitSyncLayersChange}
                    selectedCrs={selectedCrs}
                    workspaceOrigin={workspaceOrigin}
                  />
                </div>
              )}

              {/* TAB 5: AI RENDER & VISUALIZATION */}
              {activeTab === 'ai-render' && (
                <div className="space-y-4">
                  <AiRenderPanel
                    sidebarTheme={sidebarTheme}
                    aiScreenshotDataUrl={aiScreenshotDataUrl}
                    onTriggerAiScreenshot={onTriggerAiScreenshot}
                    onClearAiScreenshot={onClearAiScreenshot}
                    showSafeFrame={showSafeFrame}
                    onShowSafeFrameChange={onShowSafeFrameChange}
                  />
                </div>
              )}

            </div>
          </div>
      )}
    </motion.aside>

    {/* Export Saved Views Filename Modal */}
    <AnimatePresence>
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FileJson className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Export Saved Views</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Specify filename for easy archiving ({savedViews.length} views)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Filename (.json)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmExportSavedViews();
                    } else if (e.key === 'Escape') {
                      setIsExportModalOpen(false);
                    }
                  }}
                  autoFocus
                  placeholder="e.g. site_audit_camera_views"
                  className="w-full bg-slate-950 border border-white/15 focus:border-blue-400 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono transition-all"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono pointer-events-none">
                  .json
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                This JSON contains position, heading, pitch, altitude, layer states, and viewport preview thumbnails.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExportSavedViews}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20 border-0"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
