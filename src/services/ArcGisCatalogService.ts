import * as Cesium from 'cesium';
import proj4 from 'proj4';

// UAE & Regional Projections registration for local coordinate systems (Abu Dhabi, Dubai, Al Ain)
try {
  // UAE DLTM (Dubai / Abu Dhabi Local Transverse Mercator)
  proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=24.44444444444444 +lon_0=54.38333333333333 +k=1.0 +x_0=500000 +y_0=500000 +ellps=WGS84 +units=m +no_defs');
  // WGS 84 / UTM Zone 40N (covers Abu Dhabi, Al Ain, Dubai, Northern Emirates, Oman)
  proj4.defs('EPSG:32640', '+proj=utm +zone=40 +datum=WGS84 +units=m +no_defs');
  // WGS 84 / UTM Zone 39N (covers Western Abu Dhabi, Al Dhafra, Qatar, Saudi border)
  proj4.defs('EPSG:32639', '+proj=utm +zone=39 +datum=WGS84 +units=m +no_defs');
  // Ain el Abd / UTM zone 39N
  proj4.defs('EPSG:20439', '+proj=utm +zone=39 +ellps=intl +towgs84=-150,-250,-1,0,0,0,0 +units=m +no_defs');
  // Ain el Abd / UTM zone 40N
  proj4.defs('EPSG:20440', '+proj=utm +zone=40 +ellps=intl +towgs84=-150,-250,-1,0,0,0,0 +units=m +no_defs');
} catch (e) {
  console.warn('[Proj4] Failed to initialize default UAE projections:', e);
}

export interface ArcGisServiceInfo {
  name: string; // e.g. "Images/2022_AlAin_Aerial_9cm"
  type: string; // "ImageServer" | "MapServer"
  cleanName: string;
  url: string;
  year?: string;
  resolution?: string;
}

export interface ArcGisCatalogResponse {
  currentVersion?: number;
  folders?: string[];
  services?: Array<{
    name: string;
    type: string;
    url?: string;
  }>;
  layers?: any[];
  name?: string;
  serviceDescription?: string;
  description?: string;
  extent?: any;
  error?: {
    code: number;
    message: string;
    details?: string[];
  };
}

export interface FetchCatalogOptions {
  token?: string;
  forceDirect?: boolean;
  useProxy?: boolean;
}

export interface ArcGisCatalogResult {
  services: ArcGisServiceInfo[];
  folders: string[];
  currentVersion?: number;
  usedProxy: boolean;
  cleanUrl?: string;
  rootServicesUrl?: string;
}

/**
 * Normalizes an ArcGIS REST endpoint URL:
 * - Trims whitespace and quotes
 * - Normalizes scheme and slashes (removes duplicate slashes)
 * - Extracts and separates token if passed in query string
 * - Strips any /?f=json or query params from the path itself
 * - Accurately locates the root /rest/services URL
 */
