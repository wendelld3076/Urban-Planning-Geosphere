import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  FolderOpen,
  Download,
  Upload,
  Database,
  Layers,
  Trash2,
  Check,
  X,
  RefreshCw,
  FileJson,
  TreePine,
  Box,
  Clock,
  Sparkles,
  HardDrive,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import {
  projectStorageService,
  StoredLayer,
  StoredProject
} from '../services/ProjectStorageService';
import { GisLayer, GlobeState } from '../types';

export interface SaveLoadToolbarProps {
  sidebarTheme?: 'light' | 'dark';
  isDrawerMode?: boolean;
  gisLayers?: GisLayer[];
  globeState?: GlobeState;
  placedTrees?: any[];
  treeModelUrl?: string;
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
  getCurrentCamera?: () => {
    position: { x: number; y: number; z: number };
    heading: number;
    pitch: number;
    roll: number;
    longitude?: number;
    latitude?: number;
    height?: number;
  } | null;
  onRestoreCamera?: (camera: {
    position: { x: number; y: number; z: number };
    heading: number;
    pitch: number;
    roll: number;
    longitude?: number;
    latitude?: number;
    height?: number;
  }) => void;
  onRestoreProject?: (project: StoredProject) => void;
  onRestoreLayer?: (layer: StoredLayer) => void;
  onGisLayersChange?: (layers: GisLayer[]) => void;
}

