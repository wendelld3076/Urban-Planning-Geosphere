import React, { useEffect, useState, useRef } from 'react';
import * as Cesium from 'cesium';
import JSZip from 'jszip';
import { UploadCloud, Layers, Box, CheckCircle2, AlertCircle, Loader2, X, FileCode, Image } from 'lucide-react';
import { parseDxfFile } from '../utils/dxfParser';
import { parseShapefileZip } from '../utils/shapefileParser';
import { parseGeospatialMetadata } from '../utils/modelMetadata';
import { PolygonData, ShapefileData, GisLayer } from '../types';

export interface ViewportDropZoneProps {
  viewer: Cesium.Viewer | null;
  container?: HTMLElement | null;
  boundaryCenter?: { latitude: number; longitude: number } | null;
  workspaceOrigin?: { lat: number; lng: number } | null;
  selectedCrs?: string;
  polygonData?: PolygonData | null;
  gisLayers?: GisLayer[];
  textureUrl?: string | null;
  textureName?: string | null;
  onTextureUrlChange?: (url: string | null, filename: string | null) => void;
  onLayerTextureChange?: (layerId: string, url: string | null, filename: string | null) => void;
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
  onModelLatitudeChange?: (lat: number) => void;
  onModelLongitudeChange?: (lon: number) => void;
  onModelHeightChange?: (height: number) => void;
  onLocalVectorChange?: (url: string | null, name: string | null, type: 'geojson' | 'kml' | null) => void;
  onIsPickingLocationChange?: (isPicking: boolean) => void;
  importDxfToCesium?: (fileText: string, fileName: string) => Promise<void> | void;
  importZippedShapefileToCesium?: (arrayBuffer: ArrayBuffer, fileName: string) => Promise<void> | void;
  importGlbToCesium?: (file: File) => Promise<void> | void;
}