export function normalizeArcGisUrl(rawUrl: string): {
  cleanUrl: string;
  token?: string;
  rootServicesUrl: string;
} {
  let trimmed = (rawUrl || '').trim();
  // Strip surrounding quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }

  // Prepend https:// if no protocol given
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format. Please enter a valid http:// or https:// URL.');
  }

  // Auto-migrate internal/private IP or legacy non-resolving DMT subdomains to active geosmart.dmt.gov.ae
  const hostLower = parsed.hostname.toLowerCase();
  const isPrivateIp = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/.test(hostLower);
  if (isPrivateIp || /^(uds_uppc|uds-uppc|geoportal|uppc|gis|geospatial)\.dmt\.gov\.ae$/i.test(hostLower) || hostLower === 'geoportal.dmt.gov.ae') {
    parsed.protocol = 'https:';
    parsed.hostname = 'geosmart.dmt.gov.ae';
    parsed.port = '';
  }

  const tokenInQuery = parsed.searchParams.get('token') || undefined;

  // Clean pathname: remove duplicate slashes and trailing slash
  let pathname = parsed.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');

  // Strip query string fragments accidentally pasted in pathname
  if (pathname.includes('?')) {
    pathname = pathname.split('?')[0];
  }

  // Auto-map UrbanPlanningGeosphere or non-REST portal aliases
  if (/urbanplanninggeosphere/i.test(pathname)) {
    pathname = '/arcgis/rest/services/UDM';
  } else if (!pathname.toLowerCase().includes('/rest/services') && !pathname.toLowerCase().includes('/arcgis')) {
    // If entered without /arcgis/rest/services (e.g. https://geosmart.dmt.gov.ae/UDM or /Images)
    if (/^\/(UDM|MasterPlan|GeoPlanner2|Images|Survey|Topography|BaseMaps|Utilities|SubAddressing)/i.test(pathname)) {
      pathname = `/arcgis/rest/services${pathname}`;
    }
  }

  // If SOAP url without /rest/services, rewrite to REST services
  if (pathname.toLowerCase().includes('/arcgis/services') && !pathname.toLowerCase().includes('/arcgis/rest/services')) {
    pathname = pathname.replace(/\/arcgis\/services/i, '/arcgis/rest/services');
  }

  // If the pathname points to a sub-operation or sublayer on an ImageServer or MapServer,
  // e.g. /ImageServer/exportImage, /ImageServer/0, /MapServer/0, /MapServer/export, /MapServer/layers, /MapServer/tile/{z}/{y}/{x}
  // strip off the trailing sub-operation so we target the service root!
  const subOpMatch = pathname.match(/^(.*?\/(?:ImageServer|MapServer))(?:\/.*)?$/i);
  if (subOpMatch) {
    pathname = subOpMatch[1];
  } else {
    // Strip trailing /tile, /export, /exportImage, /layers, /info, /query, or numerical layer indices like /0
    pathname = pathname.replace(/\/(?:tile(?:\/.*)?|exportImage|export|layers|info|query|\d+)$/i, '');
  }

  const cleanUrl = `${parsed.origin}${pathname}`;

  // Find root /rest/services
  const servicesIndex = cleanUrl.toLowerCase().indexOf('/rest/services');
  let rootServicesUrl = cleanUrl;
  if (servicesIndex !== -1) {
    rootServicesUrl = cleanUrl.substring(0, servicesIndex + '/rest/services'.length);
  }

  return {
    cleanUrl,
    token: tokenInQuery,
    rootServicesUrl,
  };
}

/**
 * Builds a valid subfolder URL from current endpoint and folder name.
 */
export function buildSubfolderUrl(currentUrl: string, folderName: string): string {
  const { cleanUrl, rootServicesUrl } = normalizeArcGisUrl(currentUrl);
  const cleanFolder = folderName.trim().replace(/^\/+/, '').replace(/\/+$/, '');

  // Prevent duplicate folder segment at end of URL
  if (cleanUrl.toLowerCase().endsWith('/' + cleanFolder.toLowerCase())) {
    return cleanUrl;
  }

  // If folderName contains full relative path (e.g. "Images/2023")
  if (cleanFolder.includes('/')) {
    return `${rootServicesUrl}/${cleanFolder}`;
  }

  return `${cleanUrl}/${cleanFolder}`;
}

/**
 * Extracts metadata hints from service clean name (e.g. year, resolution)
 */
export function extractServiceMetadata(name: string): { year?: string; resolution?: string } {
  const yearMatch = name.match(/\b(19\d\d|20[0-3]\d)\b/);
  const resMatch = name.match(/\b(\d+(?:\.\d+)?\s*(?:cm|m|mm|inch|in))\b/i);

  return {
    year: yearMatch ? yearMatch[1] : undefined,
    resolution: resMatch ? resMatch[1] : undefined,
  };
}

/**
 * Queries the ArcGIS REST Services Directory JSON endpoint (e.g., https://<server>/arcgis/rest/services/Images?f=json)
 * and returns all available ImageServer & MapServer services with normalized URLs and metadata.
 * Automatically handles CORS unblock extensions and server proxy fallbacks.
 */
