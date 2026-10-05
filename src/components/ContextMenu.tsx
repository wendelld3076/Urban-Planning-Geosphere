import React, { useEffect, useState, useRef } from 'react';
import * as Cesium from 'cesium';
import { 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Layers, 
  FileText, 
  MapPin, 
  Check, 
  Info,
  Scissors,
  Sliders,
  Palette,
  ChevronDown,
  ChevronUp,
  X,
  Layers2,
  Sparkles,
  RotateCw,
  Compass,
  GripHorizontal,
  Image,
  Upload
} from 'lucide-react';
import { contextMenuService, ContextMenuState } from '../services/ContextMenuService';
import { GisLayer, ParcelStyleConfig } from '../types';
import { updateParcelStyles } from '../services/ImportParcelService';

interface ContextMenuProps {
  viewer?: Cesium.Viewer | null;
  gisLayers?: GisLayer[];
  importedLayers?: any[];
  clippingMode?: 'none' | 'inside' | 'outside';
  theme?: 'light' | 'dark';
  textureUrl?: string | null;
  textureName?: string | null;
  onClearTexture?: () => void;
  onTextureUrlChange?: (url: string | null, filename: string | null) => void;
  onLayerTextureChange?: (layerId: string, url: string | null, filename: string | null) => void;
  onDeleteLayer?: (layerId: string) => void;
  onDeleteFeature?: (layerId?: string, featureId?: string | number) => void;
  onUpdateLayerStyle?: (layerId: string, styleUpdates: Partial<GisLayer & ParcelStyleConfig>) => void;
  onSelectFeature?: (entity: Cesium.Entity, metadata?: any) => void;
  onImportedLayersChange?: (layers: any[]) => void;
  onClippingModeChange?: (mode: 'none' | 'inside' | 'outside') => void;
  onActiveLayerIdChange?: (id: string | null) => void;
  onLocateLayer?: (bounds: any) => void;
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

export const ContextMenu: React.FC<ContextMenuProps> = ({
  viewer,
  gisLayers = [],
  importedLayers = [],
  clippingMode = 'none',
  theme = 'dark',
  textureUrl,
  textureName,
  onClearTexture,
  onTextureUrlChange,
  onLayerTextureChange,
  onDeleteLayer,
  onDeleteFeature,
  onUpdateLayerStyle,
  onSelectFeature,
  onImportedLayersChange,
  onClippingModeChange,
  onActiveLayerIdChange,
  onLocateLayer
}) => {
  const [state, setState] = useState<ContextMenuState>(contextMenuService.getState());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isStyleOpen, setIsStyleOpen] = useState(true);
  const [clipStatusMessage, setClipStatusMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textureFileInputRef = useRef<HTMLInputElement>(null);

  // Draggable menu position state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  // Style states matching sidebar parameters exactly
  const [showFill, setShowFill] = useState<boolean>(true);
  const [fillColor, setFillColor] = useState<string>('#EF4444');
  const [fillOpacity, setFillOpacity] = useState<number>(1.0);

  const [showBorder, setShowBorder] = useState<boolean>(true);
  const [strokeColor, setStrokeColor] = useState<string>('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(1);
  const [borderOpacity, setBorderOpacity] = useState<number>(1.0);

  // Initialize/reset position when menu is opened or new coordinates received
  useEffect(() => {
    if (state.visible) {
      const menuWidth = 320;
      const estimatedHeight = isStyleOpen ? 680 : 340;
      const initialSafeX = Math.min(Math.max(10, state.x), Math.max(10, window.innerWidth - menuWidth - 10));
      const initialSafeY = Math.min(Math.max(10, state.y), Math.max(10, window.innerHeight - estimatedHeight - 10));
      setPosition({ x: initialSafeX, y: initialSafeY });
    } else {
      setPosition(null);
    }
  }, [state.visible, state.x, state.y]);

  // Dragging event listeners for moving context menu anywhere on screen
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) {
      return;
    }
    e.preventDefault();

    const currentX = position?.x ?? safeX;
    const currentY = position?.y ?? safeY;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: currentX,
      posY: currentY,
    };
    setIsDragging(true);
    isDraggingRef.current = true;
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) {
      return;
    }
    const touch = e.touches[0];
    const currentX = position?.x ?? safeX;
    const currentY = position?.y ?? safeY;

    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      posX: currentX,
      posY: currentY,
    };
    setIsDragging(true);
    isDraggingRef.current = true;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const minX = 0;
      const maxX = Math.max(0, window.innerWidth - 60);
      const minY = 0;
      const maxY = Math.max(0, window.innerHeight - 50);

      const nextX = Math.min(Math.max(minX, dragStartRef.current.posX + dx), maxX);
      const nextY = Math.min(Math.max(minY, dragStartRef.current.posY + dy), maxY);

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      dragStartRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.mouseX;
      const dy = touch.clientY - dragStartRef.current.mouseY;

      const minX = 0;
      const maxX = Math.max(0, window.innerWidth - 60);
      const minY = 0;
      const maxY = Math.max(0, window.innerHeight - 50);

      const nextX = Math.min(Math.max(minX, dragStartRef.current.posX + dx), maxX);
      const nextY = Math.min(Math.max(minY, dragStartRef.current.posY + dy), maxY);

      setPosition({ x: nextX, y: nextY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    const unsubscribe = contextMenuService.subscribe((newState) => {
      setState(newState);
      setCopiedKey(null);
      setClipStatusMessage(null);

      const targetId = newState.data?.layerId;
      const targetL = gisLayers.find((l) => l.id === targetId) ||
        gisLayers.find((l) => l.name === newState.layerName || l.name === newState.sourceFile);

      if (targetL) {
        setShowFill(targetL.showFill !== undefined ? targetL.showFill : true);
        setFillColor(targetL.fillColor || targetL.customColor || '#EF4444');
        setFillOpacity(
          targetL.fillOpacity !== undefined
            ? targetL.fillOpacity
            : (targetL.opacity !== undefined ? targetL.opacity : 1.0)
        );
        setShowBorder(
          targetL.showBorder !== undefined
            ? targetL.showBorder
            : (targetL.showStroke !== undefined ? targetL.showStroke : true)
        );
        setStrokeColor(targetL.strokeColor || targetL.customColor || '#EF4444');
        setStrokeWidth(
          targetL.strokeWidth !== undefined
            ? targetL.strokeWidth
            : (targetL.lineWidth || 1)
        );
        setBorderOpacity(
          targetL.borderOpacity !== undefined
            ? targetL.borderOpacity
            : (targetL.strokeOpacity !== undefined ? targetL.strokeOpacity : 1.0)
        );
      } else {
        setShowFill(true);
        setFillColor('#EF4444');
        setFillOpacity(1.0);
        setShowBorder(true);
        setStrokeColor('#EF4444');
        setStrokeWidth(1);
        setBorderOpacity(1.0);
      }
    });
    return unsubscribe;
  }, [gisLayers]);

  // Close context menu if clicked outside or pressed Escape
  useEffect(() => {
    if (!state.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        contextMenuService.close();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        contextMenuService.close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state.visible]);

  if (!state.visible || !state.entity) {
    return null;
  }

  // Find layer associated with this entity
  const layerId = state.data?.layerId;
  const currentLayer = gisLayers.find((l) => l.id === layerId) ||
    gisLayers.find((l) => l.name === state.layerName || l.name === state.sourceFile);
  const isLayerVisible = currentLayer ? currentLayer.visible : true;
  const isDxf = Boolean(
    state.data?.isDxf ||
    state.data?.isCad ||
    state.data?.isDxfTexture ||
    state.data?.hasTexture ||
    state.data?.properties?.isCad ||
    state.data?.properties?.DXF ||
    state.data?.properties?.CAD ||
    state.entity?.id === 'dxf-site-boundary-drape' ||
    currentLayer?.shapefileData?.isCad ||
    currentLayer?.name?.toLowerCase().endsWith('.dxf') ||
    state.sourceFile?.toLowerCase().endsWith('.dxf') ||
    state.layerName?.toLowerCase().endsWith('.dxf') ||
    gisLayers.some((l) => (l.shapefileData?.isCad || l.name?.toLowerCase().endsWith('.dxf')) && (l.id === layerId || l.name === state.sourceFile || l.name === state.layerName))
  );

  const activeTextureUrl = currentLayer?.textureUrl !== undefined 
    ? currentLayer.textureUrl 
    : (state.data?.textureUrl || (gisLayers.length <= 1 ? textureUrl : null));
  const activeTextureName = currentLayer?.textureName || state.data?.textureName || (gisLayers.length <= 1 ? textureName : null);
  const hasActiveTexture = Boolean(activeTextureUrl || currentLayer?.textureUrl || state.data?.hasTexture);

  // Check if 3D clipping polygon is active for this DXF feature or layer
  const activeClippingLayer = (importedLayers || []).find(
    (l: any) =>
      l.type === 'clipping_polygon' &&
      (l.sourceDxfFeatureId === String(state.data?.featureId) ||
       (layerId && l.sourceDxfLayerId === layerId) ||
       l.id === `clipping-dxf-${layerId}-${state.data?.featureId}`)
  );
  const isClippingActive = Boolean(activeClippingLayer && activeClippingLayer.visible !== false);

  // Viewport clamping
  const menuWidth = 320;
  const estimatedHeight = isStyleOpen ? 680 : 340;
  const safeX = Math.min(Math.max(10, state.x), window.innerWidth - menuWidth - 10);
  const safeY = Math.min(Math.max(10, state.y), window.innerHeight - estimatedHeight - 10);

  // Actions
  const handleFlyToLayer = () => {
    let targetBounds: { west: number; south: number; east: number; north: number } | null = null;

    // 1. Locate layer in gisLayers
    const matchedLayer = currentLayer ||
      (gisLayers || []).find((l) => l.id === layerId) ||
      (gisLayers || []).find((l) => l.name === state.layerName || l.name === state.sourceFile) ||
      (gisLayers || []).find((l) => l.shapefileData?.isCad || l.name?.toLowerCase().endsWith('.dxf'));

    if (matchedLayer?.shapefileData?.bounds) {
      const b = matchedLayer.shapefileData.bounds as any;
      const west = b.west !== undefined ? b.west : b.minLon;
      const south = b.south !== undefined ? b.south : b.minLat;
      const east = b.east !== undefined ? b.east : b.maxLon;
      const north = b.north !== undefined ? b.north : b.maxLat;
      if (west !== undefined && south !== undefined && east !== undefined && north !== undefined) {
        targetBounds = { west, south, east, north };
      }
    } else if (matchedLayer?.shapefileData?.features && matchedLayer.shapefileData.features.length > 0) {
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      matchedLayer.shapefileData.features.forEach((feat: any) => {
        if (feat.bounds) {
          const w = feat.bounds.west !== undefined ? feat.bounds.west : feat.bounds.minLon;
          const s = feat.bounds.south !== undefined ? feat.bounds.south : feat.bounds.minLat;
          const e = feat.bounds.east !== undefined ? feat.bounds.east : feat.bounds.maxLon;
          const n = feat.bounds.north !== undefined ? feat.bounds.north : feat.bounds.maxLat;
          if (w !== undefined) minLon = Math.min(minLon, w);
          if (e !== undefined) maxLon = Math.max(maxLon, e);
          if (s !== undefined) minLat = Math.min(minLat, s);
          if (n !== undefined) maxLat = Math.max(maxLat, n);
        } else if (feat.positions && Array.isArray(feat.positions)) {
          feat.positions.forEach(([lng, lat]: [number, number]) => {
            minLon = Math.min(minLon, lng);
            maxLon = Math.max(maxLon, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          });
        }
      });
      if (minLon !== Infinity && maxLon !== -Infinity) {
        targetBounds = { west: minLon, south: minLat, east: maxLon, north: maxLat };
      }
    }

    // 2. Check importedLayers fallback
    if (!targetBounds) {
      const impLayer = (importedLayers || []).find((l: any) => l.id === layerId || l.name === state.layerName || l.sourceDxfLayerId === layerId);
      if (impLayer?.bounds) {
        const b = impLayer.bounds as any;
        const west = b.west !== undefined ? b.west : b.minLon;
        const south = b.south !== undefined ? b.south : b.minLat;
        const east = b.east !== undefined ? b.east : b.maxLon;
        const north = b.north !== undefined ? b.north : b.maxLat;
        if (west !== undefined && south !== undefined) {
          targetBounds = { west, south, east, north };
        }
      }
    }

    // 3. Fallback to state.data bounds or positions
    if (!targetBounds) {
      if (state.data?.bounds) {
        const b = state.data.bounds as any;
        const west = b.west !== undefined ? b.west : b.minLon;
        const south = b.south !== undefined ? b.south : b.minLat;
        const east = b.east !== undefined ? b.east : b.maxLon;
        const north = b.north !== undefined ? b.north : b.maxLat;
        if (west !== undefined && south !== undefined) {
          targetBounds = { west, south, east, north };
        }
      } else if (state.data?.positions && state.data.positions.length > 0) {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        state.data.positions.forEach(([lng, lat]: [number, number]) => {
          minLon = Math.min(minLon, lng);
          maxLon = Math.max(maxLon, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
        if (minLon !== Infinity) {
          targetBounds = { west: minLon, south: minLat, east: maxLon, north: maxLat };
        }
      }
    }

    if (targetBounds) {
      // Execute camera flight directly via Cesium viewer
      if (viewer && !viewer.isDestroyed()) {
        try {
          const rect = Cesium.Rectangle.fromDegrees(
            targetBounds.west,
            targetBounds.south,
            targetBounds.east,
            targetBounds.north
          );
          const centerLat = (targetBounds.south + targetBounds.north) / 2;
          const dLngMeters = Math.abs(targetBounds.east - targetBounds.west) * 111320 * Math.cos((centerLat * Math.PI) / 180);
          const dLatMeters = Math.abs(targetBounds.north - targetBounds.south) * 111320;
          const sizeMeters = Math.max(dLngMeters, dLatMeters, 25.0);

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
          console.warn('Failed flying to layer bounds via viewer:', err);
        }
      }

      // Also notify parent handler
      onLocateLayer?.(targetBounds);
    } else {
      // If no layer bounds available, zoom to feature as fallback
      handleZoomToFeature();
      return;
    }

    contextMenuService.close();
  };

  const handleZoomToFeature = () => {
    if (viewer && !viewer.isDestroyed()) {
      try {
        const coords = state.data?.positions;
        const bounds = state.data?.bounds;
        const center = state.data?.centerCoordinate;

        // 1. Zoom by explicit vertex coordinates (polylines, polygons)
        if (coords && coords.length > 0) {
          const cartesians = coords.map(([lng, lat]: [number, number]) => Cesium.Cartesian3.fromDegrees(lng, lat));
          const bs = Cesium.BoundingSphere.fromPoints(cartesians);
          const radius = Math.max(bs.radius, 15.0);
          const range = Math.max(radius * 2.5, 45.0);
          viewer.camera.flyToBoundingSphere(bs, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range)
          });
        }
        // 2. Zoom by bounding box
        else if (bounds) {
          const w = bounds.west !== undefined ? bounds.west : (bounds as any).minLon;
          const s = bounds.south !== undefined ? bounds.south : (bounds as any).minLat;
          const e = bounds.east !== undefined ? bounds.east : (bounds as any).maxLon;
          const n = bounds.north !== undefined ? bounds.north : (bounds as any).maxLat;
          const rect = Cesium.Rectangle.fromDegrees(w, s, e, n);
          const bs = Cesium.BoundingSphere.fromRectangle3D(rect);
          const radius = Math.max(bs.radius, 15.0);
          const range = Math.max(radius * 2.5, 45.0);
          viewer.camera.flyToBoundingSphere(bs, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range)
          });
        }
        // 3. Zoom by entity polyline positions
        else if (state.entity?.polyline?.positions) {
          const polyPos = state.entity.polyline.positions.getValue(viewer.clock.currentTime);
          if (Array.isArray(polyPos) && polyPos.length > 0) {
            const bs = Cesium.BoundingSphere.fromPoints(polyPos);
            const radius = Math.max(bs.radius, 15.0);
            const range = Math.max(radius * 2.5, 45.0);
            viewer.camera.flyToBoundingSphere(bs, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range)
            });
          } else if (state.entity) {
            viewer.flyTo(state.entity, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 200)
            });
          }
        }
        // 4. Zoom by entity polygon hierarchy
        else if (state.entity?.polygon?.hierarchy) {
          const hier = state.entity.polygon.hierarchy.getValue(viewer.clock.currentTime);
          if (hier && hier.positions && hier.positions.length > 0) {
            const bs = Cesium.BoundingSphere.fromPoints(hier.positions);
            const radius = Math.max(bs.radius, 15.0);
            const range = Math.max(radius * 2.5, 45.0);
            viewer.camera.flyToBoundingSphere(bs, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range)
            });
          } else if (state.entity) {
            viewer.flyTo(state.entity, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 200)
            });
          }
        }
        // 5. Zoom by center coordinate
        else if (center) {
          const dest = Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, (center.height || 0) + 120);
          viewer.camera.flyTo({
            destination: dest,
            duration: 1.5,
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0
            }
          });
        }
        // 6. Direct Cesium flyTo entity fallback
        else if (state.entity) {
          viewer.flyTo(state.entity, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 200)
          });
        }
      } catch (e) {
        console.warn('Could not fly to entity or feature coordinates:', e);
      }
    }
    contextMenuService.close();
  };

  const handleToggleVisibility = () => {
    if (layerId && onUpdateLayerStyle) {
      onUpdateLayerStyle(layerId, { visible: !isLayerVisible });
    } else if (state.entity) {
      state.entity.show = !state.entity.show;
    }
    contextMenuService.close();
  };

  const handleViewAttributes = () => {
    if (onSelectFeature && state.entity) {
      onSelectFeature(state.entity, {
        name: state.layerName,
        sourceFile: state.sourceFile,
        attributes: state.data?.properties || {}
      });
    }
    contextMenuService.close();
  };

  const handleCopyAttributes = () => {
    const payload = {
      layerName: state.layerName,
      sourceFile: state.sourceFile,
      centerCoordinate: state.data?.centerCoordinate,
      properties: state.data?.properties || {}
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedKey('attributes');
    setTimeout(() => {
      setCopiedKey(null);
      contextMenuService.close();
    }, 900);
  };

  const handleDeleteTexture = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (layerId && onLayerTextureChange) {
      onLayerTextureChange(layerId, null, null);
    } else if (onTextureUrlChange) {
      onTextureUrlChange(null, null);
    } else if (onClearTexture) {
      onClearTexture();
    }
    setClipStatusMessage('DXF Texture deleted');
    setTimeout(() => {
      setClipStatusMessage(null);
      contextMenuService.close();
    }, 450);
  };

  const handleTextureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJpg = file.type === 'image/jpeg' || 
                  file.name.toLowerCase().endsWith('.jpg') || 
                  file.name.toLowerCase().endsWith('.jpeg');
    if (!isJpg) {
      alert('Invalid format. Only JPEG/JPG texture files are allowed (PNG is disabled).');
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      if (layerId && onLayerTextureChange) {
        onLayerTextureChange(layerId, url, file.name);
      } else {
        onTextureUrlChange?.(url, file.name);
      }
      setClipStatusMessage(`Applied texture: ${file.name}`);
      setTimeout(() => setClipStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to load JPEG texture.');
    }
  };

  const handleDeleteFeature = () => {
    // If the clicked feature is the draped DXF texture or boundary
    const isDrapeEntity = state.entity?.id === 'dxf-site-boundary-drape' || 
      (typeof state.entity?.id === 'string' && state.entity.id.startsWith('dxf-site-boundary-drape-')) ||
      state.data?.isDxfTexture;

    if (isDrapeEntity) {
      if (layerId && onLayerTextureChange) {
        onLayerTextureChange(layerId, null, null);
      } else if (onTextureUrlChange) {
        onTextureUrlChange(null, null);
      } else if (onClearTexture) {
        onClearTexture();
      }
    }

    const featId = state.data?.featureId;
    if (featId !== undefined && onDeleteFeature) {
      onDeleteFeature(layerId, featId);
    } else if (layerId && onDeleteLayer) {
      onDeleteLayer(layerId);
    }
    if (viewer && !viewer.isDestroyed() && state.entity) {
      try {
        viewer.entities.remove(state.entity);
      } catch (err) {
        console.warn('Failed to remove entity:', err);
      }
    }
    contextMenuService.close();
  };

  const handleDeleteLayer = () => {
    // If the clicked layer is the draped DXF texture
    const isDrapeEntity = state.entity?.id === 'dxf-site-boundary-drape' || 
      (typeof state.entity?.id === 'string' && state.entity.id.startsWith('dxf-site-boundary-drape-')) ||
      state.data?.isDxfTexture;

    if (isDrapeEntity) {
      if (layerId && onLayerTextureChange) {
        onLayerTextureChange(layerId, null, null);
      } else if (onTextureUrlChange) {
        onTextureUrlChange(null, null);
      } else if (onClearTexture) {
        onClearTexture();
      }
    }

    if (layerId && onDeleteLayer) {
      onDeleteLayer(layerId);
    } else if (viewer && !viewer.isDestroyed() && state.entity) {
      try {
        viewer.entities.remove(state.entity);
      } catch (err) {
        console.warn('Failed to remove entity:', err);
      }
    }
    contextMenuService.close();
  };

  // 3D Clipping handlers
  const handleEnable3dClipping = (mode: 'inside' | 'outside' = 'inside') => {
    try {
      // 1. Gather coordinates from feature or bounds
      let coords: { lon: number; lat: number }[] = [];

      const parsePt = (pt: any): { lon: number; lat: number } | null => {
        if (!pt) return null;
        if (Array.isArray(pt) && pt.length >= 2) {
          const lon = Number(pt[0]);
          const lat = Number(pt[1]);
          if (!isNaN(lon) && !isNaN(lat)) return { lon, lat };
        }
        if (typeof pt === 'object') {
          if ('x' in pt && 'y' in pt && 'z' in pt) {
            try {
              const carto = Cesium.Cartographic.fromCartesian(pt);
              if (carto) {
                return {
                  lon: Cesium.Math.toDegrees(carto.longitude),
                  lat: Cesium.Math.toDegrees(carto.latitude)
                };
              }
            } catch (_) {}
          }
          const lon = Number(pt.lon ?? pt.lng ?? pt.longitude ?? pt.x);
          const lat = Number(pt.lat ?? pt.latitude ?? pt.y);
          if (!isNaN(lon) && !isNaN(lat)) return { lon, lat };
        }
        return null;
      };

      if (state.data?.positions && Array.isArray(state.data.positions) && state.data.positions.length > 0) {
        state.data.positions.forEach((p: any) => {
          const pt = parsePt(p);
          if (pt) coords.push(pt);
        });
      }

      // If entity has polygon hierarchy in Cesium entity
      if (coords.length < 3 && state.entity?.polygon?.hierarchy) {
        try {
          const hier = (state.entity.polygon.hierarchy as any)?.getValue?.(Cesium.JulianDate.now());
          const posList = Array.isArray(hier) ? hier : (hier?.positions || []);
          if (Array.isArray(posList) && posList.length >= 3) {
            posList.forEach((c: Cesium.Cartesian3) => {
              const carto = Cesium.Cartographic.fromCartesian(c);
              if (carto) {
                coords.push({
                  lon: Cesium.Math.toDegrees(carto.longitude),
                  lat: Cesium.Math.toDegrees(carto.latitude)
                });
              }
            });
          }
        } catch (_) {}
      }

      // If entity has polyline positions in Cesium entity
      if (coords.length < 2 && state.entity?.polyline?.positions) {
        try {
          const posList = (state.entity.polyline.positions as any)?.getValue?.(Cesium.JulianDate.now());
          if (Array.isArray(posList) && posList.length >= 2) {
            posList.forEach((c: Cesium.Cartesian3) => {
              const carto = Cesium.Cartographic.fromCartesian(c);
              if (carto) {
                coords.push({
                  lon: Cesium.Math.toDegrees(carto.longitude),
                  lat: Cesium.Math.toDegrees(carto.latitude)
                });
              }
            });
          }
        } catch (_) {}
      }

      // If only 2 points (a line in DXF), expand to an oriented corridor buffer rectangle so it has 4 vertices
      if (coords.length === 2) {
        const p1 = coords[0];
        const p2 = coords[1];
        const angle = Math.atan2(p2.lat - p1.lat, (p2.lon - p1.lon) * Math.cos(p1.lat * Math.PI / 180));
        const perp = angle + Math.PI / 2;
        const bufferMeters = 8; // 8m width corridor
        const dLat = (bufferMeters / 111320) * Math.sin(perp);
        const dLon = (bufferMeters / (111320 * Math.max(0.1, Math.cos(p1.lat * Math.PI / 180)))) * Math.cos(perp);
        coords = [
          { lon: p1.lon + dLon, lat: p1.lat + dLat },
          { lon: p2.lon + dLon, lat: p2.lat + dLat },
          { lon: p2.lon - dLon, lat: p2.lat - dLat },
          { lon: p1.lon - dLon, lat: p1.lat - dLat }
        ];
      }

      // If still fewer than 3 points, fallback to bounds
      if (coords.length < 3 && state.data?.bounds) {
        const b = state.data.bounds;
        const minW = Math.max(0.0001, (b.east - b.west));
        const minH = Math.max(0.0001, (b.north - b.south));
        const midX = (b.west + b.east) / 2;
        const midY = (b.south + b.north) / 2;
        coords = [
          { lon: midX - minW / 2, lat: midY - minH / 2 },
          { lon: midX + minW / 2, lat: midY - minH / 2 },
          { lon: midX + minW / 2, lat: midY + minH / 2 },
          { lon: midX - minW / 2, lat: midY + minH / 2 }
        ];
      } else if (coords.length < 3 && state.data?.centerCoordinate) {
        const lat = state.data.centerCoordinate.latitude;
        const lon = state.data.centerCoordinate.longitude;
        const d = 0.00015; // ~15m radius
        coords = [
          { lon: lon - d, lat: lat - d },
          { lon: lon + d, lat: lat - d },
          { lon: lon + d, lat: lat + d },
          { lon: lon - d, lat: lat + d }
        ];
      }

      if (coords.length < 3) {
        setClipStatusMessage('Insufficient geometry vertices for 3D clipping');
        setTimeout(() => setClipStatusMessage(null), 2500);
        return;
      }

      // Enforce Counter-Clockwise (CCW) winding order for Cesium ClippingPolygon
      let signedArea = 0;
      for (let i = 0; i < coords.length; i++) {
        const j = (i + 1) % coords.length;
        signedArea += (coords[j].lon - coords[i].lon) * (coords[j].lat + coords[i].lat);
      }
      if (signedArea > 0) {
        coords.reverse();
      }

      // Compute bounding box
      let minLon = coords[0].lon;
      let maxLon = coords[0].lon;
      let minLat = coords[0].lat;
      let maxLat = coords[0].lat;
      coords.forEach((p) => {
        if (p.lon < minLon) minLon = p.lon;
        if (p.lon > maxLon) maxLon = p.lon;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      });

      const clippingId = `clipping-dxf-${layerId || 'layer'}-${state.data?.featureId || Date.now()}`;
      const newClippingLayer = {
        id: clippingId,
        name: `3D Clip: ${state.layerName || 'CAD Boundary'}`,
        type: 'clipping_polygon',
        visible: true,
        opacity: 0.2,
        color: fillColor || strokeColor || '#f59e0b',
        positions: coords,
        bounds: { minLon, maxLon, minLat, maxLat },
        inverse: mode === 'outside',
        sourceDxfLayerId: layerId,
        sourceDxfFeatureId: String(state.data?.featureId || '')
      };

      // Remove any previous clipping for this entity, and add updated
      const filtered = (importedLayers || []).filter(
        (l: any) =>
          !(l.type === 'clipping_polygon' &&
            (l.sourceDxfFeatureId === String(state.data?.featureId) || l.id === clippingId))
      );

      const updatedLayers = [...filtered, newClippingLayer];
      onImportedLayersChange?.(updatedLayers);
      onClippingModeChange?.(mode);
      onActiveLayerIdChange?.(clippingId);

      setClipStatusMessage(`3D Clipping active (${mode === 'inside' ? 'Excavating Inside' : 'Isolating Outside'})`);
      setTimeout(() => {
        setClipStatusMessage(null);
      }, 2500);
    } catch (err: any) {
      console.error('Error enabling 3D clipping:', err);
      setClipStatusMessage(`Clipping error: ${err?.message || 'Failed to initialize'}`);
      setTimeout(() => setClipStatusMessage(null), 3000);
    }
  };

  const handleDisable3dClipping = () => {
    if (!activeClippingLayer) return;

    const filtered = (importedLayers || []).filter((l: any) => l.id !== activeClippingLayer.id);
    onImportedLayersChange?.(filtered);

    // If no more clipping polygons, turn off clipping mode
    const remainingClipping = filtered.filter((l: any) => l.type === 'clipping_polygon');
    if (remainingClipping.length === 0) {
      onClippingModeChange?.('none');
    }

    setClipStatusMessage('3D Clipping disabled');
    setTimeout(() => {
      setClipStatusMessage(null);
    }, 1800);
  };

  const handleToggleClippingInversion = () => {
    if (!activeClippingLayer) return;
    const nextInverse = !activeClippingLayer.inverse;
    const nextMode = nextInverse ? 'outside' : 'inside';

    const updated = (importedLayers || []).map((l: any) => {
      if (l.id === activeClippingLayer.id) {
        return { ...l, inverse: nextInverse };
      }
      return l;
    });

    onImportedLayersChange?.(updated);
    onClippingModeChange?.(nextMode);

    setClipStatusMessage(`Switched to ${nextMode === 'inside' ? 'Excavate Inside' : 'Isolate Outside'}`);
    setTimeout(() => setClipStatusMessage(null), 1800);
  };

  // Style update handlers matching sidebar parameters
  const applyStyleUpdate = (updates: Partial<GisLayer & ParcelStyleConfig>) => {
    const targetLayerId = layerId || currentLayer?.id;
    if (targetLayerId && onUpdateLayerStyle) {
      onUpdateLayerStyle(targetLayerId, updates);
    }

    // Direct entity graphics update for real-time responsiveness in Cesium
    if (viewer && !viewer.isDestroyed()) {
      try {
        const curFill = updates.showFill !== undefined ? updates.showFill : showFill;
        const curFillCol = updates.fillColor || fillColor;
        const curFillOp = updates.fillOpacity !== undefined ? updates.fillOpacity : fillOpacity;

        const curBorder = updates.showBorder !== undefined 
          ? updates.showBorder 
          : (updates.showStroke !== undefined ? updates.showStroke : showBorder);
        const curStrokeCol = updates.strokeColor || strokeColor;
        const curStrokeOp = updates.borderOpacity !== undefined 
          ? updates.borderOpacity 
          : (updates.strokeOpacity !== undefined ? updates.strokeOpacity : borderOpacity);
        const curStrokeW = updates.strokeWidth !== undefined ? updates.strokeWidth : strokeWidth;

        let fillCesiumColor: Cesium.Color;
        try {
          fillCesiumColor = Cesium.Color.fromCssColorString(curFillCol).withAlpha(curFill ? curFillOp : 0);
        } catch (_) {
          fillCesiumColor = Cesium.Color.RED.withAlpha(curFill ? curFillOp : 0);
        }

        let strokeCesiumColor: Cesium.Color;
        try {
          strokeCesiumColor = Cesium.Color.fromCssColorString(curStrokeCol).withAlpha(curBorder ? curStrokeOp : 0);
        } catch (_) {
          strokeCesiumColor = Cesium.Color.RED.withAlpha(curBorder ? curStrokeOp : 0);
        }

        const updateEnt = (ent: Cesium.Entity) => {
          if (ent.polyline) {
            ent.polyline.show = new Cesium.ConstantProperty(curBorder && curStrokeOp > 0);
            ent.polyline.material = new Cesium.ColorMaterialProperty(strokeCesiumColor);
            if (curStrokeW) {
              ent.polyline.width = new Cesium.ConstantProperty(curStrokeW);
            }
          }
          if (ent.polygon) {
            ent.polygon.fill = new Cesium.ConstantProperty(curFill && curFillOp > 0);
            ent.polygon.material = new Cesium.ColorMaterialProperty(fillCesiumColor);
            if (!curFill || curFillOp <= 0) {
              ent.polygon.shadows = new Cesium.ConstantProperty(Cesium.ShadowMode.DISABLED);
            }
          }
        };

        if (state.entity) {
          updateEnt(state.entity);
        }

        // If targetLayerId is present, update all entities belonging to this layer
        if (viewer.entities) {
          const allEnts = viewer.entities.values;
          for (let i = 0; i < allEnts.length; i++) {
            const ent = allEnts[i];
            if (!ent || !ent.id) continue;
            const idStr = String(ent.id);
            if (
              (targetLayerId && (idStr.startsWith(`shapefile-feature-${targetLayerId}-`) || idStr.includes(targetLayerId))) ||
              (state.layerName && idStr.includes(state.layerName))
            ) {
              updateEnt(ent);
            }
          }
        }

        // Also call updateParcelStyles to ensure any underlying datasource / polygon geometry is updated
        updateParcelStyles(viewer, {
          showFill: curFill,
          fillColor: curFillCol,
          fillOpacity: curFillOp,
          showBorder: curBorder,
          showStroke: curBorder,
          strokeColor: curStrokeCol,
          strokeWidth: curStrokeW,
          borderOpacity: curStrokeOp,
          strokeOpacity: curStrokeOp
        }, targetLayerId);

        viewer.scene.requestRender();
      } catch (err) {
        console.warn('Direct Cesium entity style update:', err);
      }
    }
  };

  const handleShowFillChange = (val: boolean) => {
    setShowFill(val);
    applyStyleUpdate({ showFill: val });
  };

  const handleFillColorChange = (col: string) => {
    setFillColor(col);
    applyStyleUpdate({ fillColor: col, customColor: col });
  };

  const handleFillOpacityChange = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setFillOpacity(clamped);
    applyStyleUpdate({ fillOpacity: clamped, opacity: clamped });
  };

  const handleShowBorderChange = (val: boolean) => {
    setShowBorder(val);
    applyStyleUpdate({ showBorder: val, showStroke: val });
  };

  const handleStrokeColorChange = (col: string) => {
    setStrokeColor(col);
    applyStyleUpdate({ strokeColor: col });
  };

  const handleStrokeWidthChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(20, val));
    setStrokeWidth(clamped);
    applyStyleUpdate({ strokeWidth: clamped, lineWidth: clamped });
  };

  const handleBorderOpacityChange = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setBorderOpacity(clamped);
    applyStyleUpdate({ borderOpacity: clamped, strokeOpacity: clamped });
  };

  const isLight = theme === 'light';

  const currentX = position ? position.x : safeX;
  const currentY = position ? position.y : safeY;

  return (
    <div
      ref={menuRef}
      id="cad-gis-context-menu"
      style={{
        top: `${currentY}px`,
        left: `${currentX}px`
      }}
      className={`fixed z-50 w-80 max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl backdrop-blur-md border text-xs select-none transition-shadow duration-75 animate-in fade-in zoom-in-95 ${
        isDragging ? 'ring-2 ring-blue-500/50 shadow-blue-500/30' : ''
      } ${
        isLight
          ? 'bg-white/95 text-slate-900 border-slate-200 shadow-slate-400/20'
          : 'bg-slate-950/95 text-slate-100 border-white/10 shadow-black/80'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Draggable Header with Layer and Source File info */}
      <div
        onMouseDown={handleHeaderMouseDown}
        onTouchStart={handleHeaderTouchStart}
        title="Drag anywhere to reposition menu"
        className={`px-3 py-2.5 border-b flex items-start justify-between gap-2 select-none cursor-grab active:cursor-grabbing ${
          isDragging ? 'cursor-grabbing bg-blue-500/10' : ''
        } ${
          isLight ? 'border-slate-100 bg-slate-50/80 rounded-t-xl' : 'border-white/10 bg-white/[0.04] rounded-t-xl'
        }`}
      >
        <div className="min-w-0 flex-1 pointer-events-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {isDxf ? (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-blue-500/20 text-blue-400 shrink-0">
                DXF
              </span>
            ) : (
              <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}
            <span
              className={`font-semibold font-mono truncate text-[11px] ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              }`}
              title={state.layerName}
            >
              {state.layerName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono truncate">
            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate" title={state.sourceFile}>
              {state.sourceFile}
            </span>
          </div>
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => contextMenuService.close()}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer shrink-0"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status banner if active */}
      {clipStatusMessage && (
        <div className="px-3 py-1.5 bg-blue-500/15 border-b border-blue-500/20 text-blue-400 text-[10px] font-medium flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 shrink-0 animate-pulse" />
          <span className="truncate">{clipStatusMessage}</span>
        </div>
      )}

      {/* Action Items */}
      <div className="p-1.5 space-y-1 font-sans">
        {/* DXF TEXTURE SECTION */}
        {isDxf && (
          <div
            className={`p-2 rounded-lg border ${
              hasActiveTexture
                ? 'border-purple-500/40 bg-purple-500/10'
                : isLight
                ? 'border-slate-200 bg-slate-50'
                : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1.5 font-medium text-[11px]">
                <Image className={`w-3.5 h-3.5 ${hasActiveTexture ? 'text-purple-400' : 'text-slate-400'}`} />
                <span>DXF Draped Texture</span>
              </div>
              {hasActiveTexture ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/20 text-purple-300 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  TRUE NORTH
                </span>
              ) : (
                <span className="text-[9px] text-slate-400 font-mono">No Texture</span>
              )}
            </div>

            {hasActiveTexture ? (
              <div className="space-y-1.5 mt-1">
                <div className="flex items-center gap-2">
                  {activeTextureUrl && (
                    <div className="relative w-10 h-8 border border-white/10 rounded overflow-hidden bg-slate-950 flex items-center justify-center shrink-0">
                      <img
                        src={activeTextureUrl}
                        className="max-w-full max-h-full object-contain"
                        alt="DXF Texture"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold truncate text-slate-200" title={activeTextureName || ''}>
                      {activeTextureName || 'Plan Drawing (JPG)'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      Stretched over boundary
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={handleDeleteTexture}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                    title="Delete this texture from DXF"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>Delete Texture</span>
                  </button>

                  <label className={`px-2 py-1 rounded text-[10px] font-medium transition-colors border cursor-pointer flex items-center gap-1 ${
                    isLight
                      ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                      : 'border-white/15 bg-white/5 hover:bg-white/10 text-slate-300'
                  }`} title="Replace with another JPG plan drawing">
                    <Upload className="w-3 h-3 text-slate-400" />
                    <span>Replace</span>
                    <input
                      type="file"
                      ref={textureFileInputRef}
                      accept="image/jpeg, image/jpg"
                      onChange={handleTextureFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="mt-1">
                <label className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-semibold border border-dashed cursor-pointer transition-colors ${
                  isLight
                    ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700'
                    : 'border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300'
                }`} title="Upload JPG drawing to drape across DXF boundary">
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Upload Texture to DXF</span>
                  <input
                    type="file"
                    ref={textureFileInputRef}
                    accept="image/jpeg, image/jpg"
                    onChange={handleTextureFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* 1. 3D CLIPPING SECTION FOR DXF & CAD OBJECTS */}
        <div
          className={`p-2 rounded-lg border ${
            isClippingActive
              ? 'border-amber-500/40 bg-amber-500/10'
              : isLight
              ? 'border-slate-200 bg-slate-50'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-1.5 font-medium text-[11px]">
              <Scissors className={`w-3.5 h-3.5 ${isClippingActive ? 'text-amber-400' : 'text-sky-400'}`} />
              <span>3D Tiles Clipping</span>
            </div>
            {isClippingActive ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400">
                Active ({activeClippingLayer?.inverse ? 'Outside' : 'Inside'})
              </span>
            ) : (
              <span className="text-[9px] text-slate-400">DXF Footprint</span>
            )}
          </div>

          {isClippingActive ? (
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleClippingInversion}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors border cursor-pointer ${
                    isLight
                      ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                      : 'border-white/15 bg-white/5 hover:bg-white/10 text-slate-200'
                  }`}
                  title="Invert 3D clipping inside/outside"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Invert: {activeClippingLayer?.inverse ? 'Excavate' : 'Isolate'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisable3dClipping}
                  className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/30 cursor-pointer"
                >
                  Disable
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <button
                type="button"
                onClick={() => handleEnable3dClipping('inside')}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors border-0 cursor-pointer shadow-sm"
              >
                <Scissors className="w-3 h-3" />
                <span>Clip Inside (Excavate)</span>
              </button>

              <button
                type="button"
                onClick={() => handleEnable3dClipping('outside')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors border cursor-pointer ${
                  isLight
                    ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
                title="Isolate 3D tiles within boundary"
              >
                Isolate
              </button>
            </div>
          )}
        </div>

        {/* 2. STYLE CONTROL SECTION - EXACT MATCH TO SIDEBAR PARAMETERS */}
        <div
          className={`rounded-xl border transition-colors ${
            isLight ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsStyleOpen(!isStyleOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-left border-0 bg-transparent cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-xs">
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              <span>Style Controls</span>
              <div
                className="w-2.5 h-2.5 rounded-full border border-white/40 ml-0.5"
                style={{ backgroundColor: showFill ? fillColor : strokeColor }}
              />
            </div>
            {isStyleOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isStyleOpen && (
            <div className="p-2.5 pt-0 space-y-3">
              {/* Card 1: SHOW FILL */}
              <div className={`p-3 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
              }`}>
                {/* Fill Toggle Checkbox */}
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="ctx-show-fill-checkbox" 
                    className="flex items-center gap-2 cursor-pointer select-none font-semibold text-xs"
                  >
                    <input
                      id="ctx-show-fill-checkbox"
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
                        FILL COLOR
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          id="ctx-fill-color-picker"
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
                            id="ctx-fill-opacity-input"
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
                        id="ctx-fill-opacity-slider"
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

              {/* Card 2: SHOW BORDER */}
              <div className={`p-3 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
              }`}>
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="ctx-show-border-toggle"
                    className="flex items-center gap-2 cursor-pointer select-none font-semibold text-xs"
                  >
                    <input
                      id="ctx-show-border-toggle"
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
                        STROKE COLOR
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          id="ctx-stroke-color-picker"
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
                            id="ctx-stroke-width-input"
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
                        id="ctx-stroke-width-slider"
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
                            id="ctx-border-opacity-input"
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
                        id="ctx-border-opacity-slider"
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
            </div>
          )}
        </div>

        {/* 3. CORE GIS ACTIONS */}
        {isDxf ? (
          <button
            type="button"
            onClick={handleFlyToLayer}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 ${
              isLight ? 'bg-purple-50 hover:bg-purple-100 text-purple-700' : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300'
            }`}
            title="Fly to entire DXF CAD layer boundary"
          >
            <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="font-medium text-xs">Fly to layer (for DXF)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFlyToLayer}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent ${
              isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
            }`}
            title="Fly to entire layer extent"
          >
            <Compass className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs">Fly to Layer</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleZoomToFeature}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent ${
            isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          <span>Zoom to Feature</span>
        </button>

        <button
          type="button"
          onClick={handleViewAttributes}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent ${
            isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>Inspect Attributes</span>
        </button>

        <button
          type="button"
          onClick={handleToggleVisibility}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent ${
            isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          {isLayerVisible ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Hide Layer</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Show Layer</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCopyAttributes}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent ${
            isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          {copiedKey === 'attributes' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy JSON Properties</span>
            </>
          )}
        </button>

        <div className={`my-1 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`} />

        {/* Direct Delete DXF Texture action */}
        {hasActiveTexture && isDxf && (
          <button
            type="button"
            onClick={handleDeleteTexture}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 group mb-1"
            title="Delete the draped DXF texture"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-xs text-rose-200">Delete DXF Texture</span>
            </div>
            {activeTextureName && (
              <span className="text-[10px] font-mono text-rose-300/80 truncate max-w-[110px] ml-2">
                {activeTextureName}
              </span>
            )}
          </button>
        )}

        {state.data?.featureId !== undefined ? (
          <>
            <button
              type="button"
              onClick={handleDeleteFeature}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
              title="Delete this specific clicked object / entity"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Selected Object</span>
            </button>
            {layerId && (
              <button
                type="button"
                onClick={handleDeleteLayer}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent text-[11px] ${
                  isLight ? 'text-slate-500 hover:bg-slate-100 hover:text-red-600' : 'text-slate-400 hover:bg-white/10 hover:text-red-300'
                }`}
                title="Delete the entire layer containing this object"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Remove Entire Layer ({state.layerName || 'Layer'})</span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={handleDeleteLayer}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer border-0 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Layer / Entity</span>
          </button>
        )}
      </div>

      {/* Coordinate footer if available */}
      {state.data?.centerCoordinate && (
        <div
          className={`px-3 py-1.5 border-t text-[9px] font-mono flex items-center justify-between text-slate-400 ${
            isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 text-slate-500" />
            <span>
              {state.data.centerCoordinate.latitude.toFixed(4)}°, {state.data.centerCoordinate.longitude.toFixed(4)}°
            </span>
          </div>
          {state.data.properties?.ZONING && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold uppercase">
              {String(state.data.properties.ZONING)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