export const ViewportDropZone: React.FC<ViewportDropZoneProps> = ({
  viewer,
  container,
  boundaryCenter,
  workspaceOrigin,
  selectedCrs = 'INHERITED_UTM',
  polygonData,
  gisLayers = [],
  textureUrl,
  textureName,
  onTextureUrlChange,
  onLayerTextureChange,
  onPolygonDataChange,
  onAddGisLayer,
  onModelUrlChange,
  onModelLatitudeChange,
  onModelLongitudeChange,
  onModelHeightChange,
  onLocalVectorChange,
  onIsPickingLocationChange,
  importDxfToCesium,
  importZippedShapefileToCesium,
  importGlbToCesium
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    detail?: string;
  } | null>(null);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);

  const showToast = (type: 'success' | 'error' | 'info', title: string, detail?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, title, detail });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 7000);
  };

  /**
   * Computes the current geographic center under the Cesium camera crosshairs or screen center.
   */
  const getViewportCenter = (): { latitude: number; longitude: number } => {
    try {
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
            return { latitude: lat, longitude: lng };
          }
        }
      }
    } catch (_) {}

    return (
      boundaryCenter ||
      (workspaceOrigin
        ? { latitude: workspaceOrigin.lat, longitude: workspaceOrigin.lng }
        : { latitude: 24.4539, longitude: 54.3773 })
    );
  };

  /**
   * Smoothly flies the Cesium camera to the bounding box of the imported polygon geometry.
   */
  const flyToPolygonBounds = (bounds: { west: number; south: number; east: number; north: number }) => {
    if (!viewer || viewer.isDestroyed()) return;
    try {
      const rect = Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north);
      const boundingSphere = Cesium.BoundingSphere.fromRectangle3D(rect);
      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 2.5,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-45),
          Math.max(boundingSphere.radius * 1.8, 150)
        )
      });
    } catch (e) {
      console.warn('Could not fly to polygon bounds:', e);
    }
  };

  /**
   * Default handler for DXF files dropped onto the viewport.
   */
  const defaultImportDxfToCesium = async (fileText: string, fileName: string) => {
    setIsProcessing(true);
    setStatusMessage(`Parsing & reprojecting DXF: ${fileName}...`);
    try {
      const center = getViewportCenter();
      const parsedData = parseDxfFile(
        fileText,
        selectedCrs,
        center,
        fileName,
        workspaceOrigin || { lat: center.latitude, lng: center.longitude },
        true
      );

      if (onPolygonDataChange) {
        onPolygonDataChange(parsedData.polygonData, fileName, parsedData.shapefileData);
      }
      if (onAddGisLayer) {
        onAddGisLayer(parsedData.polygonData, fileName, parsedData.shapefileData);
      }

      if (parsedData.polygonData?.bounds) {
        flyToPolygonBounds(parsedData.polygonData.bounds);
      }

      const count = parsedData.shapefileData?.features?.length || 0;
      showToast(
        'success',
        'AutoCAD DXF Imported',
        `${fileName} (${count} closed boundary entities reprojected to WGS84 ellipsoid)`
      );
    } catch (err: any) {
      console.error('DXF drop parsing error:', err);
      showToast(
        'error',
        'DXF Import Failed',
        err.message || 'Ensure the file contains valid LWPOLYLINE boundary layers.'
      );
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };

  /**
   * Default handler for zipped archives dropped onto the viewport.
   * Checks whether the archive is a 3D Tileset (tileset.json) or an ESRI Shapefile (.shp/.dbf/.shx).
   */
  const defaultImportZippedShapefileToCesium = async (arrayBuffer: ArrayBuffer, fileName: string) => {
    setIsProcessing(true);
    setStatusMessage(`Inspecting archive: ${fileName}...`);

    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 1. Check if it is a 3D Tiles zip containing tileset.json
      let tilesetEntry: any = null;
      let tilesetPath = '';
      for (const [path, entry] of Object.entries(zip.files)) {
        if (!entry.dir && path.toLowerCase().endsWith('tileset.json')) {
          tilesetEntry = entry;
          tilesetPath = path;
          break;
        }
      }

      if (tilesetEntry) {
        setStatusMessage(`Extracting 3D Tileset: ${fileName}...`);
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

        onModelUrlChange?.(`virtual://zip-tileset/tileset.json`, fileName, zipFiles);
        showToast('success', '3D Tileset Archive Loaded', `${fileName} streaming tiles ready.`);
        return;
      }

      // 2. Parse as ESRI Shapefile (.shp, .dbf, .shx)
      setStatusMessage(`Parsing Shapefile parcels: ${fileName}...`);
      const center = getViewportCenter();
      const parsedData = await parseShapefileZip(arrayBuffer, false, center);

      if (onPolygonDataChange) {
        onPolygonDataChange(parsedData.polygonData, fileName, parsedData.shapefileData);
      }
      if (onAddGisLayer) {
        onAddGisLayer(parsedData.polygonData, fileName, parsedData.shapefileData);
      }

      if (parsedData.polygonData?.bounds) {
        flyToPolygonBounds(parsedData.polygonData.bounds);
      }

      const count = parsedData.shapefileData?.features?.length || 0;
      showToast(
        'success',
        'Shapefile Archive Imported',
        `${fileName} (${count} parcels parsed with full attributes)`
      );
    } catch (err: any) {
      console.error('Shapefile drop parsing error:', err);
      showToast(
        'error',
        'Shapefile Import Failed',
        err.message || 'Ensure the zip contains .shp, .dbf, and .shx files.'
      );
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };

  /**
   * Default handler for 3D GLB/GLTF model files dropped onto the viewport.
   */
  const defaultImportGlbToCesium = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage(`Loading 3D Model: ${file.name}...`);
    try {
      const url = URL.createObjectURL(file);
      onModelUrlChange?.(url, file.name);

      const meta = await parseGeospatialMetadata(file);
      if (meta && meta.latitude !== undefined && meta.longitude !== undefined) {
        onModelLatitudeChange?.(meta.latitude);
        onModelLongitudeChange?.(meta.longitude);
        if (meta.height !== undefined) onModelHeightChange?.(meta.height);

        if (viewer && !viewer.isDestroyed()) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              meta.longitude,
              meta.latitude,
              (meta.height || 0) + 250
            ),
            duration: 2.5
          });
        }
        showToast(
          'success',
          'Georeferenced 3D Model Placed',
          `${file.name} located at (${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)})`
        );
      } else {
        // Non-georeferenced model: position at current viewport center and enable picking
        const center = getViewportCenter();
        onModelLatitudeChange?.(center.latitude);
        onModelLongitudeChange?.(center.longitude);
        onModelHeightChange?.(0);
        onIsPickingLocationChange?.(true);

        if (viewer && !viewer.isDestroyed()) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, 300),
            duration: 2.0
          });
        }
        showToast(
          'info',
          '3D Model Imported',
          `${file.name} placed at viewport center. Left-click anywhere on the terrain to adjust position.`
        );
      }
    } catch (err: any) {
      console.error('3D model drop error:', err);
      showToast('error', 'Model Import Failed', err.message || 'Failed to parse 3D asset.');
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };

  // Attach Drag-and-Drop event listeners to the Cesium canvas container
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const targetContainer = container || viewer.container;
    if (!targetContainer) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'dxf') {
          // Route directly to DXF parser
          const fileText = await file.text();
          const handler = importDxfToCesium || defaultImportDxfToCesium;
          await handler(fileText, file.name);
        } else if (ext === 'jpg' || ext === 'jpeg') {
          // Direct drag-and-drop texture onto DXF object or active CAD boundary in viewport
          const cadLayers = (gisLayers || []).filter(
            (l: any) => l.shapefileData?.isCad || l.name?.toLowerCase().endsWith('.dxf')
          );
          const hasDxfBoundary =
            cadLayers.length > 0 ||
            Boolean(polygonData?.positions && polygonData.positions.length > 0);

          if (!hasDxfBoundary) {
            showToast(
              'error',
              'No Active DXF Boundary',
              'Please drop or import a CAD .dxf file first before draping a texture.'
            );
            continue;
          }

          // Spatially detect which DXF object or layer was dropped onto
          let targetLayer: any = null;
          if (viewer && !viewer.isDestroyed()) {
            try {
              const windowPosition = new Cesium.Cartesian2(e.clientX, e.clientY);
              // 1. Check picked entity or primitive
              const picked = viewer.scene.pick(windowPosition);
              if (Cesium.defined(picked)) {
                const pId = typeof picked.id === 'string' ? picked.id : picked.id?.id;
                if (typeof pId === 'string') {
                  const match =
                    pId.match(/shapefile-feature-([a-zA-Z0-9_-]+)/) ||
                    pId.match(/dxf-site-boundary-drape-([a-zA-Z0-9_-]+)/);
                  if (match && match[1]) {
                    targetLayer = (gisLayers || []).find((l: any) => l.id === match[1]) || null;
                  }
                }
              }

              // 2. If not found by direct pick, check ground pick coordinate raycast against CAD layer polygons
              if (!targetLayer) {
                const ray = viewer.camera.getPickRay(windowPosition);
                const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
                if (cartesian) {
                  const carto = Cesium.Cartographic.fromCartesian(cartesian);
                  const dropLng = Cesium.Math.toDegrees(carto.longitude);
                  const dropLat = Cesium.Math.toDegrees(carto.latitude);

                  // Test point-in-polygon against all CAD/DXF layers
                  for (const layer of cadLayers) {
                    if (layer.polygonData?.positions && layer.polygonData.positions.length >= 3) {
                      const vs = layer.polygonData.positions;
                      let inside = false;
                      for (let pi = 0, pj = vs.length - 1; pi < vs.length; pj = pi++) {
                        const xi = vs[pi][0];
                        const yi = vs[pi][1];
                        const xj = vs[pj][0];
                        const yj = vs[pj][1];
                        const intersect =
                          yi > dropLat !== yj > dropLat &&
                          dropLng < ((xj - xi) * (dropLat - yi)) / (yj - yi) + xi;
                        if (intersect) inside = !inside;
                      }
                      if (inside) {
                        targetLayer = layer;
                        break;
                      }
                    }
                  }
                }
              }
            } catch (pickErr) {
              console.warn('Drop raycast pick failed:', pickErr);
            }
          }

          // 3. Fallback: if user dropped on viewport but not directly inside a specific polygon,
          // target the active/most recent CAD layer, or first CAD layer
          if (!targetLayer) {
            if (cadLayers.length > 0) {
              const visibleCad = cadLayers.filter((l: any) => l.visible);
              targetLayer = visibleCad.length > 0 ? visibleCad[visibleCad.length - 1] : cadLayers[cadLayers.length - 1];
            }
          }

          try {
            const url = URL.createObjectURL(file);
            if (targetLayer && onLayerTextureChange) {
              onLayerTextureChange(targetLayer.id, url, file.name);
            } else {
              onTextureUrlChange?.(url, file.name);
            }
            showToast(
              'success',
              'DXF Texture Applied',
              targetLayer
                ? `${file.name} applied to "${targetLayer.name}" with True North offset.`
                : `${file.name} draped over CAD boundary with True North offset.`
            );
          } catch (err: any) {
            console.error('DXF texture drop error:', err);
            showToast('error', 'Texture Load Failed', 'Failed to load JPEG texture file.');
          }
        } else if (ext === 'png') {
          showToast(
            'error',
            'PNG Format Disabled',
            'Invalid format. Only JPEG/JPG texture files are allowed (PNG is disabled).'
          );
        } else if (ext === 'zip') {
          // Route zipped shapefile to shpjs / Shapefile parser
          const arrayBuffer = await file.arrayBuffer();
          const handler = importZippedShapefileToCesium || defaultImportZippedShapefileToCesium;
          await handler(arrayBuffer, file.name);
        } else if (ext === 'glb' || ext === 'gltf') {
          // Direct 3D model drops
          const handler = importGlbToCesium || defaultImportGlbToCesium;
          await handler(file);
        } else if (ext === 'geojson' || ext === 'kml') {
          const url = URL.createObjectURL(file);
          onLocalVectorChange?.(url, file.name, ext === 'geojson' ? 'geojson' : 'kml');
          showToast('success', `Imported ${ext.toUpperCase()}`, file.name);
        } else {
          showToast(
            'error',
            'Unsupported File Format',
            `"${file.name}" is not supported. Please drop .dxf, .jpg/.jpeg, .zip, or .glb/.gltf files.`
          );
        }
      }
    };

    targetContainer.addEventListener('dragenter', handleDragEnter);
    targetContainer.addEventListener('dragover', handleDragOver);
    targetContainer.addEventListener('dragleave', handleDragLeave);
    targetContainer.addEventListener('drop', handleDrop);

    return () => {
      targetContainer.removeEventListener('dragenter', handleDragEnter);
      targetContainer.removeEventListener('dragover', handleDragOver);
      targetContainer.removeEventListener('dragleave', handleDragLeave);
      targetContainer.removeEventListener('drop', handleDrop);
    };
  }, [
    viewer,
    container,
    boundaryCenter,
    workspaceOrigin,
    selectedCrs,
    polygonData,
    gisLayers,
    textureUrl,
    textureName,
    onTextureUrlChange,
    onPolygonDataChange,
    onAddGisLayer,
    onModelUrlChange,
    onModelLatitudeChange,
    onModelLongitudeChange,
    onModelHeightChange,
    onLocalVectorChange,
    onIsPickingLocationChange,
    importDxfToCesium,
    importZippedShapefileToCesium,
    importGlbToCesium
  ]);

  return (
    <>
      {/* Visual Drag-Over HUD Overlay */}
      {isDraggingOver && (
        <div
          id="viewport-dropzone-overlay"
          className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center p-6 bg-slate-950/75 backdrop-blur-[3px] transition-all duration-200"
        >
          <div className="w-full max-w-xl p-8 rounded-3xl border-2 border-dashed border-sky-400 bg-slate-900/90 shadow-2xl flex flex-col items-center text-center transform scale-100 transition-transform">
            <div className="p-4 rounded-2xl bg-sky-500/20 text-sky-400 mb-4 ring-8 ring-sky-500/10 animate-bounce">
              <UploadCloud className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-bold text-white tracking-wide">
              Drop Files onto 3D Globe
            </h3>
            <p className="text-xs text-slate-300 mt-2 max-w-md leading-relaxed">
              Release anywhere in the 3D viewport to automatically parse, reproject onto the WGS84 ellipsoid, and visualize directly on the terrain.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6 w-full">
              <div className="flex flex-col items-center p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <FileCode className="w-5 h-5 text-amber-400 mb-1" />
                <span className="text-[11px] font-bold text-slate-100">.DXF</span>
                <span className="text-[9px] text-slate-400 text-center leading-tight mt-0.5">AutoCAD CAD Footprint</span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-xl bg-slate-800/80 border border-purple-500/40">
                <Image className="w-5 h-5 text-purple-400 mb-1" />
                <span className="text-[11px] font-bold text-slate-100">.JPG / .JPEG</span>
                <span className="text-[9px] text-purple-300 text-center leading-tight mt-0.5">DXF Texture (True North)</span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <Layers className="w-5 h-5 text-emerald-400 mb-1" />
                <span className="text-[11px] font-bold text-slate-100">.ZIP</span>
                <span className="text-[9px] text-slate-400 text-center leading-tight mt-0.5">ESRI Shapefile Archive</span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <Box className="w-5 h-5 text-cyan-400 mb-1" />
                <span className="text-[11px] font-bold text-slate-100">.GLB / .GLTF</span>
                <span className="text-[9px] text-slate-400 text-center leading-tight mt-0.5">3D Asset / Building</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
              Direct Geospatial Viewport Ingestion Active
            </div>
          </div>
        </div>
      )}

      {/* Parsing / Processing HUD Indicator */}
      {isProcessing && (
        <div
          id="viewport-processing-indicator"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-950/95 border border-sky-500/50 shadow-2xl backdrop-blur-md font-mono text-xs text-sky-300 animate-fade-in"
        >
          <Loader2 className="w-4 h-4 animate-spin text-sky-400 flex-shrink-0" />
          <span className="font-semibold">{statusMessage || 'Processing geospatial dataset...'}</span>
        </div>
      )}

      {/* Floating Status Toast Notification */}
      {toast && (
        <div
          id="viewport-drop-toast"
          className={`absolute top-16 right-6 z-50 flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm border transition-all duration-300 animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-sky-950/90 border-sky-500/50 text-sky-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Box className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white tracking-wide">{toast.title}</h4>
            {toast.detail && <p className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">{toast.detail}</p>}
          </div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};

export default ViewportDropZone;