export async function fetchAvailableImageServices(
  folderRestUrl: string,
  optionsOrToken?: string | FetchCatalogOptions
): Promise<ArcGisCatalogResult> {
  const trimmed = (folderRestUrl || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a valid ArcGIS REST folder or service URL.');
  }

  const options: FetchCatalogOptions =
    typeof optionsOrToken === 'string'
      ? { token: optionsOrToken }
      : (optionsOrToken || {});

  const { cleanUrl, token: urlToken, rootServicesUrl } = normalizeArcGisUrl(trimmed);
  const effectiveToken = options.token?.trim() || urlToken || undefined;
  const forceDirect = Boolean(options.forceDirect);

  // Helper to execute dual-route requests with automatic proxy fallback and safety handling
  const requestArcGisJson = async (
    targetEndpoint: string
  ): Promise<{ data: ArcGisCatalogResponse | null; usedProxy: boolean; error?: string; status?: number }> => {
    let requestUrl: URL;
    try {
      requestUrl = new URL(targetEndpoint);
    } catch {
      return { data: null, usedProxy: false, error: 'Invalid URL format' };
    }
    requestUrl.searchParams.set('f', 'json');
    if (effectiveToken) {
      requestUrl.searchParams.set('token', effectiveToken);
    }

    let res: Response | null = null;
    let usedProxy = false;
    let directError: string | null = null;

    if (forceDirect) {
      // Try direct first
      try {
        res = await fetch(requestUrl.toString());
      } catch (err: any) {
        directError = err?.message || 'Direct connection failed';
      }

      // If direct failed (mixed content or CORS), attempt cloud proxy as transparent safety net
      if (!res || !res.ok) {
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(requestUrl.toString())}`;
          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) {
            res = proxyRes;
            usedProxy = true;
          }
        } catch {}
      }
    } else {
      // Standard route: direct first for low latency, automatic proxy on CORS/network failure
      try {
        res = await fetch(requestUrl.toString());
      } catch (err: any) {
        directError = err?.message || 'Direct connection failed';
      }

      if (!res || !res.ok) {
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(requestUrl.toString())}`;
          res = await fetch(proxyUrl);
          usedProxy = true;
        } catch (pErr: any) {
          directError = pErr?.message || 'Proxy connection failed';
        }
      }
    }

    if (!res) {
      return { data: null, usedProxy: false, error: directError || 'Network request failed' };
    }

    if (!res.ok) {
      let errText = `HTTP ${res.status} (${res.statusText})`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) errText = errJson.error.message;
        else if (errJson?.error) errText = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
        else if (errJson?.message) errText = errJson.message;
      } catch {
        try {
          const rawText = await res.text();
          if (rawText && rawText.length < 200) errText = rawText;
        } catch {}
      }
      return { data: null, usedProxy, status: res.status, error: errText };
    }

    try {
      const data = await res.json();
      return { data, usedProxy, status: res.status };
    } catch {
      return { data: null, usedProxy, status: res.status, error: 'Endpoint did not return valid ArcGIS JSON (it may be an internal intranet portal or requires VPN)' };
    }
  };

  // Handle direct ImageServer or MapServer URL input
  if (/\/(ImageServer|MapServer)$/i.test(cleanUrl)) {
    const isImage = /\/ImageServer$/i.test(cleanUrl);
    const parts = cleanUrl.split('/services/');
    const rawName = parts.length > 1 ? parts[1].replace(/\/(ImageServer|MapServer)$/i, '') : cleanUrl.split('/').slice(-2)[0];
    const cleanName = rawName.split('/').pop()?.replace(/_/g, ' ') || 'Direct Aerial Survey Service';
    const meta = extractServiceMetadata(cleanName);

    // Verify endpoint accessibility & retrieve real metadata
    const check = await requestArcGisJson(cleanUrl);
    const serviceTitle = check.data?.name || check.data?.serviceDescription || cleanName;
    const finalClean = serviceTitle.split('/').pop()?.replace(/_/g, ' ') || cleanName;

    return {
      services: [
        {
          name: rawName,
          type: isImage ? 'ImageServer' : 'MapServer',
          cleanName: finalClean,
          url: cleanUrl,
          year: meta.year,
          resolution: meta.resolution,
        },
      ],
      folders: [],
      usedProxy: check.usedProxy,
      cleanUrl,
      rootServicesUrl,
    };
  }

  // Primary Query: Fetch target folder or services directory
  const primary = await requestArcGisJson(cleanUrl);
  let data = primary.data;
  let usedProxy = primary.usedProxy;

  // AUTO-PROBE RECOVERY:
  // If server responded with 400 "Invalid URL", 404, or returned an ArcGIS error object,
  // the user might have entered a service name WITHOUT the /ImageServer or /MapServer suffix,
  // or entered a domain missing /arcgis/rest/services. Probe candidate endpoints automatically!
  const hasArcGisError = Boolean(data?.error);
  const isInvalidUrlError = hasArcGisError && (data?.error?.code === 400 || /invalid url/i.test(data?.error?.message || ''));
  const isNotFound = primary.status === 404 || (hasArcGisError && data?.error?.code === 404);

  if (!data || isInvalidUrlError || isNotFound) {
    console.log(`[ArcGIS Auto-Probe] Endpoint "${cleanUrl}" returned ${data?.error?.message || primary.error || 'error'}. Probing service endpoints...`);

    // Candidate 1: Probe as ImageServer (e.g. .../Images/1972_LandSat/ImageServer)
    const imageProbe = await requestArcGisJson(`${cleanUrl}/ImageServer`);
    if (imageProbe.data && !imageProbe.data.error && (imageProbe.data.serviceDescription !== undefined || imageProbe.data.extent || imageProbe.data.currentVersion)) {
      console.log(`[ArcGIS Auto-Probe] Successfully resolved as ImageServer: ${cleanUrl}/ImageServer`);
      const sName = imageProbe.data.name || cleanUrl.split('/').pop() || 'Aerial Imagery Survey';
      const cleanName = sName.split('/').pop()?.replace(/_/g, ' ') || sName;
      const meta = extractServiceMetadata(cleanName);
      return {
        services: [
          {
            name: sName,
            type: 'ImageServer',
            cleanName,
            url: `${cleanUrl}/ImageServer`,
            year: meta.year,
            resolution: meta.resolution,
          },
        ],
        folders: [],
        currentVersion: imageProbe.data.currentVersion,
        usedProxy: imageProbe.usedProxy,
        cleanUrl: `${cleanUrl}/ImageServer`,
        rootServicesUrl,
      };
    }

    // Candidate 2: Probe as MapServer (e.g. .../Survey/AAM_Plots/MapServer)
    const mapProbe = await requestArcGisJson(`${cleanUrl}/MapServer`);
    if (mapProbe.data && !mapProbe.data.error && (mapProbe.data.serviceDescription !== undefined || mapProbe.data.extent || mapProbe.data.layers || mapProbe.data.currentVersion)) {
      console.log(`[ArcGIS Auto-Probe] Successfully resolved as MapServer: ${cleanUrl}/MapServer`);
      const sName = mapProbe.data.name || cleanUrl.split('/').pop() || 'Map Server Survey';
      const cleanName = sName.split('/').pop()?.replace(/_/g, ' ') || sName;
      const meta = extractServiceMetadata(cleanName);
      return {
        services: [
          {
            name: sName,
            type: 'MapServer',
            cleanName,
            url: `${cleanUrl}/MapServer`,
            year: meta.year,
            resolution: meta.resolution,
          },
        ],
        folders: [],
        currentVersion: mapProbe.data.currentVersion,
        usedProxy: mapProbe.usedProxy,
        cleanUrl: `${cleanUrl}/MapServer`,
        rootServicesUrl,
      };
    }

    // Candidate 3: Missing /arcgis/rest/services (e.g. user pasted root server domain)
    if (!cleanUrl.toLowerCase().includes('/rest/services')) {
      const restCandidate = cleanUrl.toLowerCase().includes('/arcgis')
        ? `${cleanUrl}/rest/services`
        : `${cleanUrl}/arcgis/rest/services`;
      const restProbe = await requestArcGisJson(restCandidate);
      if (restProbe.data && !restProbe.data.error && (restProbe.data.services || restProbe.data.folders)) {
        console.log(`[ArcGIS Auto-Probe] Successfully discovered REST catalog at: ${restCandidate}`);
        data = restProbe.data;
        usedProxy = restProbe.usedProxy;
      }
    }

    // Candidate 4: If querying a subfolder failed, probe the root services directory
    if ((!data || data.error) && rootServicesUrl && cleanUrl.toLowerCase() !== rootServicesUrl.toLowerCase()) {
      console.log(`[ArcGIS Auto-Probe] Target path failed, probing root services directory: ${rootServicesUrl}`);
      const rootProbe = await requestArcGisJson(rootServicesUrl);
      if (rootProbe.data && !rootProbe.data.error && (rootProbe.data.services || rootProbe.data.folders)) {
        console.log(`[ArcGIS Auto-Probe] Successfully fell back to root services directory: ${rootServicesUrl}`);
        data = rootProbe.data;
        usedProxy = rootProbe.usedProxy;
      }
    }
  }

  // If still no valid data or error persists after probes
  if (!data) {
    if (forceDirect) {
      throw new Error(
        `Direct connection failed: ${primary.error || 'Unable to reach server'}. If accessing an internal network (e.g. DMT UAE), verify you are connected to the network and your CORS unblock browser extension is enabled.`
      );
    }
    throw new Error(`Unable to connect to ArcGIS server at "${cleanUrl}": ${primary.error || 'Server unreachable'}`);
  }

  if (data.error) {
    const details = data.error.details?.join(' ') || '';
    if (data.error.code === 400 && /invalid url/i.test(data.error.message)) {
      throw new Error(
        `ArcGIS Server reported [400]: Invalid URL at "${cleanUrl}". Could not find a folder or service at this address. For individual aerial surveys, ensure the URL ends with /ImageServer or /MapServer, or select an Abu Dhabi DMT or Esri preset below.`
      );
    }
    if (data.error.code === 404 || /not found/i.test(data.error.message)) {
      throw new Error(
        `ArcGIS Server [404]: Folder or service not found at "${cleanUrl}". Verify the service name or browse the root directory "${rootServicesUrl}".`
      );
    }
    if (data.error.code === 498 || data.error.code === 499 || /token/i.test(data.error.message)) {
      throw new Error(
        `ArcGIS Server Error [${data.error.code}]: ${data.error.message}. Please enter a valid access token in the Authentication field.`
      );
    }
    throw new Error(`ArcGIS Server Error [${data.error.code}]: ${data.error.message}. ${details}`.trim());
  }

  // Handle case where URL pointed to a single ImageServer or MapServer endpoint (without explicit /ImageServer suffix)
  if (!data.services && (data.name || data.serviceDescription !== undefined || data.extent)) {
    const sName = data.name || cleanUrl.split('/').slice(-2)[0] || 'Selected Imagery Service';
    const isImage = /\/ImageServer/i.test(cleanUrl);
    const cleanName = sName.split('/').pop()?.replace(/_/g, ' ') || sName;
    const meta = extractServiceMetadata(cleanName);
    return {
      services: [
        {
          name: sName,
          type: isImage ? 'ImageServer' : 'MapServer',
          cleanName,
          url: cleanUrl,
          year: meta.year,
          resolution: meta.resolution,
        },
      ],
      folders: data.folders || [],
      currentVersion: data.currentVersion,
      usedProxy,
      cleanUrl,
      rootServicesUrl,
    };
  }

  // Construct service URLs relative to root /rest/services/
  const services: ArcGisServiceInfo[] = (data.services || [])
    .filter((s) => s.type === 'ImageServer' || s.type === 'MapServer')
    .map((s) => {
      const parts = s.name.split('/');
      const lastPart = parts[parts.length - 1];
      const cleanName = lastPart.replace(/_/g, ' ');
      const meta = extractServiceMetadata(cleanName);

      let serviceUrl: string;
      if (s.url && /^https?:\/\//i.test(s.url)) {
        serviceUrl = s.url.replace(/\/?\?.*$/, '').replace(/\/+$/, '');
      } else {
        const typeEndpoint = s.type === 'ImageServer' ? 'ImageServer' : 'MapServer';
        // In ArcGIS Server REST API, s.name is ALWAYS relative to root /rest/services/
        if (rootServicesUrl) {
          serviceUrl = `${rootServicesUrl}/${s.name}/${typeEndpoint}`;
        } else {
          serviceUrl = `${cleanUrl}/${lastPart}/${typeEndpoint}`;
        }
      }

      return {
        name: s.name,
        type: s.type,
        cleanName,
        url: serviceUrl,
        year: meta.year,
        resolution: meta.resolution,
      };
    });

  return {
    services,
    folders: data.folders || [],
    currentVersion: data.currentVersion,
    usedProxy,
    cleanUrl,
    rootServicesUrl,
  };
}

