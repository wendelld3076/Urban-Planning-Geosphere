import * as Cesium from 'cesium';

export interface ContextMenuEntityData {
  entity: Cesium.Entity;
  layerName: string;
  sourceFile: string;
  layerId?: string;
  featureId?: string | number;
  isDxf?: boolean;
  isCad?: boolean;
  isDxfTexture?: boolean;
  hasTexture?: boolean;
  textureUrl?: string | null;
  textureName?: string | null;
  positions?: [number, number][]; // [longitude, latitude][]
  bounds?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  properties?: Record<string, any>;
  centerCoordinate?: {
    latitude: number;
    longitude: number;
    height?: number;
  };
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  entity: Cesium.Entity | null;
  layerName: string;
  sourceFile: string;
  data?: ContextMenuEntityData | null;
}

type ContextMenuListener = (state: ContextMenuState) => void;

class ContextMenuService {
  private static instance: ContextMenuService;
  private state: ContextMenuState = {
    visible: false,
    x: 0,
    y: 0,
    entity: null,
    layerName: 'Default Layer',
    sourceFile: 'Unknown'
  };

  private listeners: Set<ContextMenuListener> = new Set();

  private constructor() {}

  public static getInstance(): ContextMenuService {
    if (!ContextMenuService.instance) {
      ContextMenuService.instance = new ContextMenuService();
    }
    return ContextMenuService.instance;
  }

  public getState(): ContextMenuState {
    return this.state;
  }

  public subscribe(listener: ContextMenuListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public open(data: {
    x: number;
    y: number;
    entity: Cesium.Entity;
    layerName?: string;
    sourceFile?: string;
    details?: ContextMenuEntityData;
  }) {
    this.state = {
      visible: true,
      x: data.x,
      y: data.y,
      entity: data.entity,
      layerName: data.layerName || 'Default Layer',
      sourceFile: data.sourceFile || 'Unknown',
      data: data.details
    };
    this.notify();
  }

  public close() {
    if (!this.state.visible) return;
    this.state = {
      ...this.state,
      visible: false
    };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Error in ContextMenuService subscriber:', err);
      }
    });
  }
}

export const contextMenuService = ContextMenuService.getInstance();
