import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import ViewportToolbar, { useWindowSize } from './ViewportToolbar';
import { useDeviceType } from '../hooks/useDeviceType';
import * as Cesium from 'cesium';
import * as turf from '@turf/turf';
import 'cesium/Source/Widgets/widgets.css';
import { GlobeState, LocationPreset, MapLayer, PolygonData, IonAssetsState, IonAccount, IonAccountAsset, ShapefileData, ShapefileFeature, BuildingShaderMode, type ActiveToolType, ParcelStyleConfig, GisLayer } from '../types';
import { ParcelStyleToolbar } from './ParcelStyleToolbar';
import { ViewportDropZone } from './ViewportDropZone';
import { ContextMenu } from './ContextMenu';
import { contextMenuService } from '../services/ContextMenuService';
import { LOCATION_PRESETS } from '../data/locations';
import { SaveLoadToolbar } from './SaveLoadToolbar';
import { StoredLayer, StoredProject } from '../services/ProjectStorageService';
import { Compass, ZoomIn, ZoomOut, RotateCcw, ShieldAlert, CheckCircle, ChevronsLeftRight, Trash2, Mountain, Ruler, Layers, Home, Camera, Sliders, Video, Eye, ChevronLeft, ChevronRight, Plus, Download, Key, Play, Pause, Sun, Cone, PenTool, HardHat, Building, Database, X } from 'lucide-react';
import tzlookup from 'tz-lookup';
import { getUtcOffsetForTimeZone } from '../utils/timezone';

export function createBuildingCustomShader(
  mode: BuildingShaderMode | undefined,
  customGlslText?: string,
  _silhouetteColor?: string
): Cesium.CustomShader | undefined {
  if (!mode || mode === 'realistic') {
    return undefined;
  }

  if (mode === 'architectural-white') {
    // Sharp architectural silhouette outlines on a 3D Tileset with crisp PBR shading
    return new Cesium.CustomShader({
      lightingModel: Cesium.LightingModel.PBR,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          // Custom edge contrast / outline tinting logic
          material.diffuse = vec3(0.9, 0.9, 0.95);
          material.roughness = 0.85;
        }
      `
    });
  }

  if (mode === 'architectural-silhouette') {
    // Sharp feature edge silhouette and rim contrast
    return new Cesium.CustomShader({
      lightingModel: Cesium.LightingModel.PBR,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          vec3 normalEC = fsInput.attributes.normalEC;
          vec3 positionEC = fsInput.attributes.positionEC;
          float nDotV = abs(dot(normalize(-positionEC), normalize(normalEC)));
          float edgeFactor = smoothstep(0.0, 0.35, nDotV);
          vec3 baseColor = vec3(0.92, 0.92, 0.96);
          vec3 outlineColor = vec3(0.12, 0.15, 0.22);
          material.diffuse = mix(outlineColor, baseColor, edgeFactor);
          material.roughness = 0.8;
        }
      `
    });
  }

  if (mode === 'blueprint') {
    // Architectural Blueprint glowing wireframe/silhouette
    return new Cesium.CustomShader({
      lightingModel: Cesium.LightingModel.PBR,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          vec3 normalEC = fsInput.attributes.normalEC;
          vec3 positionEC = fsInput.attributes.positionEC;
          float nDotV = abs(dot(normalize(-positionEC), normalize(normalEC)));
          float edge = 1.0 - smoothstep(0.08, 0.35, nDotV);
          material.diffuse = vec3(0.06, 0.18, 0.35);
          material.emissive = vec3(0.0, 0.65, 1.0) * edge * 0.85 + vec3(0.02, 0.05, 0.12);
          material.roughness = 0.9;
        }
      `
    });
  }

  if (mode === 'clay') {
    // Studio clay render style
    return new Cesium.CustomShader({
      lightingModel: Cesium.LightingModel.PBR,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          material.diffuse = vec3(0.85, 0.78, 0.72);
          material.roughness = 0.95;
        }
      `
    });
  }

  if (mode === 'dark-obsidian') {
    // Modernist dark obsidian silhouette
    return new Cesium.CustomShader({
      lightingModel: Cesium.LightingModel.PBR,
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          vec3 normalEC = fsInput.attributes.normalEC;
          vec3 positionEC = fsInput.attributes.positionEC;
          float nDotV = abs(dot(normalize(-positionEC), normalize(normalEC)));
          float edge = 1.0 - smoothstep(0.05, 0.3, nDotV);
          material.diffuse = vec3(0.12, 0.14, 0.18);
          material.emissive = vec3(0.45, 0.55, 0.7) * edge * 0.6;
          material.roughness = 0.6;
        }
      `
    });
  }

  if (mode === 'custom-glsl' && customGlslText && customGlslText.trim()) {
    try {
      return new Cesium.CustomShader({
        lightingModel: Cesium.LightingModel.PBR,
        fragmentShaderText: customGlslText
      });
    } catch (e) {
      console.warn('Failed to parse custom shader GLSL:', e);
      return undefined;
    }
  }

  return undefined;
}

export function createTilesetOutlineShader(
  outlineColor: string = '#000000',
  outlineOpacity: number = 1.0,
  outlineThickness: number = 2.5,
  outlineEnabled: boolean = true,
  baseLighting: Cesium.LightingModel = Cesium.LightingModel.PBR
): Cesium.CustomShader | undefined {
  if (!outlineEnabled || outlineOpacity === undefined || outlineOpacity <= 0) {
    return undefined;
  }

  let cesColor: Cesium.Color;
  try {
    cesColor = Cesium.Color.fromCssColorString(outlineColor || '#000000') || Cesium.Color.BLACK;
  } catch (_) {
    cesColor = Cesium.Color.BLACK;
  }

  const opacityVal = Math.max(0.0, Math.min(1.0, outlineOpacity));
  const thicknessVal = Math.max(0.5, Math.min(10.0, outlineThickness || 2.5));

  return new Cesium.CustomShader({
    lightingModel: baseLighting,
    uniforms: {
      u_outlineColor: {
        type: Cesium.UniformType.VEC3,
        value: new Cesium.Cartesian3(cesColor.red, cesColor.green, cesColor.blue)
      },
      u_outlineOpacity: {
        type: Cesium.UniformType.FLOAT,
        value: opacityVal
      },
      u_outlineThickness: {
        type: Cesium.UniformType.FLOAT,
        value: thicknessVal
      }
    },
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        vec3 normalEC = fsInput.attributes.normalEC;
        vec3 positionEC = fsInput.attributes.positionEC;
        float nDotV = abs(dot(normalize(-positionEC), normalize(normalEC)));
        
        // Edge calculation scaling with user-selected outline thickness
        float edgeThreshold = clamp(u_outlineThickness * 0.08 + 0.08, 0.05, 0.75);
        float edge = 1.0 - smoothstep(0.01, edgeThreshold, nDotV);
        float alpha = clamp(u_outlineOpacity * pow(edge, 1.4 / max(0.5, u_outlineThickness * 0.35)), 0.0, 1.0);
        material.diffuse = mix(material.diffuse, u_outlineColor, alpha);
      }
    `
  });
}

export const DEFAULT_CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNGJlMDVmYi01NjYwLTQ3NTYtYmVmYy1mMTQ2ZGM3YzRmOTIiLCJpZCI6NDU3NzkzLCJzdWIiOiJkbXR1ZHMiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiR2xvYmFsIFRva2VuIiwiaWF0IjoxNzg0NTczNjAzfQ.96JpZlEhh815zx8usEw99N0JSK__V1lU5AI00O8wPiQ';

// Read token from environment or use user's custom token/localStorage
let initialDefaultToken = import.meta.env.VITE_CESIUM_ION_TOKEN || import.meta.env.VITE_CESIUM_TOKEN || '';
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('cesium_ion_token');
  if (saved && saved.trim() !== '' && isValidCesiumToken(saved)) {
    initialDefaultToken = saved.trim();
  }
}
if (!isValidCesiumToken(initialDefaultToken)) {
  initialDefaultToken = DEFAULT_CESIUM_ION_TOKEN;
}
Cesium.Ion.defaultAccessToken = initialDefaultToken;

export function isValidCesiumToken(t: string | null | undefined): boolean {
  if (!t) return false;
  const trimmed = t.trim();
  if (trimmed === '' || trimmed === 'DEMO_FALLBACK' || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.toLowerCase().includes('token') || trimmed.toLowerCase().includes('placeholder') || trimmed.toLowerCase().includes('dummy')) return false;
  if (trimmed.length < 20) return false;

  // Reject the specific known expired/failed hardcoded token
  if (
    trimmed.includes('f5NjM0YzItYzNGY') ||
    trimmed.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmNWNjMDRjMi1jNGJiLTRmMDUtOTQyYy00ZjhjMjc2NzVmNmUi')
  ) {
    return false;
  }

  return true;
}

function getColorRampCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0.0, 'rgba(0, 255, 0, 0.4)');   // 0° Flat - Green
    gradient.addColorStop(0.2, 'rgba(255, 255, 0, 0.5)'); // Moderate Slope - Yellow
    gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.7)'); // Steep Slope - Orange
    gradient.addColorStop(1.0, 'rgba(255, 0, 0, 0.85)');  // Severe Cliff - Red
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);
  }
  return canvas;
}

function createClusterIcon(count: number): string {
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
  const color = count < 10 ? '#f43f5e' : count < 50 ? '#f59e0b' : '#3b82f6'; // rose, amber, blue
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 4}" fill="${color}" fill-opacity="0.95" stroke="#ffffff" stroke-width="2.5" />
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 8}" fill="${color}" fill-opacity="0.3" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 2" />
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function createLandmarkIcon(type: string): string {
  const isHistoric = type === 'historic' || type === 'monument' || type === 'castle' || type === 'ruins' || type === 'archaeological_site';
  const color = isHistoric ? '#f43f5e' : '#f59e0b'; // rose vs amber
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 11.25 14.4 22.92 15.01 23.41a1.49 1.49 0 0 0 1.98 0C17.6 38.92 32 27.25 32 16 32 7.16 24.84 0 16 0zm0 22a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

const createPipeShape = (radiusMeters = 0.25, segments = 8) => {
  const positions = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(
      new Cesium.Cartesian2(
        radiusMeters * Math.cos(angle),
        radiusMeters * Math.sin(angle)
      )
    );
  }
  return positions;
};

const convertLinesTo3DPipes = (dataSource: any, defaultRadius = 0.3) => {
  const entities = dataSource.entities.values;
  
  entities.forEach((entity: any) => {
    if (entity.polyline && entity.polyline.positions) {
      const positions = typeof entity.polyline.positions.getValue === 'function' ? entity.polyline.positions.getValue(Cesium.JulianDate.now()) : entity.polyline.positions;
      if (!positions) return;
      
      const getPropVal = (key: string) => {
        if (!entity.properties) return undefined;
        const p = entity.properties[key] || entity.properties[key.toLowerCase()] || entity.properties[key.toUpperCase()];
        if (!p) return undefined;
        return typeof p.getValue === 'function' ? p.getValue(Cesium.JulianDate.now()) : p;
      };

      // Determine pipe diameter from shapefile attributes (e.g. 'DIAMETER', 'PIPE_SIZE') or fallback
      const rawDiameter = entity.properties?.DIAMETER?.getValue?.() || 
                          getPropVal('DIAMETER') || 
                          getPropVal('PIPE_SIZE') || 
                          getPropVal('PIPE_DIA') || 
                          getPropVal('SIZE');
      const parsedDiameter = rawDiameter !== undefined ? Number(rawDiameter) : NaN;
      const pipeDiameter = (!isNaN(parsedDiameter) && parsedDiameter > 0) ? parsedDiameter : (defaultRadius * 2);
      const pipeRadius = pipeDiameter / 2;

      // Color code by utility type (Water = Blue, Electric = Red, Gas = Yellow, Sewer = Green)
      let pipeColor = Cesium.Color.CYAN;
      const rawUtilityType = entity.properties?.TYPE?.getValue?.() || 
                             getPropVal('TYPE') || 
                             getPropVal('UTILITY') || 
                             getPropVal('LAYER') || 
                             getPropVal('NAME') || '';
      const utilityType = String(rawUtilityType).toLowerCase();
      
      if (utilityType.includes('water')) pipeColor = Cesium.Color.BLUE;
      else if (utilityType.includes('electric') || utilityType.includes('power')) pipeColor = Cesium.Color.RED;
      else if (utilityType.includes('gas') || utilityType.includes('fuel')) pipeColor = Cesium.Color.YELLOW;
      else if (utilityType.includes('sewer') || utilityType.includes('drain')) pipeColor = Cesium.Color.GREEN;

      // Replace flat line with 3D Volumetric Cylinder Pipe
      entity.polylineVolume = new Cesium.PolylineVolumeGraphics({
        positions: positions,
        shape: createPipeShape(pipeRadius),
        material: new Cesium.ColorMaterialProperty(pipeColor.withAlpha(0.85)),
        cornerType: Cesium.CornerType.ROUNDED
      });

      // Remove flat polyline rendering
      entity.polyline = undefined;
    }
  });
};

interface CesiumGlobeProps {
  token: string | null;
  globeState: GlobeState;
  onGlobeStateChange?: React.Dispatch<React.SetStateAction<GlobeState>>;
  onToggleLayer?: (layerId: string) => void;
  selectedPreset: LocationPreset | null;
  flyToPresetTrigger?: number;
  onClearPreset: () => void;
  layers: MapLayer[];
  polygonData: PolygonData | null;
  textureUrl: string | null;
  textureName?: string | null;
  onTextureUrlChange?: (url: string | null, filename: string | null) => void;
  onLayerTextureChange?: (layerId: string, url: string | null, filename: string | null) => void;
  flyToPolygonTrigger: number;
  clippingMode: 'none' | 'inside' | 'outside';
  onClippingModeChange?: (mode: 'none' | 'inside' | 'outside') => void;
  clip3dTiles?: boolean;
  sunHour: number;
  onSunHourChange?: (hour: number) => void;
  sunShadowsEnabled: boolean;
  activeTool: ActiveToolType;
  onActiveToolChange: (tool: ActiveToolType) => void;
  // Subsurface excavation props
  subsurfaceCameraEnabled?: boolean;
  terrainOpacity?: number;
  subsurfaceUtilitiesVisible?: boolean;
  utilitiesShapefileData?: ShapefileData | null;
  excavationDepth?: number;
  clearExcavationTrigger?: number;
  massingFloors?: number;
  massingFloorHeight?: number;
  massingColor?: string;
  massingOpacity?: number;
  massingLevelColor?: string;
  showMassingLabels?: boolean;
  onMassingAreaChange?: (area: number | null) => void;
  onExcavationAreaChange?: (area: number | null) => void;
  flyToMassingTrigger?: number;
  viewCorridorNode1?: { lat: number; lon: number; height: number } | null;
  onViewCorridorNode1Change?: (node: { lat: number; lon: number; height: number } | null) => void;
  viewCorridorNode2?: { lat: number; lon: number; height: number } | null;
  onViewCorridorNode2Change?: (node: { lat: number; lon: number; height: number } | null) => void;
  viewCorridorSimulationActive?: boolean;
  onViewCorridorSimulationActiveChange?: (active: boolean) => void;
  viewCorridorFovX?: number;
  viewCorridorFovY?: number;
  viewCorridorBuffer?: number;
  viewCorridorVisible?: boolean;
  viewCorridorEncroached?: boolean;
  onViewCorridorEncroachedChange?: (encroached: boolean) => void;
  onViewCorridorViolationHeightChange?: (height: number) => void;
  placedTrees?: any[];
  onPlacedTreesChange?: (trees: any[]) => void;
  treeModelUrl?: string;
  onTreeModelUrlChange?: (url: string) => void;
  onMeasureResultChange: (result: string | null) => void;
  clearMeasurementTrigger: number;
  terrainOverlay?: 'none' | 'slope' | 'contour' | 'sunlight-heatmap';
  radiationGradientScale?: number;
  contourInterval?: number;
  boundaryBounds?: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null;
  onBoundaryBoundsChange?: (bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null) => void;
  boundaryShape?: 'rectangle' | 'circle';
  onBoundaryShapeChange?: (shape: 'rectangle' | 'circle') => void;
  boundaryRadius?: number;
  onBoundaryRadiusChange?: (radius: number) => void;
  boundaryCenter?: { latitude: number; longitude: number } | null;
  onBoundaryCenterChange?: (center: { latitude: number; longitude: number } | null) => void;
  // Swipe Props
  swipeEnabled: boolean;
  swipePosition: number;
  onSwipePositionChange: (pos: number) => void;
  
  // Dynamic Date Props
  selectedDate: string;

  // RTX Ultra Fidelity State
  rtxUltraEnabled: boolean;
  onRtxUltraEnabledChange?: (enabled: boolean) => void;

  // Google Maps Street Labels State
  googleLabelsEnabled: boolean;
  googleLabelsAlpha: number;

  // Simulation Time Zone offset in hours (e.g. -5, +9)
  timezoneOffset?: number;

  // 24-Hour Solar Path State
  solarPathEnabled: boolean;
  onSolarPathEnabledChange?: (enabled: boolean) => void;
  solarPathRadius: number;
  onSolarPathRadiusChange?: (radius: number) => void;
  activeAnalysisCenter?: { latitude: number; longitude: number; height?: number } | null;
  onActiveAnalysisCenterChange?: (center: { latitude: number; longitude: number; height?: number } | null) => void;

  // Shadow Map customizations
  shadowDarkness?: number;
  softShadows?: boolean;
  shadowBias?: number;
  normalOffsetBias?: number;
  shadowMaxDistance?: number;
  shadowMapResolution?: number;
  realisticLighting?: boolean;
  ambientLightingIntensity?: number;
  nightAmbientIntensity?: number;
  hdrPipelineEnabled?: boolean;
  sunLightAmbientPbr?: boolean;
  iblReflectionFactor?: number;
  zenithLuminance?: number;
  ssaoEnabled?: boolean;
  ssaoIntensity?: number;
  eyeAdaptationTonemap?: boolean;
  bloomGlareEnabled?: boolean;

  // Advanced Graphics & LOD Props
  maxSSE?: number;
  tileCacheSize?: number;
  skipLevelOfDetail?: boolean;

  // My Cesium Ion Assets Prop
  ionAssets?: IonAssetsState;

  // Save current view triggers
  saveViewTrigger?: number;
  onSaveViewCallback?: (view: { latitude: number; longitude: number; height: number; heading: number; pitch: number; roll: number; thumbnail?: string }) => void;
  viewportExportTrigger?: number;
  exportResolution?: string;
  showSafeFrame?: boolean;
  aiScreenshotTrigger?: number;
  onAiScreenshotCaptured?: (dataUrl: string) => void;

  // Camera Cinematic Flythrough Keyframes Props
  cameraKeyframes?: any[];
  addKeyframeTrigger?: number;
  onAddKeyframeCallback?: (kf: any) => void;
  playPathTrigger?: number;
  stopPathTrigger?: number;
  exportVideoTrigger?: number;
  videoExportResolution?: '1080p' | '4k';
  onPlayingPathChange?: (isPlaying: boolean) => void;
  onRecordingVideoChange?: (isRecording: boolean) => void;
  flyToKeyframeTrigger?: { index: number; timestamp: number } | null;

  // Shapefile Visualization Props
  shapefileData?: ShapefileData | null;
  selectedMetric?: string;
  extrudeHeights?: boolean;
  shapefileHeightMultiplier?: number;
  flyToFeature?: ShapefileFeature | null;
  flyToFeatureTrigger?: number;

  // Saved Views Props
  savedViews: LocationPreset[];
  onDeleteSavedView: (id: string) => void;
  onImportSavedViews: (views: LocationPreset[]) => void;
  projectionMode?: 'perspective' | 'orthographic';
  fovAngle?: number;
  onIonAssetError?: (message: string | null) => void;

  // 3D Model Importer Props
  modelUrl?: string | null;
  modelName?: string | null;
  modelLatitude?: number;
  modelLongitude?: number;
  modelHeight?: number;
  modelClampToTerrain?: boolean;
  modelFlyToTrigger?: number;
  modelApplySketchUpProfile?: boolean;
  modelHeading?: number;
  modelPitch?: number;
  modelRoll?: number;
  onModelLatitudeChange?: (lat: number) => void;
  onModelLongitudeChange?: (lon: number) => void;
  onModelHeightChange?: (height: number) => void;
  onModelHeadingChange?: (heading: number) => void;
  onModelPitchChange?: (pitch: number) => void;
  onModelRollChange?: (roll: number) => void;
  isPickingLocation?: boolean;
  onIsPickingLocationChange?: (isPicking: boolean) => void;
  localVectorUrl?: string | null;
  localVectorName?: string | null;
  localVectorType?: 'geojson' | 'kml' | null;
  streamedTilesetId?: string | null;
  streamedTilesetVisible?: boolean;
  importedLayers?: any[];
  activeLayerId?: string | null;
  selectedLayerIds?: string[];
  onImportedLayersChange?: (layers: any[]) => void;
  onActiveLayerIdChange?: (id: string | null, isMultiSelect?: boolean) => void;
  onDeleteLayer?: (id?: string) => void;
  onDeleteFeature?: (layerId?: string, featureId?: string | number) => void;
  layersOrder?: any[];
  i3sLayers?: any[];
  activeLayers?: any[];

  // Multi-Layer GIS Manager Props
  gisLayers?: any[];
  flyToLayerTrigger?: number;
  flyToLayerBounds?: any;
  shapefileName?: string | null;
  onUpdateGisLayerStyle?: (layerId: string, style: Partial<ParcelStyleConfig>) => void;
  onLocateGisLayer?: (bounds: any) => void;

  // Beta indicator props
  daysRemaining?: number;
  userEmail?: string;
  onSignOut?: () => void;
  accountRole?: string;
  simulateExpiry?: boolean;
  onToggleSimulateExpiry?: () => void;
  onShow401Page?: () => void;
  sidebarTheme?: 'light' | 'dark';
  pickedAssetMetadata?: { name: string; attributes: Record<string, any> } | null;
  onPickedAssetMetadataChange?: (metadata: { name: string; attributes: Record<string, any> } | null) => void;
  onCameraChange?: (cameraState: { destination: Cesium.Cartesian3; heading: number; pitch: number; roll: number }) => void;
  onViewportCenterChange?: (lat: number, lng: number) => void;
  externalCameraState?: { destination: Cesium.Cartesian3; heading: number; pitch: number; roll: number } | null;
  isSplitGlobe?: boolean;
  flyToLandmarkTrigger?: number;
  flyToLandmarkTarget?: { lat: number; lon: number } | null;
  currentLandmarks?: any[];
  onPOISelect?: (poi: any) => void;
  disabledUtilityLayers?: string[];
  selectedPipeAttribute?: string;
  useActualDiameter?: boolean;
  isAuthSuspended?: boolean;

  // Multi-Token Ion Accounts Props
  ionAccounts?: IonAccount[];
  flyToIonAssetTarget?: { accountId: string; assetId: number; trigger: number } | null;
  on3DTileLoaded?: () => void;

  // Parcel Style & Filter Toolbar Integration
  isParcelStyleOpen?: boolean;
  onToggleParcelStyle?: () => void;

  // ArcGIS Aerial Imagery Integration
  isArcGisImageryOpen?: boolean;
  onToggleArcGisImagery?: () => void;

  // Viewport Drag-and-Drop Ingestion Props
  onPolygonDataChange?: (
    data: PolygonData | null,
    filename: string | null,
    shapefileData?: ShapefileData | null
  ) => void;
  onAddGisLayer?: (
    polygon: PolygonData,
    filename: string,
    sData: ShapefileData
  ) => void;
  onModelUrlChange?: (
    url: string | null,
    filename: string | null,
    zipFiles?: Record<string, any>
  ) => void;
  selectedCrs?: string;
  workspaceOrigin?: { lat: number; lng: number } | null;
  onLocalVectorChange?: (url: string | null, name: string | null, type: 'geojson' | 'kml' | null) => void;
  onGisLayersChange?: (layers: GisLayer[]) => void;
  onRestoreProject?: (project: StoredProject) => void;
}


export default function CesiumGlobe({
  sidebarTheme = 'dark',
  daysRemaining,
  userEmail,
  onSignOut,
  accountRole,
  simulateExpiry,
  onToggleSimulateExpiry,
  token,
  globeState,
  onGlobeStateChange,
  onToggleLayer,
  selectedPreset,
  flyToPresetTrigger,
  onClearPreset,
  layers,
  polygonData,
  textureUrl,
  textureName,
  onTextureUrlChange,
  onLayerTextureChange,
  flyToPolygonTrigger,
  clippingMode,
  onClippingModeChange,
  clip3dTiles = true,
  onCameraChange,
  onViewportCenterChange,
  externalCameraState,
  isSplitGlobe = false,
  isParcelStyleOpen: propIsParcelStyleOpen,
  onToggleParcelStyle: propOnToggleParcelStyle,
  isArcGisImageryOpen: propIsArcGisImageryOpen,
  onToggleArcGisImagery: propOnToggleArcGisImagery,
  sunHour,
  onSunHourChange,
  sunShadowsEnabled,
  activeTool,
  onActiveToolChange,
  viewCorridorNode1,
  onViewCorridorNode1Change,
  viewCorridorNode2,
  onViewCorridorNode2Change,
  viewCorridorSimulationActive = false,
  onViewCorridorSimulationActiveChange,
  viewCorridorFovX = 30,
  viewCorridorFovY = 20,
  viewCorridorBuffer = 0,
  viewCorridorVisible = true,
  viewCorridorEncroached = false,
  onViewCorridorEncroachedChange,
  onViewCorridorViolationHeightChange,
  placedTrees = [],
  onPlacedTreesChange,
  treeModelUrl = 'https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb',
  onTreeModelUrlChange,
  onMeasureResultChange,
  clearMeasurementTrigger,
  terrainOverlay = 'none',
  radiationGradientScale = 1.0,
  contourInterval = 5.0,
  boundaryBounds = null,
  onBoundaryBoundsChange,
  boundaryShape = 'circle',
  onBoundaryShapeChange,
  boundaryRadius = 1000,
  onBoundaryRadiusChange,
  boundaryCenter = null,
  onBoundaryCenterChange,
  swipeEnabled,
  swipePosition,
  onSwipePositionChange,
  selectedDate,
  rtxUltraEnabled,
  onRtxUltraEnabledChange,
  googleLabelsEnabled,
  googleLabelsAlpha,
  timezoneOffset = -5,
  solarPathEnabled,
  onSolarPathEnabledChange,
  solarPathRadius,
  onSolarPathRadiusChange,
  activeAnalysisCenter,
  onActiveAnalysisCenterChange,
  shadowDarkness = 0.3,
  softShadows = true,
  shadowBias = 0.005,
  normalOffsetBias = 0.5,
  shadowMaxDistance = 3000,
  shadowMapResolution = 4096,
  realisticLighting = true,
  ambientLightingIntensity = 0.65,
  nightAmbientIntensity = 0.05,
  hdrPipelineEnabled = true,
  sunLightAmbientPbr = true,
  iblReflectionFactor = 1.0,
  zenithLuminance = 0.20,
  ssaoEnabled = false,
  ssaoIntensity = 1.0,
  eyeAdaptationTonemap = true,
  bloomGlareEnabled = false,
  maxSSE = 16.0,
  tileCacheSize = 512,
  skipLevelOfDetail = true,
  ionAssets,
  saveViewTrigger,
  onSaveViewCallback,
  viewportExportTrigger,
  exportResolution = '4K',
  showSafeFrame = false,
  aiScreenshotTrigger,
  onAiScreenshotCaptured,
  cameraKeyframes = [],
  addKeyframeTrigger,
  onAddKeyframeCallback,
  playPathTrigger,
  stopPathTrigger,
  exportVideoTrigger,
  videoExportResolution = '1080p',
  onPlayingPathChange,
  onRecordingVideoChange,
  flyToKeyframeTrigger = null,
  shapefileData = null,
  selectedMetric = 'Population',
  extrudeHeights = false,
  shapefileHeightMultiplier = 1.00,
  flyToFeature = null,
  flyToFeatureTrigger = 0,
  massingFloors = 5,
  massingFloorHeight = 3.5,
  massingColor = '#ffffff',
  massingOpacity = 1.0,
  massingLevelColor = '#808080',
  showMassingLabels = false,
  onMassingAreaChange,
  onExcavationAreaChange,
  flyToMassingTrigger = 0,
  savedViews,
  onDeleteSavedView,
  onImportSavedViews,
  projectionMode = 'perspective',
  fovAngle = 60,
  onIonAssetError,
  modelUrl = null,
  modelName = null,
  modelLatitude = 40.7128,
  modelLongitude = -74.0060,
  modelHeight = 0,
  modelClampToTerrain = true,
  modelFlyToTrigger = 0,
  modelApplySketchUpProfile = false,
  modelHeading = 0.0,
  modelPitch = 0.0,
  modelRoll = 0.0,
  onModelLatitudeChange,
  onModelLongitudeChange,
  onModelHeightChange,
  onModelHeadingChange,
  onModelPitchChange,
  onModelRollChange,
  isPickingLocation = false,
  onIsPickingLocationChange,
  localVectorUrl = null,
  localVectorName = null,
  localVectorType = null,
  streamedTilesetId = null,
  streamedTilesetVisible = true,
  importedLayers = [],
  activeLayerId = null,
  selectedLayerIds = [],
  onImportedLayersChange,
  onActiveLayerIdChange,
  onDeleteLayer,
  onDeleteFeature,
  layersOrder = [],
  i3sLayers = [],
  activeLayers = [],
  gisLayers = [],
  flyToLayerTrigger = 0,
  flyToLayerBounds = null,
  shapefileName = null,
  onUpdateGisLayerStyle,
  onLocateGisLayer,
  pickedAssetMetadata = null,
  onPickedAssetMetadataChange,
  flyToLandmarkTrigger = 0,
  flyToLandmarkTarget = null,
  currentLandmarks = [],
  onPOISelect,
  subsurfaceCameraEnabled = false,
  terrainOpacity = 1.0,
  subsurfaceUtilitiesVisible = true,
  utilitiesShapefileData = null,
  disabledUtilityLayers = [],
  selectedPipeAttribute = 'PIPEDIAMET',
  useActualDiameter = true,
  isAuthSuspended = false,
  onShow401Page,
  excavationDepth = 15,
  clearExcavationTrigger = 0,
  ionAccounts = [],
  flyToIonAssetTarget = null,
  on3DTileLoaded,
  onPolygonDataChange,
  onAddGisLayer,
  onModelUrlChange,
  selectedCrs = 'INHERITED_UTM',
  workspaceOrigin,
  onLocalVectorChange,
  onGisLayersChange,
  onRestoreProject
}: CesiumGlobeProps) {
  const { isTablet, isMobile, width } = useDeviceType();
  const isDrawerMode = isTablet || isMobile || width < 1024;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [viewerInstance, setViewerInstance] = useState<Cesium.Viewer | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [localIsRecording, setLocalIsRecording] = useState(false);
  const [tilesetLoadedCount, setTilesetLoadedCount] = useState(0);

  // Mouse state tracking for dynamic viewport cursors
  const [activeCursorMode, setActiveCursorMode] = useState<'default' | 'pan' | 'orbit' | 'zoom' | 'pencil'>('default');
  const [isWheelZooming, setIsWheelZooming] = useState(false);
  const wheelTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncButtons = (e: MouseEvent | PointerEvent) => {
      const buttons = e.buttons;
      if (buttons & 1) {
        // Left mouse dragging -> Hand Pan
        setActiveCursorMode('pan');
      } else if (buttons & 4) {
        // Middle mouse / scroll wheel holding -> Orbit mode
        setActiveCursorMode('orbit');
      } else if (buttons & 2) {
        // Right mouse dragging -> Zoom mode
        setActiveCursorMode('zoom');
      } else {
        setActiveCursorMode('default');
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      syncButtons(e);
    };

    const handlePointerMove = (e: PointerEvent) => {
      syncButtons(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      syncButtons(e);
    };

    const handleWheel = () => {
      setIsWheelZooming(true);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        setIsWheelZooming(false);
      }, 350);
    };

    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    container.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    container.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      container.removeEventListener('wheel', handleWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, []);

  const isDrawingToolActive = activeTool !== 'none' || Boolean(isPickingLocation);

  let viewportCursorClass = 'viewport-cursor-default';
  if (isDrawingToolActive) {
    viewportCursorClass = 'viewport-cursor-pencil';
  } else if (activeCursorMode === 'orbit') {
    viewportCursorClass = 'viewport-cursor-orbit';
  } else if (activeCursorMode === 'zoom' || isWheelZooming) {
    viewportCursorClass = 'viewport-cursor-zoom';
  } else if (activeCursorMode === 'pan') {
    viewportCursorClass = 'viewport-cursor-pan';
  } else {
    viewportCursorClass = 'viewport-cursor-default';
  }

  // Force inline cursor styling on Cesium canvas to prevent Cesium's internal cursor resets
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = container.querySelector('canvas');

    const cursorMap: Record<string, string> = {
      'viewport-cursor-default': 'default',
      'viewport-cursor-pan': "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDI4NGM3IiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xOCAxMVY2YTIgMiAwIDAgMC00IDB2NU0xNCAxMFY0YTIgMiAwIDAgMC00IDB2Nk0xMCAxMC41VjVhMiAyIDAgMCAwLTQgMHY5TTYgMTR2LTJhMiAyIDAgMCAwLTQgMHY2YTcgNyAwIDAgMCA3IDdoNGE3IDcgMCAwIDAgNy03di01YTIgMiAwIDAgMC00IDB2MiIvPjwvc3ZnPg==') 12 12, grabbing",
      'viewport-cursor-orbit': "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI5IiBzdHJva2U9IiMwMjg0YzciIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtZGFzaGFycmF5PSIyIDIiLz48ZWxsaXBzZSBjeD0iMTIiIGN5PSIxMiIgcng9IjkiIHJ5PSI0IiBzdHJva2U9IiMzOGJkZjgiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik0yMSAxMmwtMi0ybTIgMmwtMiAyIiBzdHJva2U9IiMzOGJkZjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTMgMTJsMi0ybTItMmwyIDIiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyLjUiIGZpbGw9IiMwMjg0YzciLz48L3N2Zz4=') 16 16, move",
      'viewport-cursor-zoom': "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI3IiBmaWxsPSJyZ2JhKDE0LDE2NSwyMzMsMC4yNSkiIHN0cm9rZT0iIzAyODRjNyIgc3Ryb2tlLXdpZHRoPSIyLjUiLz48bGluZSB4MT0iMTYuNSIgeTE9IjE2LjUiIHgyPSIyMSIgeTI9IjIxIiBzdHJva2U9IiMwMjg0YzciIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGxpbmUgeDE9IjExIiB5MT0iOCIgeDI9IjExIiB5Mj0iMTQiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48bGluZSB4MT0iOCIgeTE9IjExIiB4Mj0iMTQiIHkyPSIxMSIgc3Ryb2tlPSIjMzhiZGY4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==') 11 11, zoom-in",
      'viewport-cursor-pencil': "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cGF0aCBkPSJNMTcgM2EyLjgyOCAyLjgyOCAwIDEgMSA0IDRMNy41IDIwLjUgMiAyMmwxLjUtNS41TDE3IDN6IiBmaWxsPSIjMjU2M2ViIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Im0xNSA1IDQgNCIgc3Ryb2tlPSJ3aXRlIiBzdHJva2Utd2lkdGg9IjEuNSIvPjwvc3ZnPg==') 2 22, crosshair"
    };

    const targetCursor = cursorMap[viewportCursorClass] || 'default';
    if (canvas) {
      canvas.style.setProperty('cursor', targetCursor, 'important');
    }
    container.style.setProperty('cursor', targetCursor, 'important');
  }, [viewportCursorClass]);

  const [loadedTextureImage, setLoadedTextureImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!textureUrl) {
      setLoadedTextureImage(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) {
        setLoadedTextureImage(img);
      }
    };
    img.onerror = () => {
      console.error('Failed to preload textureUrl:', textureUrl);
      if (active) {
        setLoadedTextureImage(null);
      }
    };
    img.src = textureUrl;
    return () => {
      active = false;
    };
  }, [textureUrl]);

  const [isSunAnimating, setIsSunAnimating] = useState(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isVeryLowResHud = windowWidth < 680 || windowHeight < 650;

  // Parcel & Shapefile Dynamic Styling & Filtering State
  const [internalIsParcelStyleOpen, setInternalIsParcelStyleOpen] = useState(false);
  const isParcelStyleOpen = propIsParcelStyleOpen !== undefined ? propIsParcelStyleOpen : internalIsParcelStyleOpen;
  const handleToggleParcelStyle = () => {
    if (propOnToggleParcelStyle) {
      propOnToggleParcelStyle();
    } else {
      setInternalIsParcelStyleOpen(prev => !prev);
    }
  };

  // ArcGIS Aerial Imagery Picker State (Synchronized with Right Sidebar)
  const [internalIsArcGisImageryOpen, setInternalIsArcGisImageryOpen] = useState(false);
  const isArcGisImageryOpen = propIsArcGisImageryOpen !== undefined ? propIsArcGisImageryOpen : internalIsArcGisImageryOpen;
  const handleToggleArcGisImagery = () => {
    if (propOnToggleArcGisImagery) {
      propOnToggleArcGisImagery();
    } else {
      setInternalIsArcGisImageryOpen(prev => !prev);
    }
  };
  const [activeParcelLayerId, setActiveParcelLayerId] = useState<string | undefined>(undefined);

  const gisLayersCount = (gisLayers || []).length;
  const firstGisLayerId = gisLayers?.[0]?.id;

  useEffect(() => {
    if (gisLayersCount > 0 && firstGisLayerId) {
      setActiveParcelLayerId(prev => {
        if (!prev || !(gisLayers || []).some(l => l.id === prev)) {
          return firstGisLayerId;
        }
        return prev;
      });
    }
  }, [gisLayersCount, firstGisLayerId]);
  const isLowResHud = windowWidth < 900 || windowHeight < 750;
  const isMediumResHud = (windowWidth >= 900 && windowWidth <= 1280) || (windowHeight >= 750 && windowHeight < 850);

  // Auto-collapse HUD on very narrow screens (< 800px) to prevent toolbar overlap
  useEffect(() => {
    if (windowWidth < 800) {
      setIsHudCollapsed(true);
    }
  }, [windowWidth]);
  const sunHourRef = useRef(sunHour);
  const selectedLayerIdsRef = useRef(selectedLayerIds);
  useEffect(() => { selectedLayerIdsRef.current = selectedLayerIds; }, [selectedLayerIds]);

  const isCtrlPressedRef = useRef(false);
  const lastClickModifierRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift' || e.ctrlKey || e.metaKey || e.shiftKey) {
        isCtrlPressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        isCtrlPressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.scene.canvas) return;
    const canvas = viewer.scene.canvas;
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const isMod = Boolean(e.ctrlKey || e.metaKey || e.shiftKey);
      lastClickModifierRef.current = isMod;
      if (isMod) {
        isCtrlPressedRef.current = true;
      }
    };
    canvas.addEventListener('pointerdown', handlePointerDown, true);
    canvas.addEventListener('mousedown', handlePointerDown, true);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, true);
      canvas.removeEventListener('mousedown', handlePointerDown, true);
    };
  }, [isInitializing]);

  // High-resolution viewport exporter container size tracking
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(container);

    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    sunHourRef.current = sunHour;
  }, [sunHour]);

  useEffect(() => {
    if (!isSunAnimating) return;

    const interval = setInterval(() => {
      let next = sunHourRef.current + 0.15;
      if (next >= 24) next = 0;
      if (onSunHourChange) {
        onSunHourChange(parseFloat(next.toFixed(2)));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isSunAnimating, onSunHourChange]);

  // Floating measurement marker states
  const markerCartesianRef = useRef<Cesium.Cartesian3 | null>(null);
  const [floatingMarker, setFloatingMarker] = useState<{ x: number; y: number; text: string; visible: boolean } | null>(null);

  // Ortho Mode (F8 toggle) & SketchUp-style numeric length input states
  const [isOrthoMode, setIsOrthoMode] = useState<boolean>(false);
  const orthoModeRef = useRef<boolean>(false);
  orthoModeRef.current = isOrthoMode;

  const [typedLengthStr, setTypedLengthStr] = useState<string>('');
  const typedLengthRef = useRef<string>('');
  typedLengthRef.current = typedLengthStr;

  const lastRawCartesianRef = useRef<Cesium.Cartesian3 | null>(null);

  // Commit typed length point function
  const commitTypedLengthPoint = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || !lastRawCartesianRef.current) return;
    const typedVal = parseFloat(typedLengthRef.current);
    if (isNaN(typedVal) || typedVal <= 0) return;

    const constrained = getConstrainedCandidatePosition(
      lastRawCartesianRef.current,
      clickedPositionsRef.current,
      orthoModeRef.current,
      typedVal
    );

    const activeCartesian = constrained.position;
    setTypedLengthStr('');

    clickedPositionsRef.current.push(activeCartesian);

    const markerColor = 
      activeTool === 'distance' ? '#3b82f6' : 
      activeTool === 'height' ? '#f59e0b' : 
      activeTool === 'view-corridor' ? '#06b6d4' :
      activeTool === 'viewshed' ? '#f59e0b' : '#10b981';

    const marker = viewer.entities.add({
      position: activeCartesian,
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(markerColor),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    measurementEntitiesRef.current.push(marker);

    if (activeTool === 'distance') {
      const totalDist = calculateDistance(clickedPositionsRef.current);
      const formatted = formatDistance(totalDist);
      onMeasureResultChange(`Node added! Path Total: ${formatted} (Right-click to finish drawing)`);
    } else if (activeTool === 'area') {
      if (clickedPositionsRef.current.length >= 3) {
        const totalArea = calculateArea(clickedPositionsRef.current);
        onMeasureResultChange(`Polygon closed! Area: ${formatArea(totalArea)} (Right-click to finalize surface analysis)`);
      } else {
        onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to calculate area.`);
      }
    } else if (activeTool === 'parametric-massing') {
      if (clickedPositionsRef.current.length >= 3) {
        onMeasureResultChange(`Massing boundary closed! ${clickedPositionsRef.current.length} vertices. Right-click to extrude conceptual 3D mass.`);
      } else {
        onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define footprint.`);
      }
    } else if (activeTool === 'subsurface-excavation') {
      if (clickedPositionsRef.current.length >= 3) {
        onMeasureResultChange(`Excavation boundary closed! ${clickedPositionsRef.current.length} vertices. Right-click to trigger 3D excavation pit.`);
      } else {
        onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define excavation footprint.`);
      }
    } else if (activeTool === 'boundary') {
      if (clickedPositionsRef.current.length >= 3) {
        onMeasureResultChange(`Boundary polygon closed! ${clickedPositionsRef.current.length} vertices. Right-click to finalize and apply spatial mask.`);
      } else {
        onMeasureResultChange(`Added ${clickedPositionsRef.current.length} boundary vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define mask area.`);
      }
    }

    viewer.scene.requestRender();
  }, [activeTool, onMeasureResultChange]);

  // Handle F8 Ortho toggle and CAD numeric typing keyboard events
  useEffect(() => {
    if (!['area', 'parametric-massing', 'subsurface-excavation', 'boundary', 'distance'].includes(activeTool)) {
      setTypedLengthStr('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Ortho Mode on F8
      if (e.key === 'F8') {
        e.preventDefault();
        orthoModeRef.current = !orthoModeRef.current;
        setIsOrthoMode(orthoModeRef.current);
        if (viewerRef.current) {
          viewerRef.current.scene.requestRender();
        }
        return;
      }

      // Check if user is typing in an input or textarea element
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }

      // Numeric input (digits or decimal point)
      if (/^[0-9.]$/.test(e.key)) {
        if (e.key === '.' && typedLengthRef.current.includes('.')) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        setTypedLengthStr(prev => prev + e.key);
        return;
      }

      if (e.key === 'Backspace') {
        if (typedLengthRef.current.length > 0) {
          e.preventDefault();
          setTypedLengthStr(prev => prev.slice(0, -1));
        }
        return;
      }

      if (e.key === 'Escape') {
        if (typedLengthRef.current.length > 0) {
          e.preventDefault();
          setTypedLengthStr('');
        }
        return;
      }

      if (e.key === 'Enter') {
        if (typedLengthRef.current.length > 0 && !isNaN(parseFloat(typedLengthRef.current))) {
          e.preventDefault();
          commitTypedLengthPoint();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTool, commitTypedLengthPoint]);

  // Line-of-Sight View Corridor Analysis Result State
  const [viewCorridorResult, setViewCorridorResult] = useState<{
    distance: number;
    status: 'Clear' | 'Blocked';
    obstructionHeight?: number;
    obstructionDistance?: number;
    observerHeight: number;
    targetHeight: number;
  } | null>(null);

  // Keep track of layers in Cesium to toggle on/off (split into Left/Right for compare)
  const leftBuildingsTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const rightBuildingsTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const isLoadingLeftBuildingsRef = useRef<boolean>(false);
  const isLoadingRightBuildingsRef = useRef<boolean>(false);
  const leftGoogleTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const rightGoogleTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const landmarksEntitiesRef = useRef<Cesium.Entity[]>([]);
  const overpassDataSourceRef = useRef<Cesium.CustomDataSource | null>(null);
  const flightPathsEntitiesRef = useRef<Cesium.Entity[]>([]);
  const drapePrimitiveRef = useRef<Cesium.GroundPrimitive | null>(null);
  const gisLayersDrapePrimitivesRef = useRef<Map<string, Cesium.GroundPrimitive>>(new Map());
  const sunlightHeatmapPrimitiveRef = useRef<Cesium.Entity | Cesium.GroundPrimitive | Cesium.ImageryLayer | null>(null);
  const clippingCollectionRef = useRef<Cesium.ClippingPolygonCollection | null>(null);
  const activeClippingConfigRef = useRef<{
    positionsList: Cesium.Cartesian3[][];
    inverse: boolean;
    enabled: boolean;
  }>({ positionsList: [], inverse: false, enabled: false });

  // Safe factory producing an independent ClippingPolygonCollection instance for a single tileset
  const createClippingCollectionForTileset = (
    positionsList: Cesium.Cartesian3[][],
    inverse: boolean
  ): Cesium.ClippingPolygonCollection | undefined => {
    if (!positionsList || positionsList.length === 0) return undefined;
    try {
      const polyList: Cesium.ClippingPolygon[] = [];
      positionsList.forEach((pos) => {
        if (pos && pos.length >= 3) {
          polyList.push(
            new Cesium.ClippingPolygon({
              positions: pos.map((p) => Cesium.Cartesian3.clone(p))
            })
          );
        }
      });
      if (polyList.length === 0) return undefined;
      return new Cesium.ClippingPolygonCollection({
        polygons: polyList,
        inverse: inverse,
        enabled: true
      });
    } catch (err) {
      console.warn('Could not create ClippingPolygonCollection for tileset:', err);
      return undefined;
    }
  };

  // Safe applicator ensuring every tileset gets its own fresh collection, avoiding single-owner DeveloperError
  const applyClippingToTilesetInstance = (
    tileset: Cesium.Cesium3DTileset | null | undefined,
    positionsList?: Cesium.Cartesian3[][],
    inverse?: boolean,
    enabled?: boolean
  ) => {
    if (!tileset || tileset.isDestroyed?.()) return;
    try {
      const cfg = activeClippingConfigRef.current;
      const posList = positionsList !== undefined ? positionsList : cfg.positionsList;
      const isInv = inverse !== undefined ? inverse : cfg.inverse;
      const isEnabled = enabled !== undefined ? enabled : cfg.enabled;

      if (!isEnabled || !posList || posList.length === 0) {
        tileset.clippingPolygons = undefined as any;
      } else {
        const collection = createClippingCollectionForTileset(posList, isInv);
        tileset.clippingPolygons = collection || (undefined as any);
      }
    } catch (err) {
      console.warn('Error assigning clippingPolygons to tileset instance:', err);
    }
  };
  const googleLabelsLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  // My Cesium Ion Assets Refs
  const customTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const customImageryLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  // Measurement tracking refs
  const measurementEntitiesRef = useRef<Cesium.Entity[]>([]);
  const clickedPositionsRef = useRef<Cesium.Cartesian3[]>([]);
  const tempMousePosRef = useRef<Cesium.Cartesian3 | null>(null);
  
  // Volumetric View Corridor tracking refs
  const viewCorridorEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Shapefile Visual Dashboard Refs and States
  const shapefileEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Multi-Layer GIS Manager Refs
  const gisLayersEntitiesRef = useRef<Map<string, Cesium.Entity[]>>(new Map());
  const gisLayersPrimitivesRef = useRef<Map<string, Cesium.GroundPrimitive>>(new Map());
  const gisLayersCatchmentPrimitivesRef = useRef<Map<string, Cesium.GroundPrimitive>>(new Map());

  // 3D Model Importer Ref
  const modelEntityRef = useRef<Cesium.Entity | null>(null);
  const legacyModelEntityRef = useRef<Cesium.Entity | null>(null);

  // 24-Hour Solar Path ref
  const solarPathEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Subsurface excavation and utilities refs
  const utilityEntitiesRef = useRef<Cesium.Entity[]>([]);
  const excavationEntitiesRef = useRef<Cesium.Entity[]>([]);
  const excavationClippingCollectionRef = useRef<Cesium.ClippingPolygonCollection | null>(null);
  const activeExcavationPositionsRef = useRef<Cesium.Cartesian3[] | null>(null);

  // Keep track of latest props to prevent re-running camera flight effects on date/hour changes
  const selectedPresetRef = useRef(selectedPreset);
  selectedPresetRef.current = selectedPreset;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const shapefileHeightMultiplierRef = useRef(shapefileHeightMultiplier);
  shapefileHeightMultiplierRef.current = shapefileHeightMultiplier;
  
  const onModelLatitudeChangeRef = useRef(onModelLatitudeChange);
  onModelLatitudeChangeRef.current = onModelLatitudeChange;
  const onModelLongitudeChangeRef = useRef(onModelLongitudeChange);
  onModelLongitudeChangeRef.current = onModelLongitudeChange;
  const onModelHeightChangeRef = useRef(onModelHeightChange);
  onModelHeightChangeRef.current = onModelHeightChange;
  
  const onIsPickingLocationChangeRef = useRef(onIsPickingLocationChange);
  onIsPickingLocationChangeRef.current = onIsPickingLocationChange;

  const onViewportCenterChangeRef = useRef(onViewportCenterChange);
  onViewportCenterChangeRef.current = onViewportCenterChange;

  const activeAnalysisCenterRef = useRef(activeAnalysisCenter);
  activeAnalysisCenterRef.current = activeAnalysisCenter;
  const onActiveAnalysisCenterChangeRef = useRef(onActiveAnalysisCenterChange);
  onActiveAnalysisCenterChangeRef.current = onActiveAnalysisCenterChange;
  const solarPathEnabledRef = useRef(solarPathEnabled);
  solarPathEnabledRef.current = solarPathEnabled;
  const placedTreesRef = useRef(placedTrees);
  placedTreesRef.current = placedTrees;
  const boundaryShapeRef = useRef(boundaryShape);
  boundaryShapeRef.current = boundaryShape;
  const boundaryRadiusRef = useRef(boundaryRadius);
  boundaryRadiusRef.current = boundaryRadius;
  const isDraggingSolarGizmoRef = useRef(false);

  const getViewportCenterPosition = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return null;
    try {
      const canvas = viewer.canvas;
      if (!canvas) return null;
      const centerPixel = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const ray = viewer.camera.getPickRay(centerPixel);
      let pickPos: Cesium.Cartesian3 | undefined;
      if (ray) {
        pickPos = viewer.scene.globe.pick(ray, viewer.scene);
      }
      if (!pickPos) {
        pickPos = viewer.camera.pickEllipsoid(centerPixel);
      }
      if (pickPos) {
        const carto = Cesium.Cartographic.fromCartesian(pickPos);
        if (carto) {
          return {
            latitude: Cesium.Math.toDegrees(carto.latitude),
            longitude: Cesium.Math.toDegrees(carto.longitude),
            height: activeAnalysisCenterRef.current?.height ?? 0 // Default Mean Sea Level
          };
        }
      }
    } catch (e) {
      console.warn("Failed calculating viewport center:", e);
    }
    return null;
  }, []);

  const getCurrentCamera = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return null;
    try {
      const camera = viewer.camera;
      const carto = Cesium.Cartographic.fromCartesian(camera.position);
      return {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        heading: Cesium.Math.toDegrees(camera.heading),
        pitch: Cesium.Math.toDegrees(camera.pitch),
        roll: Cesium.Math.toDegrees(camera.roll),
        longitude: Cesium.Math.toDegrees(carto.longitude),
        latitude: Cesium.Math.toDegrees(carto.latitude),
        height: carto.height
      };
    } catch (e) {
      console.warn("Failed getting current camera:", e);
      return null;
    }
  }, []);

  const handleRestoreCamera = useCallback((cam: any) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !cam) return;
    try {
      if (cam.longitude !== undefined && cam.latitude !== undefined) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(cam.longitude, cam.latitude, cam.height || 500),
          orientation: {
            heading: Cesium.Math.toRadians(cam.heading || 0),
            pitch: Cesium.Math.toRadians(cam.pitch || -45),
            roll: Cesium.Math.toRadians(cam.roll || 0)
          },
          duration: 1.5
        });
      } else if (cam.position) {
        viewer.camera.flyTo({
          destination: new Cesium.Cartesian3(cam.position.x, cam.position.y, cam.position.z),
          orientation: {
            heading: Cesium.Math.toRadians(cam.heading || 0),
            pitch: Cesium.Math.toRadians(cam.pitch || -45),
            roll: Cesium.Math.toRadians(cam.roll || 0)
          },
          duration: 1.5
        });
      }
    } catch (e) {
      console.warn("Failed restoring camera:", e);
    }
  }, []);

  const handleRestoreStoredLayer = useCallback((layer: StoredLayer) => {
    if (layer.type === 'point_trees' && Array.isArray(layer.payload)) {
      if (onPlacedTreesChange) {
        onPlacedTreesChange(layer.payload);
      }
      if (layer.style?.treeGlbUrl && onTreeModelUrlChange) {
        onTreeModelUrlChange(layer.style.treeGlbUrl);
      }
    } else if (layer.type === 'model' && layer.payload?.url) {
      if (onModelUrlChange) {
        onModelUrlChange(layer.payload.url, layer.name);
      }
      if (layer.payload.latitude !== undefined && onModelLatitudeChange) {
        onModelLatitudeChange(layer.payload.latitude);
      }
      if (layer.payload.longitude !== undefined && onModelLongitudeChange) {
        onModelLongitudeChange(layer.payload.longitude);
      }
      if (layer.payload.height !== undefined && onModelHeightChange) {
        onModelHeightChange(layer.payload.height);
      }
    }
  }, [onPlacedTreesChange, onTreeModelUrlChange, onModelUrlChange, onModelLatitudeChange, onModelLongitudeChange, onModelHeightChange]);

  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const isApplyingExternalCameraRef = useRef(false);
  const lastEmittedCameraRef = useRef<{ destination: Cesium.Cartesian3; heading: number; pitch: number; roll: number } | null>(null);

  const importedLayersRef = useRef(importedLayers);
  importedLayersRef.current = importedLayers;
  const activeLayerIdRef = useRef(activeLayerId);
  activeLayerIdRef.current = activeLayerId;
  
  interface HoveredTooltip {
    x: number;
    y: number;
    label: string;
    metric: string;
    value: number | string;
    properties: Record<string, any>;
  }
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltip | null>(null);

  interface HoveredPOITooltip {
    x: number;
    y: number;
    name: string;
    type: string;
    coordinates: string;
  }
  const [hoveredPOITooltip, setHoveredPOITooltip] = useState<HoveredPOITooltip | null>(null);
  const hoveredPOIEntityRef = useRef<Cesium.Entity | null>(null);

  const [localExcavationStats, setLocalExcavationStats] = useState<{
    area: number;
    depth: number;
    volume: number;
    perimeter: number;
    weight: number;
    truckloads: number;
  } | null>(null);

  // Camera dynamic coordinates state for bottom status bar
  const [cameraPos, setCameraPos] = useState({
    lat: selectedPreset ? selectedPreset.latitude : 37.774929,
    lng: selectedPreset ? selectedPreset.longitude : -122.419416,
    alt: selectedPreset ? selectedPreset.height : 452.1
  });

  const [cameraHeading, setCameraHeading] = useState(0); // Camera heading in degrees

  const effectiveFov = viewCorridorSimulationActive ? viewCorridorFovY : fovAngle;

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

  const getMetricColor = (value: number, min: number, max: number) => {
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

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    setIsInitializing(true);
    setErrorMsg(null);

    let canvas: HTMLCanvasElement | null = null;
    let handleContextLost: ((e: Event) => void) | null = null;
    let handleContextRestored: (() => void) | null = null;

    // Explicit Token Enforcement: Assign Cesium.Ion.defaultAccessToken immediately before new Cesium.Viewer()
    const activeIonToken = (isValidCesiumToken(token) ? token : null) ||
      import.meta.env.VITE_CESIUM_ION_TOKEN ||
      import.meta.env.VITE_CESIUM_TOKEN ||
      initialDefaultToken ||
      '';
    Cesium.Ion.defaultAccessToken = activeIonToken;

    let viewer: Cesium.Viewer;
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: true,
        sceneModePicker: false,
        selectionIndicator: true,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        baseLayerPicker: false, // Custom implementation in sidebar
        baseLayer: false, // Disable default Ion-dependent imagery to prevent startup crashes when token is null
        shadows: true,
        // Optimal rendering options
        requestRenderMode: true, // Only render when scene changes for CPU savings
        maximumRenderTimeChange: 0.1,
        contextOptions: {
          webgl: {
            preserveDrawingBuffer: true,
          }
        },
      });

      // Enable depth testing against terrain so structures sink behind peaks correctly
      viewer.scene.globe.depthTestAgainstTerrain = true;

      // Enable core globe lighting and High Dynamic Range for realistic day-night shading
      viewer.scene.globe.enableLighting = true; // CRITICAL: Gives the GPU normal vectors to compute terrain steepness
      viewer.scene.globe.showWaterEffect = false;
      viewer.scene.highDynamicRange = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.globe.dynamicAtmosphereLighting = true;
      
      // Initialize optimized shadow settings to completely avoid shadow acne moiré/striping
      if (viewer.scene.shadowMap) {
        const sm = viewer.scene.shadowMap as any;
        sm.bias = shadowBias !== undefined ? shadowBias : 0.005;
        sm.normalOffsetBias = normalOffsetBias !== undefined ? normalOffsetBias : 0.5;
        sm.normalOffset = true;
      }

      // Add WebGL Context Loss & Restoration Engine listeners to intercept GPU context loss gracefully
      canvas = viewer.canvas;
      if (canvas) {
        handleContextLost = (e: Event) => {
          e.preventDefault();
          console.warn('WebGL context lost intercepted. Preventing application crash or state reset.');
        };
        handleContextRestored = () => {
          console.info('WebGL context restored. Triggering scene re-render to restore shader contexts.');
          try {
            if (viewerRef.current && !viewerRef.current.isDestroyed() && viewerRef.current.scene && !viewerRef.current.scene.isDestroyed()) {
              viewerRef.current.scene.requestRender();
            }
          } catch (err) {
            console.warn('Failed to re-render scene after WebGL context restored:', err);
          }
        };
        canvas.addEventListener('webglcontextlost', handleContextLost, false);
        canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
      }

      // Safe wrapper callback helper for camera flight callbacks
      const safeFlightCallback = (cb?: () => void) => () => {
        try {
          if (cb) cb();
        } catch (e) {
          console.warn('Flight callback error handled gracefully:', e);
        }
      };

      // Safe wrapper for camera flyTo to prevent unhandled promise rejections on flight cancellation or packet delay
      const originalFlyTo = viewer.camera.flyTo.bind(viewer.camera);
      viewer.camera.flyTo = function(options: any) {
        try {
          if (viewer.scene && !viewer.scene.isDestroyed()) {
            viewer.scene.requestRender();
          }
          const safeOptions = {
            ...options,
            complete: safeFlightCallback(options?.complete),
            cancel: safeFlightCallback(options?.cancel)
          };
          const promise = originalFlyTo(safeOptions);
          if (promise && typeof promise.catch === 'function') {
            return promise.catch((err: any) => {
              console.warn('Camera flight cancelled or failed:', err);
            });
          }
          return promise;
        } catch (e) {
          console.warn('Camera flight initialization failed:', e);
          return Promise.resolve();
        }
      } as any;

      const originalFlyToBoundingSphere = viewer.camera.flyToBoundingSphere.bind(viewer.camera);
      viewer.camera.flyToBoundingSphere = function(boundingSphere: any, options: any) {
        try {
          if (viewer.scene && !viewer.scene.isDestroyed()) {
            viewer.scene.requestRender();
          }
          const safeOptions = {
            ...options,
            complete: safeFlightCallback(options?.complete),
            cancel: safeFlightCallback(options?.cancel)
          };
          const promise = originalFlyToBoundingSphere(boundingSphere, safeOptions);
          if (promise && typeof promise.catch === 'function') {
            return promise.catch((err: any) => {
              console.warn('Camera flight to bounding sphere cancelled or failed:', err);
            });
          }
          return promise;
        } catch (e) {
          console.warn('Camera flight to bounding sphere initialization failed:', e);
          return Promise.resolve();
        }
      } as any;

      const originalViewerFlyTo = viewer.flyTo.bind(viewer);
      viewer.flyTo = function(target: any, options: any) {
        try {
          if (viewer.scene && !viewer.scene.isDestroyed()) {
            viewer.scene.requestRender();
          }
          const safeOptions = {
            ...options,
            complete: safeFlightCallback(options?.complete),
            cancel: safeFlightCallback(options?.cancel)
          };
          const promise = originalViewerFlyTo(target, safeOptions);
          if (promise && typeof promise.catch === 'function') {
            return promise.catch((err: any) => {
              console.warn('Viewer flight cancelled or failed:', err);
            });
          }
          return promise;
        } catch (e) {
          console.warn('Viewer flight initialization failed:', e);
          return Promise.resolve();
        }
      } as any;

      if (viewer.scene && viewer.scene.clampToHeightMostDetailed) {
        const originalClamp = viewer.scene.clampToHeightMostDetailed.bind(viewer.scene);
        viewer.scene.clampToHeightMostDetailed = function(coordinates: any, objectsToExclude: any, width: any) {
          try {
            const promise = originalClamp(coordinates, objectsToExclude, width);
            if (promise && typeof promise.catch === 'function') {
              return promise.catch((err: any) => {
                console.warn('clampToHeightMostDetailed failed:', err);
                return coordinates; // Return original coordinates as fallback
              });
            }
            return promise;
          } catch (e) {
            console.warn('clampToHeightMostDetailed invocation failed:', e);
            return Promise.resolve(coordinates);
          }
        } as any;
      }

      // Configure WebGL Pixel Store Unpack Alignment
      viewer.scene.preRender.addEventListener(() => {
        const sceneAny = viewer.scene as any;
        if (sceneAny && sceneAny.context && sceneAny.context._gl) {
          const gl = sceneAny.context._gl;
          try {
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          } catch (_) {}
        }
      });
      
      viewerRef.current = viewer;
      (window as any).cesiumViewer = viewer;
      setViewerInstance(viewer);

      // Theme adaptive styling hook for Cesium InfoBox
      viewer.selectedEntityChanged.addEventListener((entity) => {
        if (entity) {
          if (measurementEntitiesRef.current.includes(entity) || (entity as any).isMeasurement || !entity.description) {
            viewer.selectedEntity = undefined;
            return;
          }
          setTimeout(() => {
            const iframe = document.querySelector('.cesium-infoBox-iframe') as HTMLIFrameElement;
            if (iframe && iframe.contentDocument) {
              const head = iframe.contentDocument.head;
              const body = iframe.contentDocument.body;
              if (head && body) {
                let styleTag = iframe.contentDocument.getElementById('cesium-custom-theme-style');
                if (!styleTag) {
                  styleTag = iframe.contentDocument.createElement('style');
                  styleTag.id = 'cesium-custom-theme-style';
                  head.appendChild(styleTag);
                }

                const isLight = document.querySelector('.sidebar-theme-light') !== null;
                
                if (isLight) {
                  styleTag.textContent = `
                    body {
                      color: #0f172a !important;
                      background-color: transparent !important;
                      font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important;
                      font-size: 13px !important;
                      line-height: 1.6 !important;
                      margin: 0 !important;
                      padding: 8px !important;
                    }
                    .cesium-infoBox-defaultTable {
                      width: 100% !important;
                      border-collapse: collapse !important;
                      margin-top: 10px !important;
                      font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important;
                    }
                    .cesium-infoBox-defaultTable tr {
                      border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
                    }
                    .cesium-infoBox-defaultTable tr:last-child {
                      border-bottom: none !important;
                    }
                    .cesium-infoBox-defaultTable tr:nth-child(odd) {
                      background-color: rgba(15, 23, 42, 0.02) !important;
                    }
                    .cesium-infoBox-defaultTable tr:nth-child(even) {
                      background-color: rgba(255, 255, 255, 0.8) !important;
                    }
                    .cesium-infoBox-defaultTable td {
                      padding: 8px 12px !important;
                      font-size: 11.5px !important;
                      color: #334155 !important;
                    }
                    .cesium-infoBox-defaultTable td.cesium-infoBox-defaultTable-header {
                      font-family: "JetBrains Mono", monospace !important;
                      font-weight: 500 !important;
                      color: #0284c7 !important; /* sky-600 */
                      background-color: rgba(2, 132, 199, 0.06) !important;
                      text-transform: uppercase !important;
                      font-size: 10px !important;
                      letter-spacing: 0.05em !important;
                      width: 35% !important;
                      min-width: 80px !important;
                    }
                    a {
                      color: #0284c7 !important;
                      text-decoration: none !important;
                    }
                    a:hover {
                      text-decoration: underline !important;
                    }
                  `;
                } else {
                  styleTag.textContent = `
                    body {
                      color: #f1f5f9 !important;
                      background-color: transparent !important;
                      font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important;
                      font-size: 13px !important;
                      line-height: 1.6 !important;
                      margin: 0 !important;
                      padding: 8px !important;
                    }
                    .cesium-infoBox-defaultTable {
                      width: 100% !important;
                      border-collapse: collapse !important;
                      margin-top: 10px !important;
                      font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important;
                    }
                    .cesium-infoBox-defaultTable tr {
                      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
                    }
                    .cesium-infoBox-defaultTable tr:last-child {
                      border-bottom: none !important;
                    }
                    .cesium-infoBox-defaultTable tr:nth-child(odd) {
                      background-color: rgba(255, 255, 255, 0.02) !important;
                    }
                    .cesium-infoBox-defaultTable tr:nth-child(even) {
                      background-color: rgba(0, 0, 0, 0.15) !important;
                    }
                    .cesium-infoBox-defaultTable td {
                      padding: 8px 12px !important;
                      font-size: 11.5px !important;
                      color: #cbd5e1 !important;
                    }
                    .cesium-infoBox-defaultTable td.cesium-infoBox-defaultTable-header {
                      font-family: "JetBrains Mono", monospace !important;
                      font-weight: 500 !important;
                      color: #38bdf8 !important; /* sky-400 */
                      background-color: rgba(56, 189, 248, 0.06) !important;
                      text-transform: uppercase !important;
                      font-size: 10px !important;
                      letter-spacing: 0.05em !important;
                      width: 35% !important;
                      min-width: 80px !important;
                    }
                    a {
                      color: #38bdf8 !important;
                      text-decoration: none !important;
                    }
                    a:hover {
                      text-decoration: underline !important;
                    }
                  `;
                }
                body.style.backgroundColor = 'transparent';
              }
            }
          }, 80);
        }
      });

      setIsInitializing(false);

      // Default to EllipsoidTerrainProvider on initialization (Terrain is off by default)
      if (viewer && !viewer.isDestroyed() && viewer.scene) {
        viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }
    } catch (err: any) {
      console.error('Cesium failed to initialize:', err);
      setErrorMsg(err.message || 'WebGL context initialization failed. Your browser or hardware may not support WebGL.');
      setIsInitializing(false);
      return;
    }

    // Tear down viewer on unmount (prevents memory leaks and duplicate canvases)
    return () => {
      if (canvas && handleContextLost && handleContextRestored) {
        try {
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        } catch (_) {}
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      setViewerInstance(null);
    };
  }, [token]);

  // Update Imagery Basemaps Style
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const isGoogleEnabled = layers.find(l => l.id === 'google-3d-tiles')?.enabled;
    const imageryLayers = viewer.imageryLayers;
    imageryLayers.removeAll();
    googleLabelsLayerRef.current = null;

    try {
      const activeToken = (isValidCesiumToken(token) ? token : null) ||
        import.meta.env.VITE_CESIUM_ION_TOKEN ||
        import.meta.env.VITE_CESIUM_TOKEN ||
        initialDefaultToken ||
        '';
      if (activeToken) {
        Cesium.Ion.defaultAccessToken = activeToken;
      }

      if (globeState.style === 'satellite') {
        // High-Resolution Satellite / Bing Aerial (Ion Asset ID 2)
        imageryLayers.removeAll();
        Cesium.IonImageryProvider.fromAssetId(2)
          .then(provider => {
            if (viewerRef.current === viewer) {
              const layer = imageryLayers.addImageryProvider(provider, 0);
              if (isGoogleEnabled) layer.show = false;
              recreateLabelsLayer();
            }
          })
          .catch(() => {
            if (viewerRef.current === viewer && !viewer.isDestroyed()) {
              imageryLayers.removeAll();
              const fallback = new Cesium.UrlTemplateImageryProvider({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                credit: 'Esri, Maxar, Earthstar Geographics',
                maximumLevel: 19
              });
              const layer = imageryLayers.addImageryProvider(fallback, 0);
              if (isGoogleEnabled) layer.show = false;
              recreateLabelsLayer();
            }
          });
      } else if (globeState.style === 'dark') {
        // Dark Mode: CartoDB Dark Matter
        imageryLayers.removeAll();
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          credit: '© OpenStreetMap, © CARTO'
        });
        const layer = imageryLayers.addImageryProvider(provider, 0);
        if (isGoogleEnabled) layer.show = false;
        recreateLabelsLayer();
      } else if (globeState.style === 'streets') {
        // Street Mode: CartoDB Voyager
        imageryLayers.removeAll();
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          credit: '© OpenStreetMap, © CARTO'
        });
        const layer = imageryLayers.addImageryProvider(provider, 0);
        if (isGoogleEnabled) layer.show = false;
        recreateLabelsLayer();
      } else {
        // Topo/Standard Mode: OpenStreetMap Standard
        imageryLayers.removeAll();
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          credit: '© OpenTopoMap, © OpenStreetMap'
        });
        const layer = imageryLayers.addImageryProvider(provider, 0);
        if (isGoogleEnabled) layer.show = false;
        recreateLabelsLayer();
      }
    } catch (e) {
      console.error('Error switching imagery styles:', e);
    }

    function recreateLabelsLayer() {
      if (googleLabelsLayerRef.current) {
        try {
          imageryLayers.remove(googleLabelsLayerRef.current);
        } catch (_) {}
        googleLabelsLayerRef.current = null;
      }

      const labelProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
        subdomains: ['0', '1', '2', '3'],
        minimumLevel: 0,
        maximumLevel: 20,
        credit: '© Google'
      });
      const labelLayer = imageryLayers.addImageryProvider(labelProvider);
      googleLabelsLayerRef.current = labelLayer;
      labelLayer.show = isGoogleEnabled ? false : googleLabelsEnabled;
      labelLayer.alpha = googleLabelsAlpha;
      
      imageryLayers.raiseToTop(labelLayer);
    }
  }, [globeState.style, token, googleLabelsEnabled, googleLabelsAlpha, layers]);

  // Handle Split Screen swipe positions and splitDirections for Imagery & GroundPrimitive
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (swipeEnabled) {
      viewer.scene.splitPosition = swipePosition / 100.0;
    } else {
      viewer.scene.splitPosition = 1.0;
    }
    viewer.scene.requestRender();
  }, [swipePosition, swipeEnabled]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Apply splitDirection dynamically to all imagery layers
    const imageryLayers = viewer.imageryLayers;
    const count = imageryLayers.length;
    for (let i = 0; i < count; i++) {
      const layer = imageryLayers.get(i);
      layer.splitDirection = swipeEnabled 
        ? Cesium.SplitDirection.LEFT 
        : Cesium.SplitDirection.NONE;
    }

    // Apply splitDirection to drape ground primitives
    if (drapePrimitiveRef.current) {
      drapePrimitiveRef.current.splitDirection = swipeEnabled
        ? Cesium.SplitDirection.RIGHT
        : Cesium.SplitDirection.NONE;
    }
    gisLayersDrapePrimitivesRef.current.forEach((prim) => {
      if (prim) {
        prim.splitDirection = swipeEnabled
          ? Cesium.SplitDirection.RIGHT
          : Cesium.SplitDirection.NONE;
      }
    });

    viewer.scene.requestRender();
  }, [swipeEnabled, globeState.style, layers, polygonData]);

  // Update Atmosphere and Fog
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.scene.skyAtmosphere.show = globeState.atmosphereEnabled;
    viewer.scene.fog.enabled = globeState.fogEnabled;
    viewer.scene.globe.showGroundAtmosphere = globeState.atmosphereEnabled;
    viewer.scene.requestRender();
  }, [globeState.atmosphereEnabled, globeState.fogEnabled]);

  // Update 3D Terrain Elevation (Unified to avoid race conditions between world terrain and custom Ion terrain)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || viewer.isDestroyed()) return;

    if (globeState.terrainEnabled) {
      if (ionAssets?.terrainEnabled && ionAssets?.terrainId) {
        const assetId = Number(ionAssets.terrainId);
        if (isNaN(assetId)) {
          if (onIonAssetError) {
            onIonAssetError('Invalid Terrain Asset ID. Must be a numeric ID.');
          }
          console.warn('Invalid Terrain Asset ID:', ionAssets.terrainId);
          if (viewer && !viewer.isDestroyed() && viewer.scene) {
            viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
            viewer.scene.requestRender();
          }
          return;
        }

        Cesium.IonResource.fromAssetId(assetId)
          .then(resource => {
            return Cesium.CesiumTerrainProvider.fromUrl(resource);
          })
          .then(terrainProvider => {
            if (viewerRef.current === viewer && viewer && !viewer.isDestroyed() && viewer.scene) {
              viewer.scene.terrainProvider = terrainProvider;
              if (onIonAssetError) {
                onIonAssetError(null); // Clear error on success
              }
              
              // Note: Automatic flyTo disabled to maintain camera view during loading
              viewer.scene.requestRender();
            }
          })
          .catch(err => {
            if (onIonAssetError) {
              onIonAssetError(`Failed to load custom Ion Terrain ${assetId}: ${err.message || err}`);
            }
            console.warn('Failed to load custom Ion Terrain:', err);
            // Fallback to standard world terrain
            Cesium.CesiumTerrainProvider.fromUrl(Cesium.IonResource.fromAssetId(1))
              .then(terrainProvider => {
                if (viewerRef.current === viewer && viewer && !viewer.isDestroyed() && viewer.scene) {
                  viewer.scene.terrainProvider = terrainProvider;
                  viewer.scene.requestRender();
                }
              })
              .catch(() => {
                if (viewerRef.current === viewer && viewer && !viewer.isDestroyed() && viewer.scene) {
                  viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                  viewer.scene.requestRender();
                }
              });
          });
      } else {
        // Standard World Terrain
        Cesium.CesiumTerrainProvider.fromUrl(Cesium.IonResource.fromAssetId(1))
          .then(terrainProvider => {
            if (viewerRef.current === viewer && viewer && !viewer.isDestroyed() && viewer.scene) {
              viewer.scene.terrainProvider = terrainProvider;
              viewer.scene.requestRender();
            }
          })
          .catch((err) => {
            console.warn('Failed to load terrain provider, falling back to ellipsoid:', err.message || err);
            // Fallback to standard ellipsoid
            if (viewerRef.current === viewer && viewer && !viewer.isDestroyed() && viewer.scene) {
              viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
              viewer.scene.requestRender();
            }
          });
      }
    } else {
      // Disable terrain (flat earth)
      if (viewer && !viewer.isDestroyed() && viewer.scene) {
        viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        viewer.scene.requestRender();
      }
    }
  }, [globeState.terrainEnabled, token, ionAssets?.terrainId, ionAssets?.terrainEnabled, isInitializing, onIonAssetError]);

  // Update 3D Buildings Layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    let active = true;

    // Ensure valid Cesium Ion token is attached prior to requesting OSM buildings
    const effectiveToken = (isValidCesiumToken(token) ? token : null) ||
      import.meta.env.VITE_CESIUM_ION_TOKEN ||
      import.meta.env.VITE_CESIUM_TOKEN ||
      DEFAULT_CESIUM_ION_TOKEN;

    if (isValidCesiumToken(effectiveToken)) {
      Cesium.Ion.defaultAccessToken = effectiveToken;
    }

    const isGoogleEnabled = layers.find(l => l.id === 'google-3d-tiles')?.enabled;
    const shouldShowOsm = !isGoogleEnabled && !!globeState.buildings3dEnabled;

    const activeCustomShader = createBuildingCustomShader(
      globeState.buildingShaderMode,
      globeState.buildingCustomShaderText,
      globeState.buildingSilhouetteColor
    );

    // Helper to load OSM Buildings via createOsmBuildingsAsync or fromIonAssetId(96188)
    const loadOsmTileset = async () => {
      if (typeof Cesium.createOsmBuildingsAsync === 'function') {
        return await Cesium.createOsmBuildingsAsync();
      }
      if (typeof (Cesium.Cesium3DTileset as any).fromIonAssetId === 'function') {
        const options = isValidCesiumToken(effectiveToken) ? { accessToken: effectiveToken } : undefined;
        return await (Cesium.Cesium3DTileset as any).fromIonAssetId(96188, options);
      }
      throw new Error('No method available to load Cesium OSM Buildings');
    };

    if (!shouldShowOsm) {
      // Instantly hide both tilesets without destroying them (keeps cached tiles and avoids async reloading latency)
      if (rightBuildingsTilesetRef.current) {
        rightBuildingsTilesetRef.current.show = false;
      }
      if (leftBuildingsTilesetRef.current) {
        leftBuildingsTilesetRef.current.show = false;
      }
      if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed()) {
        viewer.scene.requestRender();
      }
      return;
    }

    // shouldShowOsm is TRUE:
    // 1. Left unmodified buildings (only visible if swipe compare is active)
    if (swipeEnabled) {
      if (leftBuildingsTilesetRef.current) {
        leftBuildingsTilesetRef.current.show = true;
        leftBuildingsTilesetRef.current.splitDirection = Cesium.SplitDirection.LEFT;
        leftBuildingsTilesetRef.current.shadows = sunShadowsEnabled 
          ? Cesium.ShadowMode.ENABLED 
          : Cesium.ShadowMode.DISABLED;
        if (activeCustomShader) {
          (leftBuildingsTilesetRef.current as any).customShader = activeCustomShader;
        }
      } else if (!isLoadingLeftBuildingsRef.current) {
        isLoadingLeftBuildingsRef.current = true;
        loadOsmTileset()
          .then(tileset => {
            isLoadingLeftBuildingsRef.current = false;
            if (active && viewerRef.current === viewer && !viewer.isDestroyed()) {
              leftBuildingsTilesetRef.current = tileset;
              (tileset as any).maximumMemoryUsage = 256;
              (tileset as any).dynamicScreenSpaceError = true;
              (tileset as any).preloadWhenHidden = false;
              if ((tileset as any).errorEvent) {
                (tileset as any).errorEvent.addEventListener((err: any) => {
                  console.warn('OSM Buildings Left Tileset error gracefully caught:', err);
                });
              }
              tileset.splitDirection = Cesium.SplitDirection.LEFT;
              tileset.shadows = sunShadowsEnabled 
                ? Cesium.ShadowMode.ENABLED 
                : Cesium.ShadowMode.DISABLED;
              if (activeCustomShader) {
                (tileset as any).customShader = activeCustomShader;
              }
              tileset.show = true;
              viewer.scene.primitives.add(tileset);
              setTilesetLoadedCount(prev => prev + 1);
              viewer.scene.requestRender();
            } else {
              try {
                if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed()) {
                  viewer.scene.primitives.remove(tileset);
                }
              } catch (_) {}
            }
          })
          .catch(err => {
            isLoadingLeftBuildingsRef.current = false;
            console.warn('Failed to load left 3D buildings:', err);
          });
      }
    } else {
      if (leftBuildingsTilesetRef.current) {
        leftBuildingsTilesetRef.current.show = false;
      }
    }

    // 2. Right modified/clipped buildings (primary tileset)
    if (rightBuildingsTilesetRef.current) {
      rightBuildingsTilesetRef.current.show = true;
      rightBuildingsTilesetRef.current.splitDirection = swipeEnabled 
        ? Cesium.SplitDirection.RIGHT 
        : Cesium.SplitDirection.NONE;
      rightBuildingsTilesetRef.current.shadows = sunShadowsEnabled 
        ? Cesium.ShadowMode.ENABLED 
        : Cesium.ShadowMode.DISABLED;
      if (activeCustomShader) {
        (rightBuildingsTilesetRef.current as any).customShader = activeCustomShader;
      }
      applyClippingToTilesetInstance(rightBuildingsTilesetRef.current);
      viewer.scene.requestRender();
    } else if (!isLoadingRightBuildingsRef.current) {
      isLoadingRightBuildingsRef.current = true;
      loadOsmTileset()
        .then(tileset => {
          isLoadingRightBuildingsRef.current = false;
          if (active && viewerRef.current === viewer && !viewer.isDestroyed()) {
            rightBuildingsTilesetRef.current = tileset;
            (tileset as any).maximumMemoryUsage = 256;
            (tileset as any).dynamicScreenSpaceError = true;
            (tileset as any).preloadWhenHidden = false;
            if ((tileset as any).errorEvent) {
              (tileset as any).errorEvent.addEventListener((err: any) => {
                console.warn('OSM Buildings Right Tileset error gracefully caught:', err);
              });
            }
            applyClippingToTilesetInstance(tileset);
            tileset.splitDirection = swipeEnabled 
              ? Cesium.SplitDirection.RIGHT 
              : Cesium.SplitDirection.NONE;
            tileset.shadows = sunShadowsEnabled 
              ? Cesium.ShadowMode.ENABLED 
              : Cesium.ShadowMode.DISABLED;
            if (activeCustomShader) {
              (tileset as any).customShader = activeCustomShader;
            }
            // Set visibility according to the live state
            const currentIsGoogle = layers.find(l => l.id === 'google-3d-tiles')?.enabled;
            tileset.show = !currentIsGoogle && !!globeState.buildings3dEnabled;
            viewer.scene.primitives.add(tileset);
            setTilesetLoadedCount(prev => prev + 1);
            viewer.scene.requestRender();
          } else {
            try {
              if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed()) {
                viewer.scene.primitives.remove(tileset);
              }
            } catch (_) {}
          }
        })
        .catch(err => {
          isLoadingRightBuildingsRef.current = false;
          console.warn('Failed to load right 3D buildings:', err);
          if (isValidCesiumToken(token) && onIonAssetError) {
            onIonAssetError('Failed to load right 3D buildings. Please ensure your Cesium Ion Token is valid and has permission to stream OSM Buildings.');
          }
        });
    }

    return () => {
      active = false;
    };
  }, [globeState.buildings3dEnabled, globeState.buildingShaderMode, globeState.buildingCustomShaderText, globeState.buildingSilhouetteColor, layers, token, sunShadowsEnabled, swipeEnabled, polygonData, importedLayers]);

  // Synchronize layers 'osm-buildings' visibility with globeState.buildings3dEnabled
  useEffect(() => {
    const osmLayer = layers.find(l => l.id === 'osm-buildings');
    if (osmLayer && osmLayer.enabled !== globeState.buildings3dEnabled) {
      onGlobeStateChange?.(prev => ({ ...prev, buildings3dEnabled: osmLayer.enabled }));
    }
  }, [layers]);

  // Synchronize Custom Shader stage across all 3D Tilesets (OSM Buildings 96188, Custom Ion Assets, Uploaded Tilesets)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const shader = createBuildingCustomShader(
      globeState.buildingShaderMode,
      globeState.buildingCustomShaderText,
      globeState.buildingSilhouetteColor
    );

    if (leftBuildingsTilesetRef.current) {
      try {
        (leftBuildingsTilesetRef.current as any).customShader = shader;
      } catch (_) {}
    }
    if (rightBuildingsTilesetRef.current) {
      try {
        (rightBuildingsTilesetRef.current as any).customShader = shader;
      } catch (_) {}
    }
    if (customTilesetRef.current) {
      try {
        (customTilesetRef.current as any).customShader = shader;
      } catch (_) {}
    }

    // Apply to any other active Cesium3DTilesets (except Google Photorealistic if disabled)
    try {
      const primsCount = viewer.scene.primitives.length;
      for (let i = 0; i < primsCount; i++) {
        const prim = viewer.scene.primitives.get(i);
        if (prim && prim instanceof Cesium.Cesium3DTileset) {
          if (prim !== leftGoogleTilesetRef.current && prim !== rightGoogleTilesetRef.current) {
            (prim as any).customShader = shader;
          }
        }
      }
    } catch (_) {}

    viewer.scene.requestRender();
  }, [globeState.buildingShaderMode, globeState.buildingCustomShaderText, globeState.buildingSilhouetteColor, isInitializing]);

  // Synchronize Per-Layer Outline Color, Opacity, Thickness, and ON/OFF State for all 3D Tilesets
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // 1. Ion Accounts 3D Tilesets
    ionAccounts?.forEach(account => {
      account.assets?.forEach(asset => {
        const key = `${account.id}-${asset.id}`;
        const tileset = ionTilesetsMapRef.current.get(key);
        if (tileset && !tileset.isDestroyed()) {
          const color = asset.outlineColor || '#000000';
          const opacity = asset.outlineOpacity !== undefined ? asset.outlineOpacity : 1.0;
          const thickness = asset.outlineThickness !== undefined ? asset.outlineThickness : 2.5;
          const enabled = asset.outlineEnabled !== undefined ? asset.outlineEnabled : true;
          if (enabled && opacity > 0) {
            const shader = createTilesetOutlineShader(color, opacity, thickness, enabled);
            (tileset as any).customShader = shader;
          } else {
            (tileset as any).customShader = undefined;
          }
        }
      });
    });

    // 2. Imported Local 3D Tilesets
    importedLayers?.filter(l => l.type === 'tileset' || l.type === '3d-tiles' || l.type === 'cesium').forEach(layer => {
      const tileset = tilesetsMapRef.current.get(layer.id);
      if (tileset && !tileset.isDestroyed()) {
        const color = layer.outlineColor || layer.silhouetteColor || '#000000';
        const opacity = layer.outlineOpacity !== undefined ? layer.outlineOpacity : 1.0;
        const thickness = layer.outlineThickness !== undefined ? layer.outlineThickness : 2.5;
        const enabled = layer.outlineEnabled !== undefined ? layer.outlineEnabled : true;
        if (enabled && opacity > 0) {
          const shader = createTilesetOutlineShader(color, opacity, thickness, enabled);
          (tileset as any).customShader = shader;
        } else {
          (tileset as any).customShader = undefined;
        }
      }
    });

    viewer.scene.requestRender();
  }, [ionAccounts, importedLayers, isInitializing]);

  // Update Google Photorealistic 3D Tiles Layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let active = true;

    const isGoogleEnabled = layers.find(l => l.id === 'google-3d-tiles')?.enabled;

    // Toggle 2D terrain and imagery layers off when Google 3D Tiles are ON to prevent WebGL mesh collision / Z-fighting
    if (viewer.scene && viewer.scene.globe) {
      viewer.scene.globe.show = !isGoogleEnabled;
    }
    const imageryLayers = viewer.imageryLayers;
    if (imageryLayers) {
      for (let i = 0; i < imageryLayers.length; i++) {
        const lyr = imageryLayers.get(i);
        if (lyr) {
          if (isGoogleEnabled) {
            lyr.show = false;
          } else {
            if (lyr === googleLabelsLayerRef.current) {
              lyr.show = googleLabelsEnabled;
            } else {
              lyr.show = true;
            }
          }
        }
      }
    }

    const cleanupLeft = () => {
      if (leftGoogleTilesetRef.current) {
        try {
          viewer.scene.primitives.remove(leftGoogleTilesetRef.current);
        } catch (_) {}
        leftGoogleTilesetRef.current = null;
      }
    };

    const cleanupRight = () => {
      if (rightGoogleTilesetRef.current) {
        try {
          viewer.scene.primitives.remove(rightGoogleTilesetRef.current);
        } catch (_) {}
        rightGoogleTilesetRef.current = null;
      }
    };

    if (isGoogleEnabled) {
      // 1. Left unmodified buildings (only visible if swipe compare is active)
      if (swipeEnabled) {
        if (!leftGoogleTilesetRef.current) {
          Cesium.createGooglePhotorealistic3DTileset()
            .then(tileset => {
              if (active && viewerRef.current === viewer) {
                leftGoogleTilesetRef.current = tileset;
                (tileset as any).maximumMemoryUsage = 256;
                (tileset as any).dynamicScreenSpaceError = true;
                (tileset as any).preloadWhenHidden = false;
                if ((tileset as any).errorEvent) {
                  (tileset as any).errorEvent.addEventListener((err: any) => {
                    console.warn('Google 3D Tiles Left Tileset error gracefully caught:', err);
                  });
                }
                tileset.splitDirection = Cesium.SplitDirection.LEFT;
                tileset.shadows = sunShadowsEnabled 
                  ? Cesium.ShadowMode.ENABLED 
                  : Cesium.ShadowMode.DISABLED;
                viewer.scene.primitives.add(tileset);
                setTilesetLoadedCount(prev => prev + 1);
                viewer.scene.requestRender();
              } else {
                try {
                  if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed()) {
                    viewer.scene.primitives.remove(tileset);
                  }
                } catch (_) {}
              }
            })
            .catch(err => {
              console.warn('Failed to load left Google 3D tiles:', err);
            });
        } else {
          leftGoogleTilesetRef.current.splitDirection = Cesium.SplitDirection.LEFT;
          leftGoogleTilesetRef.current.shadows = sunShadowsEnabled 
            ? Cesium.ShadowMode.ENABLED 
            : Cesium.ShadowMode.DISABLED;
        }
      } else {
        cleanupLeft();
      }

      // 2. Right modified/clipped buildings
      if (!rightGoogleTilesetRef.current) {
        Cesium.createGooglePhotorealistic3DTileset()
          .then(tileset => {
            if (active && viewerRef.current === viewer) {
              rightGoogleTilesetRef.current = tileset;
              (tileset as any).maximumMemoryUsage = 256;
              (tileset as any).dynamicScreenSpaceError = true;
              (tileset as any).preloadWhenHidden = false;
              if ((tileset as any).errorEvent) {
                (tileset as any).errorEvent.addEventListener((err: any) => {
                  console.warn('Google 3D Tiles Right Tileset error gracefully caught:', err);
                });
              }
              applyClippingToTilesetInstance(tileset);
              tileset.splitDirection = swipeEnabled 
                ? Cesium.SplitDirection.RIGHT 
                : Cesium.SplitDirection.NONE;
              tileset.shadows = sunShadowsEnabled 
                ? Cesium.ShadowMode.ENABLED 
                : Cesium.ShadowMode.DISABLED;
              viewer.scene.primitives.add(tileset);
              setTilesetLoadedCount(prev => prev + 1);
              viewer.scene.requestRender();
            } else {
              try {
                if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed()) {
                  viewer.scene.primitives.remove(tileset);
                }
              } catch (_) {}
            }
          })
          .catch(err => {
            console.warn('Failed to load right Google 3D tiles:', err);
          });
      } else {
        rightGoogleTilesetRef.current.splitDirection = swipeEnabled 
          ? Cesium.SplitDirection.RIGHT 
          : Cesium.SplitDirection.NONE;
        rightGoogleTilesetRef.current.shadows = sunShadowsEnabled 
          ? Cesium.ShadowMode.ENABLED 
          : Cesium.ShadowMode.DISABLED;
        applyClippingToTilesetInstance(rightGoogleTilesetRef.current);
      }
    } else {
      cleanupLeft();
      cleanupRight();
    }

    return () => {
      active = false;
    };
  }, [layers, token, sunShadowsEnabled, swipeEnabled, polygonData, importedLayers]);

  // Handle Custom Shapefile and Photoshop Texture Draping
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Local function to remove previous primitive safely
    const cleanupDrape = () => {
      if (drapePrimitiveRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(drapePrimitiveRef.current);
      }
      drapePrimitiveRef.current = null;
    };

    cleanupDrape();

    // If this polygonData belongs to an imported shapefile or active GIS layer,
    // do NOT draw a default cyan site boundary drape over the features unless a custom aerial/masterplan texture image is loaded.
    const hasPerLayerTextures = Boolean(gisLayers && gisLayers.some(l => l.visible && l.textureUrl));
    const hasActiveGisOrShapefile = (gisLayers && gisLayers.length > 0) || Boolean(shapefileData);
    if (hasPerLayerTextures || !polygonData || (!loadedTextureImage && hasActiveGisOrShapefile)) {
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
      }
      return;
    }

    try {
      // Calculate true north convergence angle offset based on actual GPS location (centroid longitude / latitude)
      let trueNorthOffsetRad = 0.0;
      if (polygonData.positions && polygonData.positions.length > 0) {
        let sumLng = 0;
        let sumLat = 0;
        polygonData.positions.forEach(([lng, lat]) => {
          sumLng += lng;
          sumLat += lat;
        });
        const centerLng = sumLng / polygonData.positions.length;
        const centerLat = sumLat / polygonData.positions.length;

        // Grid convergence angle gamma = (lambda - lambda0) * sin(phi)
        // For UTM projection based on zone central meridian:
        const utmZone = Math.floor((centerLng + 180) / 6) + 1;
        const centralMeridianLng = (utmZone - 1) * 6 - 180 + 3;
        const dLngRad = Cesium.Math.toRadians(centerLng - centralMeridianLng);
        const latRad = Cesium.Math.toRadians(centerLat);
        
        // Meridian convergence angle: gamma = delta_lambda * sin(lat)
        const gridConvergenceAngleRad = dLngRad * Math.sin(latRad);
        trueNorthOffsetRad = gridConvergenceAngleRad;
      }

      // 1. Convert positions and holes to Cesium.Cartesian3
      const outerPositions = polygonData.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
      const holesList = polygonData.holes?.map(h => {
        return new Cesium.PolygonHierarchy(h.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
      }) || [];

      const hierarchy = new Cesium.PolygonHierarchy(outerPositions, holesList);

      // 2. Create PolygonGeometry with True North stRotation offset for texture alignment
      const polygonGeometry = new Cesium.PolygonGeometry({
        polygonHierarchy: hierarchy,
        stRotation: loadedTextureImage ? trueNorthOffsetRad : 0.0,
        vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
      });

      // 3. Create material and appearance
      let material;
      if (loadedTextureImage) {
        material = Cesium.Material.fromType('Image', {
          image: loadedTextureImage
        });
      } else {
        // Cyan color with 40% opacity as elegant default boundary
        material = Cesium.Material.fromType('Color', {
          color: new Cesium.Color(0.06, 0.49, 1.0, 0.4)
        });
      }

      const appearance = new Cesium.EllipsoidSurfaceAppearance({
        material: material,
        flat: !(sunShadowsEnabled || rtxUltraEnabled),
        aboveGround: false,
        translucent: true
      });

      // 4. Create and add GroundPrimitive
      const groundPrimitive = new Cesium.GroundPrimitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: polygonGeometry,
          id: 'dxf-site-boundary-drape'
        }),
        appearance: appearance,
        classificationType: Cesium.ClassificationType.TERRAIN,
        asynchronous: false
      });
      (groundPrimitive as any).shadows = (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.RECEIVE_ONLY : Cesium.ShadowMode.DISABLED;

      drapePrimitiveRef.current = groundPrimitive;
      viewer.scene.primitives.add(groundPrimitive);
      viewer.scene.requestRender();

    } catch (err) {
      console.error('Failed to render site boundary drape:', err);
    }

    return () => {
      cleanupDrape();
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
      }
    };
  }, [polygonData, loadedTextureImage, sunShadowsEnabled, rtxUltraEnabled, gisLayers, shapefileData]);

  // Dedicated Multi-Layer DXF / CAD Texture Draping
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const currentMap = gisLayersDrapePrimitivesRef.current;
    const activeLayerIds = new Set<string>();

    (gisLayers || []).forEach((layer) => {
      // Must be visible, have a textureUrl, and valid polygon positions
      if (!layer.visible || !layer.textureUrl) return;

      const poly = layer.polygonData;
      if (!poly || !poly.positions || poly.positions.length < 3) return;

      activeLayerIds.add(layer.id);

      const existingPrim = currentMap.get(layer.id);
      if (existingPrim && (existingPrim as any)._layerTextureUrl === layer.textureUrl) {
        return; // Up to date
      }

      if (existingPrim) {
        viewer.scene.primitives.remove(existingPrim);
        currentMap.delete(layer.id);
      }

      try {
        let sumLng = 0;
        let sumLat = 0;
        poly.positions.forEach(([lng, lat]) => {
          sumLng += lng;
          sumLat += lat;
        });
        const centerLng = sumLng / poly.positions.length;
        const centerLat = sumLat / poly.positions.length;

        const utmZone = Math.floor((centerLng + 180) / 6) + 1;
        const centralMeridianLng = (utmZone - 1) * 6 - 180 + 3;
        const dLngRad = Cesium.Math.toRadians(centerLng - centralMeridianLng);
        const latRad = Cesium.Math.toRadians(centerLat);
        const trueNorthOffsetRad = dLngRad * Math.sin(latRad);

        const outerPositions = poly.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
        const holesList = poly.holes?.map(h => {
          return new Cesium.PolygonHierarchy(h.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
        }) || [];

        const hierarchy = new Cesium.PolygonHierarchy(outerPositions, holesList);

        const polygonGeometry = new Cesium.PolygonGeometry({
          polygonHierarchy: hierarchy,
          stRotation: trueNorthOffsetRad,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
        });

        const material = Cesium.Material.fromType('Image', {
          image: layer.textureUrl
        });

        const appearance = new Cesium.EllipsoidSurfaceAppearance({
          material: material,
          flat: !(sunShadowsEnabled || rtxUltraEnabled),
          aboveGround: false,
          translucent: true
        });

        const groundPrimitive = new Cesium.GroundPrimitive({
          geometryInstances: new Cesium.GeometryInstance({
            geometry: polygonGeometry,
            id: `dxf-site-boundary-drape-${layer.id}`
          }),
          appearance: appearance,
          classificationType: Cesium.ClassificationType.TERRAIN,
          asynchronous: false
        });
        (groundPrimitive as any).shadows = (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.RECEIVE_ONLY : Cesium.ShadowMode.DISABLED;
        (groundPrimitive as any).splitDirection = swipeEnabled ? Cesium.SplitDirection.RIGHT : Cesium.SplitDirection.NONE;
        (groundPrimitive as any)._layerTextureUrl = layer.textureUrl;
        (groundPrimitive as any)._layerId = layer.id;

        viewer.scene.primitives.add(groundPrimitive);
        currentMap.set(layer.id, groundPrimitive);
      } catch (err) {
        console.error(`Failed to render multi-layer texture drape for ${layer.name}:`, err);
      }
    });

    // Remove any primitives for layers that no longer have a texture, were toggled invisible, or deleted
    for (const [lId, prim] of currentMap.entries()) {
      if (!activeLayerIds.has(lId)) {
        viewer.scene.primitives.remove(prim);
        currentMap.delete(lId);
      }
    }

    viewer.scene.requestRender();
  }, [gisLayers, sunShadowsEnabled, rtxUltraEnabled, swipeEnabled]);

  // Helper to sanitize polygon vertices and enforce Counter-Clockwise (CCW) winding order for Cesium ClippingPolygon
  const normalizeClippingPositions = (
    rawPoints: any
  ): Cesium.Cartesian3[] => {
    if (!rawPoints || !Array.isArray(rawPoints)) return [];

    const points: { lon: number; lat: number }[] = [];
    rawPoints.forEach((p: any) => {
      if (Array.isArray(p) && p.length >= 2) {
        const lon = Number(p[0]);
        const lat = Number(p[1]);
        if (!isNaN(lon) && !isNaN(lat)) {
          points.push({ lon, lat });
        }
      } else if (p && typeof p === 'object') {
        const lon = Number(p.lon ?? p.lng ?? p.longitude);
        const lat = Number(p.lat ?? p.latitude);
        if (!isNaN(lon) && !isNaN(lat)) {
          points.push({ lon, lat });
        }
      }
    });

    if (points.length < 3) return [];

    // 1. Remove consecutive duplicate points (closer than 1e-7 deg ~ 1cm)
    const deduped: { lon: number; lat: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (deduped.length === 0) {
        deduped.push(pt);
      } else {
        const prev = deduped[deduped.length - 1];
        const d = Math.hypot(pt.lon - prev.lon, pt.lat - prev.lat);
        if (d > 1e-7) {
          deduped.push(pt);
        }
      }
    }

    // 2. Remove closing duplicate point if first == last
    if (deduped.length > 3) {
      const first = deduped[0];
      const last = deduped[deduped.length - 1];
      if (Math.hypot(first.lon - last.lon, first.lat - last.lat) < 1e-7) {
        deduped.pop();
      }
    }

    if (deduped.length < 3) return [];

    // 3. Compute 2D signed area using Shoelace formula to verify winding order
    let signedArea = 0;
    for (let i = 0; i < deduped.length; i++) {
      const j = (i + 1) % deduped.length;
      signedArea += (deduped[j].lon - deduped[i].lon) * (deduped[j].lat + deduped[i].lat);
    }
    // If signedArea > 0, vertices are Clockwise in lon/lat. Reverse to Counter-Clockwise (CCW).
    const ccwPoints = signedArea > 0 ? [...deduped].reverse() : deduped;

    return ccwPoints.map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0));
  };

  // Handle 3D Tiles & Globe Terrain Clipping Polygon
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Local function to safely remove and destroy previous clipping collection
    const cleanupClipping = () => {
      activeClippingConfigRef.current = { positionsList: [], inverse: false, enabled: false };

      // Clear clipping polygons from Globe Terrain if not in active excavation
      try {
        if (viewer && !viewer.isDestroyed() && viewer.scene && viewer.scene.globe) {
          if (!excavationClippingCollectionRef.current) {
            viewer.scene.globe.clippingPolygons = undefined as any;
          }
        }
      } catch (_) {}

      // Clear clippingPolygons on all active 3D tilesets in scene
      if (viewer && !viewer.isDestroyed() && viewer.scene) {
        const primsCount = viewer.scene.primitives.length;
        for (let i = 0; i < primsCount; i++) {
          const prim = viewer.scene.primitives.get(i);
          if (prim && prim instanceof Cesium.Cesium3DTileset) {
            try {
              if (!excavationClippingCollectionRef.current) {
                prim.clippingPolygons = undefined as any;
              }
            } catch (_) {}
          }
        }
      }

      if (rightBuildingsTilesetRef.current && !excavationClippingCollectionRef.current) {
        try { rightBuildingsTilesetRef.current.clippingPolygons = undefined as any; } catch (_) {}
      }
      if (leftBuildingsTilesetRef.current && !excavationClippingCollectionRef.current) {
        try { leftBuildingsTilesetRef.current.clippingPolygons = undefined as any; } catch (_) {}
      }
      if (rightGoogleTilesetRef.current && !excavationClippingCollectionRef.current) {
        try { rightGoogleTilesetRef.current.clippingPolygons = undefined as any; } catch (_) {}
      }
      if (leftGoogleTilesetRef.current && !excavationClippingCollectionRef.current) {
        try { leftGoogleTilesetRef.current.clippingPolygons = undefined as any; } catch (_) {}
      }
      if (customTilesetRef.current && !excavationClippingCollectionRef.current) {
        try { customTilesetRef.current.clippingPolygons = undefined as any; } catch (_) {}
      }
      tilesetsMapRef.current?.forEach(t => {
        try { if (!excavationClippingCollectionRef.current) t.clippingPolygons = undefined as any; } catch (_) {}
      });
      ionTilesetsMapRef.current?.forEach(t => {
        try { if (!excavationClippingCollectionRef.current) t.clippingPolygons = undefined as any; } catch (_) {}
      });

      clippingCollectionRef.current = null;
    };

    cleanupClipping();

    const activeClippingLayers = (importedLayers || []).filter(
      l => l.type === 'clipping_polygon' && l.visible !== false && l.positions && l.positions.length >= 3
    );

    const allNormalizedPolygons: Cesium.Cartesian3[][] = [];

    // 1. Process clipping polygon layers from importedLayers
    activeClippingLayers.forEach(layer => {
      const positions = normalizeClippingPositions(layer.positions);
      if (positions.length >= 3) {
        allNormalizedPolygons.push(positions);
      }
    });

    // 2. Process legacy single polygonData if active
    if (polygonData && clippingMode !== 'none' && polygonData.positions && polygonData.positions.length >= 3) {
      const positions = normalizeClippingPositions(polygonData.positions);
      if (positions.length >= 3) {
        allNormalizedPolygons.push(positions);
      }
    }

    if (allNormalizedPolygons.length === 0) {
      viewer.scene.requestRender();
      return;
    }

    try {
      const isInverse = clippingMode === 'outside' || activeClippingLayers.some(l => l.inverse === true);

      // Record active clipping configuration so newly loaded tilesets also receive clipping
      activeClippingConfigRef.current = {
        positionsList: allNormalizedPolygons,
        inverse: isInverse,
        enabled: clip3dTiles
      };

      // Ensure Globe Terrain is never clipped by 3D building clipping polygons (clipping polygons are for 3D building tiles only)
      if (!excavationClippingCollectionRef.current && viewer.scene && viewer.scene.globe) {
        viewer.scene.globe.clippingPolygons = undefined as any;
      }

      // Apply independent clipping polygon collection to all active 3D tilesets in scene
      // IMPORTANT: Cesium requires that a ClippingPolygonCollection is assigned to only ONE object.
      // applyClippingToTilesetInstance generates a dedicated collection instance per tileset!
      const primsCount = viewer.scene.primitives.length;
      for (let i = 0; i < primsCount; i++) {
        const prim = viewer.scene.primitives.get(i);
        if (prim && prim instanceof Cesium.Cesium3DTileset) {
          applyClippingToTilesetInstance(prim, allNormalizedPolygons, isInverse, clip3dTiles);
        }
      }

      applyClippingToTilesetInstance(rightBuildingsTilesetRef.current, allNormalizedPolygons, isInverse, clip3dTiles);
      applyClippingToTilesetInstance(leftBuildingsTilesetRef.current, allNormalizedPolygons, isInverse, clip3dTiles);
      applyClippingToTilesetInstance(rightGoogleTilesetRef.current, allNormalizedPolygons, isInverse, clip3dTiles);
      applyClippingToTilesetInstance(leftGoogleTilesetRef.current, allNormalizedPolygons, isInverse, clip3dTiles);
      applyClippingToTilesetInstance(customTilesetRef.current, allNormalizedPolygons, isInverse, clip3dTiles);

      tilesetsMapRef.current?.forEach(t => {
        applyClippingToTilesetInstance(t, allNormalizedPolygons, isInverse, clip3dTiles);
      });
      ionTilesetsMapRef.current?.forEach(t => {
        applyClippingToTilesetInstance(t, allNormalizedPolygons, isInverse, clip3dTiles);
      });

      viewer.scene.requestRender();

    } catch (err) {
      console.error('Failed to apply 3D Tiles clipping polygon collection:', err);
    }

    return () => {
      cleanupClipping();
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
      }
    };
  }, [importedLayers, polygonData, clippingMode, clip3dTiles]);

  // Render Visual Entities and Borders for Clipping Polygon Layers on Map
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const clippingLayers = (importedLayers || []).filter(l => l.type === 'clipping_polygon');

    const activeEntityIds = new Set<string>();

    clippingLayers.forEach(layer => {
      if (layer.visible === false) return; // Hide switch activated

      const entityId = `clipping-polygon-entity-${layer.id}`;
      const outlineEntityId = `clipping-polygon-outline-${layer.id}`;
      activeEntityIds.add(entityId);
      activeEntityIds.add(outlineEntityId);

      const isSelected = activeLayerId === layer.id;
      const opacity = layer.opacity !== undefined ? layer.opacity : 0.0;
      const baseColorHex = layer.color || '#ef4444';

      const cartesianPositions = (layer.positions || []).map((p: any) =>
        Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height || 0)
      );

      if (cartesianPositions.length < 3) return;

      // Filled Polygon entity
      let fillEntity = viewer.entities.getById(entityId);
      if (!fillEntity) {
        fillEntity = viewer.entities.add({
          id: entityId,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(cartesianPositions),
            material: Cesium.Color.fromCssColorString(baseColorHex).withAlpha(opacity * 0.35),
            classificationType: Cesium.ClassificationType.BOTH
          }
        });
      } else if (fillEntity.polygon) {
        fillEntity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(cartesianPositions));
        fillEntity.polygon.material = new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString(baseColorHex).withAlpha(opacity * 0.35)
        );
      }

      // Polyline Outline entity
      let borderEntity = viewer.entities.getById(outlineEntityId);
      const borderWidth = isSelected ? 5.0 : 3.0;

      if (!borderEntity) {
        borderEntity = viewer.entities.add({
          id: outlineEntityId,
          polyline: {
            positions: [...cartesianPositions, cartesianPositions[0]],
            width: borderWidth,
            material: isSelected
              ? new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.3,
                  color: Cesium.Color.CYAN
                })
              : new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.fromCssColorString(baseColorHex).withAlpha(0.9),
                  dashLength: 16
                }),
            clampToGround: true
          }
        });
      } else if (borderEntity.polyline) {
        borderEntity.polyline.positions = new Cesium.ConstantProperty([...cartesianPositions, cartesianPositions[0]]);
        borderEntity.polyline.width = new Cesium.ConstantProperty(borderWidth);
        borderEntity.polyline.material = isSelected
          ? new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.CYAN
            })
          : new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString(baseColorHex).withAlpha(0.9),
              dashLength: 16
            });
      }
    });

    // Cleanup stale entities for deleted or hidden layers
    const existingEntities = viewer.entities.values;
    for (let i = existingEntities.length - 1; i >= 0; i--) {
      const ent = existingEntities[i];
      if (ent.id.startsWith('clipping-polygon-entity-') || ent.id.startsWith('clipping-polygon-outline-')) {
        if (!activeEntityIds.has(ent.id)) {
          viewer.entities.remove(ent);
        }
      }
    }

    viewer.scene.requestRender();
  }, [importedLayers, activeLayerId, isInitializing]);

  // Handle Fly-To on active Shapefile Polygon
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !polygonData || flyToPolygonTrigger === 0) return;

    try {
      const rect = Cesium.Rectangle.fromDegrees(
        polygonData.bounds.west,
        polygonData.bounds.south,
        polygonData.bounds.east,
        polygonData.bounds.north
      );

      // Compute bounding sphere
      const boundingSphere = Cesium.BoundingSphere.fromRectangle3D(rect);

      // Smooth camera fly to with custom offsets
      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 3.0,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0), // North
          Cesium.Math.toRadians(-45), // 45 degree tilt looking down
          boundingSphere.radius * 1.8 // comfortable range
        )
      });
    } catch (err) {
      console.error('Failed flying to custom site boundary:', err);
    }
  }, [polygonData, flyToPolygonTrigger]);

  // Handle Fly-To on selected Landmark/POI
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToLandmarkTarget || flyToLandmarkTrigger === 0) return;

    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(flyToLandmarkTarget.lon, flyToLandmarkTarget.lat, 300),
        duration: 2.5
      });
    } catch (err) {
      console.error('Failed flying to selected landmark:', err);
    }
  }, [flyToLandmarkTrigger]);

  // Synchronize Camera Projection Mode and Focal Length FOV angle in real-time
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    try {
      if (projectionMode === 'orthographic') {
        viewer.scene.camera.switchToOrthographicFrustum();
      } else {
        viewer.scene.camera.switchToPerspectiveFrustum();
        if (viewer.camera.frustum && 'fov' in viewer.camera.frustum) {
          (viewer.camera.frustum as any).fov = Cesium.Math.toRadians(effectiveFov);
        }
      }
      viewer.scene.requestRender();
    } catch (err) {
      console.error('Failed applying projection/FOV change:', err);
    }
  }, [projectionMode, effectiveFov, isInitializing]);

  // Handle persistent FOV enforcement and real-time coordinates tracking on camera changed event
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const handleCameraChanged = () => {
      if (isApplyingExternalCameraRef.current) return;

      if (projectionMode === 'perspective' && viewer.camera.frustum && 'fov' in viewer.camera.frustum) {
        const targetRad = Cesium.Math.toRadians(effectiveFov);
        if (Math.abs((viewer.camera.frustum as any).fov - targetRad) > 0.001) {
          (viewer.camera.frustum as any).fov = targetRad;
          viewer.scene.requestRender();
        }
      }

      // Track dynamic camera coordinates for the status bar
      try {
        const position = viewer.camera.position;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        if (cartographic) {
          const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
          const lngDeg = Cesium.Math.toDegrees(cartographic.longitude);
          const altMeters = cartographic.height;
          setCameraPos(prev => {
            if (prev && Math.abs(prev.lat - latDeg) < 0.0001 && Math.abs(prev.lng - lngDeg) < 0.0001 && Math.abs(prev.alt - altMeters) < 0.2) {
              return prev;
            }
            return { lat: latDeg, lng: lngDeg, alt: altMeters };
          });
        }
        
        // Track camera heading in degrees
        const headingDeg = Cesium.Math.toDegrees(viewer.camera.heading);
        setCameraHeading(prev => {
          if (prev !== null && Math.abs(prev - headingDeg) < 0.1) {
            return prev;
          }
          return headingDeg;
        });
      } catch (err) {
        // Fallback
      }

      if (onCameraChangeRef.current) {
        const pos = viewer.camera.position;
        const heading = viewer.camera.heading;
        const pitch = viewer.camera.pitch;
        const roll = viewer.camera.roll;

        const last = lastEmittedCameraRef.current;
        if (!last || 
            Cesium.Cartesian3.distance(last.destination, pos) > 0.5 ||
            Math.abs(last.heading - heading) > 0.005 ||
            Math.abs(last.pitch - pitch) > 0.005) {
          const newCamState = {
            destination: pos.clone(),
            heading,
            pitch,
            roll
          };
          lastEmittedCameraRef.current = newCamState;
          onCameraChangeRef.current(newCamState);
        }
      }
    };

    const removeListener = viewer.camera.changed.addEventListener(handleCameraChanged);
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        removeListener();
      }
    };
  }, [projectionMode, effectiveFov, isInitializing]);

  // Auto-center Solar Path Arc to viewport when solarPathEnabled turns ON or when camera view changes
  const prevSolarPathEnabledRef = useRef(solarPathEnabled);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // 1. When solarPathEnabled transitions from false to true
    if (solarPathEnabled && !prevSolarPathEnabledRef.current) {
      const vpCenter = getViewportCenterPosition();
      if (vpCenter && onActiveAnalysisCenterChangeRef.current) {
        onActiveAnalysisCenterChangeRef.current(vpCenter);
      }
    }
    prevSolarPathEnabledRef.current = solarPathEnabled;

    // 2. Listener for camera view changes
    const handleCameraMoveForSolar = () => {
      if (solarPathEnabledRef.current && !isDraggingSolarGizmoRef.current) {
        const vpCenter = getViewportCenterPosition();
        if (vpCenter && onActiveAnalysisCenterChangeRef.current) {
          onActiveAnalysisCenterChangeRef.current(vpCenter);
        }
      }
    };

    const removeCameraListener = viewer.camera.changed.addEventListener(handleCameraMoveForSolar);
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        removeCameraListener();
      }
    };
  }, [solarPathEnabled, isInitializing, getViewportCenterPosition]);



  // Support camera syncing from externalCameraState
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !externalCameraState || isInitializing) return;

    try {
      const currentPos = viewer.camera.position;
      const distance = Cesium.Cartesian3.distance(currentPos, externalCameraState.destination);
      const headingDiff = Math.abs(viewer.camera.heading - externalCameraState.heading);
      const pitchDiff = Math.abs(viewer.camera.pitch - externalCameraState.pitch);

      if (distance > 1.0 || headingDiff > 0.005 || pitchDiff > 0.005) {
        isApplyingExternalCameraRef.current = true;
        viewer.camera.setView({
          destination: externalCameraState.destination,
          orientation: {
            heading: externalCameraState.heading,
            pitch: externalCameraState.pitch,
            roll: externalCameraState.roll
          }
        });
        viewer.scene.requestRender();
        setTimeout(() => {
          isApplyingExternalCameraRef.current = false;
        }, 50);
      }
    } catch (err) {
      isApplyingExternalCameraRef.current = false;
    }
  }, [externalCameraState, isInitializing]);

  // Synchronize coordinates immediately when user selects a preset location
  useEffect(() => {
    if (selectedPreset) {
      setCameraPos({
        lat: selectedPreset.latitude,
        lng: selectedPreset.longitude,
        alt: selectedPreset.height
      });
    }
  }, [selectedPreset]);

  // Handle 3D demographic heatmap rendering
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Local function to clear previous entities
    const clearShapefileEntities = () => {
      shapefileEntitiesRef.current.forEach(ent => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.entities.remove(ent);
        }
      });
      shapefileEntitiesRef.current = [];
    };

    clearShapefileEntities();

    // If GIS layers exist, ALL shapefiles are handled and rendered via gisLayers.
    // Prevent duplicate entity creation and ghost fills by returning early whenever gisLayers has layers.
    const hasGisLayers = gisLayers && gisLayers.length > 0;
    const isAlreadyInGisLayers = gisLayers && gisLayers.some(l => l.shapefileData === shapefileData);
    if (!shapefileData || hasGisLayers || isAlreadyInGisLayers) {
      viewer.scene.requestRender();
      return;
    }

    try {
      // 1. Calculate min and max values for dynamic color mapping
      let minVal = Infinity;
      let maxVal = -Infinity;
      shapefileData.features.forEach(feat => {
        const val = Number(feat.properties[selectedMetric]) || 0;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      });

      if (minVal === Infinity) minVal = 0;
      if (maxVal === -Infinity) maxVal = 1;
      if (minVal === maxVal) maxVal = minVal + 1;

      // 2. Compute dynamic maximum extrusion height based on bounding box size
      const deltaLng = Math.abs(shapefileData.bounds.east - shapefileData.bounds.west);
      const deltaLat = Math.abs(shapefileData.bounds.north - shapefileData.bounds.south);
      const maxBoundsSpan = Math.max(deltaLng, deltaLat);
      const maxExtrusionHeight = Math.max(500, Math.min(500000, maxBoundsSpan * 111000 * 0.25));

      // 3. Render each feature
      const isCad = shapefileData.isCad;
      shapefileData.features.forEach((feat, idx) => {
        const value = Number(feat.properties[selectedMetric]) || 0;
        const colorHex = isCad ? '#000000' : getMetricColor(value, minVal, maxVal);
        const color = Cesium.Color.fromCssColorString(colorHex).withAlpha(0.65);

        // Convert coordinates to Cartesian3
        const outerPositions = feat.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
        const holesList = feat.holes?.map(h => {
          return new Cesium.PolygonHierarchy(h.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
        }) || [];

        const hierarchy = new Cesium.PolygonHierarchy(outerPositions, holesList);

        // Dual Polygon + Ground Polyline Setup: Closed ring outer boundary
        const closedOuter = [...feat.positions];
        if (closedOuter.length > 0) {
          const first = closedOuter[0];
          const last = closedOuter[closedOuter.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            closedOuter.push(first);
          }
        }
        const polylinePositions = closedOuter.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));

        // Define Polygon Graphics for fill area
        const polygonGraphics: any = {
          hierarchy: hierarchy,
          fill: true,
          material: new Cesium.ColorMaterialProperty(color),
          outline: false, // Handled by ground polyline to support user-defined strokeWidth (circumventing WebGL 1px restriction)
          shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
        };

        if (extrudeHeights) {
          // Extrude proportionally to the value
          const t = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
          const heightVal = Math.max(10, t * maxExtrusionHeight);
          polygonGraphics.height = 0;
          
          const selectedHeightAttribute = selectedMetric;
          const feature = feat;
          polygonGraphics.extrudedHeight = new Cesium.CallbackProperty(() => {
            const rawHeight = parseFloat(feature.properties[selectedHeightAttribute]) || 10;
            const proportionalHeight = heightVal;
            return proportionalHeight * shapefileHeightMultiplierRef.current;
          }, false);

          polygonGraphics.extrusionHeight = new Cesium.CallbackProperty(() => {
            const rawHeight = parseFloat(feature.properties[selectedHeightAttribute]) || 10;
            const proportionalHeight = heightVal;
            return proportionalHeight * shapefileHeightMultiplierRef.current;
          }, false);
        } else {
          // Flattened/draped on terrain ONLY (3D buildings remain unaffected by shapefile color)
          polygonGraphics.classificationType = Cesium.ClassificationType.TERRAIN;
        }

        const standaloneFeatProps = {
          ...(feat.properties || {}),
          LAYER: feat.properties?.LAYER || feat.properties?.layer || feat.properties?.ZONING || shapefileName || 'Default Layer',
          SOURCE_FILE: feat.properties?.SOURCE_FILE || feat.properties?.source_file || shapefileName || 'ESRI Shapefile'
        };

        // Add as Entity to Viewer with Dual Polygon (Fill) + Ground Polyline (Perimeter Outline)
        const entity = viewer.entities.add({
          id: `shapefile-feature-${feat.id}`,
          polygon: polygonGraphics,
          polyline: {
            positions: polylinePositions,
            width: 2.5,
            material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.95)),
            clampToGround: true,
            shadows: Cesium.ShadowMode.DISABLED,
          },
          properties: new Cesium.PropertyBag(standaloneFeatProps)
        });

        shapefileEntitiesRef.current.push(entity);
      });

      viewer.scene.requestRender();

    } catch (err) {
      console.error('Failed to render Shapefile demographic heatmap entities:', err);
    }

    return () => {
      clearShapefileEntities();
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
      }
    };
  }, [shapefileData, selectedMetric, extrudeHeights, gisLayers, sunShadowsEnabled, rtxUltraEnabled]);



  // Handle Multi-Layer GIS rendering
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // 1. Clean up deleted or hidden layers
    const activeLayerIds = Array.from(gisLayersEntitiesRef.current.keys());
    activeLayerIds.forEach(layerId => {
      const layer = gisLayers.find(l => l.id === layerId);
      if (!layer || !layer.visible) {
        const entities = gisLayersEntitiesRef.current.get(layerId) || [];
        entities.forEach(ent => {
          try {
            if (viewer && !viewer.isDestroyed() && viewer.entities) {
              viewer.entities.remove(ent);
            }
          } catch (_) {}
        });
        gisLayersEntitiesRef.current.delete(layerId);

        const primitive = gisLayersPrimitivesRef.current.get(layerId);
        if (primitive) {
          try {
            if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
              viewer.scene.primitives.remove(primitive);
            }
          } catch (_) {}
          gisLayersPrimitivesRef.current.delete(layerId);
        }

        const catchmentPrimitive = gisLayersCatchmentPrimitivesRef.current.get(layerId);
        if (catchmentPrimitive) {
          try {
            if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
              viewer.scene.primitives.remove(catchmentPrimitive);
            }
          } catch (_) {}
          gisLayersCatchmentPrimitivesRef.current.delete(layerId);
        }
      }
    });

    // Clean up any standalone or orphaned shapefile-feature- entities from viewer.entities
    if (viewer && !viewer.isDestroyed() && viewer.entities) {
      const allEnts = [...viewer.entities.values];
      const validLayerIds = new Set(gisLayers.filter(l => l.visible).map(l => l.id));
      allEnts.forEach(ent => {
        const idStr = String(ent.id || '');
        if (idStr.startsWith('shapefile-feature-')) {
          const matchesAnyActiveLayer = Array.from(validLayerIds).some(lid => idStr.includes(lid));
          if (!matchesAnyActiveLayer) {
            try {
              viewer.entities.remove(ent);
            } catch (_) {}
          }
        }
      });
    }

    // 2. Render visible layers
    gisLayers.forEach(layer => {
      if (!layer.visible) return;



      // Always clear first to avoid duplicates when parameters like opacity/metric change
      const entities = gisLayersEntitiesRef.current.get(layer.id) || [];
      entities.forEach(ent => {
        try {
          if (viewer && !viewer.isDestroyed() && viewer.entities) {
            viewer.entities.remove(ent);
          }
        } catch (_) {}
      });
      gisLayersEntitiesRef.current.delete(layer.id);

      const primitive = gisLayersPrimitivesRef.current.get(layer.id);
      if (primitive) {
        try {
          if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
            viewer.scene.primitives.remove(primitive);
          }
        } catch (_) {}
        gisLayersPrimitivesRef.current.delete(layer.id);
      }

      const catchmentPrimitive = gisLayersCatchmentPrimitivesRef.current.get(layer.id);
      if (catchmentPrimitive) {
        try {
          if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
            viewer.scene.primitives.remove(catchmentPrimitive);
          }
        } catch (_) {}
        gisLayersCatchmentPrimitivesRef.current.delete(layer.id);
      }

      try {
        const shapefileData = layer.shapefileData;
        const polygonData = layer.polygonData;

        if (!shapefileData || !shapefileData.features || !polygonData || !polygonData.positions) {
          return;
        }

        // A. Render Heatmap Features
        const isChoropleth = layer.visualizationMode === 'choropleth';
        const activeAttr = isChoropleth ? (layer.choroplethAttribute || selectedMetric) : selectedMetric;

        const newEntities: Cesium.Entity[] = [];
        let minVal = Infinity;
        let maxVal = -Infinity;
        shapefileData.features.forEach(feat => {
          const val = Number(feat.properties[activeAttr]) || 0;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        });

        if (minVal === Infinity) minVal = 0;
        if (maxVal === -Infinity) maxVal = 1;
        if (minVal === maxVal) maxVal = minVal + 1;

        const deltaLng = Math.abs(shapefileData.bounds.east - shapefileData.bounds.west);
        const deltaLat = Math.abs(shapefileData.bounds.north - shapefileData.bounds.south);
        const maxBoundsSpan = Math.max(deltaLng, deltaLat);
        const maxExtrusionHeight = Math.max(500, Math.min(500000, maxBoundsSpan * 111000 * 0.25));

        // Parse min/max colors for lerping or CAD customization
        let minCesiumColor = Cesium.Color.fromCssColorString('#FF5733');
        try {
          minCesiumColor = Cesium.Color.fromCssColorString(layer.customColor || layer.choroplethMinColor || '#FF5733');
        } catch (_) {}

        let maxCesiumColor = Cesium.Color.fromCssColorString('#00E676');
        try {
          maxCesiumColor = Cesium.Color.fromCssColorString(layer.customColor || layer.choroplethMaxColor || '#00E676');
        } catch (_) {}

        const lerpColor = (t: number, cMin: Cesium.Color, cMax: Cesium.Color) => {
          const r = cMin.red + t * (cMax.red - cMin.red);
          const g = cMin.green + t * (cMax.green - cMin.green);
          const b = cMin.blue + t * (cMax.blue - cMin.blue);
          return new Cesium.Color(r, g, b, 1.0);
        };

        const firstFeat = shapefileData.features[0];
        const isPolylineLayer = firstFeat && firstFeat.isLine;

        shapefileData.features.forEach((feat, idx) => {
          const value = Number(feat.properties[activeAttr]) || 0;
          
          const finalAlpha = layer.customAlpha !== undefined ? layer.customAlpha : layer.opacity;
          
          let color: Cesium.Color;
          if (isChoropleth) {
            const t = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
            const interpolated = lerpColor(t, minCesiumColor, maxCesiumColor);
            color = interpolated.withAlpha(finalAlpha);
          } else {
            const isCad = layer.shapefileData?.isCad || layer.name?.toLowerCase().endsWith('.dxf');
            const defaultCadColor = isCad ? '#000000' : getMetricColor(value, minVal, maxVal);
            const colorHex = layer.customColor || defaultCadColor;
            let parsedColor = Cesium.Color.BLACK;
            try {
              parsedColor = Cesium.Color.fromCssColorString(colorHex);
            } catch (_) {
              try {
                parsedColor = Cesium.Color.fromCssColorString(defaultCadColor);
              } catch (__) {}
            }
            color = parsedColor.withAlpha(finalAlpha);
          }

          if (feat.isLine) {
            const polylinePositions = feat.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
            const isUtilityLayer = layer.name?.toLowerCase().includes('utility') || 
                                   layer.name?.toLowerCase().includes('pipe') || 
                                   layer.name?.toLowerCase().includes('sewer') || 
                                   layer.name?.toLowerCase().includes('conduit') || 
                                   layer.name?.toLowerCase().includes('gas') || 
                                   layer.name?.toLowerCase().includes('water') || 
                                   layer.name?.toLowerCase().includes('electric');

            const is3DVolume = layer.lineType === '3D Volumetric Pipe' || isUtilityLayer;

            let entity;
            if (is3DVolume) {
              // Determine pipe diameter from shapefile attributes (e.g. 'DIAMETER', 'PIPE_SIZE') or fallback
              const rawDiameter = feat.properties?.DIAMETER || feat.properties?.diameter || feat.properties?.PIPE_SIZE || feat.properties?.pipe_size;
              const pipeDiameter = (rawDiameter !== undefined) ? Number(rawDiameter) : ((layer.lineWidth || 3) * 0.3);
              const pipeRadius = pipeDiameter / 2;

              // Color code by utility type (Water = Blue, Electric = Red, Gas = Yellow, Sewer = Green)
              let pipeColor = color; // fallback to the layer's/metric's default color
              const utilityType = String(feat.properties?.TYPE || feat.properties?.type || feat.properties?.UTILITY || feat.properties?.utility || layer.name || '').toLowerCase();
              
              if (utilityType.includes('water')) pipeColor = Cesium.Color.BLUE.withAlpha(finalAlpha);
              else if (utilityType.includes('electric') || utilityType.includes('power')) pipeColor = Cesium.Color.RED.withAlpha(finalAlpha);
              else if (utilityType.includes('gas') || utilityType.includes('fuel')) pipeColor = Cesium.Color.YELLOW.withAlpha(finalAlpha);
              else if (utilityType.includes('sewer') || utilityType.includes('drain')) pipeColor = Cesium.Color.GREEN.withAlpha(finalAlpha);

              entity = viewer.entities.add({
                id: `shapefile-feature-${layer.id}-${feat.id}`,
                polylineVolume: {
                  positions: polylinePositions,
                  shape: createPipeShape(pipeRadius, 8),
                  material: new Cesium.ColorMaterialProperty(pipeColor),
                  outline: true,
                  outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
                  outlineWidth: 1.0,
                  cornerType: Cesium.CornerType.ROUNDED,
                  shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED
                },
                properties: new Cesium.PropertyBag(feat.properties)
              });
            } else {
              // Polyline styling (standard 2D lines)
              const strokeWidth = layer.lineWidth || 3;
              let materialProperty: any = new Cesium.ColorMaterialProperty(color);

              if (layer.lineType === 'Dashed') {
                materialProperty = new Cesium.PolylineDashMaterialProperty({
                  color: color,
                  gapColor: Cesium.Color.TRANSPARENT,
                  dashLength: 16
                });
              } else if (layer.lineType === 'Glowing Vector') {
                materialProperty = new Cesium.PolylineGlowMaterialProperty({
                  color: color,
                  glowPower: 0.25,
                  taperPower: 1.0
                });
              }

              const featProps = {
                ...(feat.properties || {}),
                LAYER: feat.properties?.LAYER || feat.properties?.layer || feat.properties?.ZONING || layer.name || 'Default Layer',
                SOURCE_FILE: feat.properties?.SOURCE_FILE || feat.properties?.source_file || layer.name || 'Imported Layer'
              };

              entity = viewer.entities.add({
                id: `shapefile-feature-${layer.id}-${feat.id}`,
                polyline: {
                  positions: polylinePositions,
                  width: strokeWidth,
                  material: materialProperty,
                  clampToGround: true
                },
                properties: new Cesium.PropertyBag(featProps)
              });
            }

            newEntities.push(entity);
          } else {
            // Dual Polygon + Ground Polyline Setup for Polygon Shapefile Features:
            const outerPositions = feat.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
            const holesList = feat.holes?.map(h => {
              return new Cesium.PolygonHierarchy(h.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
            }) || [];

            const hierarchy = new Cesium.PolygonHierarchy(outerPositions, holesList);

            // Close outer ring boundary for ground polyline
            const closedOuter = [...feat.positions];
            if (closedOuter.length > 0) {
              const first = closedOuter[0];
              const last = closedOuter[closedOuter.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                closedOuter.push(first);
              }
            }
            const polylinePositions = closedOuter.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));

            const isNoneMode = layer.visualizationMode === 'none';

            // In 'none' mode, default fill is false unless explicitly enabled by user in Layer Style panel
            let isShowFill = layer.showFill !== undefined ? layer.showFill : (!isNoneMode);

            const strokeWidth = layer.strokeWidth !== undefined ? layer.strokeWidth : (layer.lineWidth || 2.5);
            const isShowBorder = layer.showBorder !== undefined 
              ? layer.showBorder 
              : (layer.showStroke !== undefined ? layer.showStroke : true);
            const borderOpacity = layer.borderOpacity !== undefined 
              ? layer.borderOpacity 
              : (layer.strokeOpacity !== undefined ? layer.strokeOpacity : 1.0);

            let strokeCesiumColor = Cesium.Color.WHITE.withAlpha(borderOpacity);
            if (layer.strokeColor) {
              try {
                strokeCesiumColor = Cesium.Color.fromCssColorString(layer.strokeColor).withAlpha(borderOpacity);
              } catch (_) {}
            }

            // Fill color with layer styling override if configured
            let finalFillColor = color;
            let currentFillOpacity = finalAlpha;
            if (layer.fillColor) {
              try {
                const fillOpacity = layer.fillOpacity !== undefined ? layer.fillOpacity : layer.opacity;
                currentFillOpacity = fillOpacity;
                finalFillColor = Cesium.Color.fromCssColorString(layer.fillColor).withAlpha(fillOpacity);
              } catch (_) {}
            } else if (layer.fillOpacity !== undefined) {
              currentFillOpacity = layer.fillOpacity;
              finalFillColor = color.withAlpha(layer.fillOpacity);
            }

            // Zero Opacity / Hidden Fill Fix:
            // In Cesium, setting fill: true with alpha: 0 STILL executes terrain classification stencil passes or 3D volume passes!
            // When opacity is 0, or isShowFill is false, or in 'none' mode without explicit showFill, disable fill completely:
            if (currentFillOpacity <= 0 || !isShowFill || (isNoneMode && layer.showFill !== true)) {
              isShowFill = false;
            }

            const polygonGraphics: any = {
              hierarchy: hierarchy,
              fill: isShowFill,
              material: new Cesium.ColorMaterialProperty(finalFillColor),
              outline: false, // Handled by ground polyline to support user-defined strokeWidth (circumventing WebGL 1px restriction)
              shadows: (sunShadowsEnabled || rtxUltraEnabled) && isShowFill ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
            };

            // In 'none' mode, do NOT extrude 3D heights so the mesh is completely hidden/flattened, allowing clean manual styling
            const shouldExtrude = extrudeHeights && !isNoneMode;

            if (shouldExtrude) {
              const t = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
              const heightVal = Math.max(10, t * maxExtrusionHeight);
              polygonGraphics.height = 0;
              
              const selectedHeightAttribute = activeAttr;
              const feature = feat;
              polygonGraphics.extrudedHeight = new Cesium.CallbackProperty(() => {
                const rawHeight = parseFloat(feature.properties[selectedHeightAttribute]) || 10;
                const proportionalHeight = heightVal;
                return proportionalHeight * shapefileHeightMultiplierRef.current;
              }, false);

              polygonGraphics.extrusionHeight = new Cesium.CallbackProperty(() => {
                const rawHeight = parseFloat(feature.properties[selectedHeightAttribute]) || 10;
                const proportionalHeight = heightVal;
                return proportionalHeight * shapefileHeightMultiplierRef.current;
              }, false);
            } else {
              // Flattened/draped on terrain ONLY (clampToGround)
              polygonGraphics.classificationType = Cesium.ClassificationType.TERRAIN;
            }

            // 3D Attribute Label configuration
            const showLabel = Boolean(layer.showLabel);
            const labelAttr = layer.labelField || layer.filterField;
            let labelText = '';
            if (showLabel && labelAttr && feat.properties) {
              const pVal = feat.properties[labelAttr];
              if (pVal !== undefined && pVal !== null) {
                labelText = String(pVal);
              }
            }

            const fontHeight = layer.labelFontHeight || 14;
            const fontStyle = layer.labelFontStyle || 'bold';
            const fontFamily = layer.labelFontFamily || 'sans-serif';
            const fontString = `${fontStyle === 'bold' ? 'bold ' : fontStyle === 'italic' ? 'italic ' : fontStyle === 'bold italic' ? 'bold italic ' : ''}${fontHeight}px ${fontFamily}`;
            let labelColor = Cesium.Color.WHITE;
            try {
              if (layer.labelFontColor) labelColor = Cesium.Color.fromCssColorString(layer.labelFontColor);
            } catch (_) {}

            let outlineColor = Cesium.Color.BLACK;
            try {
              if (layer.labelOutlineColor) outlineColor = Cesium.Color.fromCssColorString(layer.labelOutlineColor);
            } catch (_) {}

            const outlineWidth = layer.labelOutlineWidth !== undefined ? layer.labelOutlineWidth : 2.5;
            const elevationOffset = layer.labelElevationOffset !== undefined ? layer.labelElevationOffset : 5;

            // Compute center Cartesian position for the label
            let centerPos: Cesium.Cartesian3 | undefined = undefined;
            if (feat.center) {
              centerPos = Cesium.Cartesian3.fromDegrees(feat.center[0], feat.center[1], elevationOffset);
            } else if (feat.positions && feat.positions.length > 0) {
              centerPos = Cesium.Cartesian3.fromDegrees(feat.positions[0][0], feat.positions[0][1], elevationOffset);
            }

            const polygonFeatProps = {
              ...(feat.properties || {}),
              LAYER: feat.properties?.LAYER || feat.properties?.layer || feat.properties?.ZONING || layer.name || 'Default Layer',
              SOURCE_FILE: feat.properties?.SOURCE_FILE || feat.properties?.source_file || layer.name || 'Imported Layer'
            };

            const entity = viewer.entities.add({
              id: `shapefile-feature-${layer.id}-${feat.id}`,
              position: centerPos,
              polygon: polygonGraphics,
              polyline: ((!shouldExtrude || isNoneMode) && isShowBorder && borderOpacity > 0) ? {
                positions: polylinePositions,
                width: strokeWidth,
                material: new Cesium.ColorMaterialProperty(strokeCesiumColor),
                clampToGround: true,
                shadows: Cesium.ShadowMode.DISABLED
              } : undefined,
              label: (showLabel && labelText) ? {
                text: labelText,
                font: fontString,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: labelColor,
                outlineColor: outlineColor,
                outlineWidth: outlineWidth,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                pixelOffset: new Cesium.Cartesian2(0, -elevationOffset * 2),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80000)
              } : undefined,
              properties: new Cesium.PropertyBag(polygonFeatProps)
            });

            // Dynamic Attribute Query & Filter
            if (layer.filterField && layer.filterValue && layer.filterValue !== 'ALL' && layer.filterValue !== 'Show All') {
              const rawProp = feat.properties?.[layer.filterField];
              const strProp = rawProp !== undefined && rawProp !== null ? String(rawProp).trim() : '';
              entity.show = (strProp === layer.filterValue);
            }

            newEntities.push(entity);
          }
        });

        gisLayersEntitiesRef.current.set(layer.id, newEntities);

        // B. Render GroundPrimitive drape boundary ONLY if there are no individual feature entities in this layer
        if (!isPolylineLayer && newEntities.length === 0 && polygonData.positions && polygonData.positions.length >= 3 && layer.visualizationMode !== 'none' && layer.showFill !== false && layer.opacity > 0) {
          const outerPositions = polygonData.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
          const holesList = polygonData.holes?.map(h => {
            return new Cesium.PolygonHierarchy(h.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
          }) || [];

          const hierarchy = new Cesium.PolygonHierarchy(outerPositions, holesList);

          const polygonGeometry = new Cesium.PolygonGeometry({
            polygonHierarchy: hierarchy,
            vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
          });

          const isCadLayer = layer.shapefileData?.isCad || layer.name?.toLowerCase().endsWith('.dxf');
          const drapeColor = layer.customColor ? Cesium.Color.fromCssColorString(layer.customColor) : (isCadLayer ? Cesium.Color.BLACK : new Cesium.Color(0.06, 0.49, 1.0));
          const material = Cesium.Material.fromType('Color', {
            color: drapeColor.withAlpha(0.3 * layer.opacity)
          });

          const appearance = new Cesium.EllipsoidSurfaceAppearance({
            material: material,
            flat: !(sunShadowsEnabled || rtxUltraEnabled),
            aboveGround: false,
            translucent: true
          });

          const groundPrimitive = new Cesium.GroundPrimitive({
            geometryInstances: new Cesium.GeometryInstance({
              geometry: polygonGeometry
            }),
            appearance: appearance,
            classificationType: Cesium.ClassificationType.TERRAIN,
            asynchronous: false
          });
          (groundPrimitive as any).shadows = (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.RECEIVE_ONLY : Cesium.ShadowMode.DISABLED;

          viewer.scene.primitives.add(groundPrimitive);
          gisLayersPrimitivesRef.current.set(layer.id, groundPrimitive);
        }

        // C. Render Catchment Radius Buffer Zone
        if (layer.catchmentRadius && layer.catchmentRadius > 0) {
          const bufferInstances: Cesium.GeometryInstance[] = [];

          shapefileData.features.forEach(feat => {
            const positions = feat.positions;
            if (!positions || positions.length === 0) return;

            // Close the ring if not already closed
            const closed = [...positions];
            const first = closed[0];
            const last = closed[closed.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              closed.push([first[0], first[1]]);
            }

            try {
              // Construct a valid turf Polygon feature
              const turfPoly = turf.polygon([
                closed,
                ...(feat.holes || []).map(h => {
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

              // Calculate buffer using turf
              const buffered = turf.buffer(turfPoly, layer.catchmentRadius!, { units: 'meters' });

              if (buffered && buffered.geometry) {
                const geom = buffered.geometry;
                if (geom.type === 'Polygon') {
                  const coords = geom.coordinates;
                  const outerDegrees = coords[0] as [number, number][];
                  const outerCartesians = outerDegrees.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
                  const holesCartesiansList = coords.slice(1).map(hCoords => {
                    const hDegrees = hCoords as [number, number][];
                    return new Cesium.PolygonHierarchy(hDegrees.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
                  });
                  const hierarchy = new Cesium.PolygonHierarchy(outerCartesians, holesCartesiansList);
                  
                  bufferInstances.push(new Cesium.GeometryInstance({
                    geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: hierarchy,
                      vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
                    })
                  }));
                } else if (geom.type === 'MultiPolygon') {
                  const polys = geom.coordinates;
                  polys.forEach(polyCoords => {
                    const outerDegrees = polyCoords[0] as [number, number][];
                    const outerCartesians = outerDegrees.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
                    const holesCartesiansList = polyCoords.slice(1).map(hCoords => {
                      const hDegrees = hCoords as [number, number][];
                      return new Cesium.PolygonHierarchy(hDegrees.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
                    });
                    const hierarchy = new Cesium.PolygonHierarchy(outerCartesians, holesCartesiansList);
                    
                    bufferInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({
                        polygonHierarchy: hierarchy,
                        vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
                      })
                    }));
                  });
                }
              }
            } catch (e) {
              console.warn("Failed to generate buffer for feature:", feat.id, e);
            }
          });

          if (bufferInstances.length > 0) {
            // Determine catchment style color
            const stylingPreset = layer.catchmentColor || 'Walking Radius - Translucent Blue';
            
            let bufferColor = new Cesium.Color(0.23, 0.51, 0.96, 0.35); // Blue by default
            if (stylingPreset === 'Impact Zone - Translucent Red') {
              bufferColor = new Cesium.Color(0.93, 0.26, 0.26, 0.35);
            } else if (stylingPreset === 'Buffer Zone - Translucent Green') {
              bufferColor = new Cesium.Color(0.06, 0.72, 0.5, 0.35);
            } else if (stylingPreset === 'Service Area - Translucent Purple') {
              bufferColor = new Cesium.Color(0.54, 0.36, 0.96, 0.35);
            } else if (stylingPreset === 'Hotspot - Translucent Amber') {
              bufferColor = new Cesium.Color(0.96, 0.62, 0.04, 0.35);
            }

            const bufferMaterial = Cesium.Material.fromType('Color', {
              color: bufferColor
            });

            const bufferAppearance = new Cesium.EllipsoidSurfaceAppearance({
              material: bufferMaterial,
              flat: !(sunShadowsEnabled || rtxUltraEnabled),
              aboveGround: false,
              translucent: true
            });

            const catchmentGroundPrimitive = new Cesium.GroundPrimitive({
              geometryInstances: bufferInstances,
              appearance: bufferAppearance,
              classificationType: Cesium.ClassificationType.TERRAIN,
              asynchronous: false
            });
            (catchmentGroundPrimitive as any).shadows = (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.RECEIVE_ONLY : Cesium.ShadowMode.DISABLED;

            viewer.scene.primitives.add(catchmentGroundPrimitive);
            gisLayersCatchmentPrimitivesRef.current.set(layer.id, catchmentGroundPrimitive);
          }
        }

      } catch (err) {
        console.error('Failed to render GIS Layer:', layer.name, err);
      }
    });

    viewer.scene.requestRender();

    return () => {
      // Clean up all on unmount
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      gisLayersEntitiesRef.current.forEach(entities => {
        entities.forEach(ent => {
          try {
            if (viewer && !viewer.isDestroyed() && viewer.entities) {
              viewer.entities.remove(ent);
            }
          } catch (_) {}
        });
      });
      gisLayersEntitiesRef.current.clear();

      gisLayersPrimitivesRef.current.forEach(prim => {
        try {
          if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
            viewer.scene.primitives.remove(prim);
          }
        } catch (_) {}
      });
      gisLayersPrimitivesRef.current.clear();

      gisLayersCatchmentPrimitivesRef.current.forEach(prim => {
        try {
          if (viewer && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
            viewer.scene.primitives.remove(prim);
          }
        } catch (_) {}
      });
      gisLayersCatchmentPrimitivesRef.current.clear();
    };

  }, [gisLayers, selectedMetric, extrudeHeights, isInitializing, sunShadowsEnabled, rtxUltraEnabled, loadedTextureImage]);

  // Handle camera flying to specific GIS Layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToLayerBounds || flyToLayerTrigger === 0) return;

    try {
      const west = flyToLayerBounds.west !== undefined ? flyToLayerBounds.west : flyToLayerBounds.minLon;
      const south = flyToLayerBounds.south !== undefined ? flyToLayerBounds.south : flyToLayerBounds.minLat;
      const east = flyToLayerBounds.east !== undefined ? flyToLayerBounds.east : flyToLayerBounds.maxLon;
      const north = flyToLayerBounds.north !== undefined ? flyToLayerBounds.north : flyToLayerBounds.maxLat;

      if (west === undefined || south === undefined || east === undefined || north === undefined) return;

      const rect = Cesium.Rectangle.fromDegrees(west, south, east, north);

      const centerLat = (south + north) / 2;
      const dLngMeters = Math.abs(east - west) * 111320 * Math.cos((centerLat * Math.PI) / 180);
      const dLatMeters = Math.abs(north - south) * 111320;
      const sizeMeters = Math.max(dLngMeters, dLatMeters, 20.0);

      const boundingSphere = Cesium.BoundingSphere.fromRectangle3D(rect);
      const targetRadius = Math.max(boundingSphere.radius, sizeMeters / 2, 25.0);
      const cameraRange = Math.max(targetRadius * 2.2, 120.0);

      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 2.0,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-45),
          cameraRange
        )
      });
    } catch (err) {
      console.error('Failed flying to GIS layer bounds:', err);
    }
  }, [flyToLayerBounds, flyToLayerTrigger]);

  // Handle layer reordering inside Cesium viewer scene primitives collection
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !layersOrder || layersOrder.length === 0) return;

    try {
      // Raise primitives to top in the exact sequence of layersOrder (from index 0 to last)
      // The last raised item will sit on top of the visual stack.
      layersOrder.forEach(item => {
        let primitive: any = null;

        try {
          if (item.type === 'gis') {
            primitive = gisLayersPrimitivesRef.current.get(item.id);
          } else if (item.type === 'i3s') {
            const i3sLyr = (i3sLayers || []).find(l => l.id === item.id);
            if (i3sLyr) {
              primitive = i3sLyr.provider;
            }
          } else if (item.type === 'imported_tileset') {
            primitive = tilesetsMapRef.current.get(item.id);
          } else if (item.type === 'active_tileset') {
            const actLyr = (activeLayers || []).find(l => l.id === item.id);
            if (actLyr) {
              primitive = actLyr.instance;
            }
          }

          if (primitive && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
            if (viewer.scene.primitives.contains(primitive)) {
              viewer.scene.primitives.raiseToTop(primitive);
            }
          }

          // Also raise the corresponding catchment primitive for GIS layers if it exists
          if (item.type === 'gis') {
            const catchmentPrimitive = gisLayersCatchmentPrimitivesRef.current.get(item.id);
            if (catchmentPrimitive && !viewer.isDestroyed() && viewer.scene && !viewer.scene.isDestroyed() && viewer.scene.primitives) {
              if (viewer.scene.primitives.contains(catchmentPrimitive)) {
                viewer.scene.primitives.raiseToTop(catchmentPrimitive);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to apply raiseToTop for layer:', item.id, err);
        }
      });
    } catch (globalErr) {
      console.error('Global layer reordering error:', globalErr);
    }
  }, [layersOrder, gisLayers, i3sLayers, importedLayers, activeLayers, isInitializing]);

  // Handle globe hover tooltips for Multi-Layer GIS and fallback Shapefile entities
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      if (!viewer || viewer.isDestroyed() || !viewer.scene || viewer.scene.isDestroyed()) return;
      
      try {
        const pickedObject = viewer.scene.pick(movement.endPosition);
        
        // 1. Check for Overpass POIs
        if (
          Cesium.defined(pickedObject) &&
          pickedObject.id instanceof Cesium.Entity &&
          pickedObject.id.id &&
          String(pickedObject.id.id).startsWith('overpass-poi-')
        ) {
          const entity = pickedObject.id;
          
          // Trigger scale pulse / animation
          if (hoveredPOIEntityRef.current !== entity) {
            // Restore previous
            if (hoveredPOIEntityRef.current && !hoveredPOIEntityRef.current.isDestroyed?.()) {
              try {
                hoveredPOIEntityRef.current.billboard.scale = 1.0 as any;
              } catch (e) {}
            }
            
            // Set new pulse animation
            hoveredPOIEntityRef.current = entity;
            const startTime = Date.now();
            entity.billboard.scale = new Cesium.CallbackProperty(() => {
              const elapsed = (Date.now() - startTime) / 1000;
              return 1.15 + 0.12 * Math.sin(elapsed * 7); // oscillates between 1.03 and 1.27
            }, false) as any;
          }

          // Calculate precise screen position immediately above the marker
          let tx = movement.endPosition.x;
          let ty = movement.endPosition.y;
          if (entity.position) {
            const pos = typeof entity.position.getValue === 'function' ? entity.position.getValue(viewer.clock.currentTime) : entity.position;
            if (pos) {
              const screenPos = (Cesium.SceneTransforms as any).wgs84ToWindowCoordinates(viewer.scene, pos);
              if (screenPos) {
                tx = screenPos.x;
                ty = screenPos.y;
              }
            }
          }

          const poiIdStr = String(entity.id).replace('overpass-poi-', '');
          const matchedPOI = (currentLandmarks || []).find((p: any) => String(p.id) === poiIdStr);

          setHoveredPOITooltip({
            x: tx,
            y: ty - 42, // offset immediately above the billboard marker
            name: entity.name || 'Historic Landmark',
            type: matchedPOI?.tags?.historic || matchedPOI?.tags?.tourism || 'Landmark',
            coordinates: matchedPOI ? `${matchedPOI.lat.toFixed(5)}° N, ${matchedPOI.lon.toFixed(5)}° E` : ''
          });

          // Clear any shapefile tooltip
          setHoveredTooltip(null);
          return;
        }
      } catch (err) {
        // Fallback
      }

      // If we got here, we are not hovering over an Overpass POI
      if (hoveredPOIEntityRef.current) {
        if (!hoveredPOIEntityRef.current.isDestroyed?.()) {
          try {
            hoveredPOIEntityRef.current.billboard.scale = 1.0 as any;
          } catch (e) {}
        }
        hoveredPOIEntityRef.current = null;
      }
      setHoveredPOITooltip(null);

      const hasGisLayers = gisLayers && gisLayers.length > 0;
      if (!shapefileData && !hasGisLayers) {
        setHoveredTooltip(null);
        return;
      }

      try {
        const pickedObject = viewer.scene.pick(movement.endPosition);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id && String(pickedObject.id.id).startsWith('shapefile-feature-')) {
          const fullId = String(pickedObject.id.id).replace('shapefile-feature-', '');
          
          // 1. Try matching with multi-layer GIS layers
          let foundFeature: ShapefileFeature | null = null;
          let foundLayerName = '';
          
          if (hasGisLayers) {
            for (const layer of gisLayers) {
              if (!layer.visible) continue;
              const prefix = `${layer.id}-`;
              if (fullId.startsWith(prefix)) {
                const featId = fullId.slice(prefix.length);
                const feat = layer.shapefileData?.features?.find((f: any) => String(f.id) === featId);
                if (feat) {
                  foundFeature = feat;
                  foundLayerName = layer.name;
                  break;
                }
              }
            }
          }

          // 2. Fall back to old single shapefileData
          if (!foundFeature && shapefileData) {
            foundFeature = shapefileData.features.find(f => String(f.id) === fullId) || null;
            foundLayerName = 'Site Boundary';
          }

          if (foundFeature) {
            const val = foundFeature.properties[selectedMetric] !== undefined ? foundFeature.properties[selectedMetric] : 'N/A';
            const label = getFeatureLabel(foundFeature, shapefileData ? shapefileData.features.indexOf(foundFeature) : 0);
            setHoveredTooltip({
              x: movement.endPosition.x,
              y: movement.endPosition.y,
              label: `${label} (${foundLayerName})`,
              metric: selectedMetric,
              value: typeof val === 'number' ? val.toLocaleString() : val,
              properties: foundFeature.properties
            });
            return;
          }
        }
      } catch (err) {
        // Fallback
      }
      setHoveredTooltip(null);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      if (!handler.isDestroyed()) {
        handler.destroy();
      }
      setHoveredTooltip(null);
      setHoveredPOITooltip(null);
      if (hoveredPOIEntityRef.current && !hoveredPOIEntityRef.current.isDestroyed?.()) {
        try {
          hoveredPOIEntityRef.current.billboard.scale = 1.0 as any;
        } catch (e) {}
      }
      hoveredPOIEntityRef.current = null;
    };
  }, [gisLayers, shapefileData, selectedMetric, currentLandmarks]);

  // Handle Camera Fly-To on specific feature select from dashboard
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToFeature || flyToFeatureTrigger === 0) return;

    try {
      const rect = Cesium.Rectangle.fromDegrees(
        flyToFeature.bounds.west,
        flyToFeature.bounds.south,
        flyToFeature.bounds.east,
        flyToFeature.bounds.north
      );

      const boundingSphere = Cesium.BoundingSphere.fromRectangle3D(rect);

      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 2.5,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-40),
          boundingSphere.radius * 2.5
        )
      });
    } catch (err) {
      console.error('Failed flying to feature zone:', err);
    }
  }, [flyToFeature, flyToFeatureTrigger]);

  // Handle fly-to actions from sidebar
  useEffect(() => {
    const viewer = viewerRef.current;
    const preset = selectedPresetRef.current;
    const sDate = selectedDateRef.current;
    if (!viewer || !preset || !flyToPresetTrigger) return;

    // Force shadows and lighting to update immediately
    viewer.shadows = true;
    viewer.scene.shadowMap.enabled = true;
    viewer.scene.globe.enableLighting = true;
    
    // Also update any tileset shadows
    const applyShadows = (tileset: any) => {
      if (tileset && !tileset.isDestroyed()) {
        tileset.shadows = Cesium.ShadowMode.ENABLED;
      }
    };
    applyShadows(leftBuildingsTilesetRef.current);
    applyShadows(rightBuildingsTilesetRef.current);
    applyShadows(leftGoogleTilesetRef.current);
    applyShadows(rightGoogleTilesetRef.current);

    // Calculate and shift the timeline hour to match the target city's current local time
    try {
      const iana = tzlookup(preset.latitude, preset.longitude);
      const targetOffset = getUtcOffsetForTimeZone(iana);
      
      const now = new Date();
      const targetLocalString = now.toLocaleString("en-US", { timeZone: iana });
      const targetLocalDate = new Date(targetLocalString);
      
      const localHour = targetLocalDate.getHours() + 
                        targetLocalDate.getMinutes() / 60 + 
                        targetLocalDate.getSeconds() / 3600;

      const baseDate = new Date(`${sDate}T12:00:00Z`);
      if (isNaN(baseDate.getTime())) {
        baseDate.setTime(new Date('2026-07-04T12:00:00Z').getTime());
      }
      
      const offsetMinutes = Math.round(targetOffset * 60);
      const totalLocalMinutes = Math.floor(localHour * 60);
      const totalUtcMinutes = totalLocalMinutes - offsetMinutes;
      
      baseDate.setUTCHours(0, 0, 0, 0);
      baseDate.setUTCMinutes(totalUtcMinutes);

      viewer.clock.currentTime = Cesium.JulianDate.fromDate(baseDate);
      viewer.clock.shouldAnimate = false;
    } catch (e) {
      console.error('Failed to instantly sync clock in CesiumGlobe:', e);
    }

    viewer.scene.requestRender();

    const targetHeading = typeof preset.heading === 'number' ? preset.heading : 0.0;
    const targetPitch = typeof preset.pitch === 'number' ? preset.pitch : -45.0;
    const targetRoll = typeof preset.roll === 'number' ? preset.roll : 0.0;

    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          preset.longitude,
          preset.latitude,
          preset.height
        ),
        orientation: {
          heading: Cesium.Math.toRadians(targetHeading),
          pitch: Cesium.Math.toRadians(targetPitch),
          roll: Cesium.Math.toRadians(targetRoll)
        },
        duration: 3.5, // 3.5 second ultra smooth animation flight
        complete: () => {
          // We do NOT clear the preset here anymore to prevent resetting timezone selection state to default (EST)
        },
        cancel: () => {}
      });
    } catch (e) {
      console.warn('flyToPreset camera flight failed:', e);
    }
  }, [flyToPresetTrigger]);

  // Synchronize floating HTML marker's screen-space position
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || activeTool === 'none') {
      setFloatingMarker(null);
      return;
    }

    const updateMarkerPosition = () => {
      if (markerCartesianRef.current) {
        const transformFn = (Cesium.SceneTransforms as any)?.wgs84ToWindowCoordinates || (Cesium.SceneTransforms as any)?.worldToWindowCoordinates;
        const screenPos = transformFn ? transformFn(viewer.scene, markerCartesianRef.current) : null;
        if (screenPos) {
          setFloatingMarker(prev => {
            const text = prev ? prev.text : '';
            return { x: screenPos.x, y: screenPos.y, text, visible: true };
          });
        } else {
          setFloatingMarker(prev => prev ? { ...prev, visible: false } : null);
        }
      } else {
        setFloatingMarker(null);
      }
    };

    const removePostRenderListener = viewer.scene.postRender.addEventListener(updateMarkerPosition);

    return () => {
      removePostRenderListener();
    };
  }, [activeTool]);

  // Realistic Day-Night Lighting Cycle
  const updateLighting = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!realisticLighting) {
      // Restore standard global ambient illumination
      if (!(viewer.scene.light instanceof Cesium.SunLight)) {
        viewer.scene.light = new Cesium.SunLight();
      }
      viewer.scene.light.intensity = 2.0 * (ambientLightingIntensity / 0.5);
      const ambVal = Math.min(1.0, ambientLightingIntensity);
      viewer.scene.globe.ambientColor = new Cesium.Color(ambVal, ambVal, ambVal, 1.0);
      viewer.scene.skyAtmosphere.show = globeState.atmosphereEnabled;
      viewer.scene.globe.dynamicAtmosphereLighting = false;
      
      // Let enableLighting default back to standard shadows preference
      viewer.scene.globe.enableLighting = sunShadowsEnabled || rtxUltraEnabled;
      viewer.scene.requestRender();
      return;
    }

    // 1. Force core globe lighting & High Dynamic Range & Atmosphere shading
    viewer.scene.globe.enableLighting = true;
    viewer.scene.highDynamicRange = true;

    // 2. Determine observer latitude and longitude
    let obsLat = 37.774929;
    let obsLng = -122.419416;

    if (activeAnalysisCenter) {
      obsLat = activeAnalysisCenter.latitude;
      obsLng = activeAnalysisCenter.longitude;
    } else if (selectedPreset) {
      obsLat = selectedPreset.latitude;
      obsLng = selectedPreset.longitude;
    } else {
      const cameraCartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(viewer.camera.position);
      if (cameraCartographic) {
        obsLat = Cesium.Math.toDegrees(cameraCartographic.latitude);
        obsLng = Cesium.Math.toDegrees(cameraCartographic.longitude);
      }
    }

    // 3. Get UTC date from selectedDate and sunHour directly to avoid any race condition
    const baseDate = new Date(`${selectedDate}T12:00:00Z`);
    if (isNaN(baseDate.getTime())) {
      baseDate.setTime(new Date('2026-07-04T12:00:00Z').getTime());
    }
    const offsetMinutes = Math.round(timezoneOffset * 60);
    const totalLocalMinutes = Math.floor(sunHour * 60);
    const totalUtcMinutes = totalLocalMinutes - offsetMinutes;
    
    baseDate.setUTCHours(0, 0, 0, 0); // Start of day in UTC
    baseDate.setUTCMinutes(totalUtcMinutes);

    const date = baseDate;

    // 4. Calculate solar declination
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const diffTime = date.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const declinationDeg = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * Math.PI / 180);

    const latRad = obsLat * Math.PI / 180;
    const decRad = declinationDeg * Math.PI / 180;

    // 5. Calculate local hour using timezoneOffset
    const localHour = sunHour;

    // 6. Calculate hour angle and sun altitude
    const hourAngleRad = (localHour - 12) * 15 * Math.PI / 180;
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
    const altitudeRad = Math.asin(Cesium.Math.clamp(sinAlt, -1.0, 1.0));
    const altitudeDeg = altitudeRad * 180 / Math.PI;

    // 7. Smoothly interpolate ambientColor and lightIntensity
    let ambient;
    let lightIntensity;
    let useDirectionalNightLight = false;

    if (altitudeDeg >= 0) {
      // Day time
      if (!(viewer.scene.light instanceof Cesium.SunLight)) {
        viewer.scene.light = new Cesium.SunLight();
      }
      const ambVal = Math.min(1.0, ambientLightingIntensity);
      ambient = new Cesium.Color(ambVal, ambVal, ambVal, 1.0);
      lightIntensity = 2.0 * (ambientLightingIntensity / 0.5);
      viewer.scene.skyAtmosphere.show = globeState.atmosphereEnabled;
      viewer.scene.globe.dynamicAtmosphereLighting = true;
    } else {
      useDirectionalNightLight = true;
      const baselineFill = Math.max(nightAmbientIntensity, ambientLightingIntensity * 0.3);

      if (altitudeDeg <= -12) {
        // Night time
        ambient = new Cesium.Color(
          baselineFill, 
          baselineFill, 
          baselineFill, 
          1.0
        );
        lightIntensity = baselineFill;
        viewer.scene.skyAtmosphere.show = false;
        viewer.scene.globe.dynamicAtmosphereLighting = false;
      } else {
        // Twilight transition (0 to -12 deg)
        const t = (altitudeDeg - (-12)) / 12;
        const clampedT = Math.max(0, Math.min(1, t));

        const ambVal = Math.min(1.0, ambientLightingIntensity);
        const r = baselineFill + (ambVal - baselineFill) * clampedT;
        const g = baselineFill + (ambVal - baselineFill) * clampedT;
        const b = baselineFill + (ambVal - baselineFill) * clampedT;

        ambient = new Cesium.Color(r, g, b, 1.0);
        lightIntensity = clampedT * (2.0 * (ambientLightingIntensity / 0.5)) + (1.0 - clampedT) * baselineFill;
        viewer.scene.skyAtmosphere.show = clampedT > 0.5 && globeState.atmosphereEnabled;
        viewer.scene.globe.dynamicAtmosphereLighting = clampedT > 0.5;
      }
    }

    // 8. Apply values to scene
    if (useDirectionalNightLight) {
      if (!(viewer.scene.light instanceof Cesium.DirectionalLight)) {
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(0.0, 0.0, -1.0),
          color: new Cesium.Color(1.0, 1.0, 1.0, 1.0),
          intensity: lightIntensity
        });
      }
      
      const obsCartesian = Cesium.Cartesian3.fromDegrees(obsLng, obsLat);
      const normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(obsCartesian, new Cesium.Cartesian3());
      if (normal) {
        const lightDirection = Cesium.Cartesian3.negate(normal, new Cesium.Cartesian3());
        viewer.scene.light.direction = lightDirection;
      }
      viewer.scene.light.intensity = lightIntensity;
      viewer.scene.light.color = new Cesium.Color(1.0, 1.0, 1.0, 1.0);
    } else {
      if (viewer.scene.light) {
        viewer.scene.light.intensity = lightIntensity;
      }
    }

    viewer.scene.globe.ambientColor = ambient;
    viewer.scene.requestRender();
  }, [
    realisticLighting,
    ambientLightingIntensity,
    nightAmbientIntensity,
    activeAnalysisCenter,
    selectedPreset,
    timezoneOffset,
    globeState.atmosphereEnabled,
    sunShadowsEnabled,
    rtxUltraEnabled,
    sunHour,
    selectedDate
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Run once initially or whenever dependent values update
    updateLighting();

    // Hook into the clock tick to continuously evaluate as time flows or animates
    const removeListener = viewer.clock.onTick.addEventListener(updateLighting);

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [updateLighting]);

  // Handle Sun Simulator and Shadows
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Enable / disable shadows
    viewer.shadows = sunShadowsEnabled;
    if (viewer.scene.shadowMap) {
      viewer.scene.shadowMap.enabled = sunShadowsEnabled;
      
      // Shadow custom settings
      viewer.scene.shadowMap.darkness = shadowDarkness;
      viewer.scene.shadowMap.softShadows = softShadows;

      // Fine-tuned shadow bias to completely eliminate shadow acne/moiré stripes on 3D building models and terrain
      const sm = viewer.scene.shadowMap as any;
      sm.bias = shadowBias !== undefined ? shadowBias : 0.005;
      sm.normalOffsetBias = normalOffsetBias !== undefined ? normalOffsetBias : 0.9;
      sm.normalOffset = true;

      // High-Fidelity GPU Automation:
      viewer.scene.shadowMap.size = shadowMapResolution;
      if (rtxUltraEnabled) {
        viewer.scene.shadowMap.maximumDistance = shadowMaxDistance !== undefined ? shadowMaxDistance : 3500;
        viewer.scene.shadowMap.softShadows = true; // High quality PCF soft shadows in RTX Mode
      } else {
        viewer.scene.shadowMap.maximumDistance = shadowMaxDistance !== undefined ? shadowMaxDistance : 5000;
      }
    }
    
    // Enable scene/globe lighting so buildings/terrain react to sun angle
    viewer.scene.globe.enableLighting = sunShadowsEnabled || rtxUltraEnabled || realisticLighting;

    // Apply shadow options on loaded tilesets
    const applyShadowMode = (tileset: Cesium.Cesium3DTileset | null) => {
      if (tileset) {
        tileset.shadows = (sunShadowsEnabled || rtxUltraEnabled)
          ? Cesium.ShadowMode.ENABLED 
          : Cesium.ShadowMode.DISABLED;
      }
    };

    applyShadowMode(leftBuildingsTilesetRef.current);
    applyShadowMode(rightBuildingsTilesetRef.current);
    applyShadowMode(leftGoogleTilesetRef.current);
    applyShadowMode(rightGoogleTilesetRef.current);

    if (drapePrimitiveRef.current) {
      drapePrimitiveRef.current.shadows = (sunShadowsEnabled || rtxUltraEnabled)
        ? Cesium.ShadowMode.RECEIVE_ONLY
        : Cesium.ShadowMode.DISABLED;
    }
    gisLayersDrapePrimitivesRef.current.forEach((prim) => {
      if (prim) {
        prim.shadows = (sunShadowsEnabled || rtxUltraEnabled)
          ? Cesium.ShadowMode.RECEIVE_ONLY
          : Cesium.ShadowMode.DISABLED;
      }
    });
    gisLayersPrimitivesRef.current.forEach(prim => {
      if (prim) {
        prim.shadows = (sunShadowsEnabled || rtxUltraEnabled)
          ? Cesium.ShadowMode.RECEIVE_ONLY
          : Cesium.ShadowMode.DISABLED;
      }
    });

    // Calculate specific date and time based on selectedDate and vary the hour
    const baseDate = new Date(`${selectedDate}T12:00:00Z`);
    if (isNaN(baseDate.getTime())) {
      // Fallback
      baseDate.setTime(new Date('2026-07-04T12:00:00Z').getTime());
    }
    
    // Robust local time to UTC minutes conversion supporting fractional offsets
    const offsetMinutes = Math.round(timezoneOffset * 60);
    const totalLocalMinutes = Math.floor(sunHour * 60);
    const totalUtcMinutes = totalLocalMinutes - offsetMinutes;
    
    baseDate.setUTCHours(0, 0, 0, 0); // Start of day in UTC
    baseDate.setUTCMinutes(totalUtcMinutes);

    viewer.clock.currentTime = Cesium.JulianDate.fromDate(baseDate);
    viewer.clock.shouldAnimate = false;

    // Explicitly update lighting so realistic or default shadows match perfectly
    updateLighting();

    viewer.scene.requestRender();
  }, [sunHour, sunShadowsEnabled, selectedDate, timezoneOffset, rtxUltraEnabled, shadowDarkness, softShadows, shadowBias, normalOffsetBias, shadowMaxDistance, shadowMapResolution, realisticLighting, updateLighting]);

  // 24-Hour Solar Path Rendering
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Helper to clean up existing solar path entities
    const clearSolarPath = () => {
      solarPathEntitiesRef.current.forEach(entity => {
        if (viewer && !viewer.isDestroyed() && viewer.entities) {
          viewer.entities.remove(entity);
        }
      });
      solarPathEntitiesRef.current = [];
    };

    // Always clear first
    clearSolarPath();

    if (!solarPathEnabled) return;

    // Get center position for the active area or preset
    let centerLat = activeAnalysisCenter?.latitude;
    let centerLng = activeAnalysisCenter?.longitude;
    let centerHeight = activeAnalysisCenter?.height ?? 0; // Default Mean Sea Level (0m)

    if (centerLat == null || centerLng == null) {
      const vpCenter = getViewportCenterPosition();
      if (vpCenter) {
        centerLat = vpCenter.latitude;
        centerLng = vpCenter.longitude;
        centerHeight = vpCenter.height ?? 0;
      } else if (polygonData && polygonData.bounds) {
        centerLat = (polygonData.bounds.south + polygonData.bounds.north) / 2;
        centerLng = (polygonData.bounds.west + polygonData.bounds.east) / 2;
        centerHeight = 0;
      } else if (modelUrl && modelLatitude && modelLongitude) {
        centerLat = modelLatitude;
        centerLng = modelLongitude;
        centerHeight = modelHeight ?? 0;
      } else if (selectedPreset) {
        centerLat = selectedPreset.latitude;
        centerLng = selectedPreset.longitude;
        centerHeight = selectedPreset.height ?? 0;
      } else {
        centerLat = 37.774929;
        centerLng = -122.419416;
        centerHeight = 0;
      }
    }

    const centerCartesian = Cesium.Cartesian3.fromDegrees(centerLng, centerLat, centerHeight);
    const transformMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(centerCartesian);

    // Calculate sunrise and sunset hours based on centerLat and selectedDate
    const d = new Date(selectedDate);
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const N = Math.floor(diff / oneDay);
    const declination = 23.45 * Math.sin((360 / 365) * (284 + N) * Math.PI / 180);

    const latRad = centerLat * Math.PI / 180;
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

    // Mathematical local solar position calculator (ENU space -> global ECEF)
    const getLocalSunPosition = (hr: number): Cesium.Cartesian3 => {
      const hourAngleRad = (hr - 12) * 15 * Math.PI / 180;
      
      const sin_el = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
      const el = Math.asin(Cesium.Math.clamp(sin_el, -1.0, 1.0));
      
      const y = -Math.sin(hourAngleRad) * Math.cos(decRad);
      const x = Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(hourAngleRad);
      const az = Math.atan2(y, x);
      
      // Project to local ENU coordinate space with radius
      const localX = solarPathRadius * Math.cos(el) * Math.sin(az);
      const localY = solarPathRadius * Math.cos(el) * Math.cos(az);
      const localZ = solarPathRadius * Math.sin(el);
      
      const localCartesian = new Cesium.Cartesian3(localX, localY, localZ);
      return Cesium.Matrix4.multiplyByPoint(transformMatrix, localCartesian, new Cesium.Cartesian3());
    };

    const dayPoints: Cesium.Cartesian3[] = [];
    const fullOrbitPoints: Cesium.Cartesian3[] = [];

    // Generate Daytime Arc points (sunrise to sunset) using the robust solar geometry
    const daySteps = 60;
    if (dayLength > 0) {
      for (let i = 0; i <= daySteps; i++) {
        const hr = sunriseHour + (i / daySteps) * dayLength;
        dayPoints.push(getLocalSunPosition(hr));
      }
    }

    // Generate Full 24h Orbit points for the dashed orbit path
    const fullSteps = 120;
    for (let i = 0; i <= fullSteps; i++) {
      const hr = (i / fullSteps) * 24;
      fullOrbitPoints.push(getLocalSunPosition(hr));
    }

    // Current Sun Position on the localized solar dome
    const activeSunLocalizedPoint = getLocalSunPosition(sunHour);

    // Determine if sun is above local ground plane horizon using standard elevation angle
    const activeHourAngleRad = (sunHour - 12) * 15 * Math.PI / 180;
    const activeSinEl = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(activeHourAngleRad);
    const activeEl = Math.asin(Cesium.Math.clamp(activeSinEl, -1.0, 1.0));
    const isAboveHorizon = activeEl >= 0.0;

    const entities: Cesium.Entity[] = [];

    // 1. Draw Full Orbit (subtle dashed slate-blue loop)
    if (fullOrbitPoints.length > 1) {
      const fullOrbit = viewer.entities.add({
        name: 'Full 24h Solar Path',
        polyline: {
          positions: fullOrbitPoints,
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#475569').withAlpha(0.4),
            dashLength: 10
          }),
          depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#475569').withAlpha(0.25),
            dashLength: 10
          }),
          zIndex: 99,
          arcType: Cesium.ArcType.NONE
        }
      });
      entities.push(fullOrbit);
    }

    // 2. Draw Daytime Arc (glowing solid golden path above horizon)
    if (dayPoints.length > 1) {
      const dayArc = viewer.entities.add({
        name: 'Daytime Solar Arc',
        polyline: {
          positions: dayPoints,
          width: 4.0,
          material: Cesium.Color.fromCssColorString('#f59e0b'), // Golden amber
          depthFailMaterial: Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.6), // Keep visible when obscured by terrain/buildings
          zIndex: 100, // Guarantee prominence in viewport
          arcType: Cesium.ArcType.NONE
        }
      });
      entities.push(dayArc);
    }

    // 3. Draw Local Ground Horizon Compass Ring
    const ringPoints: Cesium.Cartesian3[] = [];
    const ringSteps = 72;
    for (let i = 0; i <= ringSteps; i++) {
      const angle = (i / ringSteps) * 2 * Math.PI;
      const localPt = new Cesium.Cartesian3(
        solarPathRadius * Math.sin(angle),
        solarPathRadius * Math.cos(angle),
        0.0
      );
      const ecefPt = Cesium.Matrix4.multiplyByPoint(transformMatrix, localPt, new Cesium.Cartesian3());
      ringPoints.push(ecefPt);
    }

    const compassRing = viewer.entities.add({
      name: 'Solar Compass Ground Ring',
      polyline: {
        positions: ringPoints,
        width: 3.0,
        material: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.65), // Slate-gray
        depthFailMaterial: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.3),
        zIndex: 95,
        arcType: Cesium.ArcType.NONE
      }
    });
    entities.push(compassRing);

    // 4. Draw North-South Axis
    const nsPoints: Cesium.Cartesian3[] = [];
    const nsSteps = 20;
    for (let i = 0; i <= nsSteps; i++) {
      const fraction = (i / nsSteps) * 2 - 1; // From -1 to 1
      const localPt = new Cesium.Cartesian3(0.0, solarPathRadius * fraction, 0.0);
      const ecefPt = Cesium.Matrix4.multiplyByPoint(transformMatrix, localPt, new Cesium.Cartesian3());
      nsPoints.push(ecefPt);
    }
    const nsLine = viewer.entities.add({
      name: 'North-South Axis',
      polyline: {
        positions: nsPoints,
        width: 1.5,
        material: Cesium.Color.fromCssColorString('#64748b').withAlpha(0.4),
        depthFailMaterial: Cesium.Color.fromCssColorString('#64748b').withAlpha(0.2),
        zIndex: 90,
        arcType: Cesium.ArcType.NONE
      }
    });
    entities.push(nsLine);

    // 5. Draw East-West Axis
    const ewPoints: Cesium.Cartesian3[] = [];
    const ewSteps = 20;
    for (let i = 0; i <= ewSteps; i++) {
      const fraction = (i / ewSteps) * 2 - 1; // From -1 to 1
      const localPt = new Cesium.Cartesian3(solarPathRadius * fraction, 0.0, 0.0);
      const ecefPt = Cesium.Matrix4.multiplyByPoint(transformMatrix, localPt, new Cesium.Cartesian3());
      ewPoints.push(ecefPt);
    }
    const ewLine = viewer.entities.add({
      name: 'East-West Axis',
      polyline: {
        positions: ewPoints,
        width: 1.5,
        material: Cesium.Color.fromCssColorString('#64748b').withAlpha(0.4),
        depthFailMaterial: Cesium.Color.fromCssColorString('#64748b').withAlpha(0.2),
        zIndex: 90,
        arcType: Cesium.ArcType.NONE
      }
    });
    entities.push(ewLine);

    // 6. Draw Compass Cardinal Direction Ticks
    const directions = [
      { name: 'N', angle: 0, color: Cesium.Color.fromCssColorString('#ef4444') }, // Vibrant red for North
      { name: 'E', angle: Math.PI / 2, color: Cesium.Color.fromCssColorString('#e2e8f0') },
      { name: 'S', angle: Math.PI, color: Cesium.Color.fromCssColorString('#94a3b8') },
      { name: 'W', angle: 3 * Math.PI / 2, color: Cesium.Color.fromCssColorString('#94a3b8') }
    ];
    directions.forEach(dir => {
      // Placing slightly outside the compass ring
      const dirEast = solarPathRadius * 1.1 * Math.sin(dir.angle);
      const dirNorth = solarPathRadius * 1.1 * Math.cos(dir.angle);
      const dirLocal = new Cesium.Cartesian3(dirEast, dirNorth, 0);
      const dirEcef = Cesium.Matrix4.multiplyByPoint(transformMatrix, dirLocal, new Cesium.Cartesian3());

      const dirLabel = viewer.entities.add({
        position: dirEcef,
        label: {
          text: dir.name,
          font: 'bold 12px "JetBrains Mono", monospace',
          fillColor: dir.color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      entities.push(dirLabel);
    });

    // 7. Draw Sunlight Ray Vector (dashed line connecting current sun to ground center)
    const sunRay = viewer.entities.add({
      name: 'Sunlight Ray Vector',
      polyline: {
        positions: [centerCartesian, activeSunLocalizedPoint],
        width: 2.0,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.65), // Golden yellow
          dashLength: 12
        }),
        arcType: Cesium.ArcType.NONE
      }
    });
    entities.push(sunRay);

    // 8. Draw Sun Marker (glowing yellow sphere/point)
    const sunMarker = viewer.entities.add({
      name: 'Simulated Sun Position',
      position: activeSunLocalizedPoint,
      point: {
        pixelSize: isAboveHorizon ? 14 : 10,
        color: isAboveHorizon ? Cesium.Color.fromCssColorString('#fbbf24') : Cesium.Color.fromCssColorString('#64748b'),
        outlineColor: isAboveHorizon ? Cesium.Color.fromCssColorString('#d97706') : Cesium.Color.fromCssColorString('#475569'),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `SUN (${sunHour.toFixed(1)}h)`,
        font: 'bold 10px monospace',
        fillColor: isAboveHorizon ? Cesium.Color.fromCssColorString('#fef08a') : Cesium.Color.fromCssColorString('#cbd5e1'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    entities.push(sunMarker);

    // 9. Interactive 3D Solar Path Origin Transform Gizmo Handles
    const gizmoScale = Math.max(30, solarPathRadius * 0.25);

    // Center Base Handle & Billboard Label
    const centerGizmo = viewer.entities.add({
      id: 'solar-gizmo-handle-center',
      name: 'Solar Path Center Origin Handle',
      position: centerCartesian,
      ellipsoid: {
        radii: new Cesium.Cartesian3(gizmoScale * 0.08, gizmoScale * 0.08, gizmoScale * 0.08),
        material: Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.9), // Gold amber
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `☀️ Solar Arc Base (${centerHeight.toFixed(1)}m MSL)\n[Click & Drag Handles to Place Anywhere]`,
        font: 'bold 11px "JetBrains Mono", monospace',
        fillColor: Cesium.Color.fromCssColorString('#fef08a'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -35),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    entities.push(centerGizmo);

    // East Axis Handle (+X - Red)
    const xEndLocal = new Cesium.Cartesian3(gizmoScale, 0, 0);
    const xEndEcef = Cesium.Matrix4.multiplyByPoint(transformMatrix, xEndLocal, new Cesium.Cartesian3());
    const gizmoX = viewer.entities.add({
      id: 'solar-gizmo-handle-x',
      name: 'Solar Gizmo East Axis',
      position: xEndEcef,
      polyline: {
        positions: [centerCartesian, xEndEcef],
        width: 5,
        material: Cesium.Color.RED,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.Cartesian3(gizmoScale * 0.06, gizmoScale * 0.06, gizmoScale * 0.06),
        material: Cesium.Color.RED,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    entities.push(gizmoX);

    // North Axis Handle (+Y - Green)
    const yEndLocal = new Cesium.Cartesian3(0, gizmoScale, 0);
    const yEndEcef = Cesium.Matrix4.multiplyByPoint(transformMatrix, yEndLocal, new Cesium.Cartesian3());
    const gizmoY = viewer.entities.add({
      id: 'solar-gizmo-handle-y',
      name: 'Solar Gizmo North Axis',
      position: yEndEcef,
      polyline: {
        positions: [centerCartesian, yEndEcef],
        width: 5,
        material: Cesium.Color.GREEN,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.Cartesian3(gizmoScale * 0.06, gizmoScale * 0.06, gizmoScale * 0.06),
        material: Cesium.Color.GREEN,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    entities.push(gizmoY);

    // Height Axis Handle (+Z - Cyan/Blue)
    const zEndLocal = new Cesium.Cartesian3(0, 0, gizmoScale);
    const zEndEcef = Cesium.Matrix4.multiplyByPoint(transformMatrix, zEndLocal, new Cesium.Cartesian3());
    const gizmoZ = viewer.entities.add({
      id: 'solar-gizmo-handle-z',
      name: 'Solar Gizmo Height Axis',
      position: zEndEcef,
      polyline: {
        positions: [centerCartesian, zEndEcef],
        width: 5,
        material: Cesium.Color.CYAN,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.Cartesian3(gizmoScale * 0.06, gizmoScale * 0.06, gizmoScale * 0.06),
        material: Cesium.Color.CYAN,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    entities.push(gizmoZ);

    // Save entities to ref
    solarPathEntitiesRef.current = entities;

    // Cleanup on unmount/dependency change
    return () => {
      clearSolarPath();
    };
  }, [
    solarPathEnabled,
    solarPathRadius,
    selectedPreset,
    selectedDate,
    sunHour,
    timezoneOffset,
    polygonData,
    modelUrl,
    modelLatitude,
    modelLongitude,
    modelHeight,
    activeAnalysisCenter
  ]);

  // Handle RTX Ultra Fidelity Mode parameters and Post-Processing
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // 1. Update tileset properties using custom rendering parameters or RTX Ultra override
    const updateTilesetPerformance = (tileset: any) => {
      if (tileset && !tileset.isDestroyed()) {
        tileset.maximumMemoryUsage = (isTablet || isMobile) ? 256 : (rtxUltraEnabled ? 4096 : (tileCacheSize || 256));
        tileset.dynamicScreenSpaceError = true;
        tileset.preloadWhenHidden = false;
        tileset.maximumScreenSpaceError = (isTablet || isMobile) ? Math.max(12, maxSSE) : (rtxUltraEnabled ? 8 : maxSSE);
        tileset.skipLevelOfDetail = rtxUltraEnabled ? true : skipLevelOfDetail;
        if (rtxUltraEnabled || skipLevelOfDetail) {
          tileset.baseScreenSpaceError = 1024;
          tileset.skipScreenSpaceErrorFactor = 16;
        }
      }
    };

    updateTilesetPerformance(leftBuildingsTilesetRef.current);
    updateTilesetPerformance(rightBuildingsTilesetRef.current);
    updateTilesetPerformance(leftGoogleTilesetRef.current);
    updateTilesetPerformance(rightGoogleTilesetRef.current);

    // Loop through all active scene primitives to apply custom graphics and rendering settings dynamically
    const updateTilesetGraphics = (newSSE: number, newCache: number, enableSkipping: boolean) => {
      if (!viewer.scene || !viewer.scene.primitives) return;
      const length = viewer.scene.primitives.length;
      for (let i = 0; i < length; i++) {
        const primitive = viewer.scene.primitives.get(i);
        
        // Verify if the active primitive is a 3D Tileset object
        if (primitive && primitive.maximumScreenSpaceError !== undefined) {
          primitive.maximumScreenSpaceError = (isTablet || isMobile) ? Math.max(12, parseFloat(newSSE as any)) : (rtxUltraEnabled ? 8 : parseFloat(newSSE as any));
          primitive.skipLevelOfDetail = rtxUltraEnabled ? true : enableSkipping;
          primitive.maximumMemoryUsage = (isTablet || isMobile) ? 256 : (rtxUltraEnabled ? 4096 : (newCache || 256));
          primitive.dynamicScreenSpaceError = true;
          primitive.preloadWhenHidden = false;
          
          // Apply advanced optimization flags if skipping is active
          if (rtxUltraEnabled || enableSkipping) {
            primitive.baseScreenSpaceError = 1024;
            primitive.skipScreenSpaceErrorFactor = 16;
          }
        }
      }
      // Update global scene caching limits
      if (viewer.scene.globe) {
        viewer.scene.globe.tileCacheSize = parseInt((rtxUltraEnabled ? 4096 : (newCache || 256)) as any);
      }
    };

    updateTilesetGraphics(maxSSE, tileCacheSize, skipLevelOfDetail);

    // 2. Update shadow settings
    if (viewer.scene.shadowMap) {
      viewer.scene.shadowMap.size = shadowMapResolution;
      viewer.scene.shadowMap.softShadows = rtxUltraEnabled ? true : softShadows;
      viewer.scene.shadowMap.darkness = shadowDarkness;

      // Fine-tuned shadow bias to completely eliminate shadow acne/moiré stripes on 3D building models and terrain
      const sm = viewer.scene.shadowMap as any;
      sm.bias = shadowBias !== undefined ? shadowBias : 0.005;
      sm.normalOffsetBias = normalOffsetBias !== undefined ? normalOffsetBias : 0.9;
      sm.normalOffset = true;

      if (rtxUltraEnabled) {
        viewer.scene.shadowMap.maximumDistance = shadowMaxDistance !== undefined ? shadowMaxDistance : 3500;
      } else {
        viewer.scene.shadowMap.maximumDistance = shadowMaxDistance !== undefined ? shadowMaxDistance : 5000;
      }
    }
    
    // Set terrain shadows to RECEIVE_ONLY to avoid terrain self-shadowing moire/acne banding while cleanly receiving building shadows
    viewer.terrainShadows = (rtxUltraEnabled || sunShadowsEnabled)
      ? Cesium.ShadowMode.RECEIVE_ONLY 
      : Cesium.ShadowMode.DISABLED;

    // If RTX is on, force shadows on
    if (rtxUltraEnabled) {
      viewer.shadows = true;
      viewer.scene.shadowMap.enabled = true;
      viewer.scene.globe.enableLighting = true;
    } else {
      viewer.shadows = sunShadowsEnabled;
      if (viewer.scene.shadowMap) {
        viewer.scene.shadowMap.enabled = sunShadowsEnabled;
      }
      viewer.scene.globe.enableLighting = sunShadowsEnabled || realisticLighting;
    }

    // 3. IBL, HDR & Post-Processing Shaders
    if (viewer.scene) {
      if ('highDynamicRange' in viewer.scene) {
        viewer.scene.highDynamicRange = hdrPipelineEnabled;
      }
      if ('eyeAdaptation' in viewer.scene) {
        (viewer.scene as any).eyeAdaptation = eyeAdaptationTonemap;
      }
      if (viewer.scene.skyAtmosphere) {
        (viewer.scene.skyAtmosphere as any).brightnessShift = (zenithLuminance - 0.2) * 2.0;
      }
      if (viewer.scene.postProcessStages) {
        if (viewer.scene.postProcessStages.ambientOcclusion) {
          const enableAo = ssaoEnabled || rtxUltraEnabled;
          viewer.scene.postProcessStages.ambientOcclusion.enabled = enableAo;
          if (enableAo) {
            viewer.scene.postProcessStages.ambientOcclusion.uniforms.ambientOcclusionOnly = false;
            viewer.scene.postProcessStages.ambientOcclusion.uniforms.intensity = rtxUltraEnabled ? 1.8 : Math.max(0.5, ssaoIntensity * 2.0);
            viewer.scene.postProcessStages.ambientOcclusion.uniforms.bias = 0.1;
            viewer.scene.postProcessStages.ambientOcclusion.uniforms.lengthCap = 10.0;
            viewer.scene.postProcessStages.ambientOcclusion.uniforms.stepSize = 1.0;
            viewer.scene.postProcessStages.ambientOcclusion.uniforms.blurStepSize = 0.9;
          }
        }
        if (viewer.scene.postProcessStages.bloom) {
          viewer.scene.postProcessStages.bloom.enabled = false;
        }
      }
    }

    viewer.scene.requestRender();
  }, [rtxUltraEnabled, sunShadowsEnabled, tilesetLoadedCount, shadowDarkness, softShadows, shadowBias, normalOffsetBias, shadowMaxDistance, shadowMapResolution, realisticLighting, hdrPipelineEnabled, sunLightAmbientPbr, iblReflectionFactor, zenithLuminance, ssaoEnabled, ssaoIntensity, eyeAdaptationTonemap, bloomGlareEnabled, maxSSE, tileCacheSize, skipLevelOfDetail]);

  // Capture current camera parameters when saveViewTrigger is incremented
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !saveViewTrigger || saveViewTrigger === 0) return;

    try {
      const camera = viewer.camera;
      const position = camera.position;
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      
      if (cartographic) {
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;
        const heading = Cesium.Math.toDegrees(camera.heading);
        const pitch = Cesium.Math.toDegrees(camera.pitch);
        const roll = Cesium.Math.toDegrees(camera.roll);

        let thumbnail: string | undefined;
        try {
          viewer.scene.render();
          const canvas = viewer.scene.canvas;
          if (canvas) {
            thumbnail = canvas.toDataURL('image/jpeg', 0.5);
          }
        } catch (e) {
          console.error('Failed to capture view thumbnail:', e);
        }

        onSaveViewCallback?.({
          latitude: Number(lat),
          longitude: Number(lon),
          height: Number(height),
          heading: Number(heading),
          pitch: Number(pitch),
          roll: Number(roll),
          thumbnail
        });
      }
    } catch (err) {
      console.error('Failed to capture camera parameters:', err);
    }
  }, [saveViewTrigger]);

  // Handle triggers to export the current viewport
  useEffect(() => {
    if (!viewportExportTrigger || viewportExportTrigger === 0) return;
    handleExportViewport();
  }, [viewportExportTrigger]);

  // Handle triggers to capture screenshot for AI image guidance
  useEffect(() => {
    if (!aiScreenshotTrigger || aiScreenshotTrigger === 0) return;
    handleCaptureScreenshotForAI();
  }, [aiScreenshotTrigger]);

  // Capture current camera parameters for flythrough keyframes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !addKeyframeTrigger || addKeyframeTrigger === 0) return;

    try {
      const camera = viewer.camera;
      const position = camera.position;
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      
      if (cartographic) {
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;
        const heading = camera.heading;
        const pitch = camera.pitch;
        const roll = camera.roll;

        onAddKeyframeCallback?.({
          position: { x: position.x, y: position.y, z: position.z },
          heading,
          pitch,
          roll,
          lat,
          lng: lon,
          alt: height,
          isBezier: false
        });
      }
    } catch (err) {
      console.error('Failed to capture keyframe camera parameters:', err);
    }
  }, [addKeyframeTrigger]);

  const isPlayingPathRef = useRef(false);

  const stopKeyframePath = () => {
    const viewer = viewerRef.current;
    if (viewer) {
      try {
        viewer.camera.cancelFlight();
      } catch (e) {
        // Ignored
      }
    }
    isPlayingPathRef.current = false;
    setLocalIsPlaying(false);
    onPlayingPathChange?.(false);
  };

  const playKeyframePath = (startIndex: number = 0, onComplete?: () => void) => {
    const viewer = viewerRef.current;
    if (!viewer || !cameraKeyframes || cameraKeyframes.length === 0) return;

    isPlayingPathRef.current = true;
    setLocalIsPlaying(true);
    onPlayingPathChange?.(true);

    const runFlight = (index: number) => {
      if (!isPlayingPathRef.current) return;

      if (index >= cameraKeyframes.length) {
        isPlayingPathRef.current = false;
        setLocalIsPlaying(false);
        onPlayingPathChange?.(false);
        if (onComplete) onComplete();
        return;
      }

      const kf = cameraKeyframes[index];
      const destination = new Cesium.Cartesian3(kf.position.x, kf.position.y, kf.position.z);
      
      // Calculate proportional duration based on real-world distance to ensure continuous camera speed
      const currentPos = viewer.camera.position;
      let distanceToDest = Cesium.Cartesian3.distance(currentPos, destination);
      if (index > 0) {
        const prevKf = cameraKeyframes[index - 1];
        const prevPos = new Cesium.Cartesian3(prevKf.position.x, prevKf.position.y, prevKf.position.z);
        distanceToDest = Cesium.Cartesian3.distance(prevPos, destination);
      }
      
      // Uniform target speed of 1000 meters per second, capped within a safe, cinematic 1.5s to 10.0s range.
      const flightDuration = Math.max(1.5, Math.min(10.0, distanceToDest / 1000.0));

      // Get cartographic coordinates to cap the peak flight altitude and avoid bouncing arcs
      let maximumHeight = undefined;
      let pitchAdjustHeight = undefined;
      // Only apply peak capping and pitch adjustments for larger distances (> 2000m) to prevent
      // curve discontinuities/bouncing during orbiting, pan transitions, or close-range keyframe paths.
      if (distanceToDest > 2000.0) {
        try {
          const currentCarto = Cesium.Cartographic.fromCartesian(currentPos);
          const destCarto = Cesium.Cartographic.fromCartesian(destination);
          if (currentCarto && destCarto) {
            // Cap the maximum height of the flight path to the maximum of start and destination altitudes
            // to completely suppress the parabolic climbing curve (the "bouncing" effect) for long flights.
            maximumHeight = Math.max(currentCarto.height, destCarto.height);
            // Ensure pitch adjusts smoothly throughout the flight by setting pitchAdjustHeight above the maximum height
            pitchAdjustHeight = maximumHeight + 1000.0;
          }
        } catch (err) {
          console.warn('Failed to calculate cartographics for flight peak height capping:', err);
        }
      }

      viewer.camera.flyTo({
        destination: destination,
        orientation: {
          heading: kf.heading,
          pitch: kf.pitch,
          roll: kf.roll
        },
        duration: flightDuration,
        maximumHeight,
        pitchAdjustHeight,
        easingFunction: kf.isBezier 
          ? Cesium.EasingFunction.QUADRATIC_IN_OUT 
          : ((Cesium.EasingFunction as any).LINEAR_NONE || ((t: number) => t)),
        complete: () => {
          if (isPlayingPathRef.current) {
            runFlight(index + 1);
          }
        },
        cancel: () => {
          isPlayingPathRef.current = false;
          setLocalIsPlaying(false);
          onPlayingPathChange?.(false);
        }
      });
    };

    // The first generated keyframe is ALWAYS the start of the path.
    // When playing from the start (startIndex === 0), initialize camera directly at keyframe 0.
    if (startIndex === 0) {
      const startKf = cameraKeyframes[0];
      const startDest = new Cesium.Cartesian3(startKf.position.x, startKf.position.y, startKf.position.z);
      viewer.camera.setView({
        destination: startDest,
        orientation: {
          heading: startKf.heading,
          pitch: startKf.pitch,
          roll: startKf.roll
        }
      });
      viewer.scene.render();

      if (cameraKeyframes.length === 1) {
        // Single keyframe path: placed at start of path, hold momentarily and finish
        setTimeout(() => {
          if (!isPlayingPathRef.current) return;
          isPlayingPathRef.current = false;
          setLocalIsPlaying(false);
          onPlayingPathChange?.(false);
          if (onComplete) onComplete();
        }, 1500);
        return;
      }

      // Smoothly take flight from keyframe 0 (start of path) to keyframe 1
      setTimeout(() => {
        if (isPlayingPathRef.current) {
          runFlight(1);
        }
      }, 100);
    } else {
      runFlight(startIndex);
    }
  };

  // Watch playPathTrigger
  useEffect(() => {
    if (!playPathTrigger || playPathTrigger === 0) return;
    playKeyframePath(0);
  }, [playPathTrigger]);

  // Watch stopPathTrigger
  useEffect(() => {
    if (!stopPathTrigger || stopPathTrigger === 0) return;
    stopKeyframePath();
  }, [stopPathTrigger]);

  // Handle Fly to specific keyframe (e.g. previewing the start of the path)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToKeyframeTrigger || !cameraKeyframes || cameraKeyframes.length === 0) return;
    const kf = cameraKeyframes[flyToKeyframeTrigger.index];
    if (!kf) return;
    try {
      const destination = new Cesium.Cartesian3(kf.position.x, kf.position.y, kf.position.z);
      viewer.camera.flyTo({
        destination,
        orientation: {
          heading: kf.heading,
          pitch: kf.pitch,
          roll: kf.roll
        },
        duration: 1.8
      });
    } catch (err) {
      console.warn('Failed to fly to keyframe:', err);
    }
  }, [flyToKeyframeTrigger]);

  // Watch exportVideoTrigger
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !exportVideoTrigger || exportVideoTrigger === 0) return;
    if (!cameraKeyframes || cameraKeyframes.length === 0) {
      alert("Please add at least one camera keyframe to export video.");
      return;
    }

    const chunks: Blob[] = [];
    setLocalIsRecording(true);
    onRecordingVideoChange?.(true);

    const originalWidth = viewer.canvas.width;
    const originalHeight = viewer.canvas.height;
    const originalStyleWidth = viewer.canvas.style.width;
    const originalStyleHeight = viewer.canvas.style.height;

    const is4k = videoExportResolution === '4k';
    const targetWidth = is4k ? 3840 : 1920;
    const targetHeight = is4k ? 2160 : 1080;
    const targetBitrate = is4k ? 32000000 : 9000000;
    const fileName = is4k ? 'urban-masterplan-4k.webm' : 'urban-masterplan-1080p.webm';

    // Temporarily fix to selected video dimensions
    viewer.canvas.width = targetWidth;
    viewer.canvas.height = targetHeight;
    viewer.canvas.style.width = `${targetWidth}px`;
    viewer.canvas.style.height = `${targetHeight}px`;

    const originalRequestRenderMode = viewer.scene.requestRenderMode;
    viewer.scene.requestRenderMode = false; // continuous render

    viewer.resize();

    // Position camera directly at keyframe 0 (the start of the path) before video capture begins
    const startKf = cameraKeyframes[0];
    const startDest = new Cesium.Cartesian3(startKf.position.x, startKf.position.y, startKf.position.z);
    viewer.camera.setView({
      destination: startDest,
      orientation: {
        heading: startKf.heading,
        pitch: startKf.pitch,
        roll: startKf.roll
      }
    });
    viewer.scene.render();

    let recorder: MediaRecorder;
    try {
      const stream = (viewer.canvas as any).captureStream(60);
      let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: targetBitrate };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm';
        }
      }

      recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        // Restore original size and render mode
        viewer.canvas.width = originalWidth;
        viewer.canvas.height = originalHeight;
        viewer.canvas.style.width = originalStyleWidth;
        viewer.canvas.style.height = originalStyleHeight;
        viewer.scene.requestRenderMode = originalRequestRenderMode;
        viewer.resize();
        viewer.scene.requestRender();

        setLocalIsRecording(false);
        onRecordingVideoChange?.(false);
      };

      // Allow the scene at the start keyframe to settle before recording starts
      setTimeout(() => {
        if (!viewerRef.current) return;
        try {
          recorder.start();

          playKeyframePath(0, () => {
            setTimeout(() => {
              if (recorder && recorder.state !== 'inactive') {
                recorder.stop();
              }
            }, 600);
          });
        } catch (recErr) {
          console.error('Failed to start recorder:', recErr);
          setLocalIsRecording(false);
          onRecordingVideoChange?.(false);
        }
      }, 200);

    } catch (err) {
      console.error('Failed to initialize recording:', err);
      viewer.canvas.width = originalWidth;
      viewer.canvas.height = originalHeight;
      viewer.canvas.style.width = originalStyleWidth;
      viewer.canvas.style.height = originalStyleHeight;
      viewer.scene.requestRenderMode = originalRequestRenderMode;
      viewer.resize();
      viewer.scene.render(); // Request a clean render
      setLocalIsRecording(false);
      onRecordingVideoChange?.(false);
      alert('Failed to start video recording: ' + err);
    }
  }, [exportVideoTrigger, videoExportResolution]);

  // Handle Custom 3D Tilesets from Cesium Ion
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const cleanup = () => {
      if (customTilesetRef.current) {
        try {
          customTilesetRef.current.clippingPolygons = undefined as any;
        } catch (_) {}
        viewer.scene.primitives.remove(customTilesetRef.current);
        customTilesetRef.current = null;
      }
    };

    cleanup();

    if (ionAssets?.tilesetEnabled && ionAssets?.tilesetId) {
      const assetId = Number(ionAssets.tilesetId);
      if (isNaN(assetId)) {
        if (onIonAssetError) {
          onIonAssetError('Invalid 3D Tileset Asset ID. Must be a numeric ID.');
        }
        console.warn('Invalid 3D Tileset Asset ID:', ionAssets.tilesetId);
        return;
      }

      Cesium.IonResource.fromAssetId(assetId)
        .then(resource => {
          return Cesium.Cesium3DTileset.fromUrl(resource, {
            maximumScreenSpaceError: 3, 
            maximumMemoryUsage: 2048, 
            preloadSiblings: true,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 16
          } as any);
        })
        .then(tileset => {
          if (viewerRef.current === viewer) {
            customTilesetRef.current = tileset;
            if ((tileset as any).errorEvent) {
              (tileset as any).errorEvent.addEventListener((err: any) => {
                console.warn('Custom 3D Tileset error gracefully caught:', err);
              });
            }
            viewer.scene.primitives.add(tileset);
            try { on3DTileLoaded?.(); } catch (_) {}
            
            // Apply existing clipping polygons if active
            applyClippingToTilesetInstance(tileset);

            if (onIonAssetError) {
              onIonAssetError(null); // Clear error on success
            }

            // Note: Automatic camera flyTo disabled on load; user can fly to asset on demand via Fly to Asset button
            viewer.scene.requestRender();
          }
        })
        .catch(err => {
          if (onIonAssetError) {
            onIonAssetError(`Failed to load custom Ion 3D Tileset ${assetId}: ${err.message || err}`);
          }
          console.warn('Failed to load custom Ion 3D Tileset:', err);
        });
    } else {
      if (onIonAssetError) {
        onIonAssetError(null);
      }
    }

    return () => {
      cleanup();
    };
  }, [ionAssets?.tilesetId, ionAssets?.tilesetEnabled]);


  // Handle Custom Imagery Layer from Cesium Ion
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const cleanup = () => {
      if (customImageryLayerRef.current) {
        try {
          viewer.imageryLayers.remove(customImageryLayerRef.current);
        } catch (_) {}
        customImageryLayerRef.current = null;
      }
    };

    cleanup();

    if (ionAssets?.imageryEnabled && ionAssets?.imageryId) {
      const assetId = Number(ionAssets.imageryId);
      if (isNaN(assetId)) {
        if (onIonAssetError) {
          onIonAssetError('Invalid Imagery Asset ID. Must be a numeric ID.');
        }
        console.warn('Invalid Imagery Asset ID:', ionAssets.imageryId);
        return;
      }

      const activeIonToken = (isValidCesiumToken(token) ? token : null) ||
        import.meta.env.VITE_CESIUM_ION_TOKEN ||
        import.meta.env.VITE_CESIUM_TOKEN ||
        initialDefaultToken ||
        '';
      if (activeIonToken) {
        Cesium.Ion.defaultAccessToken = activeIonToken;
      }

      // a. Clear all default background imagery
      viewer.imageryLayers.removeAll();

      // b. Fetch requested asset via Cesium.IonImageryProvider.fromAssetId
      Cesium.IonImageryProvider.fromAssetId(assetId)
        .then(imageryProvider => {
          if (viewerRef.current === viewer) {
            // c. Add cleanly as base layer at index 0
            const layer = viewer.imageryLayers.addImageryProvider(imageryProvider, 0);
            customImageryLayerRef.current = layer;

            const isGoogleEnabled = layers.find(l => l.id === 'google-3d-tiles')?.enabled;
            if (isGoogleEnabled) {
              layer.show = false;
            }

            if (onIonAssetError) {
              onIonAssetError(null); // Clear error on success
            }

            // Note: Automatic camera flyTo disabled on load
            viewer.scene.requestRender();
          }
        })
        .catch(err => {
          if (onIonAssetError) {
            onIonAssetError(`Failed to load custom Ion Imagery layer ${assetId}: ${err.message || err}`);
          }
          console.warn('Failed to load custom Ion Imagery layer:', err);
        });
    }

    return () => {
      cleanup();
    };
  }, [ionAssets?.imageryId, ionAssets?.imageryEnabled]);

  // Multi-Token Ion Accounts Primitives & Layers Maps
  const ionTilesetsMapRef = useRef<Map<string, Cesium.Cesium3DTileset>>(new Map());
  const ionTerrainMapRef = useRef<Map<string, any>>(new Map());
  const ionImageryMapRef = useRef<Map<string, Cesium.ImageryLayer>>(new Map());

  // Safe Ion Resource Fetcher with Token Fallback
  const fetchIonResourceSafe = useCallback(async (assetId: number, accountToken?: string): Promise<any> => {
    const primaryToken = (accountToken || '').trim();
    const fallbackToken = (isValidCesiumToken(token) ? token : Cesium.Ion.defaultAccessToken || '').trim();

    if (primaryToken) {
      try {
        return await Cesium.IonResource.fromAssetId(assetId, { accessToken: primaryToken });
      } catch (err: any) {
        // If 401 Unauthorized or Invalid Token, try fallback token if available
        if (fallbackToken && fallbackToken !== primaryToken) {
          try {
            return await Cesium.IonResource.fromAssetId(assetId, { accessToken: fallbackToken });
          } catch (_) {
            // Keep primary error
          }
        }
        throw err;
      }
    }

    if (fallbackToken) {
      return await Cesium.IonResource.fromAssetId(assetId, { accessToken: fallbackToken });
    }

    return await Cesium.IonResource.fromAssetId(assetId);
  }, [token]);

  // Safe Ion Imagery Provider Fetcher with Token Fallback
  const fetchIonImageryProviderSafe = useCallback(async (assetId: number, accountToken?: string): Promise<any> => {
    const primaryToken = (accountToken || '').trim();
    const fallbackToken = (isValidCesiumToken(token) ? token : Cesium.Ion.defaultAccessToken || '').trim();

    if (primaryToken) {
      try {
        return await Cesium.IonImageryProvider.fromAssetId(assetId, { accessToken: primaryToken });
      } catch (err: any) {
        if (fallbackToken && fallbackToken !== primaryToken) {
          try {
            return await Cesium.IonImageryProvider.fromAssetId(assetId, { accessToken: fallbackToken });
          } catch (_) {
            // Keep primary error
          }
        }
        throw err;
      }
    }

    if (fallbackToken) {
      return await Cesium.IonImageryProvider.fromAssetId(assetId, { accessToken: fallbackToken });
    }

    return await Cesium.IonImageryProvider.fromAssetId(assetId);
  }, [token]);

  // Multi-Token Ion Assets Streaming Effect
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    if (!ionAccounts || ionAccounts.length === 0) {
      ionTilesetsMapRef.current.forEach((tileset) => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.primitives.remove(tileset);
        }
      });
      ionTilesetsMapRef.current.clear();

      ionImageryMapRef.current.forEach((layer) => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.imageryLayers.remove(layer);
        }
      });
      ionImageryMapRef.current.clear();

      ionTerrainMapRef.current.clear();
      return;
    }

    const activeKeys = new Set<string>();

    ionAccounts.forEach((account) => {
      if (!account.token) return;
      (account.assets || []).forEach((asset) => {
        const key = `${account.id}-${asset.id}`;

        if (asset.loaded) {
          activeKeys.add(key);
          const typeUpper = (asset.type || '').toUpperCase();
          const isTerrain = typeUpper === 'TERRAIN';
          const isImagery = typeUpper === 'IMAGERY';

          if (isTerrain) {
            if (!ionTerrainMapRef.current.has(key)) {
              if (asset.visible !== false) {
                (async () => {
                  try {
                    const resource = await fetchIonResourceSafe(asset.id, account.token);
                    const provider = await Cesium.CesiumTerrainProvider.fromUrl(resource);
                    if (viewerRef.current === viewer && viewer && !viewer.isDestroyed()) {
                      viewer.scene.terrainProvider = provider;
                      ionTerrainMapRef.current.set(key, provider);
                      viewer.scene.requestRender();
                    }
                  } catch (err: any) {
                    const isAuth = err?.statusCode === 401 || (typeof err?.message === 'string' && err.message.includes('401'));
                    const msg = isAuth
                      ? `Cesium Ion Access Token invalid for terrain asset #${asset.id}. Please update your token.`
                      : `Error loading Ion terrain asset #${asset.id}: ${err?.message || err}`;
                    console.warn(msg);
                    onIonAssetError?.(msg);
                  }
                })();
              }
            }
          } else if (isImagery) {
            if (!ionImageryMapRef.current.has(key)) {
              (async () => {
                try {
                  const provider = await fetchIonImageryProviderSafe(asset.id, account.token);
                  if (viewerRef.current === viewer && viewer && !viewer.isDestroyed()) {
                    const layer = viewer.scene.imageryLayers.addImageryProvider(provider);
                    layer.show = asset.visible !== false;
                    ionImageryMapRef.current.set(key, layer);
                    viewer.scene.requestRender();
                  }
                } catch (err: any) {
                  const isAuth = err?.statusCode === 401 || (typeof err?.message === 'string' && err.message.includes('401'));
                  const msg = isAuth
                    ? `Cesium Ion Access Token invalid for imagery asset #${asset.id}. Please update your token.`
                    : `Error loading Ion imagery asset #${asset.id}: ${err?.message || err}`;
                  console.warn(msg);
                  onIonAssetError?.(msg);
                }
              })();
            } else {
              const layer = ionImageryMapRef.current.get(key);
              if (layer) {
                layer.show = asset.visible !== false;
                viewer.scene.requestRender();
              }
            }
          } else {
            // 3D Tileset or 3D Model
            if (!ionTilesetsMapRef.current.has(key)) {
              (async () => {
                try {
                  const resource = await fetchIonResourceSafe(asset.id, account.token);
                  const tileset = await Cesium.Cesium3DTileset.fromUrl(resource, {
                    maximumScreenSpaceError: 3,
                    skipLevelOfDetail: true,
                  } as any);
                  (tileset as any).maximumMemoryUsage = 2048;

                  if ((tileset as any).tileFailed) {
                    (tileset as any).tileFailed.addEventListener((e: any) => {
                      console.warn(`Tile failed for Ion asset #${asset.id}:`, e?.message || e);
                    });
                  }

                  if (viewerRef.current === viewer && viewer && !viewer.isDestroyed()) {
                    (tileset as any).shadows = (sunShadowsEnabled || rtxUltraEnabled)
                      ? Cesium.ShadowMode.ENABLED
                      : Cesium.ShadowMode.DISABLED;
                    tileset.show = asset.visible !== false;
                    viewer.scene.primitives.add(tileset);
                    try { on3DTileLoaded?.(); } catch (_) {}
                    ionTilesetsMapRef.current.set(key, tileset);

                    // If user triggered fly-to for this asset while it was loading
                    if (flyToIonAssetTarget && `${flyToIonAssetTarget.accountId}-${flyToIonAssetTarget.assetId}` === key) {
                      tileset.show = true;
                      const bs = tileset.boundingSphere && tileset.boundingSphere.radius > 0
                        ? tileset.boundingSphere
                        : (tileset.root && (tileset.root as any).boundingSphere && (tileset.root as any).boundingSphere.radius > 0
                            ? (tileset.root as any).boundingSphere
                            : null);

                      if (bs && bs.radius > 0) {
                        const range = Math.max(bs.radius * 2.2, 25.0);
                        viewer.camera.flyToBoundingSphere(bs, {
                          duration: 2.0,
                          offset: new Cesium.HeadingPitchRange(
                            Cesium.Math.toRadians(0),
                            Cesium.Math.toRadians(-45),
                            range
                          )
                        });
                      } else {
                        viewer.flyTo(tileset, { duration: 2.0 }).catch(() => {});
                      }
                    }

                    viewer.scene.requestRender();
                  }
                } catch (err: any) {
                  const isAuth = err?.statusCode === 401 || (typeof err?.message === 'string' && (err.message.includes('401') || err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('unauthorized')));
                  const msg = isAuth
                    ? `Cesium Ion Access Token invalid or unauthorized for Asset #${asset.id} (${asset.name || 'Ion Asset'}). Please update your token in Cesium Layers.`
                    : `Error loading Ion 3D Tileset asset #${asset.id}: ${err?.message || err}`;
                  console.warn(msg);
                  onIonAssetError?.(msg);
                }
              })();
            } else {
              const tileset = ionTilesetsMapRef.current.get(key);
              if (tileset && !tileset.isDestroyed()) {
                tileset.show = asset.visible !== false;
                (tileset as any).shadows = (sunShadowsEnabled || rtxUltraEnabled)
                  ? Cesium.ShadowMode.ENABLED
                  : Cesium.ShadowMode.DISABLED;
                viewer.scene.requestRender();
              }
            }
          }
        }
      });
    });

    // Unload untoggled tilesets
    ionTilesetsMapRef.current.forEach((tileset, key) => {
      if (!activeKeys.has(key)) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.primitives.remove(tileset);
        }
        ionTilesetsMapRef.current.delete(key);
      }
    });

    // Unload untoggled imagery
    ionImageryMapRef.current.forEach((layer, key) => {
      if (!activeKeys.has(key)) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.imageryLayers.remove(layer);
        }
        ionImageryMapRef.current.delete(key);
      }
    });

    // Unload untoggled terrain
    ionTerrainMapRef.current.forEach((provider, key) => {
      if (!activeKeys.has(key)) {
        ionTerrainMapRef.current.delete(key);
      }
    });

  }, [ionAccounts, isInitializing, sunShadowsEnabled, rtxUltraEnabled, fetchIonResourceSafe, fetchIonImageryProviderSafe, onIonAssetError]);

  // Fly to Target Ion Asset (On-Demand via Fly to Asset button)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !flyToIonAssetTarget) return;

    const key = `${flyToIonAssetTarget.accountId}-${flyToIonAssetTarget.assetId}`;
    const tileset = ionTilesetsMapRef.current.get(key);
    if (tileset && viewer && !viewer.isDestroyed()) {
      tileset.show = true;

      const doFlyToTileset = () => {
        const bs = tileset.boundingSphere && tileset.boundingSphere.radius > 0
          ? tileset.boundingSphere
          : (tileset.root && (tileset.root as any).boundingSphere && (tileset.root as any).boundingSphere.radius > 0
              ? (tileset.root as any).boundingSphere
              : null);

        if (bs && bs.radius > 0) {
          const range = Math.max(bs.radius * 2.2, 25.0);
          viewer.camera.flyToBoundingSphere(bs, {
            duration: 2.0,
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(0),
              Cesium.Math.toRadians(-45),
              range
            )
          });
        } else {
          viewer.flyTo(tileset, { duration: 2.0 }).catch(() => {
            const removeListener = tileset.tileLoad.addEventListener(() => {
              if (tileset.boundingSphere && tileset.boundingSphere.radius > 0) {
                const r = Math.max(tileset.boundingSphere.radius * 2.2, 25.0);
                viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
                  duration: 2.0,
                  offset: new Cesium.HeadingPitchRange(
                    Cesium.Math.toRadians(0),
                    Cesium.Math.toRadians(-45),
                    r
                  )
                });
                removeListener();
              }
            });
            setTimeout(() => { try { removeListener(); } catch (_) {} }, 10000);
          });
        }
      };

      if ((tileset as any).ready) {
        doFlyToTileset();
      } else if ((tileset as any).readyPromise) {
        (tileset as any).readyPromise.then(doFlyToTileset).catch(doFlyToTileset);
      } else {
        doFlyToTileset();
      }
      return;
    }

    const imageryLayer = ionImageryMapRef.current.get(key);
    if (imageryLayer && viewer && !viewer.isDestroyed()) {
      imageryLayer.show = true;
      viewer.flyTo(imageryLayer, { duration: 2.0 });
      return;
    }

    const terrainProvider = ionTerrainMapRef.current.get(key);
    if (terrainProvider && viewer && !viewer.isDestroyed()) {
      if (terrainProvider.tilingScheme && terrainProvider.tilingScheme.rectangle) {
        const rect = terrainProvider.tilingScheme.rectangle;
        if (rect.width < Cesium.Math.TWO_PI - 0.1) {
          viewer.camera.flyTo({
            destination: rect,
            duration: 2.0
          });
        }
      }
    }
  }, [flyToIonAssetTarget, isInitializing]);

  // Helper to compute 3D frustum corners
  const computeFrustumCorners = (
    p1: Cesium.Cartesian3,
    p2: Cesium.Cartesian3,
    fovXDegrees: number,
    fovYDegrees: number,
    bufferMeters: number
  ) => {
    const distance = Cesium.Cartesian3.distance(p1, p2);
    const dir = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(p2, p1, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    // upEarth vertical vertical vector at p1
    const upEarth = Cesium.Cartesian3.normalize(p1, new Cesium.Cartesian3());
    
    // right = dir x upEarth
    const right = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(dir, upEarth, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    
    // up = right x dir
    const up = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const halfFovX = Cesium.Math.toRadians(fovXDegrees) / 2;
    const halfFovY = Cesium.Math.toRadians(fovYDegrees) / 2;

    const tanX = Math.tan(halfFovX);
    const tanY = Math.tan(halfFovY);

    const wNear = bufferMeters;
    const hNear = bufferMeters;

    const wFar = distance * tanX + bufferMeters;
    const hFar = distance * tanY + bufferMeters;

    const cNearTR = Cesium.Cartesian3.add(
      Cesium.Cartesian3.add(
        p1,
        Cesium.Cartesian3.multiplyByScalar(right, wNear, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hNear, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    
    const cNearTL = Cesium.Cartesian3.add(
      Cesium.Cartesian3.subtract(
        p1,
        Cesium.Cartesian3.multiplyByScalar(right, wNear, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hNear, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const cNearBL = Cesium.Cartesian3.subtract(
      Cesium.Cartesian3.subtract(
        p1,
        Cesium.Cartesian3.multiplyByScalar(right, wNear, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hNear, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const cNearBR = Cesium.Cartesian3.subtract(
      Cesium.Cartesian3.add(
        p1,
        Cesium.Cartesian3.multiplyByScalar(right, wNear, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hNear, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const pFarCenter = Cesium.Cartesian3.add(
      p1,
      Cesium.Cartesian3.multiplyByScalar(dir, distance, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const cFarTR = Cesium.Cartesian3.add(
      Cesium.Cartesian3.add(
        pFarCenter,
        Cesium.Cartesian3.multiplyByScalar(right, wFar, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hFar, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const cFarTL = Cesium.Cartesian3.add(
      Cesium.Cartesian3.subtract(
        pFarCenter,
        Cesium.Cartesian3.multiplyByScalar(right, wFar, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hFar, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const cFarBL = Cesium.Cartesian3.subtract(
      Cesium.Cartesian3.subtract(
        pFarCenter,
        Cesium.Cartesian3.multiplyByScalar(right, wFar, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hFar, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const cFarBR = Cesium.Cartesian3.subtract(
      Cesium.Cartesian3.add(
        pFarCenter,
        Cesium.Cartesian3.multiplyByScalar(right, wFar, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      Cesium.Cartesian3.multiplyByScalar(up, hFar, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    return {
      cNearTR, cNearTL, cNearBL, cNearBR,
      cFarTR, cFarTL, cFarBL, cFarBR,
      distance, dir, right, up
    };
  };

  // Manage rendering and encroachment analytics for 3D View Corridor
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // 1. Cleanup previous entities
    viewCorridorEntitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity);
    });
    viewCorridorEntitiesRef.current = [];

    // 2. Render Node 1 indicator if Node 2 not yet placed
    if (viewCorridorNode1 && !viewCorridorNode2) {
      const p1 = Cesium.Cartesian3.fromDegrees(viewCorridorNode1.lon, viewCorridorNode1.lat, viewCorridorNode1.height);
      const marker = viewer.entities.add({
        position: p1,
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#06b6d4'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: 'Observer (Node 1)',
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.fromCssColorString('#06b6d4'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      viewCorridorEntitiesRef.current.push(marker);
      viewer.scene.requestRender();
      return;
    }

    // 3. Render complete Volumetric View Corridor Envelope
    if (viewCorridorNode1 && viewCorridorNode2) {
      const p1 = Cesium.Cartesian3.fromDegrees(viewCorridorNode1.lon, viewCorridorNode1.lat, viewCorridorNode1.height);
      const p2 = Cesium.Cartesian3.fromDegrees(viewCorridorNode2.lon, viewCorridorNode2.lat, viewCorridorNode2.height);

      const {
        cNearTR, cNearTL, cNearBL, cNearBR,
        cFarTR, cFarTL, cFarBL, cFarBR,
        distance, dir, right, up
      } = computeFrustumCorners(p1, p2, viewCorridorFovX, viewCorridorFovY, viewCorridorBuffer);

      // Determine colors based on active encroachment state
      const isEncroached = !!viewCorridorEncroached;
      const faceColor = isEncroached
        ? Cesium.Color.RED.withAlpha(0.35)
        : Cesium.Color.CYAN.withAlpha(0.25);
      const outlineColor = isEncroached
        ? Cesium.Color.RED
        : Cesium.Color.CYAN;

      // Polyline Outline Helper
      const addOutline = (positions: Cesium.Cartesian3[]) => {
        const entity = viewer.entities.add({
          polyline: {
            positions,
            width: 3.0,
            material: outlineColor,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        viewCorridorEntitiesRef.current.push(entity);
      };

      // Polygon Face Helper
      const addFace = (positions: Cesium.Cartesian3[]) => {
        const entity = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: faceColor,
            perPositionHeight: true,
            outline: false
          }
        });
        viewCorridorEntitiesRef.current.push(entity);
      };

      // Draw Outlines
      // 4 side rays
      addOutline([cNearTR, cFarTR]);
      addOutline([cNearTL, cFarTL]);
      addOutline([cNearBL, cFarBL]);
      addOutline([cNearBR, cFarBR]);
      
      // Far face outline
      addOutline([cFarTR, cFarTL, cFarBL, cFarBR, cFarTR]);
      
      // Near face outline
      addOutline([cNearTR, cNearTL, cNearBL, cNearBR, cNearTR]);

      // Draw Solid Faces (if visible)
      if (viewCorridorVisible) {
        addFace([cNearTR, cNearTL, cFarTL, cFarTR]); // Top
        addFace([cNearBR, cNearBL, cFarBL, cFarBR]); // Bottom
        addFace([cNearTL, cNearBL, cFarBL, cFarTL]); // Left
        addFace([cNearTR, cNearBR, cFarBR, cFarTR]); // Right
        addFace([cFarTR, cFarTL, cFarBL, cFarBR]);   // Far
        if (viewCorridorBuffer > 0) {
          addFace([cNearTR, cNearTL, cNearBL, cNearBR]); // Near cap
        }
      }

      // Add Anchor Markers
      const obsMarker = viewer.entities.add({
        position: p1,
        point: {
          pixelSize: 10,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: 'Observer (Node 1)',
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      viewCorridorEntitiesRef.current.push(obsMarker);

      const targetMarker = viewer.entities.add({
        position: p2,
        point: {
          pixelSize: 10,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: 'Target (Node 2)',
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      viewCorridorEntitiesRef.current.push(targetMarker);

      viewer.scene.requestRender();

      // 4. Asynchronous High-fidelity Encroachment Sweep Check
      const samplePoints: Cesium.Cartesian3[] = [];
      const N_SAMPLES = 15;
      const tanX = Math.tan(Cesium.Math.toRadians(viewCorridorFovX) / 2);
      const tanY = Math.tan(Cesium.Math.toRadians(viewCorridorFovY) / 2);

      for (let i = 0; i <= N_SAMPLES; i++) {
        const t = i / N_SAMPLES;
        const z = t * distance;
        const wVal = z * tanX + viewCorridorBuffer;

        const pCenter = Cesium.Cartesian3.add(
          p1,
          Cesium.Cartesian3.multiplyByScalar(dir, z, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );

        const pLeft = Cesium.Cartesian3.subtract(
          pCenter,
          Cesium.Cartesian3.multiplyByScalar(right, wVal, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );

        const pRight = Cesium.Cartesian3.add(
          pCenter,
          Cesium.Cartesian3.multiplyByScalar(right, wVal, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );

        samplePoints.push(pCenter, pLeft, pRight);
      }

      viewer.scene.clampToHeightMostDetailed(samplePoints).then((clampedPoints) => {
        if (viewer.isDestroyed() || !viewer.scene || viewer.scene.isDestroyed()) return;
        if (!clampedPoints || !Array.isArray(clampedPoints) || clampedPoints.length === 0) return;

        let encroached = false;
        let maxViolation = 0;

        for (let i = 0; i <= N_SAMPLES; i++) {
          const t = i / N_SAMPLES;
          const z = t * distance;
          const hVal = z * tanY + viewCorridorBuffer;

          const pCenter = samplePoints[3 * i];
          if (!pCenter) continue;

          let cartoCenter;
          try {
            cartoCenter = Cesium.Cartographic.fromCartesian(pCenter);
          } catch (e) {
            continue;
          }
          if (!cartoCenter) continue;

          const bottomHeight = cartoCenter.height - hVal;

          const clampedC = clampedPoints[3 * i];
          const clampedL = clampedPoints[3 * i + 1];
          const clampedR = clampedPoints[3 * i + 2];

          const checkHeights = [];
          if (clampedC && typeof clampedC === 'object' && 'x' in clampedC) {
            try {
              checkHeights.push(Cesium.Cartographic.fromCartesian(clampedC).height);
            } catch (e) {}
          }
          if (clampedL && typeof clampedL === 'object' && 'x' in clampedL) {
            try {
              checkHeights.push(Cesium.Cartographic.fromCartesian(clampedL).height);
            } catch (e) {}
          }
          if (clampedR && typeof clampedR === 'object' && 'x' in clampedR) {
            try {
              checkHeights.push(Cesium.Cartographic.fromCartesian(clampedR).height);
            } catch (e) {}
          }

          for (const physHeight of checkHeights) {
            if (physHeight > bottomHeight + 1.0) {
              encroached = true;
              const violation = physHeight - bottomHeight;
              if (violation > maxViolation) {
                maxViolation = violation;
              }
            }
          }
        }

        onViewCorridorEncroachedChange?.(encroached);
        onViewCorridorViolationHeightChange?.(maxViolation);
      }).catch(err => {
        console.error("View Corridor intersection check failed:", err);
      });
    }

    return () => {
      viewCorridorEntitiesRef.current.forEach(entity => {
        viewer.entities.remove(entity);
      });
      viewCorridorEntitiesRef.current = [];
    };
  }, [
    viewCorridorNode1,
    viewCorridorNode2,
    viewCorridorFovX,
    viewCorridorFovY,
    viewCorridorBuffer,
    viewCorridorVisible,
    viewCorridorEncroached
  ]);

  const lastStateRef = useRef<{
    n1: any;
    n2: any;
    simActive: boolean;
  }>({
    n1: null,
    n2: null,
    simActive: false
  });

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const n1 = viewCorridorNode1;
    const n2 = viewCorridorNode2;
    const simActive = !!viewCorridorSimulationActive;

    const wasBothSet = lastStateRef.current.n1 && lastStateRef.current.n2;
    const isBothSet = n1 && n2;

    const completedCorridor = !wasBothSet && isBothSet;
    const toggledOn = !lastStateRef.current.simActive && simActive;

    if ((completedCorridor || toggledOn) && isBothSet) {
      // Execute camera alignment flyTo pointing from Node 1 directly at Node 2.
      // n1.height is already elevated +1.5m for human eyesight height above pointed location.
      const observerPos = Cesium.Cartesian3.fromDegrees(n1.lon, n1.lat, n1.height);
      const targetPos = Cesium.Cartesian3.fromDegrees(n2.lon, n2.lat, n2.height);

      // Compute heading/pitch pointing from observerPos to targetPos
      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(observerPos);
      const invTransform = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());
      
      let heading = 0.0;
      let pitch = 0.0;
      if (invTransform) {
        const localTarget = Cesium.Matrix4.multiplyByPoint(
          invTransform,
          targetPos,
          new Cesium.Cartesian3()
        );
        const x = localTarget.x;
        const y = localTarget.y;
        const z = localTarget.z;
        heading = Math.atan2(x, y);
        pitch = Math.atan2(z, Math.sqrt(x * x + y * y));
      }

      // Execute fluid viewer.camera.flyTo with 2.5 seconds duration
      viewer.camera.flyTo({
        destination: observerPos,
        orientation: {
          heading: heading,
          pitch: pitch,
          roll: 0.0
        },
        duration: 2.5
      });

      // If they completed a new corridor, automatically enable the simulation active state!
      if (completedCorridor && onViewCorridorSimulationActiveChange) {
        onViewCorridorSimulationActiveChange(true);
      }
    }

    lastStateRef.current = { n1, n2, simActive };
  }, [
    viewCorridorNode1,
    viewCorridorNode2,
    viewCorridorSimulationActive,
    isInitializing,
    onViewCorridorSimulationActiveChange
  ]);

  // Helper to remove and destroy previous excavation elements and clipping polygons
  const cleanupExcavation = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (onExcavationAreaChange) {
      onExcavationAreaChange(null);
    }

    setLocalExcavationStats(null);

    excavationEntitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity);
    });
    excavationEntitiesRef.current = [];

    if (excavationClippingCollectionRef.current) {
      try {
        excavationClippingCollectionRef.current.enabled = false;
      } catch (_) {}
      
      const oldCollection = excavationClippingCollectionRef.current;
      setTimeout(() => {
        try {
          if (oldCollection && typeof oldCollection.destroy === 'function' && !oldCollection.isDestroyed()) {
            oldCollection.destroy();
          }
        } catch (_) {}
      }, 200);
      excavationClippingCollectionRef.current = null;
    }

    try {
      viewer.scene.globe.clippingPolygons = undefined as any;
    } catch (_) {}

    // Restore standard clipping collection to 3D tilesets if active
    const cfg = activeClippingConfigRef.current;
    if (cfg && cfg.enabled && cfg.positionsList.length > 0) {
      try {
        const primsCount = viewer.scene.primitives.length;
        for (let i = 0; i < primsCount; i++) {
          const prim = viewer.scene.primitives.get(i);
          if (prim && prim instanceof Cesium.Cesium3DTileset) {
            applyClippingToTilesetInstance(prim);
          }
        }
        applyClippingToTilesetInstance(rightBuildingsTilesetRef.current);
        applyClippingToTilesetInstance(leftBuildingsTilesetRef.current);
        applyClippingToTilesetInstance(rightGoogleTilesetRef.current);
        applyClippingToTilesetInstance(leftGoogleTilesetRef.current);
        applyClippingToTilesetInstance(customTilesetRef.current);
      } catch (_) {}
    } else {
      try {
        const primsCount = viewer.scene.primitives.length;
        for (let i = 0; i < primsCount; i++) {
          const prim = viewer.scene.primitives.get(i);
          if (prim && prim instanceof Cesium.Cesium3DTileset) {
            prim.clippingPolygons = undefined as any;
          }
        }
        if (rightBuildingsTilesetRef.current) rightBuildingsTilesetRef.current.clippingPolygons = undefined as any;
        if (leftBuildingsTilesetRef.current) leftBuildingsTilesetRef.current.clippingPolygons = undefined as any;
        if (rightGoogleTilesetRef.current) rightGoogleTilesetRef.current.clippingPolygons = undefined as any;
        if (leftGoogleTilesetRef.current) leftGoogleTilesetRef.current.clippingPolygons = undefined as any;
        if (customTilesetRef.current) customTilesetRef.current.clippingPolygons = undefined as any;
      } catch (_) {}
    }

    viewer.scene.requestRender();
  };

  // Helper to draw the 3D walls and floor of the excavation pit, and apply terrain/buildings clipping
  const drawExcavationPit = (positions: Cesium.Cartesian3[], depth: number) => {
    const viewer = viewerRef.current;
    if (!viewer || positions.length < 3) return;

    // Store active excavation positions for dynamic depth updates
    activeExcavationPositionsRef.current = positions;

    // Clear any previous excavation first
    cleanupExcavation();

    if (onExcavationAreaChange) {
      onExcavationAreaChange(calculateArea(positions));
    }

    try {
      const cartographics = positions.map(p => Cesium.Cartographic.fromCartesian(p));
      const outerPositions = positions.map(pos => pos);

      // Create ClippingPolygon and ClippingPolygonCollection for Terrain Globe
      const clippingPolygon = new Cesium.ClippingPolygon({
        positions: outerPositions
      });

      const clippingPolygonCollection = new Cesium.ClippingPolygonCollection({
        polygons: [clippingPolygon],
        inverse: false, // Hole (i.e. clip INSIDE)
        enabled: true
      });

      // Apply clipping directly to globe terrain
      viewer.scene.globe.clippingPolygons = clippingPolygonCollection;
      excavationClippingCollectionRef.current = clippingPolygonCollection;

      // Also apply independent clipping collections to active tileset layers
      if (rightBuildingsTilesetRef.current) {
        rightBuildingsTilesetRef.current.clippingPolygons = createClippingCollectionForTileset([outerPositions], false) as any;
      }
      if (rightGoogleTilesetRef.current) {
        rightGoogleTilesetRef.current.clippingPolygons = createClippingCollectionForTileset([outerPositions], false) as any;
      }
      if (customTilesetRef.current) {
        customTilesetRef.current.clippingPolygons = createClippingCollectionForTileset([outerPositions], false) as any;
      }

      // Add 3D Side Walls
      const wallsEntity = viewer.entities.add({
        name: 'Excavation Pit Walls',
        wall: {
          positions: [...positions, positions[0]],
          minimumHeights: [...cartographics.map(c => c.height - depth), cartographics[0].height - depth],
          maximumHeights: [...cartographics.map(c => c.height), cartographics[0].height],
          material: Cesium.Color.fromCssColorString('#999999'), // Solid light grey
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#18181b'), // matching charcoal/black border for clean section cut edges
          outlineWidth: 2,
        }
      });
      excavationEntitiesRef.current.push(wallsEntity);

      // Add high-visibility glowing wireframe boundary line around the active clipping hole (rim at ground level)
      const wireframeRimEntity = viewer.entities.add({
        name: 'Excavation Pit Rim Wireframe',
        polyline: {
          positions: [...positions, positions[0]],
          width: 5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString('#f97316'), // bright neon orange
            taperPower: 1.0
          }),
          depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#ea580c').withAlpha(0.6),
            dashLength: 12
          })
        }
      });
      excavationEntitiesRef.current.push(wireframeRimEntity);

      // Add 3D Bottom Floor
      const bottomPositions = cartographics.map(c => 
        Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(c.longitude),
          Cesium.Math.toDegrees(c.latitude),
          c.height - depth
        )
      );

      const floorEntity = viewer.entities.add({
        name: 'Excavation Pit Floor',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(bottomPositions),
          perPositionHeight: true,
          material: Cesium.Color.fromCssColorString('#cdcdcd'), // Light grey floor
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#09090b'),
          outlineWidth: 2,
        }
      });
      excavationEntitiesRef.current.push(floorEntity);

      // Compute excavation statistics and update local React state for dashboard
      const calculatedAreaVal = calculateArea(positions);
      const calculatedPerimeterVal = calculatePerimeter(positions);
      const calculatedVolumeVal = calculatedAreaVal * depth;
      const calculatedWeightVal = calculatedVolumeVal * 1.6; // ~1.6 metric tons per m3 of soil/earth
      const calculatedTruckloadsVal = Math.ceil(calculatedVolumeVal / 12); // standard 12 m3 truck capacity

      setLocalExcavationStats({
        area: calculatedAreaVal,
        depth: depth,
        volume: calculatedVolumeVal,
        perimeter: calculatedPerimeterVal,
        weight: calculatedWeightVal,
        truckloads: calculatedTruckloadsVal
      });

      viewer.scene.requestRender();
    } catch (err) {
      console.error('Failed to render 3D excavation pit:', err);
    }
  };

  // Subsurface camera navigation & terrain opacity effect
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    if (subsurfaceCameraEnabled) {
      viewer.scene.globe.undergroundColor = Cesium.Color.BLACK;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    } else {
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    }

    if (terrainOpacity < 1.0) {
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.frontFaceAlpha = terrainOpacity;
      viewer.scene.globe.translucency.backFaceAlpha = terrainOpacity;
    } else {
      viewer.scene.globe.translucency.enabled = false;
    }

    viewer.scene.requestRender();
  }, [subsurfaceCameraEnabled, terrainOpacity, isInitializing]);

  // Handle clear excavation trigger
  useEffect(() => {
    if (clearExcavationTrigger > 0) {
      cleanupExcavation();
      cleanupMeasurements();
      activeExcavationPositionsRef.current = null;
    }
  }, [clearExcavationTrigger]);

  // Handle dynamic excavation depth changes to refresh the clipping volume and shoring walls
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    if (activeExcavationPositionsRef.current && activeExcavationPositionsRef.current.length >= 3) {
      if (excavationDepth <= 0) {
        cleanupExcavation();
        activeExcavationPositionsRef.current = null;
      } else {
        drawExcavationPit(activeExcavationPositionsRef.current, excavationDepth);
      }
    }
  }, [excavationDepth, isInitializing]);

  // Render simulated underground utility pipelines
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // First clear old utilities
    utilityEntitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity);
    });
    utilityEntitiesRef.current = [];

    if (!subsurfaceUtilitiesVisible) {
      viewer.scene.requestRender();
      return;
    }

    // Get center coordinates of current preset or fallback to Zurich
    let centerLat = 47.3769; 
    let centerLon = 8.5417;
    let baseHeight = 430;

    if (selectedPreset) {
      centerLat = selectedPreset.latitude;
      centerLon = selectedPreset.longitude;
      baseHeight = selectedPreset.height || 430;
    }

    if (utilitiesShapefileData && utilitiesShapefileData.features && utilitiesShapefileData.features.length > 0) {
      interface UtilityFeatureRange {
        startIndex: number;
        endIndex: number;
        depth: number;
        pipeEntity: Cesium.Entity;
      }

      const featuresCount = utilitiesShapefileData.features.length;
      // If we have a lot of lines, render them as flat hardware-accelerated polylines to prevent CPU/GPU memory exhaustion.
      // 3D polyline volumes are extremely heavy in WebGL and are only feasible for small datasets.
      const renderAs3DVolume = featuresCount <= 150;

      const allQueryPoints: Cesium.Cartesian3[] = [];
      const ranges: UtilityFeatureRange[] = [];

      utilitiesShapefileData.features.forEach((feat, idx) => {
        if (!feat.positions || feat.positions.length < 2) return;

        // Check if feature's layer is disabled
        const layerName = (
          feat.properties?.layer ||
          feat.properties?.LAYER ||
          feat.properties?.Layer ||
          feat.properties?.System ||
          feat.properties?.SYSTEM ||
          feat.properties?.type ||
          feat.properties?.TYPE ||
          feat.properties?.UTILITY ||
          feat.properties?.utility ||
          'Main Utility Network'
        ).toString().trim();

        if (disabledUtilityLayers && disabledUtilityLayers.includes(layerName)) {
          return;
        }

        // Determine pipe diameter from selected attribute or fallback search
        let rawDiameter = selectedPipeAttribute ? feat.properties?.[selectedPipeAttribute] : undefined;
        if (rawDiameter === undefined || rawDiameter === null || rawDiameter === '') {
          const props = feat.properties || {};
          const matchingKey = Object.keys(props).find(k => 
            k.toUpperCase() === 'PIPEDIAMET' || 
            k.toUpperCase() === 'DIAMETER' || 
            k.toUpperCase() === 'PIPE_SIZE' || 
            k.toUpperCase() === 'SIZE_MM' || 
            k.toUpperCase() === 'DN'
          );
          if (matchingKey) {
            rawDiameter = props[matchingKey];
          }
        }

        let pipeRadius = 0.3; // fallback 30cm radius
        const valNum = Number(rawDiameter);
        if (!isNaN(valNum) && valNum > 0) {
          if (useActualDiameter) {
            // Attribute is in mm. Convert mm to radius in meters: (valNum / 1000) / 2
            const radiusMeters = (valNum / 1000) / 2;
            pipeRadius = Math.max(0.015, radiusMeters); // min 15mm radius to avoid vanishing
          } else {
            pipeRadius = Math.max(0.2, Math.min(1.5, 0.2 + (valNum / 1000) * 0.4));
          }
        } else {
          pipeRadius = useActualDiameter ? 0.1 : 0.3;
        }

        // Color code by utility type (Water = Blue, Electric = Red, Gas = Yellow, Sewer = Green)
        let pipeColor = Cesium.Color.CYAN;
        const utilityType = String(feat.properties?.TYPE || feat.properties?.type || feat.properties?.UTILITY || feat.properties?.utility || '').toLowerCase();
        
        if (utilityType.includes('water')) pipeColor = Cesium.Color.BLUE;
        else if (utilityType.includes('electric') || utilityType.includes('power')) pipeColor = Cesium.Color.RED;
        else if (utilityType.includes('gas') || utilityType.includes('fuel')) pipeColor = Cesium.Color.YELLOW;
        else if (utilityType.includes('sewer') || utilityType.includes('drain')) pipeColor = Cesium.Color.GREEN;

        // Determine depth of the pipes relative to local terrain or preset
        const rawDepth = feat.properties?.DEPTH || feat.properties?.depth || feat.properties?.OFFSET || feat.properties?.offset;
        const depth = (rawDepth !== undefined) ? -Math.abs(Number(rawDepth)) : -5; // default 5m underground

        // Calculate initial fallback positions (sync) using terrain height if loaded, otherwise base preset height
        const positions = feat.positions.map(([lng, lat]) => {
          const carto = Cesium.Cartographic.fromDegrees(lng, lat);
          const terrainHeight = (viewer.scene && viewer.scene.globe) ? (viewer.scene.globe.getHeight(carto) ?? baseHeight) : baseHeight;
          const pipeHeight = terrainHeight + depth;
          return Cesium.Cartesian3.fromDegrees(lng, lat, pipeHeight);
        });

        let pipeEntity;

        if (renderAs3DVolume) {
          // Add 3D volumetric cylindrical pipe (heavy mesh, premium for small files)
          pipeEntity = viewer.entities.add({
            name: feat.properties?.NAME || feat.properties?.name || `Utility Pipe ${idx + 1}`,
            polylineVolume: {
              positions: positions,
              shape: createPipeShape(pipeRadius, 12),
              material: new Cesium.ColorMaterialProperty(pipeColor.withAlpha(0.85)),
              outline: true,
              outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
              outlineWidth: 1.5,
              cornerType: Cesium.CornerType.ROUNDED
            },
            properties: new Cesium.PropertyBag(feat.properties)
          });
        } else {
          // Add standard flat polyline (lightweight, runs at 60 FPS for 10k+ lines)
          pipeEntity = viewer.entities.add({
            name: feat.properties?.NAME || feat.properties?.name || `Utility Pipe ${idx + 1}`,
            polyline: {
              positions: positions,
              width: 4,
              material: new Cesium.ColorMaterialProperty(pipeColor.withAlpha(0.85)),
              clampToGround: false // Subterranean, so we don't clamp to surface
            },
            properties: new Cesium.PropertyBag(feat.properties)
          });
        }

        utilityEntitiesRef.current.push(pipeEntity);

        if (renderAs3DVolume) {
          // Prepare for batched high-precision clamping (only for 3D volumes to avoid async network throttling)
          const start = allQueryPoints.length;
          feat.positions.forEach(([lng, lat]) => {
            allQueryPoints.push(Cesium.Cartesian3.fromDegrees(lng, lat, baseHeight));
          });
          const end = allQueryPoints.length;

          ranges.push({
            startIndex: start,
            endIndex: end,
            depth,
            pipeEntity
          });
        }
      });

      // Execute batched high-precision clamping only for premium 3D volumes to avoid memory overflow on detailed drawings
      if (renderAs3DVolume && allQueryPoints.length > 0 && viewer.scene && viewer.scene.clampToHeightMostDetailed) {
        const chunkSize = 500;
        const totalPoints = allQueryPoints.length;
        const clampedResults = new Array<Cesium.Cartesian3 | undefined>(totalPoints);
        const promises: Promise<void>[] = [];

        for (let i = 0; i < totalPoints; i += chunkSize) {
          const startIdx = i;
          const endIdx = Math.min(i + chunkSize, totalPoints);
          const chunkPoints = allQueryPoints.slice(startIdx, endIdx);

          const promise = viewer.scene.clampToHeightMostDetailed(chunkPoints)
            .then((clampedChunk) => {
              if (viewer.isDestroyed() || !viewer.scene || viewer.scene.isDestroyed()) return;
              if (clampedChunk && Array.isArray(clampedChunk)) {
                for (let j = 0; j < clampedChunk.length; j++) {
                  clampedResults[startIdx + j] = clampedChunk[j];
                }
              }
            })
            .catch((err) => {
              console.warn(`clampToHeightMostDetailed failed for chunk ${startIdx}-${endIdx}:`, err);
            });
          promises.push(promise);
        }

        Promise.all(promises).then(() => {
          if (viewer.isDestroyed() || !viewer.scene || viewer.scene.isDestroyed()) return;

          ranges.forEach(({ startIndex, endIndex, depth, pipeEntity }) => {
            const finalPositions: Cesium.Cartesian3[] = [];
            for (let k = startIndex; k < endIndex; k++) {
              const clampedPt = clampedResults[k];
              if (clampedPt) {
                try {
                  const carto = Cesium.Cartographic.fromCartesian(clampedPt);
                  const pipeHeight = carto.height + depth;
                  finalPositions.push(Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, pipeHeight));
                } catch (e) {
                  // Ignore parse error
                }
              }
            }

            if (finalPositions.length >= 2 && pipeEntity.polylineVolume) {
              pipeEntity.polylineVolume.positions = new Cesium.ConstantProperty(finalPositions) as any;
            }
          });
          viewer.scene.requestRender();
        });
      }
    } else {
      const utilities = [
        {
          name: 'Water Main (Potable)',
          color: '#3b82f6', // Blue
          depth: -10,
          radius: 0.40, // 40cm radius (80cm diameter)
          offsets: [
            [[-0.004, -0.001], [0.004, -0.001]],
            [[-0.001, -0.004], [-0.001, 0.004]],
          ]
        },
        {
          name: 'High-Pressure Gas',
          color: '#eab308', // Yellow
          depth: -15,
          radius: 0.25, // 25cm radius (50cm diameter)
          offsets: [
            [[-0.004, 0.0015], [0.004, 0.0015]],
            [[0.0015, -0.004], [0.0015, 0.004]],
          ]
        },
        {
          name: 'Electric Grid Conduit',
          color: '#ef4444', // Red
          depth: -6,
          radius: 0.15, // 15cm radius (30cm diameter)
          offsets: [
            [[-0.004, -0.0003], [0.004, -0.0003]],
            [[-0.0003, -0.004], [-0.0003, 0.004]],
          ]
        },
        {
          name: 'Stormwater Sewer',
          color: '#22c55e', // Green
          depth: -20,
          radius: 0.60, // 60cm radius (1.2m diameter)
          offsets: [
            [[-0.004, 0.0005], [0.004, 0.0005]],
            [[0.0005, -0.004], [0.0005, 0.004]],
          ]
        }
      ];

      utilities.forEach(util => {
        const cesColor = Cesium.Color.fromCssColorString(util.color);

        util.offsets.forEach((offsetLine, idx) => {
          const positions = offsetLine.map(([dLat, dLon]) => {
            const lon = centerLon + dLon;
            const lat = centerLat + dLat;
            const carto = Cesium.Cartographic.fromDegrees(lon, lat);
            const terrainHeight = (viewer.scene && viewer.scene.globe) ? (viewer.scene.globe.getHeight(carto) ?? baseHeight) : baseHeight;
            const pipeHeight = terrainHeight + util.depth;
            return Cesium.Cartesian3.fromDegrees(lon, lat, pipeHeight);
          });

          // Add 3D volumetric cylindrical pipe
          const pipeEntity = viewer.entities.add({
            name: `${util.name} Pipe ${idx + 1}`,
            polylineVolume: {
              positions: positions,
              shape: createPipeShape(util.radius, 12), // 12 segments for smooth cylindrical shape
              material: new Cesium.ColorMaterialProperty(cesColor.withAlpha(0.85)),
              outline: true,
              outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
              outlineWidth: 1.5,
              cornerType: Cesium.CornerType.ROUNDED
            }
          });

          utilityEntitiesRef.current.push(pipeEntity);

          // Perform asynchronous high-precision clamping to snap simulated pipe underground perfectly
          if (viewer.scene && viewer.scene.clampToHeightMostDetailed) {
            const queryPoints = offsetLine.map(([dLat, dLon]) => {
              return Cesium.Cartesian3.fromDegrees(centerLon + dLon, centerLat + dLat, baseHeight);
            });

            viewer.scene.clampToHeightMostDetailed(queryPoints).then((clampedPoints) => {
              if (viewer.isDestroyed() || !viewer.scene || viewer.scene.isDestroyed()) return;
              if (!clampedPoints || !Array.isArray(clampedPoints) || clampedPoints.length === 0) return;

              const finalPositions = clampedPoints.map((clampedPt) => {
                if (!clampedPt) return null;
                try {
                  const carto = Cesium.Cartographic.fromCartesian(clampedPt);
                  const pipeHeight = carto.height + util.depth;
                  return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, pipeHeight);
                } catch (e) {
                  return null;
                }
              }).filter(Boolean) as Cesium.Cartesian3[];

              if (finalPositions.length >= 2) {
                pipeEntity.polylineVolume.positions = new Cesium.ConstantProperty(finalPositions) as any;
              }
            }).catch((err) => {
              console.warn('clampToHeightMostDetailed failed for fallback utility pipe:', err);
            });
          }
        });
      });
    }

    viewer.scene.requestRender();
  }, [subsurfaceUtilitiesVisible, selectedPreset, utilitiesShapefileData, isInitializing, disabledUtilityLayers, selectedPipeAttribute, useActualDiameter]);

  // Helper to cleanup measurement entities from the scene
  const cleanupMeasurements = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    
    measurementEntitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity);
    });
    measurementEntitiesRef.current = [];
    clickedPositionsRef.current = [];
    tempMousePosRef.current = null;
    setViewCorridorResult(null);

    if (parametricMassingEntitiesRef.current.length > 0) {
      parametricMassingEntitiesRef.current.forEach(e => {
        if (!viewer.isDestroyed()) viewer.entities.remove(e);
      });
      parametricMassingEntitiesRef.current = [];
    }
    if (parametricMassingEntityRef.current) {
      if (!viewer.isDestroyed()) viewer.entities.remove(parametricMassingEntityRef.current);
      parametricMassingEntityRef.current = null;
    }
    massingPositionsRef.current = [];
    if (onMassingAreaChange) {
      onMassingAreaChange(null);
    }

    viewer.scene.requestRender();
  };

  // Handle measurement tools (distance, height, area)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (activeTool === 'none') {
      // Do not clear measurements here so completed polygons/drawings remain visible
      return;
    }

    // Reset previous measurements when starting a new tool session
    cleanupMeasurements();
    setFloatingMarker(null);
    onMeasureResultChange('Drawing initialized. Click on the 3D canvas to start.');

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    let drawingEntity: Cesium.Entity | null = null;

    if (activeTool === 'distance') {
      drawingEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
            }
            return list;
          }, false),
          width: 4,
          material: Cesium.Color.fromCssColorString('#3b82f6'),
          clampToGround: true
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);
    } else if (activeTool === 'height') {
      // 1. Direct line between click and cursor
      drawingEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (clickedPositionsRef.current.length === 0) return [];
            const start = clickedPositionsRef.current[0];
            const end = tempMousePosRef.current || start;
            return [start, end];
          }, false),
          width: 3,
          material: Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.7), // Amber
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);

      // 2. Vertical line at Start (lat, lon) from start height to end height
      const verticalLine = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (clickedPositionsRef.current.length === 0) return [];
            const start = clickedPositionsRef.current[0];
            const end = tempMousePosRef.current || start;
            const startCarto = Cesium.Cartographic.fromCartesian(start);
            const endCarto = Cesium.Cartographic.fromCartesian(end);
            
            const startVertical = start;
            const endVertical = Cesium.Cartesian3.fromRadians(
              startCarto.longitude,
              startCarto.latitude,
              endCarto.height
            );
            return [startVertical, endVertical];
          }, false),
          width: 4,
          material: new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.fromCssColorString('#ef4444'), // Red for height
            outlineWidth: 1.5,
            outlineColor: Cesium.Color.BLACK
          })
        }
      });
      measurementEntitiesRef.current.push(verticalLine);

      // 3. Horizontal line from top of vertical line to cursor
      const horizontalLine = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (clickedPositionsRef.current.length === 0) return [];
            const start = clickedPositionsRef.current[0];
            const end = tempMousePosRef.current || start;
            const startCarto = Cesium.Cartographic.fromCartesian(start);
            const endCarto = Cesium.Cartographic.fromCartesian(end);
            
            const verticalTop = Cesium.Cartesian3.fromRadians(
              startCarto.longitude,
              startCarto.latitude,
              endCarto.height
            );
            return [verticalTop, end];
          }, false),
          width: 2,
          material: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.6), // Light Blue
        }
      });
      measurementEntitiesRef.current.push(horizontalLine);
    } else if (activeTool === 'area') {
      drawingEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
            }
            if (list.length < 3) return new Cesium.PolygonHierarchy([]);
            const ellipsoidPositions = list.map(p => {
              const carto = Cesium.Cartographic.fromCartesian(p);
              return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
            });
            return new Cesium.PolygonHierarchy(ellipsoidPositions);
          }, false),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#10b981').withAlpha(0.35)),
          classificationType: Cesium.ClassificationType.BOTH
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);

      const borderEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
              if (list.length >= 3) {
                list.push(list[0]);
              }
            } else if (list.length >= 3) {
              list.push(list[0]);
            }
            return list.map(p => {
              const carto = Cesium.Cartographic.fromCartesian(p);
              return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
            });
          }, false),
          width: 3.5,
          material: Cesium.Color.fromCssColorString('#10b981'),
          clampToGround: true
        }
      });
      measurementEntitiesRef.current.push(borderEntity);
    } else if (activeTool === 'view-corridor') {
      drawingEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (clickedPositionsRef.current.length === 0) return [];
            const start = clickedPositionsRef.current[0];
            const end = tempMousePosRef.current || start;
            return [start, end];
          }, false),
          width: 3.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.CYAN,
            dashLength: 16
          })
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);
    } else if (activeTool === 'viewshed') {
      drawingEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (clickedPositionsRef.current.length === 0) return [];
            const start = clickedPositionsRef.current[0];
            const end = tempMousePosRef.current || start;
            return [start, end];
          }, false),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#f59e0b'),
            dashLength: 16
          })
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);
    } else if (activeTool === 'boundary') {
      drawingEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
            }
            if (list.length < 3) return new Cesium.PolygonHierarchy([]);
            return new Cesium.PolygonHierarchy(list);
          }, false),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.2)),
          classificationType: Cesium.ClassificationType.BOTH
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);

      const borderEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
              if (list.length >= 3) {
                list.push(list[0]);
              }
            } else if (list.length >= 3) {
              list.push(list[0]);
            }
            return list;
          }, false),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#3b82f6'),
            dashLength: 12
          }),
          clampToGround: true
        }
      });
      measurementEntitiesRef.current.push(borderEntity);
    } else if (activeTool === 'parametric-massing') {
      drawingEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
            }
            if (list.length < 3) return new Cesium.PolygonHierarchy([]);
            return new Cesium.PolygonHierarchy(list);
          }, false),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.2)),
          classificationType: Cesium.ClassificationType.BOTH
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);

      const borderEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
              if (list.length >= 3) {
                list.push(list[0]);
              }
            } else if (list.length >= 3) {
              list.push(list[0]);
            }
            return list;
          }, false),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#f59e0b'),
            dashLength: 12
          }),
          clampToGround: true
        }
      });
      measurementEntitiesRef.current.push(borderEntity);
    } else if (activeTool === 'subsurface-excavation') {
      drawingEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
            }
            if (list.length < 3) return new Cesium.PolygonHierarchy([]);
            return new Cesium.PolygonHierarchy(list);
          }, false),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ea580c').withAlpha(0.2)),
          classificationType: Cesium.ClassificationType.BOTH
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);

      const borderEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
              if (list.length >= 3) {
                list.push(list[0]);
              }
            } else if (list.length >= 3) {
              list.push(list[0]);
            }
            return list;
          }, false),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#ea580c'),
            dashLength: 12
          }),
          clampToGround: true
        }
      });
      measurementEntitiesRef.current.push(borderEntity);
    } else if (activeTool === '3d-tiles-clip') {
      drawingEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
            }
            if (list.length < 3) return new Cesium.PolygonHierarchy([]);
            return new Cesium.PolygonHierarchy(list);
          }, false),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.25)),
          classificationType: Cesium.ClassificationType.BOTH
        }
      });
      measurementEntitiesRef.current.push(drawingEntity);

      const borderEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const list = [...clickedPositionsRef.current];
            if (tempMousePosRef.current) {
              list.push(tempMousePosRef.current);
              if (list.length >= 3) {
                list.push(list[0]);
              }
            } else if (list.length >= 3) {
              list.push(list[0]);
            }
            return list;
          }, false),
          width: 3.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#ef4444'),
            dashLength: 12
          }),
          clampToGround: true
        }
      });
      measurementEntitiesRef.current.push(borderEntity);
    }

    // Mouse Move listener: update cursor rubberband & HTML marker
    handler.setInputAction((movement: any) => {
      let rawCartesian = viewer.scene.pickPosition(movement.endPosition);
      if (!Cesium.defined(rawCartesian)) {
        rawCartesian = viewer.camera.pickEllipsoid(movement.endPosition);
      }

      if (Cesium.defined(rawCartesian)) {
        lastRawCartesianRef.current = rawCartesian;
        markerCartesianRef.current = rawCartesian;

        const typedVal = parseFloat(typedLengthRef.current);
        const typedNum = (!isNaN(typedVal) && typedVal > 0) ? typedVal : null;

        const constrained = getConstrainedCandidatePosition(
          rawCartesian,
          clickedPositionsRef.current,
          orthoModeRef.current,
          typedNum
        );

        const cartesian = constrained.position;
        tempMousePosRef.current = cartesian;

        const mouseX = movement.endPosition.x;
        const mouseY = movement.endPosition.y;
        
        if (clickedPositionsRef.current.length > 0) {
          const list = [...clickedPositionsRef.current, cartesian];

          let extraBadge = '';
          if (typedLengthRef.current !== '') {
            extraBadge = ` ⌨️ Length: ${typedLengthRef.current}m [Enter ↵]`;
          } else if (constrained.isOrthoLocked) {
            extraBadge = ` [ORTHO ${constrained.angleDeg !== null ? constrained.angleDeg + '°' : ''}]`;
          }

          if (activeTool === 'distance') {
            const totalDist = calculateDistance(list);
            const formatted = formatDistance(totalDist);
            onMeasureResultChange(`Drawing path... Total: ${formatted}${extraBadge}`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Distance: ${formatted}${extraBadge}`,
              visible: true
            });
          } else if (activeTool === 'height') {
            const startCarto = Cesium.Cartographic.fromCartesian(clickedPositionsRef.current[0]);
            const endCarto = Cesium.Cartographic.fromCartesian(cartesian);
            const heightDiff = Math.abs(endCarto.height - startCarto.height);
            const formatted = `${heightDiff.toFixed(2)} m`;
            onMeasureResultChange(`Measuring height... Height: ${formatted}`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: `Height: ${formatted}`,
              visible: true
            });
          } else if (activeTool === 'area') {
            if (list.length >= 3) {
              const totalArea = calculateArea(list);
              const formatted = formatArea(totalArea);
              onMeasureResultChange(`Drawing area... Surface Area: ${formatted}.${extraBadge} Right-click to finish.`);
              setFloatingMarker({
                x: mouseX,
                y: mouseY,
                text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Area: ${formatted}${extraBadge}`,
                visible: true
              });
            } else {
              onMeasureResultChange(`Drawing area... Added ${clickedPositionsRef.current.length} vertex/vertices.${extraBadge} Click or type length to add vertex ${list.length}.`);
              setFloatingMarker({
                x: mouseX,
                y: mouseY,
                text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Place vertex ${list.length}${extraBadge}`,
                visible: true
              });
            }
          } else if (activeTool === 'viewshed') {
            const distance = Cesium.Cartesian3.distance(clickedPositionsRef.current[0], cartesian);
            const formatted = distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(1)} m`;
            onMeasureResultChange(`Viewshed observer locked. Aiming corridor: ${formatted} (Click to cast ray)`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: `Corridor: ${formatted}`,
              visible: true
            });
          } else if (activeTool === 'view-corridor') {
            const distance = Cesium.Cartesian3.distance(clickedPositionsRef.current[0], cartesian);
            const formatted = distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(1)} m`;
            onMeasureResultChange(`Observer Node 1 established. Aiming corridor target: ${formatted} (Click to lock Target Landmark)`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: `Target Distance: ${formatted}`,
              visible: true
            });
          } else if (activeTool === 'boundary') {
            onMeasureResultChange(`Drawing boundary... ${list.length - 1} node(s) placed.${extraBadge} Click/Enter to drop node, Right-click to close boundary.`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Nodes: ${list.length - 1}${extraBadge}`,
              visible: true
            });
          } else if (activeTool === 'parametric-massing') {
            const tempArea = calculateArea(list);
            const formatted = formatArea(tempArea);
            onMeasureResultChange(`Drawing massing... Footprint Area: ${formatted}.${extraBadge} Click/Enter to drop vertex, Right-click to close & extrude.`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Area: ${formatted}${extraBadge}`,
              visible: true
            });
          } else if (activeTool === 'subsurface-excavation') {
            const tempArea = calculateArea(list);
            const formatted = formatArea(tempArea);
            onMeasureResultChange(`Drawing excavation pit... Area: ${formatted}.${extraBadge} Click/Enter to drop vertex, Right-click to close & excavate.`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Excavation Area: ${formatted}${extraBadge}`,
              visible: true
            });
          } else if (activeTool === '3d-tiles-clip') {
            const tempArea = calculateArea(list);
            const formatted = formatArea(tempArea);
            onMeasureResultChange(`Drawing 3D tiles clipping polygon... Area: ${formatted}.${extraBadge} Click/Enter to drop vertex, Right-click to finalize.`);
            setFloatingMarker({
              x: mouseX,
              y: mouseY,
              text: typedLengthRef.current ? `Length: ${typedLengthRef.current} m (Enter ↵)` : `Clipping Area: ${formatted}${extraBadge}`,
              visible: true
            });
          }
        } else {
          if (activeTool === 'distance') {
            onMeasureResultChange('Click to place start node for distance path.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click to start path', visible: true });
          } else if (activeTool === 'height') {
            onMeasureResultChange('Click to place the ground/base point for height measurement.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click base point', visible: true });
          } else if (activeTool === 'area') {
            onMeasureResultChange('Click to place the first boundary vertex.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click to start area', visible: true });
          } else if (activeTool === 'viewshed') {
            onMeasureResultChange('Click on a building or point to establish the Observer location.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click Observer origin', visible: true });
          } else if (activeTool === 'view-corridor') {
            onMeasureResultChange('Click on a building window or street point to set Node 1 (Observer Origin).');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click Node 1 origin', visible: true });
          } else if (activeTool === 'boundary') {
            onMeasureResultChange('Click to place the first node of the spatial masking boundary.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click to start boundary', visible: true });
          } else if (activeTool === 'parametric-massing') {
            onMeasureResultChange('Click to place the first vertex of your massing polygon.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click start vertex', visible: true });
          } else if (activeTool === 'subsurface-excavation') {
            onMeasureResultChange('Click to place the first vertex of your subsurface excavation pit boundary.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click start excavation', visible: true });
          } else if (activeTool === '3d-tiles-clip') {
            onMeasureResultChange('Click to place the first vertex of your 3D tiles clipping polygon.');
            setFloatingMarker({ x: mouseX, y: mouseY, text: 'Click start clipping polygon', visible: true });
          }
        }
        viewer.scene.requestRender();
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Left Click listener: add node
    handler.setInputAction((click: any) => {
      let rawCartesian = viewer.scene.pickPosition(click.position);
      if (!Cesium.defined(rawCartesian)) {
        rawCartesian = viewer.camera.pickEllipsoid(click.position);
      }

      if (Cesium.defined(rawCartesian)) {
        const typedVal = parseFloat(typedLengthRef.current);
        const typedNum = (!isNaN(typedVal) && typedVal > 0) ? typedVal : null;

        const constrained = getConstrainedCandidatePosition(
          rawCartesian,
          clickedPositionsRef.current,
          orthoModeRef.current,
          typedNum
        );

        const cartesian = constrained.position;
        setTypedLengthStr('');

        if (activeTool === 'boundary' && boundaryShape === 'circle') {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          if (onBoundaryCenterChange) {
            onBoundaryCenterChange({
              latitude: cartographic.latitude,
              longitude: cartographic.longitude
            });
          }
          if (onActiveAnalysisCenterChange) {
            onActiveAnalysisCenterChange({
              latitude: cartographic.latitude,
              longitude: cartographic.longitude,
              height: cartographic.height
            });
          }
          onMeasureResultChange(`Circular spatial mask placed at center ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(5)}°, ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(5)}°.`);
          
          // Finish/finalize tool
          tempMousePosRef.current = null;
          handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
          onActiveToolChange('none');
          viewer.scene.requestRender();
          return;
        }

        clickedPositionsRef.current.push(cartesian);

        // Render point marker
        const markerColor = 
          activeTool === 'distance' ? '#3b82f6' : 
          activeTool === 'height' ? '#f59e0b' : 
          activeTool === 'view-corridor' ? '#06b6d4' :
          activeTool === 'viewshed' ? '#f59e0b' : '#10b981';

        const marker = viewer.entities.add({
          position: cartesian,
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString(markerColor),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        measurementEntitiesRef.current.push(marker);

        // Add labels & state advancement
        if (activeTool === 'distance') {
          const totalDist = calculateDistance(clickedPositionsRef.current);
          const formatted = formatDistance(totalDist);
          const label = viewer.entities.add({
            position: cartesian,
            label: {
              text: formatted,
              font: 'bold 12px monospace',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          measurementEntitiesRef.current.push(label);
          onMeasureResultChange(`Node added! Path Total: ${formatted} (Right-click to finish drawing)`);
        } else if (activeTool === 'height') {
          if (clickedPositionsRef.current.length === 1) {
            const startCarto = Cesium.Cartographic.fromCartesian(cartesian);
            onMeasureResultChange(`Base point locked at elevation ${startCarto.height.toFixed(1)}m. Click high structure point/rooftop to measure height.`);
          } else if (clickedPositionsRef.current.length === 2) {
            const start = clickedPositionsRef.current[0];
            const end = clickedPositionsRef.current[1];
            const startCarto = Cesium.Cartographic.fromCartesian(start);
            const endCarto = Cesium.Cartographic.fromCartesian(end);
            const heightDiff = Math.abs(endCarto.height - startCarto.height);
            const formatted = `${heightDiff.toFixed(2)} m`;

            // Draw final vertical label on the end point
            const label = viewer.entities.add({
              position: end,
              label: {
                text: `Height: ${formatted}`,
                font: 'bold 12px monospace',
                fillColor: Cesium.Color.fromCssColorString('#ef4444'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
            measurementEntitiesRef.current.push(label);

            onMeasureResultChange(`Analysis Complete. Measured Vertical Height: ${formatted}`);
            setFloatingMarker({
              x: 0, y: 0,
              text: `Height: ${formatted}`,
              visible: true
            });

            // Finish the drawing tool automatically
            tempMousePosRef.current = null;
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            onActiveToolChange('none');
          }
        } else if (activeTool === 'area') {
          if (clickedPositionsRef.current.length >= 3) {
            const totalArea = calculateArea(clickedPositionsRef.current);
            onMeasureResultChange(`Polygon closed! Area: ${formatArea(totalArea)} (Right-click to finalize surface analysis)`);
          } else {
            onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to calculate area.`);
          }
        } else if (activeTool === 'view-corridor') {
          if (clickedPositionsRef.current.length === 1) {
            const startCarto = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(startCarto.latitude);
            const lon = Cesium.Math.toDegrees(startCarto.longitude);
            // Observer node is 1.5m above the pointed location to simulate a person's eyesight height
            const height = startCarto.height + 1.5;

            onViewCorridorNode1Change?.({ lat, lon, height });

            const observerCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, height);
            clickedPositionsRef.current[0] = observerCartesian;

            const label = viewer.entities.add({
              position: observerCartesian,
              label: {
                text: 'Observer (Node 1 - Eye Height +1.5m)',
                font: 'bold 11px monospace',
                fillColor: Cesium.Color.fromCssColorString('#06b6d4'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
            measurementEntitiesRef.current.push(label);
            onMeasureResultChange('Observer (Node 1, +1.5m eyesight height) set. Move mouse to target landmark (Node 2) and click to lock.');
          } else if (clickedPositionsRef.current.length === 2) {
            const targetCarto = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(targetCarto.latitude);
            const lon = Cesium.Math.toDegrees(targetCarto.longitude);
            const height = targetCarto.height;

            onViewCorridorNode2Change?.({ lat, lon, height });

            const label = viewer.entities.add({
              position: cartesian,
              label: {
                text: 'Target (Node 2)',
                font: 'bold 11px monospace',
                fillColor: Cesium.Color.fromCssColorString('#06b6d4'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
            measurementEntitiesRef.current.push(label);

            onMeasureResultChange('Creating 3D view corridor and airspace protection envelope...');

            // Done drawing, remove drawing listeners and tool selection
            tempMousePosRef.current = null;
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            onActiveToolChange('none');
            viewer.scene.requestRender();
          }
        } else if (activeTool === 'viewshed') {
          if (clickedPositionsRef.current.length === 1) {
            const label = viewer.entities.add({
              position: cartesian,
              label: {
                text: 'Observer (Point A)',
                font: 'bold 11px "JetBrains Mono", monospace',
                fillColor: Cesium.Color.fromCssColorString('#10b981'), // Vibrant green
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
            measurementEntitiesRef.current.push(label);
            onMeasureResultChange('Observer established. Click a second time to set the target landmark and cast Line-of-Sight.');
          } else if (clickedPositionsRef.current.length === 2) {
            const pointA = clickedPositionsRef.current[0];
            const pointB = clickedPositionsRef.current[1];
            
            const label = viewer.entities.add({
              position: pointB,
              label: {
                text: 'Target (Point B)',
                font: 'bold 11px "JetBrains Mono", monospace',
                fillColor: Cesium.Color.fromCssColorString('#3b82f6'), // Blue for target
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
            measurementEntitiesRef.current.push(label);
            
            onMeasureResultChange('Casting viewshed Line-of-Sight rays...');
            
            // Remove drawing listeners
            tempMousePosRef.current = null;
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            
            const N = 100; // 100 high-precision samples along path
            const samplePoints: Cesium.Cartesian3[] = [];
            for (let i = 0; i <= N; i++) {
              const fraction = i / N;
              const pt = Cesium.Cartesian3.lerp(pointA, pointB, fraction, new Cesium.Cartesian3());
              samplePoints.push(pt);
            }
            
            viewer.scene.clampToHeightMostDetailed(samplePoints).then((clampedPoints) => {
              if (viewer.isDestroyed() || !viewer.scene || viewer.scene.isDestroyed()) return;
              
              let obstructionIndex = -1;
              
              // Walk sample points (skipping extreme endpoints to prevent self-intersection with observer/target surfaces)
              for (let i = 2; i < N - 1; i++) {
                const ptLine = samplePoints[i];
                const ptClamped = clampedPoints[i];
                
                if (ptLine && ptClamped) {
                  const cartoLine = Cesium.Cartographic.fromCartesian(ptLine);
                  const cartoClamped = Cesium.Cartographic.fromCartesian(ptClamped);
                  
                  // If physical surface height is higher than the direct line of sight at this segment
                  if (cartoClamped.height > cartoLine.height + 1.0) {
                    obstructionIndex = i;
                    break; // First obstruction encountered
                  }
                }
              }
              
              const totalDistance = Cesium.Cartesian3.distance(pointA, pointB);
              const observerCarto = Cesium.Cartographic.fromCartesian(pointA);
              const targetCarto = Cesium.Cartographic.fromCartesian(pointB);
              
              if (obstructionIndex !== -1) {
                // OBSTRUCTED path!
                const obstructionPoint = samplePoints[obstructionIndex];
                const obstructionClampedPoint = clampedPoints[obstructionIndex];
                const obstructionCarto = Cesium.Cartographic.fromCartesian(obstructionClampedPoint);
                const obstructionDistance = Cesium.Cartesian3.distance(pointA, obstructionPoint);
                
                // Segment 1: Observer to Obstruction (Clear Sightline) -> Green
                const greenSegment = viewer.entities.add({
                  polyline: {
                    positions: [pointA, obstructionPoint],
                    width: 5,
                    material: Cesium.Color.fromCssColorString('#10b981'), // Green
                    depthFailMaterial: Cesium.Color.fromCssColorString('#10b981').withAlpha(0.3)
                  }
                });
                measurementEntitiesRef.current.push(greenSegment);
                
                // Segment 2: Obstruction to Target (Blocked View) -> Red
                const redSegment = viewer.entities.add({
                  polyline: {
                    positions: [obstructionPoint, pointB],
                    width: 5,
                    material: Cesium.Color.fromCssColorString('#ef4444'), // Red
                    depthFailMaterial: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.3)
                  }
                });
                measurementEntitiesRef.current.push(redSegment);
                
                // Red warning marker & Label at obstruction spot
                const warningMarker = viewer.entities.add({
                  position: obstructionClampedPoint,
                  point: {
                    pixelSize: 12,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                  },
                  label: {
                    text: '⛔ OBSTRUCTION',
                    font: 'bold 10px "JetBrains Mono", monospace',
                    fillColor: Cesium.Color.RED,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 3,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -14),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                  }
                });
                measurementEntitiesRef.current.push(warningMarker);
                
                // Vertical visualization line highlighting the obstruction structure height
                const vertLine = viewer.entities.add({
                  polyline: {
                    positions: [obstructionPoint, obstructionClampedPoint],
                    width: 2,
                    material: new Cesium.PolylineDashMaterialProperty({
                      color: Cesium.Color.RED,
                      dashLength: 8
                    })
                  }
                });
                measurementEntitiesRef.current.push(vertLine);
                
                onMeasureResultChange(
                  `Blocked sightline. Obstruction at ${obstructionDistance.toFixed(1)}m from Observer, Height: ${obstructionCarto.height.toFixed(1)}m.`
                );
                
                setViewCorridorResult({
                  distance: totalDistance,
                  status: 'Blocked',
                  obstructionHeight: obstructionCarto.height,
                  obstructionDistance: obstructionDistance,
                  observerHeight: observerCarto.height,
                  targetHeight: targetCarto.height
                });
                
                setFloatingMarker({
                  x: 0, y: 0,
                  text: `Status: Blocked (at ${obstructionDistance.toFixed(0)}m)`,
                  visible: true
                });
              } else {
                // CLEAR sightline! Full line is green
                const clearLine = viewer.entities.add({
                  polyline: {
                    positions: [pointA, pointB],
                    width: 5,
                    material: Cesium.Color.fromCssColorString('#10b981'), // Green
                    depthFailMaterial: Cesium.Color.fromCssColorString('#10b981').withAlpha(0.3)
                  }
                });
                measurementEntitiesRef.current.push(clearLine);
                
                onMeasureResultChange(
                  `Clear sightline! Total Corridor Distance: ${totalDistance.toFixed(1)}m. No obstructions detected.`
                );
                
                setViewCorridorResult({
                  distance: totalDistance,
                  status: 'Clear',
                  observerHeight: observerCarto.height,
                  targetHeight: targetCarto.height
                });
                
                setFloatingMarker({
                  x: 0, y: 0,
                  text: `Status: Clear (${totalDistance.toFixed(0)}m)`,
                  visible: true
                });
              }
              
              onActiveToolChange('none');
              viewer.scene.requestRender();
            }).catch((err) => {
              console.error('Viewshed clampToHeight failed:', err);
              onMeasureResultChange('Line-of-Sight analysis failed. Ensure terrain/tilesets are fully loaded.');
              onActiveToolChange('none');
            });
          }
        } else if (activeTool === 'boundary') {
          if (clickedPositionsRef.current.length >= 3) {
            onMeasureResultChange(`Boundary polygon closed! ${clickedPositionsRef.current.length} vertices. Right-click to finalize and apply spatial mask.`);
          } else {
            onMeasureResultChange(`Added ${clickedPositionsRef.current.length} boundary vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define mask area.`);
          }
        } else if (activeTool === 'parametric-massing') {
          if (clickedPositionsRef.current.length >= 3) {
            onMeasureResultChange(`Massing boundary closed! ${clickedPositionsRef.current.length} vertices. Right-click to extrude conceptual 3D mass.`);
          } else {
            onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define footprint.`);
          }
        } else if (activeTool === 'subsurface-excavation') {
          if (clickedPositionsRef.current.length >= 3) {
            onMeasureResultChange(`Excavation boundary closed! ${clickedPositionsRef.current.length} vertices. Right-click to trigger 3D excavation pit.`);
          } else {
            onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define excavation footprint.`);
          }
        } else if (activeTool === '3d-tiles-clip') {
          if (clickedPositionsRef.current.length >= 3) {
            onMeasureResultChange(`3D tiles clipping polygon closed! ${clickedPositionsRef.current.length} vertices. Double-click or right-click to apply 3D tiles clip.`);
          } else {
            onMeasureResultChange(`Added ${clickedPositionsRef.current.length} vertex/vertices. Click at least ${3 - clickedPositionsRef.current.length} more times to define 3D tiles clipping polygon.`);
          }
        }

        viewer.scene.requestRender();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    const finalizeDrawing = () => {
      if (clickedPositionsRef.current.length === 0) return;

      if (activeTool === 'distance') {
        const finalDist = calculateDistance(clickedPositionsRef.current);
        onMeasureResultChange(`Analysis Complete. Final Geodesic Distance: ${formatDistance(finalDist)}`);
      } else if (activeTool === 'height') {
        if (clickedPositionsRef.current.length === 2) {
          const start = clickedPositionsRef.current[0];
          const end = clickedPositionsRef.current[1];
          const startCarto = Cesium.Cartographic.fromCartesian(start);
          const endCarto = Cesium.Cartographic.fromCartesian(end);
          const heightDiff = Math.abs(endCarto.height - startCarto.height);
          onMeasureResultChange(`Analysis Complete. Measured Vertical Height: ${heightDiff.toFixed(2)} m`);
        } else {
          onMeasureResultChange('Drawing cancelled. Height measurement requires exactly two points.');
          cleanupMeasurements();
        }
      } else if (activeTool === 'area') {
        if (clickedPositionsRef.current.length >= 3) {
          const finalArea = calculateArea(clickedPositionsRef.current);
          onMeasureResultChange(`Analysis Complete. Final Horizontal Surface Area: ${formatArea(finalArea)}`);
          
          try {
            const cartographics = clickedPositionsRef.current.map(p => Cesium.Cartographic.fromCartesian(p));
            const minHeight = Math.min(...cartographics.map(c => c.height));
            
            const serializedPositions = cartographics.map(c => ({
              lat: Cesium.Math.toDegrees(c.latitude),
              lon: Cesium.Math.toDegrees(c.longitude),
              height: c.height
            }));
            
            const centerLat = serializedPositions.reduce((sum, p) => sum + p.lat, 0) / serializedPositions.length;
            const centerLon = serializedPositions.reduce((sum, p) => sum + p.lon, 0) / serializedPositions.length;

            const sqMetersStr = `${finalArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq meters`;
            const sqKmStr = `${(finalArea / 1000000).toLocaleString(undefined, { maximumFractionDigits: 4 })} sq km`;
            const hectaresStr = `${(finalArea / 10000).toLocaleString(undefined, { maximumFractionDigits: 3 })} hectares`;
            const labelText = `Area:\n${sqMetersStr}\n${sqKmStr}\n${hectaresStr}`;

            const newAreaId = 'area-polygon-' + Date.now();
            const newAreaLayer = {
              id: newAreaId,
              name: `Area Polygon (${formatArea(finalArea)})`,
              type: 'area_polygon',
              visible: true,
              latitude: centerLat,
              longitude: centerLon,
              height: minHeight,
              positions: serializedPositions,
              area: finalArea,
              color: '#10b981',
              opacity: 0.35,
              labelText: labelText,
            };

            const updated = [...(importedLayers || []), newAreaLayer];
            if (onImportedLayersChange) {
              onImportedLayersChange(updated);
            }
            if (onActiveLayerIdChange) {
              onActiveLayerIdChange(newAreaId);
            }
          } catch (err) {
            console.error('Failed to create area polygon layer:', err);
          }

          cleanupMeasurements();
        } else {
          onMeasureResultChange('Drawing cancelled. Area computation requires at least 3 vertices.');
          cleanupMeasurements();
        }
      } else if (activeTool === 'boundary') {
        if (clickedPositionsRef.current.length >= 3) {
          let minLon = Number.MAX_VALUE;
          let maxLon = -Number.MAX_VALUE;
          let minLat = Number.MAX_VALUE;
          let maxLat = -Number.MAX_VALUE;

          clickedPositionsRef.current.forEach(pos => {
            const carto = Cesium.Cartographic.fromCartesian(pos);
            if (carto.longitude < minLon) minLon = carto.longitude;
            if (carto.longitude > maxLon) maxLon = carto.longitude;
            if (carto.latitude < minLat) minLat = carto.latitude;
            if (carto.latitude > maxLat) maxLat = carto.latitude;
          });

          const existing = viewer.entities.getById('analysis-boundary');
          if (existing) viewer.entities.remove(existing);
          const existingOutline = viewer.entities.getById('analysis-boundary-outline');
          if (existingOutline) viewer.entities.remove(existingOutline);

          const polygonPositions = [...clickedPositionsRef.current];
          viewer.entities.add({
            id: 'analysis-boundary',
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(polygonPositions),
              material: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.15),
              classificationType: Cesium.ClassificationType.TERRAIN
            }
          });

          viewer.entities.add({
            id: 'analysis-boundary-outline',
            polyline: {
              positions: [...polygonPositions, polygonPositions[0]],
              width: 3,
              material: new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#3b82f6'),
                dashLength: 12
              }),
              clampToGround: true
            }
          });

          if (onBoundaryBoundsChange) {
            onBoundaryBoundsChange({ minLon, maxLon, minLat, maxLat });
          }

          onMeasureResultChange('Spatial masking boundary applied successfully.');
        } else {
          onMeasureResultChange('Drawing cancelled. Boundary requires at least 3 vertices.');
          cleanupMeasurements();
        }
      } else if (activeTool === 'parametric-massing') {
        if (clickedPositionsRef.current.length >= 3) {
          const finalArea = calculateArea(clickedPositionsRef.current);
          const storeyHeight = massingFloorHeight || 3.5;
          onMeasureResultChange(`Massing complete. Footprint: ${finalArea.toFixed(1)} m². Extrusion height: ${(massingFloors * storeyHeight).toFixed(1)}m.`);
          
          if (onMassingAreaChange) {
            onMassingAreaChange(finalArea);
          }
          
          massingPositionsRef.current = [...clickedPositionsRef.current];

          try {
            const cartographics = clickedPositionsRef.current.map(p => Cesium.Cartographic.fromCartesian(p));
            const minHeight = Math.min(...cartographics.map(c => c.height));
            
            // Convert vertices to lat/lon/height
            const serializedPositions = cartographics.map(c => ({
              lat: Cesium.Math.toDegrees(c.latitude),
              lon: Cesium.Math.toDegrees(c.longitude),
              height: c.height
            }));
            
            const centerLat = serializedPositions.reduce((sum, p) => sum + p.lat, 0) / serializedPositions.length;
            const centerLon = serializedPositions.reduce((sum, p) => sum + p.lon, 0) / serializedPositions.length;

            const getZoningNameFromColor = (color: string): string => {
              const hex = color.toLowerCase();
              if (hex === '#ffffff' || hex === '#fff') return 'Conceptual';
              if (hex === '#f59e0b') return 'Residential';
              if (hex === '#ef4444') return 'Commercial';
              if (hex === '#8b5cf6') return 'Mixed-Use';
              if (hex === '#6b7280') return 'Industrial';
              if (hex === '#3b82f6') return 'Institutional';
              if (hex === '#10b981') return 'Open Space';
              return 'Custom';
            };

            const zoneName = getZoningNameFromColor(massingColor);
            
            const newMassingId = 'massing-' + Date.now();
            const newMassingLayer = {
              id: newMassingId,
              name: `${zoneName} Massing (${massingFloors} Fl)`,
              type: 'parametric_massing',
              visible: true,
              latitude: centerLat,
              longitude: centerLon,
              height: minHeight,
              floors: massingFloors,
              floorHeight: storeyHeight,
              color: massingColor,
              opacity: massingOpacity,
              levelColor: massingLevelColor,
              positions: serializedPositions,
              area: finalArea,
            };
            
            const updated = [...(importedLayers || []), newMassingLayer];
            if (onImportedLayersChange) {
              onImportedLayersChange(updated);
            }
            if (onActiveLayerIdChange) {
              onActiveLayerIdChange(newMassingId);
            }
          } catch (err) {
            console.error('Failed to serialize massing footprint:', err);
          }
          
          // Clear active drawing preview and temporary measurement elements completely
          cleanupMeasurements();
        } else {
          onMeasureResultChange('Drawing cancelled. Massing requires at least 3 vertices.');
          cleanupMeasurements();
          if (onMassingAreaChange) {
            onMassingAreaChange(null);
          }
          massingPositionsRef.current = [];
          if (parametricMassingEntitiesRef.current.length > 0) {
            parametricMassingEntitiesRef.current.forEach(e => {
              if (viewer && !viewer.isDestroyed()) viewer.entities.remove(e);
            });
            parametricMassingEntitiesRef.current = [];
          }
          if (parametricMassingEntityRef.current) {
            if (viewer && !viewer.isDestroyed()) viewer.entities.remove(parametricMassingEntityRef.current);
            parametricMassingEntityRef.current = null;
          }
        }
      } else if (activeTool === 'subsurface-excavation') {
        if (clickedPositionsRef.current.length >= 3) {
          const positions = [...clickedPositionsRef.current];
          drawExcavationPit(positions, excavationDepth);
          const finalArea = calculateArea(positions);
          onMeasureResultChange(`Excavation complete! Dynamic clipping hole and 3D shoring walls rendered. Footprint: ${finalArea.toFixed(1)} m², Depth: ${excavationDepth}m.`);
          cleanupMeasurements();
        } else {
          onMeasureResultChange('Drawing cancelled. Subsurface excavation requires at least 3 vertices.');
          cleanupMeasurements();
          cleanupExcavation();
          activeExcavationPositionsRef.current = null;
        }
      } else if (activeTool === '3d-tiles-clip') {
        if (clickedPositionsRef.current.length >= 3) {
          const positions = [...clickedPositionsRef.current];
          const cartographics = positions.map(p => Cesium.Cartographic.fromCartesian(p));
          const rawPositions = cartographics.map(c => ({
            lat: Cesium.Math.toDegrees(c.latitude),
            lon: Cesium.Math.toDegrees(c.longitude),
            height: c.height
          }));

          // Deduplicate consecutive points
          const deduped: typeof rawPositions = [];
          rawPositions.forEach(pt => {
            if (deduped.length === 0) {
              deduped.push(pt);
            } else {
              const prev = deduped[deduped.length - 1];
              if (Math.hypot(pt.lon - prev.lon, pt.lat - prev.lat) > 1e-7) {
                deduped.push(pt);
              }
            }
          });

          // Remove closing duplicate point if first == last
          if (deduped.length > 3) {
            const first = deduped[0];
            const last = deduped[deduped.length - 1];
            if (Math.hypot(first.lon - last.lon, first.lat - last.lat) < 1e-7) {
              deduped.pop();
            }
          }

          if (deduped.length < 3) {
            onMeasureResultChange('Drawing cancelled. 3D tiles clipping polygon requires at least 3 distinct vertices.');
            cleanupMeasurements();
            return;
          }

          let minLon = Number.MAX_VALUE;
          let maxLon = -Number.MAX_VALUE;
          let minLat = Number.MAX_VALUE;
          let maxLat = -Number.MAX_VALUE;

          deduped.forEach(p => {
            if (p.lon < minLon) minLon = p.lon;
            if (p.lon > maxLon) maxLon = p.lon;
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
          });

          const clippingPolyCount = (importedLayers || []).filter(l => l.type === 'clipping_polygon').length;
          const newClippingId = 'clipping-poly-' + Date.now();
          const newClippingLayer = {
            id: newClippingId,
            name: `3D Tiles Clipping Polygon ${clippingPolyCount + 1}`,
            type: 'clipping_polygon',
            visible: true,
            opacity: 0.15,
            color: '#ef4444',
            positions: deduped,
            bounds: { minLon, maxLon, minLat, maxLat },
            inverse: false,
          };

          const updated = [...(importedLayers || []), newClippingLayer];
          if (onImportedLayersChange) {
            onImportedLayersChange(updated);
          }
          if (onActiveLayerIdChange) {
            onActiveLayerIdChange(newClippingId);
          }
          if (onClippingModeChange && clippingMode === 'none') {
            onClippingModeChange('inside');
          }

          onMeasureResultChange(`3D Tiles Clipping Polygon created and active! Added to Layers.`);
          cleanupMeasurements();
        } else {
          onMeasureResultChange('Drawing cancelled. 3D tiles clipping polygon requires at least 3 vertices.');
          cleanupMeasurements();
        }
      }

      tempMousePosRef.current = null;
      setFloatingMarker(null);
      handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      
      onActiveToolChange('none');
      viewer.scene.requestRender();
    };

    // Right Click listener: finalize drawing
    handler.setInputAction(() => {
      if (clickedPositionsRef.current.length === 0) return;
      finalizeDrawing();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // Left Double-Click listener: alternative way to finalize polyline/polygon drawing
    handler.setInputAction(() => {
      if (clickedPositionsRef.current.length > 0) {
        // Remove duplicate last position if added by double click
        if (clickedPositionsRef.current.length > 1) {
          clickedPositionsRef.current.pop();
        }
        finalizeDrawing();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return () => {
      handler.destroy();
    };
  }, [activeTool, excavationDepth]);

  // Handle explicit clear measurements trigger
  useEffect(() => {
    if (clearMeasurementTrigger > 0) {
      cleanupMeasurements();
    }
  }, [clearMeasurementTrigger]);

  // Handle cleaning up boundary entities when boundaryBounds is cleared
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    if (!boundaryBounds && !boundaryCenter) {
      const existing = viewer.entities.getById('analysis-boundary');
      if (existing) {
        viewer.entities.remove(existing);
      }
      const existingOutline = viewer.entities.getById('analysis-boundary-outline');
      if (existingOutline) {
        viewer.entities.remove(existingOutline);
      }
      viewer.scene.requestRender();
    }
  }, [boundaryBounds, boundaryCenter, isInitializing]);

  // Render a thin, translucent white bounding line outline on the terrain surface when boundaryBounds changes (auto-bound / non-manual mode)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // Remove any existing outline and boundary entities first
    const existingOutline = viewer.entities.getById('analysis-boundary-outline');
    if (existingOutline) {
      viewer.entities.remove(existingOutline);
    }
    const existingBoundary = viewer.entities.getById('analysis-boundary');
    if (existingBoundary) {
      viewer.entities.remove(existingBoundary);
    }

    if (!boundaryBounds) return;

    // Only draw the rectangular outline if the active tool is not 'boundary' 
    // (since 'boundary' tool draws its own custom polygon vertices manually)
    if (activeTool === 'boundary' && boundaryShape !== 'circle') return;

    if (boundaryShape === 'circle' && boundaryCenter) {
      viewer.entities.add({
        id: 'analysis-boundary',
        position: Cesium.Cartesian3.fromRadians(boundaryCenter.longitude, boundaryCenter.latitude),
        ellipse: {
          semiMajorAxis: boundaryRadius,
          semiMinorAxis: boundaryRadius,
          material: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.12),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#3b82f6'),
          outlineWidth: 3,
          classificationType: Cesium.ClassificationType.TERRAIN
        }
      });
      viewer.scene.requestRender();
      return;
    }

    const minLon = boundaryBounds.minLon;
    const maxLon = boundaryBounds.maxLon;
    const minLat = boundaryBounds.minLat;
    const maxLat = boundaryBounds.maxLat;

    const corners = [
      Cesium.Cartesian3.fromRadians(minLon, minLat),
      Cesium.Cartesian3.fromRadians(maxLon, minLat),
      Cesium.Cartesian3.fromRadians(maxLon, maxLat),
      Cesium.Cartesian3.fromRadians(minLon, maxLat),
      Cesium.Cartesian3.fromRadians(minLon, minLat)
    ];

    viewer.entities.add({
      id: 'analysis-boundary-outline',
      polyline: {
        positions: corners,
        width: 2.0,
        material: Cesium.Color.WHITE.withAlpha(0.6),
        clampToGround: true
      }
    });

    viewer.entities.add({
      id: 'analysis-boundary',
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(corners.slice(0, 4)),
        material: Cesium.Color.WHITE.withAlpha(0.08),
        classificationType: Cesium.ClassificationType.TERRAIN
      }
    });

    viewer.scene.requestRender();
  }, [boundaryBounds, boundaryShape, boundaryCenter, boundaryRadius, activeTool, isInitializing]);

  // Handle Topographic Slope & Contour Shader overlays on Globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    try {
      if (terrainOverlay === 'contour') {
        // Create Elevation Contour lines
        viewer.scene.globe.material = new Cesium.Material({
          fabric: {
            uniforms: {
              u_color: Cesium.Color.fromCssColorString('#ef4444'),
              u_spacing: contourInterval,
              u_width: 2.0,
              u_minLon: boundaryBounds ? boundaryBounds.minLon : 0.0,
              u_maxLon: boundaryBounds ? boundaryBounds.maxLon : 0.0,
              u_minLat: boundaryBounds ? boundaryBounds.minLat : 0.0,
              u_maxLat: boundaryBounds ? boundaryBounds.maxLat : 0.0,
              u_boundaryShape: (boundaryBounds && boundaryShape === 'circle') ? 1.0 : 0.0,
              u_centerLon: boundaryCenter ? boundaryCenter.longitude : 0.0,
              u_centerLat: boundaryCenter ? boundaryCenter.latitude : 0.0,
              u_radiusRad: boundaryRadius / 6371000.0,
              u_hasMask: boundaryBounds ? 1.0 : 0.0
            },
            source: `
              czm_material czm_getMaterial(czm_materialInput materialInput) {
                czm_material material = czm_getDefaultMaterial(materialInput);
                
                if (u_hasMask > 0.5) {
                  vec4 worldPos = czm_inverseView * vec4(-materialInput.positionToEyeEC, 1.0);
                  float longitude = atan(worldPos.y, worldPos.x);
                  float latitude = atan(worldPos.z, length(worldPos.xy));
                  
                  if (u_boundaryShape > 0.5) {
                    float cosAng = sin(latitude) * sin(u_centerLat) + cos(latitude) * cos(u_centerLat) * cos(longitude - u_centerLon);
                    float angDist = acos(clamp(cosAng, -1.0, 1.0));
                    if (angDist > u_radiusRad) {
                      material.alpha = 0.0;
                      return material;
                    }
                  } else {
                    if (longitude < u_minLon || longitude > u_maxLon || latitude < u_minLat || latitude > u_maxLat) {
                      material.alpha = 0.0;
                      return material;
                    }
                  }
                }
                
                float elevation = materialInput.height;
                float f = fract(elevation / u_spacing);
                float df = max(fwidth(elevation / u_spacing), 0.0001);
                float dist = min(f, 1.0 - f);
                float edge = u_width * df * 0.5;
                float alpha = 1.0 - smoothstep(max(edge - df * 0.5, 0.0), edge + df * 0.5, dist);
                
                material.diffuse = u_color.rgb;
                material.alpha = alpha * u_color.a;
                
                return material;
              }
            `
          }
        });
        viewer.scene.globe.enableLighting = true;
        viewer.scene.requestRender();
      } else {
        // Reset material - cleanly strip out the material memory parameters by returning to default state
        viewer.scene.globe.material = null as any;
        // Restore default lighting based on shadows preference
        viewer.scene.globe.enableLighting = sunShadowsEnabled || rtxUltraEnabled || realisticLighting;
        viewer.scene.requestRender();
      }
    } catch (err) {
      console.error('Failed to apply topographic diagnostic shader:', err);
    }
  }, [terrainOverlay, isInitializing, sunShadowsEnabled, rtxUltraEnabled, contourInterval, boundaryBounds, boundaryShape, boundaryCenter, boundaryRadius, realisticLighting]);

  // Handle Sunlight Heatmap Cumulative Exposure (Two-way Pipeline & WebGL Shader)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    let active = true;

    const cleanupHeatmap = () => {
      // 1. Remove ground canvas primitive, entity, or imagery layer
      if (sunlightHeatmapPrimitiveRef.current && viewer && !viewer.isDestroyed()) {
        try {
          // If it is an imagery layer, remove it from imageryLayers
          const removed = viewer.imageryLayers.remove(sunlightHeatmapPrimitiveRef.current as any);
          if (!removed) {
            if (sunlightHeatmapPrimitiveRef.current instanceof Cesium.Entity) {
              viewer.entities.remove(sunlightHeatmapPrimitiveRef.current);
            } else {
              viewer.scene.primitives.remove(sunlightHeatmapPrimitiveRef.current);
            }
          }
        } catch (e) {
          try {
            viewer.imageryLayers.remove(sunlightHeatmapPrimitiveRef.current as any);
          } catch (_) {}
          try {
            viewer.entities.remove(sunlightHeatmapPrimitiveRef.current as any);
          } catch (_) {}
          try {
            viewer.scene.primitives.remove(sunlightHeatmapPrimitiveRef.current as any);
          } catch (_) {}
        }
      }
      sunlightHeatmapPrimitiveRef.current = null;

      // 2. Reset 3D tileset styles
      if (leftBuildingsTilesetRef.current) leftBuildingsTilesetRef.current.style = undefined;
      if (rightBuildingsTilesetRef.current) rightBuildingsTilesetRef.current.style = undefined;
      if (leftGoogleTilesetRef.current) leftGoogleTilesetRef.current.style = undefined;
      if (rightGoogleTilesetRef.current) rightGoogleTilesetRef.current.style = undefined;
      if (customTilesetRef.current) customTilesetRef.current.style = undefined;
    };

    cleanupHeatmap();

    if (terrainOverlay !== 'sunlight-heatmap') {
      viewer.scene.requestRender();
      return;
    }

    const runHeatmapPipeline = () => {
      if (!active) return;
      cleanupHeatmap();

      let activeBounds = boundaryBounds;
      let isFallback = false;

      if (!activeBounds) {
        // Fallback: Compute a boundary around the current camera view
        try {
          const cameraRect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
          if (cameraRect) {
            const centerCarto = Cesium.Rectangle.center(cameraRect);
            // Limit fallback rectangle size to ~1km x 1km to keep CPU/GPU calculations lightweight
            const halfLat = 0.0045; 
            const halfLon = 0.0045 / Math.max(0.1, Math.cos(centerCarto.latitude));

            activeBounds = {
              minLon: centerCarto.longitude - halfLon,
              maxLon: centerCarto.longitude + halfLon,
              minLat: centerCarto.latitude - halfLat,
              maxLat: centerCarto.latitude + halfLat
            };
            isFallback = true;
          }
        } catch (_) {}

        // Fallback to Zurich default center coordinates if camera rectangle computation is unavailable
        if (!activeBounds) {
          activeBounds = {
            minLon: 8.535 * Math.PI / 180,
            maxLon: 8.545 * Math.PI / 180,
            minLat: 47.370 * Math.PI / 180,
            maxLat: 47.380 * Math.PI / 180
          };
          isFallback = true;
        }
      }

      // ==========================================
      // SOLAR HEATMAP: ATTRIBUTE-BASED PIPELINE (Tileset Styling & Canvas Overlay)
      // ==========================================
      const scale = radiationGradientScale;

      // Intercept and style 3D Tilesets dynamically based on property attributes
      const applyAttributeStyle = (tileset: Cesium.Cesium3DTileset | null, isGoogle: boolean = false) => {
        if (!tileset) return;
        if (isGoogle || !isFallback) {
          // Keep Google photorealistic tilesets untouched and fully opaque with their beautiful textures.
          // In localized mode, also keep other tilesets untouched so they do not light up outside the boundary.
          tileset.style = undefined;
          return;
        }

        tileset.style = new Cesium.Cesium3DTileStyle({
          color: {
            conditions: [
              // Use ANNUAL_KWH_SQM if present in metadata (fully opaque)
              ['${ANNUAL_KWH_SQM} !== undefined', 
               "color('rgba(' + (Number(${ANNUAL_KWH_SQM}) * " + scale + " > 1500.0 ? '239, 68, 68' : Number(${ANNUAL_KWH_SQM}) * " + scale + " > 1000.0 ? '249, 115, 22' : Number(${ANNUAL_KWH_SQM}) * " + scale + " > 600.0 ? '234, 179, 8' : '20, 110, 120') + ', 1.0')"],
              ['${annual_kwh_sqm} !== undefined', 
               "color('rgba(' + (Number(${annual_kwh_sqm}) * " + scale + " > 1500.0 ? '239, 68, 68' : Number(${annual_kwh_sqm}) * " + scale + " > 1000.0 ? '249, 115, 22' : Number(${annual_kwh_sqm}) * " + scale + " > 600.0 ? '234, 179, 8' : '20, 110, 120') + ', 1.0')"],
              // Fallback to building heights as proxy (fully opaque)
              ['${height} !== undefined', 
               "color('rgba(' + (Number(${height}) * " + scale + " > 80.0 ? '239, 68, 68' : Number(${height}) * " + scale + " > 40.0 ? '249, 115, 22' : Number(${height}) * " + scale + " > 20.0 ? '234, 179, 8' : Number(${height}) * " + scale + " > 10.0 ? '20, 110, 120' : '71, 85, 105') + ', 1.0')"],
              ['true', 'color("#94a3b8")']
            ]
          }
        });
      };

      applyAttributeStyle(leftBuildingsTilesetRef.current, false);
      applyAttributeStyle(rightBuildingsTilesetRef.current, false);
      applyAttributeStyle(leftGoogleTilesetRef.current, true);
      applyAttributeStyle(rightGoogleTilesetRef.current, true);
      applyAttributeStyle(customTilesetRef.current, false);

      try {
        const bounds = {
          west: Math.max(-180, Math.min(180, activeBounds.minLon * 180 / Math.PI)),
          east: Math.max(-180, Math.min(180, activeBounds.maxLon * 180 / Math.PI)),
          south: Math.max(-90, Math.min(90, activeBounds.minLat * 180 / Math.PI)),
          north: Math.max(-90, Math.min(90, activeBounds.maxLat * 180 / Math.PI))
        };

        if (bounds.south >= bounds.north) {
          const temp = bounds.south;
          bounds.south = bounds.north - 0.001;
          bounds.north = temp + 0.001;
        }
        if (bounds.west >= bounds.east) {
          const temp = bounds.west;
          bounds.west = bounds.east - 0.001;
          bounds.east = temp + 0.001;
        }

        const gridSize = 30;
        const latStep = (bounds.north - bounds.south) / (gridSize - 1);
        const lngStep = (bounds.east - bounds.west) / (gridSize - 1);
        const grid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

        // Day of year declination calculations
        const d = new Date(selectedDate || '2026-07-04');
        const start = new Date(d.getFullYear(), 0, 0);
        const diff = d.getTime() - start.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        const N = Math.floor(diff / oneDay) || 185;
        const declinationDeg = 23.45 * Math.sin((360 / 365) * (284 + N) * Math.PI / 180);
        const declinationRad = declinationDeg * Math.PI / 180;

        const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
        let maxExp = 0.001;
        let minExp = Infinity;

        for (let i = 0; i < gridSize; i++) {
          const lng = bounds.west + i * lngStep;
          for (let j = 0; j < gridSize; j++) {
            const lat = bounds.south + j * latStep;
            const latRad = lat * Math.PI / 180;

            const carto = Cesium.Cartographic.fromDegrees(lng, lat);
            
            let h0 = Math.sin(lng * 600) * Math.cos(lat * 600) * 120 + 150;
            let he = Math.sin((lng + 0.0002) * 600) * Math.cos(lat * 600) * 120 + 150;
            let hn = Math.sin(lng * 600) * Math.cos((lat + 0.0002) * 600) * 120 + 150;

            if (viewer.scene && viewer.scene.globe) {
              try {
                const gh0 = viewer.scene.globe.getHeight(carto);
                if (gh0 !== undefined && gh0 !== null && !isNaN(gh0)) h0 = gh0;
              } catch (_) {}
              try {
                const cartoE = Cesium.Cartographic.fromDegrees(lng + 0.0002, lat);
                const ghe = viewer.scene.globe.getHeight(cartoE);
                if (ghe !== undefined && ghe !== null && !isNaN(ghe)) he = ghe;
              } catch (_) {}
              try {
                const cartoN = Cesium.Cartographic.fromDegrees(lng, lat + 0.0002);
                const ghn = viewer.scene.globe.getHeight(cartoN);
                if (ghn !== undefined && ghn !== null && !isNaN(ghn)) hn = ghn;
              } catch (_) {}
            }

            const dx = (0.0002 * 111000 * Math.cos(latRad)) || 0.000001;
            const dy = 0.0002 * 111000;
            const dz_dx = (he - h0) / dx;
            const dz_dy = (hn - h0) / dy;

            const slope = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy)) || 0;
            const aspect = Math.atan2(dz_dx, dz_dy) || 0;

            let exposure = 0;
            for (const hr of hours) {
              const H_deg = (hr - 12) * 15;
              const H_rad = H_deg * Math.PI / 180;

              const sin_a = Math.sin(latRad) * Math.sin(declinationRad) +
                            Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(H_rad);
              const a_rad = Math.asin(Math.max(-1, Math.min(1, sin_a)));

              if (a_rad > 0) {
                const denom = Math.cos(latRad) * Math.cos(a_rad);
                const cos_A = denom !== 0 ? (Math.sin(declinationRad) - Math.sin(latRad) * sin_a) / denom : 0;
                const sin_A = Math.cos(a_rad) !== 0 ? -Math.sin(H_rad) * Math.cos(declinationRad) / Math.cos(a_rad) : 0;

                let A_rad = Math.acos(Math.max(-1, Math.min(1, cos_A))) || 0;
                if (sin_A < 0) {
                  A_rad = 2 * Math.PI - A_rad;
                }

                const cos_theta = Math.sin(a_rad) * Math.cos(slope) +
                                  Math.cos(a_rad) * Math.sin(slope) * Math.cos(A_rad - aspect);

                if (cos_theta > 0 && !isNaN(cos_theta)) {
                  exposure += cos_theta * Math.sin(a_rad);
                }
              }
            }

            if (isNaN(exposure) || !isFinite(exposure)) {
              exposure = 0;
            }
            grid[i][j] = exposure;
            if (exposure > maxExp) maxExp = exposure;
            if (exposure < minExp) minExp = exposure;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          const normRange = (maxExp - minExp) || 1;
          for (let x = 0; x < 128; x++) {
            const fx = x / 127;
            for (let y = 0; y < 128; y++) {
              const fy = (127 - y) / 127;

              const gx = fx * (gridSize - 1);
              const gy = fy * (gridSize - 1);
              const x0 = Math.floor(gx);
              const x1 = Math.min(gridSize - 1, x0 + 1);
              const y0 = Math.floor(gy);
              const y1 = Math.min(gridSize - 1, y0 + 1);
              const tx = gx - x0;
              const ty = gy - y0;

              const v00 = grid[x0][y0];
              const v10 = grid[x1][y0];
              const v01 = grid[x0][y1];
              const v11 = grid[x1][y1];

              const val = (1 - tx) * (1 - ty) * v00 +
                          tx * (1 - ty) * v10 +
                          (1 - tx) * ty * v01 +
                          tx * ty * v11;

              const norm = Math.max(0, Math.min(1, ((val - minExp) / normRange) * scale)) || 0;

              let r = 0, g = 0, b = 0, a = 0.55;
              if (norm < 0.2) {
                const t = norm / 0.2;
                r = Math.round(15 + t * (20 - 15));
                g = Math.round(23 + t * (110 - 23));
                b = Math.round(42 + t * (120 - 42));
                a = 0.4 + t * 0.15;
              } else if (norm < 0.45) {
                const t = (norm - 0.2) / 0.25;
                r = Math.round(20 + t * (13 - 20));
                g = Math.round(110 + t * (148 - 110));
                b = Math.round(120 + t * (136 - 120));
                a = 0.55 + t * 0.1;
              } else if (norm < 0.75) {
                const t = (norm - 0.45) / 0.3;
                r = Math.round(13 + t * (234 - 13));
                g = Math.round(148 + t * (179 - 148));
                b = Math.round(136 + t * (8 - 136));
                a = 0.65 + t * 0.1;
              } else {
                const t = (norm - 0.75) / 0.25;
                r = Math.round(234 + t * (239 - 234));
                g = Math.round(179 + t * (68 - 179));
                b = Math.round(8 + t * (68 - 8));
                a = 0.75 + t * 0.15;
              }

              if (!isFallback && boundaryShape === 'circle') {
                const dx = x - 63.5;
                const dy = y - 63.5;
                const dist2 = dx * dx + dy * dy;
                const maxRadius2 = 63.5 * 63.5;
                if (dist2 > maxRadius2) {
                  a = 0.0;
                } else if (dist2 > 61.5 * 61.5) {
                  const dist = Math.sqrt(dist2);
                  const feather = (63.5 - dist) / 2.0;
                  a *= feather;
                }
              }

              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        const rect = Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north);
        
        const heatmapEntity = viewer.entities.add({
          id: 'sunlight-heatmap-overlay',
          rectangle: {
            coordinates: rect,
            material: new Cesium.ImageMaterialProperty({
              image: canvas,
              transparent: true
            }),
            classificationType: Cesium.ClassificationType.TERRAIN
          }
        });

        sunlightHeatmapPrimitiveRef.current = heatmapEntity;
        viewer.scene.requestRender();

        if (isFallback) {
          onMeasureResultChange('Sunlight Heatmap calculated for the current viewport center. Draw a Spatial Boundary to mask a specific area.');
        } else {
          onMeasureResultChange('Detailed ground attributes and solar radiation heatmap calculated inside boundary.');
        }

      } catch (err) {
        console.error('Failed to apply ground attribute heatmap:', err);
      }
    };

    runHeatmapPipeline();

    // Listen to camera movements to update viewport center fallback heatmap
    const onCameraMoveEnd = () => {
      if (!boundaryBounds && active) {
        runHeatmapPipeline();
      }
    };

    if (!boundaryBounds) {
      viewer.camera.moveEnd.addEventListener(onCameraMoveEnd);
    }

    return () => {
      active = false;
      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.camera.moveEnd.removeEventListener(onCameraMoveEnd);
        } catch (_) {}
      }
      cleanupHeatmap();
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
      }
    };
  }, [
    terrainOverlay,
    radiationGradientScale,
    selectedDate,
    selectedPreset,
    polygonData,
    boundaryBounds,
    isInitializing,
    activeAnalysisCenter,
    boundaryShape,
    boundaryCenter,
    boundaryRadius,
    tilesetLoadedCount
  ]);

  // Handle Layer Management (Historical Sites & Flight Paths overlays)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const isHistoricalEnabled = layers.find(l => l.id === 'historical-sites')?.enabled;
    const isFlightPathsEnabled = layers.find(l => l.id === 'flight-paths')?.enabled;

    // Toggle Landmarks/Historical Sites
    if (isHistoricalEnabled) {
      if (landmarksEntitiesRef.current.length === 0) {
        LOCATION_PRESETS.forEach(loc => {
          const entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(loc.longitude, loc.latitude, 200),
            billboard: {
              image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scale: 1.5,
              disableDepthTestDistance: Number.POSITIVE_INFINITY, // rendering on top of terrain
            },
            label: {
              text: loc.name,
              font: '12px "JetBrains Mono", monospace',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, 10),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
          });
          landmarksEntitiesRef.current.push(entity);
        });
      }
    } else {
      landmarksEntitiesRef.current.forEach(entity => {
        viewer.entities.remove(entity);
      });
      landmarksEntitiesRef.current = [];
    }

    // Toggle Flight Paths
    if (isFlightPathsEnabled) {
      if (flightPathsEntitiesRef.current.length === 0) {
        const createFlightArc = (startLon: number, startLat: number, endLon: number, endLat: number, labelName: string) => {
          const start = Cesium.Cartesian3.fromDegrees(startLon, startLat);
          const end = Cesium.Cartesian3.fromDegrees(endLon, endLat);
          const points: Cesium.Cartesian3[] = [];
          const segments = 50;

          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const interpolated = Cesium.Cartesian3.lerp(start, end, t, new Cesium.Cartesian3());
            const cartographic = Cesium.Cartographic.fromCartesian(interpolated);
            
            // Calculate a parabolic curve altitude
            const height = Math.sin(Math.PI * t) * 600000; // max peak 600km high
            points.push(Cesium.Cartesian3.fromDegrees(
              Cesium.Math.toDegrees(cartographic.longitude),
              Cesium.Math.toDegrees(cartographic.latitude),
              height
            ));
          }

          return viewer.entities.add({
            name: `${labelName} Airway`,
            polyline: {
              positions: points,
              width: 3,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.25,
                taperPower: 0.5,
                color: Cesium.Color.fromCssColorString('#60a5fa')
              })
            }
          });
        };

        // Create sample global pathways
        const paths = [
          { slon: -74.0060, slat: 40.7128, elon: 2.2945, elat: 48.8584, name: 'NYC - Paris' },
          { slon: 2.2945, slat: 48.8584, elon: 139.6917, elat: 35.6895, name: 'Paris - Tokyo' },
          { slon: 139.6917, slat: 35.6895, elon: 151.2153, elat: -33.8568, name: 'Tokyo - Sydney' },
          { slon: 151.2153, slat: -33.8568, elon: -74.0060, elat: 40.7128, name: 'Sydney - NYC' }
        ];

        paths.forEach(p => {
          const ent = createFlightArc(p.slon, p.slat, p.elon, p.elat, p.name);
          flightPathsEntitiesRef.current.push(ent);
        });
      }
    } else {
      flightPathsEntitiesRef.current.forEach(entity => {
        viewer.entities.remove(entity);
      });
      flightPathsEntitiesRef.current = [];
    }

    viewer.scene.requestRender();
  }, [layers, isInitializing]);

  // Synchronize dynamic landmarks fetched from the Overpass API & set up clustering
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // Clean up any existing overpass data source
    if (overpassDataSourceRef.current) {
      viewer.dataSources.remove(overpassDataSourceRef.current);
      overpassDataSourceRef.current = null;
    }

    if (!currentLandmarks || currentLandmarks.length === 0) {
      return;
    }

    // Create a new CustomDataSource
    const overpassDataSource = new Cesium.CustomDataSource('overpass-landmarks');
    
    // Enable and configure clustering
    overpassDataSource.clustering.enabled = true;
    overpassDataSource.clustering.pixelRange = 40;
    overpassDataSource.clustering.minimumClusterSize = 2;

    // Custom event handler for styling clusters dynamically
    overpassDataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
      cluster.label.show = true;
      cluster.label.text = clusteredEntities.length.toString();
      cluster.label.font = 'bold 12px "JetBrains Mono", monospace';
      cluster.label.fillColor = Cesium.Color.WHITE;
      cluster.label.outlineColor = Cesium.Color.BLACK;
      cluster.label.outlineWidth = 3;
      cluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
      cluster.label.verticalOrigin = Cesium.VerticalOrigin.CENTER;
      cluster.label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;

      cluster.billboard.show = true;
      cluster.billboard.image = createClusterIcon(clusteredEntities.length);
      cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
      cluster.billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
      cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    });

    // Populate with landmarks
    currentLandmarks.forEach((poi: any) => {
      const type = poi.tags?.historic || poi.tags?.tourism || 'monument';
      overpassDataSource.entities.add({
        id: `overpass-poi-${poi.id}`,
        name: poi.name,
        position: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 10),
        billboard: {
          image: createLandmarkIcon(type),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 1.0,
          disableDepthTestDistance: Number.POSITIVE_INFINITY, // always render on top of 3D tiles/terrain
        },
        label: {
          text: poi.name,
          font: '11px "Inter", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 8),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }
      });
    });

    viewer.dataSources.add(overpassDataSource);
    overpassDataSourceRef.current = overpassDataSource;

    viewer.scene.requestRender();

    return () => {
      if (viewer && !viewer.isDestroyed() && overpassDataSource) {
        viewer.dataSources.remove(overpassDataSource);
      }
    };
  }, [currentLandmarks, isInitializing]);

  // Multi-Layer 3D Asset Manager state & map ref
  const modelEntitiesMapRef = useRef<Map<string, Cesium.Entity>>(new Map());

  // Synchronize dynamic imported layers (multiple GLTF/GLB files) to Cesium
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // Remove any entities that are no longer in the importedLayers array
    const currentLayerIds = new Set((importedLayers || []).filter(l => l.type !== 'tileset' && l.type !== 'clipping_polygon').map(l => l.id));
    for (const [id, entity] of modelEntitiesMapRef.current.entries()) {
      if (!currentLayerIds.has(id)) {
        if (!viewer.isDestroyed()) {
          viewer.entities.remove(entity);
        }
        modelEntitiesMapRef.current.delete(id);

        const floorEntities = massingFloorEntitiesMapRef.current.get(id);
        if (floorEntities) {
          floorEntities.forEach(e => {
            if (!viewer.isDestroyed()) viewer.entities.remove(e);
          });
          massingFloorEntitiesMapRef.current.delete(id);
        }
      }
    }

    // Process/add/update current layers
    (importedLayers || []).filter(l => l.type !== 'tileset' && l.type !== 'clipping_polygon').forEach((layer) => {
      let entity = modelEntitiesMapRef.current.get(layer.id);
      
      if (layer.type === 'area_polygon') {
        try {
          const minHeight = layer.height || 0;
          const positionsCartesian2D = (layer.positions || []).map((p: any) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0));
          const centerLat = layer.latitude || ((layer.positions || []).reduce((sum: number, p: any) => sum + p.lat, 0) / (layer.positions || []).length);
          const centerLon = layer.longitude || ((layer.positions || []).reduce((sum: number, p: any) => sum + p.lon, 0) / (layer.positions || []).length);
          const labelPosition = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, minHeight + 5.0);

          const isAreaSelected = selectedLayerIdsRef.current.includes(layer.id) || (layer.id === activeLayerId);
          const colorHex = layer.color || '#10b981';
          const layerOpacity = layer.opacity !== undefined ? layer.opacity : 0.35;
          const outlineHex = isAreaSelected ? '#f59e0b' : colorHex;
          const outlineWidth = isAreaSelected ? 4.5 : 2.5;

          if (!entity) {
            const outlinePositions = [...positionsCartesian2D, positionsCartesian2D[0]];
            
            const entityConfig: any = {
              id: layer.id,
              name: layer.name,
              show: layer.visible,
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positionsCartesian2D),
                material: new Cesium.ColorMaterialProperty(
                  Cesium.Color.fromCssColorString(colorHex).withAlpha(layerOpacity)
                ),
                classificationType: Cesium.ClassificationType.BOTH,
                arcType: Cesium.ArcType.GEODESIC
              },
              polyline: {
                positions: outlinePositions,
                width: outlineWidth,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(outlineHex)),
                clampToGround: true
              },
              position: labelPosition,
              label: {
                text: layer.labelText || `Area: ${formatArea(layer.area || 0)}`,
                font: 'bold 14px monospace',
                fillColor: Cesium.Color.fromCssColorString('#10b981'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            };

            entity = viewer.entities.add(entityConfig);
            modelEntitiesMapRef.current.set(layer.id, entity);
            layer.cesiumEntity = entity;
          } else {
            entity.show = layer.visible as any;
            if (entity.polygon) {
              entity.polygon.hierarchy = new Cesium.PolygonHierarchy(positionsCartesian2D) as any;
              entity.polygon.material = new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString(colorHex).withAlpha(layerOpacity)
              ) as any;
            }
            if (entity.polyline) {
              entity.polyline.positions = [...positionsCartesian2D, positionsCartesian2D[0]] as any;
              entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(outlineHex)) as any;
              entity.polyline.width = outlineWidth as any;
            }
            if (entity.position) {
              entity.position = labelPosition as any;
            }
          }
        } catch (err) {
          console.error('Failed to update area polygon layer entity:', err);
        }
        return;
      }

      if (layer.type === 'parametric_massing') {
        try {
          const minHeight = layer.height || 0;
          const positionsCartesian = (layer.positions || []).map((p: any) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, minHeight));
          const centerLat = (layer.positions || []).reduce((sum: number, p: any) => sum + p.lat, 0) / (layer.positions || []).length;
          const centerLon = (layer.positions || []).reduce((sum: number, p: any) => sum + p.lon, 0) / (layer.positions || []).length;
          const floors = layer.floors || 5;
          const storeyHeight = layer.floorHeight || massingFloorHeight || 3.5;
          const height = minHeight + floors * storeyHeight;
          const labelPosition = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height);

          const getZoningNameFromColor = (color: string): string => {
            const hex = color.toLowerCase();
            if (hex === '#ffffff' || hex === '#fff') return 'Conceptual';
            if (hex === '#f59e0b') return 'Residential';
            if (hex === '#ef4444') return 'Commercial';
            if (hex === '#8b5cf6') return 'Mixed-Use';
            if (hex === '#6b7280') return 'Industrial';
            if (hex === '#3b82f6') return 'Institutional';
            if (hex === '#10b981') return 'Open Space';
            return 'Custom';
          };

          const zoneName = getZoningNameFromColor(layer.color || '#ffffff');
          const area = layer.area || 0;
          const gfa = area * floors;
          const labelText = `Zone: ${zoneName}\nGFA: ${gfa.toLocaleString(undefined, {maximumFractionDigits: 0})} sqm\nHeight: ${(floors * storeyHeight).toFixed(1)}m (${floors} Fl)`;

          const layerOpacity = layer.opacity !== undefined ? layer.opacity : massingOpacity;

          const isMassingSelected = selectedLayerIdsRef.current.includes(layer.id) || (layer.id === activeLayerId);
          const outlineHex = isMassingSelected ? '#f59e0b' : (layer.color || '#ffffff');
          const outlineAlpha = isMassingSelected ? 1.0 : Math.min(1.0, layerOpacity + 0.2);

          if (!entity) {
            const entityConfig: any = {
              id: layer.id,
              name: layer.name,
              show: layer.visible,
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positionsCartesian),
                material: new Cesium.ColorMaterialProperty(
                  Cesium.Color.fromCssColorString(layer.color || '#ffffff').withAlpha(layerOpacity)
                ),
                height: minHeight,
                extrudedHeight: height,
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString(outlineHex).withAlpha(outlineAlpha),
                outlineWidth: isMassingSelected ? 4.0 : 2.0,
                shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED
              }
            };

            if (showMassingLabels) {
              entityConfig.position = labelPosition;
              entityConfig.label = {
                text: labelText,
                font: 'bold 11px "Inter", sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -15),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              };
            }

            entity = viewer.entities.add(entityConfig);
            modelEntitiesMapRef.current.set(layer.id, entity);
            layer.cesiumEntity = entity;
          } else {
            entity.show = layer.visible as any;
            if (entity.polygon) {
              entity.polygon.material = new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString(layer.color || '#ffffff').withAlpha(layerOpacity)
              ) as any;
              entity.polygon.outlineColor = Cesium.Color.fromCssColorString(outlineHex).withAlpha(outlineAlpha) as any;
              entity.polygon.extrudedHeight = height as any;
              entity.polygon.shadows = ((sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED) as any;
            }
            if (showMassingLabels) {
              entity.position = labelPosition as any;
              entity.label = {
                text: labelText,
                font: 'bold 11px "Inter", sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -15),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              } as any;
            } else {
              entity.label = undefined;
            }
            if (!layer.cesiumEntity) {
              layer.cesiumEntity = entity;
            }
          }

          // Sync Storey / Level Outline Polylines for Layer
          const prevFloorEntities = massingFloorEntitiesMapRef.current.get(layer.id);
          if (prevFloorEntities) {
            prevFloorEntities.forEach(e => {
              if (!viewer.isDestroyed()) viewer.entities.remove(e);
            });
            massingFloorEntitiesMapRef.current.delete(layer.id);
          }

          if (layer.visible && layer.positions && layer.positions.length >= 3) {
            const newFloorEntities: Cesium.Entity[] = [];
            const tagStep = floors <= 12 ? 1 : floors <= 30 ? 5 : 10;
            const posCartographics = (layer.positions as any[]).map(p =>
              Cesium.Cartographic.fromDegrees(p.lon, p.lat, p.height || minHeight)
            );

            for (let f = 0; f <= floors; f++) {
              const levelElevation = minHeight + f * storeyHeight;
              const levelPositions = posCartographics.map(c => {
                const dLat = c.latitude - Cesium.Math.toRadians(centerLat);
                const dLon = c.longitude - Cesium.Math.toRadians(centerLon);
                const offLat = c.latitude + dLat * 0.001;
                const offLon = c.longitude + dLon * 0.001;
                return Cesium.Cartesian3.fromRadians(offLon, offLat, levelElevation);
              });
              levelPositions.push(levelPositions[0]);

              const isRoof = (f === floors);
              const isGround = (f === 0);

              const currentLevelColor = isMassingSelected 
                ? (isRoof ? '#f59e0b' : '#38bdf8') 
                : (layer.levelColor || massingLevelColor || '#808080');
              const floorPoly = viewer.entities.add({
                id: `${layer.id}-floor-${f}`,
                polyline: {
                  positions: levelPositions,
                  width: isMassingSelected ? (isRoof || isGround ? 3.5 : 2.5) : (isRoof || isGround ? 2.5 : 2.0),
                  material: new Cesium.ColorMaterialProperty(
                    Cesium.Color.fromCssColorString(currentLevelColor).withAlpha(isRoof ? 0.95 : 0.8)
                  ),
                  clampToGround: false
                }
              });
              newFloorEntities.push(floorPoly);

              if (showMassingLabels && (f === 1 || f === floors || (f % tagStep === 0 && f > 0))) {
                const tagEntity = viewer.entities.add({
                  id: `${layer.id}-floor-tag-${f}`,
                  position: levelPositions[0],
                  label: {
                    text: f === floors ? `FL ${f} (Roof)` : `FL ${f}`,
                    font: 'bold 9px "Inter", sans-serif',
                    fillColor: Cesium.Color.fromCssColorString('#ffffff'),
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2.5,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(12, 0),
                    verticalOrigin: Cesium.VerticalOrigin.CENTER,
                    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                  }
                });
                newFloorEntities.push(tagEntity);
              }
            }
            massingFloorEntitiesMapRef.current.set(layer.id, newFloorEntities);
          }
        } catch (err) {
          console.error('Failed to update parametric massing layer entity:', err);
        }
        return;
      }

      const isTier2 = layer.type === 'tier2' || layer.isTier2;

      // If the geometry form has changed for a Tier 2 layer, delete and force recreation
      if (entity && isTier2) {
        const hasBox = !!entity.box;
        const hasCylinder = !!entity.cylinder;
        const expectedForm = layer.tier2Form || 'box';
        const needsRecreate = (expectedForm === 'box' && !hasBox) || 
                              ((expectedForm === 'cylinder' || expectedForm === 'pyramid') && !hasCylinder);
        if (needsRecreate) {
          if (!viewer.isDestroyed()) {
            viewer.entities.remove(entity);
          }
          modelEntitiesMapRef.current.delete(layer.id);
          entity = undefined;
        }
      }

      // Base height offset so procedural base sits perfectly on ground if not clamped
      const verticalOffset = (!layer.clampToTerrain && isTier2) ? (layer.tier2Height ?? 50.0) / 2.0 : 0.0;
      const position = Cesium.Cartesian3.fromDegrees(layer.longitude, layer.latitude, layer.height + verticalOffset);

      const baseHeadingOffset = layer.applySketchUpProfile ? Cesium.Math.toRadians(90.0) : 0.0;
      const headingOffset = Cesium.Math.toRadians(layer.heading) + baseHeadingOffset;
      const hpr = new Cesium.HeadingPitchRoll(
        headingOffset,
        Cesium.Math.toRadians(layer.pitch),
        Cesium.Math.toRadians(layer.roll)
      );
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

      // Define procedural facade material
      let material: any;
      if (isTier2) {
        const glassOpacity = layer.tier2GlassOpacity ?? 0.7;
        const surfaceColorHex = layer.surfaceColor || '#4A90E2';
        
        if (layer.tier2Facade === 'stripe') {
          material = new Cesium.StripeMaterialProperty({
            evenColor: Cesium.Color.fromCssColorString(surfaceColorHex).withAlpha(glassOpacity),
            oddColor: Cesium.Color.fromCssColorString(surfaceColorHex).withAlpha(glassOpacity * 0.35),
            repeat: layer.tier2Floors ?? 12,
            orientation: Cesium.StripeOrientation.HORIZONTAL
          });
        } else if (layer.tier2Facade === 'grid') {
          material = new Cesium.GridMaterialProperty({
            color: Cesium.Color.fromCssColorString(surfaceColorHex).withAlpha(0.95),
            cellAlpha: glassOpacity * 0.3,
            lineCount: new Cesium.Cartesian2(layer.tier2Floors ?? 12, Math.max(4, Math.round((layer.tier2Floors ?? 12) * 1.5))),
            lineThickness: new Cesium.Cartesian2(1.5, 1.5)
          });
        } else {
          material = new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(surfaceColorHex).withAlpha(glassOpacity));
        }
      }

      if (!entity) {
        // Create new entity for this layer
        const entityConfig: any = {
          id: layer.id,
          name: layer.name,
          position: position,
          orientation: orientation,
          show: layer.visible,
        };

        if (isTier2) {
          const form = layer.tier2Form || 'box';
          const silColor = layer.silhouetteColor || '#FFFFFF';
          const silSize = layer.silhouetteSize ?? 2.0;

          if (form === 'box') {
            entityConfig.box = {
              dimensions: new Cesium.ConstantProperty(new Cesium.Cartesian3(layer.tier2Width ?? 40.0, layer.tier2Length ?? 40.0, layer.tier2Height ?? 50.0)),
              material: material,
              outline: new Cesium.ConstantProperty(layer.vectorOutlines ?? true),
              outlineColor: new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(silColor)),
              outlineWidth: new Cesium.ConstantProperty(silSize),
              shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
              heightReference: layer.clampToTerrain 
                ? Cesium.HeightReference.CLAMP_TO_GROUND 
                : Cesium.HeightReference.NONE
            };
          } else {
            // Cylinder or pyramid (which is a cylinder with topRadius: 0.0)
            entityConfig.cylinder = {
              length: layer.tier2Height ?? 50.0,
              topRadius: form === 'pyramid' ? 0.0 : (layer.tier2Width ?? 40.0) / 2.0,
              bottomRadius: (layer.tier2Width ?? 40.0) / 2.0,
              material: material,
              outline: new Cesium.ConstantProperty(layer.vectorOutlines ?? true),
              outlineColor: new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(silColor)),
              outlineWidth: new Cesium.ConstantProperty(silSize),
              shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
              heightReference: layer.clampToTerrain 
                ? Cesium.HeightReference.CLAMP_TO_GROUND 
                : Cesium.HeightReference.NONE
            };
          }
        } else {
          const hasOutlines = Boolean(layer.vectorOutlines);
          const silColor = layer.silhouetteColor || '#FFFFFF';
          const silSize = hasOutlines ? (layer.silhouetteSize ?? 2.0) : 0.0;
          const isTintActive = Boolean(layer.enableTintOverlay) && (layer.blendAmount === undefined || layer.blendAmount > 0);

          const modelObj: any = {
            uri: layer.url,
            minimumPixelSize: 128,
            maximumScale: 20000,
            colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
            colorBlendAmount: 0.0,
            shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
            lightColor: Cesium.Color.WHITE,
            imageBasedLightingFactor: new Cesium.Cartesian2(0.8, 0.8),
            heightReference: layer.clampToTerrain 
              ? Cesium.HeightReference.CLAMP_TO_GROUND 
              : Cesium.HeightReference.NONE
          };

          if (hasOutlines && silSize > 0) {
            modelObj.silhouetteColor = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(silColor));
            modelObj.silhouetteSize = new Cesium.ConstantProperty(silSize);
          }

          if (isTintActive) {
            const surfColor = layer.surfaceColor || '#4A90E2';
            const modelAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
            const cesiumColor = Cesium.Color.fromCssColorString(surfColor).withAlpha(modelAlpha);

            let blendMode = Cesium.ColorBlendMode.MIX;
            if (layer.colorBlendMode === 'REPLACE') {
              blendMode = Cesium.ColorBlendMode.REPLACE;
            } else if (layer.colorBlendMode === 'HIGHLIGHT') {
              blendMode = Cesium.ColorBlendMode.HIGHLIGHT;
            } else {
              blendMode = Cesium.ColorBlendMode.MIX;
            }

            modelObj.color = new Cesium.ConstantProperty(cesiumColor);
            modelObj.colorBlendMode = new Cesium.ConstantProperty(blendMode);
            modelObj.colorBlendAmount = new Cesium.ConstantProperty(layer.blendAmount ?? 0.5);
          } else {
            // Pure native PBR materials without any color tint modulation
            modelObj.color = new Cesium.ConstantProperty(Cesium.Color.WHITE.withAlpha(layer.opacity !== undefined ? layer.opacity : 1.0));
            modelObj.colorBlendMode = new Cesium.ConstantProperty(Cesium.ColorBlendMode.HIGHLIGHT);
            modelObj.colorBlendAmount = new Cesium.ConstantProperty(0.0);
          }

          entityConfig.model = modelObj;
        }

        entity = viewer.entities.add(entityConfig);
        
        modelEntitiesMapRef.current.set(layer.id, entity);

        // Instantly attach entity reference back to state-owned layer
        layer.cesiumEntity = entity;
      } else {
        // Update existing entity properties
        entity.position = position as any;
        entity.orientation = orientation as any;
        entity.show = layer.visible as any;
        
        if (isTier2) {
          const silColor = layer.silhouetteColor || '#FFFFFF';
          const silSize = layer.silhouetteSize ?? 2.0;

          if (entity.box) {
            entity.box.dimensions = new Cesium.ConstantProperty(new Cesium.Cartesian3(layer.tier2Width ?? 40.0, layer.tier2Length ?? 40.0, layer.tier2Height ?? 50.0)) as any;
            entity.box.material = material as any;
            entity.box.outline = new Cesium.ConstantProperty(layer.vectorOutlines) as any;
            entity.box.outlineColor = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(silColor)) as any;
            entity.box.outlineWidth = new Cesium.ConstantProperty(silSize) as any;
            entity.box.heightReference = (layer.clampToTerrain 
              ? Cesium.HeightReference.CLAMP_TO_GROUND 
              : Cesium.HeightReference.NONE) as any;
          } else if (entity.cylinder) {
            entity.cylinder.length = (layer.tier2Height ?? 50.0) as any;
            entity.cylinder.topRadius = (layer.tier2Form === 'pyramid' ? 0.0 : (layer.tier2Width ?? 40.0) / 2.0) as any;
            entity.cylinder.bottomRadius = ((layer.tier2Width ?? 40.0) / 2.0) as any;
            entity.cylinder.material = material as any;
            entity.cylinder.outline = new Cesium.ConstantProperty(layer.vectorOutlines) as any;
            entity.cylinder.outlineColor = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(silColor)) as any;
            entity.cylinder.outlineWidth = new Cesium.ConstantProperty(silSize) as any;
            entity.cylinder.heightReference = (layer.clampToTerrain 
              ? Cesium.HeightReference.CLAMP_TO_GROUND 
              : Cesium.HeightReference.NONE) as any;
          }
        } else {
          if (entity.model) {
            const hasOutlines = Boolean(layer.vectorOutlines);
            const silColor = layer.silhouetteColor || '#FFFFFF';
            const silSize = hasOutlines ? (layer.silhouetteSize ?? 2.0) : 0.0;
            const isTintActive = Boolean(layer.enableTintOverlay) && (layer.blendAmount === undefined || layer.blendAmount > 0);

            entity.model.heightReference = (layer.clampToTerrain 
              ? Cesium.HeightReference.CLAMP_TO_GROUND 
              : Cesium.HeightReference.NONE) as any;

            if (hasOutlines && silSize > 0) {
              entity.model.silhouetteColor = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(silColor)) as any;
              entity.model.silhouetteSize = new Cesium.ConstantProperty(silSize) as any;
            } else {
              entity.model.silhouetteColor = undefined as any;
              entity.model.silhouetteSize = 0.0 as any;
            }

            entity.model.shadows = ((sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED) as any;
            entity.model.lightColor = new Cesium.ConstantProperty(Cesium.Color.WHITE) as any;
            entity.model.imageBasedLightingFactor = new Cesium.ConstantProperty(new Cesium.Cartesian2(0.8, 0.8)) as any;

            if (isTintActive) {
              const surfColor = layer.surfaceColor || '#4A90E2';
              const modelAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
              const cesiumColor = Cesium.Color.fromCssColorString(surfColor).withAlpha(modelAlpha);

              let blendMode = Cesium.ColorBlendMode.MIX;
              if (layer.colorBlendMode === 'REPLACE') {
                blendMode = Cesium.ColorBlendMode.REPLACE;
              } else if (layer.colorBlendMode === 'HIGHLIGHT') {
                blendMode = Cesium.ColorBlendMode.HIGHLIGHT;
              } else {
                blendMode = Cesium.ColorBlendMode.MIX;
              }

              entity.model.color = new Cesium.ConstantProperty(cesiumColor) as any;
              entity.model.colorBlendMode = new Cesium.ConstantProperty(blendMode) as any;
              entity.model.colorBlendAmount = new Cesium.ConstantProperty(layer.blendAmount ?? 0.5) as any;
            } else {
              // Completely clear tint and shader modulation so imported GLB renders pure native materials
              entity.model.color = new Cesium.ConstantProperty(Cesium.Color.WHITE.withAlpha(layer.opacity !== undefined ? layer.opacity : 1.0)) as any;
              entity.model.colorBlendMode = new Cesium.ConstantProperty(Cesium.ColorBlendMode.HIGHLIGHT) as any;
              entity.model.colorBlendAmount = new Cesium.ConstantProperty(0.0) as any;
            }
          }
        }

        // Keep the state reference in sync if missing
        if (!layer.cesiumEntity) {
          layer.cesiumEntity = entity;
        }
      }
    });

    // Update modelEntityRef to refer to the active selection's entity,
    // so that the 3D Axis transform gizmo and dragging operate on it!
    const activeLayer = (importedLayers || []).find(l => l.id === activeLayerId);
    if (activeLayer && activeLayer.type === 'clipping_polygon' && activeLayer.positions && activeLayer.positions.length > 0) {
      const sumLat = activeLayer.positions.reduce((s: number, p: any) => s + (p.lat || 0), 0);
      const sumLon = activeLayer.positions.reduce((s: number, p: any) => s + (p.lon || 0), 0);
      const sumH = activeLayer.positions.reduce((s: number, p: any) => s + (p.height || 0), 0);
      const count = activeLayer.positions.length;
      const centerLat = sumLat / count;
      const centerLon = sumLon / count;
      const centerH = sumH / count;

      const centerPos = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, centerH);
      let centerEntity = viewer.entities.getById(`clipping-polygon-center-${activeLayer.id}`);
      if (!centerEntity) {
        centerEntity = viewer.entities.add({
          id: `clipping-polygon-center-${activeLayer.id}`,
          position: centerPos as any
        });
      } else {
        centerEntity.position = new Cesium.ConstantPositionProperty(centerPos) as any;
      }
      modelEntityRef.current = centerEntity;
    } else if (activeLayer) {
      modelEntityRef.current = modelEntitiesMapRef.current.get(activeLayer.id) || null;
    } else {
      modelEntityRef.current = null;
    }

    viewer.scene.requestRender();
  }, [importedLayers, activeLayerId, isInitializing, showMassingLabels, sunShadowsEnabled, rtxUltraEnabled]);

  // Synchronize dynamic local zip tilesets
  const tilesetsMapRef = useRef<Map<string, Cesium.Cesium3DTileset>>(new Map());

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    // Helper to intercept resource loading from local zip
    function makeZipResource(resource: any, zipFiles: any, virtualBase: string): any {
      const originalDerive = resource.derive.bind(resource);
      resource.derive = function(options: any) {
        const derived = originalDerive(options);
        return makeZipResource(derived, zipFiles, virtualBase);
      };
      
      const originalFetchJson = resource.fetchJson.bind(resource);
      resource.fetchJson = function() {
        const cleanUrl = this.url.replace(/\\/g, '/');
        if (cleanUrl.startsWith(virtualBase)) {
          const path = cleanUrl.substring(virtualBase.length);
          const entry = zipFiles[path];
          if (entry) {
            return entry.async('text').then((text: string) => JSON.parse(text));
          }
        }
        return originalFetchJson();
      };
      
      const originalFetchArrayBuffer = resource.fetchArrayBuffer.bind(resource);
      resource.fetchArrayBuffer = function() {
        const cleanUrl = this.url.replace(/\\/g, '/');
        if (cleanUrl.startsWith(virtualBase)) {
          const path = cleanUrl.substring(virtualBase.length);
          const entry = zipFiles[path];
          if (entry) {
            return entry.async('arraybuffer');
          }
        }
        return originalFetchArrayBuffer();
      };

      const originalFetchImage = resource.fetchImage ? resource.fetchImage.bind(resource) : null;
      resource.fetchImage = function(preferBlob: boolean) {
        const cleanUrl = this.url.replace(/\\/g, '/');
        if (cleanUrl.startsWith(virtualBase)) {
          const path = cleanUrl.substring(virtualBase.length);
          const entry = zipFiles[path];
          if (entry) {
            return entry.async('blob').then((blob: Blob) => {
              const blobUrl = URL.createObjectURL(blob);
              const img = new Image();
              img.src = blobUrl;
              return new Promise((resolve, reject) => {
                img.onload = () => {
                  resolve(img);
                };
                img.onerror = reject;
              });
            });
          }
        }
        if (originalFetchImage) {
          return originalFetchImage(preferBlob);
        }
        return Promise.reject("fetchImage not found");
      };

      const originalFetch = resource.fetch ? resource.fetch.bind(resource) : null;
      resource.fetch = function(options: any) {
        const cleanUrl = this.url.replace(/\\/g, '/');
        if (cleanUrl.startsWith(virtualBase)) {
          const path = cleanUrl.substring(virtualBase.length);
          const entry = zipFiles[path];
          if (entry) {
            return entry.async('arraybuffer');
          }
        }
        if (originalFetch) return originalFetch(options);
      };

      return resource;
    }

    // Clean up removed tilesets
    const currentTilesetIds = new Set(
      (importedLayers || []).filter(l => l.type === 'tileset').map(l => l.id)
    );

    for (const [id, tileset] of tilesetsMapRef.current.entries()) {
      if (!currentTilesetIds.has(id)) {
        if (!viewer.isDestroyed()) {
          viewer.scene.primitives.remove(tileset);
        }
        tilesetsMapRef.current.delete(id);
      }
    }

    // Load / Update tilesets
    (importedLayers || []).filter(l => l.type === 'tileset').forEach((layer) => {
      let tileset = tilesetsMapRef.current.get(layer.id);
      if (!tileset) {
        if (layer.zipFiles) {
          const virtualBase = `virtual://${layer.id}/`;
          let rootResource = new Cesium.Resource({
            url: virtualBase + 'tileset.json'
          });
          rootResource = makeZipResource(rootResource, layer.zipFiles, virtualBase);

          Cesium.Cesium3DTileset.fromUrl(rootResource, {
            maximumScreenSpaceError: 3, 
            maximumMemoryUsage: 2048, 
            preloadSiblings: true,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 16
          } as any).then((loadedTileset) => {
            if (viewerRef.current === viewer && (importedLayers || []).some(l => l.id === layer.id)) {
              tilesetsMapRef.current.set(layer.id, loadedTileset);
              viewer.scene.primitives.add(loadedTileset);
              try { on3DTileLoaded?.(); } catch (_) {}
              
              // Apply existing clipping polygons if active
              applyClippingToTilesetInstance(loadedTileset);

              // Smoothly fly to tileset
              viewer.zoomTo(loadedTileset);
              viewer.scene.requestRender();
            }
          }).catch((err) => {
            console.error('Failed to load local zipped 3D tileset:', err);
          });
        }
      } else {
        tileset.show = layer.visible;
      }
    });

  }, [importedLayers, isInitializing]);

  // Handle fallback single 3D Model Import if no importedLayers are defined
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || (importedLayers && importedLayers.length > 0)) {
      if (legacyModelEntityRef.current) {
        viewer.entities.remove(legacyModelEntityRef.current);
        legacyModelEntityRef.current = null;
      }
      return;
    }

    // Clean up existing legacy model entity if any
    if (legacyModelEntityRef.current) {
      viewer.entities.remove(legacyModelEntityRef.current);
      legacyModelEntityRef.current = null;
    }

    if (!modelUrl) return;

    // Create model entity with a placeholder position and orientation
    const position = Cesium.Cartesian3.fromDegrees(modelLongitude, modelLatitude, modelHeight);
    const heading = Cesium.Math.toRadians(modelHeading);
    const hpr = new Cesium.HeadingPitchRoll(heading, Cesium.Math.toRadians(modelPitch), Cesium.Math.toRadians(modelRoll));
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

    const entity = viewer.entities.add({
      id: 'imported-3d-model',
      name: modelName || 'Imported 3D Model',
      position: position,
      orientation: orientation,
      model: {
        uri: modelUrl,
        minimumPixelSize: 128,
        maximumScale: 20000,
        color: new Cesium.ConstantProperty(Cesium.Color.WHITE),
        colorBlendMode: new Cesium.ConstantProperty(Cesium.ColorBlendMode.HIGHLIGHT),
        colorBlendAmount: new Cesium.ConstantProperty(0.0),
        shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
        lightColor: new Cesium.ConstantProperty(Cesium.Color.WHITE) as any,
        imageBasedLightingFactor: new Cesium.ConstantProperty(new Cesium.Cartesian2(0.8, 0.8)) as any,
        heightReference: modelClampToTerrain 
          ? Cesium.HeightReference.CLAMP_TO_GROUND 
          : Cesium.HeightReference.NONE
      }
    });

    legacyModelEntityRef.current = entity;
    modelEntityRef.current = entity;
    viewer.scene.requestRender();

    return () => {
      if (viewer && !viewer.isDestroyed() && legacyModelEntityRef.current) {
        viewer.entities.remove(legacyModelEntityRef.current);
        legacyModelEntityRef.current = null;
      }
    };
  }, [modelUrl, modelName, modelClampToTerrain, isInitializing, importedLayers]);

  // 1. Local Vector Data (GeoJSON/KML) Loader
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !localVectorUrl || !localVectorType) return;

    let dataSourcePromise: Promise<any>;
    if (localVectorType === 'geojson') {
      dataSourcePromise = Cesium.GeoJsonDataSource.load(localVectorUrl, {
        clampToGround: true,
        stroke: Cesium.Color.fromCssColorString('#3b82f6'),
        fill: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.3),
        strokeWidth: 3
      });
    } else {
      if (localVectorName && localVectorName.toLowerCase().endsWith('.kmz')) {
        dataSourcePromise = fetch(localVectorUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], localVectorName, { type: 'application/vnd.google-earth.kmz' });
            return Cesium.KmlDataSource.load(file, {
              camera: viewer.camera,
              canvas: viewer.canvas,
              clampToGround: true
            });
          });
      } else if (localVectorName && localVectorName.toLowerCase().endsWith('.kml')) {
        dataSourcePromise = fetch(localVectorUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], localVectorName, { type: 'application/vnd.google-earth.kml+xml' });
            return Cesium.KmlDataSource.load(file, {
              camera: viewer.camera,
              canvas: viewer.canvas,
              clampToGround: true
            });
          });
      } else {
        dataSourcePromise = Cesium.KmlDataSource.load(localVectorUrl, {
          camera: viewer.camera,
          canvas: viewer.canvas,
          clampToGround: true
        });
      }
    }

    let loadedDataSource: any = null;
    dataSourcePromise.then((dataSource) => {
      if (viewerRef.current === viewer && !viewer.isDestroyed()) {
        dataSource.entities.values.forEach((entity: any) => {
          if (entity.polygon) {
            entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
          }
        });
        convertLinesTo3DPipes(dataSource);
        viewer.dataSources.add(dataSource);
        loadedDataSource = dataSource;
        viewer.zoomTo(dataSource);
      }
    }).catch(err => {
      console.warn('Failed to load local vector data:', err);
    });

    return () => {
      if (viewer && !viewer.isDestroyed() && loadedDataSource) {
        viewer.dataSources.remove(loadedDataSource);
      }
    };
  }, [localVectorUrl, localVectorType, localVectorName, isInitializing]);

  // 2. Streamed 3D Tileset Loader
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !streamedTilesetId) return;

    let tileset: any = null;
    const loadTileset = async () => {
      try {
        const enteredAssetId = parseInt(streamedTilesetId);
        if (isNaN(enteredAssetId)) return;
        
        const resource = await Cesium.IonResource.fromAssetId(enteredAssetId);
        tileset = await Cesium.Cesium3DTileset.fromUrl(resource, {
          maximumScreenSpaceError: 3, 
          maximumMemoryUsage: 2048, 
          preloadSiblings: true,
          skipLevelOfDetail: true,
          baseScreenSpaceError: 1024,
          skipScreenSpaceErrorFactor: 16
        } as any);
        if (viewerRef.current === viewer && !viewer.isDestroyed()) {
          tileset.show = streamedTilesetVisible !== false;
          viewer.scene.primitives.add(tileset);
          try { on3DTileLoaded?.(); } catch (_) {}
          viewer.scene.requestRender();
        }
      } catch (err) {
        console.warn('Failed to stream 3D Tileset from Ion Asset ID:', err);
      }
    };

    loadTileset();

    return () => {
      if (viewer && !viewer.isDestroyed() && tileset) {
        viewer.scene.primitives.remove(tileset);
      }
    };
  }, [streamedTilesetId, isInitializing]);

  // Handle streamed tileset dynamic visibility changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !streamedTilesetId) return;

    const length = viewer.scene.primitives.length;
    for (let i = 0; i < length; i++) {
      const primitive = viewer.scene.primitives.get(i);
      // We can check if it is a Cesium3DTileset
      if (primitive && primitive instanceof Cesium.Cesium3DTileset) {
        primitive.show = streamedTilesetVisible !== false;
      }
    }
  }, [streamedTilesetVisible, streamedTilesetId, isInitializing]);

  // 3. 3D Axis Transform Gizmo Creation and Auto-Scaling
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const hasLayers = importedLayers && importedLayers.length > 0;
    const activeLayer = hasLayers ? importedLayers.find(l => l.id === activeLayerId) : null;
    const isClippingPoly = activeLayer && activeLayer.type === 'clipping_polygon';
    const isMassing = activeLayer && (activeLayer.type === 'parametric_massing' || activeLayer.type === 'tier2' || activeLayer.isTier2);
    const targetUrl = activeLayer ? activeLayer.url : modelUrl;
    const isVisible = activeLayer ? activeLayer.visible !== false : true;

    if (!activeLayer && !modelUrl) return;
    if (activeLayer && !targetUrl && !isClippingPoly && !isMassing) return;
    if (!isVisible) return;

    // Ensure modelEntityRef is populated for clipping polygon layer if active
    if (activeLayer && activeLayer.type === 'clipping_polygon' && activeLayer.positions && activeLayer.positions.length > 0) {
      const sumLat = activeLayer.positions.reduce((s: number, p: any) => s + (p.lat || 0), 0);
      const sumLon = activeLayer.positions.reduce((s: number, p: any) => s + (p.lon || 0), 0);
      const sumH = activeLayer.positions.reduce((s: number, p: any) => s + (p.height || 0), 0);
      const count = activeLayer.positions.length;
      const centerLat = sumLat / count;
      const centerLon = sumLon / count;
      const centerH = sumH / count;

      const centerPos = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, centerH);
      let centerEntity = viewer.entities.getById(`clipping-polygon-center-${activeLayer.id}`);
      if (!centerEntity) {
        centerEntity = viewer.entities.add({
          id: `clipping-polygon-center-${activeLayer.id}`,
          position: centerPos as any
        });
      } else {
        centerEntity.position = new Cesium.ConstantPositionProperty(centerPos) as any;
      }
      modelEntityRef.current = centerEntity;
    }

    // Helper to get active model Cartesian3 position safely
    const getModelPosition = () => {
      if (!modelEntityRef.current || !modelEntityRef.current.position) return null;
      const posProp = modelEntityRef.current.position as any;
      if (typeof posProp.getValue === 'function') {
        return posProp.getValue(viewer.clock.currentTime) || null;
      }
      return posProp instanceof Cesium.Cartesian3 ? posProp : null;
    };

    // Helper to get scale factor (50% smaller gizmo)
    const getScale = () => {
      const pos = getModelPosition();
      if (!pos || !viewer.camera) return 25;
      const cameraDistance = Cesium.Cartesian3.distance(viewer.camera.position, pos);
      return Math.max(1, Math.min(1000, cameraDistance * 0.075));
    };

    // Callback for line coordinates and handle positions
    const getAxisEnd = (axis: 'x' | 'y' | 'z') => {
      const pos = getModelPosition();
      if (!pos) return undefined;

      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
      const matrix3 = Cesium.Matrix4.getMatrix3(transform, new Cesium.Matrix3());
      const col = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      const dir = Cesium.Matrix3.getColumn(matrix3, col, new Cesium.Cartesian3());
      const scale = getScale();
      return Cesium.Cartesian3.add(pos, Cesium.Cartesian3.multiplyByScalar(dir, scale, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    };

    const xLinePositions = new Cesium.CallbackProperty(() => {
      const pos = getModelPosition();
      const end = getAxisEnd('x');
      if (!pos || !end) return [];
      return [pos, end];
    }, false);

    const yLinePositions = new Cesium.CallbackProperty(() => {
      const pos = getModelPosition();
      const end = getAxisEnd('y');
      if (!pos || !end) return [];
      return [pos, end];
    }, false);

    const zLinePositions = new Cesium.CallbackProperty(() => {
      const pos = getModelPosition();
      const end = getAxisEnd('z');
      if (!pos || !end) return [];
      return [pos, end];
    }, false);

    const showProperty = new Cesium.CallbackProperty(() => {
      if (!getModelPosition()) return false;
      const hasLayers = importedLayersRef.current && importedLayersRef.current.length > 0;
      const activeLayer = hasLayers ? importedLayersRef.current.find(l => l.id === activeLayerIdRef.current) : null;
      if (!activeLayer && !modelUrl) return false;
      if (activeLayer && activeLayer.visible === false) return false;
      return true;
    }, false);

    // Create gizmo lines and handles as entities
    const gizmoX = viewer.entities.add({
      id: 'gizmo-handle-x',
      show: showProperty,
      position: new Cesium.CallbackProperty(() => getAxisEnd('x'), false),
      polyline: {
        positions: xLinePositions,
        width: 4,
        material: Cesium.Color.RED,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.CallbackProperty(() => {
          if (!getModelPosition()) return undefined;
          const r = getScale() * 0.08;
          return new Cesium.Cartesian3(r, r, r);
        }, false),
        material: Cesium.Color.RED,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    const gizmoY = viewer.entities.add({
      id: 'gizmo-handle-y',
      show: showProperty,
      position: new Cesium.CallbackProperty(() => getAxisEnd('y'), false),
      polyline: {
        positions: yLinePositions,
        width: 4,
        material: Cesium.Color.GREEN,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.CallbackProperty(() => {
          if (!getModelPosition()) return undefined;
          const r = getScale() * 0.08;
          return new Cesium.Cartesian3(r, r, r);
        }, false),
        material: Cesium.Color.GREEN,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    const gizmoZ = viewer.entities.add({
      id: 'gizmo-handle-z',
      show: showProperty,
      position: new Cesium.CallbackProperty(() => getAxisEnd('z'), false),
      polyline: {
        positions: zLinePositions,
        width: 4,
        material: Cesium.Color.BLUE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.CallbackProperty(() => {
          if (!getModelPosition()) return undefined;
          const r = getScale() * 0.08;
          return new Cesium.Cartesian3(r, r, r);
        }, false),
        material: Cesium.Color.BLUE,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    const gizmoCenter = viewer.entities.add({
      id: 'gizmo-handle-center',
      show: showProperty,
      position: new Cesium.CallbackProperty(() => {
        return getModelPosition() || undefined;
      }, false),
      orientation: new Cesium.CallbackProperty(() => {
        const pos = getModelPosition();
        if (!pos) return undefined;
        return Cesium.Transforms.headingPitchRollQuaternion(pos, new Cesium.HeadingPitchRoll(0, 0, 0));
      }, false),
      box: {
        dimensions: new Cesium.CallbackProperty(() => {
          if (!getModelPosition()) return undefined;
          const size = getScale() * 0.16;
          return new Cesium.Cartesian3(size, size, size * 0.05);
        }, false),
        material: Cesium.Color.YELLOW.withAlpha(0.6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.entities.remove(gizmoX);
        viewer.entities.remove(gizmoY);
        viewer.entities.remove(gizmoZ);
        viewer.entities.remove(gizmoCenter);
      }
    };
  }, [modelUrl, isInitializing, activeLayerId]);

  // 4. Screen Space Event Handler for Gizmo Dragging
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    let isDragging = false;
    let dragAxis: 'x' | 'y' | 'z' | 'center' | null = null;
    let startCartesian: any = null;
    let startModelPos: any = null;
    let startScreenPos: { x: number; y: number } | null = null;
    let startCartoHeight: number = 0;

    handler.setInputAction((clickEvent: any) => {
      // Use refs to check visibility dynamically
      const hasLayers = importedLayersRef.current && importedLayersRef.current.length > 0;
      const activeLayer = hasLayers ? importedLayersRef.current.find(l => l.id === activeLayerIdRef.current) : null;
      const isVisible = activeLayer ? activeLayer.visible !== false : true;

      if (!isVisible || (!activeLayer && !modelUrl)) return;

      const pickedObject = viewer.scene.pick(clickEvent.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        let idStr = '';
        if (typeof pickedObject.id === 'string') {
          idStr = pickedObject.id;
        } else if (pickedObject.id.id) {
          idStr = pickedObject.id.id;
        }

        const isGizmoHandle = idStr === 'gizmo-handle-x' || idStr === 'gizmo-handle-y' || idStr === 'gizmo-handle-z' || idStr === 'gizmo-handle-center';
        const isClippingPoly = activeLayer && activeLayer.type === 'clipping_polygon' && typeof idStr === 'string' && (
          idStr.includes(activeLayer.id) || idStr.startsWith('clipping-polygon-')
        );

        if (isGizmoHandle || isClippingPoly) {
          isDragging = true;
          if (isGizmoHandle) {
            dragAxis = idStr === 'gizmo-handle-x' ? 'x' : idStr === 'gizmo-handle-y' ? 'y' : idStr === 'gizmo-handle-z' ? 'z' : 'center';
          } else {
            // Dragging directly on clipping polygon in viewport moves it across terrain
            dragAxis = 'center';
          }
          
          // Disable camera motion during drag
          viewer.scene.screenSpaceCameraController.enableInputs = false;

          startScreenPos = { x: clickEvent.position.x, y: clickEvent.position.y };

          // Record initial values
          if (modelEntityRef.current && modelEntityRef.current.position) {
            const posProp = modelEntityRef.current.position as any;
            startModelPos = typeof posProp.getValue === 'function' ? posProp.getValue(viewer.clock.currentTime) : (posProp instanceof Cesium.Cartesian3 ? posProp : null);
          }
          if (startModelPos) {
            startCartesian = viewer.camera.pickEllipsoid(clickEvent.position) || viewer.scene.pickPosition(clickEvent.position) || startModelPos;
            const carto = Cesium.Cartographic.fromCartesian(startModelPos);
            if (carto) {
              startCartoHeight = carto.height;
            }
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((moveEvent: any) => {
      if (!isDragging || !dragAxis || !startModelPos || !startCartesian) return;

      if (dragAxis === 'center') {
        let currentCartesian = viewer.scene.pickPosition(moveEvent.endPosition);
        if (!Cesium.defined(currentCartesian)) {
          currentCartesian = viewer.camera.pickEllipsoid(moveEvent.endPosition);
        }
        if (currentCartesian) {
          const carto = Cesium.Cartographic.fromCartesian(currentCartesian);
          if (carto) {
            const nextLat = Cesium.Math.toDegrees(carto.latitude);
            const nextLon = Cesium.Math.toDegrees(carto.longitude);
            onModelLatitudeChangeRef.current?.(nextLat);
            onModelLongitudeChangeRef.current?.(nextLon);
          }
        }
        return;
      }

      if (dragAxis === 'z') {
        if (startScreenPos) {
          const screenDy = (startScreenPos.y - moveEvent.endPosition.y);
          const dist = Cesium.Cartesian3.distance(viewer.camera.position, startModelPos);
          const sensitivity = Math.max(0.01, dist * 0.0012);
          const nextH = (startCartoHeight || 0) + screenDy * sensitivity;
          onModelHeightChangeRef.current?.(nextH);
        }
        return;
      }

      const currentCartesian = viewer.camera.pickEllipsoid(moveEvent.endPosition) || viewer.scene.pickPosition(moveEvent.endPosition);
      if (currentCartesian) {
        // Compute displacement vector
        const displacement = Cesium.Cartesian3.subtract(currentCartesian, startCartesian, new Cesium.Cartesian3());

        // Get local directions
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(startModelPos);
        const matrix3 = Cesium.Matrix4.getMatrix3(transform, new Cesium.Matrix3());
        const col = dragAxis === 'x' ? 0 : 1;
        const axisDir = Cesium.Matrix3.getColumn(matrix3, col, new Cesium.Cartesian3());

        // Project displacement onto axis
        const dot = Cesium.Cartesian3.dot(displacement, axisDir);
        const deltaVector = Cesium.Cartesian3.multiplyByScalar(axisDir, dot, new Cesium.Cartesian3());
        const newPosition = Cesium.Cartesian3.add(startModelPos, deltaVector, new Cesium.Cartesian3());

        const carto = Cesium.Cartographic.fromCartesian(newPosition);
        if (carto) {
          const nextLat = Cesium.Math.toDegrees(carto.latitude);
          const nextLon = Cesium.Math.toDegrees(carto.longitude);
          onModelLatitudeChangeRef.current?.(nextLat);
          onModelLongitudeChangeRef.current?.(nextLon);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      if (isDragging) {
        isDragging = false;
        dragAxis = null;
        startCartesian = null;
        startModelPos = null;
        // Re-enable camera inputs
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    return () => {
      handler.destroy();
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    };
  }, [modelUrl, isInitializing, activeLayerId]);

  // 4b. Screen Space Event Handler for Solar Path Gizmo Dragging
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    let isDragging = false;
    let dragAxis: 'x' | 'y' | 'z' | 'center' | null = null;
    let startCartesian: Cesium.Cartesian3 | null = null;
    let startCenter = { latitude: 37.774929, longitude: -122.419416, height: 0 };
    let startEcef: Cesium.Cartesian3 | null = null;

    handler.setInputAction((clickEvent: any) => {
      if (!solarPathEnabledRef.current) return;

      const pickedObject = viewer.scene.pick(clickEvent.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === 'string') {
        const idStr = pickedObject.id.id;
        if (idStr.startsWith('solar-gizmo-handle-')) {
          isDragging = true;
          isDraggingSolarGizmoRef.current = true;
          dragAxis = idStr === 'solar-gizmo-handle-x' ? 'x' : idStr === 'solar-gizmo-handle-y' ? 'y' : idStr === 'solar-gizmo-handle-z' ? 'z' : 'center';

          viewer.scene.screenSpaceCameraController.enableInputs = false;

          startCenter = activeAnalysisCenterRef.current || { latitude: 37.774929, longitude: -122.419416, height: 0 };
          startEcef = Cesium.Cartesian3.fromDegrees(startCenter.longitude, startCenter.latitude, startCenter.height || 0);
          startCartesian = viewer.camera.pickEllipsoid(clickEvent.position) || startEcef.clone();
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((moveEvent: any) => {
      if (!isDragging || !dragAxis || !startEcef || !startCartesian) return;

      if (dragAxis === 'center') {
        let currentCartesian = viewer.scene.pickPosition(moveEvent.endPosition);
        if (!Cesium.defined(currentCartesian)) {
          currentCartesian = viewer.camera.pickEllipsoid(moveEvent.endPosition);
        }
        if (currentCartesian) {
          const carto = Cesium.Cartographic.fromCartesian(currentCartesian);
          if (carto) {
            onActiveAnalysisCenterChangeRef.current?.({
              latitude: Cesium.Math.toDegrees(carto.latitude),
              longitude: Cesium.Math.toDegrees(carto.longitude),
              height: startCenter.height || 0
            });
          }
        }
        return;
      }

      if (dragAxis === 'x' || dragAxis === 'y') {
        const currentCartesian = viewer.camera.pickEllipsoid(moveEvent.endPosition);
        if (currentCartesian && startCartesian) {
          const displacement = Cesium.Cartesian3.subtract(currentCartesian, startCartesian, new Cesium.Cartesian3());
          const transform = Cesium.Transforms.eastNorthUpToFixedFrame(startEcef);
          const matrix3 = Cesium.Matrix4.getMatrix3(transform, new Cesium.Matrix3());
          const col = dragAxis === 'x' ? 0 : 1;
          const axisDir = Cesium.Matrix3.getColumn(matrix3, col, new Cesium.Cartesian3());
          const dot = Cesium.Cartesian3.dot(displacement, axisDir);
          const deltaVector = Cesium.Cartesian3.multiplyByScalar(axisDir, dot, new Cesium.Cartesian3());
          const newPos = Cesium.Cartesian3.add(startEcef, deltaVector, new Cesium.Cartesian3());
          const carto = Cesium.Cartographic.fromCartesian(newPos);
          if (carto) {
            onActiveAnalysisCenterChangeRef.current?.({
              latitude: Cesium.Math.toDegrees(carto.latitude),
              longitude: Cesium.Math.toDegrees(carto.longitude),
              height: startCenter.height || 0
            });
          }
        }
      } else if (dragAxis === 'z') {
        const deltaY = (moveEvent.startPosition.y - moveEvent.endPosition.y);
        const heightStep = deltaY * 0.5;
        const newHeight = Math.max(-500, Math.min(10000, (startCenter.height || 0) + heightStep));
        onActiveAnalysisCenterChangeRef.current?.({
          latitude: startCenter.latitude,
          longitude: startCenter.longitude,
          height: newHeight
        });
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const handleUp = () => {
      if (isDragging) {
        isDragging = false;
        isDraggingSolarGizmoRef.current = false;
        dragAxis = null;
        startCartesian = null;
        startEcef = null;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    };

    handler.setInputAction(handleUp, Cesium.ScreenSpaceEventType.LEFT_UP);

    return () => {
      handler.destroy();
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    };
  }, [isInitializing]);

  // Handle high-performance smooth real-time orientation and position updates in WebGL
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !modelEntityRef.current || (importedLayers && importedLayers.length > 0)) return;

    const position = Cesium.Cartesian3.fromDegrees(modelLongitude, modelLatitude, modelHeight);

    // SketchUp Axis Translation Correction:
    const baseHeadingOffset = modelApplySketchUpProfile ? Cesium.Math.toRadians(90.0) : 0.0;

    // High-Precision Z-Axis Horizontal Heading Modifier
    const headingOffset = Cesium.Math.toRadians(modelHeading) + baseHeadingOffset;
    const hpr = new Cesium.HeadingPitchRoll(
      headingOffset, 
      Cesium.Math.toRadians(modelPitch), 
      Cesium.Math.toRadians(modelRoll)
    );
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

    // Update existing entity properties in place to avoid WebGL stuttering or frame flickering
    modelEntityRef.current.position = position as any;
    modelEntityRef.current.orientation = orientation as any;

    viewer.scene.requestRender();
  }, [modelLongitude, modelLatitude, modelHeight, modelApplySketchUpProfile, modelHeading, modelPitch, modelRoll, isInitializing]);

  // Handle flying to the model asset when requested
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !modelUrl || modelFlyToTrigger === 0) return;

    const position = Cesium.Cartesian3.fromDegrees(modelLongitude, modelLatitude, modelHeight);
    
    if (modelEntityRef.current) {
      viewer.flyTo(modelEntityRef.current, {
        duration: 3.0,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-30),
          150.0 // camera range in meters from entity
        )
      }).catch(() => {
        try {
          const boundingSphere = new Cesium.BoundingSphere(position, 100);
          viewer.camera.flyToBoundingSphere(boundingSphere, { duration: 3.0 });
        } catch (_) {}
      });
    }
  }, [modelFlyToTrigger, isInitializing]);

  // Update canvas/cursor styling when picking location is active
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && viewer.canvas) {
      if (isPickingLocation) {
        viewer.canvas.style.cursor = 'crosshair';
      } else {
        viewer.canvas.style.cursor = '';
      }
    }
  }, [isPickingLocation]);

  // ScreenSpaceEventHandler for interactive model placement and location picking from scene
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || !isPickingLocation) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // Track mouse movement in real-time to position the active model right under the cursor
    handler.setInputAction((movement: any) => {
      let pickedCartesian = viewer.scene.pickPosition(movement.endPosition);
      if (!Cesium.defined(pickedCartesian)) {
        pickedCartesian = viewer.camera.pickEllipsoid(movement.endPosition);
      }

      if (Cesium.defined(pickedCartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(pickedCartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;

        onModelLatitudeChangeRef.current?.(latitude);
        onModelLongitudeChangeRef.current?.(longitude);
        onModelHeightChangeRef.current?.(height);

        viewer.scene.requestRender();
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Finalize placement on click
    handler.setInputAction((clickEvent: any) => {
      // Pick position on terrain, buildings, or imported assets
      let pickedCartesian = viewer.scene.pickPosition(clickEvent.position);
      if (!Cesium.defined(pickedCartesian)) {
        pickedCartesian = viewer.camera.pickEllipsoid(clickEvent.position);
      }

      if (Cesium.defined(pickedCartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(pickedCartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;

        // Immediately finalize active model placement coordinate inputs and states
        onModelLatitudeChangeRef.current?.(latitude);
        onModelLongitudeChangeRef.current?.(longitude);
        onModelHeightChangeRef.current?.(height);

        // Turn isPickingLocation back to false
        onIsPickingLocationChangeRef.current?.(false);

        // Instantly redraw scene
        viewer.scene.requestRender();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Right-click cancels placement
    handler.setInputAction(() => {
      onIsPickingLocationChangeRef.current?.(false);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [isPickingLocation, isInitializing]);

  // ScreenSpaceEventHandler for tree-placement point-and-click
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || activeTool !== 'tree-placement') return;

    onMeasureResultChange('Point-and-Click Tree Placement active. Click anywhere on terrain or surfaces to plant a tree.');

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      // Pick position on terrain or 3D buildings
      let cartesian = viewer.scene.pickPosition(click.position);
      if (!Cesium.defined(cartesian)) {
        cartesian = viewer.camera.pickEllipsoid(click.position);
      }

      if (Cesium.defined(cartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        
        // Use scene.sampleHeight to get precise altitude (terrain + buildings)
        let sampledHeight = viewer.scene.sampleHeight(cartographic);
        if (sampledHeight === undefined) {
          sampledHeight = cartographic.height;
        }

        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);

        // Randomize scale & rotation slightly to look organic
        const scale = 0.7 + Math.random() * 0.8;
        const rotation = Math.random() * 360;

        const newTree = {
          id: `tree-manual-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          longitude,
          latitude,
          height: sampledHeight,
          scale,
          rotation,
          isScattered: false
        };

        const currentTrees = placedTreesRef.current || [];
        if (onPlacedTreesChange) {
          onPlacedTreesChange([...currentTrees, newTree]);
          onMeasureResultChange(`Planted tree at ${latitude.toFixed(5)}°, ${longitude.toFixed(5)}° (Elev: ${sampledHeight.toFixed(1)}m).`);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Right click cancels/disables the tool
    handler.setInputAction(() => {
      onActiveToolChange('none');
      onMeasureResultChange(null);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [activeTool, isInitializing, onPlacedTreesChange, onActiveToolChange, onMeasureResultChange]);

  // ScreenSpaceEventHandler for automated bounding box / circle centered on a picked object
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || activeTool !== 'auto-bound') return;

    onMeasureResultChange('Pick Focus Asset: Click on any 3D building, custom model, or imported asset on the map.');

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      let pickedPosition: Cesium.Cartesian3 | undefined;

      // 1. Prioritize direct 3D coordinate lookup (works on building models, rooftops, and terrain)
      if (viewer.scene.pickPositionSupported) {
        pickedPosition = viewer.scene.pickPosition(click.position);
      }

      // 2. If direct lookup fails, use the traditional scene pick
      const pickedObject = viewer.scene.pick(click.position);

      if (!pickedPosition && Cesium.defined(pickedObject)) {
        // Option A: Cesium.Entity position or shapefile feature
        if (pickedObject.id instanceof Cesium.Entity) {
          const entity = pickedObject.id;
          if (entity.position) {
            pickedPosition = typeof entity.position.getValue === 'function' ? entity.position.getValue(viewer.clock.currentTime) : entity.position;
          } else if (entity.polygon || entity.polyline) {
            let points: Cesium.Cartesian3[] = [];
            if (entity.polygon && entity.polygon.hierarchy) {
              const hierarchy = typeof entity.polygon.hierarchy.getValue === 'function' ? entity.polygon.hierarchy.getValue(viewer.clock.currentTime) : entity.polygon.hierarchy;
              if (hierarchy && hierarchy.positions) {
                points = hierarchy.positions;
              }
            } else if (entity.polyline && entity.polyline.positions) {
              const rawPoints = typeof entity.polyline.positions.getValue === 'function' ? entity.polyline.positions.getValue(viewer.clock.currentTime) : entity.polyline.positions;
              points = Array.isArray(rawPoints) ? rawPoints : [];
            }

            if (points.length > 0) {
              try {
                const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
                pickedPosition = boundingSphere.center;
              } catch (e) {
                console.warn('Error calculating bounding sphere from points:', e);
              }
            }
          }
        }

        // Option B: 3D Tile feature / Primitive
        if (!pickedPosition && Cesium.defined(pickedObject.primitive)) {
          const primitive = pickedObject.primitive;
          if (primitive.boundingSphere) {
            pickedPosition = primitive.boundingSphere.center;
          } else if (primitive.model && primitive.model.boundingSphere) {
            pickedPosition = primitive.model.boundingSphere.center;
          }
        }

        // Option C: Bounding sphere from 3D Tileset / Feature content
        if (!pickedPosition && Cesium.defined(pickedObject.content)) {
          const content = pickedObject.content;
          if (content.tileset && content.tileset.boundingSphere) {
            pickedPosition = content.tileset.boundingSphere.center;
          }
        }
      }

      // Option D: Fallback to general terrain pick
      if (!pickedPosition) {
        pickedPosition = viewer.camera.pickEllipsoid(click.position);
      }

      if (Cesium.defined(pickedPosition)) {
        try {
          const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
          const centerLatDeg = Cesium.Math.toDegrees(cartographic.latitude);
          const centerLonDeg = Cesium.Math.toDegrees(cartographic.longitude);

          if (boundaryShapeRef.current === 'circle') {
            if (onBoundaryCenterChange) {
              onBoundaryCenterChange({
                latitude: cartographic.latitude,
                longitude: cartographic.longitude
              });
            }
            if (onActiveAnalysisCenterChange) {
              onActiveAnalysisCenterChange({
                latitude: cartographic.latitude,
                longitude: cartographic.longitude,
                height: cartographic.height
              });
            }
            const radius = boundaryRadiusRef.current || 1000;
            onMeasureResultChange(
              `Auto-bounded Circular area (Diameter: ${(radius * 2).toLocaleString()}m) centered on asset at ${centerLatDeg.toFixed(5)}°, ${centerLonDeg.toFixed(5)}°.`
            );
          } else {
            // Automated 1 Sq Km Envelope Generation
            const latOffsetDegrees = 500 / 111320; 
            const latRad = cartographic.latitude;
            const lonOffsetDegrees = 500 / (111320 * Math.cos(latRad));

            const minLonDeg = centerLonDeg - lonOffsetDegrees;
            const maxLonDeg = centerLonDeg + lonOffsetDegrees;
            const minLatDeg = centerLatDeg - latOffsetDegrees;
            const maxLatDeg = centerLatDeg + latOffsetDegrees;

            // Convert back into radians for standard boundary bounds representation
            const minLon = Cesium.Math.toRadians(minLonDeg);
            const maxLon = Cesium.Math.toRadians(maxLonDeg);
            const minLat = Cesium.Math.toRadians(minLatDeg);
            const maxLat = Cesium.Math.toRadians(maxLatDeg);

            if (onBoundaryBoundsChange) {
              onBoundaryBoundsChange({ minLon, maxLon, minLat, maxLat });
            }
            if (onActiveAnalysisCenterChange) {
              onActiveAnalysisCenterChange({
                latitude: cartographic.latitude,
                longitude: cartographic.longitude,
                height: cartographic.height
              });
            }

            onMeasureResultChange(
              `Auto-bounded 1 Sq Km area centered on asset at ${centerLatDeg.toFixed(5)}°, ${centerLonDeg.toFixed(5)}°.`
            );
          }

          // Auto-disable tool after picking
          onActiveToolChange('none');
        } catch (err) {
          console.error('Error generating auto-bounds:', err);
          onMeasureResultChange('Error calculating envelope center coordinates.');
        }
      } else {
        onMeasureResultChange('Could not resolve selected asset position. Try clicking again.');
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Right click cancels/disables the tool
    handler.setInputAction(() => {
      onActiveToolChange('none');
      onMeasureResultChange(null);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [activeTool, isInitializing, onBoundaryBoundsChange, onActiveToolChange, onMeasureResultChange, onBoundaryCenterChange, onActiveAnalysisCenterChange]);

  // Listen for ESC key to deselect the active imported 3D model
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onActiveLayerIdChange?.(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onActiveLayerIdChange]);

  // ScreenSpaceEventHandler for selecting map objects / Shapefile assets & centering Solar Path Arc
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || isPickingLocation) return;
    if (activeTool !== 'none' && activeTool !== 'auto-bound') return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    const handlePickAction = (click: any) => {
      const pickedObject = viewer.scene.pick(click.position);

      // 1. Handle Cluster Click (array of clustered entities)
      if (Cesium.defined(pickedObject) && Array.isArray(pickedObject.id)) {
        const entities = pickedObject.id;
        const points = entities.map((entity: Cesium.Entity) => {
          if (entity.position) {
            return typeof entity.position.getValue === 'function' ? entity.position.getValue(viewer.clock.currentTime) : entity.position;
          }
          return null;
        }).filter(Boolean) as Cesium.Cartesian3[];

        if (points.length > 0) {
          const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
          viewer.camera.flyToBoundingSphere(boundingSphere, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), boundingSphere.radius * 2.5)
          });
          onMeasureResultChange?.(`Zoomed into cluster containing ${entities.length} landmarks.`);
        }
        return;
      }

      // 2. Handle Single Overpass POI Click
      if (
        Cesium.defined(pickedObject) &&
        pickedObject.id instanceof Cesium.Entity &&
        pickedObject.id.id &&
        String(pickedObject.id.id).startsWith('overpass-poi-')
      ) {
        const poiIdStr = String(pickedObject.id.id).replace('overpass-poi-', '');
        const matchedPOI = (currentLandmarks || []).find((p: any) => String(p.id) === poiIdStr);
        if (matchedPOI && onPOISelect) {
          onPOISelect(matchedPOI);
          onMeasureResultChange?.(`Selected Landmark: ${matchedPOI.name}`);
          return;
        }
      }

      // Handle selecting/deselecting active imported 3D model & massing layers
      let pickedLayerId: string | null = null;
      if (Cesium.defined(pickedObject)) {
        let idStr = '';
        if (pickedObject.id) {
          idStr = typeof pickedObject.id === 'string' ? pickedObject.id : (pickedObject.id.id || '');
        } else if (pickedObject.primitive && pickedObject.primitive.id) {
          idStr = typeof pickedObject.primitive.id === 'string' ? pickedObject.primitive.id : (pickedObject.primitive.id.id || '');
        }

        // Ignore transform gizmo handles clicks so we do not deselect when interacting with the gizmo
        if (idStr === 'gizmo-handle-x' || idStr === 'gizmo-handle-y' || idStr === 'gizmo-handle-z' || idStr === 'gizmo-handle-center') {
          return;
        }

        if (idStr) {
          // Check if this ID matches one of our imported 3D model layers, massings, area polygons, or clipping polygons
          const matchedLayer = (importedLayers || []).find(l => 
            l.id === idStr || 
            (typeof idStr === 'string' && idStr.includes(l.id)) ||
            (l.type === 'parametric_massing' && typeof idStr === 'string' && idStr.startsWith(l.id)) ||
            (l.type === 'area_polygon' && typeof idStr === 'string' && idStr.startsWith(l.id)) ||
            (l.type === 'clipping_polygon' && typeof idStr === 'string' && idStr.includes(l.id)) ||
            (typeof idStr === 'string' && (idStr.startsWith('area-polygon-') || idStr.startsWith('clipping-polygon-')))
          );
          if (matchedLayer) {
            pickedLayerId = matchedLayer.id;
          }
        }
      }

      const isCtrlKey = Boolean(
        lastClickModifierRef.current || 
        isCtrlPressedRef.current || 
        (typeof window !== 'undefined' && (window.event as MouseEvent)?.ctrlKey) || 
        (typeof window !== 'undefined' && (window.event as MouseEvent)?.metaKey) ||
        (typeof window !== 'undefined' && (window.event as MouseEvent)?.shiftKey)
      );

      // Reset modifier ref after processing
      setTimeout(() => { lastClickModifierRef.current = false; }, 100);

      // If we clicked on an imported model layer or area polygon, select it (or toggle if CTRL key held).
      // If we clicked anything else without CTRL held, deselect.
      if (pickedLayerId) {
        onActiveLayerIdChange?.(pickedLayerId, isCtrlKey);
      } else if (!isCtrlKey) {
        onActiveLayerIdChange?.(null, false);
      }

      if (!Cesium.defined(pickedObject)) {
        onPickedAssetMetadataChange?.(null);
        return;
      }

      // Do NOT show floating popup panel for area polygons
      const isAreaPolygon = pickedLayerId && (importedLayers || []).find(l => l.id === pickedLayerId)?.type === 'area_polygon';
      if (isAreaPolygon || (pickedObject.id && typeof pickedObject.id.id === 'string' && pickedObject.id.id.startsWith('area-polygon-'))) {
        onPickedAssetMetadataChange?.(null);
        return;
      }

      // Extract 3D Tile / Batch Table metadata parameters if clicked on a 3D Tileset feature
      if (typeof pickedObject.getPropertyNames === 'function') {
        try {
          const names = pickedObject.getPropertyNames();
          const attributes: Record<string, any> = {};
          names.forEach((name: string) => {
            attributes[name] = pickedObject.getProperty(name);
          });
          const assetName = pickedObject.getProperty('name') || pickedObject.getProperty('elementId') || "3D Tileset Feature";
          onPickedAssetMetadataChange?.({
            name: String(assetName),
            attributes: attributes
          });
        } catch (err) {
          console.warn('Error reading Batch Table attributes:', err);
        }
      } else {
        onPickedAssetMetadataChange?.(null);
      }

      let latitude: number | null = null;
      let longitude: number | null = null;
      let height = 0;
      let resolvedName = "Selected Asset";

      // Case A: Shapefile Feature Entity
      let isShapefileFeature = false;
      if (
        pickedObject.id instanceof Cesium.Entity &&
        pickedObject.id.id &&
        String(pickedObject.id.id).startsWith('shapefile-feature-')
      ) {
        isShapefileFeature = true;
        const fullId = String(pickedObject.id.id).replace('shapefile-feature-', '');
        let foundFeature: ShapefileFeature | null = null;

        if (gisLayers && gisLayers.length > 0) {
          for (const layer of gisLayers) {
            if (!layer.visible) continue;
            const prefix = `${layer.id}-`;
            if (fullId.startsWith(prefix)) {
              const featId = fullId.slice(prefix.length);
              const feat = layer.shapefileData?.features?.find((f: any) => String(f.id) === featId);
              if (feat) {
                foundFeature = feat;
                resolvedName = `${layer.name} Feature`;
                break;
              }
            }
          }
        }

        if (!foundFeature && shapefileData) {
          foundFeature = shapefileData.features.find(f => String(f.id) === fullId) || null;
          resolvedName = "Shapefile Feature";
        }

        // Found feature handling

        if (foundFeature && foundFeature.positions && foundFeature.positions.length > 0) {
          // Complex multi-node Shapefile polygon geometries: Turf.js centroid calculation
          const coords = foundFeature.positions.map((p: [number, number]) => [p[0], p[1]]);
          if (coords.length > 0) {
            // Ensure polygon is closed for Turf.js
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
              coords.push([coords[0][0], coords[0][1]]);
            }
            try {
              const geojsonPolygon = turf.polygon([coords]);
              const centroidFeat = turf.centroid(geojsonPolygon);
              const centroidCoords = centroidFeat.geometry.coordinates; // [longitude, latitude]
              longitude = centroidCoords[0];
              latitude = centroidCoords[1];
            } catch (e) {
              console.warn('Turf centroid failed, using pre-calculated center fallback:', e);
              const [lng, lat] = foundFeature.center || [0, 0];
              longitude = lng;
              latitude = lat;
            }
          }
        }
      }

      // Case B: 3D context building, glTF model, or primitive
      if (!isShapefileFeature) {
        let pickedPosition: Cesium.Cartesian3 | undefined;

        // Try to get the exact click coordinate on the picked 3D building/mesh first
        if (viewer.scene.pickPositionSupported) {
          pickedPosition = viewer.scene.pickPosition(click.position);
        }

        // Standard Cesium Entity fallback (like custom glTF models)
        if (!pickedPosition && pickedObject.id instanceof Cesium.Entity) {
          const entity = pickedObject.id;
          resolvedName = entity.name || "glTF Asset";
          if (entity.position) {
            pickedPosition = typeof entity.position.getValue === 'function' ? entity.position.getValue(viewer.clock.currentTime) : entity.position;
          } else if (entity.polygon || entity.polyline) {
            let points: Cesium.Cartesian3[] = [];
            if (entity.polygon && entity.polygon.hierarchy) {
              const hierarchy = typeof entity.polygon.hierarchy.getValue === 'function' ? entity.polygon.hierarchy.getValue(viewer.clock.currentTime) : entity.polygon.hierarchy;
              if (hierarchy && hierarchy.positions) {
                points = hierarchy.positions;
              }
            } else if (entity.polyline && entity.polyline.positions) {
              const rawPoints = typeof entity.polyline.positions.getValue === 'function' ? entity.polyline.positions.getValue(viewer.clock.currentTime) : entity.polyline.positions;
              points = Array.isArray(rawPoints) ? rawPoints : [];
            }

            if (points.length > 0) {
              try {
                const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
                pickedPosition = boundingSphere.center;
              } catch (e) {
                console.warn('Error calculating bounding sphere from points:', e);
              }
            }
          }
        }

        // Determine building name if it is a tileset feature
        if (pickedObject.id instanceof Cesium.Entity) {
          resolvedName = pickedObject.id.name || "glTF Asset";
        } else if (typeof pickedObject.getProperty === 'function') {
          resolvedName = pickedObject.getProperty('name') || pickedObject.getProperty('elementId') || "3D Context Building";
        } else {
          resolvedName = "3D Context Building";
        }

        // If pickedPosition is still not resolved, fall back to primitive boundingSphere center
        if (!pickedPosition && Cesium.defined(pickedObject.primitive)) {
          const primitive = pickedObject.primitive;
          if (primitive.boundingSphere) {
            pickedPosition = primitive.boundingSphere.center;
          } else if (primitive.model && primitive.model.boundingSphere) {
            pickedPosition = primitive.model.boundingSphere.center;
          }
        }

        // Bounding sphere from 3D Tileset fallback
        if (!pickedPosition && Cesium.defined(pickedObject.content)) {
          const content = pickedObject.content;
          if (content.tileset && content.tileset.boundingSphere) {
            pickedPosition = content.tileset.boundingSphere.center;
          }
        }

        if (pickedPosition) {
          const carto = Cesium.Cartographic.fromCartesian(pickedPosition);
          latitude = Cesium.Math.toDegrees(carto.latitude);
          longitude = Cesium.Math.toDegrees(carto.longitude);
          height = carto.height;
        }
      }

      if (latitude !== null && longitude !== null) {
        const newCenter = { latitude, longitude, height };
        
        if (onActiveAnalysisCenterChange) {
          onActiveAnalysisCenterChange(newCenter);
        }

        if (onSolarPathRadiusChange) {
          onSolarPathRadiusChange(300);
        }

        onMeasureResultChange(
          `Set analysis center on ${resolvedName} at ${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°.`
        );
      }
    };

    // Close ContextMenu on LEFT_CLICK
    handler.setInputAction((click: any) => {
      contextMenuService.close();
      handlePickAction(click);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    if (Cesium.KeyboardEventModifier) {
      if (Cesium.KeyboardEventModifier.CTRL !== undefined) {
        handler.setInputAction((click: any) => {
          contextMenuService.close();
          handlePickAction(click);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.CTRL);
      }
      if (Cesium.KeyboardEventModifier.SHIFT !== undefined) {
        handler.setInputAction((click: any) => {
          contextMenuService.close();
          handlePickAction(click);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.SHIFT);
      }
      if (Cesium.KeyboardEventModifier.ALT !== undefined) {
        handler.setInputAction((click: any) => {
          contextMenuService.close();
          handlePickAction(click);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.ALT);
      }
    }

    // Right-Click Context Menu interceptor for CAD / GIS 3D scene objects
    handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
      // 1. Pick the clicked object in the 3D scene
      const pickedObject = viewer.scene.pick(movement.position);

      // Check if clicked object is the draped DXF texture primitive
      let clickedDrapeLayerId: string | null = null;
      let isPickedDrape = false;
      if (Cesium.defined(pickedObject)) {
        const pId = typeof pickedObject.id === 'string' ? pickedObject.id : pickedObject.id?.id;
        if (typeof pId === 'string') {
          if (pId.startsWith('dxf-site-boundary-drape-')) {
            clickedDrapeLayerId = pId.replace('dxf-site-boundary-drape-', '');
            isPickedDrape = true;
          } else if (pId === 'dxf-site-boundary-drape') {
            isPickedDrape = true;
          }
        }
        if (!isPickedDrape) {
          if (drapePrimitiveRef.current && pickedObject.primitive === drapePrimitiveRef.current) {
            isPickedDrape = true;
          } else {
            for (const [lId, prim] of gisLayersDrapePrimitivesRef.current.entries()) {
              if (pickedObject.primitive === prim) {
                clickedDrapeLayerId = lId;
                isPickedDrape = true;
                break;
              }
            }
          }
        }
      }

      // Also check if right-click hit ground coordinates inside any active CAD boundary
      let isInsideDxfPolygon = false;
      let drapeClickCenter: { latitude: number; longitude: number; height?: number } | undefined = undefined;
      try {
        const ray = viewer.camera.getPickRay(movement.position);
        const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const clickLng = Cesium.Math.toDegrees(carto.longitude);
          const clickLat = Cesium.Math.toDegrees(carto.latitude);
          drapeClickCenter = { latitude: clickLat, longitude: clickLng, height: carto.height };

          const cadLayers = (gisLayers || []).filter(
            (l: any) => l.shapefileData?.isCad || l.name?.toLowerCase().endsWith('.dxf')
          );
          for (const cl of cadLayers) {
            const vs = cl.polygonData?.positions;
            if (vs && vs.length >= 3) {
              let inside = false;
              for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                const xi = vs[i][0], yi = vs[i][1];
                const xj = vs[j][0], yj = vs[j][1];
                const intersect =
                  yi > clickLat !== yj > clickLat &&
                  clickLng < ((xj - xi) * (clickLat - yi)) / (yj - yi) + xi;
                if (intersect) inside = !inside;
              }
              if (inside) {
                isInsideDxfPolygon = true;
                if (!clickedDrapeLayerId) clickedDrapeLayerId = cl.id;
                break;
              }
            }
          }

          if (!isInsideDxfPolygon && polygonData && polygonData.positions && polygonData.positions.length >= 3) {
            let inside = false;
            const vs = polygonData.positions;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
              const xi = vs[i][0], yi = vs[i][1];
              const xj = vs[j][0], yj = vs[j][1];
              const intersect =
                yi > clickLat !== yj > clickLat &&
                clickLng < ((xj - xi) * (clickLat - yi)) / (yj - yi) + xi;
              if (intersect) inside = !inside;
            }
            isInsideDxfPolygon = inside;
          }
        }
      } catch (_) {}

      if (
        isPickedDrape ||
        (isInsideDxfPolygon &&
          (!Cesium.defined(pickedObject) || !pickedObject.id || typeof pickedObject.id === 'string'))
      ) {
        const targetLayer = clickedDrapeLayerId
          ? (gisLayers || []).find((l: any) => l.id === clickedDrapeLayerId)
          : null;
        const targetTexUrl =
          targetLayer?.textureUrl !== undefined ? targetLayer.textureUrl : textureUrl;
        const targetTexName =
          targetLayer?.textureName !== undefined ? targetLayer.textureName : textureName;
        const displayName = targetTexName
          ? `DXF Boundary (${targetTexName})`
          : targetLayer?.name || 'DXF Boundary';

        const boundaryEntity = new Cesium.Entity({
          id: clickedDrapeLayerId
            ? `dxf-site-boundary-drape-${clickedDrapeLayerId}`
            : 'dxf-site-boundary-drape',
          name: displayName,
          properties: new Cesium.PropertyBag({
            isCad: true,
            isDxf: true,
            layerId: targetLayer?.id || clickedDrapeLayerId,
            isDxfTexture: Boolean(targetTexUrl),
            hasTexture: Boolean(targetTexUrl),
            textureUrl: targetTexUrl,
            textureName: targetTexName || 'CAD Texture',
            LAYER: 'DXF_BOUNDARY',
            SOURCE_FILE: targetTexName
              ? `Texture: ${targetTexName}`
              : targetLayer?.name || shapefileName || 'AutoCAD DXF Boundary'
          })
        });

        contextMenuService.open({
          x: movement.position.x,
          y: movement.position.y,
          entity: boundaryEntity,
          layerName: displayName,
          sourceFile: targetTexName || targetLayer?.name || shapefileName || 'AutoCAD DXF Boundary',
          details: {
            entity: boundaryEntity,
            layerName: displayName,
            sourceFile: targetTexName || targetLayer?.name || shapefileName || 'AutoCAD DXF Boundary',
            layerId: targetLayer?.id || clickedDrapeLayerId,
            isDxf: true,
            isCad: true,
            isDxfTexture: Boolean(targetTexUrl),
            hasTexture: Boolean(targetTexUrl),
            textureUrl: targetTexUrl,
            textureName: targetTexName,
            positions: targetLayer?.polygonData?.positions || polygonData?.positions,
            bounds: targetLayer?.polygonData?.bounds || polygonData?.bounds,
            centerCoordinate: drapeClickCenter
          }
        });
        return;
      }

      if (Cesium.defined(pickedObject) && pickedObject.id) {
        let entity: Cesium.Entity | null = null;
        if (pickedObject.id instanceof Cesium.Entity) {
          entity = pickedObject.id;
        } else if (Array.isArray(pickedObject.id) && pickedObject.id.length > 0 && pickedObject.id[0] instanceof Cesium.Entity) {
          entity = pickedObject.id[0];
        }

        if (entity) {
          // Resolve Layer and Source File information
          const idStr = String(entity.id || '');
          let layerName = 'Default Layer';
          let sourceFile = 'Unknown';
          let matchedLayerId: string | undefined = undefined;
          let matchedFeatureId: string | number | undefined = undefined;
          let featProperties: Record<string, any> = {};

          // Check if properties PropertyBag exists on entity
          if (entity.properties) {
            const rawLayer = entity.properties.LAYER?.getValue?.() || entity.properties.layer?.getValue?.() || entity.properties.ZONING?.getValue?.() || entity.properties.zoning?.getValue?.();
            const rawSource = entity.properties.SOURCE_FILE?.getValue?.() || entity.properties.source_file?.getValue?.() || entity.properties.FILE?.getValue?.();
            if (rawLayer) layerName = String(rawLayer);
            if (rawSource) sourceFile = String(rawSource);

            // Extract key/value map for inspection
            const propNames = entity.properties.propertyNames || [];
            propNames.forEach((pName: string) => {
              featProperties[pName] = entity?.properties?.[pName]?.getValue?.(viewer.clock.currentTime) ?? entity?.properties?.[pName]?.getValue?.();
            });
          }

          let matchedFeatureObj: any = null;
          let featPositions: [number, number][] | undefined = undefined;
          let featBounds: { west: number; south: number; east: number; north: number } | undefined = undefined;

          // Match with gisLayers if shapefile-feature-
          if (idStr.startsWith('shapefile-feature-')) {
            const fullId = idStr.replace('shapefile-feature-', '');
            if (gisLayers && gisLayers.length > 0) {
              for (const l of gisLayers) {
                const prefix = `${l.id}-`;
                if (fullId.startsWith(prefix)) {
                  matchedLayerId = l.id;
                  matchedFeatureId = fullId.slice(prefix.length);
                  layerName = l.name || layerName;
                  sourceFile = l.name || sourceFile;
                  const feat = l.shapefileData?.features?.find((f: any) => String(f.id) === String(matchedFeatureId));
                  if (feat) {
                    matchedFeatureObj = feat;
                    if (feat.positions) featPositions = feat.positions;
                    if (feat.bounds) featBounds = feat.bounds;
                    if (feat.properties) {
                      featProperties = { ...featProperties, ...feat.properties };
                      if (feat.properties.LAYER || feat.properties.layer) {
                        layerName = String(feat.properties.LAYER || feat.properties.layer);
                      }
                    }
                  }
                  break;
                }
              }
            }

            if (!matchedLayerId && shapefileData) {
              const feat = shapefileData.features?.find((f: any) => String(f.id) === fullId);
              if (feat) {
                matchedFeatureObj = feat;
                if (feat.positions) featPositions = feat.positions;
                if (feat.bounds) featBounds = feat.bounds;
                layerName = shapefileName || 'Shapefile Layer';
                sourceFile = shapefileName || 'ESRI Shapefile';
                if (feat.properties) {
                  featProperties = { ...featProperties, ...feat.properties };
                }
              }
            }
          }

          // Geometry fallback if not found in matched feature
          if ((!featPositions || featPositions.length === 0) && entity.polygon) {
            try {
              const hier = entity.polygon.hierarchy?.getValue?.(viewer.clock.currentTime);
              if (hier && hier.positions && hier.positions.length > 0) {
                featPositions = hier.positions.map((c: Cesium.Cartesian3) => {
                  const carto = Cesium.Cartographic.fromCartesian(c);
                  return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)];
                });
              }
            } catch (_) {}
          } else if ((!featPositions || featPositions.length === 0) && entity.polyline) {
            try {
              const pts = entity.polyline.positions?.getValue?.(viewer.clock.currentTime);
              if (Array.isArray(pts) && pts.length > 0) {
                featPositions = pts.map((c: Cesium.Cartesian3) => {
                  const carto = Cesium.Cartographic.fromCartesian(c);
                  return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)];
                });
              }
            } catch (_) {}
          }

          const isDxf = Boolean(
            sourceFile.toLowerCase().endsWith('.dxf') ||
            layerName.toLowerCase().endsWith('.dxf') ||
            idStr.toLowerCase().includes('.dxf') ||
            featProperties.isCad ||
            featProperties.CAD ||
            featProperties.DXF ||
            (matchedLayerId && gisLayers?.find((l: any) => l.id === matchedLayerId)?.shapefileData?.isCad) ||
            shapefileData?.isCad
          );

          // Calculate approximate center coordinates for display
          let centerCoordinate: { latitude: number; longitude: number; height?: number } | undefined = undefined;
          let cartesianPos: Cesium.Cartesian3 | undefined = undefined;
          if (entity.position) {
            const rawPos = typeof entity.position.getValue === 'function' ? entity.position.getValue(viewer.clock.currentTime) : entity.position;
            if (rawPos && 'x' in (rawPos as any)) {
              cartesianPos = rawPos as Cesium.Cartesian3;
            }
          } else if (viewer.scene.pickPositionSupported) {
            cartesianPos = viewer.scene.pickPosition(movement.position);
          }
          if (cartesianPos) {
            const carto = Cesium.Cartographic.fromCartesian(cartesianPos);
            centerCoordinate = {
              latitude: Cesium.Math.toDegrees(carto.latitude),
              longitude: Cesium.Math.toDegrees(carto.longitude),
              height: carto.height
            };
          }

          // Capture screen coordinate and entity details via ContextMenuService
          contextMenuService.open({
            x: movement.position.x,
            y: movement.position.y,
            entity: entity,
            layerName: layerName,
            sourceFile: sourceFile,
            details: {
              entity,
              layerName,
              sourceFile,
              layerId: matchedLayerId,
              featureId: matchedFeatureId,
              isDxf,
              isCad: isDxf,
              hasTexture: Boolean(
                matchedLayerId
                  ? (gisLayers || []).find((l: any) => l.id === matchedLayerId)?.textureUrl || textureUrl
                  : textureUrl
              ),
              textureUrl: matchedLayerId
                ? (gisLayers || []).find((l: any) => l.id === matchedLayerId)?.textureUrl ?? textureUrl
                : textureUrl,
              textureName: matchedLayerId
                ? (gisLayers || []).find((l: any) => l.id === matchedLayerId)?.textureName ?? textureName
                : textureName,
              positions: featPositions,
              bounds: featBounds,
              properties: featProperties,
              centerCoordinate
            }
          });
          return;
        }
      }

      // If clicked on empty space, close context menu
      contextMenuService.close();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // Listen to camera movements to auto-close context menu
    const removeCameraMoveListener = viewer.camera.moveStart.addEventListener(() => {
      contextMenuService.close();
    });

    return () => {
      removeCameraMoveListener();
      handler.destroy();
    };
  }, [
    activeTool,
    isInitializing,
    gisLayers,
    shapefileData,
    polygonData,
    textureUrl,
    textureName,
    onActiveAnalysisCenterChange,
    onSolarPathRadiusChange,
    onSolarPathEnabledChange,
    onMeasureResultChange,
    isPickingLocation,
    importedLayers,
    onActiveLayerIdChange,
    currentLandmarks,
    onPOISelect
  ]);

  // ScreenSpaceEventHandler for double-clicking anywhere in the 3D viewport to fly to that location
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      if (!viewer || viewer.isDestroyed()) return;

      // Do not interrupt active tool drawing when a measurement or boundary tool is drawing
      if (activeTool !== 'none') return;

      let pickedCartesian: Cesium.Cartesian3 | undefined = undefined;

      if (viewer.scene.pickPositionSupported) {
        pickedCartesian = viewer.scene.pickPosition(click.position);
      }

      if (!Cesium.defined(pickedCartesian)) {
        const ray = viewer.camera.getPickRay(click.position);
        if (ray) {
          pickedCartesian = viewer.scene.globe.pick(ray, viewer.scene);
        }
      }

      if (!Cesium.defined(pickedCartesian)) {
        pickedCartesian = viewer.camera.pickEllipsoid(click.position);
      }

      if (Cesium.defined(pickedCartesian)) {
        const currentDist = Cesium.Cartesian3.distance(viewer.camera.position, pickedCartesian);
        const targetRange = Math.max(30, Math.min(currentDist * 0.35, 800));

        const heading = viewer.camera.heading;
        const pitch = viewer.camera.pitch < Cesium.Math.toRadians(-15) ? viewer.camera.pitch : Cesium.Math.toRadians(-45);

        viewer.camera.flyToBoundingSphere(
          new Cesium.BoundingSphere(pickedCartesian, 0),
          {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(heading, pitch, targetRange)
          }
        );

        const carto = Cesium.Cartographic.fromCartesian(pickedCartesian);
        const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
        const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
        const alt = carto.height.toFixed(1);
        onMeasureResultChange?.(`Flying to location: ${lat}°, ${lon}° (${alt}m elev)`);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return () => {
      handler.destroy();
    };
  }, [activeTool, isInitializing, onMeasureResultChange]);

  // Sync tree entities dynamically to the Cesium viewer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing) return;

    const treeEntityIds = new Set<string>();

    placedTrees.forEach((tree) => {
      const entityId = `tree-entity-${tree.id}`;
      treeEntityIds.add(entityId);

      let entity = viewer.entities.getById(entityId);
      if (!entity) {
        const position = Cesium.Cartesian3.fromDegrees(tree.longitude, tree.latitude, tree.height || 0);
        const heading = Cesium.Math.toRadians(tree.rotation || 0);
        const pitch = 0;
        const roll = 0;
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        viewer.entities.add({
          id: entityId,
          name: `Planted Tree (${tree.isScattered ? 'Scattered' : 'Manual'})`,
          position: position,
          orientation: orientation,
          model: {
            uri: treeModelUrl || 'https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb',
            scale: tree.scale || 1.0,
            colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
            colorBlendAmount: 0.0,
            shadows: Cesium.ShadowMode.ENABLED,
            lightColor: new Cesium.ConstantProperty(Cesium.Color.WHITE) as any,
            imageBasedLightingFactor: new Cesium.ConstantProperty(new Cesium.Cartesian2(0.8, 0.8)) as any,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        });
      } else {
        // Update the model URI if it changed
        if (entity.model) {
          entity.model.uri = (treeModelUrl || 'https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb') as any;
        }
      }
    });

    // Clean up entities of trees that were removed
    const allEntities = viewer.entities.values;
    const toRemove: Cesium.Entity[] = [];
    for (let i = 0; i < allEntities.length; i++) {
      const ent = allEntities[i];
      if (ent.id.startsWith('tree-entity-') && !treeEntityIds.has(ent.id)) {
        toRemove.push(ent);
      }
    }
    toRemove.forEach((ent) => {
      viewer.entities.remove(ent);
    });

    viewer.scene.requestRender();

  }, [placedTrees, treeModelUrl, isInitializing]);

  // Utility actions
  const handleZoom = (direction: 'in' | 'out') => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const factor = direction === 'in' ? 0.6 : 1.6;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * (1 - factor));
  };

  const handleResetNorth = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      viewer.scene.requestRender();
      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: 0.0, // North
          pitch: viewer.camera.pitch,
          roll: 0.0
        },
        duration: 1.0,
        complete: () => {},
        cancel: () => {}
      });
    } catch (e) {
      console.warn('handleResetNorth failed:', e);
    }
  };

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      viewer.scene.requestRender();
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 15000000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-90.0),
          roll: Cesium.Math.toRadians(0.0)
        },
        duration: 2.5,
        complete: () => {},
        cancel: () => {}
      });
    } catch (e) {
      console.warn('handleResetCamera failed:', e);
    }
  };

  const handleCaptureScreenshotForAI = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const canvas = viewer.scene.canvas;
    if (!canvas) return;

    let julianDate = viewer.clock.currentTime;
    // Ensure the clock and lighting match the current slider values exactly before rendering
    try {
      const baseDate = new Date(`${selectedDate}T12:00:00Z`);
      if (isNaN(baseDate.getTime())) {
        baseDate.setTime(new Date('2026-07-04T12:00:00Z').getTime());
      }
      const offsetMinutes = Math.round(timezoneOffset * 60);
      const totalLocalMinutes = Math.floor(sunHour * 60);
      const totalUtcMinutes = totalLocalMinutes - offsetMinutes;
      baseDate.setUTCHours(0, 0, 0, 0);
      baseDate.setUTCMinutes(totalUtcMinutes);

      julianDate = Cesium.JulianDate.fromDate(baseDate);
      viewer.clock.currentTime = julianDate;
      viewer.clock.shouldAnimate = false;
      
      // Update lighting synchronously
      updateLighting();
    } catch (err) {
      console.warn("Failed to synchronize time for AI screenshot:", err);
    }

    // Resolve target resolution based on selected export resolution state
    let targetWidth = 1920;
    let targetHeight = 1080;

    if (exportResolution === '2K') {
      targetWidth = 2560;
      targetHeight = 1440;
    } else if (exportResolution === '4K') {
      targetWidth = 3840;
      targetHeight = 2160;
    } else if (exportResolution === '8K') {
      targetWidth = 7680;
      targetHeight = 4320;
    }

    // Compute safe frame bounding box coordinates in CSS pixels for a perfect 16:9 aspect ratio
    const currentWidth = canvas.clientWidth;
    const currentHeight = canvas.clientHeight;
    const targetAspect = 16 / 9;
    const currentAspect = currentWidth / currentHeight;

    let frameWidth = currentWidth;
    let frameHeight = currentHeight;
    let startX = 0;
    let startY = 0;

    if (currentAspect > targetAspect) {
      // Screen is wider than 16:9
      frameHeight = currentHeight;
      frameWidth = currentHeight * targetAspect;
      startX = (currentWidth - frameWidth) / 2;
      startY = 0;
    } else {
      // Screen is taller than 16:9
      frameWidth = currentWidth;
      frameHeight = currentWidth / targetAspect;
      startX = 0;
      startY = (currentHeight - frameHeight) / 2;
    }

    // Compute scale factor S to map CSS safe frame width to target physical width
    const S = targetWidth / frameWidth;
    const originalResolutionScale = viewer.resolutionScale;

    try {
      // Force immediate render to ensure the canvas buffer is up to date
      viewer.clock.currentTime = julianDate;
      viewer.scene.render(julianDate);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const ctx = tempCanvas.getContext('2d');

      if (ctx && viewer.canvas && viewer.canvas.width > 0 && viewer.canvas.height > 0) {
        // Draw WebGL canvas directly onto scaled 16:9 target canvas
        ctx.drawImage(
          viewer.canvas,
          0,
          0,
          viewer.canvas.width,
          viewer.canvas.height,
          0,
          0,
          targetWidth,
          targetHeight
        );

        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.88);
        onAiScreenshotCaptured?.(dataUrl);
      } else {
        console.warn('Cesium canvas not ready for screenshot capture.');
      }
    } catch (e) {
      console.error('Failed to capture viewport screenshot for AI render:', e);
    }
  };

  const handleExportViewport = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const canvas = viewer.scene.canvas;
    if (!canvas) return;

    let julianDate = viewer.clock.currentTime;
    // Ensure the clock and lighting match the current slider values exactly before rendering
    try {
      const baseDate = new Date(`${selectedDate}T12:00:00Z`);
      if (isNaN(baseDate.getTime())) {
        baseDate.setTime(new Date('2026-07-04T12:00:00Z').getTime());
      }
      const offsetMinutes = Math.round(timezoneOffset * 60);
      const totalLocalMinutes = Math.floor(sunHour * 60);
      const totalUtcMinutes = totalLocalMinutes - offsetMinutes;
      baseDate.setUTCHours(0, 0, 0, 0);
      baseDate.setUTCMinutes(totalUtcMinutes);

      julianDate = Cesium.JulianDate.fromDate(baseDate);
      viewer.clock.currentTime = julianDate;
      viewer.clock.shouldAnimate = false;
      
      // Update lighting synchronously
      updateLighting();
    } catch (err) {
      console.warn("Failed to synchronize time for viewport export:", err);
    }

    // Resolve target resolution based on template selection
    let targetWidth = 3840;
    let targetHeight = 2160;

    if (exportResolution === '1K') {
      targetWidth = 1920;
      targetHeight = 1080;
    } else if (exportResolution === '2K') {
      targetWidth = 2560;
      targetHeight = 1440;
    } else if (exportResolution === '4K') {
      targetWidth = 3840;
      targetHeight = 2160;
    } else if (exportResolution === '8K') {
      targetWidth = 7680;
      targetHeight = 4320;
    }

    // Compute safe frame bounding box coordinates in CSS pixels
    const currentWidth = canvas.clientWidth;
    const currentHeight = canvas.clientHeight;
    const targetAspect = 16 / 9;
    const currentAspect = currentWidth / currentHeight;

    let frameWidth = currentWidth;
    let frameHeight = currentHeight;
    let startX = 0;
    let startY = 0;

    if (currentAspect > targetAspect) {
      // Screen is wider than 16:9
      frameHeight = currentHeight;
      frameWidth = currentHeight * targetAspect;
      startX = (currentWidth - frameWidth) / 2;
      startY = 0;
    } else {
      // Screen is taller than 16:9
      frameWidth = currentWidth;
      frameHeight = currentWidth / targetAspect;
      startX = 0;
      startY = (currentHeight - frameHeight) / 2;
    }

    // Compute scale factor S to map CSS safe frame width to target physical width
    const S = targetWidth / frameWidth;
    const originalResolutionScale = viewer.resolutionScale;

    try {
      // Temporarily scale resolution to high-fidelity target scale
      viewer.resolutionScale = S;

      // Force explicit redraw of 3D terrain, custom shapefiles, 3D trees, localized climate overlays, and shadows
      viewer.scene.render(julianDate);

      // Create an off-screen canvas to copy and crop the 16:9 high-fidelity frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const ctx = tempCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to create off-screen 2D canvas context');
      }

      // Extract the high-res frame matrix by cropping strictly to the safe frame zone
      ctx.drawImage(
        canvas,
        startX * S,
        startY * S,
        targetWidth,
        targetHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Trigger native download
      const dataUrl = tempCanvas.toDataURL('image/png');
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataUrl);
      downloadAnchor.setAttribute('download', `geosphere_viewport_${exportResolution}_${Date.now()}.png`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error('Failed to export high-resolution viewport image:', e);
    } finally {
      // Restore original resolution scale and redraw immediately
      viewer.resolutionScale = originalResolutionScale;
      viewer.scene.render(julianDate);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      onSwipePositionChange(percentage);
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const renderSafeFrameOverlay = () => {
    if (!showSafeFrame || containerSize.width === 0 || containerSize.height === 0) return null;

    const { width, height } = containerSize;
    const targetAspect = 16 / 9;
    const currentAspect = width / height;

    let maskStyleLeft: React.CSSProperties = {};
    let maskStyleRight: React.CSSProperties = {};
    let maskStyleTop: React.CSSProperties = {};
    let maskStyleBottom: React.CSSProperties = {};
    let frameStyle: React.CSSProperties = {};

    const isWider = currentAspect > targetAspect;

    if (isWider) {
      const frameWidth = height * targetAspect;
      const maskWidth = (width - frameWidth) / 2;

      maskStyleLeft = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${maskWidth}px`,
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 25,
      };

      maskStyleRight = {
        position: 'absolute',
        right: 0,
        top: 0,
        width: `${maskWidth}px`,
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 25,
      };

      frameStyle = {
        position: 'absolute',
        left: `${maskWidth}px`,
        top: 0,
        width: `${frameWidth}px`,
        height: '100%',
        border: '1.5px dashed #eab308',
        pointerEvents: 'none',
        zIndex: 25,
        boxShadow: '0 0 30px rgba(0,0,0,0.8) inset',
      };
    } else {
      const frameHeight = width / targetAspect;
      const maskHeight = (height - frameHeight) / 2;

      maskStyleTop = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: `${maskHeight}px`,
        backgroundColor: 'rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 25,
      };

      maskStyleBottom = {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: '100%',
        height: `${maskHeight}px`,
        backgroundColor: 'rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 25,
      };

      frameStyle = {
        position: 'absolute',
        left: 0,
        top: `${maskHeight}px`,
        width: '100%',
        height: `${frameHeight}px`,
        border: '1.5px dashed #eab308',
        pointerEvents: 'none',
        zIndex: 25,
        boxShadow: '0 0 30px rgba(0,0,0,0.8) inset',
      };
    }

    return (
      <div id="safe-frame-overlay" className="absolute inset-0 pointer-events-none z-25">
        {isWider ? (
          <>
            <div style={maskStyleLeft} />
            <div style={maskStyleRight} />
          </>
        ) : (
          <>
            <div style={maskStyleTop} />
            <div style={maskStyleBottom} />
          </>
        )}
        <div style={frameStyle}>
          <div className="absolute top-3 right-4 px-2.5 py-1 bg-slate-950/90 border border-yellow-500/40 rounded-lg text-[9px] font-mono font-bold text-yellow-400 tracking-wider uppercase select-none shadow-2xl flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span>{exportResolution} Safe Frame (16:9)</span>
          </div>
        </div>
      </div>
    );
  };

  // Parametric Massing Tool Refs & Effects
  const massingPositionsRef = useRef<Cesium.Cartesian3[]>([]);
  const parametricMassingEntityRef = useRef<Cesium.Entity | null>(null);
  const parametricMassingEntitiesRef = useRef<Cesium.Entity[]>([]);
  const massingFloorEntitiesMapRef = useRef<Map<string, Cesium.Entity[]>>(new Map());

  // Zoom to the extruded massing building
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || isInitializing || flyToMassingTrigger === 0) return;
    
    if (activeLayerId) {
      const selectedEntity = modelEntitiesMapRef.current.get(activeLayerId);
      if (selectedEntity) {
        viewer.zoomTo(selectedEntity);
        return;
      }
    }

    if (parametricMassingEntityRef.current) {
      viewer.zoomTo(parametricMassingEntityRef.current);
    }
  }, [flyToMassingTrigger, isInitializing, activeLayerId]);

  const updateExtrudedBuilding = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (parametricMassingEntitiesRef.current.length > 0) {
      parametricMassingEntitiesRef.current.forEach(e => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.entities.remove(e);
        }
      });
      parametricMassingEntitiesRef.current = [];
    }
    if (parametricMassingEntityRef.current) {
      if (viewer && !viewer.isDestroyed()) viewer.entities.remove(parametricMassingEntityRef.current);
      parametricMassingEntityRef.current = null;
    }

    if (massingPositionsRef.current.length < 3) return;

    try {
      const cartographics = massingPositionsRef.current.map(p => Cesium.Cartographic.fromCartesian(p));
      const minHeight = Math.min(...cartographics.map(c => c.height));
      const storeyHeight = massingFloorHeight || 3.5;
      const height = minHeight + massingFloors * storeyHeight;

      const serializedPositions = cartographics.map(c => ({
        lat: Cesium.Math.toDegrees(c.latitude),
        lon: Cesium.Math.toDegrees(c.longitude),
        height: c.height
      }));
      const centerLat = serializedPositions.reduce((sum, p) => sum + p.lat, 0) / serializedPositions.length;
      const centerLon = serializedPositions.reduce((sum, p) => sum + p.lon, 0) / serializedPositions.length;
      const labelPosition = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height);

      const getZoningNameFromColor = (color: string): string => {
        const hex = color.toLowerCase();
        if (hex === '#ffffff' || hex === '#fff') return 'Conceptual';
        if (hex === '#f59e0b') return 'Residential';
        if (hex === '#ef4444') return 'Commercial';
        if (hex === '#8b5cf6') return 'Mixed-Use';
        if (hex === '#6b7280') return 'Industrial';
        if (hex === '#3b82f6') return 'Institutional';
        if (hex === '#10b981') return 'Open Space';
        return 'Custom';
      };

      const zone = getZoningNameFromColor(massingColor);
      const finalArea = calculateArea(massingPositionsRef.current);
      const gfa = finalArea * massingFloors;
      const labelText = `Zone: ${zone}\nGFA: ${gfa.toLocaleString(undefined, {maximumFractionDigits: 0})} sqm\nHeight: ${(massingFloors * storeyHeight).toFixed(1)}m (${massingFloors} Fl)`;

      const entityConfig: any = {
        id: 'parametric-massing-extrusion',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(massingPositionsRef.current),
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString(massingColor).withAlpha(massingOpacity) // Dynamic volumetric form opacity
          ),
          height: minHeight,
          extrudedHeight: height,
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(massingColor).withAlpha(Math.min(1.0, massingOpacity + 0.2)), // Matching bright outline
          outlineWidth: 2.0,
          shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED
        }
      };

      if (showMassingLabels) {
        entityConfig.position = labelPosition;
        entityConfig.label = {
          text: labelText,
          font: 'bold 11px "Inter", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -15),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        };
      }

      const massingEntity = viewer.entities.add(entityConfig);
      parametricMassingEntityRef.current = massingEntity;
      const addedEntities: Cesium.Entity[] = [massingEntity];

      // Draw Storey / Level Outline Polylines & Floor Tags
      const tagStep = massingFloors <= 12 ? 1 : massingFloors <= 30 ? 5 : 10;

      for (let f = 0; f <= massingFloors; f++) {
        const levelElevation = minHeight + f * storeyHeight;
        const levelPositions = cartographics.map(c => {
          const dLat = c.latitude - Cesium.Math.toRadians(centerLat);
          const dLon = c.longitude - Cesium.Math.toRadians(centerLon);
          const offLat = c.latitude + dLat * 0.001;
          const offLon = c.longitude + dLon * 0.001;
          return Cesium.Cartesian3.fromRadians(offLon, offLat, levelElevation);
        });
        levelPositions.push(levelPositions[0]);

        const isRoof = (f === massingFloors);
        const isGround = (f === 0);

        const currentLevelColor = massingLevelColor || '#808080';
        const floorPolyline = viewer.entities.add({
          id: `parametric-massing-floor-${f}`,
          polyline: {
            positions: levelPositions,
            width: isRoof || isGround ? 2.5 : 2.0,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString(currentLevelColor).withAlpha(isRoof ? 0.95 : 0.8)
            ),
            clampToGround: false
          }
        });
        addedEntities.push(floorPolyline);

        if (showMassingLabels && (f === 1 || f === massingFloors || (f % tagStep === 0 && f > 0))) {
          const tagEntity = viewer.entities.add({
            id: `parametric-massing-floor-tag-${f}`,
            position: levelPositions[0],
            label: {
              text: f === massingFloors ? `FL ${f} (Roof)` : `FL ${f}`,
              font: 'bold 9px "Inter", sans-serif',
              fillColor: Cesium.Color.fromCssColorString('#ffffff'),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2.5,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(12, 0),
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          addedEntities.push(tagEntity);
        }
      }

      parametricMassingEntitiesRef.current = addedEntities;
      viewer.scene.requestRender();
    } catch (err) {
      console.error('Failed to create parametric massing entity:', err);
    }
  };

  // Real-time update of extruded massing when floors, floor height, color, opacity, or showMassingLabels changes
  useEffect(() => {
    updateExtrudedBuilding();
  }, [massingFloors, massingFloorHeight, massingColor, massingOpacity, massingLevelColor, showMassingLabels, sunShadowsEnabled, rtxUltraEnabled]);

  // Find active visible choropleth layer and calculate legend limits
  const choroplethLayer = (gisLayers || []).find((l: any) => l.visible && l.visualizationMode === 'choropleth');
  let legendMin = 0;
  let legendMax = 0;
  let legendAttr = '';
  let minColor = '#FF5733';
  let maxColor = '#00E676';

  if (choroplethLayer) {
    legendAttr = choroplethLayer.choroplethAttribute || selectedMetric;
    minColor = choroplethLayer.choroplethMinColor || '#FF5733';
    maxColor = choroplethLayer.choroplethMaxColor || '#00E676';
    const sData = choroplethLayer.shapefileData;
    if (sData && sData.features && sData.features.length > 0) {
      let minVal = Infinity;
      let maxVal = -Infinity;
      sData.features.forEach((feat: any) => {
        const val = Number(feat.properties[legendAttr]) || 0;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      });
      if (minVal !== Infinity) legendMin = minVal;
      if (maxVal !== -Infinity) legendMax = maxVal;
      if (legendMin === legendMax) legendMax = legendMin + 1;
    }
  }

  const valMin = legendMin.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const val33 = (legendMin + 0.33 * (legendMax - legendMin)).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const val66 = (legendMin + 0.67 * (legendMax - legendMin)).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const valMax = legendMax.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return (
    <div id="globe-viewport-container" className="relative w-full h-screen overflow-hidden bg-slate-950">
      {/* 16:9 Safe Frame Screen Overlay */}
      {renderSafeFrameOverlay()}

      {/* Global Viewport Drag-and-Drop Ingestion Zone */}
      <ViewportDropZone
        viewer={viewerInstance || viewerRef.current}
        container={containerRef.current}
        boundaryCenter={boundaryCenter}
        workspaceOrigin={workspaceOrigin}
        selectedCrs={selectedCrs}
        polygonData={polygonData}
        gisLayers={gisLayers}
        textureUrl={textureUrl}
        textureName={textureName}
        onTextureUrlChange={onTextureUrlChange}
        onLayerTextureChange={onLayerTextureChange}
        onPolygonDataChange={onPolygonDataChange}
        onAddGisLayer={onAddGisLayer}
        onModelUrlChange={onModelUrlChange}
        onModelLatitudeChange={onModelLatitudeChange}
        onModelLongitudeChange={onModelLongitudeChange}
        onModelHeightChange={onModelHeightChange}
        onLocalVectorChange={onLocalVectorChange}
        onIsPickingLocationChange={onIsPickingLocationChange}
      />

      {/* Cinematic Path & Recorder Status Overlays */}
      {!isInitializing && !errorMsg && localIsRecording && (
        <div className={`absolute top-16 z-30 flex items-center gap-2 px-3 py-1.5 bg-red-950/90 border border-red-500/40 rounded-lg text-[10px] font-mono font-bold text-red-400 shadow-lg tracking-wider uppercase animate-pulse ${
          isDrawerMode ? 'left-3.5 sm:left-4' : 'left-3 sm:left-4'
        }`}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
          <span>● Recording {videoExportResolution === '4k' ? '4K UHD' : '1080p FHD'} WebM Stream</span>
        </div>
      )}

      {!isInitializing && !errorMsg && localIsPlaying && !localIsRecording && (
        <div className={`absolute top-16 z-30 flex items-center gap-2 px-3 py-1.5 bg-blue-950/90 border border-blue-500/40 rounded-lg text-[10px] font-mono font-bold text-blue-400 shadow-lg tracking-wider uppercase ${
          isDrawerMode ? 'left-3.5 sm:left-4' : 'left-3 sm:left-4'
        }`}>
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span>▶ Playing Cinematic Path</span>
        </div>
      )}

      {/* Interactive Model Placement HUD Indicator */}
      {!isInitializing && !errorMsg && isPickingLocation && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 bg-slate-950/90 border border-amber-500/50 rounded-xl px-4 py-2 text-xs font-mono text-amber-300 shadow-2xl backdrop-blur-md animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-semibold text-white">Place Model:</span>
          <span>Move cursor to position &bull; Left-click to place &bull; Right-click to cancel</span>
        </div>
      )}

      {/* Loading Overlay */}
      {isInitializing && (
        <div id="loading-spinner" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-slate-800 border-b-emerald-400 animate-spin-reverse" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-200">Initializing WebGL Canvas</h3>
            <p className="text-xs text-slate-500 mt-1">Downloading Cesium tilesets and terrain meshes...</p>
          </div>
        </div>
      )}

      {/* Floating Measurement Toolbar in Viewport */}
      {!isInitializing && !errorMsg && (
        <ViewportToolbar
          sidebarTheme={sidebarTheme}
          activeTool={activeTool}
          onActiveToolChange={onActiveToolChange}
          onCleanupMeasurements={cleanupMeasurements}
          hasShapefile={Boolean(shapefileData || (gisLayers && gisLayers.length > 0))}
          isParcelStyleOpen={isParcelStyleOpen}
          onToggleParcelStyle={handleToggleParcelStyle}
          isArcGisImageryOpen={isArcGisImageryOpen}
          onToggleArcGisImagery={handleToggleArcGisImagery}
        />
      )}

      {/* Floating Save/Load Project & Layers Persistence Toolbar */}
      {!isInitializing && !errorMsg && (
        <SaveLoadToolbar
          sidebarTheme={sidebarTheme}
          isDrawerMode={isDrawerMode}
          gisLayers={gisLayers}
          globeState={globeState}
          placedTrees={placedTrees}
          treeModelUrl={treeModelUrl}
          modelData={{
            url: modelUrl || null,
            name: modelName || null,
            latitude: modelLatitude,
            longitude: modelLongitude,
            height: modelHeight,
            heading: modelHeading,
            pitch: modelPitch,
            roll: modelRoll,
            clampToTerrain: modelClampToTerrain
          }}
          getCurrentCamera={getCurrentCamera}
          onRestoreCamera={handleRestoreCamera}
          onRestoreProject={onRestoreProject}
          onRestoreLayer={handleRestoreStoredLayer}
          onGisLayersChange={onGisLayersChange}
        />
      )}

      {/* View Corridor Info Card Overlay */}
      {viewCorridorResult && (
        <div 
          id="view-corridor-card" 
          className={`absolute bottom-6 left-6 z-30 w-80 p-4 rounded-xl shadow-2xl space-y-3 transition-all duration-300 ${
            sidebarTheme === 'light'
              ? 'sidebar-theme-light bg-white/95 text-slate-900 border border-slate-200'
              : 'bg-slate-950/90 border border-slate-800 backdrop-blur-md'
          }`}
        >
          <div className={`flex items-center justify-between border-b pb-2 ${
            sidebarTheme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
          }`}>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-rose-500 animate-pulse" />
              <span className={`text-xs font-bold tracking-wider uppercase font-mono ${
                sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-200'
              }`}>View Corridor Result</span>
            </div>
            <button
              onClick={() => {
                setViewCorridorResult(null);
                cleanupMeasurements();
              }}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer ${
                sidebarTheme === 'light' ? 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100' : 'text-slate-400 hover:text-white bg-slate-900 border-slate-800'
              }`}
            >
              Close
            </button>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Distance:</span>
              <span className="text-slate-200 font-bold">{viewCorridorResult.distance.toFixed(1)} m</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Line Status:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                viewCorridorResult.status === 'Clear' 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {viewCorridorResult.status}
              </span>
            </div>

            <div className="border-t border-slate-900 pt-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Observer Ht (A):</span>
                <span className="text-slate-300">{viewCorridorResult.observerHeight.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Ht (B):</span>
                <span className="text-slate-300">{viewCorridorResult.targetHeight.toFixed(1)} m</span>
              </div>
            </div>

            {viewCorridorResult.status === 'Blocked' && viewCorridorResult.obstructionHeight !== undefined && (
              <div className="border-t border-red-950/40 bg-red-950/20 p-2.5 rounded-lg border border-red-500/20 space-y-1">
                <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold">Obstruction Telemetry</div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Obstruction Ht:</span>
                  <span className="text-red-400 font-bold">{viewCorridorResult.obstructionHeight.toFixed(1)} m</span>
                </div>
                {viewCorridorResult.obstructionDistance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Distance from Obs:</span>
                    <span className="text-red-300">{viewCorridorResult.obstructionDistance.toFixed(1)} m</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setViewCorridorResult(null);
              cleanupMeasurements();
            }}
            className="w-full py-2 bg-rose-950/80 border border-rose-500/40 hover:bg-rose-900/60 rounded-lg text-xs font-mono font-bold text-rose-400 tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear View Analysis</span>
          </button>
        </div>
      )}

      {/* Floating CAD Ortho & Numeric Length Input HUD */}
      {['area', 'parametric-massing', 'subsurface-excavation', 'boundary', 'distance'].includes(activeTool) && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md rounded-xl px-3.5 py-2 font-mono text-xs text-slate-200">
          {/* Ortho Mode Toggle Button */}
          <button
            onClick={() => {
              orthoModeRef.current = !orthoModeRef.current;
              setIsOrthoMode(orthoModeRef.current);
              if (viewerRef.current) viewerRef.current.scene.requestRender();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
              isOrthoMode
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Toggle Ortho Snapping (F8): constrain lines to 90° angles relative to previous segment"
          >
            <span className={`w-2 h-2 rounded-full ${isOrthoMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>ORTHO: {isOrthoMode ? 'ON' : 'OFF'}</span>
            <span className="text-[10px] opacity-60 bg-slate-900 px-1 py-0.5 rounded border border-slate-700 ml-0.5">F8</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          {/* Numeric length input indicator */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Segment Length:</span>
            {typedLengthStr ? (
              <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 rounded-lg text-amber-300 font-bold">
                <span className="animate-pulse">⌨️</span>
                <span className="text-sm">{typedLengthStr} m</span>
                <span className="text-[9px] bg-amber-500/30 px-1.5 py-0.5 rounded text-amber-200">Press Enter ↵</span>
                <button
                  onClick={() => setTypedLengthStr('')}
                  className="text-amber-400/60 hover:text-amber-200 ml-1 text-xs"
                  title="Clear typed length"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="text-slate-400 text-[11px] italic">
                {clickedPositionsRef.current.length > 0
                  ? 'Type numbers for exact length (e.g. 25.5)'
                  : 'Click 1st point on map to start'}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Cancel button */}
          <button
            onClick={() => {
              setTypedLengthStr('');
              onActiveToolChange('none');
              cleanupMeasurements();
            }}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            title="Cancel Drawing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Measurement Tooltip Tracker */}
      {floatingMarker && floatingMarker.text && floatingMarker.visible && (
        <div 
          id="floating-measurement-marker"
          className="absolute z-30 pointer-events-none select-none bg-slate-950/90 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-sm flex items-center gap-1.5"
          style={{ 
            left: `${floatingMarker.x}px`, 
            top: `${floatingMarker.y - 45}px`,
            transform: 'translateX(-50%)' 
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>{floatingMarker.text}</span>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div id="error-alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-md text-rose-300 flex flex-col items-center gap-3">
            <ShieldAlert className="w-12 h-12 text-rose-400 animate-bounce" />
            <h3 className="text-lg font-bold">Failed to Initialize 3D Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
            <div className="text-[11px] bg-slate-900 text-slate-500 p-2.5 rounded border border-slate-800 font-mono mt-2">
              Verify WebGL is enabled in your browser settings or try restarting the development server.
            </div>
          </div>
        </div>
      )}

      {/* Actual Cesium Container */}
      <div 
        ref={containerRef} 
        id="cesium-container" 
        className={`w-full h-full ${viewportCursorClass}`} 
      />

      {/* Shapefile hover demographic tooltip */}
      {hoveredTooltip && (
        <div 
          id="shapefile-hover-tooltip"
          className="absolute z-50 pointer-events-none bg-slate-950/95 border border-white/10 rounded-xl px-3.5 py-2.5 shadow-xl text-xs backdrop-blur-md max-w-xs transition-all duration-100 font-sans"
          style={{ 
            left: `${hoveredTooltip.x + 15}px`, 
            top: `${hoveredTooltip.y + 15}px`,
            transform: 'translate(0, 0)'
          }}
        >
          <div className="font-bold text-slate-100 flex items-center gap-1.5 border-b border-white/5 pb-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {hoveredTooltip.label}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">{hoveredTooltip.metric}:</span>
              <span className="text-amber-300 font-bold font-mono">{hoveredTooltip.value}</span>
            </div>
            {Object.entries(hoveredTooltip.properties)
              .filter(([k]) => k !== hoveredTooltip.metric && typeof hoveredTooltip.properties[k] !== 'object' && k.toLowerCase() !== 'id')
              .slice(0, 3)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-[10px]">
                  <span className="text-slate-500 font-medium">{k}:</span>
                  <span className="text-slate-300 truncate max-w-[120px]">{String(v)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Overpass POI hover tooltip */}
      {hoveredPOITooltip && (
        <div
          id="poi-hover-tooltip"
          className="absolute z-50 pointer-events-none bg-slate-950/95 border border-rose-500/30 rounded-xl px-3.5 py-2.5 shadow-2xl text-xs backdrop-blur-md min-w-[200px] max-w-xs transition-all duration-75 font-sans animate-none"
          style={{
            left: `${hoveredPOITooltip.x}px`,
            top: `${hoveredPOITooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {/* Accent colored top line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] bg-gradient-to-r from-rose-500 to-amber-500 rounded-full" />
          
          <div className="font-bold text-slate-100 flex items-center gap-1.5 border-b border-white/5 pb-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="truncate max-w-[180px]">{hoveredPOITooltip.name}</span>
          </div>
          
          <div className="mt-1.5 space-y-1">
            <div className="flex justify-between items-center gap-4 text-[10px]">
              <span className="text-slate-400 font-medium uppercase tracking-wider font-mono text-[9px] bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/5">
                {hoveredPOITooltip.type}
              </span>
              {hoveredPOITooltip.coordinates && (
                <span className="text-slate-500 font-mono text-[9px]">{hoveredPOITooltip.coordinates}</span>
              )}
            </div>
          </div>
          
          {/* Subtle triangle indicator pointing down */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[6px] w-2.5 h-2.5 bg-slate-950 rotate-45 border-r border-b border-rose-500/30" />
        </div>
      )}

      {/* Split Screen Swipe HUD & Vertical Drag Handle */}
      {swipeEnabled && (
        <>
          {/* Context Indicators */}
          <div 
            id="existing-context-label" 
            className={`absolute top-[86px] left-4 z-10 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider pointer-events-none select-none shadow-md transition-all duration-300 flex items-center gap-1.5 ${
              sidebarTheme === 'light'
                ? 'sidebar-theme-light bg-white/95 text-slate-700 border border-slate-200'
                : 'bg-slate-950/85 border border-white/10 text-slate-300 backdrop-blur-sm'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            EXISTING CONTEXT
          </div>
          <div 
            id="proposed-plan-label" 
            className={`absolute top-4 right-44 z-10 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider pointer-events-none select-none shadow-md transition-all duration-300 flex items-center gap-1.5 ${
              sidebarTheme === 'light'
                ? 'bg-blue-50 border border-blue-200 text-blue-600'
                : 'bg-blue-950/85 border border-blue-500/20 text-blue-300 backdrop-blur-sm'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            PROPOSED VISION
          </div>

          {/* Swipe Divider and Handle */}
          <div 
            id="split-screen-slider-line"
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none"
            style={{ left: `${swipePosition}%` }}
          >
            <div 
              id="split-screen-slider-handle"
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-slate-900 border-2 border-white rounded-full shadow-2xl cursor-ew-resize pointer-events-auto flex items-center justify-center hover:bg-slate-800 hover:scale-105 active:scale-95 transition-transform"
              onPointerDown={handlePointerDown}
            >
              <ChevronsLeftRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </>
      )}

      {/* Viewport Camera Control Deck - Removed in favor of fixed vertical right sidebar */}

      {/* Bottom Coordinates & Integrated Camera controls Bar */}
      {!isInitializing && !errorMsg && (
        <div 
          id="bottom-coordinate-status-bar"
          className={`fixed bottom-0 left-0 right-0 min-h-[42px] flex items-center px-2 sm:px-4 md:px-6 justify-between text-[10px] sm:text-[11px] font-mono tracking-wider z-40 pointer-events-none transition-all duration-300 ${
            sidebarTheme === 'light'
              ? 'sidebar-theme-light bg-white/95 text-slate-600 border-t border-slate-200 shadow-lg'
              : 'bg-slate-950/90 backdrop-blur-md border-t border-white/10 text-slate-400'
          }`}
        >
          {/* Left: Latitude, Longitude, Altitude */}
          <div className={`flex items-center gap-2 sm:gap-4 md:gap-6 select-none pointer-events-none font-semibold ${
            sidebarTheme === 'light' ? 'text-slate-700' : 'text-slate-300'
          }`}>
            <span className="truncate">LAT: {cameraPos.lat.toFixed(4)}</span>
            <span className="truncate">LNG: {cameraPos.lng.toFixed(4)}</span>
            <span className="hidden sm:inline">ALT: {Math.round(cameraPos.alt)}m</span>
          </div>

          {/* Middle: Integrated Control Buttons (Horizontal & Centered) */}
          <div className={`flex items-center gap-1 sm:gap-1.5 p-1 pointer-events-auto shadow-inner rounded-xl border transition-colors duration-300 shrink-0 z-50 ${
            sidebarTheme === 'light'
              ? 'bg-slate-50/95 border-slate-200'
              : 'bg-slate-900/90 border-white/10'
          }`}>
            <button
              onClick={() => handleZoom('in')}
              title="Zoom In"
              className={`p-1.5 sm:p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                sidebarTheme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoom('out')}
              title="Zoom Out"
              className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                sidebarTheme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className={`w-[1px] h-4 self-center mx-0.5 ${
              sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-white/10'
            }`} />
            <button
              onClick={() => {
                const nextVal = !globeState.buildings3dEnabled;
                if (onGlobeStateChange) {
                  onGlobeStateChange(prev => ({ ...prev, buildings3dEnabled: nextVal }));
                }
                if (onToggleLayer) {
                  const osm = layers.find(l => l.id === 'osm-buildings');
                  if (osm && osm.enabled !== nextVal) {
                    onToggleLayer('osm-buildings');
                  }
                }
              }}
              title="Toggle 3D Buildings"
              className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                globeState.buildings3dEnabled
                  ? 'text-blue-500 hover:bg-blue-500/10'
                  : sidebarTheme === 'light'
                    ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/10'
              }`}
            >
              <Building className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (onGlobeStateChange) {
                  onGlobeStateChange(prev => ({ ...prev, terrainEnabled: !prev.terrainEnabled }));
                }
              }}
              title="Toggle Terrain Mesh"
              className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                globeState.terrainEnabled
                  ? 'text-blue-500 hover:bg-blue-500/10'
                  : sidebarTheme === 'light'
                    ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/10'
              }`}
            >
              <Mountain className="w-4 h-4" />
            </button>
            <div className={`w-[1px] h-4 self-center mx-0.5 ${
              sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-white/10'
            }`} />
            <button
              onClick={handleResetNorth}
              title="Orient North"
              className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                sidebarTheme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              <Compass className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetCamera}
              title="Reset Camera (Home)"
              className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                sidebarTheme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              <Home className="w-4 h-4 text-blue-500" />
            </button>
            <button
              onClick={handleExportViewport}
              title="Export Viewport (PNG)"
              className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent min-w-[32px] min-h-[32px] flex items-center justify-center ${
                sidebarTheme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              <Camera className="w-4 h-4 text-emerald-500" />
            </button>
          </div>

          {/* Right: Connection Status & FPS */}
          <div className="flex gap-2 sm:gap-3 md:gap-4 items-center select-none shrink-0">
            {isAuthSuspended ? (
              <div className={`flex items-center gap-1.5 pr-2 sm:pr-3 border-r pointer-events-auto ${
                sidebarTheme === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
              }`}>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 text-[9px] sm:text-[10px] font-mono font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="hidden sm:inline">Company Network Access (Unrestricted)</span>
                  <span className="sm:hidden">NET OK</span>
                </span>
              </div>
            ) : userEmail ? (
              <div className={`flex items-center gap-1.5 pr-2 sm:pr-3 border-r pointer-events-auto ${
                sidebarTheme === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
              }`}>
                {accountRole === 'developer' ? (
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-400/20 text-blue-400 text-[9px] sm:text-[10px] font-mono font-bold uppercase">DEV</span>
                    {onShow401Page && (
                      <button
                        type="button"
                        onClick={onShow401Page}
                        title="View 401 Unauthorized Error Page"
                        className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[9px] font-mono transition-colors cursor-pointer"
                      >
                        <ShieldAlert className="w-2.5 h-2.5" />
                        401_ERR
                      </button>
                    )}
                    {onToggleSimulateExpiry && (
                      <button
                        type="button"
                        onClick={onToggleSimulateExpiry}
                        title={simulateExpiry ? "Disable Expiry Simulation" : "Simulate Paywall/Expiry"}
                        className={`hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono transition-colors cursor-pointer ${
                          simulateExpiry 
                            ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30' 
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                        }`}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {simulateExpiry ? "EXPIRED" : "SIM_EXP"}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${daysRemaining !== undefined && daysRemaining > 5 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`}></span>
                    <span className="text-slate-300 hidden sm:inline">BETA: {daysRemaining !== undefined ? daysRemaining : 30}D</span>
                  </>
                )}
                {userEmail && (
                  <>
                    <span className="text-slate-600 hidden md:inline">|</span>
                    <span className="max-w-[100px] truncate text-slate-400 hidden md:inline" title={userEmail}>{userEmail}</span>
                  </>
                )}
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="Sign Out"
                    className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center ml-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                )}
              </div>
            ) : null}
            <span className="flex items-center gap-1 select-none pointer-events-none">
              <span className={`w-1.5 h-1.5 rounded-full ${isValidCesiumToken(token) ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
              <span className="hidden sm:inline">{isValidCesiumToken(token) ? "ION_CONNECTED" : "DEMO_MODE"}</span>
              <span className="sm:hidden">{isValidCesiumToken(token) ? "ION" : "DEMO"}</span>
            </span>
            <span className="select-none pointer-events-none hidden sm:inline">FPS: 60</span>
          </div>
        </div>
      )}

      {/* Floating Excavation Statistics Dashboard */}
      {!isInitializing && !errorMsg && localExcavationStats && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`absolute left-4 bottom-14 z-30 w-80 p-4 rounded-2xl shadow-2xl backdrop-blur-md border font-sans select-none transition-all duration-300 ${
            sidebarTheme === 'light'
              ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
              : 'bg-slate-950/90 border-orange-500/30 text-slate-100 shadow-orange-950/10'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/20 dark:border-white/10 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500">
                <HardHat className="w-4 h-4 animate-bounce" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 font-mono">Excavation Pit</h4>
                <p className="text-[10px] text-slate-400">Real-time subsurface calculations</p>
              </div>
            </div>
            <button
              onClick={cleanupExcavation}
              className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-rose-500 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
              title="Clear Excavation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {/* Surface Area */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              sidebarTheme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-white/5'
            }`}>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Surface Area</span>
              <span className={`text-sm font-bold font-mono mt-1 ${sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                {localExcavationStats.area.toFixed(1)} m²
              </span>
            </div>

            {/* Depth */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              sidebarTheme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-white/5'
            }`}>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Excavation Depth</span>
              <span className={`text-sm font-bold font-mono mt-1 ${sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                {localExcavationStats.depth.toFixed(1)} m
              </span>
            </div>

            {/* Shoring Perimeter */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              sidebarTheme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-white/5'
            }`}>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Shoring Perimeter</span>
              <span className={`text-sm font-bold font-mono mt-1 ${sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                {localExcavationStats.perimeter.toFixed(1)} m
              </span>
            </div>

            {/* Total Volume */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              sidebarTheme === 'light' ? 'bg-orange-50 border-orange-100/50' : 'bg-orange-950/20 border-orange-500/10'
            }`}>
              <span className="text-[9px] text-orange-500 font-medium uppercase tracking-wider">Total Volume</span>
              <span className="text-sm font-bold text-orange-500 font-mono mt-1">
                {localExcavationStats.volume.toFixed(1)} m³
              </span>
            </div>

            {/* Estimated Soil Weight */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              sidebarTheme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-white/5'
            }`}>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Spoils Weight</span>
              <span className={`text-sm font-bold font-mono mt-1 ${sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                ~{localExcavationStats.weight.toFixed(1)} t
              </span>
            </div>

            {/* Truckloads */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              sidebarTheme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-white/5'
            }`}>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Truckloads (12m³)</span>
              <span className={`text-sm font-bold font-mono mt-1 ${sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                {localExcavationStats.truckloads} trips
              </span>
            </div>
          </div>
          <div className={`mt-3 text-[10px] rounded-lg p-2 flex items-center gap-1.5 leading-normal text-left ${
            sidebarTheme === 'light'
              ? 'text-amber-700 bg-amber-50 border border-amber-100'
              : 'text-amber-500 bg-amber-500/5 border border-amber-500/10'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Underground utilities clippable & visualizable.</span>
          </div>
        </motion.div>
      )}



      {/* Viewport Top Left Combined HUD: North Compass & Time of Day Slider */}
      {!isInitializing && !errorMsg && (
        <motion.div 
          layout
          id="viewport-top-left-hud"
          className={`absolute top-3 sm:top-4 z-30 flex items-center transition-all duration-300 rounded-2xl shadow-2xl select-none ${
            isDrawerMode ? 'left-[118px] sm:left-[128px]' : 'left-3 sm:left-4'
          } ${
            isLowResHud ? 'p-1.5 gap-2 max-w-[calc(45vw-1rem)]' : isMediumResHud ? 'p-2 gap-3 max-w-[calc(48vw-1rem)]' : 'p-2.5 gap-4'
          } ${
            sidebarTheme === 'light'
              ? 'sidebar-theme-light bg-white/95 text-slate-900 border border-slate-200'
              : 'bg-slate-950/85 border border-white/10 text-slate-100 backdrop-blur-md'
          }`}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        >
          {isHudCollapsed ? (
            <button
              type="button"
              onClick={() => setIsHudCollapsed(false)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95 duration-150 border-0 bg-transparent ${
                sidebarTheme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title="Expand Time & Compass controls"
            >
              <div className="relative w-5 h-5 flex items-center justify-center">
                <Compass className="w-5 h-5 text-rose-500 absolute animate-pulse" style={{ transform: `rotate(${-cameraHeading}deg)` }} />
              </div>
              <Sun className="w-4 h-4 text-amber-500" />
              {!isLowResHud && (
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  sidebarTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>Controls</span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <div className={`flex items-center ${isLowResHud ? 'gap-2' : isMediumResHud ? 'gap-3' : 'gap-4'}`}>
              {/* Compass Segment */}
              <div 
                onClick={handleResetNorth}
                className="flex flex-col items-center gap-1 cursor-pointer group transition-all hover:scale-105 active:scale-95 shrink-0"
                title="Click to orient North"
              >
                {/* Compass Dial Outer Ring */}
                <div className={`relative rounded-full flex items-center justify-center shadow-inner ${
                  isLowResHud ? 'w-8 h-8' : isMediumResHud ? 'w-10 h-10' : 'w-12 h-12'
                } ${
                  sidebarTheme === 'light' ? 'border border-slate-200 bg-slate-50 hover:border-slate-300' : 'border border-slate-700/50 bg-slate-900/60 hover:border-slate-500/50'
                }`}>
                  {/* North Indicator Needle / Arrow */}
                  <div 
                    className="absolute inset-0 transition-transform duration-75 ease-out"
                    style={{ transform: `rotate(${-cameraHeading}deg)` }}
                  >
                    {/* Vertical line representing Compass Needle */}
                    <div className={`w-0.5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
                      isLowResHud ? 'h-5' : 'h-8'
                    } ${
                      sidebarTheme === 'light' ? 'bg-slate-300/60' : 'bg-slate-800/40'
                    }`} />
                    
                    {/* North Arrow (Red) */}
                    <div className={`w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-rose-500 absolute left-1/2 -translate-x-1/2 ${
                      isLowResHud ? 'border-b-[10px] top-1.5' : 'border-b-[14px] top-3'
                    }`} />
                    
                    {/* South Arrow (Silver/White) */}
                    <div className={`w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-slate-400 absolute left-1/2 -translate-x-1/2 ${
                      isLowResHud ? 'border-t-[10px] bottom-1.5' : 'border-t-[14px] bottom-3'
                    }`} />

                    {/* Cardinal Label N */}
                    <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-rose-500 leading-none">N</span>
                  </div>

                  {/* Pivot Point */}
                  <div className={`w-2 h-2 rounded-full border z-10 flex items-center justify-center ${
                    sidebarTheme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-950 border-white/20'
                  }`}>
                    <div className="w-0.5 h-0.5 rounded-full bg-rose-400" />
                  </div>
                </div>

                {/* Real-time heading display */}
                <div className={`text-[8px] sm:text-[9px] font-mono font-bold border rounded min-w-[28px] sm:min-w-[34px] text-center shadow-inner ${
                  sidebarTheme === 'light' ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-slate-300 bg-slate-900/80 border-white/5'
                }`}>
                  {Math.round((cameraHeading + 360) % 360)}°
                </div>
              </div>

              {/* Vertical Separator */}
              <div className={`w-[1px] self-center ${isLowResHud ? 'h-10' : 'h-14'} ${
                sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-white/10'
              }`} />

              {/* Time of Day Slider Segment */}
              <div className={`flex flex-col gap-1 transition-all duration-300 ${
                isVeryLowResHud 
                  ? 'w-[85px]' 
                  : isLowResHud 
                    ? 'w-[110px]' 
                    : isMediumResHud 
                      ? 'w-[160px]' 
                      : 'w-[220px]'
              }`}>
                {/* Header: Label, Play/Pause toggle, and Current Formatted Time */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                    {!isLowResHud && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        sidebarTheme === 'light' ? 'text-slate-600' : 'text-slate-300'
                      }`}>Time</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Play/Pause Button */}
                    <button
                      type="button"
                      onClick={() => setIsSunAnimating(!isSunAnimating)}
                      className={`p-1 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer border-0 ${
                        isSunAnimating 
                          ? 'bg-amber-500/25 text-amber-600 hover:bg-amber-500/35 ring-1 ring-amber-500/30' 
                          : sidebarTheme === 'light'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title={isSunAnimating ? "Pause Sun Animation" : "Play Sun Time-lapse"}
                    >
                      {isSunAnimating ? (
                        <Pause className="w-3 h-3 text-amber-600" />
                      ) : (
                        <Play className={`w-3 h-3 ${sidebarTheme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
                      )}
                    </button>
                    {/* Time Stamp */}
                    <span className={`text-[9px] sm:text-[10px] font-mono font-bold px-1 py-0.5 rounded border whitespace-nowrap ${
                      sidebarTheme === 'light' ? 'text-amber-600 bg-amber-500/5 border-amber-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {formatHour(sunHour)}
                    </span>
                  </div>
                </div>

                {/* Slider Track */}
                <div className="space-y-0.5 w-full">
                  <input
                    type="range"
                    min="0"
                    max="23.9"
                    step="0.1"
                    value={sunHour}
                    onChange={(e) => {
                      setIsSunAnimating(false);
                      onSunHourChange?.(parseFloat(e.target.value));
                    }}
                    className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none transition-all ${
                      sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-slate-800'
                    }`}
                  />
                  {!isLowResHud ? (
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono leading-none">
                      <span>12AM</span>
                      <span>6AM</span>
                      <span>12PM</span>
                      <span>6PM</span>
                      <span>12AM</span>
                    </div>
                  ) : isVeryLowResHud ? (
                    <div className="flex justify-between text-[7px] text-slate-500 font-mono leading-none">
                      <span>00</span>
                      <span>12</span>
                      <span>24</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[7px] text-slate-500 font-mono leading-none">
                      <span>12A</span>
                      <span>12P</span>
                      <span>12A</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vertical Separator (Hide on Low Res if space is tight) */}
              {!isLowResHud && (
                <>
                  <div className={`w-[1px] h-14 self-center ${
                    sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-white/10'
                  }`} />

                  {/* RTX Switch Segment */}
                  <div className="flex flex-col items-center justify-center gap-1.5 px-1 select-none pointer-events-auto shrink-0">
                    <span className="text-[8px] uppercase tracking-wider text-amber-500 font-mono font-bold leading-none">RTX</span>
                    <button
                      type="button"
                      onClick={() => onRtxUltraEnabledChange?.(!rtxUltraEnabled)}
                      title="Toggle RTX Ultra Fidelity Mode"
                      className={`w-7 h-4 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center border-0 ${
                        rtxUltraEnabled 
                          ? 'bg-amber-500 shadow shadow-amber-500/20' 
                          : sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full bg-white shadow transition-transform duration-300 ${rtxUltraEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-[7px] uppercase font-mono font-bold text-slate-500 tracking-wider leading-none">ULTRA</span>
                  </div>
                </>
              )}

              {/* Vertical Separator */}
              <div className={`w-[1px] self-center ${isLowResHud ? 'h-10' : 'h-14'} ${
                sidebarTheme === 'light' ? 'bg-slate-200' : 'bg-white/10'
              }`} />

              {/* Collapse Toggle Button */}
              <button
                type="button"
                onClick={() => setIsHudCollapsed(true)}
                className={`p-1 sm:p-1.5 rounded-xl flex items-center justify-center cursor-pointer border-0 transition-all active:scale-95 shrink-0 ${
                  sidebarTheme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Collapse controls"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Data Classification Legend */}
      {(gisLayers || []).some((l: any) => l.visible && l.showLegend) && (
        <div
          id="data-classification-legend"
          className={`absolute bottom-14 left-4 z-30 w-72 p-4 rounded-xl shadow-2xl space-y-3.5 pointer-events-auto transition-all duration-300 ${
            sidebarTheme === 'light'
              ? 'sidebar-theme-light bg-white/95 text-slate-900 border border-slate-200'
              : 'bg-slate-950/90 border border-slate-800 backdrop-blur-md'
          }`}
        >
          <div className={`flex items-center gap-1.5 border-b pb-2 ${
            sidebarTheme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
          }`}>
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span className={`text-xs font-bold tracking-wider uppercase font-mono ${
              sidebarTheme === 'light' ? 'text-slate-800' : 'text-slate-200'
            }`}>
              Vector & Analytics Legend
            </span>
          </div>

          {(() => {
            if (choroplethLayer && choroplethLayer.showLegend) {
              return (
                <div className={`space-y-1.5 border-b pb-2.5 ${
                  sidebarTheme === 'light' ? 'border-slate-200' : 'border-slate-800/50'
                }`}>
                  <div className="text-[10px] text-slate-400 font-mono flex justify-between items-center">
                    <span>CHOROPLETH ANALYTICS:</span>
                    <span className="text-blue-500 font-bold uppercase">{legendAttr}</span>
                  </div>

                  {/* Smooth color gradient bar stretching between user's chosen hex colors */}
                  <div 
                    style={{ background: `linear-gradient(to right, ${minColor}, ${maxColor})` }} 
                    className="h-3.5 w-full rounded-md shadow-inner border border-white/5" 
                  />

                  {/* Interval labels */}
                  <div className="flex justify-between text-[9px] font-mono text-slate-400 pt-1">
                    <div className="flex flex-col items-start w-1/4">
                      <span className={`font-bold ${sidebarTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{valMin}</span>
                      <span className="text-[7px] text-slate-500">MIN</span>
                    </div>
                    <div className="flex flex-col items-center w-1/4 text-center">
                      <span className={`font-bold ${sidebarTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{val33}</span>
                      <span className="text-[7px] text-slate-500">33%</span>
                    </div>
                    <div className="flex flex-col items-center w-1/4 text-center">
                      <span className={`font-bold ${sidebarTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{val66}</span>
                      <span className="text-[7px] text-slate-500">66%</span>
                    </div>
                    <div className="flex flex-col items-end w-1/4 text-right">
                      <span className={`font-bold ${sidebarTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{valMax}</span>
                      <span className="text-[7px] text-slate-500">MAX</span>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* List of active visible vector layers styled ledger */}
          <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {(gisLayers || []).filter((l: any) => l.visible && l.showLegend).map((l: any) => {
              const isLine = l.geometryType === 'polyline' || l.shapefileData?.features?.[0]?.isLine;
              const isCad = l.shapefileData?.isCad || l.name?.toLowerCase().endsWith('.dxf');
              const styleColor = l.customColor || (isCad ? '#000000' : '#3b82f6');
              const styleAlpha = l.customAlpha !== undefined ? l.customAlpha : 1.0;
              
              return (
                <div key={l.id} className={`text-[10px] font-mono space-y-1 border-t pt-2 first:border-t-0 first:pt-0 ${
                  sidebarTheme === 'light' ? 'border-slate-100' : 'border-white/5'
                }`}>
                  <div className={`flex items-center justify-between gap-2 ${
                    sidebarTheme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    <span className="truncate max-w-[170px] font-semibold">{l.name}</span>
                    {isCad && (
                      <span className="text-[8px] bg-sky-500/15 text-sky-500 px-1 rounded border border-sky-500/20 font-bold">CAD</span>
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    sidebarTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-white/5'
                  }`}>
                    <div className={`w-12 h-6 shrink-0 flex items-center justify-center rounded border overflow-hidden ${
                      sidebarTheme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950/80 border-white/10'
                    }`}>
                      {isLine ? (
                        <div 
                          style={{
                            width: '100%',
                            height: `${Math.min(6, l.lineWidth || 3)}px`,
                            backgroundColor: styleColor,
                            opacity: styleAlpha,
                            borderStyle: l.lineType === 'Dashed' ? 'dashed' : 'solid',
                            borderWidth: l.lineType === 'Dashed' ? '2px' : '0px',
                            borderColor: l.lineType === 'Dashed' ? styleColor : 'transparent',
                            boxShadow: l.lineType === 'Glowing Vector' ? `0 0 8px ${styleColor}` : 'none'
                          }}
                        />
                      ) : (
                        <div 
                          style={{
                            width: '24px',
                            height: '14px',
                            backgroundColor: styleColor,
                            opacity: styleAlpha,
                            borderRadius: '2px',
                            border: `1.5px solid ${styleColor}`
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-[9px] text-slate-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="text-slate-300 capitalize">{isLine ? 'Polyline' : 'Polygon'}</span>
                      </div>
                      {isLine ? (
                        <>
                          <div className="flex justify-between">
                            <span>Width:</span>
                            <span className="text-slate-300 font-bold">{l.lineWidth || 3}px</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pattern:</span>
                            <span className="text-slate-300 font-bold">{l.lineType || 'Solid'}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span>Color:</span>
                          <span className="text-slate-300 font-bold" style={{ color: styleColor }}>{styleColor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Selected Object Attribute Panel (Lower Right Corner) */}
      {!isInitializing && !errorMsg && pickedAssetMetadata && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          id="selected-object-attribute-panel"
          className={`absolute bottom-14 right-4 z-40 w-80 max-h-[380px] p-4 rounded-2xl shadow-2xl backdrop-blur-md border font-sans select-none transition-all duration-300 flex flex-col pointer-events-auto ${
            sidebarTheme === 'light'
              ? 'sidebar-theme-light bg-white/95 text-slate-900 border-slate-200 shadow-slate-300/50'
              : 'bg-slate-950/90 text-slate-100 border-blue-500/30 shadow-blue-950/20'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b pb-2.5 mb-2.5 ${
            sidebarTheme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 font-mono">
                  Object Attributes
                </h4>
                <p className={`text-[10px] truncate max-w-[180px] font-mono ${
                  sidebarTheme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-300'
                }`} title={pickedAssetMetadata?.name || ''}>
                  {pickedAssetMetadata?.name || ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (pickedAssetMetadata) onPickedAssetMetadataChange?.(null);
              }}
              className={`p-1 rounded-lg transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0 ${
                sidebarTheme === 'light' 
                  ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' 
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
              title="Deselect & Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Attributes Grid/List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 text-left scrollbar-thin scrollbar-thumb-white/10">
            {(() => {
              const attrs = pickedAssetMetadata?.attributes || {};
              const entries = Object.entries(attrs).filter(([k, v]) => v !== undefined && v !== null && k !== 'positions');
              if (entries.length === 0) {
                return (
                  <div className="text-[10px] text-slate-400 italic text-center py-4 font-mono">
                    No additional attributes attached to selected object.
                  </div>
                );
              }
              return entries.map(([key, value]) => (
                <div 
                  key={key} 
                  className={`flex items-start justify-between gap-3 text-[10px] font-mono py-1 px-2 rounded border transition-colors ${
                    sidebarTheme === 'light'
                      ? 'bg-slate-50 border-slate-100 text-slate-700'
                      : 'bg-slate-900/60 border-white/5 text-slate-300'
                  }`}
                >
                  <span className="text-slate-400 font-medium shrink-0 max-w-[110px] truncate" title={key}>{key}</span>
                  <span 
                    className={`text-right break-all max-w-[160px] font-bold ${
                      sidebarTheme === 'light' ? 'text-blue-700' : 'text-blue-300'
                    }`}
                    title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  >
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ));
            })()}
          </div>
        </motion.div>
      )}
      {/* Floating Multi-Selection HUD Banner */}
      {!isInitializing && !errorMsg && selectedLayerIds && selectedLayerIds.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 text-xs text-white"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="font-bold font-mono text-amber-300">
              {selectedLayerIds.length} Objects Selected
            </span>
            <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
              (CTRL + Click to toggle)
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          <button
            type="button"
            onClick={() => onActiveLayerIdChange?.(null, false)}
            className="text-[10px] text-slate-300 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer border-0"
          >
            Deselect All
          </button>

          <button
            type="button"
            onClick={() => onDeleteLayer?.('')}
            className="text-[10px] text-red-300 hover:text-red-100 bg-red-600/30 hover:bg-red-600/50 px-3 py-1 rounded-full font-bold flex items-center gap-1 border border-red-500/40 transition-colors cursor-pointer"
            title="Delete all selected objects or press DEL key"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete ({selectedLayerIds.length})
          </button>
        </motion.div>
      )}

      {/* CAD / GIS Interactive Right-Click Context Menu */}
      {!isInitializing && !errorMsg && (
        <ContextMenu
          viewer={viewerInstance}
          gisLayers={gisLayers}
          importedLayers={importedLayers}
          clippingMode={clippingMode}
          theme={sidebarTheme === 'light' ? 'light' : 'dark'}
          textureUrl={textureUrl}
          textureName={textureName}
          onClearTexture={() => onTextureUrlChange?.(null, null)}
          onTextureUrlChange={onTextureUrlChange}
          onLayerTextureChange={onLayerTextureChange}
          onDeleteLayer={onDeleteLayer}
          onDeleteFeature={onDeleteFeature}
          onUpdateLayerStyle={onUpdateGisLayerStyle}
          onImportedLayersChange={onImportedLayersChange}
          onClippingModeChange={onClippingModeChange}
          onActiveLayerIdChange={onActiveLayerIdChange}
          onLocateLayer={onLocateGisLayer}
          onSelectFeature={(ent, meta) => {
            if (meta) {
              onPickedAssetMetadataChange?.(meta);
            }
          }}
        />
      )}

    </div>
  );
}

// Spatial measurement utility calculations
function calculateDistance(positions: Cesium.Cartesian3[]): number {
  let total = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    const carto1 = Cesium.Cartographic.fromCartesian(positions[i]);
    const carto2 = Cesium.Cartographic.fromCartesian(positions[i + 1]);
    
    const lon1 = carto1.longitude * 180 / Math.PI;
    const lat1 = carto1.latitude * 180 / Math.PI;
    const lon2 = carto2.longitude * 180 / Math.PI;
    const lat2 = carto2.latitude * 180 / Math.PI;
    
    // Haversine formula
    const R = 6371000; // Earth's mean radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const horizontalDist = R * c;
    
    // Account for 3D elevation differences
    const elevDiff = carto2.height - carto1.height;
    total += Math.sqrt(horizontalDist * horizontalDist + elevDiff * elevDiff);
  }
  return total;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  }
  return `${(meters / 1000).toFixed(3)} km`;
}

function calculateArea(positions: Cesium.Cartesian3[]): number {
  if (positions.length < 3) return 0;
  
  const cartos = positions.map(p => Cesium.Cartographic.fromCartesian(p));
  const origin = cartos[0];
  const originLon = origin.longitude;
  const originLat = origin.latitude;
  
  const R = 6378137.0; // WGS84 major semi-axis
  
  const points2D = cartos.map(c => {
    const x = R * (c.longitude - originLon) * Math.cos(originLat);
    const y = R * (c.latitude - originLat);
    return { x, y };
  });
  
  // Shoelace formula
  let area = 0;
  const n = points2D.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points2D[i].x * points2D[j].y;
    area -= points2D[j].x * points2D[i].y;
  }
  return Math.abs(area) / 2;
}

function calculatePerimeter(positions: Cesium.Cartesian3[]): number {
  if (positions.length < 2) return 0;
  let perimeter = 0;
  const n = positions.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += Cesium.Cartesian3.distance(positions[i], positions[j]);
  }
  return perimeter;
}

function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${sqMeters.toFixed(1)} m²`;
  } else if (sqMeters < 1000000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${(sqMeters / 1000000).toFixed(3)} km²`;
}

function calculateCenter(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 | null {
  if (positions.length === 0) return null;
  let sumX = 0, sumY = 0, sumZ = 0;
  positions.forEach(p => {
    sumX += p.x;
    sumY += p.y;
    sumZ += p.z;
  });
  return new Cesium.Cartesian3(
    sumX / positions.length,
    sumY / positions.length,
    sumZ / positions.length
  );
}

const formatHour = (hourFloat: number) => {
  const h = Math.floor(hourFloat);
  const m = Math.floor((hourFloat % 1) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMin = m.toString().padStart(2, '0');
  return `${displayHour}:${displayMin} ${period}`;
};

// Calculates Ortho snapping angles and SketchUp-style exact typed segment lengths
function getConstrainedCandidatePosition(
  rawCartesian: Cesium.Cartesian3,
  clickedPositions: Cesium.Cartesian3[],
  isOrtho: boolean,
  typedLength: number | null
): { position: Cesium.Cartesian3; currentDistance: number; isOrthoLocked: boolean; angleDeg: number | null } {
  if (clickedPositions.length === 0 || !rawCartesian) {
    return { position: rawCartesian, currentDistance: 0, isOrthoLocked: false, angleDeg: null };
  }

  const vPrev = clickedPositions[clickedPositions.length - 1];
  
  // Transform matrices for East-North-Up frame centered at vPrev
  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(vPrev);
  const invEnuMatrix = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());

  // Convert raw candidate position from Earth ECEF to local ENU
  const cRawEnu = Cesium.Matrix4.multiplyByPoint(invEnuMatrix, rawCartesian, new Cesium.Cartesian3());
  const eRaw = cRawEnu.x;
  const nRaw = cRawEnu.y;
  const rawDist = Math.hypot(eRaw, nRaw);

  let uDirX = 1;
  let uDirY = 0;
  let isOrthoLocked = false;
  let angleDeg: number | null = null;

  if (rawDist > 0.0001) {
    uDirX = eRaw / rawDist;
    uDirY = nRaw / rawDist;
  }

  if (isOrtho && rawDist > 0.001) {
    isOrthoLocked = true;
    const rawAngle = Math.atan2(nRaw, eRaw);

    if (clickedPositions.length >= 2) {
      const vPrev1 = clickedPositions[clickedPositions.length - 2];
      const vPrev1Enu = Cesium.Matrix4.multiplyByPoint(invEnuMatrix, vPrev1, new Cesium.Cartesian3());
      // Vector of previous segment pointing into vPrev (0,0): direction from vPrev1 to vPrev is (-vPrev1Enu.x, -vPrev1Enu.y)
      const prevSegAngle = Math.atan2(-vPrev1Enu.y, -vPrev1Enu.x);
      
      const diffAngle = rawAngle - prevSegAngle;
      const step = Math.PI / 2; // 90 degree increments
      const snappedDiff = Math.round(diffAngle / step) * step;
      const targetAngle = prevSegAngle + snappedDiff;

      uDirX = Math.cos(targetAngle);
      uDirY = Math.sin(targetAngle);
      
      const relativeDeg = Math.round((((snappedDiff * 180 / Math.PI) % 360) + 360) % 360);
      angleDeg = relativeDeg;
    } else {
      // First segment: snap to local cardinal directions (0°, 90°, 180°, 270°)
      const step = Math.PI / 2;
      const targetAngle = Math.round(rawAngle / step) * step;
      uDirX = Math.cos(targetAngle);
      uDirY = Math.sin(targetAngle);
      angleDeg = Math.round((((targetAngle * 180 / Math.PI) % 360) + 360) % 360);
    }
  }

  const finalDist = (typedLength !== null && typedLength > 0) ? typedLength : rawDist;

  const finalEnu = new Cesium.Cartesian3(
    uDirX * finalDist,
    uDirY * finalDist,
    cRawEnu.z
  );

  const finalCartesian = Cesium.Matrix4.multiplyByPoint(enuMatrix, finalEnu, new Cesium.Cartesian3());

  return {
    position: finalCartesian,
    currentDistance: finalDist,
    isOrthoLocked,
    angleDeg
  };
}