export interface ArcGisImageServerOptions {
  token?: string;
  alpha?: number;
  brightness?: number;
  contrast?: number;
  splitDirection?: Cesium.SplitDirection;
  flyToBounds?: boolean;
  forceDirect?: boolean;
  useProxy?: boolean;
  serviceType?: 'ImageServer' | 'MapServer' | string;
  onError?: (err: Error | string) => void;
}

/**
 * Checks if a Cesium rectangle covers the entire world (global) or is invalid/undefined.
 * Prevents camera from jumping into outer space / home globe status.
 */
export function isGlobalOrInvalidRectangle(rect?: Cesium.Rectangle | null): boolean {
  if (!rect) return true;
  const width = Math.abs(rect.east - rect.west);
  const height = Math.abs(rect.north - rect.south);
  if (width >= 5.4 || height >= 2.8) return true;
  if (Cesium.Rectangle.equals(rect, Cesium.Rectangle.MAX_VALUE)) return true;
  return false;
}

/**
 * Extracts a Cesium Rectangle from ArcGIS JSON metadata extent object.
 * Supports standard WGS84 (4326), Web Mercator (3857/102100), and projected local CRS
 * including UAE DLTM (EPSG:3997) and UTM Zone 40N (EPSG:32640).
 */
export function extractRectangleFromArcGisExtent(extent: any): Cesium.Rectangle | undefined {
  if (!extent) return undefined;
  const { xmin, ymin, xmax, ymax, spatialReference } = extent;
  if (
    typeof xmin !== 'number' ||
    typeof ymin !== 'number' ||
    typeof xmax !== 'number' ||
    typeof ymax !== 'number'
  ) {
    return undefined;
  }
  const wkid = spatialReference?.latestWkid || spatialReference?.wkid;

  // Check if coordinates are already degrees WGS84
  if (wkid === 4326 || (xmin >= -180 && xmax <= 180 && ymin >= -90 && ymax <= 90)) {
    return Cesium.Rectangle.fromDegrees(
      Math.max(-180, Math.min(180, Math.min(xmin, xmax))),
      Math.max(-90, Math.min(90, Math.min(ymin, ymax))),
      Math.max(-180, Math.min(180, Math.max(xmin, xmax))),
      Math.max(-90, Math.min(90, Math.max(ymin, ymax)))
    );
  }

  // Web Mercator (EPSG:3857 / 102100)
  if (wkid === 3857 || wkid === 102100 || wkid === 102113) {
    try {
      const projection = new Cesium.WebMercatorProjection();
      const sw = projection.unproject(new Cesium.Cartesian3(xmin, ymin, 0));
      const ne = projection.unproject(new Cesium.Cartesian3(xmax, ymax, 0));
      return new Cesium.Rectangle(
        Math.min(sw.longitude, ne.longitude),
        Math.min(sw.latitude, ne.latitude),
        Math.max(sw.longitude, ne.longitude),
        Math.max(sw.latitude, ne.latitude)
      );
    } catch (e) {
      console.warn('[ArcGIS Extent] Failed to unproject Web Mercator extent:', e);
    }
  }

  // Projected local coordinate systems via proj4 (e.g. UAE DLTM WKID 3997, UTM Zone 40N WKID 32640)
  if (wkid) {
    try {
      const epsgCode = `EPSG:${wkid}`;
      const sw = proj4(epsgCode, 'EPSG:4326').forward([xmin, ymin]);
      const ne = proj4(epsgCode, 'EPSG:4326').forward([xmax, ymax]);
      if (
        typeof sw[0] === 'number' && !isNaN(sw[0]) &&
        typeof sw[1] === 'number' && !isNaN(sw[1]) &&
        typeof ne[0] === 'number' && !isNaN(ne[0]) &&
        typeof ne[1] === 'number' && !isNaN(ne[1])
      ) {
        const west = Math.min(sw[0], ne[0]);
        const east = Math.max(sw[0], ne[0]);
        const south = Math.min(sw[1], ne[1]);
        const north = Math.max(sw[1], ne[1]);
        if (west >= -180 && east <= 180 && south >= -90 && north <= 90) {
          return Cesium.Rectangle.fromDegrees(west, south, east, north);
        }
      }
    } catch (projErr) {
      console.warn(`[ArcGIS Extent] Proj4 conversion for WKID ${wkid} failed:`, projErr);
    }
  }

  return undefined;
}

