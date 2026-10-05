import { saveAs } from 'file-saver';
import { GisLayer, GlobeState, PolygonData, ShapefileData } from '../types';

/**
 * Structure of a stored layer record as specified
 */
export interface StoredLayer {
  id: string;
  name: string;
  type: 'dxf' | 'shapefile' | 'point_trees' | '3dtiles' | 'model';
  payload: any; // Parsed GeoJSON FeatureCollection or ShapefileData or ArrayBuffer
  style: {
    showFill?: boolean;
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
    treeGlbUrl?: string;
    scale?: number;
    showBorder?: boolean;
    showStroke?: boolean;
    borderOpacity?: number;
    strokeOpacity?: number;
    customColor?: string;
    customAlpha?: number;
    geometryType?: 'polygon' | 'polyline';
    lineWidth?: number;
    lineType?: string;
    showLegend?: boolean;
    showLabel?: boolean;
    labelField?: string;
    [key: string]: any;
  };
  visible: boolean;
  timestamp: number;
  metadata?: {
    bounds?: {
      west: number;
      south: number;
      east: number;
      north: number;
    };
    featureCount?: number;
    sourceFilename?: string;
    [key: string]: any;
  };
}

/**
 * Full project record stored in IndexedDB or exported as JSON
 */
export interface StoredProject {
  id: string;
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  camera?: {
    position: { x: number; y: number; z: number };
    heading: number;
    pitch: number;
    roll: number;
    longitude?: number;
    latitude?: number;
    height?: number;
  };
  globeState?: Partial<GlobeState>;
  layers: StoredLayer[];
  gisLayers?: any[];
  placedTrees?: any[];
  modelData?: {
    url: string | null;
    name: string | null;
    latitude?: number;
    longitude?: number;
    height?: number;
    heading?: number;
    pitch?: number;
    roll?: number;
    clampToTerrain?: boolean;
  };
  environmentSettings?: {
    sunHour?: number;
    selectedDate?: string;
    sunShadowsEnabled?: boolean;
    ambientLightingIntensity?: number;
    hdrPipelineEnabled?: boolean;
    rtxUltraEnabled?: boolean;
    googleLabelsEnabled?: boolean;
  };
}

const DB_NAME = 'CesiumProjectDB';
const DB_VERSION = 1;
const STORE_LAYERS = 'layers';
const STORE_PROJECTS = 'projects';

class ProjectStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize or retrieve the IndexedDB connection
   */
  public async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not supported in this environment');
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for individual layers
        if (!db.objectStoreNames.contains(STORE_LAYERS)) {
          const layerStore = db.createObjectStore(STORE_LAYERS, { keyPath: 'id' });
          layerStore.createIndex('type', 'type', { unique: false });
          layerStore.createIndex('timestamp', 'timestamp', { unique: false });
          layerStore.createIndex('name', 'name', { unique: false });
        }

        // Store for complete projects
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          projectStore.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  // ==========================================
  // LAYER CRUD OPERATIONS
  // ==========================================

  /**
   * Save or update a single layer in IndexedDB
   */
  public async saveLayer(layer: StoredLayer): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_LAYERS], 'readwrite');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.put(layer);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Batch save an array of layers
   */
  public async saveLayers(layers: StoredLayer[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_LAYERS], 'readwrite');
      const store = transaction.objectStore(STORE_LAYERS);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      for (const layer of layers) {
        store.put(layer);
      }
    });
  }

  /**
   * Get a layer by ID
   */
  public async getLayer(id: string): Promise<StoredLayer | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_LAYERS], 'readonly');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as StoredLayer | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all stored layers
   */
  public async getAllLayers(): Promise<StoredLayer[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_LAYERS], 'readonly');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result as StoredLayer[]) || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a layer by ID
   */
  public async deleteLayer(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_LAYERS], 'readwrite');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all stored layers
   */
  public async clearAllLayers(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_LAYERS], 'readwrite');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // PROJECT CRUD OPERATIONS
  // ==========================================

  /**
   * Save or update a project record in IndexedDB
   */
  public async saveProject(project: StoredProject): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.put({
        ...project,
        updatedAt: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a project by ID
   */
  public async getProject(id: string): Promise<StoredProject | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJECTS], 'readonly');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as StoredProject | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all stored projects
   */
  public async getAllProjects(): Promise<StoredProject[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJECTS], 'readonly');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as StoredProject[]) || [];
        // Sort descending by updated timestamp
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a project by ID
   */
  public async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // CONVERSION HELPERS
  // ==========================================

  /**
   * Convert runtime GisLayer to StoredLayer
   */
  public gisLayerToStoredLayer(gisLayer: GisLayer): StoredLayer {
    const isDxf = Boolean(
      gisLayer.shapefileData?.isCad || 
      gisLayer.name.toLowerCase().endsWith('.dxf') ||
      gisLayer.geometryType === 'polyline'
    );

    return {
      id: gisLayer.id,
      name: gisLayer.name,
      type: isDxf ? 'dxf' : 'shapefile',
      payload: {
        polygonData: gisLayer.polygonData,
        shapefileData: gisLayer.shapefileData,
        textureUrl: gisLayer.textureUrl,
        textureName: gisLayer.textureName,
      },
      style: {
        showFill: gisLayer.showFill ?? true,
        fillColor: gisLayer.fillColor ?? (isDxf ? '#000000' : '#EF4444'),
        fillOpacity: gisLayer.fillOpacity ?? 0.6,
        strokeColor: gisLayer.strokeColor ?? '#FFFFFF',
        strokeWidth: gisLayer.strokeWidth ?? 1.5,
        showBorder: gisLayer.showBorder ?? true,
        showStroke: gisLayer.showStroke ?? true,
        borderOpacity: gisLayer.borderOpacity ?? 1.0,
        strokeOpacity: gisLayer.strokeOpacity ?? 1.0,
        customColor: gisLayer.customColor,
        customAlpha: gisLayer.customAlpha,
        geometryType: gisLayer.geometryType,
        lineWidth: gisLayer.lineWidth,
        lineType: gisLayer.lineType,
        showLegend: gisLayer.showLegend,
        showLabel: gisLayer.showLabel,
        labelField: gisLayer.labelField
      },
      visible: gisLayer.visible !== false,
      timestamp: Date.now(),
      metadata: {
        bounds: gisLayer.shapefileData?.bounds || gisLayer.polygonData?.bounds,
        featureCount: gisLayer.shapefileData?.features?.length || 0,
        sourceFilename: gisLayer.name
      }
    };
  }

  /**
   * Convert StoredLayer back to runtime GisLayer
   */
  public storedLayerToGisLayer(stored: StoredLayer): GisLayer | null {
    if (stored.type !== 'dxf' && stored.type !== 'shapefile') {
      return null;
    }

    const payload = stored.payload || {};
    const polygonData: PolygonData = payload.polygonData || {
      positions: [],
      bounds: stored.metadata?.bounds || { west: 0, south: 0, east: 0, north: 0 }
    };
    const shapefileData: ShapefileData = payload.shapefileData || {
      features: [],
      bounds: stored.metadata?.bounds || { west: 0, south: 0, east: 0, north: 0 },
      fields: []
    };

    return {
      id: stored.id,
      name: stored.name,
      polygonData,
      shapefileData,
      visible: stored.visible !== false,
      opacity: stored.style.fillOpacity ?? 0.6,
      showFill: stored.style.showFill ?? true,
      fillColor: stored.style.fillColor ?? (stored.type === 'dxf' ? '#000000' : '#EF4444'),
      fillOpacity: stored.style.fillOpacity ?? 0.6,
      strokeColor: stored.style.strokeColor ?? '#FFFFFF',
      strokeWidth: stored.style.strokeWidth ?? 1.5,
      showBorder: stored.style.showBorder ?? true,
      showStroke: stored.style.showStroke ?? true,
      borderOpacity: stored.style.borderOpacity ?? 1.0,
      strokeOpacity: stored.style.strokeOpacity ?? 1.0,
      customColor: stored.style.customColor,
      customAlpha: stored.style.customAlpha,
      geometryType: stored.style.geometryType,
      lineWidth: stored.style.lineWidth,
      lineType: (stored.style.lineType as any) || 'Solid',
      showLegend: stored.style.showLegend ?? false,
      showLabel: stored.style.showLabel ?? false,
      labelField: stored.style.labelField,
      textureUrl: payload.textureUrl || null,
      textureName: payload.textureName || null
    };
  }

  /**
   * Convert placed trees to a StoredLayer
   */
  public placedTreesToStoredLayer(trees: any[], treeGlbUrl?: string): StoredLayer {
    return {
      id: `trees_layer_${Date.now()}`,
      name: `Point Trees Layer (${trees.length} trees)`,
      type: 'point_trees',
      payload: trees,
      style: {
        treeGlbUrl: treeGlbUrl || 'https://raw.githubusercontent.com/jorgecardoso/3d-models/master/low-poly-tree/tree.glb',
        scale: 1.0
      },
      visible: true,
      timestamp: Date.now(),
      metadata: {
        featureCount: trees.length
      }
    };
  }

  /**
   * Convert custom model to a StoredLayer
   */
  public modelToStoredLayer(modelData: {
    url: string;
    name: string;
    latitude: number;
    longitude: number;
    height: number;
    heading?: number;
    pitch?: number;
    roll?: number;
    scale?: number;
  }): StoredLayer {
    return {
      id: `model_layer_${Date.now()}`,
      name: modelData.name || 'Imported 3D Model',
      type: 'model',
      payload: {
        url: modelData.url,
        latitude: modelData.latitude,
        longitude: modelData.longitude,
        height: modelData.height,
        heading: modelData.heading || 0,
        pitch: modelData.pitch || 0,
        roll: modelData.roll || 0
      },
      style: {
        scale: modelData.scale || 1.0
      },
      visible: true,
      timestamp: Date.now()
    };
  }

  // ==========================================
  // EXPORT / IMPORT (FILE-SAVER & JSON)
  // ==========================================

  /**
   * Export a project as a downloadable JSON file
   */
  public exportProjectFile(project: StoredProject, filename?: string): void {
    const cleanFilename = (filename || `${project.name.replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}`) + '.json';
    const jsonString = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    saveAs(blob, cleanFilename);
  }

  /**
   * Import and validate a project from a File object
   */
  public async importProjectFile(file: File): Promise<StoredProject> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const project = JSON.parse(content) as StoredProject;
          if (!project || typeof project !== 'object') {
            throw new Error('Invalid project file format');
          }
          if (!project.id) {
            project.id = `imported_proj_${Date.now()}`;
          }
          if (!project.name) {
            project.name = file.name.replace(/\.json$/i, '');
          }
          if (!Array.isArray(project.layers)) {
            project.layers = [];
          }
          resolve(project);
        } catch (err) {
          reject(new Error(`Failed to parse project file: ${(err as Error).message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

export const projectStorageService = new ProjectStorageService();
