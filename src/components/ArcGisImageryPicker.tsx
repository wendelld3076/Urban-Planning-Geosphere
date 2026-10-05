import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Cesium from 'cesium';
import { motion, AnimatePresence } from 'motion/react';
import {
  Satellite,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Locate,
  Trash2,
  Sliders,
  Copy,
  Check,
  X,
  ExternalLink,
  Layers,
  Lock,
  Unlock,
  Sparkles,
  AlertCircle,
  Calendar,
  Compass,
  Columns,
  Maximize2,
  Globe2,
  ShieldCheck,
  FolderTree,
  CornerLeftUp,
  Home,
  Info,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import {
  fetchAvailableImageServices,
  setArcGisImageServer,
  removeArcGisImageServer,
  ArcGisServiceInfo,
  isGlobalOrInvalidRectangle,
  buildSubfolderUrl,
  normalizeArcGisUrl
} from '../services/ArcGisCatalogService';

export interface ArcGisImageryPickerProps {
  viewer?: Cesium.Viewer | null;
  isOpen?: boolean;
  onClose?: () => void;
  isSidebarExpanded?: boolean;
  sidebarTheme?: 'light' | 'dark';
  mode?: 'floating' | 'embedded';
  onActiveSurveyChange?: (info: ArcGisServiceInfo | null) => void;
}

const STORAGE_KEYS = {
  SERVER_URL: 'arcgis_imagery_server_url',
  TOKEN: 'arcgis_imagery_token',
};

const DEFAULT_PRESETS = [
  {
    name: 'Abu Dhabi DMT (2020 Urban Aerial 10cm)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services/Images/2020_UrbanArea_Aerial_10cm_WM/ImageServer',
    desc: 'High-precision 10cm resolution urban aerial survey of Abu Dhabi (2020)'
  },
  {
    name: 'Abu Dhabi DMT (Aerial Imagery)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services/Images',
    desc: 'Official Abu Dhabi DMT Aerial Surveys, Orthophotos & Satellite Imagery (1972-Present)'
  },
  {
    name: 'Abu Dhabi DMT (UDM / Urban Planning)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services/UDM',
    desc: 'Urban Planning Geosphere, Orthomosaics, 30cm Buildings & Statistics'
  },
  {
    name: 'Abu Dhabi DMT (Drone Surveys)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services/Survey',
    desc: '50+ High-Resolution Drone Mosaics & Khalifa City 2025 Surveys'
  },
  {
    name: 'Abu Dhabi DMT (All Services)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services',
    desc: 'Abu Dhabi DMT Geoportal (Images, UDM, Survey, Topography, MasterPlan)'
  },
  {
    name: 'Abu Dhabi DMT (MasterPlan)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services/MasterPlan',
    desc: 'Abu Dhabi Master Plan Context & DCR Zoning'
  },
  {
    name: 'Abu Dhabi DMT (Topography)',
    url: 'https://geosmart.dmt.gov.ae/arcgis/rest/services/Topography',
    desc: 'Abu Dhabi DMT Bathymetry, Contours & Topography'
  },
  {
    name: 'ESRI World Imagery',
    url: 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer',
    desc: 'High-resolution worldwide satellite and aerial basemap'
  },
  {
    name: 'Sample Services',
    url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services',
    desc: 'Public ArcGIS sample directory with multiple Image & Map servers'
  }
];

export const ArcGisImageryPicker: React.FC<ArcGisImageryPickerProps> = ({
  viewer,
  isOpen = true,
  onClose,
  isSidebarExpanded = false,
  sidebarTheme = 'dark',
  mode = 'floating',
  onActiveSurveyChange
}) => {
  // Input states
  const [folderUrl, setFolderUrl] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SERVER_URL);
    if (saved && saved.includes('geoportal.dmt.gov.ae')) {
      return saved.replace('geoportal.dmt.gov.ae', 'geosmart.dmt.gov.ae');
    }
    return saved || 'https://geosmart.dmt.gov.ae/arcgis/rest/services/Images';
  });
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
  });
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);

  // Connection mode: default to proxy to eliminate browser CORS errors
  const [forceDirect, setForceDirect] = useState<boolean>(false);
  const [usedProxy, setUsedProxy] = useState<boolean>(false);
  // View preservation: default to true so view does NOT change / fly to outer space when streaming
  const [maintainView, setMaintainView] = useState<boolean>(true);

  // Catalog query states
  const [services, setServices] = useState<ArcGisServiceInfo[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState<boolean>(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'year-desc' | 'year-asc' | 'name-asc'>('year-desc');

  // Active Layer states
  const [activeService, setActiveService] = useState<ArcGisServiceInfo | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const activeLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  // Layer tuning controls
  const [alpha, setAlpha] = useState<number>(1.0);
  const [brightness, setBrightness] = useState<number>(1.0);
  const [contrast, setContrast] = useState<number>(1.0);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [splitDirection, setSplitDirection] = useState<'none' | 'left' | 'right'>('none');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Save server config to local storage
  const handleSaveConfig = (urlToSave: string, tokenToSave: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVER_URL, urlToSave);
      if (tokenToSave) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, tokenToSave);
      } else {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    } catch {}
  };

  // Get active viewer from props or global window fallback
  const getCesiumViewer = (): Cesium.Viewer | null => {
    if (viewer && !viewer.isDestroyed()) return viewer;
    const winViewer = (window as any).cesiumViewer;
    if (winViewer && !winViewer.isDestroyed()) return winViewer;
    return null;
  };

  // Clean up layer on component unmount
  useEffect(() => {
    return () => {
      // Don't auto-remove if persistent streaming is desired, but ensure clean ref handling
    };
  }, []);

  // Fetch available services from ArcGIS REST Catalog
  const handleFetchServices = async (targetUrlOverride?: string, directModeOverride?: boolean) => {
    const urlToQuery = (targetUrlOverride || folderUrl).trim();
    if (!urlToQuery) {
      setErrorMsg('Please provide a valid ArcGIS REST directory or ImageServer URL.');
      return;
    }

    const effectiveDirect = directModeOverride !== undefined ? directModeOverride : forceDirect;

    setIsLoading(true);
    setErrorMsg(null);
    setHasQueried(true);

    try {
      handleSaveConfig(urlToQuery, token.trim());
      const result = await fetchAvailableImageServices(urlToQuery, {
        token: token.trim() || undefined,
        forceDirect: effectiveDirect,
      });
      setServices(result.services);
      setFolders(result.folders);
      setUsedProxy(result.usedProxy);

      // If URL was normalized, migrated (e.g. geoportal -> geosmart), or auto-resolved (e.g. appended /ImageServer)
      if (result.cleanUrl && result.cleanUrl !== urlToQuery) {
        setFolderUrl(result.cleanUrl);
        handleSaveConfig(result.cleanUrl, token.trim());
      }

      if (result.services.length === 0) {
        if (result.folders.length > 0) {
          setErrorMsg(
            `No direct Image/Map servers in this root folder, but ${result.folders.length} subfolders were discovered. Click any subfolder chip below to browse its services.`
          );
        } else {
          setErrorMsg(
            'No ImageServer or aerial survey services found at this endpoint. Check the folder path or try another preset.'
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to query ArcGIS catalog:', err);
      setErrorMsg(err?.message || 'Failed to connect to ArcGIS REST catalog.');
      setServices([]);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe subfolder navigation
  const handleSelectFolder = (folderName: string) => {
    try {
      const nextUrl = buildSubfolderUrl(folderUrl, folderName);
      setFolderUrl(nextUrl);
      handleFetchServices(nextUrl);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to navigate to folder.');
    }
  };

  // Navigate to parent folder
  const handleNavigateUp = () => {
    try {
      const { cleanUrl, rootServicesUrl } = normalizeArcGisUrl(folderUrl);
      if (cleanUrl.toLowerCase() === rootServicesUrl.toLowerCase()) return;
      const parts = cleanUrl.split('/');
      parts.pop();
      const parentUrl = parts.join('/');
      setFolderUrl(parentUrl);
      handleFetchServices(parentUrl);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to navigate up.');
    }
  };

  // Navigate to root services catalog
  const handleNavigateRoot = () => {
    try {
      const { rootServicesUrl } = normalizeArcGisUrl(folderUrl);
      setFolderUrl(rootServicesUrl);
      handleFetchServices(rootServicesUrl);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to navigate to root.');
    }
  };

  // Check if currently inside a subfolder
  const isInsideSubfolder = useMemo(() => {
    try {
      const { cleanUrl, rootServicesUrl } = normalizeArcGisUrl(folderUrl);
      return cleanUrl.toLowerCase() !== rootServicesUrl.toLowerCase();
    } catch {
      return false;
    }
  }, [folderUrl]);

  // Stream selected aerial imagery into Cesium
  const handleSelectService = async (service: ArcGisServiceInfo) => {
    const currentViewer = getCesiumViewer();
    if (!currentViewer) {
      setStreamError('Cesium 3D Globe is not initialized yet. Please wait for the globe to load.');
      return;
    }

    setIsStreaming(true);
    setStreamError(null);

    try {
      let cesSplit: Cesium.SplitDirection = Cesium.SplitDirection.NONE;
      if (splitDirection === 'left') cesSplit = Cesium.SplitDirection.LEFT;
      if (splitDirection === 'right') cesSplit = Cesium.SplitDirection.RIGHT;

      const useDirect = forceDirect || !usedProxy;

      const layer = await setArcGisImageServer(
        currentViewer,
        service.url,
        activeLayerRef,
        token.trim() || undefined,
        {
          alpha,
          brightness,
          contrast,
          splitDirection: cesSplit,
          flyToBounds: !maintainView,
          forceDirect: useDirect,
          serviceType: service.type,
          onError: (err) => {
            const msg = typeof err === 'string' ? err : err.message;
            setStreamError(msg);
          }
        }
      );

      layer.show = isVisible;
      setActiveService(service);
      onActiveSurveyChange?.(service);
    } catch (err: any) {
      console.error('Error streaming ArcGIS ImageServer:', err);
      setStreamError(
        `Failed to stream "${service.cleanName}": ${err?.message || 'Check network connection, CORS policy, or authentication token.'}`
      );
    } finally {
      setIsStreaming(false);
    }
  };

  // Remove the active imagery layer
  const handleRemoveLayer = () => {
    const currentViewer = getCesiumViewer();
    removeArcGisImageServer(currentViewer, activeLayerRef);
    setActiveService(null);
    onActiveSurveyChange?.(null);
    setStreamError(null);
  };

  // Fly camera to active imagery bounds (with safe global extent check)
  const handleFlyToBounds = () => {
    const currentViewer = getCesiumViewer();
    if (!currentViewer || !activeLayerRef.current) return;
    const layer = activeLayerRef.current;
    const targetRectangle = (layer as any)._surveyRectangle || layer.imageryProvider?.rectangle;
    if (targetRectangle && !isGlobalOrInvalidRectangle(targetRectangle)) {
      currentViewer.camera.flyTo({
        destination: targetRectangle,
        duration: 1.5,
      });
    } else {
      setStreamError('Survey coverage area is global or unprojected; current camera view maintained.');
      setTimeout(() => setStreamError(null), 5000);
    }
  };

  // Synchronize layer alpha
  const handleAlphaChange = (newAlpha: number) => {
    setAlpha(newAlpha);
    if (activeLayerRef.current) {
      activeLayerRef.current.alpha = newAlpha;
      const currentViewer = getCesiumViewer();
      if (currentViewer?.scene && !currentViewer.scene.isDestroyed()) {
        currentViewer.scene.requestRender();
      }
    }
  };

  // Synchronize layer brightness
  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    if (activeLayerRef.current) {
      activeLayerRef.current.brightness = val;
      const currentViewer = getCesiumViewer();
      if (currentViewer?.scene && !currentViewer.scene.isDestroyed()) {
        currentViewer.scene.requestRender();
      }
    }
  };

  // Synchronize layer contrast
  const handleContrastChange = (val: number) => {
    setContrast(val);
    if (activeLayerRef.current) {
      activeLayerRef.current.contrast = val;
      const currentViewer = getCesiumViewer();
      if (currentViewer?.scene && !currentViewer.scene.isDestroyed()) {
        currentViewer.scene.requestRender();
      }
    }
  };

  // Toggle visibility
  const handleToggleVisibility = () => {
    const next = !isVisible;
    setIsVisible(next);
    if (activeLayerRef.current) {
      activeLayerRef.current.show = next;
      const currentViewer = getCesiumViewer();
      if (currentViewer?.scene && !currentViewer.scene.isDestroyed()) {
        currentViewer.scene.requestRender();
      }
    }
  };

  // Handle split comparison direction
  const handleSplitDirectionChange = (dir: 'none' | 'left' | 'right') => {
    setSplitDirection(dir);
    if (activeLayerRef.current) {
      let cesSplit: Cesium.SplitDirection = Cesium.SplitDirection.NONE;
      if (dir === 'left') cesSplit = Cesium.SplitDirection.LEFT;
      if (dir === 'right') cesSplit = Cesium.SplitDirection.RIGHT;
      activeLayerRef.current.splitDirection = cesSplit;
      const currentViewer = getCesiumViewer();
      if (currentViewer?.scene && !currentViewer.scene.isDestroyed()) {
        currentViewer.scene.requestRender();
      }
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Available unique years in returned catalog
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    services.forEach((s) => {
      if (s.year) years.add(s.year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [services]);

  // Filtered and sorted services
  const filteredServices = useMemo(() => {
    let list = services.filter((s) => {
      const matchesQuery =
        !searchQuery.trim() ||
        s.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.resolution && s.resolution.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesYear = selectedYear === 'all' || s.year === selectedYear;

      return matchesQuery && matchesYear;
    });

    list.sort((a, b) => {
      if (sortOrder === 'year-desc') {
        const yA = a.year ? parseInt(a.year, 10) : 0;
        const yB = b.year ? parseInt(b.year, 10) : 0;
        if (yB !== yA) return yB - yA;
        return a.cleanName.localeCompare(b.cleanName);
      }
      if (sortOrder === 'year-asc') {
        const yA = a.year ? parseInt(a.year, 10) : 9999;
        const yB = b.year ? parseInt(b.year, 10) : 9999;
        if (yA !== yB) return yA - yB;
        return a.cleanName.localeCompare(b.cleanName);
      }
      return a.cleanName.localeCompare(b.cleanName);
    });

    return list;
  }, [services, searchQuery, selectedYear, sortOrder]);

  if (!isOpen && mode === 'floating') return null;

  const isLight = sidebarTheme === 'light';

  const containerClasses =
    mode === 'floating'
      ? `fixed z-40 transition-all duration-300 flex flex-col backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden
        ${isSidebarExpanded ? 'md:left-[340px]' : 'md:left-20'} 
        max-md:left-3 max-md:right-3 max-md:w-auto max-md:top-16 max-md:bottom-4
        top-20 bottom-12 w-[390px] sm:w-[440px] max-h-[calc(100vh-8rem)]
        ${
          isLight
            ? 'sidebar-theme-light bg-white/95 border-slate-300 text-slate-900 shadow-slate-400/30'
            : 'bg-slate-900/95 border-sky-500/30 text-slate-100 shadow-black/90'
        }`
      : `w-full flex flex-col rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900/50 border-white/10 text-slate-100'
        }`;

  return (
    <div id="arcgis-aerial-imagery-picker" className={containerClasses}>
      {/* Header Bar */}
      <div
        className={`flex-shrink-0 p-3 border-b flex justify-between items-center ${
          isLight ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800/90 bg-slate-950/60'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm shrink-0">
            <Satellite className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-xs tracking-wide truncate">ArcGIS Aerial Imagery</h3>
              <span className="text-[8px] px-1 py-0.5 rounded-full font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                REST Catalog
              </span>
            </div>
            <p className="text-[9px] text-slate-400 truncate">Discover & stream high-res surveys</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg border-0 transition-colors cursor-pointer shrink-0 ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title="Close Imagery"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className={mode === 'floating' ? "flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar" : "p-3 space-y-3.5"}>
        {/* ACTIVE STREAMED SURVEY CARD (Pinned at top if active) */}
        {activeService && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-xl border shadow-lg space-y-3 ${
              isLight
                ? 'bg-gradient-to-br from-cyan-50 to-blue-50/70 border-cyan-300/80 text-slate-900'
                : 'bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border-cyan-500/40 text-slate-100 shadow-cyan-950/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-400">
                  Active Survey Stream
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleFlyToBounds}
                  className="p-1 rounded-md text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20 transition-colors border-0 cursor-pointer"
                  title="Fly to survey bounds"
                >
                  <Locate className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  className={`p-1 rounded-md transition-colors border-0 cursor-pointer ${
                    isVisible
                      ? 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
                  }`}
                  title={isVisible ? 'Hide Survey Layer' : 'Show Survey Layer'}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLayer}
                  className="p-1 rounded-md text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors border-0 cursor-pointer"
                  title="Remove Survey Layer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <h4
                className="text-xs font-bold leading-snug break-words text-slate-100 select-text"
                title={`Active Survey: ${activeService.cleanName}\nArcGIS Path: ${activeService.name}\nURL: ${activeService.url}`}
              >
                {activeService.cleanName}
              </h4>
              <div
                className="text-[9px] font-mono text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer mt-0.5 flex items-center gap-1 group"
                title={`Active Endpoint URL:\n${activeService.url}\n(Click to copy)`}
                onClick={() => handleCopyUrl(activeService.url)}
              >
                <span className="truncate flex-1">{activeService.url}</span>
                <span className="text-[8px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity font-sans shrink-0">
                  {copiedUrl === activeService.url ? 'Copied' : 'Copy'}
                </span>
              </div>
            </div>

            {/* Quick Tuning Sliders */}
            <div className="pt-2 border-t border-white/10 space-y-2.5">
              {/* Opacity / Alpha Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400">Opacity Blend</span>
                  <span className="font-bold text-cyan-400">{Math.round(alpha * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={alpha}
                  onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Compare Split Screen Selector */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Columns className="w-3 h-3" /> Split Compare
                </span>
                <div className="inline-flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                  {(['none', 'left', 'right'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => handleSplitDirectionChange(dir)}
                      className={`px-2 py-0.5 text-[9px] font-mono uppercase rounded-md transition-colors border-0 cursor-pointer ${
                        splitDirection === dir
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* SERVER ENDPOINT INPUT CARD */}
        <div
          className={`p-3.5 rounded-xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3 text-cyan-400" />
              ArcGIS REST Directory URL
            </label>
            <button
              type="button"
              onClick={() => setShowTokenInput(!showTokenInput)}
              className="text-[10px] font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer border-0 bg-transparent"
            >
              {showTokenInput ? <Lock className="w-3 h-3 text-cyan-400" /> : <Unlock className="w-3 h-3" />}
              {token ? 'Token Configured' : 'Auth Token'}
            </button>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
              placeholder="https://<server>/arcgis/rest/services/Images"
              className={`w-full text-xs font-mono px-3 py-2 rounded-xl border focus:outline-none transition-all ${
                isLight
                  ? 'bg-white border-slate-300 focus:border-cyan-500 text-slate-900'
                  : 'bg-slate-900 border-white/10 focus:border-cyan-500/80 text-slate-200'
              }`}
            />

            {/* Optional Token Field */}
            {showTokenInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                <label className="text-[9px] font-mono text-slate-400">Access Token (for secured servers)</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste ArcGIS access token..."
                  className={`w-full text-xs font-mono px-3 py-1.5 rounded-lg border focus:outline-none transition-all ${
                    isLight
                      ? 'bg-white border-slate-300 focus:border-cyan-500 text-slate-900'
                      : 'bg-slate-900 border-white/10 focus:border-cyan-500/80 text-slate-200'
                  }`}
                />
              </motion.div>
            )}

            {/* Quick Presets Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[9px] font-mono text-slate-500 self-center">Presets:</span>
              {DEFAULT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setFolderUrl(p.url);
                    setToken('');
                    handleFetchServices(p.url, forceDirect);
                  }}
                  className={`text-[9px] px-2 py-0.5 rounded-md font-mono border transition-all cursor-pointer ${
                    folderUrl === p.url
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-white/10'
                  }`}
                  title={p.desc}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Connection Mode Status & Toggle */}
            <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" /> Route:
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                    forceDirect
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}
                >
                  {forceDirect ? 'Direct Browser (CORS Extension Mode)' : 'CORS Bypass Proxy'}
                </span>
                {usedProxy && !forceDirect && (
                  <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Proxy Connected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setForceDirect(!forceDirect)}
                className="text-slate-400 hover:text-cyan-300 underline cursor-pointer border-0 bg-transparent text-[10px]"
                title="Toggle between Cloud Proxy (bypasses browser CORS) and Direct Connection (for private corporate intranets/VPNs with CORS extension)"
              >
                {forceDirect ? 'Switch to Proxy' : 'Direct VPN Mode'}
              </button>
            </div>

            {/* Camera View Mode on Stream */}
            <div className="flex items-center justify-between pt-1 pb-0.5 text-[10px] font-mono border-t border-white/5">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={maintainView}
                  onChange={(e) => setMaintainView(e.target.checked)}
                  className="accent-cyan-400 rounded cursor-pointer w-3.5 h-3.5"
                />
                <span className="flex items-center gap-1">
                  <Compass className="w-3 h-3 text-cyan-400" />
                  Maintain current view on stream
                </span>
              </label>
              <span className="text-[9px] text-slate-500 font-mono">
                {maintainView ? 'Preserve perspective' : 'Auto-fly to bounds'}
              </span>
            </div>

            {/* Mixed content notification */}
            {folderUrl.trim().toLowerCase().startsWith('http:') && typeof window !== 'undefined' && window.location.protocol === 'https:' && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-950/30 border border-amber-500/25 text-[10px] text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <span className="font-semibold">Mixed Content:</span> Server uses HTTP. If imagery tiles do not appear, ensure your CORS extension permits HTTP or click site settings to allow insecure content.
                </div>
              </div>
            )}

            {/* Fetch Button */}
            <button
              type="button"
              onClick={() => handleFetchServices()}
              disabled={isLoading || !folderUrl.trim()}
              className={`w-full mt-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer border-0 ${
                isLoading || !folderUrl.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/20'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Querying Image Services...' : 'Query Catalog Services'}
            </button>
          </div>

          {/* Subfolders & Directory Navigation */}
          {(folders.length > 0 || isInsideSubfolder) && (
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 font-bold text-slate-300">
                  <FolderTree className="w-3 h-3 text-cyan-400" />
                  {folders.length > 0 ? `Discovered Folders (${folders.length})` : 'Catalog Navigation'}
                </span>
                <div className="flex items-center gap-1.5">
                  {isInsideSubfolder && (
                    <>
                      <button
                        type="button"
                        onClick={handleNavigateUp}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 cursor-pointer flex items-center gap-1 transition-all"
                        title="Navigate to parent directory"
                      >
                        <CornerLeftUp className="w-2.5 h-2.5" /> Up
                      </button>
                      <button
                        type="button"
                        onClick={handleNavigateRoot}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 cursor-pointer flex items-center gap-1 transition-all"
                        title="Navigate to root /rest/services"
                      >
                        <Home className="w-2.5 h-2.5" /> Root
                      </button>
                    </>
                  )}
                  {folders.length > 0 && <span className="text-[9px] text-slate-500">Click to explore</span>}
                </div>
              </div>
              {folders.length > 0 && (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {folders.map((fName) => (
                    <button
                      key={fName}
                      type="button"
                      onClick={() => handleSelectFolder(fName)}
                      className="text-[9px] font-mono px-2 py-1 rounded-md bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>📁</span>
                      <span>{fName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Feedback with Quick Recovery */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-snug text-[11px] flex-1">{errorMsg}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !forceDirect;
                    setForceDirect(nextMode);
                    setTimeout(() => {
                      handleFetchServices(folderUrl, nextMode);
                    }, 50);
                  }}
                  className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-white border border-rose-400/40 cursor-pointer transition-colors"
                >
                  {forceDirect ? 'Retry with Proxy (Bypass CORS)' : 'Retry in Direct Mode (VPN)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const udmUrl = 'https://geosmart.dmt.gov.ae/arcgis/rest/services/UDM';
                    setFolderUrl(udmUrl);
                    setForceDirect(false);
                    handleFetchServices(udmUrl, false);
                  }}
                  className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40 cursor-pointer transition-colors"
                >
                  Load DMT Urban Planning (UDM)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dmtUrl = 'https://geosmart.dmt.gov.ae/arcgis/rest/services/Images';
                    setFolderUrl(dmtUrl);
                    setForceDirect(false);
                    handleFetchServices(dmtUrl, false);
                  }}
                  className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/40 cursor-pointer transition-colors"
                >
                  Load Abu Dhabi Aerial (DMT)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const esriUrl = 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer';
                    setFolderUrl(esriUrl);
                    setForceDirect(false);
                    handleFetchServices(esriUrl, false);
                  }}
                  className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 cursor-pointer transition-colors"
                >
                  Load ESRI Basemap
                </button>
                {isInsideSubfolder && (
                  <button
                    type="button"
                    onClick={handleNavigateRoot}
                    className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Home className="w-2.5 h-2.5" /> Back to Root
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stream Error Feedback */}
          {streamError && (
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px]">{streamError}</div>
            </div>
          )}
        </div>

        {/* CATALOG RESULTS SECTION */}
        {hasQueried && !isLoading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-300 truncate">
                  Available Surveys
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  {filteredServices.length} {filteredServices.length === 1 ? 'Service' : 'Services'}
                </span>
              </div>

              {/* Sort Order Selector */}
              <select
                value={sortOrder}
                onChange={(e: any) => setSortOrder(e.target.value)}
                className={`text-[9px] font-mono px-2 py-1 rounded-md border focus:outline-none cursor-pointer shrink-0 ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-white/10 text-slate-300'
                }`}
              >
                <option value="year-desc">Newest Year</option>
                <option value="year-asc">Oldest Year</option>
                <option value="name-asc">Name (A-Z)</option>
              </select>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter surveys by name, year, resolution..."
                  className={`w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border focus:outline-none transition-all ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-cyan-500'
                      : 'bg-slate-950 border-white/10 text-slate-200 focus:border-cyan-500'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white border-0 bg-transparent cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Year Filter Chips Dropdown */}
              {availableYears.length > 0 && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`text-xs font-mono px-2 py-1.5 rounded-lg border focus:outline-none cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-white/10 text-slate-300'
                  }`}
                >
                  <option value="all">All Years</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Surveys List */}
            {filteredServices.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredServices.map((service) => {
                  const isActive = activeService?.url === service.url;

                  return (
                    <div
                      key={service.url}
                      className={`p-2.5 rounded-xl border transition-all text-left space-y-2 ${
                        isActive
                          ? 'bg-cyan-950/30 border-cyan-500/60 shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                          : isLight
                          ? 'bg-white border-slate-200 hover:border-cyan-400'
                          : 'bg-slate-950/50 border-white/5 hover:border-white/20 hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* Title with Clean Multi-line Wrapping */}
                          <h4 className="text-xs font-bold text-slate-100 leading-snug break-words select-text">
                            {service.cleanName}
                          </h4>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              {service.type}
                            </span>
                            {service.year && (
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {service.year}
                              </span>
                            )}
                            {service.resolution && (
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                {service.resolution}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          {/* Copy URL Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(service.url)}
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors border-0 cursor-pointer"
                          >
                            {copiedUrl === service.url ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Stream Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectService(service)}
                            disabled={isStreaming}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border-0 cursor-pointer ${
                              isActive
                                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400'
                                : 'bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white'
                            }`}
                          >
                            <Satellite className="w-3 h-3" />
                            {isActive ? 'Active' : 'Stream'}
                          </button>
                        </div>
                      </div>

                      {/* Clean URL Snippet with 1-Click Copy */}
                      <div
                        className="text-[9px] font-mono text-slate-500 hover:text-cyan-300 truncate pt-1 border-t border-white/5 flex items-center justify-between gap-1 cursor-pointer transition-colors"
                        onClick={() => handleCopyUrl(service.url)}
                      >
                        <span className="truncate flex-1">{service.url}</span>
                        {copiedUrl === service.url && (
                          <span className="text-[8px] text-emerald-400 font-sans shrink-0 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Copied
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-white/10 space-y-1">
                <Satellite className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">No services match filter criteria</p>
                <p className="text-[10px] text-slate-500">Try clearing search term or year filter</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArcGisImageryPicker;
