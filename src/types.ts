export interface LocationPreset {
  id: string;
  name: string;
  description: string;
  longitude: number;
  latitude: number;
  height: number;
  pitch: number; // degrees
  heading: number; // degrees
  roll: number; // degrees
  isCustom?: boolean;
  thumbnail?: string;
  sunHour?: number;
  selectedDate?: string;
  simulationTimezone?: string;
  layersState?: {
    layers?: MapLayer[];
    globeState?: GlobeState;
    ionAssets?: IonAssetsState;
    ionAccounts?: IonAccount[];
    importedLayersState?: { id: string; visible: boolean }[];
    i3sLayersState?: { id: string; visible: boolean }[];
    gisLayersState?: { id: string; visible: boolean; enabled?: boolean }[];
  };
}

export type ActiveToolType = 
  | 'none' 
  | 'distance' 
  | 'height' 
  | 'area' 
  | 'viewshed' 
  | 'boundary' 
  | 'tree-placement' 
  | 'auto-bound' 
  | 'view-corridor' 
  | 'parametric-massing' 
  | 'subsurface-excavation'
  | '3d-tiles-clip';

export type MapStyle = 'satellite' | 'dark' | 'streets' | 'topo';

export interface MapLayer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'tileset' | 'geojson' | 'imagery';
  url?: string;
  assetId?: number; // For Cesium Ion Assets
  outlineColor?: string; // Hex color string, defaults to #000000
  outlineOpacity?: number; // 0.0 to 1.0
  outlineThickness?: number; // 1.0 to 10.0 px, defaults to 2.5
  outlineEnabled?: boolean;
}

export type BuildingShaderMode = 
  | 'realistic' 
  | 'architectural-white' 
  | 'architectural-silhouette' 
  | 'blueprint' 
  | 'clay' 
  | 'dark-obsidian'
  | 'custom-glsl';

export interface GlobeState {
  style: MapStyle;
  terrainEnabled: boolean;
  buildings3dEnabled: boolean;
  atmosphereEnabled: boolean;
  fogEnabled: boolean;
  activeLayers: string[]; // List of MapLayer IDs that are enabled
  buildingShaderMode?: BuildingShaderMode;
  buildingCustomShaderText?: string;
  buildingSilhouetteColor?: string;
}

export interface PolygonData {
  positions: [number, number][]; // [longitude, latitude][]
  holes?: { positions: [number, number][] }[];
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
}

export interface ShapefileFeature {
  id: string | number;
  positions: [number, number][]; // [longitude, latitude][]
  holes?: { positions: [number, number][] }[];
  properties: Record<string, any>;
  center: [number, number]; // [longitude, latitude]
  isLine?: boolean; // True if it's a CAD polyline / line geometry
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
}

export interface ShapefileData {
  features: ShapefileFeature[];
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  fields: string[]; // List of numerical attribute names
  allFields?: string[]; // List of all attribute names (string, numeric, etc.)
  isCad?: boolean; // True if parsed as AutoCAD reprojected local grid
}

export interface ParcelStyleConfig {
  showFill: boolean;
  fillColor: string; // Hex string, e.g. "#3B82F6"
  fillOpacity: number; // 0.0 to 1.0
  showBorder?: boolean; // Show or hide perimeter border stroke (default true)
  showStroke?: boolean; // Alias for showBorder
  borderOpacity?: number; // 0.0 to 1.0 (default 1.0)
  strokeOpacity?: number; // Alias for borderOpacity
  strokeColor: string; // Hex string, e.g. "#FFFFFF"
  strokeWidth: number; // 1 to 10 px
  filterField?: string;
  filterValue?: string;

  // 3D Attribute Label Properties
  showLabel?: boolean;
  labelField?: string; // Attribute to display (defaults to filterField or first available)
  labelFontHeight?: number; // in px (e.g. 8 to 48, default 14)
  labelFontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  labelFontFamily?: 'sans-serif' | 'monospace' | 'serif' | 'Arial' | 'Roboto' | string;
  labelFontColor?: string; // Hex string, e.g. "#FFFFFF"
  labelOutlineColor?: string; // Hex string for outline/halo, e.g. "#000000"
  labelOutlineWidth?: number; // Outline width in px, e.g. 2.0
  labelElevationOffset?: number; // Elevation offset in meters above shape
}

export interface GisLayer {
  id: string;
  name: string;
  polygonData: PolygonData;
  shapefileData: ShapefileData;
  visible: boolean;
  opacity: number; // 0.0 to 1.0
  catchmentRadius?: number; // in meters (0 to 2000)
  catchmentColor?: string; // color preset name or hex string
  visualizationMode?: 'solid' | 'choropleth' | 'alpha_blended' | 'none';
  alphaBlendIntensity?: number;
  choroplethAttribute?: string;
  choroplethMinColor?: string; // HEX
  choroplethMaxColor?: string; // HEX
  
  // AutoCAD Specialized Styling
  customColor?: string; // Hex string, e.g. "#FF5733"
  customAlpha?: number; // Alpha modifier, 0.0 to 1.0
  geometryType?: 'polygon' | 'polyline';
  lineWidth?: number; // 1 to 20
  lineType?: 'Solid' | 'Dashed' | 'Glowing Vector' | '3D Volumetric Pipe';
  showLegend?: boolean;

  // Parcel & Shapefile Dynamic Styling & Filtering
  showFill?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  showBorder?: boolean;
  showStroke?: boolean;
  borderOpacity?: number;
  strokeOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  filterField?: string;
  filterValue?: string;

  // 3D Attribute Label Properties
  showLabel?: boolean;
  labelField?: string;
  labelFontHeight?: number;
  labelFontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  labelFontFamily?: 'sans-serif' | 'monospace' | 'serif' | 'Arial' | 'Roboto';
  labelFontColor?: string;
  labelOutlineColor?: string;
  labelOutlineWidth?: number;
  labelElevationOffset?: number;

  // DXF / CAD Per-Object Texture Draping
  textureUrl?: string | null;
  textureName?: string | null;
}

export interface IonAssetsState {
  tilesetId: string;
  tilesetEnabled: boolean;
  terrainId: string;
  terrainEnabled: boolean;
  imageryId: string;
  imageryEnabled: boolean;
}

export interface IonAccountAsset {
  id: number;
  name: string;
  type: string; // '3DTILES', 'TERRAIN', 'IMAGERY', 'CZML', 'KML', 'GLTF', etc.
  description?: string;
  bytes?: number;
  dateAdded?: string;
  status?: string;
  loaded?: boolean;
  visible?: boolean;
  loading?: boolean;
  error?: string | null;
  outlineColor?: string; // Hex color string, defaults to #000000
  outlineOpacity?: number; // 0.0 to 1.0
  outlineThickness?: number; // 1.0 to 10.0 px, defaults to 2.5
  outlineEnabled?: boolean;
}

export interface IonAccount {
  id: string; // unique identifier
  accountName: string;
  token: string;
  assets: IonAccountAsset[];
  isLoading?: boolean;
  error?: string | null;
}

export interface SimulationVideo {
  id: string;
  title: string;
  blobUrl: string;
  blob: Blob;
  thumbnailUrl: string;
  date: string;
  startTimeStr: string;
  endTimeStr: string;
  fileSizeStr: string;
  mimeType: string;
}