export const SaveLoadToolbar: React.FC<SaveLoadToolbarProps> = ({
  sidebarTheme = 'dark',
  isDrawerMode = false,
  gisLayers = [],
  globeState,
  placedTrees = [],
  treeModelUrl,
  modelData,
  getCurrentCamera,
  onRestoreCamera,
  onRestoreProject,
  onRestoreLayer,
  onGisLayersChange
}) => {
  const isLight = sidebarTheme === 'light';

  // Toolbar state
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('geosphere_saveload_toolbar_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Modal / popover state
  const [activeModal, setActiveModal] = useState<'none' | 'save' | 'load' | 'layers'>('none');
  const [projectName, setProjectName] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Stored items state
  const [savedProjects, setSavedProjects] = useState<StoredProject[]>([]);
  const [storedLayers, setStoredLayers] = useState<StoredLayer[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync expanded state to local storage
  useEffect(() => {
    try {
      localStorage.setItem('geosphere_saveload_toolbar_expanded', JSON.stringify(isExpanded));
    } catch (e) {
      console.warn('Could not persist toolbar state:', e);
    }
  }, [isExpanded]);

  // Load stored projects and layers when opening modals
  const refreshStorageData = async () => {
    try {
      const [projects, layers] = await Promise.all([
        projectStorageService.getAllProjects(),
        projectStorageService.getAllLayers()
      ]);
      setSavedProjects(projects);
      setStoredLayers(layers);
    } catch (err) {
      console.error('Error refreshing storage data:', err);
    }
  };

  useEffect(() => {
    if (activeModal !== 'none') {
      refreshStorageData();
    }
  }, [activeModal]);

  // Status message timer
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Open Save Modal with smart default project name
  const handleOpenSaveModal = () => {
    const defaultName = `Project ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    setProjectName(defaultName);
    setProjectDescription('');
    setActiveModal('save');
  };

  // Execute Save Project to IndexedDB
  const handleSaveCurrentProject = async (andExport: boolean = false) => {
    if (!projectName.trim()) {
      setStatusMessage({ text: 'Please enter a valid project name', type: 'error' });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Convert current GisLayers to StoredLayers
      const storedLayerList: StoredLayer[] = gisLayers.map(layer =>
        projectStorageService.gisLayerToStoredLayer(layer)
      );

      // 2. If placed trees exist, add tree layer
      if (placedTrees && placedTrees.length > 0) {
        storedLayerList.push(
          projectStorageService.placedTreesToStoredLayer(placedTrees, treeModelUrl)
        );
      }

      // 3. If model exists, add model layer
      if (modelData && modelData.url && modelData.latitude !== undefined && modelData.longitude !== undefined) {
        storedLayerList.push(
          projectStorageService.modelToStoredLayer({
            url: modelData.url,
            name: modelData.name || '3D Model',
            latitude: modelData.latitude,
            longitude: modelData.longitude,
            height: modelData.height || 0,
            heading: modelData.heading,
            pitch: modelData.pitch,
            roll: modelData.roll
          })
        );
      }

      // 4. Capture current camera
      const camera = getCurrentCamera ? getCurrentCamera() : null;

      // 5. Build project record
      const newProject: StoredProject = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: projectName.trim(),
        version: '1.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        description: projectDescription.trim() || undefined,
        camera: camera || undefined,
        globeState,
        layers: storedLayerList,
        placedTrees,
        modelData
      };

      // 6. Save to IndexedDB
      await projectStorageService.saveProject(newProject);

      // Also persist individual layers in the layers store for layer-level persistence
      if (storedLayerList.length > 0) {
        await projectStorageService.saveLayers(storedLayerList);
      }

      if (andExport) {
        projectStorageService.exportProjectFile(newProject);
      }

      setStatusMessage({
        text: `Project "${newProject.name}" saved to IndexedDB successfully!`,
        type: 'success'
      });
      setActiveModal('none');
      refreshStorageData();
    } catch (err) {
      console.error('Save project error:', err);
      setStatusMessage({
        text: `Failed to save project: ${(err as Error).message}`,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Load project from IndexedDB into workspace
  const handleLoadProject = async (project: StoredProject) => {
    setIsProcessing(true);
    try {
      // 1. Restore Camera View
      if (project.camera && onRestoreCamera) {
        onRestoreCamera(project.camera);
      }

      // 2. Restore GIS Layers
      if (project.layers && project.layers.length > 0) {
        const restoredGisLayers: GisLayer[] = [];

        for (const storedLayer of project.layers) {
          if (storedLayer.type === 'dxf' || storedLayer.type === 'shapefile') {
            const gisLayer = projectStorageService.storedLayerToGisLayer(storedLayer);
            if (gisLayer) {
              restoredGisLayers.push(gisLayer);
            }
          } else if (onRestoreLayer) {
            onRestoreLayer(storedLayer);
          }
        }

        if (restoredGisLayers.length > 0 && onGisLayersChange) {
          onGisLayersChange(restoredGisLayers);
        }
      }

      // 3. Delegate rest of project properties (globeState, trees, models)
      if (onRestoreProject) {
        onRestoreProject(project);
      }

      setStatusMessage({
        text: `Project "${project.name}" loaded successfully (${project.layers?.length || 0} layers)!`,
        type: 'success'
      });
      setActiveModal('none');
    } catch (err) {
      console.error('Load project error:', err);
      setStatusMessage({
        text: `Failed to load project: ${(err as Error).message}`,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete project from IndexedDB
  const handleDeleteProject = async (id: string, name: string) => {
    try {
      await projectStorageService.deleteProject(id);
      setSavedProjects(prev => prev.filter(p => p.id !== id));
      setStatusMessage({ text: `Project "${name}" removed from storage`, type: 'info' });
    } catch (err) {
      setStatusMessage({ text: `Failed to delete project: ${(err as Error).message}`, type: 'error' });
    }
  };

  // Quick save active layers to IndexedDB
  const handlePersistActiveLayers = async () => {
    if (gisLayers.length === 0 && (!placedTrees || placedTrees.length === 0)) {
      setStatusMessage({ text: 'No active layers or trees to persist', type: 'info' });
      return;
    }

    setIsProcessing(true);
    try {
      const layersToStore: StoredLayer[] = gisLayers.map(l =>
        projectStorageService.gisLayerToStoredLayer(l)
      );

      if (placedTrees && placedTrees.length > 0) {
        layersToStore.push(projectStorageService.placedTreesToStoredLayer(placedTrees, treeModelUrl));
      }

      await projectStorageService.saveLayers(layersToStore);
      await refreshStorageData();
      setStatusMessage({
        text: `${layersToStore.length} layer(s) persisted to IndexedDB`,
        type: 'success'
      });
    } catch (err) {
      setStatusMessage({ text: `Layer persistence error: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore single stored layer
  const handleRestoreStoredLayer = (stored: StoredLayer) => {
    if (stored.type === 'dxf' || stored.type === 'shapefile') {
      const gisLayer = projectStorageService.storedLayerToGisLayer(stored);
      if (gisLayer) {
        // Append or replace if already exists
        const exists = gisLayers.some(l => l.id === gisLayer.id);
        const nextLayers = exists
          ? gisLayers.map(l => (l.id === gisLayer.id ? gisLayer : l))
          : [...gisLayers, gisLayer];
        if (onGisLayersChange) {
          onGisLayersChange(nextLayers);
        }
        setStatusMessage({ text: `Restored layer "${stored.name}"`, type: 'success' });
      }
    } else if (onRestoreLayer) {
      onRestoreLayer(stored);
      setStatusMessage({ text: `Restored layer "${stored.name}"`, type: 'success' });
    }
  };

  // Delete stored layer
  const handleDeleteStoredLayer = async (id: string, name: string) => {
    try {
      await projectStorageService.deleteLayer(id);
      setStoredLayers(prev => prev.filter(l => l.id !== id));
      setStatusMessage({ text: `Deleted layer "${name}"`, type: 'info' });
    } catch (err) {
      setStatusMessage({ text: `Failed to delete layer: ${(err as Error).message}`, type: 'error' });
    }
  };

  // Import JSON project file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const project = await projectStorageService.importProjectFile(file);
      await projectStorageService.saveProject(project);
      await refreshStorageData();
      await handleLoadProject(project);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Import file error:', err);
      setStatusMessage({ text: `Error importing project: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Hidden file input for project import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Floating Save/Load Project & Layers Toolbar (Below Top-Left HUD) */}
      <div
        id="project-storage-toolbar"
        className={`absolute top-[72px] sm:top-[76px] z-30 transition-all duration-300 rounded-2xl shadow-2xl backdrop-blur-md p-1.5 flex items-center gap-1.5 ${
          isDrawerMode ? 'left-[118px] sm:left-[128px]' : 'left-3 sm:left-4'
        } ${
          isLight
            ? 'bg-white/95 text-slate-900 border border-slate-200 shadow-slate-300/40'
            : 'bg-slate-950/90 border border-slate-800/80 text-slate-100 shadow-black/60'
        }`}
      >
        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse Storage Bar' : 'Expand Project & Layer Storage'}
          className={`p-2 rounded-xl transition-all cursor-pointer border-0 ${
            isLight
              ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              : 'hover:bg-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
        </button>

        {isExpanded ? (
          <>
            <div className={`h-5 w-px mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

            {/* Quick Save Project */}
            <button
              type="button"
              onClick={handleOpenSaveModal}
              title="Save Current Project (IndexedDB)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border-0 ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200'
                  : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 active:bg-emerald-500/30'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>

            {/* Load Project Library */}
            <button
              type="button"
              onClick={() => setActiveModal('load')}
              title="Open Saved Projects"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border-0 ${
                isLight
                  ? 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                  : 'text-slate-200 hover:bg-white/10 active:bg-white/15'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Projects</span>
              {savedProjects.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-400 font-mono">
                  {savedProjects.length}
                </span>
              )}
            </button>

            {/* Offline Layers Persistence */}
            <button
              type="button"
              onClick={() => setActiveModal('layers')}
              title="Persisted Layers (IndexedDB)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border-0 ${
                isLight
                  ? 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                  : 'text-slate-200 hover:bg-white/10 active:bg-white/15'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Layers</span>
              {storedLayers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-400 font-mono">
                  {storedLayers.length}
                </span>
              )}
            </button>

            <div className={`h-5 w-px mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

            {/* Import Project JSON */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Import Project (.json)"
              className={`p-2 rounded-xl transition-all cursor-pointer border-0 ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  : 'hover:bg-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </>
        ) : (
          <span className="text-xs font-medium pr-1 text-slate-400 cursor-pointer" onClick={() => setIsExpanded(true)}>
            Storage
          </span>
        )}
      </div>

      {/* Floating Status Notification */}
      {statusMessage && (
        <div
          className={`absolute top-16 left-4 z-40 px-3.5 py-2 rounded-xl text-xs font-medium shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/90 text-white border border-emerald-400/30 shadow-emerald-500/20'
              : statusMessage.type === 'error'
              ? 'bg-rose-500/90 text-white border border-rose-400/30 shadow-rose-500/20'
              : 'bg-blue-500/90 text-white border border-blue-400/30 shadow-blue-500/20'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <HardDrive className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SAVE PROJECT MODAL                                                      */}
      {/* ========================================================================= */}
      {activeModal === 'save' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl p-5 shadow-2xl border ${
              isLight
                ? 'bg-white text-slate-900 border-slate-200'
                : 'bg-slate-950 text-slate-100 border-slate-800'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold tracking-tight">Save Project to Storage</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. Master Site Plan v1"
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none transition-all ${
                    isLight
                      ? 'bg-slate-100 border border-slate-300 text-slate-900 focus:border-emerald-500'
                      : 'bg-slate-900 border border-white/10 text-white focus:border-emerald-500'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={projectDescription}
                  onChange={e => setProjectDescription(e.target.value)}
                  placeholder="Notes on layers, camera, or styling..."
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none transition-all resize-none ${
                    isLight
                      ? 'bg-slate-100 border border-slate-300 text-slate-900 focus:border-emerald-500'
                      : 'bg-slate-900 border border-white/10 text-white focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Items included summary card */}
              <div
                className={`p-3 rounded-xl space-y-1.5 ${
                  isLight ? 'bg-slate-100/70 border border-slate-200' : 'bg-slate-900/60 border border-white/5'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>Components Included in Snapshot:</span>
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-blue-400" />
                    <span>GIS Layers: {gisLayers.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TreePine className="w-3 h-3 text-emerald-400" />
                    <span>Trees: {placedTrees?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Box className="w-3 h-3 text-amber-400" />
                    <span>3D Model: {modelData?.url ? 'Yes' : 'None'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Camera & Sun Sync: Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSaveCurrentProject(true)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0 ${
                  isLight
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Save & Export JSON</span>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSaveCurrentProject(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer border-0 shadow-lg shadow-emerald-600/30"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save to IndexedDB</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LOAD SAVED PROJECTS MODAL                                               */}
      {/* ========================================================================= */}
      {activeModal === 'load' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border ${
              isLight
                ? 'bg-white text-slate-900 border-slate-200'
                : 'bg-slate-950 text-slate-100 border-slate-800'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold tracking-tight">Saved Projects in IndexedDB</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 font-mono">
                  {savedProjects.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {savedProjects.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Database className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No projects saved in browser IndexedDB yet.</p>
                  <button
                    type="button"
                    onClick={() => handleOpenSaveModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer border-0 inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Current Workspace</span>
                  </button>
                </div>
              ) : (
                savedProjects.map(proj => (
                  <div
                    key={proj.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      selectedProjectId === proj.id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-white/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold truncate text-slate-100">{proj.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(proj.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      {proj.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{proj.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-blue-400" />
                          {proj.layers?.length || 0} Layers
                        </span>
                        {proj.placedTrees && proj.placedTrees.length > 0 && (
                          <span className="flex items-center gap-1">
                            <TreePine className="w-3 h-3 text-emerald-400" />
                            {proj.placedTrees.length} Trees
                          </span>
                        )}
                        {proj.modelData?.url && (
                          <span className="flex items-center gap-1">
                            <Box className="w-3 h-3 text-amber-400" />
                            3D Model
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => projectStorageService.exportProjectFile(proj)}
                        title="Download JSON File"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors border-0 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(proj.id, proj.name)}
                        title="Delete from Storage"
                        className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleLoadProject(proj)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Load</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saved locally in browser IndexedDB (Persistent)</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium cursor-pointer border border-white/10 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PERSISTED LAYERS LIBRARY MODAL                                          */}
      {/* ========================================================================= */}
      {activeModal === 'layers' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border ${
              isLight
                ? 'bg-white text-slate-900 border-slate-200'
                : 'bg-slate-950 text-slate-100 border-slate-800'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold tracking-tight">Persisted Layers in IndexedDB</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-400 font-mono">
                  {storedLayers.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePersistActiveLayers}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Persist Current Layers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('none')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {storedLayers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No standalone layers stored yet.</p>
                  <button
                    type="button"
                    onClick={handlePersistActiveLayers}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer border-0 inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Persist Active Workspace Layers</span>
                  </button>
                </div>
              ) : (
                storedLayers.map(layer => {
                  const isDxf = layer.type === 'dxf';
                  const isTrees = layer.type === 'point_trees';
                  const isModel = layer.type === 'model';

                  return (
                    <div
                      key={layer.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-white/5'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                              isDxf
                                ? 'bg-blue-500/20 text-blue-400'
                                : isTrees
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isModel
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {layer.type}
                          </span>
                          <h4 className="text-xs font-bold truncate text-slate-100">{layer.name}</h4>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-mono">
                          <span>Stored: {new Date(layer.timestamp).toLocaleDateString()}</span>
                          {layer.metadata?.featureCount !== undefined && (
                            <span>{layer.metadata.featureCount} entities</span>
                          )}
                          {layer.style.fillColor && (
                            <span className="flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20"
                                style={{ backgroundColor: layer.style.fillColor }}
                              />
                              {layer.style.fillColor}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteStoredLayer(layer.id, layer.name)}
                          title="Delete Stored Layer"
                          className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreStoredLayer(layer)}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Restore Layer</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">
                Active GIS Layers: <strong className="text-white">{gisLayers.length}</strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Clear all stored layers from IndexedDB?')) {
                    await projectStorageService.clearAllLayers();
                    await refreshStorageData();
                    setStatusMessage({ text: 'All stored layers cleared', type: 'info' });
                  }
                }}
                className="px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 text-[11px] font-medium border-0 cursor-pointer"
              >
                Clear All Layers
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SaveLoadToolbar;