/**
 * Loads or replaces the active aerial imagery layer in CesiumJS.
 * Supports both ArcGIS ImageServer (/exportImage or /tile) and MapServer (/export or /tile),
 * direct connection mode (for CORS unblock extensions and enterprise VPNs/intranets),
 * token authentication, appearance parameters, and camera view preservation.
 */
export async function setArcGisImageServer(
  viewer: Cesium.Viewer,
  serviceUrl: string,
  currentLayerRef: { current: Cesium.ImageryLayer | null },
  token?: string,
  options?: ArcGisImageServerOptions
): Promise<Cesium.ImageryLayer> {
  if (!viewer || viewer.isDestroyed()) {
    throw new Error('Cesium viewer is not initialized or has been destroyed.');
  }

  // Remove existing active survey layer cleanly
  if (currentLayerRef.current) {
    try {
      viewer.imageryLayers.remove(currentLayerRef.current, true);
    } catch (e) {
      console.warn('Error removing prior ArcGIS imagery layer:', e);
    }
    currentLayerRef.current = null;
  }

  const { cleanUrl, token: urlToken } = normalizeArcGisUrl(serviceUrl);
  const effectiveToken = token?.trim() || options?.token?.trim() || urlToken || undefined;
  const isDirectMode = Boolean(options?.forceDirect);

  const appendToken = (base: string): string => {
    if (!effectiveToken) return base;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(effectiveToken)}`;
  };

  // Fetch service metadata to inspect service type, tileInfo, extent, and spatialReference
  let meta: any = null;
  const metaUrl = appendToken(`${cleanUrl}?f=json`);
  try {
    if (isDirectMode) {
      const res = await fetch(metaUrl);
      if (res.ok) meta = await res.json();
    } else {
      try {
        const res = await fetch(metaUrl);
        if (res.ok) meta = await res.json();
      } catch {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(metaUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) meta = await res.json();
      }
    }
  } catch (e) {
    console.warn('[ArcGIS Service] Metadata pre-fetch skipped or failed, using endpoint heuristic:', e);
  }

  // Detect whether this is an ImageServer or MapServer
  const isImageServer =
    /\/ImageServer$/i.test(cleanUrl) ||
    options?.serviceType === 'ImageServer' ||
    meta?.serviceDataType !== undefined ||
    meta?.type === 'ImageServer' ||
    Boolean(meta?.capabilities?.toLowerCase()?.includes('image') && !meta?.layers);

  // Compute bounding rectangle if available from metadata
  const serviceRectangle = extractRectangleFromArcGisExtent(meta?.fullExtent || meta?.extent || meta?.initialExtent);

  // Check whether pre-cached tiles exist and are in a supported standard tiling scheme (3857/102100 or 4326)
  const tileWkid = meta?.tileInfo?.spatialReference?.latestWkid || meta?.tileInfo?.spatialReference?.wkid;
  const hasStandardCachedTiles = Boolean(
    meta?.tileInfo && (tileWkid === 3857 || tileWkid === 102100 || tileWkid === 102113 || tileWkid === 4326)
  );

  let provider: any = null;

  if (isImageServer) {
    // --- ARCGIS IMAGESERVER STREAMING ---
    // Cached tiles: uses /tile/{z}/{y}/{x}
    // Dynamic raster: uses /exportImage with literal commas in bbox and size
    if (hasStandardCachedTiles) {
      const tileUrl = appendToken(`${cleanUrl}/tile/{z}/{y}/{x}`);
      provider = new Cesium.UrlTemplateImageryProvider({
        url: isDirectMode
          ? tileUrl
          : new Cesium.Resource({ url: tileUrl, proxy: new Cesium.DefaultProxy('/api/proxy?url=') }),
        tilingScheme: tileWkid === 4326 ? new Cesium.GeographicTilingScheme() : new Cesium.WebMercatorTilingScheme(),
        rectangle: serviceRectangle,
        maximumLevel: meta?.tileInfo?.lods ? meta.tileInfo.lods.length - 1 : 22,
        credit: meta?.copyrightText || meta?.description || undefined,
      });
    } else {
      // Dynamic exportImage with on-the-fly server reprojection to EPSG:3857 Web Mercator
      const exportUrl = appendToken(
        `${cleanUrl}/exportImage?bbox={westProjected},{southProjected},{eastProjected},{northProjected}&size=256,256&format=jpgpng&transparent=true&f=image&bboxSR=3857&imageSR=3857`
      );
      provider = new Cesium.UrlTemplateImageryProvider({
        url: isDirectMode
          ? exportUrl
          : new Cesium.Resource({ url: exportUrl, proxy: new Cesium.DefaultProxy('/api/proxy?url=') }),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        rectangle: serviceRectangle,
        maximumLevel: 22,
        credit: meta?.copyrightText || meta?.description || undefined,
      });
    }
  } else {
    // --- ARCGIS MAPSERVER STREAMING ---
    // Attempt 1: Standard cached tiles
    if (hasStandardCachedTiles) {
      const tileUrl = appendToken(`${cleanUrl}/tile/{z}/{y}/{x}`);
      provider = new Cesium.UrlTemplateImageryProvider({
        url: isDirectMode
          ? tileUrl
          : new Cesium.Resource({ url: tileUrl, proxy: new Cesium.DefaultProxy('/api/proxy?url=') }),
        tilingScheme: tileWkid === 4326 ? new Cesium.GeographicTilingScheme() : new Cesium.WebMercatorTilingScheme(),
        rectangle: serviceRectangle,
        maximumLevel: meta?.tileInfo?.lods ? meta.tileInfo.lods.length - 1 : 22,
        credit: meta?.copyrightText || meta?.description || undefined,
      });
    }

    // Attempt 2: Cesium native ArcGisMapServerImageryProvider
    if (!provider) {
      try {
        const resource = new Cesium.Resource({
          url: cleanUrl,
          queryParameters: effectiveToken ? { token: effectiveToken } : undefined,
          proxy: !isDirectMode ? new Cesium.DefaultProxy('/api/proxy?url=') : undefined,
        });
        provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(resource, {
          usePreCachedTilesIfAvailable: false, // Prevents crash on local UAE WKID (e.g. 3997)
          enablePickFeatures: false,
        });
      } catch (cesiumErr) {
        console.warn('[ArcGIS Stream] ArcGisMapServerImageryProvider failed, falling back to dynamic UrlTemplateImageryProvider:', cesiumErr);
      }
    }

    // Attempt 3: Dynamic MapServer export endpoint with literal commas
    if (!provider) {
      const exportUrl = appendToken(
        `${cleanUrl}/export?bbox={westProjected},{southProjected},{eastProjected},{northProjected}&size=256,256&format=png32&transparent=true&f=image&bboxSR=3857&imageSR=3857`
      );
      provider = new Cesium.UrlTemplateImageryProvider({
        url: isDirectMode
          ? exportUrl
          : new Cesium.Resource({ url: exportUrl, proxy: new Cesium.DefaultProxy('/api/proxy?url=') }),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        rectangle: serviceRectangle,
        maximumLevel: 22,
        credit: meta?.copyrightText || meta?.description || undefined,
      });
    }
  }

  // Monitor tile load errors to notify the user of mixed content or auth issues
  if (provider.errorEvent) {
    let errReported = false;
    provider.errorEvent.addEventListener((tileErr: any) => {
      if (!errReported) {
        errReported = true;
        console.warn('[ArcGIS Aerial Imagery] Tile request error:', tileErr);
        if (window.location.protocol === 'https:' && cleanUrl.startsWith('http:')) {
          options?.onError?.(
            'Browser Mixed Content Notice: Your ArcGIS server uses HTTP while this site is HTTPS. If map imagery does not render, click the tune/lock icon next to the address bar -> Site settings -> Insecure content -> Allow, or ensure your CORS extension permits HTTP.'
          );
        }
      }
    });
  }

  const layer = viewer.imageryLayers.addImageryProvider(provider);
  viewer.imageryLayers.raiseToTop(layer);

  // Store metadata rectangle on layer for manual "Fly to survey" actions
  (layer as any)._surveyRectangle = serviceRectangle || provider.rectangle;

  // Configure appearance options
  if (typeof options?.alpha === 'number') layer.alpha = options.alpha;
  if (typeof options?.brightness === 'number') layer.brightness = options.brightness;
  if (typeof options?.contrast === 'number') layer.contrast = options.contrast;
  if (typeof options?.splitDirection === 'number') layer.splitDirection = options.splitDirection;

  // Camera preservation: only fly to bounds if EXPLICITLY requested AND rectangle is localized
  if (options?.flyToBounds === true) {
    const targetRect = (layer as any)._surveyRectangle;
    if (targetRect && !isGlobalOrInvalidRectangle(targetRect)) {
      try {
        viewer.camera.flyTo({
          destination: targetRect,
          duration: 1.5,
        });
      } catch (e) {
        console.warn('Could not fly to imagery provider bounds:', e);
      }
    } else {
      console.log('[ArcGIS Aerial Imagery] Extent is global or unprojected; camera view preserved.');
    }
  }

  if (viewer.scene && !viewer.scene.isDestroyed()) {
    viewer.scene.requestRender();
  }

  currentLayerRef.current = layer;
  return layer;
}

/**
 * Removes the active ArcGIS aerial imagery layer cleanly
 */
export function removeArcGisImageServer(
  viewer: Cesium.Viewer | null | undefined,
  currentLayerRef: { current: Cesium.ImageryLayer | null }
): void {
  if (viewer && !viewer.isDestroyed() && currentLayerRef.current) {
    try {
      viewer.imageryLayers.remove(currentLayerRef.current, true);
    } catch (e) {
      console.warn('Error removing ArcGIS imagery layer:', e);
    }
  }
  currentLayerRef.current = null;
  if (viewer && viewer.scene && !viewer.scene.isDestroyed()) {
    viewer.scene.requestRender();
  }
}
