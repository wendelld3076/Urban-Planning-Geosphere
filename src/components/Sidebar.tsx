import React, { useState, useRef, useEffect } from 'react';
import { 
  Compass, Search, Globe, Layers, Eye, EyeOff, Mountain, Building2, Sun, Moon, 
  CloudFog, ChevronDown, Check, Settings, Activity, Sparkles, MapPin, Aperture,
  Upload, FileArchive, Trash2, AlertCircle, AlertTriangle, CheckCircle, X, Image, RefreshCw, Ruler, FileCode, Locate, Crosshair, Menu,
  ChevronsLeftRight, Save, FolderOpen, Folder, Plus, Minus, ChevronLeft, ChevronRight, Download, FileText,
  Home, Play, Pause, Camera, Key, TreePine, Maximize2, Circle, Cone, Sliders, Database, Columns, Lock, Unlock, Loader2, FolderInput,
  Video, Bookmark, Film, Clock, Square, Package, Mouse, Tablet, HelpCircle, Palette, RotateCcw, Box, Scissors
} from 'lucide-react';
import { useDeviceType } from '../hooks/useDeviceType';
import * as turf from '@turf/turf';
import { LocationPreset, GlobeState, MapLayer, MapStyle, PolygonData, IonAssetsState, IonAccount, IonAccountAsset, ShapefileData, SimulationVideo } from '../types';
import { LOCATION_PRESETS, GLOBAL_HOME_PRESET } from '../data/locations';
import { motion, AnimatePresence } from 'motion/react';
import { parseShapefileZip } from '../utils/shapefileParser';
import { parseDxfFile, CAD_CRS_PRESETS } from '../utils/dxfParser';
import { parseGeospatialMetadata } from '../utils/modelMetadata';
import { getApiUrl } from '../utils/api';
import { generateClientSideArchitecturalRender } from '../utils/proceduralRender';
import MassingOverlay from './MassingOverlay';
import { ArcGisImageryPicker } from './ArcGisImageryPicker';
import * as Cesium from 'cesium';
import JSZip from 'jszip';

const formatHour = (hourFloat: number) => {
  const h = Math.floor(hourFloat);
  const m = Math.floor((hourFloat % 1) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMin = m.toString().padStart(2, '0');
  return `${displayHour}:${displayMin} ${period}`;
};

const TIMEZONES = [
  { value: 'auto', label: 'Auto (Detect Local Solar Time)' },
  { value: 'local', label: 'Device / Browser Time' },
  { value: '-11', label: 'UTC-11:00 (Samoa)' },
  { value: '-10', label: 'UTC-10:00 (Hawaii)' },
  { value: '-9', label: 'UTC-09:00 (Alaska)' },
  { value: '-8', label: 'UTC-08:00 (Pacific Time)' },
  { value: '-7', label: 'UTC-07:00 (Mountain Time)' },
  { value: '-6', label: 'UTC-06:00 (Central Time)' },
  { value: '-5', label: 'UTC-05:00 (Eastern Time)' },
  { value: '-4', label: 'UTC-04:00 (Atlantic Time)' },
  { value: '-3', label: 'UTC-03:00 (Buenos Aires)' },
  { value: '-2', label: 'UTC-02:00 (Mid-Atlantic)' },
  { value: '-1', label: 'UTC-01:00 (Azores)' },
  { value: '+0', label: 'UTC+00:00 (London / GMT)' },
  { value: '+1', label: 'UTC+01:00 (Paris / Berlin / CET)' },
  { value: '+2', label: 'UTC+02:00 (Cairo / Johannesburg)' },
  { value: '+3', label: 'UTC+03:00 (Moscow / Riyadh)' },
  { value: '+4', label: 'UTC+04:00 (Dubai / Abu Dhabi)' },
  { value: '+5', label: 'UTC+05:00 (Karachi / Tashkent)' },
  { value: '+5.5', label: 'UTC+05:30 (New Delhi / Mumbai)' },
  { value: '+6', label: 'UTC+06:00 (Dhaka / Almaty)' },
  { value: '+7', label: 'UTC+07:00 (Bangkok / Jakarta)' },
  { value: '+8', label: 'UTC+08:00 (Beijing / Singapore / Perth)' },
  { value: '+9', label: 'UTC+09:00 (Tokyo / Seoul)' },
  { value: '+9.5', label: 'UTC+09:30 (Adelaide / Darwin)' },
  { value: '+10', label: 'UTC+10:00 (Sydney / Melbourne)' },
  { value: '+11', label: 'UTC+11:00 (Solomon Islands)' },
  { value: '+12', label: 'UTC+12:00 (Auckland / Fiji)' },
];

interface SidebarProps {
  workspaceOrigin?: { lat: number; lng: number };
  onWorkspaceOriginChange?: (origin: { lat: number; lng: number }) => void;
  accountRole?: string;
  onFlyTo: (preset: LocationPreset) => void;
  selectedPreset?: LocationPreset | null;
  globeState: GlobeState;
  setGlobeState: React.Dispatch<React.SetStateAction<GlobeState>>;
  layers: MapLayer[];
  onToggleLayer: (layerId: string) => void;
  isConnected?: boolean;
  onConfigureToken?: () => void;
  
  // Importer states and handlers
  polygonData: PolygonData | null;
  onPolygonDataChange: (data: PolygonData | null, filename: string | null, shapefileData?: ShapefileData | null) => void;
  textureUrl: string | null;
  onTextureUrlChange: (url: string | null, filename: string | null) => void;
  onLayerTextureChange?: (layerId: string, url: string | null, filename: string | null) => void;
  shapefileName: string | null;
  textureName: string | null;
  onFlyToPolygon: () => void;
  clippingMode: 'none' | 'inside' | 'outside';
  onClippingModeChange: (mode: 'none' | 'inside' | 'outside') => void;
  clip3dTiles?: boolean;
  onClip3dTilesChange?: (clip: boolean) => void;

  // Shapefile metrics and toggles props
  shapefileData?: ShapefileData | null;
  selectedMetric?: string;
  onSelectedMetricChange?: (metric: string) => void;
  extrudeHeights?: boolean;
  onExtrudeHeightsChange?: (extrude: boolean) => void;
  shapefileHeightMultiplier?: number;
  onShapefileHeightMultiplierChange?: (multiplier: number) => void;

  // Sun simulation and measurement props
  sunHour: number;
  onSunHourChange: (hour: number) => void;
  sunShadowsEnabled: boolean;
  onSunShadowsEnabledChange: (enabled: boolean) => void;
  shadowDarkness?: number;
  onShadowDarknessChange?: (darkness: number) => void;
  softShadows?: boolean;
  onSoftShadowsChange?: (soft: boolean) => void;
  shadowBias?: number;
  onShadowBiasChange?: (bias: number) => void;
  normalOffsetBias?: number;
  onNormalOffsetBiasChange?: (bias: number) => void;
  shadowMaxDistance?: number;
  onShadowMaxDistanceChange?: (dist: number) => void;
  shadowMapResolution?: number;
  onShadowMapResolutionChange?: (res: number) => void;
  realisticLighting?: boolean;
  onRealisticLightingChange?: (enabled: boolean) => void;
  ambientLightingIntensity?: number;
  onAmbientLightingIntensityChange?: (intensity: number) => void;
  nightAmbientIntensity?: number;
  onNightAmbientIntensityChange?: (intensity: number) => void;
  hdrPipelineEnabled?: boolean;
  onHdrPipelineEnabledChange?: (enabled: boolean) => void;
  sunLightAmbientPbr?: boolean;
  onSunLightAmbientPbrChange?: (enabled: boolean) => void;
  iblReflectionFactor?: number;
  onIblReflectionFactorChange?: (factor: number) => void;
  zenithLuminance?: number;
  onZenithLuminanceChange?: (luminance: number) => void;
  ssaoEnabled?: boolean;
  onSsaoEnabledChange?: (enabled: boolean) => void;
  ssaoIntensity?: number;
  onSsaoIntensityChange?: (intensity: number) => void;
  eyeAdaptationTonemap?: boolean;
  onEyeAdaptationTonemapChange?: (enabled: boolean) => void;
  bloomGlareEnabled?: boolean;
  onBloomGlareEnabledChange?: (enabled: boolean) => void;
  solarPathEnabled: boolean;
  onSolarPathEnabledChange: (enabled: boolean) => void;
  solarPathRadius: number;
  onSolarPathRadiusChange: (radius: number) => void;
  activeTool: 'none' | 'distance' | 'height' | 'area' | 'viewshed' | 'boundary' | 'tree-placement' | 'auto-bound' | 'view-corridor' | 'parametric-massing' | 'subsurface-excavation';
  onActiveToolChange: (tool: 'none' | 'distance' | 'height' | 'area' | 'viewshed' | 'boundary' | 'tree-placement' | 'auto-bound' | 'view-corridor' | 'parametric-massing' | 'subsurface-excavation') => void;
  subsurfaceCameraEnabled?: boolean;
  onSubsurfaceCameraEnabledChange?: (enabled: boolean) => void;
  terrainOpacity?: number;
  onTerrainOpacityChange?: (opacity: number) => void;
  subsurfaceUtilitiesVisible?: boolean;
  onSubsurfaceUtilitiesVisibleChange?: (visible: boolean) => void;
  utilitiesShapefileData?: ShapefileData | null;
  utilitiesShapefileName?: string | null;
  onUtilitiesShapefileDataChange?: (data: ShapefileData | null, filename: string | null) => void;
  excavationDepth?: number;
  excavationArea?: number | null;
  onExcavationDepthChange?: (depth: number) => void;
  onClearExcavation?: () => void;
  viewCorridorNode1?: { lat: number; lon: number; height: number } | null;
  onViewCorridorNode1Change?: (node: { lat: number; lon: number; height: number } | null) => void;
  viewCorridorNode2?: { lat: number; lon: number; height: number } | null;
  onViewCorridorNode2Change?: (node: { lat: number; lon: number; height: number } | null) => void;
  viewCorridorSimulationActive?: boolean;
  onViewCorridorSimulationActiveChange?: (active: boolean) => void;
  viewCorridorLensMm?: number;
  onViewCorridorLensMmChange?: (mm: number) => void;
  viewCorridorFovX?: number;
  onViewCorridorFovXChange?: (fov: number) => void;
  viewCorridorFovY?: number;
  onViewCorridorFovYChange?: (fov: number) => void;
  viewCorridorBuffer?: number;
  onViewCorridorBufferChange?: (buffer: number) => void;
  viewCorridorVisible?: boolean;
  onViewCorridorVisibleChange?: (visible: boolean) => void;
  viewCorridorEncroached?: boolean;
  viewCorridorViolationHeight?: number;
  placedTrees?: any[];
  onPlacedTreesChange?: (trees: any[]) => void;
  treeModelUrl?: string;
  onTreeModelUrlChange?: (url: string) => void;
  measureResult: string | null;
  onClearMeasurements: () => void;
  terrainOverlay?: 'none' | 'slope' | 'contour' | 'sunlight-heatmap';
  onTerrainOverlayChange?: (overlay: 'none' | 'slope' | 'contour' | 'sunlight-heatmap') => void;
  contourInterval?: number;
  onContourIntervalChange?: (interval: number) => void;
  boundaryBounds?: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null;
  onClearBoundaryBounds?: () => void;
  boundaryShape?: 'rectangle' | 'circle';
  onBoundaryShapeChange?: (shape: 'rectangle' | 'circle') => void;
  boundaryRadius?: number;
  onBoundaryRadiusChange?: (radius: number) => void;
  boundaryCenter?: { latitude: number; longitude: number } | null;
  onBoundaryCenterChange?: (center: { latitude: number; longitude: number } | null) => void;

  // Dynamic Date Props
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;

  // Swipe Comparison Props
  swipeEnabled?: boolean;
  onSwipeEnabledChange?: (enabled: boolean) => void;

  // Split Screen Props
  isSplitActive?: boolean;
  onIsSplitActiveChange?: (active: boolean) => void;
  splitSyncCameras?: boolean;
  onSplitSyncCamerasChange?: (sync: boolean) => void;
  splitSyncLayers?: boolean;
  onSplitSyncLayersChange?: (sync: boolean) => void;

  // Solar Exposure Heatmap Props
  radiationGradientScale?: number;
  onRadiationGradientScaleChange?: (scale: number) => void;

  // Google Maps Street Labels Props
  googleLabelsEnabled?: boolean;
  onGoogleLabelsEnabledChange?: (enabled: boolean) => void;
  googleLabelsAlpha?: number;
  onGoogleLabelsAlphaChange?: (alpha: number) => void;

  // RTX Ultra State
  rtxUltraEnabled?: boolean;

  // Simulation Time Zone Props
  simulationTimezone?: string;
  onSimulationTimezoneChange?: (tz: string) => void;
  activeTimezoneOffset?: number;
  detectedTimezone?: string | null;

  // My Cesium Ion Assets Props
  ionAssets?: IonAssetsState;
  onIonAssetsChange?: (assets: IonAssetsState) => void;
  ionAssetError?: string | null;
  onIonAssetErrorChange?: (err: string | null) => void;

  // Saved Views and Project Workspace Props
  savedViews: LocationPreset[];
  onTriggerSaveView: () => void;
  onDeleteSavedView: (id: string) => void;
  onReorderSavedViews?: (views: LocationPreset[]) => void;
  onImportSavedViews: (views: LocationPreset[]) => void;
  onSaveProject: () => void;
  onOpenProject: (project: any) => void;
  onNewProject: () => void;
  autoSaveEnabled?: boolean;
  onAutoSaveEnabledChange?: (enabled: boolean) => void;
  onTriggerExportViewport?: () => void;
  onTriggerAiScreenshot?: () => void;
  aiScreenshotDataUrl?: string | null;
  onClearAiScreenshot?: () => void;
  showSafeFrame?: boolean;
  onShowSafeFrameChange?: (show: boolean) => void;

  // Advanced Performance & LOD Props
  maxSSE?: number;
  onMaxSSEChange?: (val: number) => void;
  tileCacheSize?: number;
  onTileCacheSizeChange?: (val: number) => void;
  skipLevelOfDetail?: boolean;
  onSkipLevelOfDetailChange?: (val: boolean) => void;

  // 3D Model Importer Props
  modelUrl: string | null;
  modelName: string | null;
  modelLatitude: number;
  modelLongitude: number;
  modelHeight: number;
  modelClampToTerrain: boolean;
  modelApplySketchUpProfile: boolean;
  modelHeading: number;
  modelPitch: number;
  modelRoll: number;
  onModelUrlChange: (url: string | null, filename: string | null, zipFiles?: Record<string, JSZip.JSZipObject>) => void;
  onModelLatitudeChange: (latitude: number) => void;
  onModelLongitudeChange: (longitude: number) => void;
  onModelHeightChange: (height: number) => void;
  onModelClampToTerrainChange: (clamp: boolean) => void;
  onModelApplySketchUpProfileChange: (apply: boolean) => void;
  onModelHeadingChange: (heading: number) => void;
  onModelPitchChange: (pitch: number) => void;
  onModelRollChange: (roll: number) => void;
  onFlyToModel: () => void;
  isPickingLocation?: boolean;
  onIsPickingLocationChange?: (isPicking: boolean) => void;
  localVectorUrl?: string | null;
  localVectorName?: string | null;
  localVectorType?: 'geojson' | 'kml' | null;
  onLocalVectorChange?: (url: string | null, name: string | null, type: 'geojson' | 'kml' | null) => void;
  streamedTilesetId?: string | null;
  streamedTilesetVisible?: boolean;
  importedLayers?: any[];
  activeLayerId?: string | null;
  selectedLayerIds?: string[];
  onImportedLayersChange?: (layers: any[]) => void;
  onActiveLayerIdChange?: (id: string | null, isMultiSelect?: boolean) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
  onToggleStreamedTilesetVisibility?: () => void;
  onDeleteLayer?: (layerId: string) => void;
  onDeleteFeature?: (layerId?: string, featureId?: string | number) => void;
  onStreamedTilesetIdChange?: (id: string | null) => void;
  activeLayers?: any[];
  setActiveLayers?: React.Dispatch<React.SetStateAction<any[]>>;
  layersOrder?: any[];
  onLayersOrderChange?: (newOrder: any[]) => void;

  // ArcGIS I3S Streaming Props
  i3sLayers?: any[];
  onAddI3sLayer?: (id: string, name: string, url: string, i3sProvider: any) => void;
  onRemoveI3sLayer?: (id: string) => void;
  onToggleI3sLayerVisibility?: (id: string) => void;
  onUpdateI3sLayerHeightOffset?: (id: string, offset: number) => void;

  // Multi-Layer GIS Manager Props
  gisLayers?: any[];
  onAddGisLayer?: (polygon: any, filename: string, shapefileData: any) => void;
  onRemoveGisLayer?: (id: string) => void;
  onToggleGisLayerVisibility?: (id: string) => void;
  onGisLayerOpacityChange?: (id: string, opacity: number) => void;
  onGisLayerCustomColorChange?: (id: string, color: string) => void;
  onGisLayerCustomAlphaChange?: (id: string, alpha: number) => void;
  onGisLayerLineWidthChange?: (id: string, width: number) => void;
  onGisLayerLineTypeChange?: (id: string, type: string) => void;
  onGisLayerCatchmentRadiusChange?: (id: string, radius: number) => void;
  onGisLayerCatchmentColorChange?: (id: string, color: string) => void;
  onGisLayerVisualizationModeChange?: (id: string, mode: 'solid' | 'choropleth' | 'alpha_blended' | 'none') => void;
  onGisLayerAlphaBlendIntensityChange?: (id: string, intensity: number) => void;
  onGisLayerChoroplethAttributeChange?: (id: string, attr: string) => void;
  onGisLayerChoroplethMinColorChange?: (id: string, color: string) => void;
  onGisLayerChoroplethMaxColorChange?: (id: string, color: string) => void;
  onGisLayerShowLegendChange?: (id: string, showLegend: boolean) => void;
  onLocateGisLayer?: (bounds: any) => void;

  // Presentation Compilation Props
  cameraKeyframes?: any[];
  token?: string | null;
  projectionMode?: 'perspective' | 'orthographic';
  fovAngle?: number;

  massingBaseArea?: number | null;
  onMassingBaseAreaChange?: (area: number | null) => void;
  massingFloors?: number;
  onMassingFloorsChange?: (floors: number) => void;
  massingFloorHeight?: number;
  onMassingFloorHeightChange?: (height: number) => void;
  massingPlotSize?: number;
  onMassingPlotSizeChange?: (size: number) => void;
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
  onFlyToMassing?: () => void;
  sidebarTheme?: 'light' | 'dark';
  onSidebarThemeChange?: (theme: 'light' | 'dark') => void;
  isSidebarExpanded?: boolean;
  onSidebarExpandedChange?: (expanded: boolean) => void;
  pickedAssetMetadata?: { name: string; attributes: Record<string, any> } | null;
  onPickedAssetMetadataChange?: (metadata: { name: string; attributes: Record<string, any> } | null) => void;

  // Points of Interest & Landmarks Props
  currentLandmarks?: any[];
  setCurrentLandmarks?: (landmarks: any[]) => void;
  selectedPOI?: any;
  setSelectedPOI?: (poi: any) => void;
  isDetailPanelOpen?: boolean;
  setIsDetailPanelOpen?: (open: boolean) => void;
  isGalleryOpen?: boolean;
  setIsGalleryOpen?: (open: boolean) => void;
  galleryImages?: string[];
  setGalleryImages?: (images: string[]) => void;
  isLoadingPOI?: boolean;
  setIsLoadingPOI?: (loading: boolean) => void;
  landmarkError?: string | null;
  onRefreshLandmarks?: () => void;
  onFlyToLandmark?: (lon: number, lat: number) => void;
  activeTab?: 'controls' | 'layers' | 'metrics' | 'import' | 'tools' | 'ai-render' | 'cesium-assets' | 'landmarks' | 'simulation';
  onActiveTabChange?: (tab: 'controls' | 'layers' | 'metrics' | 'import' | 'tools' | 'ai-render' | 'cesium-assets' | 'landmarks' | 'simulation') => void;

  // Underground Utilities Layering & Attribute props
  disabledUtilityLayers?: string[];
  onDisabledUtilityLayersChange?: (disabled: string[]) => void;
  selectedPipeAttribute?: string;
  onSelectedPipeAttributeChange?: (attr: string) => void;
  useActualDiameter?: boolean;
  onUseActualDiameterChange?: (enabled: boolean) => void;

  // Multi-Token Cesium Ion Accounts
  ionAccounts?: IonAccount[];
  onIonAccountsChange?: (accounts: IonAccount[]) => void;
  onFlyToIonAsset?: (accountId: string, assetId: number) => void;

  // Solar Arc Center / Analysis Center Props
  activeAnalysisCenter?: { latitude: number; longitude: number; height?: number } | null;
  onActiveAnalysisCenterChange?: (center: { latitude: number; longitude: number; height?: number } | null) => void;

  // Intro Welcome Overlay trigger
  onOpenIntro?: () => void;
  onOpenNavInstructions?: () => void;
}

const landmarkContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
};

const landmarkItemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: 'spring', 
      stiffness: 120, 
      damping: 14 
    } 
  }
};

export default function Sidebar({ 
  sidebarTheme = 'dark',
  onSidebarThemeChange,
  workspaceOrigin = { lat: 24.4539, lng: 54.3773 },
  onWorkspaceOriginChange,
  onFlyTo, 
  selectedPreset,
  globeState, 
  setGlobeState, 
  layers, 
  onToggleLayer,
  isConnected = false,
  onConfigureToken,
  polygonData,
  onPolygonDataChange,
  textureUrl,
  onTextureUrlChange,
  onLayerTextureChange,
  shapefileName,
  textureName,
  onFlyToPolygon,
  clippingMode,
  onClippingModeChange,
  clip3dTiles = true,
  onClip3dTilesChange,
  shapefileData = null,
  selectedMetric = 'Population',
  onSelectedMetricChange,
  extrudeHeights = false,
  onExtrudeHeightsChange,
  shapefileHeightMultiplier = 1.00,
  onShapefileHeightMultiplierChange,
  sunHour,
  onSunHourChange,
  sunShadowsEnabled,
  onSunShadowsEnabledChange,
  shadowDarkness = 0.3,
  onShadowDarknessChange,
  softShadows = true,
  onSoftShadowsChange,
  shadowBias = 0.005,
  onShadowBiasChange,
  normalOffsetBias = 0.5,
  onNormalOffsetBiasChange,
  shadowMaxDistance = 3000,
  onShadowMaxDistanceChange,
  shadowMapResolution = 4096,
  onShadowMapResolutionChange,
  realisticLighting = true,
  onRealisticLightingChange,
  ambientLightingIntensity = 0.65,
  onAmbientLightingIntensityChange,
  nightAmbientIntensity = 0.05,
  onNightAmbientIntensityChange,
  hdrPipelineEnabled = true,
  onHdrPipelineEnabledChange,
  sunLightAmbientPbr = true,
  onSunLightAmbientPbrChange,
  iblReflectionFactor = 1.0,
  onIblReflectionFactorChange,
  zenithLuminance = 0.20,
  onZenithLuminanceChange,
  ssaoEnabled = false,
  onSsaoEnabledChange,
  ssaoIntensity = 1.0,
  onSsaoIntensityChange,
  eyeAdaptationTonemap = true,
  onEyeAdaptationTonemapChange,
  bloomGlareEnabled = false,
  onBloomGlareEnabledChange,
  solarPathEnabled,
  onSolarPathEnabledChange,
  solarPathRadius,
  onSolarPathRadiusChange,
  activeTool,
  onActiveToolChange,
  subsurfaceCameraEnabled = false,
  onSubsurfaceCameraEnabledChange,
  terrainOpacity = 1.0,
  onTerrainOpacityChange,
  subsurfaceUtilitiesVisible = true,
  onSubsurfaceUtilitiesVisibleChange,
  utilitiesShapefileData = null,
  utilitiesShapefileName = null,
  onUtilitiesShapefileDataChange,
  excavationDepth = 15,
  excavationArea = null,
  onExcavationDepthChange,
  onClearExcavation,
  viewCorridorNode1,
  onViewCorridorNode1Change,
  viewCorridorNode2,
  onViewCorridorNode2Change,
  viewCorridorSimulationActive = false,
  onViewCorridorSimulationActiveChange,
  viewCorridorLensMm = 50,
  onViewCorridorLensMmChange,
  viewCorridorFovX = 30,
  onViewCorridorFovXChange,
  viewCorridorFovY = 20,
  onViewCorridorFovYChange,
  viewCorridorBuffer = 0,
  onViewCorridorBufferChange,
  viewCorridorVisible = true,
  onViewCorridorVisibleChange,
  viewCorridorEncroached = false,
  viewCorridorViolationHeight = 0,
  placedTrees = [],
  onPlacedTreesChange,
  treeModelUrl = 'https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb',
  onTreeModelUrlChange,
  measureResult,
  onClearMeasurements,
  terrainOverlay = 'none',
  onTerrainOverlayChange,
  contourInterval = 5.0,
  onContourIntervalChange,
  boundaryBounds = null,
  onClearBoundaryBounds,
  boundaryShape = 'circle',
  onBoundaryShapeChange,
  boundaryRadius = 1000,
  onBoundaryRadiusChange,
  boundaryCenter = null,
  onBoundaryCenterChange,
  swipeEnabled = false,
  onSwipeEnabledChange,
  isSplitActive = false,
  onIsSplitActiveChange,
  splitSyncCameras = true,
  onSplitSyncCamerasChange,
  splitSyncLayers = true,
  onSplitSyncLayersChange,
  radiationGradientScale = 1.0,
  onRadiationGradientScaleChange,
  selectedDate,
  onSelectedDateChange,
  googleLabelsEnabled = false,
  onGoogleLabelsEnabledChange,
  googleLabelsAlpha = 1.0,
  onGoogleLabelsAlphaChange,
  rtxUltraEnabled = false,
  simulationTimezone = 'auto',
  onSimulationTimezoneChange,
  activeTimezoneOffset = -5,
  detectedTimezone = null,
  ionAssets = {
    tilesetId: '',
    tilesetEnabled: false,
    terrainId: '',
    terrainEnabled: false,
    imageryId: '',
    imageryEnabled: false,
  },
  onIonAssetsChange,
  ionAssetError,
  onIonAssetErrorChange,
  savedViews,
  onTriggerSaveView,
  onDeleteSavedView,
  onReorderSavedViews,
  onImportSavedViews,
  onSaveProject,
  onOpenProject,
  onNewProject,
  autoSaveEnabled = false,
  onAutoSaveEnabledChange,
  onTriggerExportViewport,
  onTriggerAiScreenshot,
  aiScreenshotDataUrl,
  onClearAiScreenshot,
  showSafeFrame = false,
  onShowSafeFrameChange,
  activeAnalysisCenter = null,
  onActiveAnalysisCenterChange,
  maxSSE = 16.0,
  onMaxSSEChange,
  tileCacheSize = 512,
  onTileCacheSizeChange,
  skipLevelOfDetail = true,
  onSkipLevelOfDetailChange,
  modelUrl,
  modelName,
  modelLatitude,
  modelLongitude,
  modelHeight,
  modelClampToTerrain,
  modelApplySketchUpProfile,
  modelHeading,
  modelPitch,
  modelRoll,
  onModelUrlChange,
  isPickingLocation = false,
  onIsPickingLocationChange,
  onModelLatitudeChange,
  onModelLongitudeChange,
  onModelHeightChange,
  onModelClampToTerrainChange,
  onModelApplySketchUpProfileChange,
  onModelHeadingChange,
  onModelPitchChange,
  onModelRollChange,
  onFlyToModel,
  localVectorUrl = null,
  localVectorName = null,
  localVectorType = null,
  onLocalVectorChange,
  streamedTilesetId = null,
  streamedTilesetVisible = true,
  onStreamedTilesetIdChange,
  importedLayers = [],
  activeLayerId = null,
  selectedLayerIds = [],
  onImportedLayersChange,
  onActiveLayerIdChange,
  onToggleLayerVisibility,
  onToggleStreamedTilesetVisibility,
  onDeleteLayer,
  onDeleteFeature,
  gisLayers = [],
  onAddGisLayer,
  onRemoveGisLayer,
  onToggleGisLayerVisibility,
  onGisLayerOpacityChange,
  onGisLayerCustomColorChange,
  onGisLayerCustomAlphaChange,
  onGisLayerLineWidthChange,
  onGisLayerLineTypeChange,
  onGisLayerCatchmentRadiusChange,
  onGisLayerCatchmentColorChange,
  onGisLayerVisualizationModeChange,
  onGisLayerAlphaBlendIntensityChange,
  onGisLayerChoroplethAttributeChange,
  onGisLayerChoroplethMinColorChange,
  onGisLayerChoroplethMaxColorChange,
  onGisLayerShowLegendChange,
  onLocateGisLayer,
  cameraKeyframes = [],
  token = null,
  projectionMode = 'perspective',
  fovAngle = 60,
  massingBaseArea = null,
  onMassingBaseAreaChange,
  massingFloors = 5,
  onMassingFloorsChange,
  massingFloorHeight = 3.5,
  onMassingFloorHeightChange,
  massingPlotSize = 2000,
  onMassingPlotSizeChange,
  massingColor = '#ffffff',
  onMassingColorChange,
  massingOpacity = 1.0,
  onMassingOpacityChange,
  massingLevelColor = '#808080',
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
  onFlyToMassing,
  accountRole,
  i3sLayers = [],
  onAddI3sLayer,
  onRemoveI3sLayer,
  onToggleI3sLayerVisibility,
  onUpdateI3sLayerHeightOffset,
  pickedAssetMetadata = null,
  onPickedAssetMetadataChange,
  activeLayers = [],
  setActiveLayers,
  layersOrder = [],
  onLayersOrderChange,
  currentLandmarks = [],
  setCurrentLandmarks,
  selectedPOI = null,
  setSelectedPOI,
  isDetailPanelOpen = false,
  setIsDetailPanelOpen,
  isGalleryOpen = false,
  setIsGalleryOpen,
  galleryImages = [],
  setGalleryImages,
  isLoadingPOI = false,
  setIsLoadingPOI,
  landmarkError = null,
  onRefreshLandmarks,
  onFlyToLandmark,
  activeTab = 'import',
  onActiveTabChange,
  disabledUtilityLayers = [],
  onDisabledUtilityLayersChange,
  selectedPipeAttribute = 'PIPEDIAMET',
  onSelectedPipeAttributeChange,
  useActualDiameter = true,
  onUseActualDiameterChange,
  ionAccounts = [],
  onIonAccountsChange,
  onFlyToIonAsset,
  onOpenIntro,
  onOpenNavInstructions,
  isSidebarExpanded,
  onSidebarExpandedChange
}: SidebarProps) {
  const [maxSse, setMaxSse] = useState(16);
  const [landmarkCategoryFilter, setLandmarkCategoryFilter] = useState<'all' | 'historical' | 'tourism' | 'monument'>('all');
  const [landmarkSearchQuery, setLandmarkSearchQuery] = useState('');
  const [i3sUrlInput, setI3sUrlInput] = useState('');
  const [isLoadingI3s, setIsLoadingI3s] = useState(false);
  const [i3sError, setI3sError] = useState<string | null>(null);
  const [forceDirectI3s, setForceDirectI3s] = useState(false);
  const [passCredentials, setPassCredentials] = useState(true);

  // Helper to detect if running strictly inside the AI Studio development environment container
  const isDeveloperOrAIStudio = () => {
    if (typeof window === 'undefined') return false;
    
    // In production builds (such as exported IIS packages or deployed sites), import.meta.env.DEV is false.
    const isDev = Boolean(import.meta.env.DEV);
    if (!isDev) return false;

    // Additionally verify that hostname belongs to the AI Studio dev container
    const host = window.location.hostname;
    const isAiStudioHost = 
      host.includes('ais-dev') || 
      host.includes('ais-pre') || 
      host.includes('ai.studio') ||
      host.includes('run.app');

    return isAiStudioHost;
  };

  // IIS Web Package Export State & Handler
  const [isExportingIIS, setIsExportingIIS] = useState(false);
  const [iisExportMessage, setIisExportMessage] = useState<string | null>(null);
  const [showIisModal, setShowIisModal] = useState(false);

  const handleExportIISPackage = async () => {
    try {
      setIsExportingIIS(true);
      setIisExportMessage('Executing production build (npm run build) & embedding IIS web.config...');
      setShowIisModal(true);

      const response = await fetch(getApiUrl('/api/export-iis'), {
        method: 'GET'
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned status ${response.status}`);
      }

      setIisExportMessage('Generating ZIP package with Cesium MIME mappings & SPA rewrites...');
      const blob = await response.blob();

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Geosphere_3D_IIS_Package.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setIisExportMessage('Package exported successfully! Downloaded Geosphere_3D_IIS_Package.zip.');
    } catch (err: any) {
      console.error('IIS Export Error:', err);
      setIisExportMessage(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingIIS(false);
    }
  };

  // Multi-Token Ion Accounts Manager State & Handlers
  const [inputIonToken, setInputIonToken] = useState('');
  const [inputAccountAlias, setInputAccountAlias] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});
  const [manualAssetInputs, setManualAssetInputs] = useState<Record<string, { assetId: string; name: string; type: string }>>({});
  const [showManualAddForm, setShowManualAddForm] = useState<Record<string, boolean>>({});

  // Helper to parse Cesium Ion JWT tokens and inspect claims
  const parseCesiumJwt = (tokenStr: string): Record<string, any> | null => {
    try {
      const parts = tokenStr.trim().split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (_) {
      return null;
    }
  };

  // Helper to extract explicit authorized asset IDs from JWT claims if present
  const extractAllowedAssetIds = (decoded: Record<string, any> | null): number[] | null => {
    if (!decoded) return null;
    const rawList = decoded.assets || decoded.assetIds || decoded.allowedAssets || decoded.selectedAssets;
    if (Array.isArray(rawList)) {
      const ids: number[] = [];
      for (const item of rawList) {
        if (typeof item === 'number' && item > 0) {
          ids.push(item);
        } else if (typeof item === 'string' && /^\d+$/.test(item)) {
          ids.push(parseInt(item, 10));
        } else if (item && typeof item === 'object' && item.id && !isNaN(Number(item.id))) {
          ids.push(Number(item.id));
        }
      }
      if (ids.length > 0) return ids;
    }
    return null;
  };

  // Helper to verify if a token can access a specific asset's streaming endpoint
  const verifyAssetAccessWithToken = async (assetId: number, tokenStr: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.cesium.com/v1/assets/${assetId}/endpoint`, {
        headers: { Authorization: `Bearer ${tokenStr}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch (_) {
      return false;
    }
  };

  const handleScanAccountAssets = async (explicitToken?: string | unknown, targetIdOverride?: string) => {
    const rawToken = typeof explicitToken === 'string' ? explicitToken : inputIonToken;
    const tokenToScan = (rawToken || '').trim();
    if (!tokenToScan) {
      setScanError('Please paste a valid Cesium Ion access token.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanNote(null);

    try {
      const decodedJwt = parseCesiumJwt(tokenToScan);
      const specificAllowedIds = extractAllowedAssetIds(decodedJwt);
      const jwtTokenName = decodedJwt?.name ? String(decodedJwt.name).trim() : '';

      let discoveredName = inputAccountAlias.trim();
      if (!discoveredName && jwtTokenName) {
        discoveredName = jwtTokenName;
      }

      if (!discoveredName) {
        try {
          const userRes = await fetch('https://api.cesium.com/v1/me', {
            headers: { Authorization: `Bearer ${tokenToScan}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.username || userData.email) {
              discoveredName = userData.username || userData.email;
            }
          }
        } catch (_) {}
      }

      if (!discoveredName) {
        discoveredName = `Account (${tokenToScan.slice(0, 6)}...${tokenToScan.slice(-4)})`;
      }

      let parsedAssets: IonAccountAsset[] = [];
      let scanWarning = '';

      // CASE 1: Token JWT explicitly contains the specific authorized asset IDs
      if (specificAllowedIds && specificAllowedIds.length > 0) {
        // Fetch metadata specifically for each authorized asset
        const assetFetchPromises = specificAllowedIds.map(async (assetId) => {
          let assetItem: IonAccountAsset = {
            id: assetId,
            name: `Asset #${assetId}`,
            type: '3DTILES',
            loaded: false,
            visible: true,
          };
          try {
            const metaRes = await fetch(`https://api.cesium.com/v1/assets/${assetId}`, {
              headers: { Authorization: `Bearer ${tokenToScan}` },
            });
            if (metaRes.ok) {
              const data = await metaRes.json();
              assetItem = {
                id: Number(data.id || assetId),
                name: data.name || `Asset #${assetId}`,
                type: (data.type || '3DTILES').toUpperCase(),
                description: data.description || '',
                bytes: data.bytes,
                dateAdded: data.dateAdded,
                status: data.status,
                loaded: false,
                visible: true,
              };
            } else {
              const epRes = await fetch(`https://api.cesium.com/v1/assets/${assetId}/endpoint`, {
                headers: { Authorization: `Bearer ${tokenToScan}` },
              });
              if (epRes.ok) {
                const epData = await epRes.json();
                if (epData.type) {
                  assetItem.type = epData.type.toUpperCase();
                }
              }
            }
          } catch (_) {}
          return assetItem;
        });

        parsedAssets = await Promise.all(assetFetchPromises);
        scanWarning = `Scoped Token verified: Loaded only the ${parsedAssets.length} asset${parsedAssets.length === 1 ? '' : 's'} authorized for this specific token.`;
      } else {
        // CASE 2: Token does not have explicit JWT asset claims. Query /v1/assets and verify authorization per asset
        let rawItems: any[] = [];
        let missingListScope = false;

        try {
          const assetsRes = await fetch('https://api.cesium.com/v1/assets', {
            headers: { Authorization: `Bearer ${tokenToScan}` },
          });

          if (assetsRes.ok) {
            const assetsData = await assetsRes.json();
            rawItems = assetsData.items || [];
          } else {
            let errDetail = '';
            try {
              const errData = await assetsRes.json();
              errDetail = errData?.message || errData?.code || '';
            } catch (_) {}

            if (assetsRes.status === 404 || assetsRes.status === 403) {
              missingListScope = true;
              scanWarning = `Specific token registered! (Global asset listing returned ${assetsRes.status}). Use the '+ Add Asset by ID' button below to load your token's specific asset.`;
            } else if (assetsRes.status === 401) {
              throw new Error(`Cesium Ion 401 (Unauthorized): ${errDetail || 'Invalid or expired access token'}.`);
            } else {
              throw new Error(`Cesium API error (${assetsRes.status}): ${errDetail || assetsRes.statusText || 'Unable to scan assets'}.`);
            }
          }
        } catch (fetchErr: any) {
          if (!missingListScope) {
            throw fetchErr;
          }
        }

        if (rawItems.length > 0) {
          // Verify access for each asset so we only keep assets accessible by this specific token
          const verificationChecks = await Promise.all(
            rawItems.map(async (item: any) => {
              const assetId = Number(item.id);
              const hasAccess = await verifyAssetAccessWithToken(assetId, tokenToScan);
              return { item, hasAccess };
            })
          );

          const accessibleItems = verificationChecks
            .filter(check => check.hasAccess)
            .map(check => check.item);

          // If filtering removed unauthorized assets, inform the user
          if (accessibleItems.length < rawItems.length && accessibleItems.length > 0) {
            scanWarning = `Filtered inventory: Showing only the ${accessibleItems.length} of ${rawItems.length} asset${accessibleItems.length === 1 ? '' : 's'} authorized for this specific token.`;
          }

          const itemsToUse = accessibleItems.length > 0 ? accessibleItems : rawItems;

          parsedAssets = itemsToUse.map((item: any) => ({
            id: Number(item.id),
            name: item.name || `Asset #${item.id}`,
            type: (item.type || '3DTILES').toUpperCase(),
            description: item.description || '',
            bytes: item.bytes,
            dateAdded: item.dateAdded,
            status: item.status,
            loaded: false,
            visible: true,
          }));
        }
      }

      const newAccountId = targetIdOverride || ('acc_' + Date.now());
      const existingAccountIndex = (ionAccounts || []).findIndex(acc => acc.token === tokenToScan);

      let updatedAccounts: IonAccount[];
      let targetAccountId = newAccountId;

      if (existingAccountIndex >= 0) {
        targetAccountId = ionAccounts![existingAccountIndex].id;
        const existingAssets = ionAccounts![existingAccountIndex].assets || [];
        const mergedAssets = parsedAssets.length > 0
          ? parsedAssets.map(newAsset => {
              const match = existingAssets.find(ea => ea.id === newAsset.id);
              if (match) {
                return { ...newAsset, loaded: match.loaded, visible: match.visible };
              }
              return newAsset;
            })
          : existingAssets;

        updatedAccounts = ionAccounts!.map((acc, idx) =>
          idx === existingAccountIndex
            ? { ...acc, accountName: discoveredName, assets: mergedAssets }
            : acc
        );
      } else {
        const newAccount: IonAccount = {
          id: newAccountId,
          accountName: discoveredName,
          token: tokenToScan,
          assets: parsedAssets,
        };
        updatedAccounts = [...(ionAccounts || []), newAccount];
      }

      onIonAccountsChange?.(updatedAccounts);
      setExpandedAccountIds(prev => ({ ...prev, [targetAccountId]: true }));
      const isExplicitTokenPassed = typeof explicitToken === 'string' && explicitToken.length > 0;
      if (!isExplicitTokenPassed) {
        setInputIonToken('');
        setInputAccountAlias('');
      }
      if (scanWarning) {
        setScanNote(scanWarning);
      } else {
        setScanNote(`Successfully discovered ${parsedAssets.length} asset${parsedAssets.length === 1 ? '' : 's'} for ${discoveredName}.`);
      }
    } catch (err: any) {
      console.warn('Scan Account Assets notice:', err?.message || err);
      setScanError(err.message || 'Failed to scan account assets. Please check token and network connection.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualAddAssetToAccount = (accountId: string) => {
    const input = manualAssetInputs[accountId];
    if (!input || !input.assetId.trim()) return;

    const parsedId = parseInt(input.assetId.trim(), 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      setScanError('Asset ID must be a valid positive number.');
      return;
    }

    if (!ionAccounts) return;
    const account = ionAccounts.find(acc => acc.id === accountId);
    if (!account) return;

    const assetType = (input.type || '3DTILES').toUpperCase();
    const assetName = input.name.trim() || `Asset #${parsedId}`;

    const exists = account.assets.some(a => a.id === parsedId);
    let updatedAccounts: IonAccount[];

    if (exists) {
      updatedAccounts = ionAccounts.map(acc => {
        if (acc.id !== accountId) return acc;
        return {
          ...acc,
          assets: acc.assets.map(a => a.id === parsedId ? { ...a, loaded: true, visible: true } : a)
        };
      });
    } else {
      const newAsset: IonAccountAsset = {
        id: parsedId,
        name: assetName,
        type: assetType,
        loaded: true,
        visible: true,
      };
      updatedAccounts = ionAccounts.map(acc => {
        if (acc.id !== accountId) return acc;
        return {
          ...acc,
          assets: [newAsset, ...acc.assets]
        };
      });
    }

    onIonAccountsChange?.(updatedAccounts);
    setManualAssetInputs(prev => ({
      ...prev,
      [accountId]: { assetId: '', name: '', type: '3DTILES' }
    }));
    setShowManualAddForm(prev => ({ ...prev, [accountId]: false }));
    setScanError(null);
    setScanNote(`Asset #${parsedId} (${assetName}) added to inventory and loaded.`);
  };

  const handleRemoveAssetFromAccount = (accountId: string, assetId: number) => {
    if (!ionAccounts) return;
    const updated = ionAccounts.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        assets: acc.assets.filter(a => a.id !== assetId)
      };
    });
    onIonAccountsChange?.(updated);
  };

  const handleToggleAssetLoad = (accountId: string, assetId: number) => {
    if (!ionAccounts) return;
    let assetWasJustLoaded = false;
    const updated = ionAccounts.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        assets: acc.assets.map(asset => {
          if (asset.id !== assetId) return asset;
          const newLoaded = !asset.loaded;
          if (newLoaded) assetWasJustLoaded = true;
          return {
            ...asset,
            loaded: newLoaded,
            visible: newLoaded ? true : asset.visible,
          };
        }),
      };
    });
    onIonAccountsChange?.(updated);

    if (assetWasJustLoaded) {
      setGlobeState(prev => ({
        ...prev,
        buildings3dEnabled: false,
        terrainEnabled: false
      }));
      if (layers.find(l => l.id === 'osm-buildings')?.enabled) {
        onToggleLayer('osm-buildings');
      }
    }
  };

  const handleToggleAssetVisibility = (accountId: string, assetId: number) => {
    if (!ionAccounts) return;
    const updated = ionAccounts.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        assets: acc.assets.map(asset => {
          if (asset.id !== assetId) return asset;
          return {
            ...asset,
            visible: !asset.visible,
          };
        }),
      };
    });
    onIonAccountsChange?.(updated);
  };

  const handleFlyToIonAssetWithVisibility = (accountId: string, assetId: number) => {
    if (ionAccounts) {
      let changed = false;
      const updated = ionAccounts.map(acc => {
        if (acc.id !== accountId) return acc;
        return {
          ...acc,
          assets: acc.assets.map(asset => {
            if (asset.id !== assetId) return asset;
            if (!asset.loaded || asset.visible === false) {
              changed = true;
              return {
                ...asset,
                loaded: true,
                visible: true,
              };
            }
            return asset;
          }),
        };
      });
      if (changed) {
        onIonAccountsChange?.(updated);
      }
    }
    onFlyToIonAsset?.(accountId, assetId);
  };

  const handleRemoveAccount = (accountId: string) => {
    if (!ionAccounts) return;
    const updated = ionAccounts.filter(acc => acc.id !== accountId);
    onIonAccountsChange?.(updated);
  };

  const handleUpdateIonAssetOutline = (accountId: string, assetId: number, color?: string, opacity?: number, thickness?: number, enabled?: boolean) => {
    if (!ionAccounts) return;
    const updated = ionAccounts.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        assets: acc.assets.map(asset => {
          if (asset.id !== assetId) return asset;
          return {
            ...asset,
            outlineColor: color !== undefined ? color : (asset.outlineColor || '#000000'),
            outlineOpacity: opacity !== undefined ? opacity : (asset.outlineOpacity !== undefined ? asset.outlineOpacity : 1.0),
            outlineThickness: thickness !== undefined ? thickness : (asset.outlineThickness !== undefined ? asset.outlineThickness : 2.5),
            outlineEnabled: enabled !== undefined ? enabled : (asset.outlineEnabled !== undefined ? asset.outlineEnabled : true),
          };
        }),
      };
    });
    onIonAccountsChange?.(updated);
  };

  const handleUpdateImportedLayerOutline = (layerId: string, color?: string, opacity?: number, thickness?: number, enabled?: boolean) => {
    if (!importedLayers) return;
    const updated = importedLayers.map(l => {
      if (l.id !== layerId) return l;
      return {
        ...l,
        outlineColor: color !== undefined ? color : (l.outlineColor || '#000000'),
        outlineOpacity: opacity !== undefined ? opacity : (l.outlineOpacity !== undefined ? l.outlineOpacity : 1.0),
        outlineThickness: thickness !== undefined ? thickness : (l.outlineThickness !== undefined ? l.outlineThickness : 2.5),
        silhouetteColor: color !== undefined ? color : (l.silhouetteColor || '#000000'),
        outlineEnabled: enabled !== undefined ? enabled : (l.outlineEnabled !== undefined ? l.outlineEnabled : true),
      };
    });
    onImportedLayersChange?.(updated);
  };

  const calculateDistance = (landmarkLat: number, landmarkLon: number) => {
    if (!workspaceOrigin) return '';
    try {
      const from = turf.point([workspaceOrigin.lng, workspaceOrigin.lat]);
      const to = turf.point([landmarkLon, landmarkLat]);
      const distance = turf.distance(from, to, { units: 'meters' });
      if (distance >= 1000) {
        return `${(distance / 1000).toFixed(2)} km`;
      }
      return `${Math.round(distance)} m`;
    } catch (e) {
      return '';
    }
  };

  const handlePOISelect = async (poi: any) => {
    if (!poi) return;
    
    if (onFlyToLandmark) {
      onFlyToLandmark(poi.lon, poi.lat);
    }
    
    if (setSelectedPOI) {
      setSelectedPOI(poi);
    }
    if (setIsDetailPanelOpen) {
      setIsDetailPanelOpen(true);
    }
    
    try {
      const res = await fetch(getApiUrl('/api/poi-details'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: poi.tags?.name || poi.name || 'Historic Landmark',
          latitude: poi.lat,
          longitude: poi.lon,
          type: poi.tags?.historic || poi.tags?.tourism || 'landmark'
        })
      });
      const data = await res.json();
      if (data && setSelectedPOI) {
        const summary = data.description || data.summary || '';
        const images = data.gallery || data.images || [];
        const funFacts = data.funFacts || [];
        const citations = data.citations || [];

        setSelectedPOI((prev: any) => ({
          ...prev,
          summary,
          images,
          funFacts,
          citations
        }));
        if (images.length > 0 && setGalleryImages) {
          setGalleryImages(images);
        }
      }
    } catch (e) {
      console.error('Error loading POI details:', e);
    }
  };

  const handleSearchViewportLandmarks = async () => {
    const viewer = (window as any).cesiumViewer;
    if (!viewer) return;
    if (setIsLoadingPOI) setIsLoadingPOI(true);

    // 1. Get exact center latitude & longitude of the current camera view
    const windowPosition = new Cesium.Cartesian2(
      viewer.canvas.clientWidth / 2,
      viewer.canvas.clientHeight / 2
    );
    const pickRay = viewer.camera.getPickRay(windowPosition);
    if (!pickRay) {
      if (setIsLoadingPOI) setIsLoadingPOI(false);
      return;
    }
    const cartesian = viewer.scene.globe.pick(pickRay, viewer.scene);

    if (!cartesian) {
      if (setIsLoadingPOI) setIsLoadingPOI(false);
      alert("Please tilt or point the camera directly at terrain to search.");
      return;
    }

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);

    // 2. Fetch landmarks near the center point
    const query = `[out:json][timeout:15];(node["historical"](around:5000,${lat},${lon});node["tourism"="attraction"](around:5000,${lat},${lon}););out 15;`;

    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();

      const formatted = data.elements
        .map((el: any) => ({
          id: el.id,
          name: el.tags?.name || el.tags?.description || "Historical Sight",
          lat: el.lat,
          lon: el.lon,
          tags: el.tags || {}
        }))
        .filter((el: any) => el.name);

      if (setCurrentLandmarks) setCurrentLandmarks(formatted);
    } catch (err) {
      console.warn("POI Search failed, trying fallback mirror...", err);
      try {
        const fallbackRes = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          const formatted = data.elements
            .map((el: any) => ({
              id: el.id,
              name: el.tags?.name || el.tags?.description || "Historical Sight",
              lat: el.lat,
              lon: el.lon,
              tags: el.tags || {}
            }))
            .filter((el: any) => el.name);

          if (setCurrentLandmarks) setCurrentLandmarks(formatted);
        } else {
          throw new Error("Fallback error");
        }
      } catch (fallbackErr) {
        console.warn("Fallback mirror failed as well, using local cache fallback:", fallbackErr);
        const prefixes = ["Historic", "Ancient", "Cultural", "Scenic", "Heritage", "Imperial", "Centennial", "Old Town", "Royal"];
        const objects = ["Monastery", "Fortress", "Plaza", "Monument", "Observatory", "Palace Ruins", "Cathedral", "Temple Site", "Avenue Point", "Tower"];
        const tagsList = [
          { historic: "monument", tourism: "attraction" },
          { historic: "archaeological_site", tourism: "attraction" },
          { historic: "castle", tourism: "museum" },
          { historic: "monument", tourism: "monument" },
          { historic: "fort", tourism: "attraction" }
        ];

        const seed = Math.sin(lat) * Math.cos(lon);
        const fallbackPOIs = [];
        for (let i = 0; i < 6; i++) {
          const localSeed = Math.abs(Math.sin(seed + i * 1.57));
          const prefix = prefixes[Math.floor(localSeed * prefixes.length)];
          const obj = objects[Math.floor((localSeed * 13) % objects.length)];
          const tag = tagsList[Math.floor((localSeed * 7) % tagsList.length)];
          
          const latOffset = (localSeed * 0.02 - 0.01) * 0.5;
          const lonOffset = (Math.cos(seed + i) * 0.02 - 0.01) * 0.5;
          
          fallbackPOIs.push({
            id: 999000 + i,
            name: `${prefix} ${obj}`,
            lat: lat + latOffset,
            lon: lon + lonOffset,
            tags: tag
          });
        }
        if (setCurrentLandmarks) setCurrentLandmarks(fallbackPOIs);
      }
    } finally {
      if (setIsLoadingPOI) setIsLoadingPOI(false);
    }
  };



  const handleFlyToI3sLayer = (lyr: any) => {
    const viewer = (window as any).cesiumViewer;
    if (!viewer) return;
    const provider = lyr.provider;
    if (!provider) return;

    let center = provider.extent;
    if (!center && provider.layers && provider.layers.length > 0) {
      center = provider.layers[0].extent;
    }
    try {
      if (viewer.scene && !viewer.scene.isDestroyed()) viewer.scene.requestRender();
      if (center) {
        viewer.camera.flyTo({ destination: center, complete: () => {}, cancel: () => {} });
      } else {
        if (provider.layers && provider.layers.length > 0) {
          for (const layer of provider.layers) {
            if (layer.tileset && layer.tileset.boundingSphere) {
              viewer.camera.flyToBoundingSphere(layer.tileset.boundingSphere, { duration: 3.0, complete: () => {}, cancel: () => {} });
              return;
            }
          }
        }
      }
    } catch (e) {
      console.warn('flyTo Provider extent failed:', e);
    }
  };

  const handleFlyToImportedLayer = (lyr: any) => {
    // Select this layer as the active one so transform tools can edit it
    onActiveLayerIdChange?.(lyr.id);

    const viewer = (window as any).cesiumViewer;
    if (!viewer) return;

    if (lyr.type === 'clipping_polygon') {
      const clipEntity = viewer.entities.getById(`clipping-polygon-outline-${lyr.id}`) || viewer.entities.getById(`clipping-polygon-entity-${lyr.id}`);
      if (clipEntity) {
        viewer.flyTo(clipEntity, { duration: 2.0 }).catch(() => {});
        return;
      }
      if (lyr.bounds) {
        const centerLon = (lyr.bounds.minLon + lyr.bounds.maxLon) / 2;
        const centerLat = (lyr.bounds.minLat + lyr.bounds.maxLat) / 2;
        const centerPos = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 50);
        const sphere = new Cesium.BoundingSphere(centerPos, 200);
        viewer.camera.flyToBoundingSphere(sphere, { duration: 2.0 });
        return;
      }
    }

    const entity = viewer.entities.getById(lyr.id);
    if (entity) {
      viewer.flyTo(entity, {
        duration: 3.0,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-30),
          150.0
        )
      }).catch(() => {
        try {
          const position = Cesium.Cartesian3.fromDegrees(lyr.longitude, lyr.latitude, lyr.height || 0);
          const boundingSphere = new Cesium.BoundingSphere(position, 100);
          viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 3.0 });
        } catch (_) {}
      });
    } else {
      try {
        const position = Cesium.Cartesian3.fromDegrees(lyr.longitude, lyr.latitude, lyr.height || 0);
        const boundingSphere = new Cesium.BoundingSphere(position, 100);
        viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 3.0 });
      } catch (_) {}
    }
  };

  const handleFlyToStreamedTileset = () => {
    onActiveLayerIdChange?.('streamed-tileset');
    const viewer = (window as any).cesiumViewer;
    if (!viewer) return;

    let foundTileset: any = null;
    for (let i = 0; i < viewer.scene.primitives.length; i++) {
      const primitive = viewer.scene.primitives.get(i);
      if (primitive && (primitive instanceof Cesium.Cesium3DTileset || primitive.allTilesLoaded !== undefined)) {
        foundTileset = primitive;
        break;
      }
    }

    if (foundTileset) {
      foundTileset.show = true;
      const bs = foundTileset.boundingSphere && foundTileset.boundingSphere.radius > 0
        ? foundTileset.boundingSphere
        : (foundTileset.root && foundTileset.root.boundingSphere && foundTileset.root.boundingSphere.radius > 0
            ? foundTileset.root.boundingSphere
            : null);

      if (bs && bs.radius > 0) {
        const range = Math.max(bs.radius * 2.2, 25.0);
        viewer.camera.flyToBoundingSphere(bs, {
          duration: 2.5,
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(0),
            Cesium.Math.toRadians(-45),
            range
          )
        });
      } else {
        viewer.flyTo(foundTileset, {
          duration: 2.5
        }).catch(() => {
          try {
            const position = Cesium.Cartesian3.fromDegrees(workspaceOrigin.lng, workspaceOrigin.lat, 100);
            const boundingSphere = new Cesium.BoundingSphere(position, 200);
            viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 2.5 });
          } catch (_) {}
        });
      }
    } else {
      try {
        const position = Cesium.Cartesian3.fromDegrees(workspaceOrigin.lng, workspaceOrigin.lat, 100);
        const boundingSphere = new Cesium.BoundingSphere(position, 200);
        viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 2.5 });
      } catch (_) {}
    }
  };

  const [tilesetUrlInput, setTilesetUrlInput] = useState("");
  const safeSetActiveLayers = (updater: any) => {
    if (setActiveLayers) {
      setActiveLayers(updater);
    }
  };
  const [tilesetError, setTilesetError] = useState<string | null>(null);

  const handleStreamExternalTileset = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const viewer = (window as any).cesiumViewer;
    if (!tilesetUrlInput || !tilesetUrlInput.trim() || !viewer) return;

    const attemptErrors: string[] = [];
    if (typeof setTilesetError === 'function') setTilesetError(null);
    let cleanUrl = tilesetUrlInput.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://") && !cleanUrl.startsWith("//") && !cleanUrl.startsWith("virtual://")) {
      cleanUrl = "https://" + cleanUrl;
    }

    try {
      console.log("Streaming target asset link:", cleanUrl);

      // Normalize URL and determine base candidates
      const baseUrls: string[] = [];
      const isLocalHost = cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1") || cleanUrl.includes("::1");
      if (cleanUrl.startsWith("http://") && !isLocalHost) {
        // Try the HTTPS version first, but keep HTTP version as a fallback (highly useful via local CORS proxy)
        baseUrls.push("https://" + cleanUrl.substring(7));
        baseUrls.push(cleanUrl);
      } else {
        baseUrls.push(cleanUrl);
      }

      const isSecuredHost = cleanUrl.includes("dmt.gov.ae") || cleanUrl.includes("gisapps") || cleanUrl.includes("/gis");

      // Generate candidates: try both the original URL and a "/tileset.json" appended version if not ending in .json
      const urlsToTry: string[] = [];
      for (const bUrl of baseUrls) {
        if (!urlsToTry.includes(bUrl)) {
          urlsToTry.push(bUrl);
        }
        const strippedUrl = bUrl.replace(/\/$/, "");
        if (!strippedUrl.toLowerCase().endsWith(".json")) {
          const appended = strippedUrl + "/tileset.json";
          if (!urlsToTry.includes(appended)) {
            urlsToTry.push(appended);
          }
        }
      }

      // Helper to create a custom proxy complying with Cesium's Proxy specification.
      // This is crucial because standard query-based proxies break relative path resolution of sub-tiles
      // if wrapped directly on the base URL string.
      const createCesiumProxy = (proxyType: 'local' | 'corsproxy' | 'allorigins' | 'cors-anywhere' | 'none') => {
        if (proxyType === 'none') return undefined;
        return {
          getURL: (url: any) => {
            if (!url) return url;
            const urlStr = typeof url === 'string' ? url : (url && url.url) ? url.url : '';
            if (!urlStr) return urlStr;
            // Never proxy local resources, same-origin calls, virtual URLs, or already proxied URLs
            if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://') && !urlStr.startsWith('//')) {
              return urlStr;
            }
            if (urlStr.includes('/api/proxy') || urlStr.includes('localhost') || urlStr.includes('127.0.0.1') || urlStr.includes('::1')) {
              return urlStr;
            }

            if (proxyType === 'local') {
              return `/api/proxy?url=${encodeURIComponent(urlStr)}`;
            }
            if (proxyType === 'corsproxy') {
              return `https://corsproxy.io/?${encodeURIComponent(urlStr)}`;
            }
            if (proxyType === 'allorigins') {
              return `https://api.allorigins.win/raw?url=${encodeURIComponent(urlStr)}`;
            }
            if (proxyType === 'cors-anywhere') {
              return `https://cors-anywhere.herokuapp.com/${urlStr}`;
            }
            return urlStr;
          }
        };
      };

      const isSameOriginOrRelative = (url: string) => {
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
          return true;
        }
        try {
          const u = new URL(url.startsWith('//') ? window.location.protocol + url : url);
          return u.host === window.location.host;
        } catch (e) {
          return true;
        }
      };

      const candidates: any[] = [];
      for (const urlVal of urlsToTry) {
        if (isSameOriginOrRelative(urlVal)) {
          candidates.push({
            url: urlVal,
            desc: `Direct Local/Relative Load`,
            proxyType: 'none',
            withCredentials: false
          });
        } else if (isSecuredHost) {
          // 1. Direct fetch with credentials (secured municipal login sessions)
          candidates.push({
            url: urlVal,
            desc: `Direct Municipal Load [Credentials]`,
            proxyType: 'none',
            withCredentials: passCredentials
          });

          // 2. Direct fetch without credentials
          candidates.push({
            url: urlVal,
            desc: `Direct Municipal Load [No Credentials]`,
            proxyType: 'none',
            withCredentials: false
          });

          // 3. Fallback to Local Proxy gateway in case server has route access
          candidates.push({
            url: urlVal,
            desc: `Local Proxy Gateway (Municipal Fallback)`,
            proxyType: 'local',
            withCredentials: false
          });

          // 4. Corsproxy.io Fallback
          candidates.push({
            url: urlVal,
            desc: `Corsproxy.io (Municipal Fallback)`,
            proxyType: 'corsproxy',
            withCredentials: false
          });
        } else {
          // 1. Direct load with no credentials (fastest, standard, no CORS bypass needed for CORS-enabled targets)
          candidates.push({
            url: urlVal,
            desc: `Direct Load [No Credentials]`,
            proxyType: 'none',
            withCredentials: false
          });

          // 2. Local Proxy Gateway (Bypasses CORS entirely via server proxy if route is accessible)
          candidates.push({
            url: urlVal,
            desc: `Local Proxy Gateway`,
            proxyType: 'local',
            withCredentials: false
          });

          // 3. Corsproxy.io Bypass (Highly reliable, client-side, zero-config)
          candidates.push({
            url: urlVal,
            desc: `Corsproxy.io Bypass`,
            proxyType: 'corsproxy',
            withCredentials: false
          });

          // 4. AllOrigins Bypass (Highly reliable fallback, client-side)
          candidates.push({
            url: urlVal,
            desc: `AllOrigins Bypass`,
            proxyType: 'allorigins',
            withCredentials: false
          });

          // 5. Direct load with credentials (if explicitly requested)
          if (passCredentials) {
            candidates.push({
              url: urlVal,
              desc: `Direct Load [With Credentials]`,
              proxyType: 'none',
              withCredentials: true
            });
          }
        }
      }

      let tileset: any = null;
      let lastError: any = null;
      let successfulDesc = "";

      // Try candidates sequentially until one resolves successfully
      for (const cand of candidates) {
        try {
          console.log(`Attempting to stream via ${cand.desc} for URL: ${cand.url}`);
          const resourceOptions: any = {
            url: cand.url,
            withCredentials: cand.withCredentials
          };

          const proxyObj = createCesiumProxy(cand.proxyType);
          if (proxyObj) {
            resourceOptions.proxy = proxyObj;
          }

          const layerResource = new Cesium.Resource(resourceOptions);

          tileset = await Cesium.Cesium3DTileset.fromUrl(layerResource, {
            skipLevelOfDetail: true,
            progressiveResolutionHeightFraction: 0.5
          });

          successfulDesc = cand.desc;
          console.log(`Successfully resolved 3D Tileset via ${cand.desc}!`);
          break;
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.warn(`Failed loading via ${cand.desc}. Trying next fallback... Error:`, err);
          attemptErrors.push(`[${cand.desc}] target: ${cand.url} error: ${errMsg}`);
          lastError = err;
        }
      }

      if (!tileset) {
        throw lastError || new Error(`All streaming candidates failed to load.\nFallback attempts summary:\n${attemptErrors.join('\n')}`);
      }

      // 4. Mount the primitive directly to the active globe context scene
      viewer.scene.primitives.add(tileset);
      
      // Smoothly pan and frame the viewport camera above the new model bounding volume
      viewer.zoomTo(tileset);

      // Extract a clean human-readable name for the label
      const labelUrl = cleanUrl.replace(/\/$/, "");
      const pathSegments = labelUrl.split("/");
      let labelName = "Abu Dhabi Mosque Mesh";
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment.toLowerCase() === "tileset.json" && pathSegments.length > 1) {
          labelName = pathSegments[pathSegments.length - 2];
        } else if (lastSegment) {
          labelName = lastSegment;
        }
      }

      // 5. Build the tracking metadata object to push into your active layers list state array
      const layerMetadata = {
        id: `ext_tileset_${Date.now()}`,
        label: labelName,
        instance: tileset,
        visible: true,
        sourceDescription: successfulDesc
      };

      if (typeof safeSetActiveLayers === 'function') {
        safeSetActiveLayers((prev: any[]) => [...prev, layerMetadata]);
      } else if (typeof setActiveLayers === 'function') {
        setActiveLayers(prev => [...prev, layerMetadata]);
      }

      // Clear text entry slot
      if (typeof setTilesetUrlInput === 'function') setTilesetUrlInput("");

    } catch (err: any) {
      console.warn("The External 3D Tileset routing pipeline failed to resolve:", err);
      
      let detailsMsg = err?.message || String(err);
      if (attemptErrors && attemptErrors.length > 0) {
        detailsMsg += " | Attempts: " + attemptErrors.join("; ");
      }
      const errorMsg = `Unable to stream tileset. Details: ${detailsMsg}. Ensure your browser 'CORS Unblock' developer utility extension is toggled ON, the service endpoint is online, or toggle the cookie credentials state.`;
      if (typeof setTilesetError === 'function') {
        setTilesetError(errorMsg);
      } else {
        alert(errorMsg);
      }
    }
  };

  const handleLoadFallbackIonAsset = async (assetIdStr: string, customTokenStr: string) => {
    const viewer = (window as any).cesiumViewer;
    if (!assetIdStr || !viewer) return;
    const assetId = Number(assetIdStr);
    const cleanToken = customTokenStr ? customTokenStr.trim() : null;

    try {
      if (cleanToken) {
        Cesium.Ion.defaultAccessToken = cleanToken;
      } else if (token) {
        Cesium.Ion.defaultAccessToken = token;
      }

      let resource;
      
      // If a custom token is provided, override the global default token specifically for this asset!
      if (cleanToken) {
        resource = await Cesium.IonResource.fromAssetId(assetId, {
          accessToken: cleanToken
        });
      } else if (token) {
        // Fall back to the application's main token prop if available
        resource = await Cesium.IonResource.fromAssetId(assetId, {
          accessToken: token
        });
      } else {
        // Otherwise, fall back to our application's main default token
        resource = await Cesium.IonResource.fromAssetId(assetId);
      }

      // Initialize with absolute peak settings optimized for our textured Abu Dhabi Island
      const tileset = await Cesium.Cesium3DTileset.fromUrl(resource, {
        // 1. Lower SSE forces the browser to keep textured facades sharp and visible from far away
        maximumScreenSpaceError: 3, 
        
        // 2. Maximize memory cache to 2GB to allow 3090's VRAM to cache all facade textures smoothly
        maximumMemoryUsage: 2048, 

        // 3. Keep background structures rendered to prevent popping during fast camera pans
        preloadSiblings: true,
        
        // 4. Smooth out loading stutters by skipping intermediate LOD low-res details
        skipLevelOfDetail: true,
        baseScreenSpaceError: 1024,
        skipScreenSpaceErrorFactor: 16
      } as any);

      viewer.scene.primitives.add(tileset);
      viewer.zoomTo(tileset);

      // Track in our active project layers layer panel array
      const newLayer = {
        id: `ion_asset_${assetId}_${Date.now()}`,
        label: `Account Asset #${assetId}`,
        instance: tileset,
        visible: true
      };

      if (typeof safeSetActiveLayers === 'function') {
        safeSetActiveLayers((prev: any[]) => [...prev, newLayer]);
      } else if (typeof setActiveLayers === 'function') {
        setActiveLayers(prev => [...prev, newLayer]);
      }

      // Clear inputs and error
      setFallbackTokenInput("");
      setIonFallbackId("");
      onIonAssetErrorChange?.(null);

    } catch (err) {
      console.error("Failed loading asset from separate account:", err);
      const errMsg = `Failed loading asset from separate account: ${err instanceof Error ? err.message : String(err)}`;
      if (onIonAssetErrorChange) {
        onIonAssetErrorChange(errMsg);
      } else {
        alert("Streaming Failed: Check the Asset ID and make sure the scoped access token matches that account.");
      }
    }
  };

  const handleToggleActiveLayerVisibility = (id: string) => {
    safeSetActiveLayers(prev => prev.map(l => {
      if (l.id === id) {
        const newVisible = !l.visible;
        if (l.instance) {
          l.instance.show = newVisible;
        }
        return { ...l, visible: newVisible };
      }
      return l;
    }));
  };

  const handleRemoveActiveLayer = (id: string) => {
    const viewer = (window as any).cesiumViewer;
    safeSetActiveLayers(prev => {
      const target = prev.find(l => l.id === id);
      if (target) {
        // Clean up event listeners to avoid memory leaks
        if (target.instance) {
          if (target.onProgress && target.instance.loadProgress) {
            target.instance.loadProgress.removeEventListener(target.onProgress);
          }
          if (target.onTileFailed && target.instance.tileFailed) {
            target.instance.tileFailed.removeEventListener(target.onTileFailed);
          }
        }
        if (target.instance && viewer) {
          viewer.scene.primitives.remove(target.instance);
        }
      }
      return prev.filter(l => l.id !== id);
    });
  };

  const handleFlyToActiveLayer = (lyr: any) => {
    onActiveLayerIdChange?.(lyr.id);
    const viewer = (window as any).cesiumViewer;
    if (!viewer) return;

    if (lyr.instance) {
      lyr.instance.show = true;
      const bs = lyr.instance.boundingSphere && lyr.instance.boundingSphere.radius > 0
        ? lyr.instance.boundingSphere
        : (lyr.instance.root && lyr.instance.root.boundingSphere && lyr.instance.root.boundingSphere.radius > 0
            ? lyr.instance.root.boundingSphere
            : null);

      if (bs && bs.radius > 0) {
        viewer.camera.flyToBoundingSphere(bs, {
          duration: 2.5,
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(0),
            Cesium.Math.toRadians(-45)
          )
        });
      } else {
        viewer.flyTo(lyr.instance, {
          duration: 2.5,
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(0),
            Cesium.Math.toRadians(-45)
          )
        }).catch(() => {
          try {
            const position = Cesium.Cartesian3.fromDegrees(workspaceOrigin.lng, workspaceOrigin.lat, 100);
            const boundingSphere = new Cesium.BoundingSphere(position, 200);
            viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 2.5 });
          } catch (_) {}
        });
      }
    } else {
      try {
        const position = Cesium.Cartesian3.fromDegrees(workspaceOrigin.lng, workspaceOrigin.lat, 100);
        const boundingSphere = new Cesium.BoundingSphere(position, 200);
        viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 2.5 });
      } catch (_) {}
    }
  };

  const handleLoadI3sStream = async () => {
    const enteredI3sUrl = i3sUrlInput.trim();
    if (!enteredI3sUrl) return;

    setIsLoadingI3s(true);
    setI3sError(null);

    const viewer = (window as any).cesiumViewer;
    if (!viewer) {
      setI3sError("Cesium viewer is not initialized yet.");
      setIsLoadingI3s(false);
      return;
    }

    // Validate URL and protocol beforehand
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(enteredI3sUrl);
      if (parsedUrl.protocol !== "https:") {
        setI3sError("Failed to parse: Only secure HTTPS URLs are supported for streaming.");
        setIsLoadingI3s(false);
        return;
      }
    } catch (e) {
      setI3sError("Failed to parse: Invalid URL format. Please enter a valid secure HTTPS link.");
      setIsLoadingI3s(false);
      return;
    }

    const createI3sResource = (targetUrl: string, useProxy = false) => {
      const resourceOptions: any = {
        url: targetUrl,
        withCredentials: passCredentials
      };
      if (useProxy) {
        // Custom Cesium compatible proxy object
        resourceOptions.proxy = {
          getURL: (url: any) => {
            if (!url) return url;
            const urlStr = typeof url === 'string' ? url : (url && url.url) ? url.url : '';
            if (!urlStr) return urlStr;
            if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://') && !urlStr.startsWith('//')) {
              return urlStr;
            }
            if (urlStr.includes('/api/proxy') || urlStr.includes('localhost') || urlStr.includes('127.0.0.1') || urlStr.includes('::1')) {
              return urlStr;
            }
            return `/api/proxy?url=${encodeURIComponent(urlStr)}`;
          }
        };
      }
      return new Cesium.Resource(resourceOptions);
    };

    // Helper to get normalized URL path with /layers/0 appended if missing
    const getFormattedUrls = (originalUrlObj: URL): { primaryUrl: string; fallbackUrl?: string } => {
      try {
        let pathname = originalUrlObj.pathname;
        // Remove trailing slash of pathname
        if (pathname.endsWith('/')) {
          pathname = pathname.slice(0, -1);
        }
        
        const lowercasePath = pathname.toLowerCase();
        
        // If it ends with /sceneserver, the primary should be /layers/0 and fallback can be the original
        if (lowercasePath.endsWith('/sceneserver')) {
          const primaryUrlObj = new URL(originalUrlObj.toString());
          primaryUrlObj.pathname = pathname + '/layers/0';
          
          return {
            primaryUrl: primaryUrlObj.toString(),
            fallbackUrl: originalUrlObj.toString()
          };
        }
        
        // If it already ends with layers/X, try it as primary, and fallback as stripped parent
        const layersMatch = pathname.match(/\/layers\/\d+$/i);
        if (layersMatch) {
          const fallbackUrlObj = new URL(originalUrlObj.toString());
          fallbackUrlObj.pathname = pathname.replace(/\/layers\/\d+$/i, '');
          
          return {
            primaryUrl: originalUrlObj.toString(),
            fallbackUrl: fallbackUrlObj.toString()
          };
        }
        
        // Otherwise try it with /layers/0 as fallback
        const fallbackUrlObj = new URL(originalUrlObj.toString());
        fallbackUrlObj.pathname = pathname + '/layers/0';
        return {
          primaryUrl: originalUrlObj.toString(),
          fallbackUrl: fallbackUrlObj.toString()
        };
      } catch (e) {
        return { primaryUrl: originalUrlObj.toString() };
      }
    };

    const { primaryUrl, fallbackUrl } = getFormattedUrls(parsedUrl);
    let i3sProvider: any = null;
    let finalUrl = primaryUrl;
    let loadedWithProxy = false;
    if (forceDirectI3s) {
      try {
        try {
          console.log("Attempting to load I3S strictly directly (forceDirectI3s=true) with primary URL:", finalUrl);
          const secureResource = createI3sResource(finalUrl, false);
          i3sProvider = await Cesium.I3SDataProvider.fromUrl(secureResource, {
            traceResponses: false
          } as any);
        } catch (err: any) {
          if (fallbackUrl) {
            console.log("Strict direct load failed, trying strict direct with fallback URL:", fallbackUrl);
            finalUrl = fallbackUrl;
            const secureResourceFallback = createI3sResource(finalUrl, false);
            i3sProvider = await Cesium.I3SDataProvider.fromUrl(secureResourceFallback, {
              traceResponses: false
            } as any);
          } else {
            throw err;
          }
        }
      } catch (directErr: any) {
        console.warn("Strict direct browser connection failed:", directErr);
        const errDetail = directErr?.message || String(directErr);
        throw new Error(`Direct connection failed (${errDetail}). If you are on a private enterprise network/VPN, ensure you have installed and activated a browser extension to bypass CORS (such as 'CORS Unblock' or 'Allow CORS: Access-Control-Allow-Origin' on Chrome/Edge), as this server requires direct browser streaming.`);
      }
    } else {
      try {
        try {
          console.log("Attempting to load I3S directly with primary URL:", finalUrl);
          const secureResource = createI3sResource(finalUrl, false);
          i3sProvider = await Cesium.I3SDataProvider.fromUrl(secureResource, {
            traceResponses: false // Keeps network payload memory overhead low
          } as any);
        } catch (err: any) {
          console.warn("Direct primary load failed, trying fallback URL directly...", err);
          
          // Skip fallback if it's an explicit 401 or 403 error
          const statusCode = err?.statusCode || err?.status;
          if (statusCode === 401 || statusCode === 403) {
            throw err;
          }

          if (fallbackUrl) {
            try {
              console.log("Retrying directly with fallback URL:", fallbackUrl);
              finalUrl = fallbackUrl;
              const secureResourceFallback = createI3sResource(finalUrl, false);
              i3sProvider = await Cesium.I3SDataProvider.fromUrl(secureResourceFallback, {
                traceResponses: false
              } as any);
            } catch (fallbackErr: any) {
              console.warn("Direct fallback load failed, falling through to server proxy retry sequence...");
              throw fallbackErr;
            }
          } else {
            throw err;
          }
        }
      } catch (outerError: any) {
        console.warn("Direct loading failed. Automatically retrying with secure server-side CORS proxy fallback...", outerError);
        const statusCode = outerError?.statusCode || outerError?.status;
        if (statusCode === 401 || statusCode === 403) {
          throw outerError; // Preserve Auth / secured server flow
        }

        // Retry 1: Primary URL via proxy
        finalUrl = primaryUrl;
        try {
          console.log("Attempting to load I3S via server-side CORS proxy with primary URL:", finalUrl);
          const proxyResource = createI3sResource(finalUrl, true);
          i3sProvider = await Cesium.I3SDataProvider.fromUrl(proxyResource, {
            traceResponses: false
          } as any);
          loadedWithProxy = true;
        } catch (proxyPrimaryErr: any) {
          console.warn("Proxy primary load failed, retrying proxy with fallback URL structure...", proxyPrimaryErr);
          if (fallbackUrl) {
            try {
              finalUrl = fallbackUrl;
              console.log("Attempting to load I3S via server-side CORS proxy with fallback URL:", finalUrl);
              const proxyResourceFallback = createI3sResource(finalUrl, true);
              i3sProvider = await Cesium.I3SDataProvider.fromUrl(proxyResourceFallback, {
                traceResponses: false
              } as any);
              loadedWithProxy = true;
            } catch (proxyFallbackErr: any) {
              console.warn("All direct and CORS proxy attempts failed.");
              throw proxyFallbackErr;
            }
          } else {
            throw proxyPrimaryErr;
          }
        }
      }
    }

    try {
      // Add the parsed data layer directly to the global viewer scene
      viewer.scene.primitives.add(i3sProvider);
      
      // Automatically fly the viewport camera to frame the newly loaded I3S urban footprint
      let center = i3sProvider.extent;
      if (!center && i3sProvider.layers && i3sProvider.layers.length > 0) {
        center = i3sProvider.layers[0].extent;
      }
      if (center) {
        if (viewer.scene && !viewer.scene.isDestroyed()) viewer.scene.requestRender();
        viewer.camera.flyTo({ destination: center, complete: () => {}, cancel: () => {} });
      }

      // Add to multi-layer tracking stack
      let displayName = finalUrl;
      try {
        const urlObj = new URL(finalUrl);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          displayName = pathParts[pathParts.length - 1];
          if (displayName.toLowerCase() === 'sceneserver' && pathParts.length > 1) {
            displayName = pathParts[pathParts.length - 2];
          }
        }
      } catch (e) {
        // Fallback to URL
      }

      const layerId = `i3s_${Date.now()}`;
      onAddI3sLayer?.(layerId, displayName, finalUrl, i3sProvider);
      
      setI3sUrlInput('');
      const successMsg = loadedWithProxy 
        ? `I3S Stream "${displayName}" successfully loaded via CORS Proxy!`
        : `I3S Stream "${displayName}" successfully loaded!`;
      setSuccessToast(successMsg);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (error: any) {
      console.warn("I3S loading issue captured:", error);
      const isDmtUrl = enteredI3sUrl.toLowerCase().includes("dmt.gov.ae");
      const statusCode = error?.statusCode || error?.status;
      if (statusCode === 401 || statusCode === 403) {
        alert("Access Denied: The server rejected the request. Ensure you are logged into the ArcGIS repository/portal in another browser tab so your session is active, and verify that CORS is enabled on their server configuration.");
        setI3sError("Access Denied: The server rejected the request. Ensure you are logged into the ArcGIS repository/portal in another browser tab so your session is active, and verify that CORS is enabled on their server configuration.");
      } else if (isDmtUrl) {
        setI3sError("⚠️ Department of Municipalities and Transport (DMT) Private Network Detected. Since 'enterprise.dmt.gov.ae' resides on a private government intranet, our public cloud server proxy cannot reach it directly (Error: connect EHOSTUNREACH). To stream this 3D layer: (1) Ensure your device is on the DMT VPN/Intranet, (2) Install and enable a CORS browser extension (like 'CORS Unblock' or 'Allow CORS: Access-Control-Allow-Origin' on Chrome/Edge), and (3) Check the 'Direct Browser Connection Mode' checkbox below before clicking Load!");
      } else {
        const detailMsg = error?.message || error?.statusText || String(error);
        const errMsg = `Failed to parse the I3S Layer Server endpoint. Details: ${detailMsg}. If this URL belongs to a private network or intranet, please enable the 'Direct Browser Connection Mode' toggle below and ensure you are connected to your VPN.`;
        setI3sError(errMsg);
      }
    } finally {
      setIsLoadingI3s(false);
    }
  };

  const [expandedAnalysisLayerId, setExpandedAnalysisLayerId] = useState<string | null>(null);
  const [expandedGisCategories, setExpandedGisCategories] = useState<Record<string, boolean>>({});

  const isGisCategoryExpanded = (key: string, defaultVal = false) => {
    return expandedGisCategories[key] ?? defaultVal;
  };

  const toggleGisCategory = (key: string, defaultVal = false) => {
    setExpandedGisCategories(prev => ({
      ...prev,
      [key]: !isGisCategoryExpanded(key, defaultVal)
    }));
  };
  const [layerDensity, setLayerDensity] = useState<Record<string, number>>({});
  const [treePreset, setTreePreset] = useState<string>('deciduous');

  const handleScatterTrees = (layer: any) => {
    const density = layerDensity[layer.id] || 50;
    const features = layer.shapefileData?.features;
    if (!features || features.length === 0) return;

    const newTrees: any[] = [];
    const treesPerFeature = Math.max(1, Math.floor(density / features.length));

    features.forEach((feat: any) => {
      const positions = feat.positions;
      if (!positions || positions.length < 3) return;

      const closed = [...positions];
      const first = closed[0];
      const last = closed[closed.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        closed.push([first[0], first[1]]);
      }

      try {
        const turfPoly = turf.polygon([
          closed,
          ...(feat.holes || []).map((h: any) => {
            const hClosed = [...h.positions];
            if (hClosed.length > 0) {
              const hFirst = hClosed[0];
              const hLast = hClosed[hClosed.length - 1];
              if (hFirst[0] !== hLast[0] || hFirst[1] !== hLast[1]) {
                hClosed.push([hFirst[0], hFirst[1]]);
              }
            }
            return hClosed;
          })
        ]);

        const bounds = feat.bounds;
        const bbox: [number, number, number, number] = [bounds.west, bounds.south, bounds.east, bounds.north];

        let attempts = 0;
        let count = 0;

        while (count < treesPerFeature && attempts < 15) {
          attempts++;
          const randomPts = turf.randomPoint(treesPerFeature * 2, { bbox });

          for (const pt of randomPts.features) {
            if (turf.booleanPointInPolygon(pt, turfPoly)) {
              const [lng, lat] = pt.geometry.coordinates;
              const scale = 0.7 + Math.random() * 0.8;
              const rotation = Math.random() * 360;

              newTrees.push({
                id: `tree-scatter-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
                longitude: lng,
                latitude: lat,
                height: 0,
                scale,
                rotation,
                isScattered: true,
                layerId: layer.id
              });

              count++;
              if (count >= treesPerFeature) break;
            }
          }
        }
      } catch (e) {
        console.error('Error generating scattered trees for feature:', e);
      }
    });

    if (onPlacedTreesChange && placedTrees) {
      const untouchedTrees = placedTrees.filter(t => t.layerId !== layer.id);
      onPlacedTreesChange([...untouchedTrees, ...newTrees]);
    }
  };

  const handleClearLayerTrees = (layerId: string) => {
    if (onPlacedTreesChange && placedTrees) {
      const untouchedTrees = placedTrees.filter(t => t.layerId !== layerId);
      onPlacedTreesChange(untouchedTrees);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const setActiveTab = (tab: 'controls' | 'layers' | 'metrics' | 'import' | 'tools' | 'ai-render' | 'cesium-assets' | 'landmarks' | 'simulation') => {
    onActiveTabChange?.(tab);
  };

  // Sidebar restructuring states
  const [openLayerAccordions, setOpenLayerAccordions] = useState<Record<string, boolean>>({
    cesium: false,
    gis: false,
    tools: false,
    base: false,
  });

  const toggleLayerAccordion = (key: string) => {
    setOpenLayerAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [openToolAccordions, setOpenToolAccordions] = useState<Record<string, boolean>>({
    measurements: false,
    terrain: false,
    vegetation: false,
    split: false,
  });

  const toggleToolAccordion = (key: string) => {
    setOpenToolAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadedIonAssets = (ionAccounts || []).flatMap(acc =>
    (acc.assets || [])
      .filter(a => a.loaded)
      .map(a => ({ account: acc, asset: a }))
  );

  const cesiumLayersCount = (streamedTilesetId ? 1 : 0) +
    (i3sLayers?.length || 0) +
    (importedLayers?.filter(l => l.type === '3d-tiles' || l.type === 'cesium')?.length || 0) +
    (activeLayers?.length || 0) +
    loadedIonAssets.length;

  const gisLayersCount = (gisLayers?.length || 0) +
    (importedLayers?.filter(l => l.type !== '3d-tiles' && l.type !== 'cesium')?.length || 0);

  const toolsLayersCount = (massingBaseArea ? 1 : 0) +
    (excavationArea ? 1 : 0) +
    (disabledUtilityLayers && disabledUtilityLayers.length > 0 ? 1 : 0);

  const baseMapLayersCount = layers ? layers.filter(l => l.enabled ?? (l as any).visible ?? true).length : 0;

  const [activeSection, setActiveSection] = useState<'file-import' | 'external-streamers' | null>(null);
  const [activeLocalSubSection, setActiveLocalSubSection] = useState<'slot-a' | 'slot-b' | 'tier1' | 'active-layers' | null>(null);
  const [activeRightSection, setActiveRightSection] = useState<'active-layers' | 'transform-tools' | null>(null);
  const [activeCesiumAccordion, setActiveCesiumAccordion] = useState<'imagery' | 'visualization' | 'slots' | 'loaders' | 'layers' | 'performance' | null>(null);

  const [isSunAnimating, setIsSunAnimating] = useState(false);
  const [isSunPositionExpanded, setIsSunPositionExpanded] = useState(false);
  const [isShadowSolarAnalysisExpanded, setIsShadowSolarAnalysisExpanded] = useState(false);
  const [isIblPbrExpanded, setIsIblPbrExpanded] = useState(false);
  const [isSimRecordingExpanded, setIsSimRecordingExpanded] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const sunHourRef = useRef(sunHour);

  const hasAnyLayerAccordionOpen = Object.values(openLayerAccordions).some(Boolean);

  const areAllSidebarSectionsCollapsed = 
    !isSunPositionExpanded &&
    !isShadowSolarAnalysisExpanded &&
    !isIblPbrExpanded &&
    !isSimRecordingExpanded &&
    activeSection === null &&
    !helpExpanded &&
    activeRightSection === null &&
    activeCesiumAccordion === null &&
    !hasAnyLayerAccordionOpen;

  const toggleAllSidebarSections = () => {
    const shouldExpand = areAllSidebarSectionsCollapsed;
    setIsSunPositionExpanded(shouldExpand);
    setIsShadowSolarAnalysisExpanded(shouldExpand);
    setIsIblPbrExpanded(shouldExpand);
    setIsSimRecordingExpanded(shouldExpand);
    setActiveSection(shouldExpand ? 'file-import' : null);
    setHelpExpanded(shouldExpand);
    setActiveRightSection(shouldExpand ? 'active-layers' : null);
    setActiveCesiumAccordion(shouldExpand ? 'layers' : null);
    setOpenLayerAccordions({
      cesium: shouldExpand,
      gis: shouldExpand,
      tools: shouldExpand,
      base: shouldExpand,
    });
    if (shouldExpand) {
      const allAccs: Record<string, boolean> = {};
      (ionAccounts || []).forEach(acc => { allAccs[acc.id] = true; });
      setExpandedAccountIds(allAccs);
    } else {
      setExpandedAccountIds({});
    }
  };

  useEffect(() => {
    sunHourRef.current = sunHour;
  }, [sunHour]);

  useEffect(() => {
    if (!isSunAnimating) return;

    const interval = setInterval(() => {
      let next = sunHourRef.current + 0.15;
      if (next >= 24) next = 0;
      onSunHourChange(parseFloat(next.toFixed(2)));
    }, 50);

    return () => clearInterval(interval);
  }, [isSunAnimating, onSunHourChange]);

  // Simulation Bookmarks, Screen Recording & Gallery State
  const [simBookmarkStart, setSimBookmarkStart] = useState<number>(6.0); // 06:00 AM
  const [simBookmarkEnd, setSimBookmarkEnd] = useState<number>(18.0); // 06:00 PM
  const [isRecordingSim, setIsRecordingSim] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [simulationGallery, setSimulationGallery] = useState<SimulationVideo[]>([]);
  const [selectedModalVideo, setSelectedModalVideo] = useState<SimulationVideo | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const simRecordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (simRecordIntervalRef.current) clearInterval(simRecordIntervalRef.current);
    };
  }, []);

  const handleStartSimulationRecording = () => {
    setIsSunAnimating(false);
    
    // Reset time of day to bookmarked start time
    onSunHourChange(simBookmarkStart);

    const canvas = document.querySelector('.cesium-widget canvas') || document.querySelector('canvas');
    if (!canvas) {
      alert('Globe canvas unavailable for simulation recording.');
      return;
    }

    let thumbnail = '';
    try {
      thumbnail = (canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.8);
    } catch (_) {}

    try {
      const stream = (canvas as HTMLCanvasElement).captureStream(30);
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const rawType = mimeType ? mimeType.split(';')[0] : 'video/mp4';
        const blob = new Blob(recordedChunksRef.current, { type: rawType });
        const blobUrl = URL.createObjectURL(blob);
        const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        const now = new Date();
        const startLabel = formatHour(simBookmarkStart);
        const endLabel = formatHour(simBookmarkEnd);

        const newVideo: SimulationVideo = {
          id: 'sim_' + Date.now(),
          title: `Solar Simulation (${startLabel} - ${endLabel})`,
          blobUrl,
          blob,
          thumbnailUrl: thumbnail,
          date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          startTimeStr: startLabel,
          endTimeStr: endLabel,
          fileSizeStr: `${fileSizeMB} MB`,
          mimeType: rawType.includes('mp4') ? 'video/mp4' : 'video/webm'
        };

        setSimulationGallery(prev => [newVideo, ...prev]);
        setIsRecordingSim(false);
        setRecordingProgress(0);
        if (simRecordIntervalRef.current) {
          clearInterval(simRecordIntervalRef.current);
          simRecordIntervalRef.current = null;
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecordingSim(true);
      setRecordingProgress(0);

      let currentH = simBookmarkStart;
      const targetH = simBookmarkEnd > simBookmarkStart ? simBookmarkEnd : (simBookmarkEnd + 24);
      const totalSpan = Math.max(0.1, targetH - simBookmarkStart);
      const step = 0.12;

      if (simRecordIntervalRef.current) clearInterval(simRecordIntervalRef.current);

      simRecordIntervalRef.current = setInterval(() => {
        currentH += step;
        let displayH = currentH;
        if (displayH >= 24) displayH = displayH % 24;

        onSunHourChange(parseFloat(displayH.toFixed(2)));

        const progressPercent = Math.min(100, Math.round(((currentH - simBookmarkStart) / totalSpan) * 100));
        setRecordingProgress(progressPercent);

        if (currentH >= targetH) {
          if (simRecordIntervalRef.current) {
            clearInterval(simRecordIntervalRef.current);
            simRecordIntervalRef.current = null;
          }
          onSunHourChange(simBookmarkEnd);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 70);

    } catch (err) {
      console.error('Failed to start simulation recording:', err);
      alert('Screen recording could not be started.');
      setIsRecordingSim(false);
    }
  };

  const handleStopSimulationRecording = () => {
    if (simRecordIntervalRef.current) {
      clearInterval(simRecordIntervalRef.current);
      simRecordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingSim(false);
  };

  const { isTablet, isMobile, width } = useDeviceType();
  const isDrawerMode = isTablet || isMobile || width < 1024;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isSidebarExpanded !== undefined) {
      return !isSidebarExpanded;
    }
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    if (isSidebarExpanded !== undefined) {
      setIsCollapsed(!isSidebarExpanded);
    }
  }, [isSidebarExpanded]);

  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onSidebarExpandedChange?.(!collapsed);
  };

  const isSmallScreen = isTablet || isMobile || width < 1024;
  const prevSmallScreenRef = useRef<boolean>(isSmallScreen);

  useEffect(() => {
    if (isSmallScreen && !prevSmallScreenRef.current) {
      setIsCollapsed(true);
      onSidebarExpandedChange?.(false);
    }
    prevSmallScreenRef.current = isSmallScreen;
  }, [isSmallScreen]);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Automatically expand sidebar, activate correct tools panel, and scroll to active tool card
  useEffect(() => {
    if (activeTool && activeTool !== 'none') {
      if (!isSmallScreen && !isSidebarExpanded) {
        setIsCollapsed(false);
        onSidebarExpandedChange?.(true);
      }
      
      if (['distance', 'height', 'area', 'viewshed', 'view-corridor', 'parametric-massing', 'subsurface-excavation', '3d-tiles-clip'].includes(activeTool)) {
        setOpenToolAccordions(prev => prev.measurements ? prev : ({ ...prev, measurements: true }));
      } else if (['boundary', 'auto-bound'].includes(activeTool)) {
        setOpenToolAccordions(prev => prev.terrain ? prev : ({ ...prev, terrain: true }));
      } else if (activeTool === 'tree-placement') {
        setOpenToolAccordions(prev => prev.vegetation ? prev : ({ ...prev, vegetation: true }));
      }

      if (activeTool === 'boundary' || activeTool === 'auto-bound' || activeTool === 'tree-placement') {
        if (activeTabRef.current !== 'simulation') {
          onActiveTabChange?.('simulation');
        }
      } else {
        if (activeTabRef.current !== 'tools') {
          onActiveTabChange?.('tools');
        }
      }

      setTimeout(() => {
        let targetId = '';
        if (activeTool === 'subsurface-excavation') targetId = 'panel-subsurface-excavation';
        else if (activeTool === 'view-corridor') targetId = 'panel-view-corridor';
        else if (activeTool === 'parametric-massing') targetId = 'panel-parametric-massing';
        else if (['distance', 'height', 'area', 'viewshed'].includes(activeTool)) targetId = 'card-spatial-measurements';
        else if (activeTool === 'boundary' || activeTool === 'auto-bound') targetId = 'panel-boundary-masking';
        else if (activeTool === 'tree-placement') targetId = 'panel-vegetation-management';

        if (targetId) {
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }, 120);
    }
  }, [activeTool]);
  const [importViewsError, setImportViewsError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [confirmNewProject, setConfirmNewProject] = useState(false);

  // AI Image Generator States
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('nano_banana_api_key') || '');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [tempApiKey, setTempApiKey] = useState<string>(() => localStorage.getItem('nano_banana_api_key') || '');
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [imgPrompt, setImgPrompt] = useState<string>('create photo real twilight render of this image');
  const [imgResolution, setImgResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [aiModel, setAiModel] = useState<string>('nano banana pro');
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isImgGenerating, setIsImgGenerating] = useState(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [generatedImgDesc, setGeneratedImgDesc] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [imgGatewayLog, setImgGatewayLog] = useState<string | null>(null);

  // Upload/Capture reference states
  const [uploadedImageRefDataUrl, setUploadedImageRefDataUrl] = useState<string | null>(null);
  const [uploadedImageRefName, setUploadedImageRefName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchCredits = async () => {
    if (accountRole === 'developer') {
      setUserCredits(99999);
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/user/credits'));
      const data = await res.json();
      if (data.success) {
        setUserCredits(data.credits);
      }
    } catch (e) {
      console.error('Error fetching credits:', e);
    }
  };

  const handleResetCredits = async () => {
    try {
      const res = await fetch(getApiUrl('/api/user/reset'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUserCredits(data.credits);
        setIsCreditModalOpen(false);
      }
    } catch (e) {
      console.error('Error resetting credits:', e);
    }
  };

  const handleGenerateRendering = async () => {
    if (!imgPrompt.trim()) {
      setImgError('Please enter a descriptive prompt for your rendering.');
      return;
    }

    // Cost multiplier check
    let cost = 1;
    if (imgResolution === '2K') cost = 2;
    if (imgResolution === '4K') cost = 4;

    const hasCustomKey = customApiKey && customApiKey.trim() !== '';

    if (!hasCustomKey && userCredits !== null && userCredits < cost) {
      setIsCreditModalOpen(true);
      return;
    }

    setIsImgGenerating(true);
    setImgError(null);
    setImgGatewayLog(null);

    const activeImageRef = aiScreenshotDataUrl || uploadedImageRefDataUrl || '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (hasCustomKey) {
        headers['X-User-Custom-AI-Key'] = customApiKey;
      }

      let base64Image = '';
      let mimeType = 'image/png';
      
      if (activeImageRef.includes(';base64,')) {
        const parts = activeImageRef.split(';base64,');
        if (parts.length === 2) {
          mimeType = parts[0].replace('data:', '');
          base64Image = parts[1];
        }
      }

      let targetWidth = 1920;
      let targetHeight = 1080;
      if (imgResolution === '2K') {
        targetWidth = 2560;
        targetHeight = 1440;
      } else if (imgResolution === '4K') {
        targetWidth = 3840;
        targetHeight = 2160;
      }

      let targetModelID = 'gemini-3.1-flash-image';
      if (aiModel === 'nano banana pro') {
        targetModelID = 'gemini-3.1-pro-image-preview';
      } else if (aiModel === 'nano banana lite') {
        targetModelID = 'gemini-3.1-flash-lite';
      } else if (aiModel === 'nano banana 2') {
        targetModelID = 'gemini-3.1-flash-image';
      }

      const apiUrl = getApiUrl('/api/render/img2img');
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: imgPrompt,
          resolution: imgResolution,
          imageRef: activeImageRef,
          model: targetModelID,
          aspect_ratio: '16:9',
          output_width: targetWidth,
          output_height: targetHeight
        }),
      });

      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        setImgError(errorData.error || 'Credit threshold reached.');
        setIsCreditModalOpen(true);
        setIsImgGenerating(false);
        fetchCredits();
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      }

      if (res.ok && data && data.success) {
        let finalUrl = data.imageUrl;
        let finalDesc = data.description;
        let finalLog = data.gatewayLog;

        setGeneratedImgUrl(finalUrl);
        setGeneratedImgDesc(finalDesc);
        if (data.creditsRemaining !== undefined) {
          setUserCredits(data.creditsRemaining);
        }
        setImgGatewayLog(finalLog);
        setImgError(null);
      } else {
        const errMsg = data?.error || 'API Gateway image rendering failed. Please check your Gemini API key.';
        console.warn('API Gateway returned error:', errMsg);
        setImgError(errMsg);
      }
    } catch (e: any) {
      console.warn('Network exception during image generation:', e);
      setImgError(e?.message || 'Network exception during image-to-image render.');
    } finally {
      setIsImgGenerating(false);
    }
  };

  const handleOpenPresentation = () => {
    if (!generatedImgUrl) return;

    try {
      const presentationWindow = window.open("", "_blank");
      if (!presentationWindow || presentationWindow.closed || typeof presentationWindow.closed === 'undefined') {
        throw new Error("Popup blocked");
      }
      
      const finalImageURL = generatedImgUrl;
      const selectedResolution = imgResolution;
      const originalImageURL = aiScreenshotDataUrl || uploadedImageRefDataUrl || '';
      
      // Escape prompt for safe inclusion in inner JS and HTML attributes
      const activePrompt = imgPrompt;
      const activePromptEscaped = activePrompt
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');
      const escapedPromptForTitle = activePrompt.replace(/"/g, '&quot;');
      const activeModel = aiModel;

      presentationWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Architectural Render - Comparison Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #030406;
      --panel-color: rgba(11, 13, 18, 0.75);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --accent-color: #f59e0b; /* Amber */
      --accent-green: #10b981; /* Emerald */
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body { 
      background-color: var(--bg-color); 
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
      display: flex; 
      flex-direction: column;
      width: 100vw;
      height: 100vh; 
      overflow: hidden; 
      position: relative;
    }

    /* Header Styling */
    header {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      background-color: var(--panel-color);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .header-title-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background-color: var(--accent-green);
      border-radius: 50%;
      box-shadow: 0 0 12px var(--accent-green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .header-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-primary);
      text-transform: uppercase;
    }

    .header-subtitle {
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-secondary);
      background: rgba(255,255,255,0.04);
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .button-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      border: 1px solid transparent;
    }

    .btn-secondary {
      background-color: rgba(255, 255, 255, 0.06);
      color: var(--text-primary);
      border-color: var(--border-color);
    }

    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-primary {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: #000;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.2);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #b45309, #d97706);
      transform: translateY(-1px);
    }

    /* Main Area Styling */
    main {
      position: absolute;
      inset: 0;
      padding: 0;
      margin: 0;
      background: #000;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10;
    }

    /* Compare Slider Container - FULL SCREEN */
    .slider-container {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #000;
    }

    .slider-container img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover; /* default */
      pointer-events: none;
      transition: object-fit 0.2s ease;
    }

    /* Contain image styling when toggled */
    body.img-fit-contain .slider-container img,
    body.img-fit-contain .single-image-wrapper img {
      object-fit: contain;
    }

    .before-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
      transition: clip-path 0.05s linear;
      z-index: 2;
    }

    /* Slider Line and Handle */
    .slider-handle {
      position: absolute;
      top: 0;
      left: 50%;
      height: 100%;
      width: 2px;
      background-color: #fff;
      pointer-events: none;
      z-index: 12;
      transform: translateX(-50%);
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
      transition: left 0.05s linear;
    }

    .slider-handle-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 48px;
      height: 48px;
      background-color: #111318;
      color: #fff;
      border: 2px solid #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.7);
      font-size: 14px;
      transition: background-color 0.2s, transform 0.2s;
    }

    .slider-container:hover .slider-handle-button {
      background-color: #1f222e;
      transform: translate(-50%, -50%) scale(1.08);
    }

    /* Range Input overlay */
    .slider-range {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: col-resize;
      z-index: 20;
      margin: 0;
      -webkit-appearance: none;
      appearance: none;
    }

    /* Overlaid Text Badges */
    .image-label {
      position: absolute;
      bottom: 100px; /* shift up to clear the footer */
      padding: 8px 16px;
      background-color: rgba(15, 17, 23, 0.75);
      border: 1px solid var(--border-color);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 8px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      z-index: 5;
      pointer-events: none;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }

    .label-before {
      left: 20px;
      color: var(--accent-color);
      border-left: 3px solid var(--accent-color);
    }

    .label-after {
      right: 20px;
      color: var(--accent-green);
      border-right: 3px solid var(--accent-green);
    }

    .slider-container.is-dragging .image-label {
      opacity: 0.15;
    }

    /* Single Image Mode (when no before image exists) */
    .single-image-mode {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100%;
    }

    .single-image-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .single-image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: object-fit 0.2s ease;
    }

    /* Footer Styling */
    footer {
      position: absolute;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background-color: var(--panel-color);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      border-radius: 16px;
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .prompt-container {
      flex: 1;
      max-width: 65%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .prompt-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--text-secondary);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }

    .prompt-text {
      font-size: 12px;
      color: var(--text-primary);
      line-height: 1.5;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prompt-text:hover {
      white-space: normal;
      overflow: visible;
      word-break: break-all;
    }

    .meta-container {
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .meta-label {
      font-size: 9px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .meta-val {
      color: var(--text-primary);
      font-weight: 500;
    }

    /* HUD collapsing classes */
    body.hide-hud header {
      opacity: 0;
      pointer-events: none;
      transform: translateY(-30px);
    }

    body.hide-hud footer {
      opacity: 0;
      pointer-events: none;
      transform: translateY(30px);
    }

    body.hide-hud .image-label {
      bottom: 24px;
    }

    /* Small persistent trigger for bringing back HUD when hidden */
    .hud-unhide-button {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 101;
      width: 40px;
      height: 40px;
      background: rgba(11, 13, 18, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }

    .hud-unhide-button:hover {
      background: rgba(31, 34, 46, 0.9);
      transform: scale(1.05);
    }

    body.hide-hud .hud-unhide-button {
      opacity: 1;
      pointer-events: auto;
    }

    /* Responsive */
    @media (max-width: 768px) {
      header {
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        flex-direction: column;
        border-radius: 12px;
        padding: 10px;
        gap: 10px;
      }
      .button-group {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 6px;
      }
      .btn {
        padding: 6px 12px;
        font-size: 11px;
        flex: 1;
        justify-content: center;
      }
      main {
        padding: 0;
      }
      footer {
        position: fixed;
        bottom: 10px;
        left: 10px;
        right: 10px;
        flex-direction: column;
        border-radius: 12px;
        padding: 10px;
        gap: 10px;
      }
      .prompt-container {
        max-width: 100%;
      }
      .meta-container {
        width: 100%;
        justify-content: space-between;
      }
      .meta-item {
        align-items: flex-start;
      }
      .image-label {
        bottom: 140px;
      }
    }
  </style>
</head>
<body>

  <!-- Persistent HUD Unhide Trigger -->
  <div class="hud-unhide-button" id="btn-unhide" title="Show UI overlays (H)">
    <svg style="width: 18px; height: 18px; color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  </div>

  <!-- Header -->
  <header id="hud-header">
    <div class="header-title-container">
      <div class="status-dot"></div>
      <div>
        <h1 class="header-title">Architectural Render Compare</h1>
      </div>
      <div class="header-subtitle">COMPARISON DASHBOARD</div>
    </div>
    
    <div class="button-group">
      <!-- Image Fit Toggle -->
      <button class="btn btn-secondary" id="btn-fit" title="Toggle between covering screen or containing image inside screen">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        <span>Fit: Cover</span>
      </button>

      <!-- Toggle UI Overlay -->
      <button class="btn btn-secondary" id="btn-toggle-hud" title="Toggle HUD overlays. (Keyboard: H)">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <span>Hide UI</span>
      </button>

      <!-- True Fullscreen API Button -->
      <button class="btn btn-secondary" id="btn-fullscreen" title="Toggle true system full screen mode">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span>Fullscreen</span>
      </button>

      <button class="btn btn-secondary" id="btn-sweep" title="Auto-sweep the comparison slider to demo the before and after transition">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Play Demo Sweep</span>
      </button>
      
      ${originalImageURL ? `
        <a href="${originalImageURL}" download="AI_Render_Before_Reference.png" class="btn btn-secondary" id="btn-download-before">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Download Reference</span>
        </a>
      ` : ''}
      
      <a href="${finalImageURL}" download="AI_Render_Export_${selectedResolution}.png" class="btn btn-primary" id="btn-download-after">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download High-Res Render</span>
      </a>
    </div>
  </header>

  <!-- Main Comparison Area -->
  <main>
    ${originalImageURL ? `
      <!-- Before & After Comparison Slider -->
      <div class="slider-container" id="slider-box">
        <!-- After Image (Base) -->
        <img src="${finalImageURL}" alt="AI Refined Architectural Render (After)" id="img-after" />
        
        <!-- Before Image (Clipped Container) -->
        <div class="before-container" id="before-box">
          <img src="${originalImageURL}" alt="Original Viewport Reference (Before)" id="img-before" />
        </div>
        
        <!-- Dynamic Slideline and Handle Button -->
        <div class="slider-handle" id="slider-bar">
          <div class="slider-handle-button">
            <!-- Chevrons Left/Right -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 7-5 5 5 5"></path>
              <path d="m15 7 5 5-5 5"></path>
            </svg>
          </div>
        </div>
        
        <!-- Position Indicators -->
        <div class="image-label label-before" id="lbl-before">Before: Reference</div>
        <div class="image-label label-after" id="lbl-after">After: AI Refined</div>
        
        <!-- Invisible Range Input for Full-Area Touch & Drag Controls -->
        <input type="range" min="0" max="100" value="50" class="slider-range" id="compare-slider" />
      </div>
    ` : `
      <!-- Fallback Single Image View if No Reference Capture exists -->
      <div class="single-image-mode">
        <div class="single-image-wrapper">
          <img src="${finalImageURL}" alt="AI Refined Architectural Render" />
          <div class="image-label label-after" style="bottom: 100px; right: 20px;">AI Refined Output</div>
        </div>
      </div>
    `}
  </main>

  <!-- Footer Info Bar -->
  <footer id="hud-footer">
    <div class="prompt-container">
      <div class="prompt-label">AI Rendering Prompt</div>
      <div class="prompt-text prompt-tooltip-trigger" title="${escapedPromptForTitle}">
        "${activePromptEscaped}"
      </div>
    </div>
    
    <div class="meta-container">
      <div class="meta-item">
        <span class="meta-label">Active AI Model</span>
        <span class="meta-val">${activeModel.toUpperCase()}</span>
      </div>
      <div class="meta-item" style="border-left: 1px solid var(--border-color); padding-left: 16px;">
        <span class="meta-label">Selected Resolution</span>
        <span class="meta-val">${selectedResolution}</span>
      </div>
    </div>
  </footer>

  <!-- Interactivity Script -->
  <script>
    const slider = document.getElementById('compare-slider');
    const beforeBox = document.getElementById('before-box');
    const sliderBar = document.getElementById('slider-bar');
    const sliderBox = document.getElementById('slider-box');
    const btnSweep = document.getElementById('btn-sweep');
    const btnToggleHud = document.getElementById('btn-toggle-hud');
    const btnUnhide = document.getElementById('btn-unhide');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnFit = document.getElementById('btn-fit');

    // 1. Comparison Slider Handling
    if (slider && beforeBox && sliderBar) {
      // Input Event: Dragging/clicking the comparison slider range
      slider.addEventListener('input', (e) => {
        const val = e.target.value;
        updateSliderPosition(val);
      });

      // Show/Hide indicators on active dragging
      slider.addEventListener('mousedown', () => {
        sliderBox.classList.add('is-dragging');
      });
      slider.addEventListener('touchstart', () => {
        sliderBox.classList.add('is-dragging');
      });
      slider.addEventListener('mouseup', () => {
        sliderBox.classList.remove('is-dragging');
      });
      slider.addEventListener('touchend', () => {
        sliderBox.classList.remove('is-dragging');
      });

      function updateSliderPosition(percent) {
        beforeBox.style.clipPath = \`polygon(0 0, \${percent}% 0, \${percent}% 100%, 0 100%)\`;
        sliderBar.style.left = \`\${percent}%\`;
      }

      // Auto-Sweep Demo Feature
      let sweepInterval = null;
      let sweepingRight = true;
      let sweepVal = 50;

      if (btnSweep) {
        btnSweep.addEventListener('click', () => {
          if (sweepInterval) {
            // Stop Sweep
            clearInterval(sweepInterval);
            sweepInterval = null;
            btnSweep.classList.remove('btn-primary');
            btnSweep.classList.add('btn-secondary');
            btnSweep.querySelector('span').textContent = 'Play Demo Sweep';
            btnSweep.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
          } else {
            // Start Sweep
            btnSweep.classList.remove('btn-secondary');
            btnSweep.classList.add('btn-primary');
            btnSweep.querySelector('span').textContent = 'Stop Demo Sweep';
            btnSweep.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
            
            sweepInterval = setInterval(() => {
              if (sweepingRight) {
                sweepVal += 1.2;
                if (sweepVal >= 95) {
                  sweepingRight = false;
                }
              } else {
                sweepVal -= 1.2;
                if (sweepVal <= 5) {
                  sweepingRight = true;
                }
              }
              slider.value = sweepVal;
              updateSliderPosition(sweepVal);
            }, 20);
          }
        });
      }
    } else {
      // Hide Demo button if no slider exists (e.g., single image view)
      if (btnSweep) {
        btnSweep.style.display = 'none';
      }
    }

    // 2. Toggle HUD UI (Collapsible layout)
    function toggleHud() {
      document.body.classList.toggle('hide-hud');
      if (document.body.classList.contains('hide-hud')) {
        if (btnToggleHud) btnToggleHud.querySelector('span').textContent = 'Show UI';
      } else {
        if (btnToggleHud) btnToggleHud.querySelector('span').textContent = 'Hide UI';
      }
    }

    if (btnToggleHud) {
      btnToggleHud.addEventListener('click', toggleHud);
    }
    if (btnUnhide) {
      btnUnhide.addEventListener('click', toggleHud);
    }

    // Toggle via Keyboard: "H" key
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h') {
        toggleHud();
      }
    });

    // 3. System Fullscreen API Handling
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn("Fullscreen request denied or failed:", err);
          });
          btnFullscreen.querySelector('span').textContent = 'Exit Fullscreen';
        } else {
          document.exitFullscreen();
          btnFullscreen.querySelector('span').textContent = 'Fullscreen';
        }
      });
    }

    // Update button text if fullscreen status changes externally
    document.addEventListener('fullscreenchange', () => {
      if (btnFullscreen) {
        if (document.fullscreenElement) {
          btnFullscreen.querySelector('span').textContent = 'Exit Fullscreen';
        } else {
          btnFullscreen.querySelector('span').textContent = 'Fullscreen';
        }
      }
    });

    // 4. Image Fit Toggle (Cover vs. Contain)
    let isCover = true;
    if (btnFit) {
      btnFit.addEventListener('click', () => {
        isCover = !isCover;
        if (isCover) {
          document.body.classList.remove('img-fit-contain');
          btnFit.querySelector('span').textContent = 'Fit: Cover';
          btnFit.querySelector('svg').innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line>';
        } else {
          document.body.classList.add('img-fit-contain');
          btnFit.querySelector('span').textContent = 'Fit: Contain';
          btnFit.querySelector('svg').innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line>';
        }
      });
    }
  </script>
</body>
</html>
      `);
      presentationWindow.document.close();
    } catch (error) {
      console.error("Failed to open presentation window:", error);
      alert("Popup blocked! Please permit multi-window / popup access for this domain to view the full-screen presentation.");
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [accountRole]);

  const handleViewsImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportViewsError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          const isValid = data.every(item => item.id && item.name && typeof item.longitude === 'number' && typeof item.latitude === 'number');
          if (isValid) {
            onImportSavedViews(data);
          } else {
            setImportViewsError("Invalid format. Expected array of location presets.");
          }
        } else {
          setImportViewsError("Invalid format. Must be an array of views.");
        }
      } catch (err) {
        setImportViewsError("Failed to parse JSON views file.");
      }
    };
    reader.readAsText(file);
  };

  const handleProjectImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProjectError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data && typeof data === 'object') {
          onOpenProject(data);
        } else {
          setProjectError("Invalid project file format.");
        }
      } catch (err) {
        setProjectError("Failed to parse JSON project file.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportSavedViews = () => {
    if (savedViews.length === 0) return;
    const defaultName = `saved_views_${new Date().toISOString().slice(0, 10)}`;
    const inputName = window.prompt("Enter filename for exported views:", defaultName);
    if (inputName === null) return; // User cancelled
    const finalName = (inputName.trim() || defaultName).replace(/\.json$/i, '') + '.json';

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedViews, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", finalName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return;

    // 1. Check if the searchQuery matches any of our predefined location presets first (case-insensitive)
    const matchedPreset = LOCATION_PRESETS.find(p => 
      p.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    if (matchedPreset) {
      onFlyTo(matchedPreset);
      setSearchQuery(matchedPreset.name);
      setSearchError(null);
      setIsDropdownOpen(false);
      return;
    }

    // 2. Try parsing query as Lat/Long coordinates: e.g. "40.7128, -74.0060" or "40.7128 -74.0060"
    const coordRegexComma = /^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*$/;
    const coordRegexSpace = /^\s*([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*$/;
    
    let lat: number | null = null;
    let lon: number | null = null;
    
    const commaMatch = searchQuery.match(coordRegexComma);
    const spaceMatch = searchQuery.match(coordRegexSpace);
    
    if (commaMatch) {
      lat = parseFloat(commaMatch[1]);
      lon = parseFloat(commaMatch[2]);
    } else if (spaceMatch) {
      lat = parseFloat(spaceMatch[1]);
      lon = parseFloat(spaceMatch[2]);
    }

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        onFlyTo({
          id: `custom-coords-${Date.now()}`,
          name: `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
          description: 'User specified custom coordinates',
          longitude: lon,
          latitude: lat,
          height: 3500,
          pitch: -45,
          heading: 0,
          roll: 0
        });
        setSearchError(null);
        setIsDropdownOpen(false);
        return;
      }
    }

    // 3. Not coordinates and not exact preset - run OpenStreetMap Nominatim Geocoding search
    try {
      setIsSearching(true);
      setSearchError(null);
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`);
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        const foundLat = parseFloat(data[0].lat);
        const foundLon = parseFloat(data[0].lon);
        const displayName = data[0].display_name;
        
        let height = 3500;
        if (data[0].boundingbox) {
          const south = parseFloat(data[0].boundingbox[0]);
          const north = parseFloat(data[0].boundingbox[1]);
          const west = parseFloat(data[0].boundingbox[2]);
          const east = parseFloat(data[0].boundingbox[3]);
          const deltaLat = Math.abs(north - south);
          const deltaLon = Math.abs(east - west);
          const maxDelta = Math.max(deltaLat, deltaLon);
          if (maxDelta > 0) {
            height = Math.max(1200, Math.min(30000, maxDelta * 111000 * 1.5));
          }
        }

        onFlyTo({
          id: `searched-${Date.now()}`,
          name: data[0].name || searchQuery,
          description: displayName,
          longitude: foundLon,
          latitude: foundLat,
          height: height,
          pitch: -45,
          heading: 0,
          roll: 0
        });
        setSearchQuery(data[0].name || searchQuery);
        setSearchError(null);
        setIsDropdownOpen(false);
      } else {
        setSearchError(`No results found for "${searchQuery}"`);
      }
    } catch (err: any) {
      console.error('Search query geocoding failed:', err);
      setSearchError('Search failed. Check your network or try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Drag and drop / local loading states
  const [isDraggingZip, setIsDraggingZip] = useState(false);
  const [isDraggingZipA, setIsDraggingZipA] = useState(false);
  const [isDraggingDxf, setIsDraggingDxf] = useState(false);
  const [cadErrorOverlay, setCadErrorOverlay] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [isParsingZipA, setIsParsingZipA] = useState(false);
  const [isParsingDxf, setIsParsingDxf] = useState(false);
  const [zipErrorA, setZipErrorA] = useState<string | null>(null);
  const [dxfError, setDxfError] = useState<string | null>(null);
  const [uploadedDxfFile, setUploadedDxfFile] = useState<File | null>(null);
  const [uploadedDxfText, setUploadedDxfText] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [selectedCrs, setSelectedCrs] = useState<string>('INHERITED_UTM');
  const [crsSearchQuery, setCrsSearchQuery] = useState('');
  const [isCrsDropdownOpen, setIsCrsDropdownOpen] = useState(false);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const zipInputRefA = useRef<HTMLInputElement>(null);

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
      // Read DXF as a text string using native FileReader
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file as text'));
        reader.readAsText(file);
      });

      // Pass true for allowOpenPolylines so line segments are successfully ingested as pipes!
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
  const dxfInputRef = useRef<HTMLInputElement>(null);

  // 3D Model local states and refs
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // 3D Data Ingestion Deck states and refs
  const [isDraggingTier1, setIsDraggingTier1] = useState(false);
  const [tier1Error, setTier1Error] = useState<string | null>(null);
  const [tier1Advisory, setTier1Advisory] = useState<string | null>(null);
  const tier1InputRef = useRef<HTMLInputElement>(null);

  const [isGraphicsExpanded, setIsGraphicsExpanded] = useState(false);
  const [ionFallbackId, setIonFallbackId] = useState('');
  const [fallbackTokenInput, setFallbackTokenInput] = useState('');
  const [streamedAssetIdInput, setStreamedAssetIdInput] = useState('');

  // Photoshop JPG Texture local states and refs
  const [isDraggingTexture, setIsDraggingTexture] = useState(false);
  const [textureError, setTextureError] = useState<string | null>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);

  const handleModelFile = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.glb') && !lowerName.endsWith('.gltf')) {
      setModelError('Invalid format. Please upload a 3D model (.glb or .gltf).');
      return;
    }

    setModelError(null);
    try {
      const url = URL.createObjectURL(file);
      onModelUrlChange(url, file.name);

      const meta = await parseGeospatialMetadata(file);
      if (meta && meta.latitude !== undefined && meta.longitude !== undefined) {
        if (meta.latitude !== undefined) onModelLatitudeChange(meta.latitude);
        if (meta.longitude !== undefined) onModelLongitudeChange(meta.longitude);
        if (meta.height !== undefined) onModelHeightChange(meta.height);
      } else {
        // Non-georeferenced model: activate interactive cursor placement so user can place anywhere in viewport
        onIsPickingLocationChange?.(true);
      }
    } catch (err: any) {
      console.error(err);
      setModelError('Failed to load 3D model.');
      onModelUrlChange(null, null);
    }
  };

  const handleClearModel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onModelUrlChange(null, null);
    setModelError(null);
    if (modelInputRef.current) modelInputRef.current.value = '';
  };

  const handleTier1File = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    
    const acceptable = ['.gltf', '.glb', '.geojson', '.zip'];
    const matches = acceptable.some(ext => lowerName.endsWith(ext));
    if (!matches) {
      setTier1Error('Invalid file type for Tier 1. Acceptable: .gltf, .glb, .geojson, .zip');
      return;
    }

    setTier1Error(null);
    setTier1Advisory(null);
    try {
      if (lowerName.endsWith('.zip')) {
        // Unzip and find tileset.json
        const zip = await JSZip.loadAsync(file);
        let tilesetEntry: any = null;
        let tilesetPath = '';
        
        for (const [path, entry] of Object.entries(zip.files)) {
          if (!entry.dir && path.toLowerCase().endsWith('tileset.json')) {
            tilesetEntry = entry;
            tilesetPath = path;
            break;
          }
        }

        if (!tilesetEntry) {
          setTier1Error('Invalid 3D Tiles zip: Master tileset.json not found inside the zip archive.');
          return;
        }

        const lastSlashIdx = tilesetPath.lastIndexOf('/');
        const parentDir = lastSlashIdx !== -1 ? tilesetPath.substring(0, lastSlashIdx + 1) : '';

        const zipFiles: Record<string, JSZip.JSZipObject> = {};
        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          
          let relPath = path;
          if (parentDir && path.startsWith(parentDir)) {
            relPath = path.substring(parentDir.length);
          }
          zipFiles[relPath] = entry;
        }

        // Pass the virtual tileset path to model url change with zipFiles
        onModelUrlChange(`virtual://zip-tileset/tileset.json`, file.name, zipFiles);
      } else if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) {
        await handleModelFile(file);
      } else {
        const url = URL.createObjectURL(file);
        const type = lowerName.endsWith('.geojson') ? 'geojson' : 'kml';
        onLocalVectorChange?.(url, file.name, type);
      }
    } catch (err: any) {
      console.error(err);
      setTier1Error('Failed to load local asset: ' + (err.message || err));
    }
  };

  const handleZipFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setZipErrorA('Invalid format. Please upload a compressed Shapefile archive (.zip).');
      return;
    }

    setIsParsingZipA(true);
    setZipErrorA(null);
    setCadErrorOverlay(false);

    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await parseShapefileZip(buffer, false, boundaryCenter);
      onPolygonDataChange?.(parsedData.polygonData, file.name, parsedData.shapefileData);
      if (onAddGisLayer) {
        onAddGisLayer(parsedData.polygonData, file.name, parsedData.shapefileData);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'LOCAL_GRID_DETECTED') {
        setCadErrorOverlay(true);
      } else {
        const errMsg = err.message || 'Error parsing zipped Shapefile. Ensure it contains .shp, .dbf, and .shx files.';
        setZipErrorA(errMsg);
      }
      onPolygonDataChange?.(null, null);
    } finally {
      setIsParsingZipA(false);
    }
  };

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingZip(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleZipFile(e.dataTransfer.files[0]);
    }
  };

  const handleZipDropA = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingZipA(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleZipFile(e.dataTransfer.files[0]);
    }
  };

  const getActiveViewportCenter = (): { lat: number; lng: number } => {
    try {
      const viewer = (window as any).cesiumViewer;
      if (viewer && !viewer.isDestroyed() && viewer.camera && viewer.scene && viewer.canvas) {
        const ray = viewer.camera.getPickRay(
          new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2)
        );
        let cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
        if (!cartesian) {
          cartesian = viewer.camera.position;
        }
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          const lng = Cesium.Math.toDegrees(cartographic.longitude);
          if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
          }
        }
      }
    } catch (_) {}
    return workspaceOrigin || { lat: 24.4539, lng: 54.3773 };
  };

  const handleDxfFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      setDxfError('Invalid format. Please upload an AutoCAD DXF file (.dxf).');
      return;
    }

    setIsParsingDxf(true);
    setDxfError(null);

    try {
      // Read DXF as a text string using native FileReader
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file as text'));
        reader.readAsText(file);
      });

      const parsedData = parseDxfFile(text, selectedCrs, boundaryCenter, file.name, workspaceOrigin);

      setUploadedDxfFile(file);
      setUploadedDxfText(text);
      setSyncStatus(null);

      if (parsedData.hasOpenPolylines) {
        setSuccessToast(
          "Notice: Open lines were skipped. Imported closed boundaries to standard WGS84."
        );
        setTimeout(() => {
          setSuccessToast(null);
        }, 8000);
      } else {
        setSuccessToast(
          "CAD DXF successfully imported and projected onto standard WGS84 curved ellipsoid!"
        );
        setTimeout(() => {
          setSuccessToast(null);
        }, 8000);
      }

      if (onAddGisLayer) {
        onAddGisLayer(parsedData.polygonData, file.name, parsedData.shapefileData);
      } else {
        onPolygonDataChange(parsedData.polygonData, file.name, parsedData.shapefileData);
      }
    } catch (err: any) {
      console.error(err);
      setDxfError(err.message || 'Error parsing DXF file. Ensure it contains closed LWPOLYLINE boundary layers.');
      onPolygonDataChange(null, null);
    } finally {
      setIsParsingDxf(false);
    }
  };

  const handleDxfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDxf(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleDxfFile(e.dataTransfer.files[0]);
    }
  };

  const handleAlignModelHeadingToDxf = () => {
    if (polygonData && polygonData.positions && polygonData.positions.length >= 2) {
      const p1 = polygonData.positions[0]; // [lng, lat]
      const p2 = polygonData.positions[1]; // [lng, lat]
      
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const toDeg = (rad: number) => (rad * 180) / Math.PI;

      const lon1 = toRad(p1[0]);
      const lat1 = toRad(p1[1]);
      const lon2 = toRad(p2[0]);
      const lat2 = toRad(p2[1]);

      const dLon = lon2 - lon1;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      let bearing = toDeg(Math.atan2(y, x));
      bearing = (bearing + 360) % 360;

      // Apply the calculated angle directly to model heading (with 2 decimal precision)
      const roundedBearing = Math.round(bearing * 100) / 100;
      onModelHeadingChange(roundedBearing);

      setSuccessToast(`Model orientation aligned to DXF segment segment: ${roundedBearing.toFixed(2)}° relative to true North.`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
    } else {
      alert("No active imported DXF boundary segment found. Please import a CAD .dxf file containing a valid closed footprint first.");
    }
  };

  const handleTextureFile = (file: File) => {
    if (!file) return;
    const isJpg = file.type === 'image/jpeg' || 
                  file.name.toLowerCase().endsWith('.jpg') || 
                  file.name.toLowerCase().endsWith('.jpeg');
    if (!isJpg) {
      setTextureError('Invalid format. Only JPEG/JPG texture files are allowed (PNG is disabled).');
      return;
    }

    setTextureError(null);
    try {
      const url = URL.createObjectURL(file);
      const targetCadLayer = (gisLayers || []).find((l: any) => l.id === activeLayerId) ||
        (gisLayers || []).find((l: any) => l.shapefileData?.isCad || l.name?.toLowerCase().endsWith('.dxf'));
      if (targetCadLayer && onLayerTextureChange) {
        onLayerTextureChange(targetCadLayer.id, url, file.name);
      } else {
        onTextureUrlChange(url, file.name);
      }
    } catch (err: any) {
      console.error(err);
      setTextureError('Failed to load JPEG texture.');
      onTextureUrlChange(null, null);
    }
  };

  const handleTextureDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingTexture(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleTextureFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearTexture = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTextureUrlChange(null, null);
    if (activeLayerId && onLayerTextureChange) {
      onLayerTextureChange(activeLayerId, null, null);
    }
    setTextureError(null);
    if (textureInputRef.current) textureInputRef.current.value = '';
  };

  const handleClearZip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPolygonDataChange?.(null, null);
    setZipErrorA(null);
    setDxfError(null);
    setUploadedDxfFile(null);
    setUploadedDxfText(null);
    setSyncStatus(null);
    if (zipInputRef.current) zipInputRef.current.value = '';
    if (zipInputRefA.current) zipInputRefA.current.value = '';
    if (dxfInputRef.current) dxfInputRef.current.value = '';
  };

  const handleInheritViewProjection = () => {
    const viewer = (window as any).cesiumViewer;
    if (!viewer) {
      setDxfError("Cesium viewer is not initialized yet.");
      return;
    }

    try {
      const canvas = viewer.canvas;
      const centerScreenPixels = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const rayPoint = viewer.camera.getPickRay(centerScreenPixels);
      if (!rayPoint) {
        setDxfError("Could not calculate pick ray from center view.");
        return;
      }
      
      let centerCartesian = viewer.scene.globe.pick(rayPoint, viewer.scene);
      if (!centerCartesian) {
        // Fall back to picking ellipsoid if terrain pick was unsuccessful
        centerCartesian = viewer.camera.pickEllipsoid(centerScreenPixels, viewer.scene.globe.ellipsoid);
      }

      if (centerCartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(centerCartesian);
        const viewLng = Cesium.Math.toDegrees(cartographic.longitude);
        const viewLat = Cesium.Math.toDegrees(cartographic.latitude);
        
        // Update global workspace baseline origin on the fly
        if (onWorkspaceOriginChange) {
          onWorkspaceOriginChange({ lat: viewLat, lng: viewLng });
        }

        const utmZone = Math.floor((viewLng + 180) / 6) + 1;

        // Change status to success state
        setSyncStatus(`✓ Synced to Local UTM Zone ${utmZone}`);

        setSelectedCrs('INHERITED_UTM');

        // If we have an uploaded DXF file, re-parse and project!
        if (uploadedDxfText && uploadedDxfFile) {
          const parsedData = parseDxfFile(
            uploadedDxfText,
            'INHERITED_UTM',
            boundaryCenter,
            uploadedDxfFile.name,
            { lat: viewLat, lng: viewLng }
          );

          if (parsedData.hasOpenPolylines) {
            setSuccessToast(
              "Notice: Open lines were skipped. Imported closed boundaries to standard WGS84."
            );
            setTimeout(() => {
              setSuccessToast(null);
            }, 8000);
          } else {
            setSuccessToast(
              `CAD DXF successfully re-projected onto UTM Zone ${utmZone}!`
            );
            setTimeout(() => {
              setSuccessToast(null);
            }, 8000);
          }

          if (onAddGisLayer) {
            onAddGisLayer(parsedData.polygonData, uploadedDxfFile.name, parsedData.shapefileData);
          } else {
            onPolygonDataChange?.(parsedData.polygonData, uploadedDxfFile.name, parsedData.shapefileData);
          }
        }

        // Invoke a rapid 'viewer.scene.requestRender()' pipeline call
        viewer.scene.requestRender();
      } else {
        setDxfError("Could not pick terrain intersection at the center of the viewport. Zoom in or look directly at the globe.");
      }
    } catch (err: any) {
      console.error(err);
      setDxfError(err.message || "Failed to inherit view projection.");
    }
  };



  const filteredPresets = LOCATION_PRESETS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStyle = (style: MapStyle) => {
    setGlobeState(prev => ({ ...prev, style }));
  };

  const toggleTerrain = () => {
    setGlobeState(prev => ({ ...prev, terrainEnabled: !prev.terrainEnabled }));
  };

  const toggleBuildings = () => {
    const nextVal = !globeState.buildings3dEnabled;
    setGlobeState(prev => ({ ...prev, buildings3dEnabled: nextVal }));
    const osm = layers.find(l => l.id === 'osm-buildings');
    if (osm && osm.enabled !== nextVal) {
      onToggleLayer('osm-buildings');
    }
  };

  const toggleAtmosphere = () => {
    setGlobeState(prev => ({ ...prev, atmosphereEnabled: !prev.atmosphereEnabled }));
  };

  const toggleFog = () => {
    setGlobeState(prev => ({ ...prev, fogEnabled: !prev.fogEnabled }));
  };

  if (isDrawerMode && isCollapsed) {
    return (
      <button
        id="sidebar-drawer-menu-toggle"
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="fixed top-3.5 left-3.5 z-40 px-3.5 py-2.5 bg-slate-950/90 border border-white/15 hover:border-cyan-400/50 rounded-xl text-xs font-semibold text-slate-100 shadow-2xl hover:bg-slate-900 transition-all flex items-center gap-2 cursor-pointer backdrop-blur-md font-mono min-w-[44px] min-h-[44px]"
        title="Open Menu Drawer"
      >
        <Menu className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
        <span className="font-semibold tracking-wide">Menu</span>
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
        id="sidebar-container" 
        animate={isDrawerMode ? { x: 0 } : { width: isCollapsed ? 64 : 320 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`${
          isDrawerMode 
            ? 'fixed top-0 left-0 bottom-0 z-50 h-full w-[320px] max-w-[85vw] flex flex-col overflow-visible shadow-2xl' 
            : 'h-full flex flex-col z-30 flex-shrink-0 overflow-visible relative'
        } ${
          sidebarTheme === 'light'
            ? 'sidebar-theme-light bg-white/95 text-slate-900 border-r border-slate-200 shadow-xl'
            : 'bg-slate-950/90 backdrop-blur-xl border-r border-white/10 text-slate-100 shadow-2xl'
        }`}
      >
        {/* Floating Expand/Collapse Toggle Button positioned cleanly on outer right edge */}
        <button
          type="button"
          onClick={() => handleToggleCollapse(!isCollapsed)}
          className={`absolute -right-4.5 top-1/2 -translate-y-1/2 z-[70] w-9 h-9 rounded-full border-2 border-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all cursor-pointer ${
            isCollapsed
              ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_4px_20px_rgba(0,242,254,0.4)]'
              : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:bg-cyan-500 hover:text-slate-950 hover:border-cyan-400'
          }`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 font-bold stroke-[3]" />
          ) : (
            <ChevronLeft className="w-5 h-5 font-bold stroke-[3]" />
          )}
        </button>

      {isCollapsed ? (
        <div className={`flex flex-col items-center h-full justify-between py-6 px-3 gap-6 w-16 absolute right-0 top-0 bottom-0 overflow-hidden select-none transition-colors duration-300 ${
          sidebarTheme === 'light' ? 'bg-white border-r border-slate-200' : ''
        }`}>
          {/* Top: Brand Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-25" />
              <div className="absolute inset-0 rounded-full border border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.3)]" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
              >
                <div className="w-1/2 h-1/2 bg-gradient-to-br from-cyan-400/50 via-cyan-400/15 to-transparent origin-bottom-right" />
              </motion.div>
              <div className="relative z-10 w-9 h-9 rounded-full bg-slate-900/90 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_10px_rgba(0,242,254,0.4)]">
                <Globe className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
                <motion.div
                  animate={{ y: [-1, 1, -1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#00f2fe]"
                />
              </div>
            </div>
          </div>

          {/* Middle: Tab Icons List */}
          <div className="flex flex-col gap-2.5 bg-white/5 border border-white/5 rounded-2xl p-1.5 my-auto">
            {[
              { id: 'controls', icon: Folder, label: 'Project', color: 'text-emerald-400' },
              { id: 'layers', icon: Layers, label: 'Layers', color: 'text-indigo-400 font-bold' },
              { id: 'import', icon: FolderInput, label: 'Import', color: 'text-blue-400' },
              { id: 'cesium-assets', icon: Globe, label: 'Cesium Assets', color: 'text-sky-400 animate-pulse' },
              { id: 'metrics', icon: Activity, label: 'Metrics', color: 'text-slate-400' },
              { id: 'landmarks', icon: MapPin, label: 'Landmarks', color: 'text-rose-400 animate-pulse' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    handleToggleCollapse(false);
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
                  <div className="absolute left-12 bg-slate-900 border border-white/10 text-xs text-slate-200 px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-medium font-sans">
                    {tab.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Inner Scrollable Wrapper */
        <div className="w-[320px] h-full flex flex-col p-6 gap-6 overflow-y-auto overflow-x-hidden">

          {/* Brand Header */}
          <div className="flex flex-col gap-2.5 flex-shrink-0">
            {/* Title Row with Animated Globe Logo */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-25" />
                <div className="absolute inset-0 rounded-full border border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.3)]" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                >
                  <div className="w-1/2 h-1/2 bg-gradient-to-br from-cyan-400/50 via-cyan-400/15 to-transparent origin-bottom-right" />
                </motion.div>
                <div className="relative z-10 w-7 h-7 rounded-full bg-slate-900/90 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_8px_rgba(0,242,254,0.4)]">
                  <Globe className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <motion.div
                    animate={{ y: [-1, 1, -1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-cyan-300 shadow-[0_0_4px_#00f2fe]"
                  />
                </div>
              </div>

              <h1 className="flex items-baseline gap-1.5 text-left min-w-0">
                <span className="font-urban-script text-lg text-cyan-300 font-semibold tracking-wide whitespace-nowrap">
                  Urban Planning
                </span>
                <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent uppercase whitespace-nowrap">
                  Geosphere
                </span>
                <span
                  className="text-blue-400 text-[9.5px] italic font-normal normal-case whitespace-nowrap ml-0.5"
                  style={{ fontFamily: "'Arial Narrow', 'Helvetica Narrow', 'Arial', sans-serif" }}
                >
                  V<span style={{ fontVariant: 'small-caps' }}>beta</span>
                </span>
              </h1>
            </div>

            {/* 4 Action Buttons Placed Neatly Below the Title */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onConfigureToken}
                className={`flex-1 h-7 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  sidebarTheme === 'dark'
                    ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-300'
                    : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700'
                }`}
                title="Configure / Change Ion Token"
              >
                <Key className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] tracking-wide whitespace-nowrap">Ion Token</span>
              </button>

              {onOpenIntro && (
                <button
                  type="button"
                  onClick={onOpenIntro}
                  className={`h-7 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                    sidebarTheme === 'dark'
                      ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300'
                      : 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100 text-cyan-700'
                  }`}
                  title="Welcome Page"
                >
                  <Menu className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              )}

              {onOpenNavInstructions && (
                <button
                  type="button"
                  onClick={onOpenNavInstructions}
                  className={`h-7 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                    sidebarTheme === 'dark'
                      ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
                  }`}
                  title="Mouse & Touch Navigation Instructions"
                >
                  <Mouse className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const nextTheme = sidebarTheme === 'dark' ? 'light' : 'dark';
                  if (onSidebarThemeChange) {
                    onSidebarThemeChange(nextTheme);
                  }
                  localStorage.setItem('ui_theme', nextTheme);
                }}
                className={`h-7 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center border-0 ${
                  sidebarTheme === 'dark'
                    ? 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                    : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title={sidebarTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {sidebarTheme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleAllSidebarSections}
                className={`h-7 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center border-0 ${
                  sidebarTheme === 'dark'
                    ? 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
                    : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title={areAllSidebarSectionsCollapsed ? "Un-collapse All" : "Collapse All"}
              >
                {areAllSidebarSectionsCollapsed ? (
                  <Plus className="w-3.5 h-3.5 text-slate-300" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
            </div>
          </div>



      {/* Fly-To Search Panel */}
      <div className="space-y-2 relative">
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
          Fly To Location
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search city or coordinates..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
              if (searchError) setSearchError(null);
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                await handleSearchSubmit();
              }
            }}
            onFocus={() => setIsDropdownOpen(true)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2.5 px-4 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
          />
          <button
            onClick={async () => {
              if (isDropdownOpen && searchQuery.trim() && filteredPresets.length === 0) {
                await handleSearchSubmit();
              } else {
                setIsDropdownOpen(!isDropdownOpen);
              }
            }}
            className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            {isSearching ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
        </div>

        {/* Floating Dropdown Result */}
        <AnimatePresence>
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl z-40 backdrop-blur-lg scrollbar-thin scrollbar-thumb-slate-800"
              >
                {isSearching && (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Searching global database...</span>
                  </div>
                )}
                {searchError && !isSearching && (
                  <div className="p-4 text-center text-xs text-red-400 font-medium bg-red-500/10 border-b border-white/5">
                    {searchError}
                  </div>
                )}
                {!isSearching && (
                  <>
                    {filteredPresets.length > 0 ? (
                      filteredPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onFlyTo(preset);
                            setSearchQuery(preset.name);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-start gap-2.5 group transition-colors cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">
                              {preset.name}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-snug mt-0.5">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500">
                        {searchQuery ? 'No presets match. Press [Enter] to search globally.' : 'Type a city and press Enter to search'}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 border border-white/5 text-[9px] font-medium text-slate-400 bg-white/5 rounded-lg p-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('controls')}
          className={`py-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${activeTab === 'controls' ? 'bg-emerald-600/20 text-emerald-400 font-semibold border border-emerald-500/30' : 'hover:text-slate-200 hover:bg-white/5'}`}
        >
          <Folder className="w-3.5 h-3.5 text-emerald-400" /> Project
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={`py-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${activeTab === 'layers' ? 'bg-indigo-600/20 text-indigo-400 font-semibold border border-indigo-500/30' : 'hover:text-slate-200 hover:bg-white/5'}`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" /> Layers
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`py-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${activeTab === 'import' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'hover:text-slate-200 hover:bg-white/5'}`}
        >
          <FolderInput className="w-3.5 h-3.5 text-blue-400" /> Import
        </button>
        <button
          onClick={() => setActiveTab('cesium-assets')}
          className={`py-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${activeTab === 'cesium-assets' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'hover:text-slate-200 hover:bg-white/5'}`}
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" /> Cesium Assets
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`py-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${activeTab === 'metrics' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'hover:text-slate-200 hover:bg-white/5'}`}
        >
          <Activity className="w-3.5 h-3.5" /> Metrics
        </button>
        <button
          onClick={() => setActiveTab('landmarks')}
          className={`py-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${activeTab === 'landmarks' ? 'bg-rose-500/20 text-rose-400 font-semibold' : 'hover:text-slate-200 hover:bg-white/5'}`}
        >
          <MapPin className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Landmarks
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
        {pickedAssetMetadata && (
          <div className="p-4 bg-gradient-to-br from-slate-900 to-[#0d1527] border border-blue-500/30 rounded-2xl space-y-3.5 text-left animate-fadeIn shadow-lg shadow-blue-500/5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Asset Metadata Attributes
                </h4>
              </div>
              <button
                type="button"
                onClick={() => onPickedAssetMetadataChange?.(null)}
                className="text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
              >
                Clear
              </button>
            </div>
            
            <div className="text-[11px] font-semibold text-slate-200 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-white/5 truncate font-mono">
              📄 {pickedAssetMetadata.name}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {Object.entries(pickedAssetMetadata.attributes || {}).length > 0 ? (
                Object.entries(pickedAssetMetadata.attributes).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 text-[10px] font-mono py-1 border-b border-white/5 last:border-0">
                    <span className="text-slate-400 font-medium shrink-0">{key}</span>
                    <span className="text-blue-300 text-right break-all max-w-[160px]" title={String(value)}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-500 italic text-center py-2">
                  No attributes found on this asset facet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'layers' && (
          <div className="space-y-4 text-left animate-fadeIn">
            {/* CARD HEADER */}
            <div className="p-4 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 font-sans tracking-wide">
                      Unified Layers System
                    </h3>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Centralized manager for all active GIS, Cesium, 3D Tool, and Base Globe layers
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Badges Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-sky-950/40 border border-sky-500/20 flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-medium">Cesium Assets</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    {cesiumLayersCount}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/20 flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-medium">GIS Imports</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    {gisLayersCount}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-medium">3D Tools & Massings</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    {toolsLayersCount}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-medium">Base Globe Layers</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {baseMapLayersCount} / {layers ? layers.length : 0}
                  </span>
                </div>
              </div>
            </div>

            {/* ACCORDION 1: CESIUM LAYERS MANAGER */}
            <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleLayerAccordion('cesium')}
                className="w-full p-3.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2 font-mono">
                      <span>📁</span> Cesium Layers Manager
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        {cesiumLayersCount}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">Active 3D Tilesets, Ion Assets, and Project Layers</p>
                  </div>
                </div>
                {openLayerAccordions.cesium ? <Minus className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {openLayerAccordions.cesium && (
                <div className="p-3.5 border-t border-white/5 space-y-4 text-left bg-slate-950/40 animate-fadeIn">
                  {/* SUB-SECTION 1: CESIUM ASSETS LAYERS */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                        Cesium Assets Layers
                      </label>
                      {cesiumLayersCount > 0 && (
                        <span className="text-[8px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded font-bold border border-sky-500/20">
                          {cesiumLayersCount} {cesiumLayersCount === 1 ? 'Asset' : 'Assets'}
                        </span>
                      )}
                    </div>

                    {cesiumLayersCount > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {/* Streamed 3D Tileset (fallback loader) */}
                        {streamedTilesetId && (
                          <div
                            className={`p-2 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                              activeLayerId === 'streamed-tileset'
                                ? 'bg-sky-950/40 border-sky-500/50 shadow-md shadow-sky-500/5'
                                : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                            }`}
                            onClick={() => onActiveLayerIdChange?.('streamed-tileset')}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleStreamedTilesetVisibility?.();
                                }}
                                className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                  streamedTilesetVisible ? 'bg-sky-500 shadow-sm shadow-sky-500/20' : 'bg-slate-700'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${streamedTilesetVisible ? 'translate-x-3' : 'translate-x-0'}`} />
                              </button>
                              <div className="flex flex-col min-w-0 flex-1 text-left">
                                <span className="text-[10px] font-semibold text-slate-200 truncate" title="Streamed 3D Tileset">
                                  Streamed 3D Tileset
                                </span>
                                <span className="text-[8px] text-slate-500 font-mono">3DTILES • ID: {streamedTilesetId}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFlyToStreamedTileset();
                                }}
                                title="Fly to dataset"
                                className="p-1 hover:bg-white/5 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                              >
                                <Locate className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStreamedTilesetIdChange?.(null);
                                }}
                                title="Remove layer"
                                className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ArcGIS I3S Layers */}
                        {i3sLayers && i3sLayers.map((lyr) => (
                          <div 
                            key={lyr.id} 
                            onClick={() => onActiveLayerIdChange?.(lyr.id)}
                            className={`p-2 border rounded-xl flex flex-col gap-1.5 transition-all cursor-pointer ${
                              lyr.visible
                                ? 'bg-sky-950/25 border-sky-800/40' 
                                : 'bg-white/5 border-white/5'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full min-w-0 gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleI3sLayerVisibility?.(lyr.id);
                                  }}
                                  className={`w-7 h-4 rounded-full p-0.5 transition-colors flex-shrink-0 cursor-pointer ${lyr.visible ? 'bg-sky-500' : 'bg-slate-700'}`}
                                >
                                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${lyr.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="text-[10px] font-semibold text-slate-200 truncate">{lyr.name}</div>
                                  <div className="text-[8px] text-sky-400 font-mono">I3S STREAM</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFlyToI3sLayer(lyr);
                                  }}
                                  title="Fly to dataset"
                                  className="p-1 hover:bg-white/5 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                                >
                                  <Locate className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveI3sLayer?.(lyr.id);
                                  }}
                                  title="Remove layer"
                                  className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* External Streamed 3D Tilesets (from REST Link) */}
                        {activeLayers && activeLayers.map((lyr) => (
                          <div
                            key={lyr.id}
                            className={`p-2 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                              lyr.id === activeLayerId
                                ? 'bg-sky-950/40 border-sky-500/50 shadow-md shadow-sky-500/5'
                                : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                            }`}
                            onClick={() => onActiveLayerIdChange?.(lyr.id)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActiveLayerVisibility(lyr.id);
                                }}
                                className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                  lyr.visible 
                                    ? 'bg-sky-500 shadow-sm shadow-sky-500/20' 
                                    : 'bg-slate-700'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${lyr.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                              </button>
                              <div className="flex flex-col min-w-0 flex-1 text-left">
                                <span className="text-[10px] font-semibold text-slate-200 truncate" title={lyr.label}>
                                  {lyr.label}
                                </span>
                                <span className="text-[8px] text-slate-500 font-mono truncate" title={lyr.instance?.url || "3DTILES"}>
                                  3DTILES • {lyr.instance?.url ? lyr.instance.url.substring(0, 30) + '...' : 'External Stream'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFlyToActiveLayer(lyr);
                                }}
                                title="Fly to dataset"
                                className="p-1 hover:bg-white/5 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                              >
                                <Locate className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveActiveLayer(lyr.id);
                                }}
                                title="Remove layer"
                                className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Multi-Token Ion Account Loaded Assets (ONLY Loaded Assets) */}
                        {loadedIonAssets.map(({ account, asset }) => {
                          const outlineColor = asset.outlineColor || '#000000';
                          const outlineOpacity = asset.outlineOpacity !== undefined ? asset.outlineOpacity : 1.0;
                          const outlineThickness = asset.outlineThickness !== undefined ? asset.outlineThickness : 2.5;
                          const outlineEnabled = asset.outlineEnabled !== undefined ? asset.outlineEnabled : true;
                          return (
                            <div
                              key={`${account.id}-${asset.id}`}
                              className={`p-2.5 border rounded-xl flex flex-col gap-2 transition-all cursor-pointer ${
                                asset.visible !== false
                                  ? 'bg-sky-950/40 border-sky-500/40 shadow-md shadow-sky-500/5'
                                  : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleAssetVisibility(account.id, asset.id);
                                    }}
                                    className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                      asset.visible !== false
                                        ? 'bg-sky-500 shadow-sm shadow-sky-500/20'
                                        : 'bg-slate-700'
                                    }`}
                                    title={asset.visible !== false ? 'Turn Layer OFF' : 'Turn Layer ON'}
                                  >
                                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${asset.visible !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                                  </button>
                                  <div className="flex flex-col min-w-0 flex-1 text-left">
                                    <span className="text-[10px] font-semibold text-slate-200 truncate" title={asset.name}>
                                      {asset.name || `Ion Asset #${asset.id}`}
                                    </span>
                                    <span className="text-[8px] text-sky-400 font-mono truncate" title={`${asset.type || '3DTILES'} • ${(account as any).accountName || (account as any).name}`}>
                                      {asset.type || '3DTILES'} • {(account as any).accountName || (account as any).name || 'Cesium Ion'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlyToIonAssetWithVisibility(account.id, asset.id);
                                    }}
                                    title="Fly to asset"
                                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Locate className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleAssetLoad(account.id, asset.id);
                                    }}
                                    title="Unload layer"
                                    className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* 3D TILES OUTLINE STYLING CONTROLS */}
                              {(!asset.type || asset.type.toUpperCase().includes('3D') || asset.type.toUpperCase().includes('TILE')) && (
                                <div className="pt-2 border-t border-white/5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                                  {/* Outline Header & ON/OFF Toggle */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${outlineEnabled ? 'bg-sky-400 shadow-sm shadow-sky-400/50' : 'bg-slate-600'}`} />
                                      <span>Outline Effect</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIonAssetOutline(account.id, asset.id, undefined, undefined, undefined, !outlineEnabled)}
                                      className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                                        outlineEnabled
                                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                                          : 'bg-slate-800/80 text-slate-400 border border-white/5 hover:text-slate-300 hover:bg-slate-800'
                                      }`}
                                      title={outlineEnabled ? 'Click to Turn Outlines OFF' : 'Click to Turn Outlines ON'}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${outlineEnabled ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'}`} />
                                      {outlineEnabled ? 'ON' : 'OFF'}
                                    </button>
                                  </div>

                                  {outlineEnabled && (
                                    <div className="flex flex-col gap-2 pt-0.5 bg-black/20 p-2 rounded-lg border border-white/5">
                                      {/* Thickness Slider */}
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] text-slate-400 font-mono">Thickness</span>
                                          <span className="text-sky-300 font-mono text-[9px] font-bold">{outlineThickness.toFixed(1)} px</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="0.5"
                                          max="8.0"
                                          step="0.5"
                                          value={outlineThickness}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            handleUpdateIonAssetOutline(account.id, asset.id, undefined, undefined, val, undefined);
                                          }}
                                          className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                        />
                                      </div>

                                      {/* Opacity Slider */}
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] text-slate-400 font-mono">Opacity</span>
                                          <span className="text-slate-300 font-mono text-[9px] font-bold">
                                            {Math.round(outlineOpacity * 100)}%
                                          </span>
                                        </div>
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          step="1"
                                          value={Math.round(outlineOpacity * 100)}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) / 100;
                                            handleUpdateIonAssetOutline(account.id, asset.id, undefined, val, undefined, undefined);
                                          }}
                                          className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                        />
                                      </div>

                                      {/* Outline Color Selector */}
                                      <div className="flex items-center justify-between gap-2 pt-0.5">
                                        <span className="text-[9px] text-slate-400 font-mono">Color</span>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="color"
                                            value={outlineColor}
                                            onChange={(e) => {
                                              handleUpdateIonAssetOutline(account.id, asset.id, e.target.value, undefined, undefined, undefined);
                                            }}
                                            className="w-4 h-4 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
                                            title="Outline Color (Default: Black)"
                                          />
                                          {/* Quick Swatches */}
                                          <div className="flex items-center gap-1">
                                            {[
                                              { hex: '#000000', name: 'Black (Default)' },
                                              { hex: '#334155', name: 'Dark Slate' },
                                              { hex: '#FFFFFF', name: 'White' },
                                              { hex: '#06B6D4', name: 'Cyan' },
                                              { hex: '#3B82F6', name: 'Blue' }
                                            ].map(swatch => (
                                              <button
                                                key={swatch.hex}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUpdateIonAssetOutline(account.id, asset.id, swatch.hex, undefined, undefined, undefined);
                                                }}
                                                className={`w-3.5 h-3.5 rounded-full border transition-transform shrink-0 ${
                                                  outlineColor.toUpperCase() === swatch.hex.toUpperCase()
                                                    ? 'border-white scale-125 ring-1 ring-sky-400'
                                                    : 'border-white/20 hover:scale-110'
                                                }`}
                                                style={{ backgroundColor: swatch.hex }}
                                                title={swatch.name}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Imported 3D Tile Assets */}
                        {importedLayers && importedLayers.filter(l => l.type === '3d-tiles' || l.type === 'cesium').map((lyr) => {
                          const outlineColor = lyr.outlineColor || lyr.silhouetteColor || '#000000';
                          const outlineOpacity = lyr.outlineOpacity !== undefined ? lyr.outlineOpacity : 1.0;
                          const outlineThickness = lyr.outlineThickness !== undefined ? lyr.outlineThickness : 2.5;
                          const outlineEnabled = lyr.outlineEnabled !== undefined ? lyr.outlineEnabled : true;
                          return (
                            <div key={lyr.id} className="p-2.5 border rounded-xl flex flex-col gap-2 transition-all cursor-pointer bg-slate-950/45 border-white/5 hover:border-white/10">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(lyr.id);
                                    }}
                                    className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                      lyr.visible !== false ? 'bg-sky-500 shadow-sm shadow-sky-500/30' : 'bg-slate-700'
                                    }`}
                                  >
                                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${lyr.visible !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                                  </button>
                                  <div className="flex flex-col min-w-0 flex-1 text-left">
                                    <span className="text-[10px] font-semibold text-slate-200 truncate">{lyr.name}</span>
                                    <span className="text-[8px] text-slate-400 font-mono">3DTILES • Local Import</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlyToActiveLayer(lyr);
                                    }}
                                    title="Fly to asset"
                                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Locate className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteLayer?.(lyr.id);
                                    }}
                                    title="Delete layer"
                                    className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* 3D TILES OUTLINE STYLING CONTROLS */}
                              <div className="pt-2 border-t border-white/5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                                {/* Outline Header & ON/OFF Toggle */}
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${outlineEnabled ? 'bg-sky-400 shadow-sm shadow-sky-400/50' : 'bg-slate-600'}`} />
                                    <span>Outline Effect</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateImportedLayerOutline(lyr.id, undefined, undefined, undefined, !outlineEnabled)}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                                      outlineEnabled
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                                        : 'bg-slate-800/80 text-slate-400 border border-white/5 hover:text-slate-300 hover:bg-slate-800'
                                    }`}
                                    title={outlineEnabled ? 'Click to Turn Outlines OFF' : 'Click to Turn Outlines ON'}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${outlineEnabled ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'}`} />
                                    {outlineEnabled ? 'ON' : 'OFF'}
                                  </button>
                                </div>

                                {outlineEnabled && (
                                  <div className="flex flex-col gap-2 pt-0.5 bg-black/20 p-2 rounded-lg border border-white/5">
                                    {/* Thickness Slider */}
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-slate-400 font-mono">Thickness</span>
                                        <span className="text-sky-300 font-mono text-[9px] font-bold">{outlineThickness.toFixed(1)} px</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0.5"
                                        max="8.0"
                                        step="0.5"
                                        value={outlineThickness}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          handleUpdateImportedLayerOutline(lyr.id, undefined, undefined, val, undefined);
                                        }}
                                        className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                      />
                                    </div>

                                    {/* Opacity Slider */}
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-slate-400 font-mono">Opacity</span>
                                        <span className="text-slate-300 font-mono text-[9px] font-bold">
                                          {Math.round(outlineOpacity * 100)}%
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={Math.round(outlineOpacity * 100)}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) / 100;
                                          handleUpdateImportedLayerOutline(lyr.id, undefined, val, undefined, undefined);
                                        }}
                                        className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-0.5">
                                      <span className="text-[9px] text-slate-400 font-mono">Color</span>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="color"
                                          value={outlineColor}
                                          onChange={(e) => {
                                            handleUpdateImportedLayerOutline(lyr.id, e.target.value, undefined, undefined, undefined);
                                          }}
                                          className="w-4 h-4 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
                                          title="Outline Color (Default: Black)"
                                        />
                                        <div className="flex items-center gap-1">
                                          {[
                                            { hex: '#000000', name: 'Black (Default)' },
                                            { hex: '#334155', name: 'Dark Slate' },
                                            { hex: '#FFFFFF', name: 'White' },
                                            { hex: '#06B6D4', name: 'Cyan' },
                                            { hex: '#3B82F6', name: 'Blue' }
                                          ].map(swatch => (
                                            <button
                                              key={swatch.hex}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateImportedLayerOutline(lyr.id, swatch.hex, undefined, undefined, undefined);
                                              }}
                                              className={`w-3.5 h-3.5 rounded-full border transition-transform shrink-0 ${
                                                outlineColor.toUpperCase() === swatch.hex.toUpperCase()
                                                  ? 'border-white scale-125 ring-1 ring-sky-400'
                                                  : 'border-white/20 hover:scale-110'
                                              }`}
                                              style={{ backgroundColor: swatch.hex }}
                                              title={swatch.name}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed border-white/5 bg-slate-950/20 rounded-2xl text-center">
                        <Globe className="w-4 h-4 text-slate-600 mx-auto mb-1 opacity-60" />
                        <p className="text-[9px] text-slate-400 font-medium">No active Cesium assets loaded</p>
                        <p className="text-[8px] text-slate-500 leading-normal mb-2">Configure and load Ion assets under "Cesium Streamers".</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('cesium-assets')}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] font-semibold hover:bg-sky-500/20 transition-colors cursor-pointer"
                        >
                          Open Cesium Streamers Catalog
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SUB-SECTION 2: ACTIVE 3D PROJECT LAYERS */}
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                        Active 3D Project Layers
                      </label>
                      {gisLayersCount > 0 && (
                        <span className="text-[8px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-bold border border-blue-500/20">
                          {gisLayersCount} {gisLayersCount === 1 ? 'Layer' : 'Layers'}
                        </span>
                      )}
                    </div>

                    {gisLayersCount > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {gisLayers && gisLayers.map((layer) => (
                          <div key={layer.id} className="p-2 border border-white/5 rounded-xl bg-slate-950/45 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                              <button
                                type="button"
                                onClick={() => onToggleGisLayerVisibility?.(layer.id)}
                                className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                  layer.visible ? 'bg-blue-500' : 'bg-slate-700'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${layer.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                              </button>
                              <div className="flex flex-col min-w-0 flex-1 text-left">
                                <span className="text-[10px] font-semibold text-slate-200 truncate">{layer.name}</span>
                                <span className="text-[8px] text-slate-500 font-mono">GIS SHAPEFILE</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onLocateGisLayer?.(layer.shapefileData?.bounds)}
                                title="Fly to layer"
                                className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                              >
                                <Locate className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveGisLayer?.(layer.id)}
                                title="Remove layer"
                                className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 flex flex-col items-center justify-center text-center gap-1.5 my-1">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400">
                          <Layers className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-300">No custom design files loaded</span>
                        <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                          Use the "Import" tab to upload local DXF, shapefiles, or models.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 2: IMPORTED GIS & SHAPEFILE LAYERS */}
            <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleLayerAccordion('gis')}
                className="w-full p-3.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      Imported GIS & Shapefile Layers
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {gisLayersCount}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">GeoJSON, Shapefiles, KML and Vector GIS Stack</p>
                  </div>
                </div>
                {openLayerAccordions.gis ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {openLayerAccordions.gis && (
                <div className="p-3 border-t border-white/5 space-y-2.5 bg-slate-950/40">
                  {gisLayers && gisLayers.map((layer) => (
                    <div key={layer.id} className="p-3 bg-slate-900/60 border border-white/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1 text-left">
                            <span className="text-xs font-semibold text-slate-200 truncate">{layer.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {layer.shapefileData?.features?.length || layer.shapefileData?.polygons?.length || 'Vector'} Features
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLocateGisLayer?.(layer.shapefileData?.bounds)}
                            title="Fly to layer"
                            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Locate className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleGisLayerVisibility?.(layer.id)}
                            className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                              layer.visible ? 'bg-blue-500 shadow-sm shadow-blue-500/30' : 'bg-slate-700'
                            }`}
                          >
                            <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${layer.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveGisLayer?.(layer.id)}
                            title="Remove layer"
                            className="p-1.5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-white/5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-400 font-mono font-bold block">Opacity</label>
                          <span className="text-slate-300 font-mono font-bold">
                            {Math.round((layer.opacity ?? 0.8) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((layer.opacity ?? 0.8) * 100)}
                          onChange={(e) => onGisLayerOpacityChange?.(layer.id, parseFloat(e.target.value) / 100)}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      {/* Per-Layer DXF / CAD Texture Controls */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-mono flex items-center gap-1">
                            <Image className="w-3 h-3 text-purple-400" />
                            Texture
                          </span>
                          {layer.textureUrl ? (
                            <span className="text-[9px] font-mono text-purple-400 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                              Draped
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-slate-500">None</span>
                          )}
                        </div>

                        {layer.textureUrl ? (
                          <div className="flex items-center justify-between p-1.5 bg-purple-950/30 border border-purple-500/25 rounded-lg text-[10px]">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <div className="w-5 h-5 rounded overflow-hidden bg-black shrink-0 border border-white/10 flex items-center justify-center">
                                <img
                                  src={layer.textureUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span
                                className="font-mono text-purple-300 truncate text-[9px]"
                                title={layer.textureName || ''}
                              >
                                {layer.textureName || 'CAD Texture'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <label
                                title="Replace texture"
                                className="p-1 hover:bg-white/10 text-slate-400 hover:text-purple-300 rounded cursor-pointer transition-colors"
                              >
                                <input
                                  type="file"
                                  accept="image/jpeg, image/jpg"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = URL.createObjectURL(file);
                                      onLayerTextureChange?.(layer.id, url, file.name);
                                    }
                                  }}
                                />
                                <RefreshCw className="w-3 h-3" />
                              </label>
                              <button
                                type="button"
                                onClick={() => onLayerTextureChange?.(layer.id, null, null)}
                                title="Remove texture"
                                className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-1.5 py-1 px-2 border border-dashed border-purple-500/30 hover:border-purple-400/60 bg-purple-950/10 hover:bg-purple-950/20 rounded-lg text-[9px] font-mono text-purple-300 cursor-pointer transition-all">
                            <input
                              type="file"
                              accept="image/jpeg, image/jpg"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = URL.createObjectURL(file);
                                  onLayerTextureChange?.(layer.id, url, file.name);
                                }
                              }}
                            />
                            <Upload className="w-2.5 h-2.5" />
                            Apply JPEG Texture
                          </label>
                        )}
                      </div>
                    </div>
                  ))}

                  {importedLayers && importedLayers.filter(l => l.type !== '3d-tiles' && l.type !== 'cesium').map((lyr) => {
                    const isModelActive = activeLayerId === lyr.id;
                    const isTier2 = lyr.type === 'tier2' || lyr.isTier2;
                    const formatLabel = lyr.type === 'clipping_polygon'
                      ? '3D Tiles Clipping Polygon'
                      : (lyr.type === 'parametric_massing'
                          ? 'Procedural Massing'
                          : (lyr.type === 'area_polygon'
                              ? 'Area Polygon'
                              : (isTier2 
                                  ? 'Procedural Massing' 
                                  : (lyr.name?.toLowerCase().endsWith('.glb') 
                                      ? '3D Model (.glb)' 
                                      : (lyr.name?.toLowerCase().endsWith('.gltf') 
                                          ? '3D Model (.gltf)' 
                                          : (lyr.format?.toUpperCase() || '3D Model Asset'))))));
                    const opacityVal = Math.round((lyr.opacity ?? 1.0) * 100);
                    const blendAmountVal = Math.round((lyr.blendAmount ?? 0.0) * 100);
                    const currentColor = lyr.surfaceColor || '#FFFFFF';
                    const blendMode = lyr.colorBlendMode || (blendAmountVal > 0 ? 'MIX' : 'HIGHLIGHT');

                    return (
                      <div 
                        key={lyr.id} 
                        onClick={() => onActiveLayerIdChange?.(lyr.id)}
                        className={`p-3 bg-slate-900/60 border rounded-xl space-y-2.5 transition-all ${
                          isModelActive 
                            ? 'border-blue-500/60 ring-1 ring-blue-500/40 bg-blue-950/20' 
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="p-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 shrink-0">
                              {lyr.type === 'clipping_polygon' ? (
                                <Scissors className="w-4 h-4 text-red-400" />
                              ) : (
                                <Package className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 text-left">
                              <span className="text-xs font-semibold text-slate-200 truncate" title={lyr.name}>{lyr.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {formatLabel}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFlyToImportedLayer(lyr);
                              }}
                              title="Fly to layer"
                              className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Locate className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerVisibility?.(lyr.id);
                              }}
                              className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                                lyr.visible !== false ? 'bg-blue-500 shadow-sm shadow-blue-500/30' : 'bg-slate-700'
                              }`}
                              title={lyr.visible !== false ? 'Hide Layer' : 'Show Layer'}
                            >
                              <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${lyr.visible !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteLayer?.(lyr.id);
                              }}
                              title="Remove layer"
                              className="p-1.5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* EXPOSED AND EDITABLE STYLING CONTROLS */}
                        {lyr.type === 'clipping_polygon' ? (
                          <div className="space-y-2 pt-2 border-t border-white/5 text-[10px]">
                            {/* Invert Mask Control */}
                            <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-rose-500/20">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Scissors className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <div className="flex flex-col text-left min-w-0">
                                  <label className="text-slate-200 font-mono font-bold text-[9px] uppercase tracking-wider">Clip Mask</label>
                                  <span className="text-[8px] text-slate-400 font-mono truncate">
                                    {lyr.inverse ? 'Outside (Keep Inside)' : 'Inside (Hole Cutout)'}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextInverse = !lyr.inverse;
                                  const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, inverse: nextInverse } : l);
                                  onImportedLayersChange?.(updated);
                                }}
                                className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                                  lyr.inverse
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}
                                title={lyr.inverse ? 'Switch to Clip Inside' : 'Switch to Clip Outside'}
                              >
                                {lyr.inverse ? 'Clip Outside' : 'Clip Inside'}
                              </button>
                            </div>

                            {/* Color & Fill Opacity */}
                            <div className="space-y-1.5 bg-slate-950/60 p-2 rounded-lg border border-white/5">
                              <div className="flex items-center justify-between">
                                <label className="text-slate-400 font-mono font-bold block text-[9px]">Boundary & Fill Color</label>
                                <input
                                  type="color"
                                  value={lyr.color || '#ef4444'}
                                  onChange={(e) => {
                                    const color = e.target.value;
                                    const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, color } : l);
                                    onImportedLayersChange?.(updated);
                                  }}
                                  className="w-5 h-5 rounded border border-white/10 bg-transparent cursor-pointer"
                                  title="Change clipping polygon color"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[8px]">
                                  <span className="text-slate-400 font-mono">Fill Opacity</span>
                                  <span className="text-slate-300 font-mono font-bold">{Math.round((lyr.opacity ?? 0.15) * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={Math.round((lyr.opacity ?? 0.15) * 100)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) / 100;
                                    const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, opacity: val } : l);
                                    onImportedLayersChange?.(updated);
                                  }}
                                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                        <div className="space-y-2 pt-2 border-t border-white/5 text-[10px]">
                          {/* Opacity Slider matching DXF */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-slate-400 font-mono font-bold block">Opacity</label>
                              <span className="text-slate-300 font-mono font-bold">{opacityVal}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={opacityVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) / 100;
                                const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, opacity: val } : l);
                                onImportedLayersChange?.(updated);
                              }}
                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>

                          {/* Color Tinting & Shader Blending Controls */}
                          <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-blue-400" />
                                <div className="flex flex-col text-left">
                                  <label className="text-slate-200 font-mono font-bold text-[9px] uppercase tracking-wider">Color Tint Overlay</label>
                                  <span className="text-[8px] text-slate-500 font-mono">
                                    {lyr.enableTintOverlay ? `${blendAmountVal}% Tint Active` : 'Off (Pure Native PBR Textures)'}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                {lyr.enableTintOverlay && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updated = importedLayers.map(l => l.id === lyr.id ? { 
                                        ...l, 
                                        enableTintOverlay: false,
                                        surfaceColor: undefined, 
                                        colorBlendMode: undefined, 
                                        blendAmount: 0.0 
                                      } : l);
                                      onImportedLayersChange?.(updated);
                                    }}
                                    className="text-[8px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer mr-1"
                                    title="Reset to natural textures (0% tint)"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" /> Reset
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextState = !lyr.enableTintOverlay;
                                    const updated = importedLayers.map(l => l.id === lyr.id ? { 
                                      ...l, 
                                      enableTintOverlay: nextState,
                                      surfaceColor: nextState ? (l.surfaceColor || '#4A90E2') : undefined,
                                      colorBlendMode: nextState ? (l.colorBlendMode || 'MIX') : undefined,
                                      blendAmount: nextState ? ((l.blendAmount !== undefined && l.blendAmount > 0) ? l.blendAmount : 0.5) : 0.0
                                    } : l);
                                    onImportedLayersChange?.(updated);
                                  }}
                                  className={`w-7 h-4 rounded-full p-0.5 transition-all duration-200 relative cursor-pointer flex items-center shrink-0 ${
                                    lyr.enableTintOverlay ? 'bg-blue-600 shadow-sm shadow-blue-500/40' : 'bg-slate-700'
                                  }`}
                                  title={lyr.enableTintOverlay ? 'Disable Color Tint Overlay' : 'Enable Color Tint Overlay'}
                                >
                                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${
                                    lyr.enableTintOverlay ? 'translate-x-3' : 'translate-x-0'
                                  }`} />
                                </button>
                              </div>
                            </div>

                            {/* Percentage Tint Slider */}
                            <div className="space-y-1 pt-1 border-t border-white/5">
                              <div className="flex items-center justify-between text-[8px]">
                                <label className="text-slate-400 font-mono flex items-center gap-1">
                                  <span>Tint Percentage</span>
                                  {blendAmountVal === 0 && (
                                    <span className="text-[7px] text-emerald-400 font-semibold">(Pure Original)</span>
                                  )}
                                </label>
                                <span className={`font-mono font-bold ${blendAmountVal > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                  {blendAmountVal}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={blendAmountVal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) / 100;
                                  const updated = importedLayers.map(l => l.id === lyr.id ? { 
                                    ...l, 
                                    blendAmount: val,
                                    enableTintOverlay: val > 0,
                                    colorBlendMode: l.colorBlendMode || 'MIX',
                                    surfaceColor: l.surfaceColor || '#4A90E2'
                                  } : l);
                                  onImportedLayersChange?.(updated);
                                }}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>

                            {lyr.enableTintOverlay && blendAmountVal > 0 ? (
                              <div className="space-y-2 pt-1 border-t border-white/5 animate-fadeIn">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => {
                                      const color = e.target.value;
                                      const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, surfaceColor: color } : l);
                                      onImportedLayersChange?.(updated);
                                    }}
                                    className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                                    title="Custom Color Tint"
                                  />
                                  <div className="flex items-center gap-1 flex-1 overflow-x-auto py-0.5">
                                    {[
                                      { hex: '#4A90E2', name: 'Architectural Blue' },
                                      { hex: '#FFFFFF', name: 'Natural White' },
                                      { hex: '#E2E8F0', name: 'Cool Slate' },
                                      { hex: '#FDE68A', name: 'Warm Stone' },
                                      { hex: '#86EFAC', name: 'Emerald' },
                                      { hex: '#FCA5A5', name: 'Rose' },
                                      { hex: '#C084FC', name: 'Purple' }
                                    ].map(swatch => (
                                      <button
                                        key={swatch.hex}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, surfaceColor: swatch.hex } : l);
                                          onImportedLayersChange?.(updated);
                                        }}
                                        className={`w-4 h-4 rounded-full border transition-transform shrink-0 ${
                                          currentColor.toUpperCase() === swatch.hex.toUpperCase() 
                                            ? 'border-white scale-110 ring-1 ring-blue-400' 
                                            : 'border-white/20 hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: swatch.hex }}
                                        title={swatch.name}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Blend Mode Buttons */}
                                <div className="grid grid-cols-3 gap-1 pt-0.5">
                                  {[
                                    { id: 'MIX', label: 'Mix Blend', desc: 'Fade Between Texture & Color' },
                                    { id: 'HIGHLIGHT', label: 'Highlight', desc: 'Natural Texture Multiply' },
                                    { id: 'REPLACE', label: 'Replace', desc: 'Solid Color Override' }
                                  ].map(mode => (
                                    <button
                                      key={mode.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = importedLayers.map(l => l.id === lyr.id ? { 
                                          ...l, 
                                          colorBlendMode: mode.id
                                        } : l);
                                        onImportedLayersChange?.(updated);
                                      }}
                                      className={`py-1 px-1 rounded text-[8px] font-mono font-semibold text-center transition-all cursor-pointer ${
                                        blendMode === mode.id
                                          ? 'bg-blue-600/40 border border-blue-400 text-blue-200'
                                          : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-slate-200'
                                      }`}
                                      title={mode.desc}
                                    >
                                      {mode.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {/* Silhouette Outlines Toggle */}
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[9px] text-slate-400 font-mono">Vector Outline</span>
                            <div className="flex items-center gap-1.5">
                              {lyr.vectorOutlines && (
                                <input
                                  type="color"
                                  value={lyr.silhouetteColor || '#FFFFFF'}
                                  onChange={(e) => {
                                    const updated = importedLayers.map(l => l.id === lyr.id ? { ...l, silhouetteColor: e.target.value } : l);
                                    onImportedLayersChange?.(updated);
                                  }}
                                  className="w-4 h-4 rounded border border-white/10 bg-transparent cursor-pointer"
                                  title="Outline Color"
                                />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = importedLayers.map(l => l.id === lyr.id ? { 
                                    ...l, 
                                    vectorOutlines: !l.vectorOutlines,
                                    silhouetteSize: !l.vectorOutlines ? (l.silhouetteSize || 2.0) : 0.0
                                  } : l);
                                  onImportedLayersChange?.(updated);
                                }}
                                className={`w-6 h-3.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                                  lyr.vectorOutlines ? 'bg-blue-600' : 'bg-slate-700'
                                }`}
                              >
                                <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${
                                  lyr.vectorOutlines ? 'translate-x-2.5' : 'translate-x-0'
                                }`} />
                              </button>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}

                  {gisLayersCount === 0 && (
                    <div className="p-4 text-center rounded-xl bg-slate-900/30 border border-white/5 space-y-2">
                      <Sparkles className="w-6 h-6 text-slate-500 mx-auto opacity-50" />
                      <p className="text-xs text-slate-400 font-medium">No active GIS or Shapefile vector layers.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('import')}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors cursor-pointer"
                      >
                        Open Import Tab
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ACCORDION 3: 3D TOOLS & MASSING LAYERS */}
            <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleLayerAccordion('tools')}
                className="w-full p-3.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Ruler className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      3D Tools & Massing Layers
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {toolsLayersCount}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">Parametric Massings, Excavations, & Utilities</p>
                  </div>
                </div>
                {openLayerAccordions.tools ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {openLayerAccordions.tools && (
                <div className="p-3 border-t border-white/5 space-y-2 bg-slate-950/40">
                  {massingBaseArea && massingBaseArea > 0 ? (
                    <div className="p-2.5 bg-slate-900/60 border border-white/10 rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1 text-left">
                          <span className="text-xs font-semibold text-slate-200 truncate">🏢 Parametric Massing Model</span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            Base Area: {Math.round(massingBaseArea).toLocaleString()} m² • {massingFloors || 10} Floors
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onFlyToMassing && (
                          <button
                            type="button"
                            onClick={onFlyToMassing}
                            title="Fly to massing"
                            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Locate className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onMassingBaseAreaChange?.(null)}
                          title="Remove massing"
                          className="p-1.5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {excavationArea && excavationArea > 0 ? (
                    <div className="p-2.5 bg-slate-900/60 border border-white/10 rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Mountain className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1 text-left">
                          <span className="text-xs font-semibold text-slate-200 truncate">⛏️ Subsurface Terrain Excavation</span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            Cut Area: {Math.round(excavationArea).toLocaleString()} m²
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onClearExcavation}
                        title="Remove excavation"
                        className="p-1.5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}

                  <div className="p-2.5 bg-slate-900/60 border border-white/10 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1 text-left">
                        <span className="text-xs font-semibold text-slate-200 truncate">🛠️ Underground Utilities Infrastructure</span>
                        <span className="text-[9px] text-slate-400 font-mono">Subsurface pipe network & attributes</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  </div>

                  {toolsLayersCount === 0 && (
                    <div className="p-4 text-center rounded-xl bg-slate-900/30 border border-white/5 space-y-2">
                      <Ruler className="w-6 h-6 text-slate-500 mx-auto opacity-50" />
                      <p className="text-xs text-slate-400 font-medium">No active 3D Massing or Excavation layers created.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('tools')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors cursor-pointer"
                      >
                        Open Tools Tab
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ACCORDION 4: BASE MAP & GLOBE ENVIRONMENT LAYERS */}
            <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleLayerAccordion('base')}
                className="w-full p-3.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      Base Globe & Environment Layers
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {baseMapLayersCount} / {layers ? layers.length : 0} Active
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">Photorealistic 3D Tiles, Terrain, Buildings, & Satellite</p>
                  </div>
                </div>
                {openLayerAccordions.base ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {openLayerAccordions.base && (
                <div className="p-3 border-t border-white/5 space-y-2 bg-slate-950/40">
                  {layers && layers.map((layer) => {
                    const isVisible = layer.enabled ?? (layer as any).visible ?? true;
                    return (
                      <div
                        key={layer.id}
                        onClick={() => onToggleLayer(layer.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isVisible
                            ? 'bg-indigo-950/40 border-indigo-500/40 text-white shadow-md shadow-indigo-500/5'
                            : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isVisible ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                            {layer.id.includes('building') ? (
                              <Building2 className="w-4 h-4" />
                            ) : layer.id.includes('terrain') ? (
                              <Mountain className="w-4 h-4" />
                            ) : (
                              <Globe className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-xs font-semibold truncate text-slate-100">{layer.name}</div>
                            {layer.description && (
                              <div className="text-[10px] text-slate-400 truncate">{layer.description}</div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`p-1.5 rounded-lg border-0 bg-transparent transition-colors shrink-0 ${
                            isVisible ? 'text-indigo-400' : 'text-slate-500'
                          }`}
                        >
                          {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6">
            {/* LEFT SIDEBAR PANEL: DATA IMPORT & STREAM PANEL */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono mb-1">
                📥 Data Import & Streaming Panel
              </div>

              {/* Accordion Category 1: 📥 Local File Import */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveSection(activeSection === 'file-import' ? null : 'file-import')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">📥</span> Local File Import
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeSection === 'file-import' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeSection === 'file-import' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeSection === 'file-import' && (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      Import a zipped ESRI Shapefile (.shp, .dbf, .shx) to dynamically clip 3D building tilesets directly onto the 3D terrain.
                    </div>

            {/* STEP 1: DUAL-SLOT GIS INGESTION ARCHITECTURE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
                  Step 1: Ingest Geospatial Data
                </span>
                {polygonData && (
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    CONVERTED
                  </span>
                )}
              </div>

              {/* FAIL-SAFE ERROR OVERLAY */}
              {cadErrorOverlay && (
                <div className="bg-amber-950/90 border border-amber-500/40 rounded-xl p-4 space-y-3 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-fadeIn text-left">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-200">Local Coordinate Grid Detected!</h4>
                      <p className="text-[10px] text-amber-300/85 leading-relaxed mt-1">
                        You dropped a file containing localized flat projection coords (e.g. UTM, State Plane, or CAD Survey meters/feet) into the Standard Ingest slot.
                      </p>
                      <p className="text-[10px] text-sky-200 font-medium leading-relaxed mt-1.5">
                        Please re-export your CAD / Shapefile to standard WGS84 coordinate systems (such as EPSG:4326) or use the <strong className="text-purple-300 font-extrabold">Slot B: Direct AutoCAD DXF Ingest</strong> slot below to automatically map it onto the 3D globe.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCadErrorOverlay(false)}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded text-[9px] font-bold transition-colors cursor-pointer"
                    >
                      Dismiss Warning
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESS TOAST FLOATING PANEL */}
              {successToast && (
                <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-slate-950/95 border border-sky-500/50 rounded-xl p-3.5 shadow-[0_4px_24px_rgba(56,189,248,0.25)] text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-sky-100">Reprojection Completed</p>
                      <p className="text-[10px] text-sky-200/80 leading-relaxed mt-1">{successToast}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSuccessToast(null)}
                      className="text-sky-400 hover:text-white transition-colors shrink-0 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* SLOT A: STANDARD GIS INGEST */}
              <div className="border border-white/10 bg-slate-900/50 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveLocalSubSection(activeLocalSubSection === 'slot-a' ? null : 'slot-a')}
                  className="w-full p-2.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer font-mono"
                  title="Slot A: Standard GIS Dataset Ingest (.zip)"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-300 truncate">
                      Shapefiles (zip)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      .zip
                    </span>
                    {activeLocalSubSection === 'slot-a' ? <Minus className="w-3.5 h-3.5 text-slate-400" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </button>
                {activeLocalSubSection === 'slot-a' && (
                  <div className="p-3 border-t border-white/5 space-y-2 text-left animate-fadeIn">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingZipA(true); }}
                      onDragLeave={() => setIsDraggingZipA(false)}
                      onDrop={handleZipDropA}
                      onClick={() => zipInputRefA.current?.click()}
                      className={`group border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/60 ${
                        isDraggingZipA 
                          ? 'border-slate-400 bg-slate-800/40' 
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <input
                        type="file"
                        ref={zipInputRefA}
                        accept=".zip"
                        onChange={(e) => e.target.files?.[0] && handleZipFile(e.target.files[0])}
                        className="hidden"
                      />

                      {isParsingZipA ? (
                        <div className="flex flex-col items-center gap-1.5 py-1">
                          <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                          <span className="text-[11px] text-slate-300 font-semibold font-mono">Parsing GIS Dataset...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-8 h-8 bg-slate-950/60 border border-white/5 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-slate-200 transition-all">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-300 group-hover:text-slate-200">WGS84 Ingest (EPSG:4326)</div>
                            <div className="text-[9px] text-slate-500 font-mono truncate">Drag & drop shapefile .zip</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {zipErrorA && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] leading-relaxed flex items-start gap-1.5 mt-1 text-left">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{zipErrorA}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SLOT B: DIRECT AUTOCAD DXF INGEST */}
              <div className="border border-purple-500/20 bg-purple-950/10 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveLocalSubSection(activeLocalSubSection === 'slot-b' ? null : 'slot-b')}
                  className="w-full p-2.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer font-mono"
                  title="Slot B: Direct AutoCAD DXF Ingest (.dxf)"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-[11px] font-bold text-purple-300 truncate">
                      AutoCAD DXF
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      .dxf
                    </span>
                    {activeLocalSubSection === 'slot-b' ? <Minus className="w-3.5 h-3.5 text-purple-400" /> : <Plus className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                </button>
                {activeLocalSubSection === 'slot-b' && (
                  <div className="p-3 border-t border-purple-500/15 space-y-3 text-left animate-fadeIn">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingDxf(true); }}
                      onDragLeave={() => setIsDraggingDxf(false)}
                      onDrop={handleDxfDrop}
                      onClick={() => dxfInputRef.current?.click()}
                      className={`group border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all relative overflow-hidden bg-purple-950/5 hover:bg-purple-950/15 ${
                        isDraggingDxf 
                          ? 'border-purple-400 bg-purple-950/30 shadow-[0_0_12px_rgba(192,38,211,0.2)]' 
                          : 'border-purple-500/25 hover:border-purple-400/50 shadow-[0_0_8px_rgba(192,38,211,0.03)]'
                      }`}
                    >
                  <input
                    type="file"
                    ref={dxfInputRef}
                    accept=".dxf"
                    onChange={(e) => e.target.files?.[0] && handleDxfFile(e.target.files[0])}
                    className="hidden"
                  />

                  {isParsingDxf ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                      <span className="text-[11px] text-purple-300 font-semibold font-mono">Projecting CAD DXF...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-8 h-8 bg-purple-950/55 border border-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 group-hover:text-purple-300 transition-all">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-purple-300 group-hover:text-purple-200">
                          Direct DXF Boundary Ingest
                        </div>
                        <div className="text-[9px] text-purple-500/80 font-mono">
                          Accepts .dxf exports containing closed site boundaries/polylines
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CAD Source Coordinate System selector */}
                <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-white/5 relative">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>CAD Source Coordinate System</span>
                    <span className="text-[8px] text-purple-400 uppercase font-mono">WGS84 Target</span>
                  </label>
                  
                  {/* Custom Searchable Dropdown */}
                  <div className="relative">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Search coordinate system..."
                        value={isCrsDropdownOpen ? crsSearchQuery : (CAD_CRS_PRESETS.find((p) => p.code === selectedCrs)?.name || 'WGS 84 / UTM Zone 40N')}
                        onFocus={() => {
                          setIsCrsDropdownOpen(true);
                          setCrsSearchQuery('');
                        }}
                        onChange={(e) => setCrsSearchQuery(e.target.value)}
                        className="bg-slate-950 border border-white/10 text-[11px] text-slate-300 rounded-lg p-2 pr-8 w-full focus:outline-none focus:border-purple-500 font-mono text-left truncate cursor-text"
                      />
                      <div className="absolute right-2 text-slate-400 flex items-center gap-1 pointer-events-none">
                        <Search className="w-3 h-3 text-slate-500" />
                        <ChevronDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </div>

                    {isCrsDropdownOpen && (
                      <>
                        {/* Backdrop overlay to close on click outside */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsCrsDropdownOpen(false)} 
                        />
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-white/10 rounded-lg shadow-2xl p-1 font-mono text-[11px] text-slate-300 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                          {CAD_CRS_PRESETS.filter((p) => 
                            p.name.toLowerCase().includes(crsSearchQuery.toLowerCase()) ||
                            p.code.toLowerCase().includes(crsSearchQuery.toLowerCase())
                          ).length > 0 ? (
                            CAD_CRS_PRESETS.filter((p) => 
                              p.name.toLowerCase().includes(crsSearchQuery.toLowerCase()) ||
                              p.code.toLowerCase().includes(crsSearchQuery.toLowerCase())
                            ).map((p) => {
                              const isSelected = p.code === selectedCrs;
                              return (
                                <button
                                  key={p.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCrs(p.code);
                                    setIsCrsDropdownOpen(false);
                                    setCrsSearchQuery('');
                                    if (uploadedDxfText && uploadedDxfFile) {
                                      try {
                                        const parsedData = parseDxfFile(
                                          uploadedDxfText,
                                          p.code,
                                          boundaryCenter,
                                          uploadedDxfFile.name,
                                          workspaceOrigin
                                        );
                                        if (onAddGisLayer) {
                                          onAddGisLayer(parsedData.polygonData, uploadedDxfFile.name, parsedData.shapefileData);
                                        } else {
                                          onPolygonDataChange?.(parsedData.polygonData, uploadedDxfFile.name, parsedData.shapefileData);
                                        }
                                        const viewer = (window as any).cesiumViewer;
                                        if (viewer) {
                                          viewer.scene.requestRender();
                                        }
                                      } catch (err: any) {
                                        setDxfError(err.message || 'Error re-projecting DXF with new coordinate system.');
                                      }
                                    }
                                  }}
                                  className={`w-full text-left p-2 hover:bg-purple-500/10 hover:text-purple-300 transition-all rounded flex items-center justify-between gap-2 ${
                                    isSelected ? 'bg-purple-500/15 text-purple-400 font-semibold' : ''
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold">{p.name}</div>
                                    <div className="text-[9px] text-slate-500 truncate mt-0.5">{p.code}</div>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-3 text-center text-slate-500 text-[10px]">
                              No coordinate systems found
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* INHERIT PROJECTION ACTION BUTTON */}
                <div className="space-y-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={handleInheritViewProjection}
                    disabled={!uploadedDxfFile}
                    className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                      syncStatus 
                        ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                        : !uploadedDxfFile 
                          ? 'bg-slate-900/40 border-white/5 text-slate-500 cursor-not-allowed border-dashed'
                          : 'bg-purple-950/20 hover:bg-purple-950/40 border-purple-500/20 text-purple-300 hover:text-purple-200 hover:border-purple-500/45'
                    }`}
                  >
                    <Compass className={`w-4 h-4 ${syncStatus ? 'animate-pulse' : ''}`} />
                    <span>
                      {syncStatus ? syncStatus : '📍 Inherit Current View Projection'}
                    </span>
                  </button>
                  {syncStatus && (
                    <div className="text-[9px] text-emerald-400 font-mono text-center flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Coordinates bound to local UTM projection grid
                    </div>
                  )}
                </div>

                {dxfError && (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] leading-relaxed flex items-start gap-1.5 mt-1 text-left">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{dxfError}</span>
                  </div>
                )}

                {/* TEXTURE FOR DXF BOUNDARY INGEST */}
                <div className="space-y-2 pt-3 border-t border-purple-500/20 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold font-mono">
                      TEXTURE FOR DXF BOUNDARY
                    </span>
                    {textureUrl && (
                      <span className="text-[10px] font-mono text-purple-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                        DRAPED &bull; TRUE NORTH
                      </span>
                    )}
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingTexture(true); }}
                    onDragLeave={() => setIsDraggingTexture(false)}
                    onDrop={handleTextureDrop}
                    onClick={() => textureInputRef.current?.click()}
                    className={`group border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
                      isDraggingTexture 
                        ? 'border-purple-400 bg-purple-950/30 shadow-[0_0_12px_rgba(192,38,211,0.2)]' 
                        : textureUrl 
                          ? 'border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/30' 
                          : 'border-purple-500/25 hover:border-purple-400/50 bg-purple-950/5 hover:bg-purple-950/15'
                    }`}
                  >
                    <input
                      type="file"
                      ref={textureInputRef}
                      accept="image/jpeg, image/jpg"
                      onChange={(e) => e.target.files?.[0] && handleTextureFile(e.target.files[0])}
                      className="hidden"
                    />

                    {textureUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative w-16 h-12 border border-white/10 rounded overflow-hidden bg-slate-950 flex items-center justify-center">
                          <img src={textureUrl} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-[200px]" title={textureName || ''}>
                          {textureName}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          Oriented to True North &bull; Stretched across boundary rectangle
                        </div>
                        <button
                          type="button"
                          onClick={handleClearTexture}
                          className="mt-2 flex items-center gap-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 border border-rose-500/25 rounded-md text-rose-400 font-semibold cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> CLEAR TEXTURE
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-1">
                        <div className="mx-auto w-8 h-8 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-center text-purple-400 group-hover:scale-105 transition-all">
                          <Image className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-purple-200">Upload Texture</div>
                          <div className="text-[9px] text-purple-400/80 mt-1 max-w-[220px] mx-auto leading-normal font-mono">
                            Drag & drop a JPG plan drawing to stretch across the site with True North offset. (PNG disabled)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {textureError && (
                    <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] leading-relaxed flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{textureError}</span>
                    </div>
                  )}
                </div>

                {/* 3D TILES CLIPPING ZONE */}
                {polygonData && (
                  <div className="space-y-3 pt-3 border-t border-purple-500/20 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold font-mono">
                        3D Tiles Clipping
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                        clippingMode !== 'none'
                          ? 'bg-purple-500/15 border-purple-500/35 text-purple-300'
                          : 'bg-slate-500/15 border-slate-500/35 text-slate-400'
                      }`}>
                        {clippingMode !== 'none' ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Control how 3D building tilesets clip against your imported boundary.
                    </p>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-white/5">
                      <div className="flex flex-col pr-2">
                        <span className="text-xs font-semibold text-slate-200">Enable 3D Clipping</span>
                        <span className="text-[9px] text-slate-500">Toggle building clipping on/off</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (clippingMode === 'none') {
                            onClippingModeChange('inside');
                          } else {
                            onClippingModeChange('none');
                          }
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          clippingMode !== 'none' ? 'bg-purple-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            clippingMode !== 'none' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {clippingMode !== 'none' && (
                      <div className="space-y-3 mt-2 pt-2 border-t border-white/5">
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block">Clipping Mode:</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => onClippingModeChange('inside')}
                              className={`py-2 px-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex flex-col items-center gap-1 ${
                                clippingMode === 'inside'
                                  ? 'bg-purple-600/25 border-purple-500/80 text-purple-300 shadow-md shadow-purple-500/10'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                              }`}
                            >
                              <span>Clip Inside</span>
                              <span className="text-[8px] font-normal text-slate-500">Hide inner buildings</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onClippingModeChange('outside')}
                              className={`py-2 px-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex flex-col items-center gap-1 ${
                                clippingMode === 'outside'
                                  ? 'bg-purple-600/25 border-purple-500/80 text-purple-300 shadow-md shadow-purple-500/10'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                              }`}
                            >
                              <span>Clip Outside</span>
                              <span className="text-[8px] font-normal text-slate-500">Isolate site only</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-white/5">
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-slate-200">Affect 3D Tiles</span>
                            <span className="text-[9px] text-slate-500">
                              {clip3dTiles ? 'Clips 3D Tiles & Terrain' : 'Terrain ONLY (3D Tiles unaffected)'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onClip3dTilesChange?.(!clip3dTiles)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              clip3dTiles ? 'bg-purple-600' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                clip3dTiles ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  </div>
                )}
              </div>

              {/* ACTIVE GIS LAYERS LIST STACK */}
              {gisLayers && gisLayers.length > 0 ? (
                <div className="border border-slate-700/50 bg-slate-900/40 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveLocalSubSection(activeLocalSubSection === 'active-layers' ? null : 'active-layers')}
                    className="w-full p-2.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-200 truncate">
                        Active GIS Layers
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-300 font-mono font-bold">
                        {gisLayers.length} Layers
                      </span>
                      {activeLocalSubSection === 'active-layers' ? <Minus className="w-3.5 h-3.5 text-slate-400" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </button>
                  {activeLocalSubSection === 'active-layers' && (
                    <div className="p-3 border-t border-white/5 space-y-2.5 text-left animate-fadeIn">
                      <div className="space-y-2.5">
                        {gisLayers.map((layer) => (
                          <div 
                            key={layer.id} 
                            className="p-2.5 bg-slate-950/40 border border-white/5 rounded-lg space-y-2 text-left"
                          >
                            {/* Row 1: Label, Visibility toggle, Locate, and Trash */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                <span 
                                  className="text-xs font-semibold text-slate-200 truncate"
                                  title={layer.name}
                                >
                                  {layer.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Locate target button */}
                                <button
                                  type="button"
                                  onClick={() => onLocateGisLayer?.(layer.shapefileData.bounds)}
                                  title="Fly to dataset"
                                  className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                                >
                                  <Locate className="w-3.5 h-3.5" />
                                </button>

                                {/* Visibility Toggle switch */}
                                <button
                                  type="button"
                                  onClick={() => onToggleGisLayerVisibility?.(layer.id)}
                                  className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                                    layer.visible 
                                      ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                      : 'bg-slate-700'
                                  }`}
                                >
                                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${layer.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>

                                {/* Delete Trash icon */}
                                <button
                                  type="button"
                                  onClick={() => onRemoveGisLayer?.(layer.id)}
                                  title="Delete Layer"
                                  className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Opacity slider */}
                            <div className="space-y-1 pt-1 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                <label className="text-[9px] text-slate-500 font-mono font-bold block">Opacity</label>
                                <span className="text-[9px] text-slate-400 font-mono font-bold">
                                  {Math.round(layer.opacity * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={Math.round(layer.opacity * 100)}
                                onChange={(e) => onGisLayerOpacityChange?.(layer.id, parseFloat(e.target.value) / 100)}
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>

                          {/* Visualization Mode & Attribute Mapping UI */}
                          <div className="pt-2 border-t border-white/5 space-y-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Visualization Mode</label>
                              <select
                                value={layer.visualizationMode || 'solid'}
                                onChange={(e) => onGisLayerVisualizationModeChange?.(layer.id, e.target.value as any)}
                                className="w-full bg-slate-950 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                              >
                                <option value="solid">Default Solid Color</option>
                                <option value="choropleth">Choropleth Map Layout</option>
                                <option value="none">None (Transparent / Manual Layer Style)</option>
                              </select>
                            </div>

                            {/* NONE (MANUAL LAYER STYLE) MODE BANNER */}
                            {layer.visualizationMode === 'none' && (
                              <div className="pt-1.5 space-y-2">
                                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-slate-300 text-[11px] space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-sky-400 font-semibold font-mono text-[10px] uppercase">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Manual Layer Style Mode</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Shape mesh fill and 3D extrusion are hidden. Open the <strong>Layer Style Toolbar</strong> (Palette icon) to customize fill visibility, opacity, and ground boundary stroke width.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* UNIVERSAL VECTOR STYLE MANAGER CONTROLS */}
                            {(layer.visualizationMode === 'solid' || !layer.visualizationMode) && (
                              <div className="pt-2 border-t border-white/5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => toggleGisCategory(`${layer.id}-style`, true)}
                                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-400 font-mono font-semibold transition-colors cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3 text-blue-400" />
                                    <span>{isGisCategoryExpanded(`${layer.id}-style`, true) ? 'Hide Universal Style' : 'Show Universal Style'}</span>
                                  </button>
                                </div>

                                <AnimatePresence>
                                  {isGisCategoryExpanded(`${layer.id}-style`, true) && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="space-y-2.5 pt-1 overflow-hidden text-left"
                                    >
                                      {/* Color Input & Color Picker */}
                                      <div className="space-y-1">
                                        <label className="text-[9px] text-slate-500 font-mono font-bold block">Vector Fill / Outline Color</label>
                                        {(() => {
                                          const defaultColor = (layer.shapefileData?.isCad || layer.name?.toLowerCase().endsWith('.dxf')) ? '#000000' : '#3b82f6';
                                          return (
                                            <div className="flex items-center gap-2 bg-slate-950 border border-white/10 rounded-md px-2 py-1">
                                              <input
                                                type="color"
                                                value={layer.customColor || defaultColor}
                                                onChange={(e) => onGisLayerCustomColorChange?.(layer.id, e.target.value)}
                                                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                                              />
                                              <input
                                                type="text"
                                                value={layer.customColor || defaultColor}
                                                onChange={(e) => onGisLayerCustomColorChange?.(layer.id, e.target.value)}
                                                placeholder={defaultColor}
                                                className="w-full bg-transparent border-0 text-[10px] font-mono text-slate-200 focus:outline-none p-0"
                                              />
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      {/* Alpha Transparency Slider */}
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-[9px] text-slate-500 font-mono font-bold block">Alpha Transparency</label>
                                          <span className="text-[9px] text-slate-400 font-mono font-bold">
                                            {layer.customAlpha !== undefined ? Math.round(layer.customAlpha * 100) : 100}%
                                          </span>
                                        </div>
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          value={layer.customAlpha !== undefined ? Math.round(layer.customAlpha * 100) : 100}
                                          onChange={(e) => onGisLayerCustomAlphaChange?.(layer.id, parseFloat(e.target.value) / 100)}
                                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                      </div>

                                      {/* Line-based geometry specifics */}
                                      {(layer.geometryType === 'polyline' || layer.shapefileData?.features?.[0]?.isLine) && (
                                        <div className="space-y-2.5 pt-2 border-t border-white/5 bg-sky-950/25 p-2 rounded-lg border border-sky-500/15">
                                          <div className="text-[9px] text-sky-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                                            <Ruler className="w-3 h-3" />
                                            <span>Polyline Customization</span>
                                          </div>

                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <label className="text-[9px] text-slate-500 font-mono font-bold block">Line Thickness</label>
                                              <span className="text-[9px] text-slate-400 font-mono font-bold">{layer.lineWidth || 3}px</span>
                                            </div>
                                            <input
                                              type="range"
                                              min="1"
                                              max="20"
                                              value={layer.lineWidth || 3}
                                              onChange={(e) => onGisLayerLineWidthChange?.(layer.id, parseInt(e.target.value))}
                                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                            />
                                          </div>

                                          <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-mono font-bold block">Linetype Pattern</label>
                                            <select
                                              value={layer.lineType || 'Solid'}
                                              onChange={(e) => onGisLayerLineTypeChange?.(layer.id, e.target.value)}
                                              className="w-full bg-slate-950 border border-white/10 rounded-md px-2 py-1 text-[10px] text-slate-200 focus:border-sky-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                                            >
                                              <option value="Solid">Solid</option>
                                              <option value="Dashed">Dashed</option>
                                              <option value="Glowing Vector">Glowing Vector</option>
                                              <option value="3D Volumetric Pipe">3D Volumetric Pipe</option>
                                            </select>
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {layer.visualizationMode === 'choropleth' && (
                              <div className="pt-2 border-t border-white/5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => toggleGisCategory(`${layer.id}-choropleth`, true)}
                                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-400 font-mono font-semibold transition-colors cursor-pointer"
                                  >
                                    <Sliders className="w-3 h-3 text-blue-400" />
                                    <span>{isGisCategoryExpanded(`${layer.id}-choropleth`, true) ? 'Hide Choropleth Config' : 'Show Choropleth Config'}</span>
                                  </button>
                                </div>

                                <AnimatePresence>
                                  {isGisCategoryExpanded(`${layer.id}-choropleth`, true) && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="space-y-2.5 pt-1 overflow-hidden"
                                    >
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Analyze Attribute</label>
                                        <select
                                          value={layer.choroplethAttribute || ''}
                                          onChange={(e) => onGisLayerChoroplethAttributeChange?.(layer.id, e.target.value)}
                                          className="w-full bg-slate-950 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                                        >
                                          {(!layer.choroplethAttribute && layer.shapefileData?.fields?.length > 0) && (
                                            <option value="" disabled>Select numeric attribute...</option>
                                          )}
                                          {layer.shapefileData?.fields?.map((field: string) => (
                                            <option key={field} value={field}>{field}</option>
                                          )) || <option disabled>No numeric attributes found</option>}
                                        </select>
                                      </div>

                                      {/* Custom Color Pickers */}
                                      <div className="space-y-2 bg-slate-950/60 p-2 border border-white/5 rounded-lg">
                                        {/* Minimum Threshold Color Picker */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] text-slate-500 font-mono font-bold block">Minimum Threshold Color</label>
                                          <div className="flex items-center gap-1.5 bg-slate-950 border border-white/10 rounded-md px-1.5 py-1">
                                            <input
                                              type="color"
                                              value={layer.choroplethMinColor || '#FF5733'}
                                              onChange={(e) => onGisLayerChoroplethMinColorChange?.(layer.id, e.target.value)}
                                              className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                                            />
                                            <input
                                              type="text"
                                              value={layer.choroplethMinColor || '#FF5733'}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || val.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                                  onGisLayerChoroplethMinColorChange?.(layer.id, val);
                                                }
                                              }}
                                              placeholder="#FF5733"
                                              maxLength={7}
                                              className="w-full bg-transparent border-0 text-[10px] font-mono text-slate-200 focus:outline-none p-0"
                                            />
                                          </div>
                                        </div>

                                        {/* Maximum Threshold Color Picker */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] text-slate-500 font-mono font-bold block">Maximum Threshold Color</label>
                                          <div className="flex items-center gap-1.5 bg-slate-950 border border-white/10 rounded-md px-1.5 py-1">
                                            <input
                                              type="color"
                                              value={layer.choroplethMaxColor || '#00E676'}
                                              onChange={(e) => onGisLayerChoroplethMaxColorChange?.(layer.id, e.target.value)}
                                              className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                                            />
                                            <input
                                              type="text"
                                              value={layer.choroplethMaxColor || '#00E676'}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || val.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                                  onGisLayerChoroplethMaxColorChange?.(layer.id, val);
                                                }
                                              }}
                                              placeholder="#00E676"
                                              maxLength={7}
                                              className="w-full bg-transparent border-0 text-[10px] font-mono text-slate-200 focus:outline-none p-0"
                                            />
                                          </div>
                                        </div>

                                        {/* Show Map Legend Toggle */}
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                          <label className="text-[9px] text-slate-400 font-mono font-semibold uppercase tracking-wider">Show Map Legend</label>
                                          <button
                                            type="button"
                                            onClick={() => onGisLayerShowLegendChange?.(layer.id, !layer.showLegend)}
                                            className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                                              layer.showLegend 
                                                ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                                : 'bg-slate-700'
                                            }`}
                                          >
                                            <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${layer.showLegend ? 'translate-x-3' : 'translate-x-0'}`} />
                                          </button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>

                          {/* Row 3: Analysis section button */}
                          <div className="pt-1.5 border-t border-white/5 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setExpandedAnalysisLayerId(expandedAnalysisLayerId === layer.id ? null : layer.id)}
                              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-400 font-mono font-semibold transition-colors cursor-pointer"
                            >
                              <Activity className="w-3 h-3 text-blue-400" />
                              <span>{expandedAnalysisLayerId === layer.id ? 'Hide Analysis' : 'Show Analysis'}</span>
                            </button>
                            {layer.catchmentRadius && layer.catchmentRadius > 0 ? (
                              <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1 rounded">
                                Buffer: {layer.catchmentRadius}m
                              </span>
                            ) : null}
                          </div>

                          {/* Collapsible Analysis panel */}
                          <AnimatePresence>
                            {expandedAnalysisLayerId === layer.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="pt-2 border-t border-white/5 space-y-2 overflow-hidden"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 font-medium">Catchment Radius:</span>
                                    <span className="text-[10px] text-blue-400 font-mono font-bold">{layer.catchmentRadius || 0} meters</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="range"
                                      min="0"
                                      max="2000"
                                      step="50"
                                      value={layer.catchmentRadius || 0}
                                      onChange={(e) => onGisLayerCatchmentRadiusChange?.(layer.id, parseInt(e.target.value))}
                                      className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[10px] text-slate-400 font-medium block">Buffer Zone Styling:</span>
                                  <select
                                    value={layer.catchmentColor || 'Walking Radius - Translucent Blue'}
                                    onChange={(e) => onGisLayerCatchmentColorChange?.(layer.id, e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-md px-2 py-1 text-[10px] text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                                  >
                                    <option value="Walking Radius - Translucent Blue">Walking Radius (Blue)</option>
                                    <option value="Impact Zone - Translucent Red">Impact Zone (Red)</option>
                                    <option value="Buffer Zone - Translucent Green">Buffer Zone (Green)</option>
                                    <option value="Service Area - Translucent Purple">Service Area (Purple)</option>
                                    <option value="Hotspot - Translucent Amber">Hotspot (Amber)</option>
                                  </select>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 3D Vegetation Scattering Container */}
                          <div className="pt-2.5 border-t border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => toggleGisCategory(`${layer.id}-vegetation`, false)}
                                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 font-mono font-semibold transition-colors cursor-pointer"
                              >
                                <TreePine className="w-3 h-3 text-emerald-400" />
                                <span>{isGisCategoryExpanded(`${layer.id}-vegetation`, false) ? 'Hide Vegetation Scattering' : 'Show Vegetation Scattering'}</span>
                              </button>
                              <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                                {placedTrees?.filter(t => t.layerId === layer.id).length || 0} scattered
                              </span>
                            </div>

                            <AnimatePresence>
                              {isGisCategoryExpanded(`${layer.id}-vegetation`, false) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="space-y-2 overflow-hidden pt-1"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-slate-500 font-mono flex-shrink-0">Count:</span>
                                    <input
                                      type="range"
                                      min="10"
                                      max="300"
                                      step="10"
                                      value={layerDensity[layer.id] || 50}
                                      onChange={(e) => {
                                        setLayerDensity(prev => ({ ...prev, [layer.id]: parseInt(e.target.value) }));
                                      }}
                                      className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <span className="text-[9px] text-slate-400 font-mono w-7 text-right">
                                      {layerDensity[layer.id] || 50}
                                    </span>
                                  </div>

                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleScatterTrees(layer)}
                                      className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-bold cursor-pointer border-0 flex items-center justify-center gap-1 transition-all"
                                    >
                                      <Sparkles className="w-3 h-3 text-white" /> Scatter Trees
                                    </button>
                                    {(placedTrees?.filter(t => t.layerId === layer.id).length || 0) > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleClearLayerTrees(layer.id)}
                                        className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                                        title="Clear Layer Trees"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      ))}

                      {/* DEMOGRAPHIC OVERLAY CONTROLS */}
                      {((shapefileData && shapefileData.fields && shapefileData.fields.length > 0) || (gisLayers && gisLayers.some(l => l.shapefileData?.fields && l.shapefileData.fields.length > 0))) && (
                        <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3.5 space-y-3.5 text-left mt-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <button
                              type="button"
                              onClick={() => toggleGisCategory('global-demographic', true)}
                              className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-300 font-mono font-bold hover:text-blue-400 transition-colors cursor-pointer"
                            >
                              <Activity className="w-3.5 h-3.5 text-blue-400" />
                              <span>{isGisCategoryExpanded('global-demographic', true) ? 'Hide Demographic Overlay' : 'Show Demographic Overlay'}</span>
                            </button>
                          </div>

                          <AnimatePresence>
                            {isGisCategoryExpanded('global-demographic', true) && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3.5 overflow-hidden"
                              >
                                {/* Dropdown Menu "Select Metric to Visualize" */}
                                <div className="space-y-1.5 pt-1">
                                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">
                                    Select Metric to Visualize
                                  </label>
                                  <div className="relative">
                                    <select
                                      value={selectedMetric}
                                      onChange={(e) => onSelectedMetricChange?.(e.target.value)}
                                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                                    >
                                      {Array.from(new Set([
                                        ...(shapefileData?.fields || []),
                                        ...(gisLayers?.flatMap(l => l.shapefileData?.fields || []) || [])
                                      ])).map((field) => (
                                        <option key={field} value={field}>
                                          {field}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                                  </div>
                                </div>

                                {/* Extrusion Scale Multiplier */}
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">
                                      Extrusion Scale Multiplier
                                    </label>
                                    <span className="text-[10px] text-blue-400 font-mono font-bold">
                                      {shapefileHeightMultiplier.toFixed(2)} ({Math.round(shapefileHeightMultiplier * 100)}%)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="range"
                                      min="0.00"
                                      max="1.00"
                                      step="0.01"
                                      value={shapefileHeightMultiplier}
                                      onChange={(e) => onShapefileHeightMultiplierChange?.(parseFloat(e.target.value))}
                                      className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                  </div>
                                </div>

                                {/* Switch "Extrude Heights by Value" */}
                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-300 font-semibold">Extrude Heights by Value</span>
                                    <span className="text-[9px] text-slate-500 font-mono">Render features as 3D block heatmaps</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onExtrudeHeightsChange?.(!extrudeHeights)}
                                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                                      extrudeHeights 
                                        ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                        : 'bg-slate-700'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${extrudeHeights ? 'translate-x-4' : 'translate-x-0'}`} />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          ) : polygonData ? (
                // Legacy Fallback single site boundary Converted State
                <div className="flex flex-col items-center gap-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <FileArchive className="w-8 h-8" />
                  </div>
                  <div className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-[200px]" title={shapefileName || ''}>
                    {shapefileName}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {polygonData.positions.length} coordinates parsed
                  </div>
                  <button
                    type="button"
                    onClick={handleClearZip}
                    className="mt-2 flex items-center gap-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 border border-rose-500/25 rounded-md text-rose-400 font-semibold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> CLEAR SITE
                  </button>
                </div>
              ) : null}

            </div>



            {/* STEP 4: INTERACTIVE SWIPE COMPARISON */}
            {polygonData && (
              <div className="space-y-3 p-3.5 bg-slate-950/40 border border-white/5 rounded-xl text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
                    Step 4: Interactive Compare
                  </span>
                  <span className={`text-[9.5px] px-2 py-0.5 border rounded-md font-mono ${swipeEnabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-500/10 border-white/5 text-slate-400'}`}>
                    {swipeEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                
                <p className="text-[10.5px] text-slate-400 leading-relaxed">
                  Toggle an interactive horizonal swipe slider over the viewport to compare existing structures (left) against the proposed plan (right).
                </p>

                <button
                  type="button"
                  onClick={() => onSwipeEnabledChange?.(!swipeEnabled)}
                  className={`w-full py-2.5 px-4 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                    swipeEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/15'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ChevronsLeftRight className={`w-4 h-4 transition-transform ${swipeEnabled ? 'scale-110' : ''}`} />
                  {swipeEnabled ? 'DEACTIVATE COMPARISON' : 'ACTIVATE COMPARISON'}
                </button>
              </div>
            )}

            {/* QUICK ACTIONS PANEL */}
            {polygonData && (
              <div className="p-4 bg-gradient-to-br from-blue-950/20 to-indigo-950/20 border border-blue-500/10 rounded-xl space-y-3 text-left">
                <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold font-mono block">
                  Site Operations
                </span>
                <div className="text-[10px] text-slate-400 leading-normal font-mono">
                  W:{polygonData.bounds.west.toFixed(5)} S:{polygonData.bounds.south.toFixed(5)}<br />
                  E:{polygonData.bounds.east.toFixed(5)} N:{polygonData.bounds.north.toFixed(5)}
                </div>
                <button
                  type="button"
                  onClick={onFlyToPolygon}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all cursor-pointer border-0"
                >
                  <Compass className="w-4 h-4" /> FOCUS CAMERA ON SITE
                </button>
              </div>
            )}

            {/* 3D DATA INGESTION DECK */}
            <div className="space-y-4 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
                  Add Local Design Files & Overlays
                </span>
                {(modelUrl || localVectorUrl || streamedTilesetId) && (
                  <span className="text-[10px] font-mono text-blue-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    INGESTION ACTIVE
                  </span>
                )}
              </div>

              {/* TIER 1: Direct Local Assets Slot */}
              <div className="border border-blue-500/20 bg-blue-950/10 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveLocalSubSection(activeLocalSubSection === 'tier1' ? null : 'tier1')}
                  className="w-full p-2.5 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer font-mono"
                  title="3D Local Design Assets (.gltf / .glb)"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-300 truncate">
                      GLTF/GLB
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      .gltf / .glb
                    </span>
                    {activeLocalSubSection === 'tier1' ? <Minus className="w-3.5 h-3.5 text-blue-400" /> : <Plus className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                </button>
                {activeLocalSubSection === 'tier1' && (
                  <div className="p-3 border-t border-blue-500/15 space-y-3 text-left animate-fadeIn">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingTier1(true); }}
                      onDragLeave={() => setIsDraggingTier1(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingTier1(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleTier1File(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => tier1InputRef.current?.click()}
                      className={`relative group border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                        isDraggingTier1 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : (modelUrl || localVectorUrl)
                            ? 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10' 
                            : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 border border-white/15 text-white text-[11px] font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    import .gltf/.glb files only
                  </div>

                  <input
                    type="file"
                    ref={tier1InputRef}
                    accept=".glb,.gltf"
                    onChange={(e) => e.target.files?.[0] && handleTier1File(e.target.files[0])}
                    className="hidden"
                  />

                  {modelUrl || localVectorUrl ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-[200px]" title={modelName || localVectorName || ''}>
                        {modelName || localVectorName}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {modelUrl ? '3D GLTF Model Loaded (Use 3D Axis Gizmo to Translate)' : 'Vector Dataset Loaded'}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (modelUrl) {
                            handleClearModel(e);
                          } else {
                            onLocalVectorChange?.(null, null, null);
                          }
                        }}
                        className="mt-1.5 flex items-center gap-1 text-[9px] bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 border border-rose-500/25 rounded-md text-rose-400 font-semibold cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-2.5 h-2.5" /> CLEAR LOCAL ASSET
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 py-1">
                      <div className="mx-auto w-8 h-8 bg-slate-950/40 border border-white/5 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-400 group-hover:scale-105 transition-all">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Import Local Asset</div>
                        <div className="text-xs font-bold text-blue-400 mt-1 max-w-[220px] mx-auto uppercase tracking-wider">
                          Acceptable: .gltf, .glb
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {tier1Error && (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] leading-relaxed flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{tier1Error}</span>
                  </div>
                )}

                {tier1Advisory && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] leading-relaxed flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{tier1Advisory}</span>
                  </div>
                )}

                {/* TRANSFORM AND PLACEMENT TOOLS INSIDE GLTF/GLB ACCORDION */}
                <div className="space-y-3 pt-3 border-t border-blue-500/20 text-left">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] uppercase tracking-widest text-blue-300 font-mono font-bold">
                      Transform & Placement Tools
                    </span>
                  </div>
                  {(() => {
                    const activeLayer = importedLayers.find(l => l.id === activeLayerId) || null;
                    if (!activeLayer) {
                      if (importedLayers.length > 0) {
                        return (
                          <div className="p-3 border border-amber-500/20 bg-amber-500/5 rounded-xl text-center">
                            <span className="text-[10px] text-amber-300 font-mono">
                              Please select a 3D layer from the list to fine-tune its position and visual style.
                            </span>
                          </div>
                        );
                      }
                      if (!modelUrl) return null;
                    }

                    const curClamp = activeLayer ? activeLayer.clampToTerrain : modelClampToTerrain;
                    const curSketchUp = activeLayer ? activeLayer.applySketchUpProfile : modelApplySketchUpProfile;

                    return (
                      <div className="space-y-4 pt-1 animate-fadeIn">
                        {/* COORDINATE ADJUSTMENTS */}
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-400" />
                            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-mono font-bold">
                              Model Coordinates
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                                Latitude
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={activeLayer ? activeLayer.latitude : modelLatitude}
                                onChange={(e) => onModelLatitudeChange(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                                Longitude
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={activeLayer ? activeLayer.longitude : modelLongitude}
                                onChange={(e) => onModelLongitudeChange(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                                Height (M)
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={activeLayer ? activeLayer.height : modelHeight}
                                onChange={(e) => onModelHeightChange(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* PICK LOCATION FROM MAP */}
                        <button
                          type="button"
                          onClick={() => onIsPickingLocationChange?.(!isPickingLocation)}
                          className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                            isPickingLocation
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                              : 'bg-slate-950/80 hover:bg-slate-900 border-white/10 hover:border-white/20 text-slate-200'
                          }`}
                        >
                          <Crosshair className={`w-3.5 h-3.5 ${isPickingLocation ? 'text-amber-400 rotate-90 animate-spin-slow' : 'text-slate-400'}`} />
                          <span>{isPickingLocation ? 'Click on Map to Place...' : 'Pick Location from Map'}</span>
                        </button>

                        {/* TOGGLES */}
                        <div className="space-y-2.5 pt-1 text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-300 font-semibold">Clamp Model to Terrain</span>
                              <span className="text-[8px] text-slate-500 font-mono">Snap base to topography elevation</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onModelClampToTerrainChange(!curClamp)}
                              className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                                curClamp 
                                  ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                  : 'bg-slate-700'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${curClamp ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                            <div className="flex flex-col pr-2">
                              <span className="text-[10px] text-slate-300 font-semibold">Apply SketchUp Orientation Profile</span>
                              <span className="text-[8px] text-slate-500 font-mono">Apply +90° base-heading to align horizontal baselines</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onModelApplySketchUpProfileChange(!curSketchUp)}
                              className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex-shrink-0 flex items-center ${
                                curSketchUp 
                                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20' 
                                  : 'bg-slate-700'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${curSketchUp ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        </div>

                        {/* HIGH-PRECISION Z-AXIS ROTATION SLIDER */}
                        <div className="space-y-1.5 pt-2 border-t border-white/5 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-300 font-semibold">Z-Axis Rotation (Heading)</span>
                            <span className="text-[10px] font-mono text-blue-400 font-bold">{(activeLayer ? activeLayer.heading : modelHeading).toFixed(2)}°</span>
                          </div>
                          <input
                            type="range"
                            min="0.00"
                            max="360.00"
                            step="0.05"
                            value={activeLayer ? activeLayer.heading : modelHeading}
                            onChange={(e) => onModelHeadingChange(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        {/* PITCH & ROLL PRECISION ADJUSTERS */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 text-left">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-mono">Pitch</span>
                              <span className="text-[9px] font-mono text-slate-300">{(activeLayer ? activeLayer.pitch : modelPitch).toFixed(2)}°</span>
                            </div>
                            <input
                              type="range"
                              min="-180.00"
                              max="180.00"
                              step="0.05"
                              value={activeLayer ? activeLayer.pitch : modelPitch}
                              onChange={(e) => onModelPitchChange(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-mono">Roll</span>
                              <span className="text-[9px] font-mono text-slate-300">{(activeLayer ? activeLayer.roll : modelRoll).toFixed(2)}°</span>
                            </div>
                            <input
                              type="range"
                              min="-180.00"
                              max="180.00"
                              step="0.05"
                              value={activeLayer ? activeLayer.roll : modelRoll}
                              onChange={(e) => onModelRollChange(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        </div>

                        {/* FOCUS BUTTON */}
                        <button
                          type="button"
                          onClick={onFlyToModel}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all cursor-pointer border-0 mt-2"
                        >
                          <Compass className="w-4 h-4" /> FOCUS CAMERA ON MODEL
                        </button>
                      </div>
                    );
                  })()}
                </div>
                  </div>
                )}
              </div>

              {/* TIER 2: Removed as requested since .obj, .fbx, and .dae are not supported */}
            </div>
          </div>
        )}
      </div>

              {/* Accordion Category 3: ⚡ Advanced External Link Streamers */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveSection(activeSection === 'external-streamers' ? null : 'external-streamers')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">⚡</span> Advanced External Link Streamers
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeSection === 'external-streamers' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeSection === 'external-streamers' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeSection === 'external-streamers' && (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    {/* ARC-GIS I3S LAYER STREAMING SECTION */}
                    <div className="space-y-2">
                      <div className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <span className="bg-sky-600/20 text-sky-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">I3S STREAM</span>
                        <span>🌐 Stream ArcGIS I3S Layer</span>
                      </div>
                      
                      <div className="space-y-2.5 bg-slate-950/40 p-3 rounded-xl border border-white/5 text-left">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                            Enter I3S Scene Server URL
                          </label>
                          <input
                            type="text"
                            value={i3sUrlInput}
                            onChange={(e) => setI3sUrlInput(e.target.value)}
                            placeholder="https://.../SceneServer"
                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none transition-colors font-mono"
                          />
                        </div>

                        <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <input
                            id="pass-credentials-i3s"
                            type="checkbox"
                            checked={passCredentials}
                            onChange={(e) => setPassCredentials(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500/20 focus:ring-offset-0 cursor-pointer accent-sky-500"
                          />
                          <label htmlFor="pass-credentials-i3s" className="text-[10px] text-slate-300 select-none cursor-pointer leading-tight block">
                            <span className="font-semibold text-sky-400 block mb-0.5">🔑 Pass Browser Login Session (With Credentials)</span>
                            <span className="text-[9px] text-slate-400">Sends active browser login cookies and SSO session credentials automatically without requiring token/client ID.</span>
                          </label>
                        </div>

                        {/* Direct Connection Toggle to support private networks / VPN sources like Abu Dhabi DMT */}
                        <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <input
                            id="force-direct-i3s"
                            type="checkbox"
                            checked={forceDirectI3s}
                            onChange={(e) => setForceDirectI3s(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500/20 focus:ring-offset-0 cursor-pointer accent-sky-500"
                          />
                          <label htmlFor="force-direct-i3s" className="text-[10px] text-slate-300 select-none cursor-pointer leading-tight block">
                            <span className="font-semibold text-sky-400 block mb-0.5">Direct Browser Connection Mode</span>
                            <span className="text-[9px] text-slate-400">Bypasses the public cloud server proxy. Required for secure enterprise/intranet links (like DMT VPN sources). Requires CORS browser extension or CORS-enabled server.</span>
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={handleLoadI3sStream}
                          disabled={isLoadingI3s || !i3sUrlInput.trim()}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer border-0 ${
                            isLoadingI3s
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : i3sUrlInput.trim()
                                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-500/15'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isLoadingI3s ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Streaming I3S...</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3.5 h-3.5" />
                              <span>Load I3S Stream</span>
                            </>
                          )}
                        </button>

                        {i3sError && (
                          <div className="p-2.5 bg-red-950/40 border border-red-500/20 text-red-200 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5 font-sans mt-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>{i3sError}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* EXTERNAL 3D TILESET STREAMER SECTION */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <span className="bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">3D TILESET</span>
                        <span>🌐 Stream 3D Tileset REST Link</span>
                      </div>
                      
                      <div className="space-y-2.5 bg-slate-950/40 p-3 rounded-xl border border-white/5 text-left">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                            Enter 3D Tileset URL
                          </label>
                          <input
                            type="text"
                            value={tilesetUrlInput}
                            onChange={(e) => setTilesetUrlInput(e.target.value)}
                            placeholder="Paste tileset .json URL here..."
                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition-colors font-mono"
                          />
                        </div>

                        <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <input
                            id="pass-credentials-tileset"
                            type="checkbox"
                            checked={passCredentials}
                            onChange={(e) => setPassCredentials(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                          />
                          <label htmlFor="pass-credentials-tileset" className="text-[10px] text-slate-300 select-none cursor-pointer leading-tight block">
                            <span className="font-semibold text-emerald-400 block mb-0.5">🔑 Pass Browser Login Session (With Credentials)</span>
                            <span className="text-[9px] text-slate-400">Sends active browser login cookies and SSO session credentials automatically without requiring token/client ID.</span>
                          </label>
                        </div>

                        <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-white/5">
                          <div className="flex justify-between text-[9px] font-mono text-slate-400">
                            <span className="uppercase tracking-wider font-semibold">🔍 LOD Distance Detail (SSE)</span>
                            <span className="text-emerald-400 font-bold">{maxSse}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="32" 
                            value={maxSse} 
                            onChange={(e) => {
                              const newSse = Number(e.target.value);
                              setMaxSse(newSse);
                              // Keep global maxSSE in sync so other tileset engines update
                              onMaxSSEChange?.(newSse);
                              // Dynamically update active loaded tilesets without reloading the page
                              activeLayers.forEach(layer => {
                                if (layer.instance && layer.instance.maximumScreenSpaceError !== undefined) {
                                  layer.instance.maximumScreenSpaceError = newSse;
                                }
                              });
                            }}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                          />
                          <p className="text-[8px] text-slate-500 leading-tight">Lower values (e.g., 1-4) force detailed buildings to stay visible much further away when zoomed out.</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleStreamExternalTileset}
                          disabled={!tilesetUrlInput.trim()}
                          className="w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer border-0 bg-green-600 hover:bg-green-500 text-white"
                        >
                          <span>⚡ Stream Layer onto Globe</span>
                        </button>

                        {tilesetError && (
                          <div className="p-2.5 bg-red-950/40 border border-red-500/20 text-red-200 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5 font-sans mt-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>{tilesetError}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ARCGIS AERIAL IMAGERY CATALOG STREAMER */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <span className="bg-cyan-600/20 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">AERIAL IMAGERY</span>
                        <span>🛰️ ArcGIS Aerial Imagery Catalog</span>
                      </div>
                      <ArcGisImageryPicker
                        mode="embedded"
                        sidebarTheme={sidebarTheme}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR PANEL: ACTIVE LAYERS & PLACEMENT DECK */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono mb-1 text-left">
                📐 Active Layers & Placement Deck
              </div>

              {/* Accordion Category 1: 🗂️ Active 3D Project Layers */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveRightSection(activeRightSection === 'active-layers' ? null : 'active-layers')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">🗂️</span> Active 3D Project Layers
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeRightSection === 'active-layers' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeRightSection === 'active-layers' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeRightSection === 'active-layers' && (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[10px] uppercase tracking-widest text-slate-300 font-mono font-bold">
                            Active 3D Project Layers
                          </span>
                        </div>
                        {importedLayers.length > 0 && (
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {importedLayers.length} {importedLayers.length === 1 ? 'Layer' : 'Layers'}
                          </span>
                        )}
                      </div>

                        {importedLayers.length > 0 ? (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {selectedLayerIds.length > 1 && (
                              <div className="flex items-center justify-between p-2 bg-red-950/30 border border-red-500/30 rounded-xl mb-2">
                                <span className="text-[10px] font-mono text-red-300 font-semibold">
                                  {selectedLayerIds.length} Layers Selected
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onDeleteLayer?.('')}
                                  className="px-2 py-1 text-[10px] font-mono font-bold text-red-200 bg-red-600/30 hover:bg-red-600/50 rounded-lg transition-colors flex items-center gap-1 border border-red-500/40 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                                </button>
                              </div>
                            )}
                            {importedLayers.map((lyr) => {
                              const isActive = selectedLayerIds.includes(lyr.id) || lyr.id === activeLayerId;
                              return (
                                <div
                                  key={lyr.id}
                                  onClick={(e) => onActiveLayerIdChange?.(lyr.id, Boolean(e.ctrlKey || e.metaKey || e.shiftKey))}
                                  className={`p-2 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                                    isActive
                                      ? 'bg-blue-950/50 border-blue-500/80 ring-1 ring-blue-500/50 shadow-md shadow-blue-500/10'
                                      : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                                  }`}
                                >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(lyr.id);
                                    }}
                                    className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                      lyr.visible 
                                        ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                        : 'bg-slate-700'
                                    }`}
                                    title={lyr.visible ? 'Hide Layer' : 'Show Layer'}
                                  >
                                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${lyr.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                                  </button>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[11px] font-semibold text-slate-200 truncate" title={lyr.name}>
                                      {lyr.type === 'parametric_massing' ? '🏢' : lyr.type === 'area_polygon' ? '📐' : '📦'} {lyr.name}
                                    </span>
                                    <span className="text-[8px] text-slate-500 font-mono">
                                      Lat: {lyr.latitude.toFixed(4)}° | Lon: {lyr.longitude.toFixed(4)}°
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlyToImportedLayer(lyr);
                                    }}
                                    title="Fly to dataset"
                                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Locate className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteLayer?.(lyr.id);
                                    }}
                                    className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                                    title="Delete Layer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 border border-dashed border-white/5 rounded-xl text-center bg-slate-950/30">
                          <span className="text-[10px] text-slate-500 font-mono">
                            No 3D models imported yet. Drag & drop a .gltf/.glb file into the Tier 1 slot above.
                          </span>
                        </div>
                      )}

                      {(streamedTilesetId || i3sLayers.length > 0 || activeLayers.length > 0) && (
                        <div className="mt-3 p-2.5 bg-blue-950/15 border border-blue-500/10 rounded-lg text-[9px] text-blue-400 leading-normal flex items-start gap-1.5 font-sans">
                          <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
                          <span>
                            <strong>Note:</strong> You have active Cesium assets streaming on the globe. Manage them separately inside the <strong>Cesium Assets</strong> layers tab for easy organization.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
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

                    {/* 1. Dedicated Zipped Utilities Shapefile & CAD DXF Upload Slots (First) */}
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
                              title="Remove uploaded utilities DXF"
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
                              <span className="text-[10px] text-orange-300 font-semibold font-mono">Projecting CAD DXF...</span>
                            </div>
                          ) : utilitiesShapefileName && utilitiesShapefileName.toLowerCase().endsWith('.dxf') ? (
                            <div className="flex items-center gap-2 text-left">
                              <div className="w-7 h-7 bg-orange-950/40 border border-orange-500/20 rounded-lg flex items-center justify-center text-orange-400">
                                <CheckCircle className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-semibold text-slate-200 truncate">{utilitiesShapefileName}</div>
                                <div className="text-[8px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                  <span>✓ Loaded DXF Pipes</span>
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
                                <div className="text-[10px] font-semibold text-slate-300 group-hover:text-slate-200">AutoCAD Utilities DXF</div>
                                <div className="text-[8px] text-slate-500 font-mono truncate">Ingests LWPOLYLINE, POLYLINE & LINE as 3D pipes</div>
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

                    {/* 5. Subsurface Camera Navigation Switch (Last) */}
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
                          <div className="truncate">Lat: {viewCorridorNode1.lat.toFixed(5)}°</div>
                        ) : (
                          <div>Not Captured</div>
                        )}
                      </div>
                      <div className={`p-1.5 rounded border ${viewCorridorNode2 ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300' : 'bg-slate-950/50 border-white/5 text-slate-500'}`}>
                        <div className="font-bold uppercase mb-0.5 text-[8px]">Node 2 (Target)</div>
                        {viewCorridorNode2 ? (
                          <div className="truncate">Lat: {viewCorridorNode2.lat.toFixed(5)}°</div>
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
                    onChange={(e) => onTerrainOverlayChange?.(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono"
                  >
                    <option value="none">None (Standard Imagery)</option>
                    <option value="contour">Elevation Contours</option>
                    <option value="sunlight-heatmap">Sunlight Exposure Heatmap (24H Cumulative)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {!globeState.terrainEnabled && (
                  <div className="mt-2.5 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-left flex items-start gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-[10px] leading-normal text-amber-300 font-sans">
                        <strong>Terrain Mesh is currently inactive.</strong> Diagnostic overlays require 3D Terrain elevation to calculate and render properly.
                      </p>
                      <button
                        type="button"
                        onClick={toggleTerrain}
                        className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer font-sans"
                      >
                        Activate Terrain Mesh Now
                      </button>
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

                    {/* Solar Intensity Pipeline */}
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                        Solar Intensity Pipeline
                      </p>
                      <p className="text-[8px] text-slate-500 leading-normal font-sans">
                        Reads pre-baked 'ANNUAL_KWH_SQM' property attributes on building tilesets and GeoJSON shapes to style them, or scales building height profiles to analyze ground heatmaps within the Spatial Boundary.
                      </p>
                    </div>

                    {/* Radiation Gradient Scale Slider */}
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

                    {/* Solar Exposure Heatmap Legend */}
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

                {/* Spatial Masking (Boundary Analysis) Section */}
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

                  {/* Mask Shape Toggle */}
                  <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-white/5 rounded-lg">
                    <div
                      className="w-full py-1.5 px-2 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    >
                      <Circle className="w-3 h-3 text-blue-400 animate-pulse" />
                      Circular Mask Mode
                    </div>
                  </div>

                  {/* Interactive Drawing/Placement Controls */}
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

                  {/* Resizable Slider for Circular Boundary */}
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
        )}

        {activeTab === 'ai-render' && (
          <div className="space-y-6">
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Generate photorealistic, high-fidelity architectural renders of your urban planning layouts directly from the current view.
            </div>

            {/* AI Image Generator Panel */}
            <div className="bg-slate-900 border border-white/5 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  AI Image Generator
                </span>
              </div>

              {/* AiStudio API Key Configuration Section (Replaces remaining balance window at the top) */}
              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-white/5 pb-1.5 justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                      AiStudio API Key
                    </span>
                  </div>
                  {customApiKey && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      Active
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="relative font-sans">
                    <input
                      type={isApiKeyVisible ? 'text' : 'password'}
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      placeholder="Enter AiStudio API Key..."
                      className={`w-full bg-slate-950/80 border rounded-lg py-2 pl-3 pr-10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono ${
                        tempApiKey.trim().startsWith('AIzaSy')
                          ? 'border-emerald-500 focus:ring-1 focus:ring-emerald-500/50'
                          : 'border-white/10 focus:ring-1 focus:ring-amber-500/50'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 flex items-center justify-center border-0 bg-transparent"
                    >
                      {isApiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {tempApiKey.trim().startsWith('AIzaSy') && (
                    <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-1">
                      ✓ Key Format Validated
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('nano_banana_api_key', tempApiKey);
                        setCustomApiKey(tempApiKey);
                      }}
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 border-0 rounded-lg text-xs font-bold text-slate-950 transition-all cursor-pointer text-center font-sans"
                    >
                      Apply & Save Key
                    </button>
                    {customApiKey && (
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('nano_banana_api_key');
                          setTempApiKey('');
                          setCustomApiKey('');
                        }}
                        className="px-2.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-all cursor-pointer text-center font-sans"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Onboarding Helper Link and Accordion Guide */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowOnboardingGuide(!showOnboardingGuide)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors text-left font-medium flex items-center gap-1 border-0 bg-transparent p-0 cursor-pointer w-full leading-normal"
                    >
                      👉 Don't have a key? Get a free Google AI Studio key here.
                    </button>

                    <AnimatePresence>
                      {showOnboardingGuide && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-slate-900/50 border border-white/5 rounded-lg p-2.5 mt-1.5 space-y-2 text-slate-400 text-sm leading-relaxed font-sans">
                            <p className="font-semibold text-slate-300 text-xs uppercase tracking-wider font-mono">
                              Google AI Studio Key Guide
                            </p>
                            <ul className="space-y-1.5 list-none pl-0 m-0 text-slate-400 text-sm">
                              <li className="flex gap-1.5 items-start">
                                <span className="text-slate-500 font-mono flex-shrink-0">1.</span>
                                <span>
                                  Click{' '}
                                  <a
                                    href="https://aistudio.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    aistudio.google.com
                                  </a>{' '}
                                  to open the developer dashboard in a new tab.
                                </span>
                              </li>
                              <li className="flex gap-1.5 items-start">
                                <span className="text-slate-500 font-mono flex-shrink-0">2.</span>
                                <span>Sign in using your standard personal Google or Gmail account profile.</span>
                              </li>
                              <li className="flex gap-1.5 items-start">
                                <span className="text-slate-500 font-mono flex-shrink-0">3.</span>
                                <span>Click the blue 'Get API Key' button located in the top-left sidebar menu.</span>
                              </li>
                              <li className="flex gap-1.5 items-start">
                                <span className="text-slate-500 font-mono flex-shrink-0">4.</span>
                                <span>Select 'Create API Key in new project', copy the generated code string (starts with AIzaSy...), and paste it into the box above.</span>
                              </li>
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Form inputs */}
              <div className="space-y-3.5">
                {/* Image Reference Selection & Viewport Capture Zone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono flex items-center justify-between">
                    <span>Image-to-Image Reference</span>
                    <span className="text-[9px] text-slate-500 lowercase font-normal">(optional)</span>
                  </label>

                  {(aiScreenshotDataUrl || uploadedImageRefDataUrl) ? (
                    <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3 space-y-3 relative">
                      <div className="flex gap-3 items-center">
                        <div className="relative w-16 h-12 rounded overflow-hidden border border-white/10 bg-black flex-shrink-0">
                          <img 
                            src={aiScreenshotDataUrl || uploadedImageRefDataUrl || ''} 
                            alt="Reference" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold text-slate-200 truncate">
                            {aiScreenshotDataUrl ? 'Viewport Screenshot' : (uploadedImageRefName || 'Uploaded Image')}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            {aiScreenshotDataUrl ? 'Captured from 3D Engine' : 'Custom Image Upload'}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onTriggerAiScreenshot) {
                              onTriggerAiScreenshot();
                            }
                          }}
                          className="flex-1 py-1 px-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded text-[10px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-3 h-3 text-amber-400" />
                          <span>Recapture View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedImageRefDataUrl(null);
                            setUploadedImageRefName(null);
                            if (onClearAiScreenshot) {
                              onClearAiScreenshot();
                            }
                          }}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/40 rounded text-[10px] font-semibold text-red-400 hover:text-red-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setUploadedImageRefDataUrl(reader.result as string);
                            setUploadedImageRefName(file.name);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className={`border border-dashed rounded-lg p-4 text-center transition-all ${
                        isDragging 
                          ? 'border-amber-500 bg-amber-500/5' 
                          : 'border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-slate-950/60'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-2">
                          {/* Capture Viewport Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onTriggerAiScreenshot) {
                                onTriggerAiScreenshot();
                              }
                            }}
                            className="py-2 px-3 bg-gradient-to-r from-amber-600/20 to-amber-500/20 hover:from-amber-600/35 hover:to-amber-500/35 border border-amber-500/40 hover:border-amber-500/60 text-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <Camera className="w-4 h-4 text-amber-400 animate-pulse" />
                            <span>Capture Viewport Screenshot</span>
                          </button>
                        </div>

                        <div className="text-[10px] text-slate-500 font-medium my-1">
                          — OR —
                        </div>

                        <label className="cursor-pointer group flex flex-col items-center">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setUploadedImageRefDataUrl(reader.result as string);
                                  setUploadedImageRefName(file.name);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <span className="text-[11px] text-slate-400 font-semibold group-hover:text-slate-200 transition-colors flex items-center gap-1">
                            <Upload className="w-3.5 h-3.5 text-slate-400" />
                            Upload reference photo
                          </span>
                          <span className="text-[9px] text-slate-600 font-mono mt-0.5">
                            Drag & drop PNG/JPEG image here
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Show 16:9 Safe Frame Switch */}
                <div className="flex items-center justify-between bg-slate-900/40 border border-white/5 rounded-xl p-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-300">Show 16:9 Safe Frame</span>
                    <span className="text-[9px] text-slate-500 font-mono">Capture boundary helper</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onShowSafeFrameChange?.(!showSafeFrame)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showSafeFrame ? 'bg-amber-600 shadow-sm shadow-amber-500/20' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showSafeFrame ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* AI Model Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI Render Model</span>
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all font-sans cursor-pointer"
                  >
                    <option value="nano banana pro">Nano Banana Pro (Max Realism)</option>
                    <option value="nano banana ai model">Nano Banana AI Model (Standard)</option>
                    <option value="nano banana lite">Nano Banana Lite (Fast - 720p only)</option>
                    <option value="nano banana 2">Nano Banana 2 (High Quality)</option>
                  </select>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
                    Render Prompt
                  </label>
                  <textarea
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                    placeholder="e.g., A futuristic sustainable waterfront city in Abu Dhabi, glass-and-steel modern towers with solar panels, sunset..."
                    rows={3}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
                    Output Resolution & Cost
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { res: '1K', label: '1K (Standard)', cost: '1' },
                      { res: '2K', label: '2K (HD)', cost: '2' },
                      { res: '4K', label: '4K (UHD)', cost: '4' }
                    ].map((opt) => (
                      <button
                        key={opt.res}
                        type="button"
                        onClick={() => setImgResolution(opt.res as any)}
                        className={`py-2 border rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                          imgResolution === opt.res
                            ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                            : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-950/60'
                        }`}
                      >
                        <span>{opt.res}</span>
                        <span className="text-[9px] text-slate-500 font-mono mt-0.5">{opt.cost} {opt.cost === '1' ? 'credit' : 'credits'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {imgError && (
                  <div className="bg-red-500/15 border border-red-500/20 rounded-lg p-3 text-[11px] text-red-400 leading-snug">
                    {imgError}
                  </div>
                )}

                {/* Generate Button with smart interceptors */}
                {(!customApiKey || customApiKey.trim() === '') && userCredits !== null && userCredits < (imgResolution === '1K' ? 1 : imgResolution === '2K' ? 2 : 4) ? (
                  <button
                    type="button"
                    onClick={() => setIsCreditModalOpen(true)}
                    className="w-full py-3 bg-red-600/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all cursor-not-allowed select-none flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Generate AI Rendering (Insufficient Credits)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isImgGenerating}
                    onClick={handleGenerateRendering}
                    className={`w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border-0 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 ${
                      isImgGenerating ? 'opacity-80' : ''
                    }`}
                  >
                    {isImgGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Rendering Premium 3D Scene...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>Generate AI Rendering</span>
                      </>
                    )}
                  </button>
                )}

                {imgGatewayLog && (
                  <div className="text-[9px] font-mono text-slate-500 text-center uppercase tracking-wider">
                    {imgGatewayLog}
                  </div>
                )}
              </div>
            </div>

            {/* Generated Image Preview Card */}
            {(isImgGenerating || generatedImgUrl) && (
              <div className="bg-slate-900 border border-white/5 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Image className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Output Preview ({imgResolution})
                  </span>
                </div>

                <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 border border-white/5 flex items-center justify-center group">
                  {isImgGenerating ? (
                    <div className="flex flex-col items-center gap-2 text-center p-4">
                      <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                      <div className="text-xs font-semibold text-slate-200 animate-pulse">Running GPU Inference Pass...</div>
                      <div className="text-[9px] text-slate-500 font-mono font-semibold">Syncing with external rendering pipeline</div>
                    </div>
                  ) : (
                    generatedImgUrl && (
                      <>
                        <img
                          src={generatedImgUrl}
                          alt="AI Generated Architectural Render"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          referrerPolicy="no-referrer"
                        />
                        {/* Hover Overlay Controls */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button
                            type="button"
                            disabled={!generatedImgUrl || isImgGenerating}
                            onClick={handleOpenPresentation}
                            className="p-2 bg-slate-900/90 border border-white/10 rounded-lg hover:bg-slate-800 hover:border-white/20 transition-all text-amber-400 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-md"
                            title="Open Full-Screen Presentation"
                          >
                            <Maximize2 className="w-4 h-4" />
                            <span>Presentation</span>
                          </button>
                        </div>
                      </>
                    )
                  )}
                </div>

                <div className="w-full">
                  <button
                    type="button"
                    disabled={!generatedImgUrl || isImgGenerating}
                    onClick={handleOpenPresentation}
                    className={`w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 border-0 text-slate-950 disabled:text-slate-500 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                      (!generatedImgUrl || isImgGenerating) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>Open Full-Screen Presentation</span>
                  </button>
                </div>

                {!isImgGenerating && generatedImgDesc && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold font-mono">
                      Scene Description
                    </div>
                    <div className="text-xs text-slate-300 font-sans leading-relaxed italic bg-slate-950/40 p-2.5 rounded-lg border border-white/5">
                      "{generatedImgDesc}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'simulation' && (
          <div className="space-y-6">
            {/* SIMULATION SECTION CARD */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-amber-400 animate-pulse" />
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Simulation
                  </h3>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono font-bold border border-amber-500/20">
                  Solar & Time-Lapse
                </span>
              </div>

              {/* CATEGORY 1: SUN POSITION & SOLAR TRAJECTORY */}
              <div className="space-y-3">
                <div 
                  onClick={() => setIsSunPositionExpanded(!isSunPositionExpanded)}
                  className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      Sun Position & Solar Trajectory
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {formatHour(sunHour)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSunPositionExpanded(!isSunPositionExpanded);
                      }}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                      title={isSunPositionExpanded ? "Collapse All" : "Un-collapse All"}
                    >
                      {isSunPositionExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isSunPositionExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 overflow-hidden text-left"
                    >
                      {/* Date Picker */}
                      <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5">
                        <span className="text-xs text-slate-400 font-semibold">Simulation Date</span>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            setIsSunAnimating(false);
                            onSelectedDateChange(e.target.value);
                          }}
                          className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all font-mono cursor-pointer"
                        />
                      </div>

                      {/* Time Zone Picker */}
                      <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-semibold">Time Zone</span>
                          <span className="text-[10px] text-amber-400/90 font-mono font-medium">
                            UTC{activeTimezoneOffset >= 0 ? `+${activeTimezoneOffset}` : activeTimezoneOffset}
                          </span>
                        </div>
                        <select
                          value={simulationTimezone}
                          onChange={(e) => {
                            setIsSunAnimating(false);
                            onSimulationTimezoneChange?.(e.target.value);
                          }}
                          className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all cursor-pointer font-sans"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value} className="bg-[#05070a] text-slate-200">
                              {tz.label}
                            </option>
                          ))}
                        </select>
                        {detectedTimezone && (
                          <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] text-amber-300 font-mono">
                            <Globe className="w-3 h-3 text-amber-400" />
                            <span>{detectedTimezone}</span>
                          </div>
                        )}
                      </div>

                      {/* Time of Day Slider & Play/Pause */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">Time of Day</span>
                          <button
                            type="button"
                            onClick={() => setIsSunAnimating(!isSunAnimating)}
                            className={`p-1 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer border-0 ${
                              isSunAnimating 
                                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 ring-1 ring-amber-500/30 animate-pulse' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                            title={isSunAnimating ? "Pause Sun Animation" : "Play Sun Animation (Time-lapse)"}
                          >
                            {isSunAnimating ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {formatHour(sunHour)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max="23.9"
                          step="0.1"
                          value={sunHour}
                          onChange={(e) => {
                            setIsSunAnimating(false);
                            onSunHourChange(parseFloat(e.target.value));
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>12 AM</span>
                          <span>6 AM</span>
                          <span>12 PM</span>
                          <span>6 PM</span>
                          <span>12 AM</span>
                        </div>
                      </div>

                      {/* Presets */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold font-mono block">Time Presets</span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { name: 'Morning', icon: '🌅', hour: 8.0 },
                            { name: 'Noon', icon: '☀️', hour: 12.0 },
                            { name: 'Afternoon', icon: '🌤️', hour: 16.0 },
                            { name: 'Sunset', icon: '🌇', hour: 19.5 }
                          ].map((preset) => (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => onSunHourChange(preset.hour)}
                              className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                Math.abs(sunHour - preset.hour) < 0.2
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                              }`}
                            >
                              <span>{preset.icon}</span>
                              <span>{preset.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 24-Hour Solar Path Visualizer */}
                      <div className="pt-3 border-t border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-200 font-semibold block">Solar Path Arc</span>
                            <span className="text-[9px] text-slate-500">Render 3D sun trajectory on globe</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSolarPathEnabledChange(!solarPathEnabled)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${solarPathEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${solarPathEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {solarPathEnabled && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3 pt-1.5 overflow-hidden"
                          >
                            {/* Arc Radius Slider */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-medium">Solar Dome Scale</span>
                                <span className="font-mono text-amber-400 font-bold">
                                  {solarPathRadius >= 1000 ? `${(solarPathRadius / 1000).toFixed(1)} km` : `${solarPathRadius}m`}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="200"
                                max="5000"
                                step="100"
                                value={solarPathRadius}
                                onChange={(e) => onSolarPathRadiusChange(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                              />
                              <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                                <span>200m</span>
                                <span>1.5km</span>
                                <span>3.0km</span>
                                <span>5.0km</span>
                              </div>
                            </div>

                            {/* Solar Arc Placement & Height Elevation Panel */}
                            <div className="p-2.5 bg-slate-900/90 border border-amber-500/20 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300">
                                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Arc Center & Placement</span>
                                </div>
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  3D Gizmo Active
                                </span>
                              </div>

                              {/* Active Center Coordinates */}
                              <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono bg-black/40 p-2 rounded border border-white/5 text-slate-300">
                                <div>
                                  <span className="text-slate-500 block text-[8px]">LATITUDE</span>
                                  <span className="text-amber-300 font-bold">{activeAnalysisCenter?.latitude ? activeAnalysisCenter.latitude.toFixed(5) : 'Auto (Viewport)'}°</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[8px]">LONGITUDE</span>
                                  <span className="text-amber-300 font-bold">{activeAnalysisCenter?.longitude ? activeAnalysisCenter.longitude.toFixed(5) : 'Auto (Viewport)'}°</span>
                                </div>
                              </div>

                              {/* Base Elevation (MSL) Slider */}
                              <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400 font-medium">Base Elevation (MSL)</span>
                                  <span className="font-mono text-amber-400 font-bold">
                                    {(activeAnalysisCenter?.height ?? 0).toFixed(1)}m MSL
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="-100"
                                    max="1000"
                                    step="1"
                                    value={activeAnalysisCenter?.height ?? 0}
                                    onChange={(e) => {
                                      const newHeight = parseFloat(e.target.value);
                                      const currentLat = activeAnalysisCenter?.latitude ?? 37.774929;
                                      const currentLng = activeAnalysisCenter?.longitude ?? -122.419416;
                                      onActiveAnalysisCenterChange?.({ latitude: currentLat, longitude: currentLng, height: newHeight });
                                    }}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentLat = activeAnalysisCenter?.latitude ?? 37.774929;
                                      const currentLng = activeAnalysisCenter?.longitude ?? -122.419416;
                                      onActiveAnalysisCenterChange?.({ latitude: currentLat, longitude: currentLng, height: 0 });
                                    }}
                                    className="text-[9px] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-white/10 font-mono transition-colors shrink-0 cursor-pointer"
                                    title="Reset base to Mean Sea Level (0m MSL)"
                                  >
                                    0m MSL
                                  </button>
                                </div>
                              </div>

                              {/* Button to snap/recenter on current viewport center */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (onActiveAnalysisCenterChange) {
                                    onActiveAnalysisCenterChange(null);
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded text-[10px] text-amber-200 font-semibold transition-colors cursor-pointer"
                              >
                                <Locate className="w-3.5 h-3.5 text-amber-400" />
                                <span>Recenter Arc to Viewport Center</span>
                              </button>
                            </div>

                            {/* Solar Analytics / Ephemeris Panel */}
                            <div className="p-3 bg-slate-900/80 border border-white/5 rounded-lg space-y-2">
                              <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                                <Compass className="w-3.5 h-3.5 text-amber-500" />
                                <span>Local Solar Metrics</span>
                              </div>
                              
                              {(() => {
                                let lat = 37.774929;
                                if (polygonData && polygonData.bounds) {
                                  lat = (polygonData.bounds.south + polygonData.bounds.north) / 2;
                                } else if (modelUrl && modelLatitude && modelLongitude) {
                                  lat = modelLatitude;
                                } else if (selectedPreset) {
                                  lat = selectedPreset.latitude;
                                }
                                
                                // Solar Declination
                                const d = new Date(selectedDate);
                                const start = new Date(d.getFullYear(), 0, 0);
                                const diff = d.getTime() - start.getTime();
                                const oneDay = 1000 * 60 * 60 * 24;
                                const N = Math.floor(diff / oneDay);
                                const declination = 23.45 * Math.sin((360 / 365) * (284 + N) * Math.PI / 180);
                                
                                const latRad = lat * Math.PI / 180;
                                const decRad = declination * Math.PI / 180;
                                
                                const cos_H = -Math.tan(latRad) * Math.tan(decRad);
                                
                                let dayLength = 0;
                                let sunriseHour = 6.0;
                                let sunsetHour = 18.0;
                                
                                if (cos_H >= 1) {
                                  dayLength = 0;
                                  sunriseHour = 0;
                                  sunsetHour = 0;
                                } else if (cos_H <= -1) {
                                  dayLength = 24;
                                  sunriseHour = 0;
                                  sunsetHour = 24;
                                } else {
                                  const H = Math.acos(cos_H) * 180 / Math.PI;
                                  dayLength = (2 * H) / 15;
                                  sunriseHour = 12 - (H / 15);
                                  sunsetHour = 12 + (H / 15);
                                }
                                
                                const currentH = (sunHour - 12) * 15;
                                const currentH_rad = currentH * Math.PI / 180;
                                const sin_alt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(currentH_rad);
                                const alt_rad = Math.asin(Math.max(-1, Math.min(1, sin_alt)));
                                const alt_deg = alt_rad * 180 / Math.PI;
                                
                                const cos_az = (Math.sin(decRad) - Math.sin(latRad) * sin_alt) / (Math.cos(latRad) * Math.cos(alt_rad));
                                const sin_az = -Math.sin(currentH_rad) * Math.cos(decRad) / Math.cos(alt_rad);
                                let az_deg = Math.acos(Math.max(-1, Math.min(1, cos_az))) * 180 / Math.PI;
                                if (sin_az < 0) {
                                  az_deg = 360 - az_deg;
                                }
                                
                                const formatTime = (h: number) => {
                                  if (h === 0) return "N/A";
                                  const hr = Math.floor(h);
                                  const min = Math.round((h - hr) * 60);
                                  const ampm = hr >= 12 ? "PM" : "AM";
                                  const displayHr = hr % 12 === 0 ? 12 : hr % 12;
                                  return `${displayHr}:${min.toString().padStart(2, '0')} ${ampm}`;
                                };

                                return (
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono text-slate-300">
                                    <div className="flex justify-between border-b border-white/5 py-0.5">
                                      <span className="text-slate-500">Altitude:</span>
                                      <span className={`font-semibold ${alt_deg >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                                        {alt_deg.toFixed(1)}°
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 py-0.5">
                                      <span className="text-slate-500">Azimuth:</span>
                                      <span className="text-slate-200 font-semibold">{az_deg.toFixed(0)}°</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 py-0.5">
                                      <span className="text-slate-500">Sunrise:</span>
                                      <span className="text-amber-300/90">{formatTime(sunriseHour)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 py-0.5">
                                      <span className="text-slate-500">Sunset:</span>
                                      <span className="text-rose-400/90">{formatTime(sunsetHour)}</span>
                                    </div>
                                    <div className="flex justify-between col-span-2 pt-0.5">
                                      <span className="text-slate-500">Day Duration:</span>
                                      <span className="text-slate-200 font-semibold">{dayLength.toFixed(1)} hours</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SIMULATION RECORDING & GALLERY (MOVED RIGHT BELOW SUN POSITION) */}
              <div className="space-y-3">
                <div 
                  onClick={() => setIsSimRecordingExpanded(!isSimRecordingExpanded)}
                  className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      Simulation Recording & Gallery
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      {simulationGallery.length} {simulationGallery.length === 1 ? 'Video' : 'Videos'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSimRecordingExpanded(!isSimRecordingExpanded);
                      }}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                      title={isSimRecordingExpanded ? "Collapse All" : "Un-collapse All"}
                    >
                      {isSimRecordingExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isSimRecordingExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 overflow-hidden text-left"
                    >
                      {/* Start Time & End Time Bookmarks */}
                      <div className="bg-slate-900/60 border border-white/5 p-3 rounded-xl space-y-3">
                        <div className="text-[10px] text-slate-300 font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Bookmark className="w-3 h-3 text-amber-400" /> Time Bookmarks
                          </span>
                          <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {formatHour(simBookmarkStart)} ➔ {formatHour(simBookmarkEnd)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Start Time Bookmark */}
                          <div className="bg-slate-950/80 border border-white/5 p-2 rounded-lg space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-amber-300 font-bold uppercase tracking-wider font-mono">Start Time</span>
                              <button
                                type="button"
                                onClick={() => setSimBookmarkStart(sunHour)}
                                className="text-[8px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-pointer font-mono transition-colors"
                                title="Set current time of day as Start Bookmark"
                              >
                                Set Current
                              </button>
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-200">
                              {formatHour(simBookmarkStart)}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="23.9"
                              step="0.1"
                              value={simBookmarkStart}
                              onChange={(e) => setSimBookmarkStart(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>

                          {/* End Time Bookmark */}
                          <div className="bg-slate-950/80 border border-white/5 p-2 rounded-lg space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-rose-300 font-bold uppercase tracking-wider font-mono">End Time</span>
                              <button
                                type="button"
                                onClick={() => setSimBookmarkEnd(sunHour)}
                                className="text-[8px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20 cursor-pointer font-mono transition-colors"
                                title="Set current time of day as End Bookmark"
                              >
                                Set Current
                              </button>
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-200">
                              {formatHour(simBookmarkEnd)}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="23.9"
                              step="0.1"
                              value={simBookmarkEnd}
                              onChange={(e) => setSimBookmarkEnd(parseFloat(e.target.value))}
                              className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                            />
                          </div>
                        </div>

                        {/* Quick Bookmark Presets */}
                        <div className="flex gap-1 overflow-x-auto pb-0.5 text-[8px] font-mono">
                          {[
                            { label: 'Full Day (06:00 - 18:00)', start: 6.0, end: 18.0 },
                            { label: 'Sunrise (05:00 - 09:00)', start: 5.0, end: 9.0 },
                            { label: 'Sunset (16:00 - 20:00)', start: 16.0, end: 20.0 },
                            { label: '24 Hours (00:00 - 23:50)', start: 0.0, end: 23.9 },
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSimBookmarkStart(preset.start);
                                setSimBookmarkEnd(preset.end);
                              }}
                              className={`px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 cursor-pointer whitespace-nowrap transition-colors ${
                                simBookmarkStart === preset.start && simBookmarkEnd === preset.end ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : ''
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Record Simulation Button or Active Progress */}
                        {isRecordingSim ? (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                                Recording Simulation...
                              </span>
                              <span className="text-slate-300 font-bold">{recordingProgress}%</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 rounded-full transition-all duration-200"
                                style={{ width: `${recordingProgress}%` }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleStopSimulationRecording}
                              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/30"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Stop & Save Recording</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartSimulationRecording}
                            className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/20 border border-white/10"
                          >
                            <Video className="w-4 h-4 text-white" />
                            <span>Record Simulation ({formatHour(simBookmarkStart)} ➔ {formatHour(simBookmarkEnd)})</span>
                          </button>
                        )}
                      </div>

                      {/* SIMULATION GALLERY */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs text-slate-200 font-semibold">Simulation Gallery</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono font-bold">
                            {simulationGallery.length} {simulationGallery.length === 1 ? 'Video' : 'Videos'}
                          </span>
                        </div>

                        {simulationGallery.length === 0 ? (
                          <div className="p-3 border border-dashed border-white/10 rounded-xl bg-slate-950/40 text-center">
                            <Film className="w-4 h-4 text-slate-500 mx-auto mb-1 opacity-50" />
                            <p className="text-[10px] text-slate-400 font-medium">No simulation videos recorded yet</p>
                            <p className="text-[9px] text-slate-500 mt-0.5">Set start & end bookmarks above and click Record Simulation.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {simulationGallery.map((vid) => (
                              <div
                                key={vid.id}
                                className="p-2 border border-white/10 bg-slate-950/80 hover:bg-slate-900/90 rounded-xl flex items-center gap-2.5 transition-all group"
                              >
                                {/* Thumbnail Preview with Play Overlay */}
                                <div
                                  onClick={() => setSelectedModalVideo(vid)}
                                  className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0 cursor-pointer border border-white/10 group-hover:border-amber-500/50 transition-all"
                                >
                                  {vid.thumbnailUrl ? (
                                    <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600">
                                      <Film className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-all">
                                    <div className="w-6 h-6 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                      <Play className="w-3 h-3 fill-current ml-0.5" />
                                    </div>
                                  </div>
                                </div>

                                {/* Video Info */}
                                <div className="flex-1 min-w-0 text-left">
                                  <h4
                                    onClick={() => setSelectedModalVideo(vid)}
                                    className="text-xs font-bold text-slate-200 hover:text-amber-300 truncate cursor-pointer"
                                    title={vid.title}
                                  >
                                    {vid.title}
                                  </h4>
                                  <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                                    {vid.date}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      {vid.fileSizeStr}
                                    </span>
                                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-400">
                                      {vid.mimeType.includes('mp4') ? 'MP4' : 'WEBM'}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                  <a
                                    href={vid.blobUrl}
                                    download={`${vid.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                                    title="Download MP4 Video"
                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setSimulationGallery(prev => prev.filter(item => item.id !== vid.id))}
                                    title="Delete Recording"
                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CATEGORY 2: SHADOW SETTINGS */}
              <div className="space-y-3">
                <div 
                  onClick={() => setIsShadowSolarAnalysisExpanded(!isShadowSolarAnalysisExpanded)}
                  className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      Shadow Settings
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {sunShadowsEnabled ? 'Shadows ON' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsShadowSolarAnalysisExpanded(!isShadowSolarAnalysisExpanded);
                      }}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                      title={isShadowSolarAnalysisExpanded ? "Collapse All" : "Un-collapse All"}
                    >
                      {isShadowSolarAnalysisExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isShadowSolarAnalysisExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 overflow-hidden text-left"
                    >
                      {/* "Enable Shadows" Toggle Switch */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-200 font-semibold block">Enable Shadows</span>
                          <span className="text-[9px] text-slate-500 font-mono">Toggle scene-wide shadow casting</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSunShadowsEnabledChange(!sunShadowsEnabled)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                            sunShadowsEnabled 
                              ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                              : 'bg-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${sunShadowsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* "Realistic Environment Lighting" Toggle Switch */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-200 font-semibold block">Realistic Environment Lighting</span>
                          <span className="text-[9px] text-slate-500 font-sans">Dark night cycle & dynamic twilight atmospheric shading</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRealisticLightingChange?.(!realisticLighting)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                            realisticLighting 
                              ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                              : 'bg-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${realisticLighting ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* "Ambient Lighting" Slider */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-200 font-semibold block">Ambient Lighting</span>
                            <span className="text-[9px] text-slate-500 font-sans">Adjust viewport baseline ambient fill brightness</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {ambientLightingIntensity.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.10"
                          max="1.50"
                          step="0.05"
                          value={ambientLightingIntensity}
                          onChange={(e) => onAmbientLightingIntensityChange?.(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>0.10 (Dim)</span>
                          <span>0.65 (Default)</span>
                          <span>1.50 (Bright)</span>
                        </div>
                      </div>

                      {/* "Night Ambient Fill Light" Slider */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-200 font-semibold block">Night Ambient Fill Light</span>
                            <span className="text-[9px] text-slate-500 font-sans">Control baseline visibility during night-time hours</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {nightAmbientIntensity.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.00"
                          max="1.00"
                          step="0.05"
                          value={nightAmbientIntensity}
                          onChange={(e) => onNightAmbientIntensityChange?.(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>0.00 (Pitch Black)</span>
                          <span>1.00 (Fully Lit)</span>
                        </div>
                      </div>

                      {/* "Shadow Darkness" Slider (0.1 to 0.9) */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-semibold">Shadow Darkness</span>
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {(shadowDarkness * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.9"
                          step="0.05"
                          value={shadowDarkness}
                          onChange={(e) => onShadowDarknessChange?.(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>10% (Subtle)</span>
                          <span>50%</span>
                          <span>90% (Intense)</span>
                        </div>
                      </div>

                      {/* "Shadow Bias" Slider */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-semibold">Anti-Moiré Depth Bias</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {shadowBias.toFixed(4)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.0001"
                          max="0.0150"
                          step="0.0001"
                          value={shadowBias}
                          onChange={(e) => onShadowBiasChange?.(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>0.0001 (Sharp/Acne)</span>
                          <span>0.0050 (Standard)</span>
                          <span>0.0150 (High Offset)</span>
                        </div>
                      </div>

                      {/* "Normal Offset Bias" Slider */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-semibold">Normal Offset Bias</span>
                          <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            {normalOffsetBias.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.00"
                          max="2.50"
                          step="0.05"
                          value={normalOffsetBias}
                          onChange={(e) => onNormalOffsetBiasChange?.(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>0.00 (No Offset)</span>
                          <span>1.00</span>
                          <span>2.50 (Max Offset)</span>
                        </div>
                      </div>

                      {/* "Shadow Max Distance" Slider */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-semibold">Shadow Max Distance</span>
                            <span className="text-[9px] text-slate-500 font-sans">Lower distance = sharper shadows, no distant moiré</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {shadowMaxDistance.toFixed(0)}m
                          </span>
                        </div>
                        <input
                          type="range"
                          min="500"
                          max="10000"
                          step="100"
                          value={shadowMaxDistance}
                          onChange={(e) => onShadowMaxDistanceChange?.(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                          <span>500m (Ultra-Sharp)</span>
                          <span>3000m (Balanced)</span>
                          <span>10000m (Extreme)</span>
                        </div>
                      </div>

                      {/* "Shadow Map Resolution" Selector */}
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-semibold">Shadow Map Resolution</span>
                          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {shadowMapResolution === 1024 && '1K (1024px)'}
                            {shadowMapResolution === 2048 && '2K (2048px)'}
                            {shadowMapResolution === 4096 && '4K (4096px)'}
                            {shadowMapResolution === 8192 && '8K RTX (8192px)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-xl border border-white/10">
                          {[
                            { label: '1k', value: 1024 },
                            { label: '2k', value: 2048 },
                            { label: '4k', value: 4096 },
                            { label: '8k(RTX)', value: 8192 },
                          ].map((res) => (
                            <button
                              key={res.value}
                              type="button"
                              onClick={() => onShadowMapResolutionChange?.(res.value)}
                              className={`py-1 px-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center ${
                                shadowMapResolution === res.value
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border border-blue-400/30'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              {res.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* "Soft Shadows" Toggle Switch */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-200 font-semibold block">Soft Shadows</span>
                          <span className="text-[9px] text-slate-500 font-mono">Enable percentage-closer shadow filtering</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSoftShadowsChange?.(!softShadows)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                            softShadows 
                              ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                              : 'bg-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${softShadows ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* RTX Ultra override status indicator */}
                      {rtxUltraEnabled && (
                        <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2 mt-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
                          <div className="text-[9px] text-blue-300 font-sans leading-normal">
                            <strong>RTX Ultra Mode is ON.</strong> Sharpness is locked to 4K Ultra HD (4096) & Max Rendering Distance is optimized to 3,000m for premium 1080p captures.
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CATEGORY 3: IBL, PBR & LIGHTING SHADERS */}
              <div className="space-y-3">
                <div 
                  onClick={() => setIsIblPbrExpanded(!isIblPbrExpanded)}
                  className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                      IBL, PBR & Lighting Shaders
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      HDR {hdrPipelineEnabled ? 'ON' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsIblPbrExpanded(!isIblPbrExpanded);
                      }}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                      title={isIblPbrExpanded ? "Collapse All" : "Un-collapse All"}
                    >
                      {isIblPbrExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isIblPbrExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-[#070b14]/90 border border-emerald-500/20 p-3.5 rounded-2xl space-y-3 overflow-hidden text-left shadow-2xl"
                    >
                      {/* Inner Card 1: Image-Based Lighting & HDR */}
                      <div className="bg-[#0b1220]/80 border border-emerald-500/15 rounded-xl p-3 space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <h4 className="text-xs font-bold text-emerald-400 font-sans">
                            Image–Based Lighting & HDR
                          </h4>
                        </div>

                        {/* HDR Pipeline Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Aperture className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs text-slate-200 font-medium">HDR Pipeline</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onHdrPipelineEnabledChange?.(!hdrPipelineEnabled)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                              hdrPipelineEnabled 
                                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' 
                                : 'bg-slate-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${hdrPipelineEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* SunLight Ambient PBR Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sun className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs text-slate-200 font-medium">SunLight Ambient PBR</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSunLightAmbientPbrChange?.(!sunLightAmbientPbr)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                              sunLightAmbientPbr 
                                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' 
                                : 'bg-slate-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${sunLightAmbientPbr ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* IBL Reflection Factor Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">IBL Reflection Factor</span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {iblReflectionFactor.toFixed(1)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.1"
                            value={iblReflectionFactor}
                            onChange={(e) => onIblReflectionFactorChange?.(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                          />
                        </div>

                        {/* Zenith Luminance Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Zenith Luminance</span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {zenithLuminance.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.00"
                            max="1.00"
                            step="0.02"
                            value={zenithLuminance}
                            onChange={(e) => onZenithLuminanceChange?.(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Inner Card 2: Lighting Shaders & Post-Process */}
                      <div className="bg-[#0b1220]/80 border border-cyan-500/15 rounded-xl p-3 space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                          <h4 className="text-xs font-bold text-cyan-400 font-sans">
                            Lighting Shaders & Post-Process
                          </h4>
                        </div>

                        {/* SSAO Ambient Occlusion Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-xs text-slate-200 font-medium">SSAO Ambient Occlusion</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSsaoEnabledChange?.(!ssaoEnabled)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                              ssaoEnabled 
                                ? 'bg-cyan-500 shadow-sm shadow-cyan-500/30' 
                                : 'bg-slate-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${ssaoEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* SSAO Occlusion Intensity Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">SSAO Occlusion Intensity</span>
                            <span className="text-xs font-mono font-bold text-cyan-400">
                              {ssaoIntensity.toFixed(1)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="4.0"
                            step="0.1"
                            value={ssaoIntensity}
                            onChange={(e) => onSsaoIntensityChange?.(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                          />
                        </div>

                        {/* Eye Adaptation & Tonemap Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-xs text-slate-200 font-medium">Eye Adaptation & Tonemap</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEyeAdaptationTonemapChange?.(!eyeAdaptationTonemap)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                              eyeAdaptationTonemap 
                                ? 'bg-cyan-500 shadow-sm shadow-cyan-500/30' 
                                : 'bg-slate-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${eyeAdaptationTonemap ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="space-y-6">
            {/* WORKSPACE / PROJECT MANAGEMENT SECTION */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Project Workspace
                </h3>
              </div>

              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 text-left">
                <p className="text-[10px] text-slate-400 leading-normal">
                  Save active terrain mesh configurations, draped textures, current layers, and saved camera views to a file.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onSaveProject}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border-0 shadow-md shadow-emerald-500/10"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Project
                  </button>

                  {!confirmNewProject ? (
                    <button
                      type="button"
                      onClick={() => setConfirmNewProject(true)}
                      className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/25 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Project
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1.5 p-1.5 border border-rose-500/30 bg-rose-500/5 rounded-lg">
                      <span className="text-[9px] text-rose-300 font-semibold text-center leading-tight font-mono">Reset Workspace?</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onNewProject();
                            setConfirmNewProject(false);
                          }}
                          className="py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded cursor-pointer border-0"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmNewProject(false)}
                          className="py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[9px] font-bold rounded cursor-pointer border border-white/10"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto Save Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-200 font-semibold block">Auto-Save Workspace</span>
                    <span className="text-[9px] text-slate-500">Persist state to browser storage</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAutoSaveEnabledChange) {
                        onAutoSaveEnabledChange(!autoSaveEnabled);
                        localStorage.setItem('geosphere_autosave_enabled', JSON.stringify(!autoSaveEnabled));
                      }
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${autoSaveEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoSaveEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Open Saved Project */}
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium block">Open Saved Project (.json)</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleProjectImport}
                    className="block w-full text-xs text-slate-500
                      file:mr-2 file:py-1 file:px-2
                      file:rounded-md file:border-0
                      file:text-[10px] file:font-semibold
                      file:bg-white/5 file:text-slate-300
                      hover:file:bg-white/10 file:cursor-pointer"
                  />
                  {projectError && (
                    <div className="text-[9px] text-red-400">{projectError}</div>
                  )}
                </div>

                {/* AI Studio Developer Utilities (Developer / AI Studio Only) */}
                {isDeveloperOrAIStudio() && (
                  <div className="pt-3 border-t border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block font-mono">
                        🛠️ AI Studio Developer Tools
                      </span>
                      <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono font-semibold">
                        Dev / AI Studio Only
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Automates production build and embeds <code className="text-amber-300">web.config</code> with IIS MIME types (.gltf, .glb, .b3dm, .cmpt, .terrain, .wasm) & SPA rewrites.
                    </p>
                    <button
                      type="button"
                      disabled={isExportingIIS}
                      onClick={handleExportIISPackage}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/10 flex items-center justify-center gap-2 cursor-pointer border border-purple-400/30"
                      title="Package & Export for IIS Server (.zip)"
                    >
                      {isExportingIIS ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating IIS Package (.zip)...</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4 text-white" />
                          <span>📦 Export IIS Web Package (.zip)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cesium-assets' && (
          <div className="space-y-4">
            <div className="text-[11px] text-slate-400 leading-snug">
              Consolidated 3D Geospatial layers, multi-account token asset explorer, streaming, and graphics configurations.
            </div>

            {/* 🔑 Cesium Ion Accounts & Dynamic Assets Panel */}
            <div className="border border-sky-500/30 bg-slate-900/90 rounded-2xl p-4 space-y-3.5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-400 shrink-0" />
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                    🔑 Cesium Ion Accounts & Dynamic Assets
                  </h3>
                </div>
                <span className="text-[9px] bg-sky-500/20 text-sky-300 font-mono px-2 py-0.5 rounded-full font-bold border border-sky-500/30">
                  Multi-Token
                </span>
              </div>

              {/* Input Form for Token and Account Alias */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-white/5 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-mono font-semibold block">
                    Paste Cesium Ion Access Token
                  </label>
                  <input
                    type="text"
                    value={inputIonToken}
                    onChange={(e) => setInputIonToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 focus:outline-none transition-all font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={inputAccountAlias}
                    onChange={(e) => setInputAccountAlias(e.target.value)}
                    placeholder="Account Alias (Optional)"
                    className="flex-1 min-w-0 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 focus:outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleScanAccountAssets()}
                    disabled={isScanning || !inputIonToken.trim()}
                    title="Scan Account Assets"
                    className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer border-0 shrink-0 ${
                      inputIonToken.trim() && !isScanning
                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isScanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {scanError && (
                  <div className="p-2.5 bg-red-950/50 border border-red-500/30 text-red-200 rounded-lg text-[10px] font-mono leading-relaxed flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="break-words">{scanError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScanError(null)}
                      className="text-slate-400 hover:text-white p-0.5 rounded text-[9px] shrink-0 font-mono underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {scanNote && (
                  <div className="p-2.5 bg-sky-950/50 border border-sky-500/30 text-sky-200 rounded-lg text-[10px] font-mono leading-relaxed flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <CheckCircle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span className="break-words">{scanNote}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScanNote(null)}
                      className="text-slate-400 hover:text-white p-0.5 rounded text-[9px] shrink-0 font-mono underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {ionAssetError && (
                  <div className="p-2.5 bg-red-950/50 border border-red-500/30 text-red-200 rounded-lg text-[10px] font-mono leading-relaxed flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="break-words">{ionAssetError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onIonAssetErrorChange?.(null)}
                      className="text-slate-400 hover:text-white p-0.5 rounded text-[9px] shrink-0 font-mono underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* Scanned Accounts & Inventory List */}
              <div className="space-y-2.5 pt-1">
                {(!ionAccounts || ionAccounts.length === 0) ? (
                  <div className="p-4 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                    <Globe className="w-5 h-5 text-slate-500 mx-auto mb-1.5 opacity-60" />
                    <p className="text-xs text-slate-300 font-medium">No Accounts Scanned Yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Paste a Cesium Ion token above and click the <Search className="w-3 h-3 inline text-sky-400" /> search button to fetch and manage your 3D assets.
                    </p>
                  </div>
                ) : (
                  ionAccounts.map((account) => {
                    const isExpanded = expandedAccountIds[account.id] ?? false;
                    const isShowingAddForm = showManualAddForm[account.id] ?? false;
                    const currentInput = manualAssetInputs[account.id] || { assetId: '', name: '', type: '3DTILES' };

                    return (
                      <div key={account.id} className="border border-white/10 bg-slate-950/80 rounded-xl overflow-hidden text-left">
                        {/* Account Header */}
                        <div className="p-2.5 bg-white/5 flex items-center justify-between gap-2 border-b border-white/5">
                          <button
                            type="button"
                            onClick={() => setExpandedAccountIds(prev => ({ ...prev, [account.id]: !isExpanded }))}
                            className="flex-1 flex items-center gap-2 text-left bg-transparent border-0 cursor-pointer overflow-hidden"
                          >
                            <div
                              className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title={isExpanded ? "Collapse All" : "Un-collapse All"}
                            >
                              {isExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </div>
                            <div className="truncate min-w-0" title={account.accountName}>
                              <div className="text-xs font-bold text-slate-200 font-mono truncate">{account.accountName}</div>
                              <div className="text-[9px] text-slate-400 font-mono truncate">
                                Token: {account.token.slice(0, 8)}... • {account.assets.length} Asset{account.assets.length === 1 ? '' : 's'}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              title="Re-scan and filter assets for this token"
                              onClick={() => handleScanAccountAssets(account.token, account.id)}
                              disabled={isScanning}
                              className="text-slate-400 hover:text-sky-300 p-1 rounded transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              type="button"
                              title="Remove Account"
                              onClick={() => handleRemoveAccount(account.id)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors bg-transparent border-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Account Assets Accordion Items */}
                        {isExpanded && (
                          <div className="p-2 space-y-2 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                            {account.assets.length === 0 ? (
                              <div className="text-[10px] text-slate-400 italic p-2 text-center font-mono">
                                No assets listed yet. Use '+ Add Asset ID' below to load an asset.
                              </div>
                            ) : (
                              account.assets.map((asset) => (
                                <div
                                  key={asset.id}
                                  className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                                    asset.loaded
                                      ? 'bg-sky-950/40 border-sky-500/40 shadow-sm'
                                      : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {/* Checkbox (To Load/Unload) */}
                                    <input
                                      type="checkbox"
                                      id={`asset-check-${account.id}-${asset.id}`}
                                      checked={!!asset.loaded}
                                      onChange={() => handleToggleAssetLoad(account.id, asset.id)}
                                      className="w-3.5 h-3.5 rounded border-slate-700 text-sky-500 focus:ring-sky-500/40 cursor-pointer shrink-0 accent-sky-500"
                                    />

                                    {/* Asset Info */}
                                    <div className="min-w-0 flex-1" title={asset.name}>
                                      <label
                                        htmlFor={`asset-check-${account.id}-${asset.id}`}
                                        title={asset.name}
                                        className="text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-sky-300 block min-w-0"
                                      >
                                        {asset.name}
                                      </label>
                                      <div className="flex items-center gap-2 mt-1 min-w-0">
                                        <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-white/10 text-sky-300 uppercase shrink-0">
                                          {asset.type}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-mono truncate">
                                          #{asset.id}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Actions: Eye Toggle Icon (Hide/Unhide), FlyTo, & Delete */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {asset.loaded && (
                                      <button
                                        type="button"
                                        onClick={() => handleFlyToIonAssetWithVisibility(account.id, asset.id)}
                                        title="Fly to Asset"
                                        className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer"
                                      >
                                        <MapPin className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={!asset.loaded}
                                      onClick={() => handleToggleAssetVisibility(account.id, asset.id)}
                                      title={!asset.loaded ? "Load asset using checkbox first" : asset.visible ? "Hide layer" : "Unhide layer"}
                                      className={`p-1 rounded transition-colors bg-transparent border-0 ${
                                        !asset.loaded
                                          ? 'text-slate-700 cursor-not-allowed'
                                          : asset.visible
                                            ? 'text-sky-400 hover:bg-sky-500/20 cursor-pointer'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/10 cursor-pointer'
                                      }`}
                                    >
                                      {asset.visible && asset.loaded ? (
                                        <Eye className="w-3.5 h-3.5" />
                                      ) : (
                                        <EyeOff className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAssetFromAccount(account.id, asset.id)}
                                      title="Remove from inventory"
                                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors bg-transparent border-0 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}

                            {/* Add Asset by ID Form */}
                            <div className="pt-1 border-t border-white/5">
                              {!isShowingAddForm ? (
                                <button
                                  type="button"
                                  onClick={() => setShowManualAddForm(prev => ({ ...prev, [account.id]: true }))}
                                  className="w-full py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 hover:border-sky-500/40 rounded-lg text-[10px] text-slate-300 hover:text-sky-300 flex items-center justify-center gap-1.5 font-mono transition-all cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" /> Add Asset by ID
                                </button>
                              ) : (
                                <div className="p-2.5 bg-slate-900 border border-sky-500/30 rounded-lg space-y-2 text-left animate-fadeIn">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-sky-300 font-mono">Add Asset to {account.accountName}</span>
                                    <button
                                      type="button"
                                      onClick={() => setShowManualAddForm(prev => ({ ...prev, [account.id]: false }))}
                                      className="text-slate-500 hover:text-slate-300 p-0.5 bg-transparent border-0 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-[9px] text-slate-400 font-mono block mb-0.5">Asset ID *</label>
                                      <input
                                        type="number"
                                        placeholder="e.g. 5069265"
                                        value={currentInput.assetId}
                                        onChange={(e) => setManualAssetInputs(prev => ({
                                          ...prev,
                                          [account.id]: { ...currentInput, assetId: e.target.value }
                                        }))}
                                        className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] text-slate-400 font-mono block mb-0.5">Asset Type</label>
                                      <select
                                        value={currentInput.type}
                                        onChange={(e) => setManualAssetInputs(prev => ({
                                          ...prev,
                                          [account.id]: { ...currentInput, type: e.target.value }
                                        }))}
                                        className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none cursor-pointer"
                                      >
                                        <option value="3DTILES">3D Tileset</option>
                                        <option value="IMAGERY">Imagery Layer</option>
                                        <option value="TERRAIN">Terrain Mesh</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[9px] text-slate-400 font-mono block mb-0.5">Name / Label (Optional)</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Architectural Model"
                                      value={currentInput.name}
                                      onChange={(e) => setManualAssetInputs(prev => ({
                                        ...prev,
                                        [account.id]: { ...currentInput, name: e.target.value }
                                      }))}
                                      className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleManualAddAssetToAccount(account.id)}
                                      disabled={!currentInput.assetId.trim()}
                                      className={`flex-1 py-1 px-2 rounded text-[10px] font-bold font-mono transition-all border-0 cursor-pointer ${
                                        currentInput.assetId.trim()
                                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                      }`}
                                    >
                                      Add & Stream Asset
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowManualAddForm(prev => ({ ...prev, [account.id]: false }))}
                                      className="py-1 px-2 rounded text-[10px] font-mono text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border-0 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              {/* Category 1: 🗂️ Cesium Layers Manager */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveCesiumAccordion(activeCesiumAccordion === 'layers' ? null : 'layers')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">🗂️</span> Cesium Layers Manager
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeCesiumAccordion === 'layers' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeCesiumAccordion === 'layers' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeCesiumAccordion === 'layers' && (() => {
                  const loadedIonAssets = (ionAccounts || []).flatMap(acc =>
                    (acc.assets || [])
                      .filter(a => a.loaded)
                      .map(a => ({ account: acc, asset: a }))
                  );
                  const totalAssetsCount = (streamedTilesetId ? 1 : 0) + i3sLayers.length + activeLayers.length + loadedIonAssets.length;

                  return (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    {/* SUB-SECTION 3: CESIUM ASSETS LAYERS */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                          Cesium Assets Layers
                        </label>
                        {totalAssetsCount > 0 && (
                          <span className="text-[8px] font-mono text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                            {totalAssetsCount} {totalAssetsCount === 1 ? 'Asset' : 'Assets'}
                          </span>
                        )}
                      </div>

                      {totalAssetsCount > 0 ? (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                          {/* Streamed 3D Tileset (fallback loader) */}
                          {streamedTilesetId && (
                            <div
                              className={`p-2 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                                activeLayerId === 'streamed-tileset'
                                  ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/5'
                                  : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                              }`}
                              onClick={() => onActiveLayerIdChange?.('streamed-tileset')}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleStreamedTilesetVisibility?.();
                                  }}
                                  className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                    streamedTilesetVisible ? 'bg-blue-500' : 'bg-slate-700'
                                  }`}
                                >
                                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${streamedTilesetVisible ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                                <div className="flex flex-col min-w-0 flex-1 text-left">
                                  <span className="text-[10px] font-semibold text-slate-200 truncate" title="Streamed 3D Tileset">
                                    🌐 Streamed 3D Tileset
                                  </span>
                                  <span className="text-[8px] text-slate-500 font-mono">ID: {streamedTilesetId}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFlyToStreamedTileset();
                                  }}
                                  title="Fly to dataset"
                                  className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                                >
                                  <Locate className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStreamedTilesetIdChange?.(null);
                                  }}
                                  className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ArcGIS I3S Layers */}
                          {i3sLayers && i3sLayers.map((lyr) => (
                            <div 
                              key={lyr.id} 
                              onClick={() => onActiveLayerIdChange?.(lyr.id)}
                              className={`p-2 border rounded-xl flex flex-col gap-1.5 transition-all cursor-pointer ${
                                lyr.visible
                                  ? 'bg-blue-950/25 border-blue-800/40' 
                                  : 'bg-white/5 border-white/5'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full min-w-0 gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleI3sLayerVisibility?.(lyr.id);
                                    }}
                                    className={`w-7 h-4 rounded-full p-0.5 transition-colors flex-shrink-0 cursor-pointer ${lyr.visible ? 'bg-blue-600' : 'bg-slate-700'}`}
                                  >
                                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${lyr.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                                  </button>
                                  <div className="min-w-0 flex-1 text-left">
                                    <div className="text-[10px] font-semibold text-slate-200 truncate">{lyr.name}</div>
                                    <div className="text-[8px] text-sky-400 font-mono">I3S STREAM</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlyToI3sLayer(lyr);
                                    }}
                                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Locate className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveI3sLayer?.(lyr.id);
                                    }}
                                    className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {lyr.visible && (
                                <div className="pt-1.5 border-t border-white/5 space-y-1 text-left" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-between text-[8px]">
                                    <span className="text-slate-400 font-medium">Altitude Adjustment:</span>
                                    <span className="font-mono text-emerald-400">{lyr.heightOffset || 0}m</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-300"
                                    max="300"
                                    step="1"
                                    value={lyr.heightOffset || 0}
                                    onChange={(e) => onUpdateI3sLayerHeightOffset?.(lyr.id, parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          {/* External Streamed 3D Tilesets (from REST Link) */}
                          {activeLayers && activeLayers.map((lyr) => (
                            <div
                              key={lyr.id}
                              className={`p-2 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                                lyr.id === activeLayerId
                                  ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/5'
                                  : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                              }`}
                              onClick={() => onActiveLayerIdChange?.(lyr.id)}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActiveLayerVisibility(lyr.id);
                                  }}
                                  className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                    lyr.visible 
                                      ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                      : 'bg-slate-700'
                                  }`}
                                >
                                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${lyr.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                                <div className="flex flex-col min-w-0 flex-1 text-left">
                                  <span className="text-[10px] font-semibold text-slate-200 truncate" title={lyr.label}>
                                    ⚡ {lyr.label}
                                  </span>
                                  <span className="text-[8px] text-slate-500 font-mono truncate" title={lyr.instance?.url || "External 3D Tileset"}>
                                    {lyr.instance?.url || "External 3D Tileset"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFlyToActiveLayer(lyr);
                                  }}
                                  title="Fly to dataset"
                                  className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                                >
                                  <Locate className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveActiveLayer(lyr.id);
                                  }}
                                  className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Multi-Token Ion Account Loaded Assets */}
                          {loadedIonAssets.map(({ account, asset }) => {
                            const outlineColor = asset.outlineColor || '#000000';
                            const outlineOpacity = asset.outlineOpacity !== undefined ? asset.outlineOpacity : 1.0;
                            const outlineThickness = asset.outlineThickness !== undefined ? asset.outlineThickness : 2.5;
                            const outlineEnabled = asset.outlineEnabled !== undefined ? asset.outlineEnabled : true;
                            return (
                              <div
                                key={`${account.id}-${asset.id}`}
                                className={`p-2.5 border rounded-xl flex flex-col gap-2 transition-all cursor-pointer ${
                                  asset.visible !== false
                                    ? 'bg-sky-950/40 border-sky-500/40 shadow-md shadow-sky-500/5'
                                    : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleAssetVisibility(account.id, asset.id);
                                      }}
                                      className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                        asset.visible !== false
                                          ? 'bg-sky-500 shadow-sm shadow-sky-500/20'
                                          : 'bg-slate-700'
                                      }`}
                                      title={asset.visible !== false ? 'Hide Asset' : 'Show Asset'}
                                    >
                                      <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${asset.visible !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </button>
                                    <div className="flex flex-col min-w-0 flex-1 text-left">
                                      <span className="text-[10px] font-semibold text-slate-200 truncate" title={asset.name}>
                                        {asset.name}
                                      </span>
                                      <span className="text-[8px] text-sky-400 font-mono truncate" title={`${asset.type} • ${account.accountName}`}>
                                        {asset.type} • {account.accountName}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFlyToIonAssetWithVisibility(account.id, asset.id);
                                      }}
                                      title="Fly to asset"
                                      className="p-1 hover:bg-white/5 text-slate-400 hover:text-sky-400 rounded transition-colors cursor-pointer"
                                    >
                                      <Locate className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleAssetLoad(account.id, asset.id);
                                      }}
                                      title="Unload asset"
                                      className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* 3D TILES OUTLINE STYLING CONTROLS */}
                                {(!asset.type || asset.type.toUpperCase().includes('3D') || asset.type.toUpperCase().includes('TILE')) && (
                                  <div className="pt-2 border-t border-white/5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                                    {/* Outline Header & ON/OFF Toggle */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${outlineEnabled ? 'bg-sky-400 shadow-sm shadow-sky-400/50' : 'bg-slate-600'}`} />
                                        <span>Outline Effect</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateIonAssetOutline(account.id, asset.id, undefined, undefined, undefined, !outlineEnabled)}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                                          outlineEnabled
                                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                                            : 'bg-slate-800/80 text-slate-400 border border-white/5 hover:text-slate-300 hover:bg-slate-800'
                                        }`}
                                        title={outlineEnabled ? 'Click to Turn Outlines OFF' : 'Click to Turn Outlines ON'}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${outlineEnabled ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'}`} />
                                        {outlineEnabled ? 'ON' : 'OFF'}
                                      </button>
                                    </div>

                                    {outlineEnabled && (
                                      <div className="flex flex-col gap-2 pt-0.5 bg-black/20 p-2 rounded-lg border border-white/5">
                                        {/* Thickness Slider */}
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[9px] text-slate-400 font-mono">Thickness</span>
                                            <span className="text-sky-300 font-mono text-[9px] font-bold">{outlineThickness.toFixed(1)} px</span>
                                          </div>
                                          <input
                                            type="range"
                                            min="0.5"
                                            max="8.0"
                                            step="0.5"
                                            value={outlineThickness}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              handleUpdateIonAssetOutline(account.id, asset.id, undefined, undefined, val, undefined);
                                            }}
                                            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                          />
                                        </div>

                                        {/* Opacity Slider */}
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[9px] text-slate-400 font-mono">Opacity</span>
                                            <span className="text-slate-300 font-mono text-[9px] font-bold">
                                              {Math.round(outlineOpacity * 100)}%
                                            </span>
                                          </div>
                                          <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={Math.round(outlineOpacity * 100)}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) / 100;
                                              handleUpdateIonAssetOutline(account.id, asset.id, undefined, val, undefined, undefined);
                                            }}
                                            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                                          />
                                        </div>

                                        {/* Color Picker & Swatches */}
                                        <div className="flex items-center justify-between gap-2 pt-0.5">
                                          <span className="text-[9px] text-slate-400 font-mono">Color</span>
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="color"
                                              value={outlineColor}
                                              onChange={(e) => {
                                                handleUpdateIonAssetOutline(account.id, asset.id, e.target.value, undefined, undefined, undefined);
                                              }}
                                              className="w-4 h-4 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
                                              title="Outline Color (Default: Black)"
                                            />
                                            <div className="flex items-center gap-1">
                                              {[
                                                { hex: '#000000', name: 'Black (Default)' },
                                                { hex: '#334155', name: 'Dark Slate' },
                                                { hex: '#FFFFFF', name: 'White' },
                                                { hex: '#06B6D4', name: 'Cyan' },
                                                { hex: '#3B82F6', name: 'Blue' }
                                              ].map(swatch => (
                                                <button
                                                  key={swatch.hex}
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateIonAssetOutline(account.id, asset.id, swatch.hex, undefined, undefined, undefined);
                                                  }}
                                                  className={`w-3.5 h-3.5 rounded-full border transition-transform shrink-0 ${
                                                    outlineColor.toUpperCase() === swatch.hex.toUpperCase()
                                                      ? 'border-white scale-125 ring-1 ring-sky-400'
                                                      : 'border-white/20 hover:scale-110'
                                                  }`}
                                                  style={{ backgroundColor: swatch.hex }}
                                                  title={swatch.name}
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 border border-dashed border-white/5 bg-slate-950/20 rounded-2xl text-center">
                          <Globe className="w-4 h-4 text-slate-600 mx-auto mb-1 opacity-60" />
                          <p className="text-[9px] text-slate-400 font-medium">No Cesium assets streamed</p>
                          <p className="text-[8px] text-slate-500 leading-normal">Configure custom assets under "Cesium Assets" or "Asset Loading & Streaming".</p>
                        </div>
                      )}
                    </div>

                    {/* SUB-SECTION 2: ACTIVE 3D PROJECT LAYERS */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                          Active 3D Project Layers
                        </label>
                        {importedLayers.length > 0 && (
                          <span className="text-[8px] font-mono text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                            {importedLayers.length} {importedLayers.length === 1 ? 'Layer' : 'Layers'}
                          </span>
                        )}
                      </div>

                      {importedLayers.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {selectedLayerIds.length > 1 && (
                            <div className="flex items-center justify-between p-2 bg-red-950/30 border border-red-500/30 rounded-xl mb-2">
                              <span className="text-[10px] font-mono text-red-300 font-semibold">
                                {selectedLayerIds.length} Selected
                              </span>
                              <button
                                type="button"
                                onClick={() => onDeleteLayer?.('')}
                                className="px-2 py-0.5 text-[9px] font-mono font-bold text-red-200 bg-red-600/30 hover:bg-red-600/50 rounded-lg transition-colors flex items-center gap-1 border border-red-500/40 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" /> Delete All
                              </button>
                            </div>
                          )}
                          {importedLayers.map((lyr) => {
                            const isActive = selectedLayerIds.includes(lyr.id) || lyr.id === activeLayerId;
                            return (
                              <div
                                key={lyr.id}
                                className={`p-2 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/5'
                                    : 'bg-slate-950/45 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                                }`}
                                onClick={() => onActiveLayerIdChange?.(lyr.id)}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(lyr.id);
                                    }}
                                    className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                                      lyr.visible !== false 
                                        ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                                        : 'bg-slate-700'
                                    }`}
                                  >
                                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${lyr.visible !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                                  </button>
                                  <div className="flex flex-col min-w-0 flex-1 text-left">
                                    <span className="text-[10px] font-semibold text-slate-200 truncate" title={lyr.name}>
                                      {lyr.name}
                                    </span>
                                    <span className="text-[8px] text-slate-500 font-mono truncate">
                                      {lyr.format?.toUpperCase() || 'GIS LAYER'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (lyr.type === 'shp') {
                                        onFlyToPolygon?.();
                                      } else if (lyr.type === 'gltf' || lyr.type === 'glb') {
                                        onFlyToModel?.();
                                      }
                                    }}
                                    title="Fly to layer"
                                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Locate className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteLayer?.(lyr.id);
                                    }}
                                    className="p-1 rounded text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 border border-dashed border-white/5 bg-slate-950/20 rounded-2xl text-center">
                          <Layers className="w-4 h-4 text-slate-600 mx-auto mb-1 opacity-60" />
                          <p className="text-[9px] text-slate-400 font-medium">No 3D Project Layers</p>
                          <p className="text-[8px] text-slate-500 leading-normal">Import KML, GeoJSON, CZML, or Shapefile data in the Import tab.</p>
                        </div>
                      )}
                    </div>

                    {/* SUB-SECTION 1: STANDARD MAP BASE LAYERS */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono block">
                        Standard Base Layers
                      </label>
                      
                      <div className="space-y-2">
                        {layers.map((layer) => {
                          const requiresIonToken = layer.id === 'google-3d-tiles' || layer.id === 'osm-buildings';
                          const isBlocked = requiresIonToken && !isConnected;

                          return (
                            <div 
                              key={layer.id} 
                              className={`p-2.5 border rounded-xl flex items-start justify-between transition-all ${
                                layer.enabled && !isBlocked
                                  ? 'bg-blue-950/25 border-blue-800/40' 
                                  : 'bg-white/5 border-white/5'
                              }`}
                            >
                              <div className="flex gap-2 min-w-0 flex-1">
                                <div className="p-1.5 bg-slate-950/60 border border-white/10 rounded-lg text-slate-400 flex-shrink-0">
                                  <Eye className={`w-3.5 h-3.5 ${layer.enabled && !isBlocked ? 'text-blue-400' : 'text-slate-500'}`} />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="text-[11px] font-semibold text-slate-200 truncate">{layer.name}</div>
                                  <div className="text-[9px] text-slate-400 mt-0.5 leading-normal truncate">{layer.description}</div>
                                  
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className="text-[8px] font-mono bg-slate-950 px-1 py-0.5 border border-white/5 rounded text-slate-400">
                                      {layer.type.toUpperCase()}
                                    </span>
                                    {isBlocked && (
                                      <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-1 py-0.5 border border-amber-500/20 rounded">
                                        TOKEN LOCKED
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isBlocked) {
                                      onConfigureToken?.();
                                    } else {
                                      onToggleLayer(layer.id);
                                    }
                                  }}
                                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${layer.enabled && !isBlocked ? 'bg-blue-600' : 'bg-slate-700'}`}
                                >
                                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${layer.enabled && !isBlocked ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                                
                                {isBlocked && (
                                  <button
                                    type="button"
                                    onClick={onConfigureToken}
                                    className="text-[8px] text-amber-400 hover:underline font-mono bg-transparent border-0 cursor-pointer p-0"
                                  >
                                    Set Key
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Google Street Labels Panel */}
                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="text-left">
                              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                <span>🏷️ Google Street Labels</span>
                                {googleLabelsEnabled && (
                                  <span className="text-[8px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 border border-emerald-500/20 rounded font-mono font-bold animate-pulse">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-400">Dynamic high-contrast visual annotations</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onGoogleLabelsEnabledChange?.(!googleLabelsEnabled)}
                              className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${googleLabelsEnabled ? 'bg-blue-500 shadow-sm' : 'bg-slate-700'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${googleLabelsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          {googleLabelsEnabled && (
                            <div className="pt-2.5 border-t border-white/5 space-y-1.5 text-left">
                              <div className="flex justify-between text-[9px] font-mono text-slate-400">
                                <span>Label Translucency (Opacity)</span>
                                <span className="text-blue-400 font-bold">{Math.round((googleLabelsAlpha ?? 1.0) * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.05"
                                value={googleLabelsAlpha ?? 1.0}
                                onChange={(e) => onGoogleLabelsAlphaChange?.(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STYLE AND POSITIONING CONTROLS FOR ACTIVE LAYER */}
                    {(() => {
                      const activeLayer = importedLayers.find(l => l.id === activeLayerId) || null;
                      if (activeLayer || modelUrl) {
                        const curClamp = activeLayer ? activeLayer.clampToTerrain : modelClampToTerrain;
                        const curSketchUp = activeLayer ? activeLayer.applySketchUpProfile : modelApplySketchUpProfile;

                        return (
                          <div className="space-y-3 pt-3 border-t border-white/5 animate-fadeIn">
                            <div className="flex items-center justify-between pb-1 border-b border-white/5">
                              <span className="text-[9px] uppercase tracking-widest text-blue-400 font-mono font-bold">
                                📐 Active Layer Placement & Styles
                              </span>
                            </div>

                            {/* COORDINATE ADJUSTMENTS */}
                            <div className="grid grid-cols-3 gap-2 text-left">
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Latitude</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={activeLayer ? activeLayer.latitude : modelLatitude}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (activeLayer) {
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, latitude: val } : l);
                                      onImportedLayersChange?.(updated);
                                    } else {
                                      onModelLatitudeChange?.(val);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Longitude</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={activeLayer ? activeLayer.longitude : modelLongitude}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (activeLayer) {
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, longitude: val } : l);
                                      onImportedLayersChange?.(updated);
                                    } else {
                                      onModelLongitudeChange?.(val);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Altitude (m)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={activeLayer ? activeLayer.height : modelHeight}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (activeLayer) {
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, height: val } : l);
                                      onImportedLayersChange?.(updated);
                                    } else {
                                      onModelHeightChange?.(val);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                            </div>

                            {/* ROTATIONAL TRANSFORMS */}
                            <div className="grid grid-cols-3 gap-2 text-left pt-1">
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Heading (°)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={activeLayer ? (activeLayer.heading || 0) : modelHeading}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (activeLayer) {
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, heading: val } : l);
                                      onImportedLayersChange?.(updated);
                                    } else {
                                      onModelHeadingChange?.(val);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Pitch (°)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={activeLayer ? (activeLayer.pitch || 0) : modelPitch}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (activeLayer) {
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, pitch: val } : l);
                                      onImportedLayersChange?.(updated);
                                    } else {
                                      onModelPitchChange?.(val);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Roll (°)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={activeLayer ? (activeLayer.roll || 0) : modelRoll}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (activeLayer) {
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, roll: val } : l);
                                      onImportedLayersChange?.(updated);
                                    } else {
                                      onModelRollChange?.(val);
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                            </div>

                            {/* OPACITY & TINT STYLING */}
                            {activeLayer && (
                              <div className="space-y-2 pt-2 border-t border-white/5 text-[10px]">
                                {/* Opacity */}
                                <div className="space-y-1 text-left">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[8px] text-slate-500 uppercase tracking-wider font-mono font-bold">Layer Opacity</label>
                                    <span className="text-slate-300 font-mono font-bold">{Math.round((activeLayer.opacity ?? 1.0) * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round((activeLayer.opacity ?? 1.0) * 100)}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) / 100;
                                      const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, opacity: val } : l);
                                      onImportedLayersChange?.(updated);
                                    }}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                  />
                                </div>

                                {/* Color Tint & Shader Blend */}
                                <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5 text-left">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Palette className="w-3.5 h-3.5 text-blue-400" />
                                      <div className="flex flex-col text-left">
                                        <label className="text-slate-200 font-mono font-bold text-[9px] uppercase tracking-wider">Color Tint Overlay</label>
                                        <span className="text-[8px] text-slate-500 font-mono">
                                          {activeLayer.enableTintOverlay ? `${Math.round((activeLayer.blendAmount ?? 0.5) * 100)}% Tint Active` : 'Off (Pure Native PBR Textures)'}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5">
                                      {activeLayer.enableTintOverlay && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = importedLayers.map(l => l.id === activeLayer.id ? { 
                                              ...l, 
                                              enableTintOverlay: false,
                                              surfaceColor: undefined, 
                                              colorBlendMode: undefined, 
                                              blendAmount: 0.0 
                                            } : l);
                                            onImportedLayersChange?.(updated);
                                          }}
                                          className="text-[8px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer mr-1"
                                          title="Reset to natural textures (0% tint)"
                                        >
                                          <RotateCcw className="w-2.5 h-2.5" /> Reset
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextState = !activeLayer.enableTintOverlay;
                                          const updated = importedLayers.map(l => l.id === activeLayer.id ? { 
                                            ...l, 
                                            enableTintOverlay: nextState,
                                            surfaceColor: nextState ? (l.surfaceColor || '#4A90E2') : undefined,
                                            colorBlendMode: nextState ? (l.colorBlendMode || 'MIX') : undefined,
                                            blendAmount: nextState ? ((l.blendAmount !== undefined && l.blendAmount > 0) ? l.blendAmount : 0.5) : 0.0
                                          } : l);
                                          onImportedLayersChange?.(updated);
                                        }}
                                        className={`w-7 h-4 rounded-full p-0.5 transition-all duration-200 relative cursor-pointer flex items-center shrink-0 ${
                                          activeLayer.enableTintOverlay ? 'bg-blue-600 shadow-sm shadow-blue-500/40' : 'bg-slate-700'
                                        }`}
                                        title={activeLayer.enableTintOverlay ? 'Disable Color Tint Overlay' : 'Enable Color Tint Overlay'}
                                      >
                                        <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${
                                          activeLayer.enableTintOverlay ? 'translate-x-3' : 'translate-x-0'
                                        }`} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Tint Percentage Slider */}
                                  <div className="space-y-1 pt-1 border-t border-white/5">
                                    <div className="flex items-center justify-between text-[8px]">
                                      <label className="text-slate-400 font-mono flex items-center gap-1">
                                        <span>Tint Percentage</span>
                                        {Math.round((activeLayer.blendAmount ?? (activeLayer.enableTintOverlay ? 0.5 : 0)) * 100) === 0 && (
                                          <span className="text-[7px] text-emerald-400 font-semibold">(Pure Original)</span>
                                        )}
                                      </label>
                                      <span className={`font-mono font-bold ${Math.round((activeLayer.blendAmount ?? (activeLayer.enableTintOverlay ? 0.5 : 0)) * 100) > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                        {Math.round((activeLayer.blendAmount ?? (activeLayer.enableTintOverlay ? 0.5 : 0)) * 100)}%
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={Math.round((activeLayer.blendAmount ?? (activeLayer.enableTintOverlay ? 0.5 : 0)) * 100)}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) / 100;
                                        const updated = importedLayers.map(l => l.id === activeLayer.id ? { 
                                          ...l, 
                                          blendAmount: val,
                                          enableTintOverlay: val > 0,
                                          colorBlendMode: l.colorBlendMode || 'MIX',
                                          surfaceColor: l.surfaceColor || '#4A90E2'
                                        } : l);
                                        onImportedLayersChange?.(updated);
                                      }}
                                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                  </div>

                                  {activeLayer.enableTintOverlay && (activeLayer.blendAmount ?? 0) > 0 ? (
                                    <div className="space-y-2 pt-1 border-t border-white/5 animate-fadeIn">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="color"
                                          value={activeLayer.surfaceColor || '#4A90E2'}
                                          onChange={(e) => {
                                            const color = e.target.value;
                                            const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, surfaceColor: color } : l);
                                            onImportedLayersChange?.(updated);
                                          }}
                                          className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                                        />
                                        <div className="flex items-center gap-1 flex-1 overflow-x-auto py-0.5">
                                          {[
                                            { hex: '#4A90E2', name: 'Architectural Blue' },
                                            { hex: '#FFFFFF', name: 'Natural White' },
                                            { hex: '#E2E8F0', name: 'Cool Slate' },
                                            { hex: '#FDE68A', name: 'Warm Stone' },
                                            { hex: '#86EFAC', name: 'Emerald' },
                                            { hex: '#FCA5A5', name: 'Rose' },
                                            { hex: '#C084FC', name: 'Purple' }
                                          ].map(swatch => (
                                            <button
                                              key={swatch.hex}
                                              type="button"
                                              onClick={() => {
                                                const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, surfaceColor: swatch.hex } : l);
                                                onImportedLayersChange?.(updated);
                                              }}
                                              className={`w-4 h-4 rounded-full border transition-transform shrink-0 ${
                                                (activeLayer.surfaceColor || '#4A90E2').toUpperCase() === swatch.hex.toUpperCase() 
                                                  ? 'border-white scale-110 ring-1 ring-blue-400' 
                                                  : 'border-white/20 hover:scale-105'
                                              }`}
                                              style={{ backgroundColor: swatch.hex }}
                                              title={swatch.name}
                                            />
                                          ))}
                                        </div>
                                      </div>

                                      {/* Blend Mode Buttons */}
                                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                                        {[
                                          { id: 'MIX', label: 'Mix Blend', desc: 'Fade Texture & Color' },
                                          { id: 'HIGHLIGHT', label: 'Highlight', desc: 'Natural Texture Multiply' },
                                          { id: 'REPLACE', label: 'Replace', desc: 'Solid Color Override' }
                                        ].map(mode => (
                                          <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => {
                                              const updated = importedLayers.map(l => l.id === activeLayer.id ? { 
                                                ...l, 
                                                colorBlendMode: mode.id
                                              } : l);
                                              onImportedLayersChange?.(updated);
                                            }}
                                            className={`py-1 px-1 rounded text-[8px] font-mono font-semibold text-center transition-all cursor-pointer ${
                                              (activeLayer.colorBlendMode || 'MIX') === mode.id
                                                ? 'bg-blue-600/40 border border-blue-400 text-blue-200'
                                                : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-slate-200'
                                            }`}
                                            title={mode.desc}
                                          >
                                            {mode.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )}

                            {/* TERRAIN CLAMPING */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-white/5 rounded-lg text-left">
                              <div className="min-w-0 flex-1 pr-2">
                                <span className="text-[10px] text-slate-200 font-bold block">Clamp Layer to Terrain</span>
                                <span className="text-[8px] text-slate-400 block leading-snug">Anchors the 3D footprint directly onto high-fidelity ground meshes.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeLayer) {
                                    const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, clampToTerrain: !curClamp } : l);
                                    onImportedLayersChange?.(updated);
                                  } else {
                                    onModelClampToTerrainChange?.(!curClamp);
                                  }
                                }}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${curClamp ? 'bg-blue-600' : 'bg-slate-700'}`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${curClamp ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            {/* SKETCHUP STYLING */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-white/5 rounded-lg text-left">
                              <div className="min-w-0 flex-1 pr-2">
                                <span className="text-[10px] text-slate-200 font-bold block">SketchUp Architectural Profile</span>
                                <span className="text-[8px] text-slate-400 block leading-snug">Renders high-contrast black outline strokes around mesh boundaries.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeLayer) {
                                    const updated = importedLayers.map(l => l.id === activeLayer.id ? { ...l, applySketchUpProfile: !curSketchUp } : l);
                                    onImportedLayersChange?.(updated);
                                  } else {
                                    onModelApplySketchUpProfileChange?.(!curSketchUp);
                                  }
                                }}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${curSketchUp ? 'bg-blue-600' : 'bg-slate-700'}`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${curSketchUp ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })()}
              </div>

              {/* Imagery Style Accordion */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveCesiumAccordion(activeCesiumAccordion === 'imagery' ? null : 'imagery')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">🖼️</span> Imagery Style
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeCesiumAccordion === 'imagery' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeCesiumAccordion === 'imagery' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeCesiumAccordion === 'imagery' && (
                  <div className="p-3.5 border-t border-white/5 space-y-3 text-left animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'satellite', name: 'Satellite High-Res', desc: 'Cesium Sentinel-2' },
                        { id: 'dark', name: 'Alidade Dark', desc: 'CartoDB Dark Matter' },
                        { id: 'streets', name: 'Voyager Streets', desc: 'CartoDB Voyager' },
                        { id: 'topo', name: 'OSM Standard', desc: 'OpenTopoMap Grid' }
                      ].map((styleOpt) => (
                        <button
                          key={styleOpt.id}
                          type="button"
                          onClick={() => toggleStyle(styleOpt.id as MapStyle)}
                          className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                            globeState.style === styleOpt.id 
                              ? 'bg-blue-600/15 border-blue-500/80 text-blue-400' 
                              : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          <div className="text-xs font-semibold">{styleOpt.name}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">{styleOpt.desc}</div>
                          {globeState.style === styleOpt.id && (
                            <span className="absolute top-2 right-2 p-0.5 bg-blue-500/20 rounded text-blue-400">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Visualization Layers Accordion */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveCesiumAccordion(activeCesiumAccordion === 'visualization' ? null : 'visualization')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">👁️</span> Visualization Layers
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeCesiumAccordion === 'visualization' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeCesiumAccordion === 'visualization' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeCesiumAccordion === 'visualization' && (
                  <div className="p-3.5 border-t border-white/5 space-y-2 text-left animate-fadeIn">
                    {/* 3D Buildings */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-200">3D Buildings</div>
                          <div className="text-[10px] text-slate-400">Cesium OSM architectural mesh</div>
                        </div>
                        <button
                          type="button"
                          onClick={toggleBuildings}
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${globeState.buildings3dEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${globeState.buildings3dEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {globeState.buildings3dEnabled && (
                        <div className="pt-2 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Architectural Shader & Outlines
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {globeState.buildingShaderMode || 'realistic'}
                            </span>
                          </div>

                          {/* Shader Mode Selection Grid */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'architectural-white', label: '🏛️ Arch White', desc: 'Sharp PBR Silhouette' },
                              { id: 'architectural-silhouette', label: '📐 Edge Outlines', desc: 'Rim Contrast' },
                              { id: 'blueprint', label: '📜 Blueprint', desc: 'Cyan Wireframe' },
                              { id: 'clay', label: '🏺 Warm Clay', desc: 'Studio Plaster' },
                              { id: 'dark-obsidian', label: '🌑 Dark Obsidian', desc: 'Modernist Contrast' },
                              { id: 'realistic', label: '🎨 Natural OSM', desc: 'Default Textures' },
                            ].map(preset => {
                              const isActive = (globeState.buildingShaderMode || 'realistic') === preset.id;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => {
                                    setGlobeState(prev => ({
                                      ...prev,
                                      buildingShaderMode: preset.id as any
                                    }));
                                  }}
                                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                    isActive
                                      ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-sm shadow-blue-500/20'
                                      : 'bg-black/20 border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/15'
                                  }`}
                                >
                                  <div className="text-[11px] font-semibold leading-tight">{preset.label}</div>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5 leading-tight">{preset.desc}</div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom GLSL Shader Accordion & Editor */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setGlobeState(prev => ({
                                  ...prev,
                                  buildingShaderMode: prev.buildingShaderMode === 'custom-glsl' ? 'architectural-white' : 'custom-glsl',
                                  buildingCustomShaderText: prev.buildingCustomShaderText || `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {\n  // Custom edge contrast / outline tinting logic\n  material.diffuse = vec3(0.9, 0.9, 0.95);\n}`
                                }));
                              }}
                              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                globeState.buildingShaderMode === 'custom-glsl'
                                  ? 'bg-blue-600/25 border-blue-500 text-blue-200'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 text-[11px]">
                                <FileCode className="w-3.5 h-3.5 text-blue-400" /> CustomShader GLSL Stage
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {globeState.buildingShaderMode === 'custom-glsl' ? 'ACTIVE' : 'EDIT'}
                              </span>
                            </button>

                            {globeState.buildingShaderMode === 'custom-glsl' && (
                              <div className="mt-2 p-2.5 bg-slate-950/80 border border-blue-500/30 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                  <span>fragmentShaderText (GLSL):</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGlobeState(prev => ({
                                        ...prev,
                                        buildingCustomShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {\n  // Custom edge contrast / outline tinting logic\n  material.diffuse = vec3(0.9, 0.9, 0.95);\n}`
                                      }));
                                    }}
                                    className="text-blue-400 hover:text-blue-300 underline cursor-pointer bg-transparent border-0 p-0 text-[10px]"
                                  >
                                    Reset Template
                                  </button>
                                </div>
                                <textarea
                                  value={globeState.buildingCustomShaderText || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGlobeState(prev => ({
                                      ...prev,
                                      buildingCustomShaderText: val
                                    }));
                                  }}
                                  rows={5}
                                  className="w-full bg-black/60 border border-white/15 focus:border-blue-400 rounded-lg p-2 text-[10px] text-blue-200 font-mono leading-relaxed outline-none resize-y"
                                  placeholder="// Enter GLSL fragment shader..."
                                />
                                <div className="text-[9px] text-slate-400 leading-normal">
                                  Uses <span className="text-slate-300 font-mono">Cesium.CustomShader</span> with <span className="text-slate-300 font-mono">LightingModel.PBR</span> for sharp real-time edge contrast and architectural silhouettes.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!isConnected && (
                        <button
                          type="button"
                          onClick={onConfigureToken}
                          className="text-[9px] font-sans bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 border border-amber-500/25 rounded text-amber-400 font-semibold cursor-pointer flex items-center gap-1 w-max"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                          </svg>
                          ION KEY REQUIRED
                        </button>
                      )}
                    </div>

                    {/* Terrain elevation */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-200">Terrain Mesh</div>
                          <div className="text-[10px] text-slate-400">High-resolution height mesh</div>
                        </div>
                        <button
                          type="button"
                          onClick={toggleTerrain}
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${globeState.terrainEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${globeState.terrainEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {globeState.terrainEnabled && ionAssets && ionAssets.terrainId && (
                        <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-[11px] font-medium text-slate-300">Use Custom Ion Terrain</div>
                            <div className="text-[9px] text-slate-500 font-mono truncate max-w-[150px]">
                              Asset ID: {ionAssets.terrainId}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onIonAssetErrorChange?.(null);
                              onIonAssetsChange?.({
                                ...ionAssets,
                                terrainEnabled: !ionAssets.terrainEnabled
                              });
                            }}
                            className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer relative ${
                              ionAssets.terrainEnabled ? 'bg-blue-500' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${ionAssets.terrainEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Atmosphere */}
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Atmospheric Scattering</div>
                        <div className="text-[10px] text-slate-400">Sun glare & space skybox</div>
                      </div>
                      <button
                        type="button"
                        onClick={toggleAtmosphere}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${globeState.atmosphereEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${globeState.atmosphereEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Atmospheric Fog */}
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Atmospheric Fog</div>
                        <div className="text-[10px] text-slate-400">Scale-based distance mist</div>
                      </div>
                      <button
                        type="button"
                        onClick={toggleFog}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${globeState.fogEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${globeState.fogEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Category 2: 🌐 Core Ion Asset Slots */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveCesiumAccordion(activeCesiumAccordion === 'slots' ? null : 'slots')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">🌐</span> Core Ion Asset Slots
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeCesiumAccordion === 'slots' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeCesiumAccordion === 'slots' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeCesiumAccordion === 'slots' && (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    {ionAssetError && (
                      <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 rounded-xl text-[10px] leading-relaxed flex items-start gap-2 animate-fade-in font-mono text-left">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold uppercase tracking-wider text-red-400 mb-0.5">Asset Load Failed</div>
                          <div>{ionAssetError}</div>
                        </div>
                      </div>
                    )}

                    {/* Group 1: 3D Tileset Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
                          3D Tileset Asset
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Load Asset</span>
                          <button
                            type="button"
                            disabled={!ionAssets?.tilesetId}
                            onClick={() => {
                              onIonAssetErrorChange?.(null);
                              onIonAssetsChange?.({
                                ...ionAssets,
                                tilesetEnabled: !ionAssets?.tilesetEnabled
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all relative ${
                              !ionAssets?.tilesetId 
                                ? 'opacity-40 cursor-not-allowed bg-slate-800' 
                                : ionAssets?.tilesetEnabled 
                                  ? 'bg-blue-600 shadow-md shadow-blue-500/20 cursor-pointer' 
                                  : 'bg-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${ionAssets?.tilesetEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 1234567"
                        value={ionAssets?.tilesetId || ''}
                        onChange={(e) => {
                          onIonAssetErrorChange?.(null);
                          onIonAssetsChange?.({
                            ...ionAssets,
                            tilesetId: e.target.value.trim(),
                            tilesetEnabled: e.target.value.trim() ? (ionAssets?.tilesetEnabled ?? false) : false
                          });
                        }}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 transition-all font-mono"
                      />
                    </div>

                    {/* Group 2: Terrain Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
                          Terrain Asset
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Activate Terrain</span>
                          <button
                            type="button"
                            disabled={!ionAssets?.terrainId}
                            onClick={() => {
                              onIonAssetErrorChange?.(null);
                              onIonAssetsChange?.({
                                ...ionAssets,
                                terrainEnabled: !ionAssets?.terrainEnabled
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all relative ${
                              !ionAssets?.terrainId 
                                ? 'opacity-40 cursor-not-allowed bg-slate-800' 
                                : ionAssets?.terrainEnabled 
                                  ? 'bg-blue-600 shadow-md shadow-blue-500/20 cursor-pointer' 
                                  : 'bg-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${ionAssets?.terrainEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 2345678"
                        value={ionAssets?.terrainId || ''}
                        onChange={(e) => {
                          onIonAssetErrorChange?.(null);
                          onIonAssetsChange?.({
                            ...ionAssets,
                            terrainId: e.target.value.trim(),
                            terrainEnabled: e.target.value.trim() ? (ionAssets?.terrainEnabled ?? false) : false
                          });
                        }}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 transition-all font-mono"
                      />
                    </div>

                    {/* Group 3: Custom Imagery Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
                          Custom Imagery Asset
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Drape Layer</span>
                          <button
                            type="button"
                            disabled={!ionAssets?.imageryId}
                            onClick={() => {
                              onIonAssetErrorChange?.(null);
                              onIonAssetsChange?.({
                                ...ionAssets,
                                imageryEnabled: !ionAssets?.imageryEnabled
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all relative ${
                              !ionAssets?.imageryId 
                                ? 'opacity-40 cursor-not-allowed bg-slate-800' 
                                : ionAssets?.imageryEnabled 
                                  ? 'bg-blue-600 shadow-md shadow-blue-500/20 cursor-pointer' 
                                  : 'bg-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${ionAssets?.imageryEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 3456789"
                        value={ionAssets?.imageryId || ''}
                        onChange={(e) => {
                          onIonAssetErrorChange?.(null);
                          onIonAssetsChange?.({
                            ...ionAssets,
                            imageryId: e.target.value.trim(),
                            imageryEnabled: e.target.value.trim() ? (ionAssets?.imageryEnabled ?? false) : false
                          });
                        }}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 transition-all font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Category 3: 📥 Asset Loading & Streaming */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveCesiumAccordion(activeCesiumAccordion === 'loaders' ? null : 'loaders')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">📥</span> Asset Loading & Streaming
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeCesiumAccordion === 'loaders' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeCesiumAccordion === 'loaders' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeCesiumAccordion === 'loaders' && (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    {/* STREAMING SERVICE 1: FALLBACK ION ASSET */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <span className="bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">ION STREAM</span>
                        <span>🌐 Multi-Account Fallback Asset Streamer</span>
                      </div>
                      
                      <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                        <div className="space-y-1">
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                            Enter Cesium Ion Asset ID
                          </label>
                          <input
                            type="text"
                            value={ionFallbackId}
                            onChange={(e) => setIonFallbackId(e.target.value)}
                            placeholder="e.g. 2359421"
                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                            Access Token Override (Optional)
                          </label>
                          <input
                            type="text"
                            value={fallbackTokenInput}
                            onChange={(e) => setFallbackTokenInput(e.target.value)}
                            placeholder="Paste custom token here..."
                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors font-mono"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLoadFallbackIonAsset(ionFallbackId, fallbackTokenInput)}
                          disabled={!ionFallbackId.trim()}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer border-0 ${
                            ionFallbackId.trim()
                              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/15'
                              : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Stream Asset</span>
                        </button>
                      </div>
                    </div>

                    {/* STREAMING SERVICE 2: ARCGIS I3S */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <span className="bg-sky-600/20 text-sky-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">I3S STREAM</span>
                        <span>🌐 Stream ArcGIS I3S Layer</span>
                      </div>
                      
                      <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                        <div className="space-y-1">
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                            Enter I3S Scene Server URL
                          </label>
                          <input
                            type="text"
                            value={i3sUrlInput}
                            onChange={(e) => setI3sUrlInput(e.target.value)}
                            placeholder="https://.../SceneServer"
                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none transition-colors font-mono"
                          />
                        </div>

                        <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <input
                            id="pass-credentials-i3s"
                            type="checkbox"
                            checked={passCredentials}
                            onChange={(e) => setPassCredentials(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500/20 focus:ring-offset-0 cursor-pointer accent-sky-500"
                          />
                          <label htmlFor="pass-credentials-i3s" className="text-[9px] text-slate-300 select-none cursor-pointer leading-tight block">
                            <span className="font-semibold text-sky-400 block mb-0.5">🔑 Pass Browser Login Session</span>
                            <span className="text-[8px] text-slate-400">Sends browser session cookies for private/secure layers.</span>
                          </label>
                        </div>

                        <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <input
                            id="force-direct-i3s"
                            type="checkbox"
                            checked={forceDirectI3s}
                            onChange={(e) => setForceDirectI3s(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500/20 focus:ring-offset-0 cursor-pointer accent-sky-500"
                          />
                          <label htmlFor="force-direct-i3s" className="text-[9px] text-slate-300 select-none cursor-pointer leading-tight block">
                            <span className="font-semibold text-sky-400 block mb-0.5">Direct Browser Connection Mode</span>
                            <span className="text-[8px] text-slate-400">Bypasses public cloud server proxies. Required for DMT VPN.</span>
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={handleLoadI3sStream}
                          disabled={isLoadingI3s || !i3sUrlInput.trim()}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer border-0 ${
                            isLoadingI3s
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : i3sUrlInput.trim()
                                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-500/15'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isLoadingI3s ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Streaming I3S...</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3.5 h-3.5" />
                              <span>Load I3S Stream</span>
                            </>
                          )}
                        </button>

                        {i3sError && (
                          <div className="p-2.5 bg-red-950/40 border border-red-500/20 text-red-200 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5 font-sans mt-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>{i3sError}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STREAMING SERVICE 3: REST 3D TILESET */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <div className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <span className="bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">3D TILESET</span>
                        <span>🌐 Stream 3D Tileset REST Link</span>
                      </div>
                      
                      <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                        <div className="space-y-1">
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-mono font-semibold block">
                            Enter 3D Tileset URL
                          </label>
                          <input
                            type="text"
                            value={tilesetUrlInput}
                            onChange={(e) => setTilesetUrlInput(e.target.value)}
                            placeholder="Paste tileset .json URL here..."
                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition-colors font-mono"
                          />
                        </div>

                        <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <input
                            id="pass-credentials-tileset"
                            type="checkbox"
                            checked={passCredentials}
                            onChange={(e) => setPassCredentials(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                          />
                          <label htmlFor="pass-credentials-tileset" className="text-[9px] text-slate-300 select-none cursor-pointer leading-tight block">
                            <span className="font-semibold text-emerald-400 block mb-0.5">🔑 Pass Browser Login Session</span>
                            <span className="text-[8px] text-slate-400">Sends browser session cookies for authenticated server.</span>
                          </label>
                        </div>

                        <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-white/5">
                          <div className="flex justify-between text-[9px] font-mono text-slate-400 font-semibold uppercase">
                            <span>🔍 LOD Distance Detail (SSE)</span>
                            <span className="text-emerald-400 font-bold">{maxSse}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="32" 
                            value={maxSse} 
                            onChange={(e) => {
                              const newSse = Number(e.target.value);
                              setMaxSse(newSse);
                              onMaxSSEChange?.(newSse);
                              activeLayers.forEach(layer => {
                                if (layer.instance && layer.instance.maximumScreenSpaceError !== undefined) {
                                  layer.instance.maximumScreenSpaceError = newSse;
                                }
                              });
                            }}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                          />
                          <p className="text-[8px] text-slate-500 leading-tight">Lower values (e.g. 1-4) force detailed cityscapes to stay visible further away.</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleStreamExternalTileset}
                          disabled={!tilesetUrlInput.trim()}
                          className="w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer border-0 bg-green-600 hover:bg-green-500 text-white"
                        >
                          <span>⚡ Stream Layer onto Globe</span>
                        </button>

                        {tilesetError && (
                          <div className="p-2.5 bg-red-950/40 border border-red-500/20 text-red-200 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5 font-sans mt-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>{tilesetError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>


              {/* Category 4: ⚙️ Cesium Performance & Graphics */}
              <div className="border border-white/5 bg-slate-900/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveCesiumAccordion(activeCesiumAccordion === 'performance' ? null : 'performance')}
                  className="w-full p-3 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-all duration-200 border-0 bg-transparent cursor-pointer"
                >
                  <span className="text-xs font-bold flex items-center gap-2 font-mono">
                    <span className="text-sm shrink-0">⚙️</span> Cesium Performance & Graphics
                  </span>
                  <div
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={activeCesiumAccordion === 'performance' ? "Collapse All" : "Un-collapse All"}
                  >
                    {activeCesiumAccordion === 'performance' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
                {activeCesiumAccordion === 'performance' && (
                  <div className="p-3.5 border-t border-white/5 space-y-4 text-left animate-fadeIn">
                    {/* Slider A: "Detail Sharpness (Max SSE)" */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-200 font-semibold block">Detail Sharpness (Max SSE)</span>
                        <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                          {maxSSE?.toFixed(1) || '16.0'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="32.0"
                        step="0.5"
                        value={maxSSE}
                        onChange={(e) => onMaxSSEChange?.(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>1.0 (Sharpest / High VRAM)</span>
                        <span>32.0 (Fastest FPS)</span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-normal">
                        Lower values (1.0-4.0) force full structural cityscapes to stay visible further away without disappearing when zooming out.
                      </p>
                    </div>

                    {/* Slider B: "Texture Memory Cache Size (MB)" */}
                    <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-200 font-semibold block">Texture Memory Cache Size (MB)</span>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                          {tileCacheSize || 512} MB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="256"
                        max="2048"
                        step="128"
                        value={tileCacheSize}
                        onChange={(e) => onTileCacheSizeChange?.(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>256 MB</span>
                        <span>1024 MB</span>
                        <span>2048 MB</span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-normal">
                        Optimize cache size for high-end GPUs. Setting it higher keeps assets resident in memory.
                      </p>
                    </div>

                    {/* Toggle Switch: "Aggressive LOD Skipping (Skip Levels)" */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                      <div className="space-y-0.5">
                        <span className="text-xs text-slate-200 font-semibold block">Aggressive LOD Skipping (Skip Levels)</span>
                        <span className="text-[9px] text-slate-500 font-sans">Skip intermediate detail levels to accelerate rendering and network bandwidth</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSkipLevelOfDetailChange?.(!skipLevelOfDetail)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center shrink-0 ${
                          skipLevelOfDetail 
                            ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                            : 'bg-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${skipLevelOfDetail ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[11px] text-blue-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <span>
                <strong className="font-semibold text-white">Developer Note:</strong> You can append custom GeoJSON, KML, Czml, or 3D Tilesets dynamically to the React <code>layers</code> state.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {/* Global Metrics Box from Immersive UI */}
            <div className="p-4 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-2xl">
              <h3 className="text-xs font-bold text-blue-400 uppercase mb-3">Global Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400">Active Nodes</p>
                  <p className="text-lg font-mono font-medium text-white">1,284</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Latency</p>
                  <p className="text-lg font-mono font-medium text-green-400">42ms</p>
                </div>
              </div>
            </div>

            {/* Sub telemetry details */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="text-[10px] text-slate-500 font-mono">FRAME TIME</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-1">16.67 ms</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="text-[10px] text-slate-500 font-mono">RENDERED PRIMS</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-1">2,401,842</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="text-[10px] text-slate-500 font-mono">CAMERA FOV</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-1">60.0°</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="text-[10px] text-slate-500 font-mono">TILES LOADING</div>
                <div className="text-sm font-bold font-mono text-blue-400 mt-1">0 / 12</div>
              </div>
            </div>

            <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
              <div className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" /> Active Spatial Metrics
              </div>
              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between text-slate-400 border-b border-white/5 pb-1">
                  <span>Ellipsoid Model:</span>
                  <span className="text-slate-200 font-semibold">WGS-84</span>
                </div>
                <div className="flex justify-between text-slate-400 border-b border-white/5 pb-1">
                  <span>Coordinate Space:</span>
                  <span className="text-slate-200 font-semibold">ECEF (Cartesian3)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Rendering Pipeline:</span>
                  <span className="text-slate-200 font-semibold">WebGL 2.0 Context</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'landmarks' && (() => {
          const historicalCount = currentLandmarks.filter((poi: any) => {
            const isMonument = poi.tags?.tourism === 'monument' || poi.tags?.historic === 'monument' || !!poi.tags?.monument;
            return (!!poi.tags?.historic || !!poi.tags?.historical) && !isMonument;
          }).length;

          const tourismCount = currentLandmarks.filter((poi: any) => {
            const isMonument = poi.tags?.tourism === 'monument' || poi.tags?.historic === 'monument' || !!poi.tags?.monument;
            return !!poi.tags?.tourism && poi.tags?.tourism !== 'monument';
          }).length;

          const monumentCount = currentLandmarks.filter((poi: any) => {
            return poi.tags?.tourism === 'monument' || poi.tags?.historic === 'monument' || !!poi.tags?.monument;
          }).length;

          const filteredLandmarks = currentLandmarks.filter((poi: any) => {
            const name = poi.tags?.name || poi.name || 'Historic Site';
            const matchesSearch = name.toLowerCase().includes(landmarkSearchQuery.toLowerCase());
            if (!matchesSearch) return false;

            if (landmarkCategoryFilter === 'all') return true;
            
            const isMonument = poi.tags?.tourism === 'monument' || poi.tags?.historic === 'monument' || !!poi.tags?.monument;
            const isHistorical = (!!poi.tags?.historic || !!poi.tags?.historical) && !isMonument;
            const isTourism = !!poi.tags?.tourism && poi.tags?.tourism !== 'monument';

            if (landmarkCategoryFilter === 'monument') return isMonument;
            if (landmarkCategoryFilter === 'historical') return isHistorical;
            if (landmarkCategoryFilter === 'tourism') return isTourism;
            return true;
          });

          return (
            <div className="space-y-4 text-left animate-fadeIn">
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Points of Interest & Landmarks</h3>
                  </div>
                  {/* Manual Refresh & Status Indicator */}
                  <div className="flex items-center gap-2">
                    {isLoadingPOI ? (
                      <span className="flex items-center gap-1 text-[9px] text-rose-400 font-mono font-medium animate-pulse">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                        Scanning...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-slate-500 font-mono">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Ready
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSearchViewportLandmarks}
                      disabled={isLoadingPOI}
                      className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Refresh landmarks"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPOI ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Discovered historic sights, monuments, and attractions within a 5km radius of the current map viewport center.
                </p>
              </div>

              {/* On-Demand Search Trigger Button */}
              <button
                type="button"
                onClick={handleSearchViewportLandmarks}
                disabled={isLoadingPOI}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-wide transition-all shadow-lg hover:shadow-rose-500/20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoadingPOI ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching Viewport...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>🔍 Find Landmarks in View</span>
                  </>
                )}
              </button>

              {landmarkError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-left animate-fadeIn">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider">Connection Warning</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-normal">
                    The primary Overpass API server returned an error ({landmarkError}). We are automatically attempting fallback mirrors.
                  </p>
                  <button
                    type="button"
                    onClick={handleSearchViewportLandmarks}
                    className="w-full py-1 px-2.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/30 text-amber-200 rounded-lg text-[10px] font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry Connection
                  </button>
                </div>
              )}

              {isLoadingPOI ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <RefreshCw className="w-6 h-6 text-rose-500 animate-spin" />
                  <span className="text-[10px] font-mono tracking-wider uppercase text-rose-300">Scanning viewport coordinates...</span>
                </div>
              ) : currentLandmarks.length === 0 ? (
                <div className="p-8 bg-slate-900/40 border border-white/5 rounded-xl text-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No historical monuments or tourist attractions identified in this coordinate viewport.
                  </p>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Drag the map, zoom in, or fly to a landmark-rich city (e.g. Rome, San Francisco, Paris) to auto-populate.
                  </p>
                </div>
              ) : (
                <>
                  {/* Search and Category Filters Row */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Search Input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">
                        Search Landmarks
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={landmarkSearchQuery}
                          onChange={(e) => setLandmarkSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-7 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-rose-500 focus:outline-none transition-colors font-mono"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3 pointer-events-none" />
                        {landmarkSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setLandmarkSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category Filter Dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">
                        Filter Category
                      </label>
                      <div className="relative">
                        <select
                          value={landmarkCategoryFilter}
                          onChange={(e) => setLandmarkCategoryFilter(e.target.value as any)}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-200 focus:border-rose-500 focus:outline-none transition-colors cursor-pointer appearance-none font-mono text-ellipsis overflow-hidden whitespace-nowrap"
                        >
                          <option value="all">All ({currentLandmarks.length})</option>
                          <option value="historical">Historic ({historicalCount})</option>
                          <option value="tourism">Tourism ({tourismCount})</option>
                          <option value="monument">Monument ({monumentCount})</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {filteredLandmarks.length === 0 ? (
                    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-xl text-center space-y-1 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-400 font-medium">
                        No matching landmarks found.
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Try modifying your search or filter options.
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      variants={landmarkContainerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10"
                    >
                      {filteredLandmarks.map((poi: any, index: number) => {
                        const name = poi.tags?.name || poi.name || 'Historic Site';
                        const type = poi.tags?.historic || poi.tags?.tourism || 'monument';
                        const isHistoric = !!poi.tags?.historic;
                        const distance = calculateDistance(poi.lat, poi.lon);

                        return (
                          <motion.button
                            key={poi.id || index}
                            variants={landmarkItemVariants}
                            type="button"
                            onClick={() => handlePOISelect(poi)}
                            className="w-full text-left p-3 bg-slate-900/40 hover:bg-slate-900/90 border border-white/5 hover:border-rose-500/30 rounded-xl flex items-center justify-between gap-3 group transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`p-1.5 bg-slate-950/60 rounded-lg group-hover:scale-105 transition-all ${isHistoric ? 'text-rose-400' : 'text-amber-400'}`}>
                                <MapPin className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-200 group-hover:text-rose-300 transition-colors truncate">
                                  {name}
                                </div>
                                <div className="text-[9px] text-slate-400 capitalize mt-0.5 font-mono truncate">
                                  {type.replace(/_/g, ' ')} &bull; {poi.lat.toFixed(4)}°, {poi.lon.toFixed(4)}°
                                </div>
                              </div>
                            </div>

                            {distance && (
                              <span className="text-[9px] font-mono font-bold bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded shrink-0 border border-rose-500/10">
                                {distance}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

          {/* Footer Branding */}
          <div className="pt-4 border-t border-white/10 text-center text-[10px] text-slate-500 flex-shrink-0">
            GeoSphere Engine &bull; Immersive UI
          </div>
        </div>
      )}

      {isCreditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left font-sans">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Credit Threshold Reached</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">HTTP 403 FORBIDDEN</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Credit Threshold Reached. Upgrade your subscription tier to refresh premium automated render tokens, or input your personal AiStudio API Key at the top of the AI Render tab to continue rendering.
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400 font-mono">Quick Solution</div>
              <p className="text-[11px] text-slate-300 leading-normal">
                Input an <strong>AiStudio API Key</strong> at the top of the AI Render tab to bypass credit limits entirely.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleResetCredits}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white rounded-lg transition-all cursor-pointer border-0"
              >
                Reset Credits to 10 (Demo)
              </button>
              <button
                type="button"
                onClick={() => setIsCreditModalOpen(false)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-slate-950 rounded-lg transition-all cursor-pointer border-0"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SIMULATION GALLERY VIEWER WINDOW */}
      {selectedModalVideo && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedModalVideo(null);
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Film className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>{selectedModalVideo.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-medium border border-amber-500/30">
                      Simulation Playback
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Recorded: {selectedModalVideo.date} • Size: {selectedModalVideo.fileSizeStr}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedModalVideo.blobUrl}
                  download={`${selectedModalVideo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedModalVideo(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Close Floating Player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Container - Centered and constrained */}
            <div className="flex-1 flex items-center justify-center p-4 bg-slate-950/80 min-h-0 relative overflow-hidden">
              <video
                src={selectedModalVideo.blobUrl}
                controls
                autoPlay
                playsInline
                loop
                className="max-w-full max-h-[55vh] w-auto h-auto object-contain rounded-xl shadow-xl border border-white/10"
              />
            </div>

            {/* Bottom Control Bar */}
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 bg-slate-950/60 text-xs text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                  Scale: Fit Floating Window
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {selectedModalVideo.startTimeStr} ➔ {selectedModalVideo.endTimeStr}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <a
                  href={selectedModalVideo.blobUrl}
                  download={`${selectedModalVideo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                  className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Save to Disk</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedModalVideo(null)}
                  className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-md text-xs font-semibold transition-all cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IIS Web Package (.zip) Export Modal */}
      {showIisModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-left font-sans">
            <button
              type="button"
              onClick={() => setShowIisModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer border-0 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  IIS Web Package Export (.zip)
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Windows IIS Server Deployment Bundle
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                {isExportingIIS ? (
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
                <span>Status: {isExportingIIS ? 'Building & Packaging...' : 'Complete'}</span>
              </div>
              <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-white/5">
                {iisExportMessage}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                IIS Server Deployment Instructions
              </h4>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-white/5">
                <li>Unzip <strong className="text-blue-300">Geosphere_3D_IIS_Package.zip</strong> directly into your IIS Site directory (e.g., <code className="text-cyan-300 bg-slate-900 px-1 rounded">C:\inetpub\wwwroot\geosphere</code>).</li>
                <li>Verify that the <strong className="text-slate-200">IIS URL Rewrite Module</strong> is installed on your Windows Server.</li>
                <li>Cesium 3D Tilesets (.gltf, .glb, .b3dm, .cmpt, .terrain, .wasm) and React SPA URL rewrites are fully configured inside <code className="text-amber-300 bg-slate-900 px-1 rounded">web.config</code>.</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowIisModal(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-0 shadow-md shadow-blue-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.aside>
    </>
  );
}
