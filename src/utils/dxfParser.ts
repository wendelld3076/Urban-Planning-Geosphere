import DxfParser from 'dxf-parser';
import proj4 from 'proj4';
import { PolygonData, ShapefileData, ShapefileFeature } from '../types';

export interface CrsPreset {
  code: string;
  name: string;
  proj4Def: string;
}

export const CAD_CRS_PRESETS: CrsPreset[] = [
  {
    code: 'INHERITED_UTM',
    name: '📍 Inherited Current View UTM Zone (Dynamic)',
    proj4Def: 'dynamic'
  },
  {
    code: 'EPSG:32640',
    name: 'WGS 84 / UTM Zone 40N (Middle East / Arabian Peninsula)',
    proj4Def: '+proj=utm +zone=40 +datum=WGS84 +units=m +no_defs'
  },
  {
    code: 'EPSG:32639',
    name: 'WGS 84 / UTM Zone 39N (Middle East / Western Gulf)',
    proj4Def: '+proj=utm +zone=39 +datum=WGS84 +units=m +no_defs'
  },
  {
    code: 'FLAT_LOCAL_GRID',
    name: 'Relative Flat Local Grid (Centered on Map Focus)',
    proj4Def: 'flat'
  },
  {
    code: 'EPSG:32610',
    name: 'WGS 84 / UTM Zone 10N (US West / SF)',
    proj4Def: '+proj=utm +zone=10 +datum=WGS84 +units=m +no_defs'
  },
  {
    code: 'EPSG:32611',
    name: 'WGS 84 / UTM Zone 11N (US West / Vegas & LA)',
    proj4Def: '+proj=utm +zone=11 +datum=WGS84 +units=m +no_defs'
  },
  {
    code: 'EPSG:26910',
    name: 'NAD83 / UTM Zone 10N (US West / SF)',
    proj4Def: '+proj=utm +zone=10 +datum=NAD83 +units=m +no_defs'
  },
  {
    code: 'EPSG:26911',
    name: 'NAD83 / UTM Zone 11N (US West / LA)',
    proj4Def: '+proj=utm +zone=11 +datum=NAD83 +units=m +no_defs'
  },
  {
    code: 'EPSG:26917',
    name: 'NAD83 / UTM Zone 17N (US East / FL & NC)',
    proj4Def: '+proj=utm +zone=17 +datum=NAD83 +units=m +no_defs'
  },
  {
    code: 'EPSG:26918',
    name: 'NAD83 / UTM Zone 18N (US East / NY & DC)',
    proj4Def: '+proj=utm +zone=18 +datum=NAD83 +units=m +no_defs'
  },
  {
    code: 'EPSG:2227',
    name: 'NAD83 / California Zone 3 (US Survey Feet / SF Bay Area)',
    proj4Def: '+proj=lcc +lat_1=38.96666666666667 +lat_2=37.26666666666667 +lat_0=36.5 +lon_0=-120.5 +x_0=2000000.0001016 +y_0=500000.0001016001 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs'
  },
  {
    code: 'EPSG:2263',
    name: 'NAD83 / New York Long Island (US Survey Feet)',
    proj4Def: '+proj=lcc +lat_1=41.03333333333333 +lat_2=40.66666666666666 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000 +y_0=0 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs'
  },
  {
    code: 'EPSG:2278',
    name: 'NAD83 / Texas South Central (US Survey Feet)',
    proj4Def: '+proj=lcc +lat_1=30.28333333333333 +lat_2=28.38333333333333 +lat_0=27.83333333333333 +lon_0=-99 +x_0=600000.0000000001 +y_0=3000000 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs'
  },
  {
    code: 'EPSG:27700',
    name: 'OSGB36 / British National Grid (UK)',
    proj4Def: '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs'
  }
];

export interface DxfParseResult {
  polygonData: PolygonData;
  shapefileData: ShapefileData;
  hasOpenPolylines: boolean;
}

/**
 * Parses DXF text data, extracts LWPOLYLINE entities, validates closed loops,
 * reprojects vertices using the selected CRS or falls back to a flat-transform,
 * and compiles standard structures compatible with the App's GIS layer engine.
 */
export function parseDxfFile(
  dxfText: string,
  selectedCrsCode: string,
  fallbackCenter?: { latitude: number; longitude: number } | null,
  dxfFileName: string = 'Imported CAD Boundary',
  workspaceOrigin?: { lat: number; lng: number } | null,
  allowOpenPolylines: boolean = false
): DxfParseResult {
  const parser = new DxfParser();
  let dxfData;
  try {
    dxfData = parser.parseSync(dxfText);
  } catch (err: any) {
    throw new Error(`Failed to parse DXF: ${err?.message || err}`);
  }

  if (!dxfData || !dxfData.entities) {
    throw new Error('This DXF file contains no entities.');
  }

  // Set up target entities array to handle different geometries nicely
  interface TempEntity {
    vertices: { x: number; y: number }[];
    isClosed: boolean;
    layer: string;
    handle: string;
    color?: string | number;
    elevation?: number;
  }
  const targetEntities: TempEntity[] = [];
  let hasOpenPolylines = false;

  const totalRawEntitiesCount = dxfData.entities ? dxfData.entities.length : 0;
  
  // Dynamic threshold for filtering out tiny detailing noise (ticks, labels, hatches) in large CAD drawings
  let lengthThreshold = 0;
  if (totalRawEntitiesCount > 5000) {
    lengthThreshold = 1.5; // skip anything shorter than 1.5 CAD units
  } else if (totalRawEntitiesCount > 2000) {
    lengthThreshold = 0.8; // skip anything shorter than 0.8 CAD units
  } else if (totalRawEntitiesCount > 800) {
    lengthThreshold = 0.35; // skip anything shorter than 35cm
  }

  const getEntityLengthOrDiagonal = (vertices: { x: number; y: number }[]): number => {
    if (vertices.length < 2) return 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vertices.forEach(v => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });
    const dx = maxX - minX;
    const dy = maxY - minY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  if (allowOpenPolylines) {
    dxfData.entities.forEach((ent: any) => {
      if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
        if (ent.vertices && ent.vertices.length >= 2) {
          const verticesMapped = ent.vertices.map((v: any) => ({ x: v.x, y: v.y }));
          if (lengthThreshold > 0 && getEntityLengthOrDiagonal(verticesMapped) < lengthThreshold) {
            return; // skip tiny detail noise
          }
          const isClosed = ent.shape === true || ent.closed === true;
          if (!isClosed) {
            hasOpenPolylines = true;
          }
          targetEntities.push({
            vertices: verticesMapped,
            isClosed,
            layer: ent.layer || '0',
            handle: ent.handle || `cad_ent_${Date.now()}_${Math.random()}`,
            color: ent.color,
            elevation: ent.elevation || 0
          });
        }
      } else if (ent.type === 'LINE') {
        if (ent.start && ent.end) {
          const verticesMapped = [
            { x: ent.start.x, y: ent.start.y },
            { x: ent.end.x, y: ent.end.y }
          ];
          if (lengthThreshold > 0 && getEntityLengthOrDiagonal(verticesMapped) < lengthThreshold) {
            return; // skip tiny detail noise
          }
          hasOpenPolylines = true;
          targetEntities.push({
            vertices: verticesMapped,
            isClosed: false,
            layer: ent.layer || '0',
            handle: ent.handle || `cad_ent_${Date.now()}_${Math.random()}`,
            color: ent.color,
            elevation: ent.elevation || 0
          });
        }
      }
    });
  } else {
    // Standard closed polylines only
    const lwPolylines = dxfData.entities.filter(
      (ent: any) => ent.type === 'LWPOLYLINE'
    );

    if (lwPolylines.length === 0) {
      throw new Error('No LWPOLYLINE elements found in this DXF file.');
    }

    lwPolylines.forEach((ent: any) => {
      const isClosed = ent.shape === true || ent.closed === true;
      if (!isClosed) {
        hasOpenPolylines = true;
      }
      if (isClosed && ent.vertices && ent.vertices.length >= 3) {
        const verticesMapped = ent.vertices.map((v: any) => ({ x: v.x, y: v.y }));
        if (lengthThreshold > 0 && getEntityLengthOrDiagonal(verticesMapped) < lengthThreshold) {
          return; // skip tiny detail noise
        }
        targetEntities.push({
          vertices: verticesMapped,
          isClosed: true,
          layer: ent.layer || '0',
          handle: ent.handle || `cad_ent_${Date.now()}_${Math.random()}`,
          color: ent.color,
          elevation: ent.elevation || 0
        });
      }
    });
  }

  if (targetEntities.length === 0) {
    if (allowOpenPolylines) {
      throw new Error('No LWPOLYLINE, POLYLINE, or LINE elements found in this DXF file.');
    } else {
      throw new Error(
        'No closed LWPOLYLINE elements found. Ensure the boundaries form a complete closed loop.'
      );
    }
  }

  // Compute CAD local centroid across all target entities for the flat transformation safety net
  let sumX = 0;
  let sumY = 0;
  let vertexCount = 0;

  targetEntities.forEach((ent: any) => {
    ent.vertices.forEach((v: any) => {
      sumX += v.x;
      sumY += v.y;
      vertexCount++;
    });
  });

  const localCentroidX = vertexCount > 0 ? sumX / vertexCount : 0;
  const localCentroidY = vertexCount > 0 ? sumY / vertexCount : 0;

  // Set up WGS84 origin reference for the flat transformation safety net
  let originLon = -122.4194; // Fallback to San Francisco
  let originLat = 37.7749;
  if (workspaceOrigin) {
    originLon = workspaceOrigin.lng;
    originLat = workspaceOrigin.lat;
  } else if (fallbackCenter) {
    originLon = fallbackCenter.longitude;
    originLat = fallbackCenter.latitude;
  }

  // Determine scale unit (meters vs feet) based on CRS selection or DXF header if available
  let unitScale = 1.0;
  const preset = CAD_CRS_PRESETS.find((p) => p.code === selectedCrsCode);
  if (preset && preset.proj4Def.includes('+to_meter=')) {
    // Extract to_meter scale from proj4 string
    const match = preset.proj4Def.match(/\+to_meter=([-\d.]+)/);
    if (match) {
      unitScale = parseFloat(match[1]);
    }
  } else if (
    dxfData.header &&
    (dxfData.header.$MEASUREMENT === 0 || dxfData.header.$INSUNITS === 1)
  ) {
    // Inches or Feet indicator in DXF headers
    unitScale = 0.3048; // Convert feet/inches to meters approx
  }

  const R = 6378137; // Earth's radius in meters
  const originLatRad = (originLat * Math.PI) / 180;

  // Flat projection fallback mapping local (x, y) relative to localCentroid onto map focus
  const flatTransform = (x: number, y: number): [number, number] => {
    const dx = (x - localCentroidX) * unitScale;
    const dy = (y - localCentroidY) * unitScale;
    const dLatRad = dy / R;
    const dLonRad = dx / (R * Math.cos(originLatRad));
    const lat = originLat + (dLatRad * 180) / Math.PI;
    const lon = originLon + (dLonRad * 180) / Math.PI;
    return [lon, lat];
  };

  // Register Proj4 definition if non-flat or dynamic
  let useFlatTransformOnly = selectedCrsCode === 'FLAT_LOCAL_GRID';
  let activeCrsCode = selectedCrsCode;

  if (selectedCrsCode === 'INHERITED_UTM' || selectedCrsCode.startsWith('DYNAMIC_UTM')) {
    if (workspaceOrigin) {
      const utmZone = Math.floor((workspaceOrigin.lng + 180) / 6) + 1;
      const isNorthernHemisphere = workspaceOrigin.lat >= 0;
      const dynamicProj4String = `+proj=utm +zone=${utmZone} ${isNorthernHemisphere ? '+north' : '+south'} +datum=WGS84 +units=m +no_defs`;
      activeCrsCode = `DYNAMIC_UTM_${utmZone}`;
      try {
        proj4.defs(activeCrsCode, dynamicProj4String);
        useFlatTransformOnly = false;
      } catch (e) {
        console.warn('Error defining dynamic UTM proj4 def, falling back:', e);
        useFlatTransformOnly = true;
      }
    } else {
      useFlatTransformOnly = true;
    }
  } else if (!useFlatTransformOnly && preset) {
    try {
      proj4.defs(selectedCrsCode, preset.proj4Def);
    } catch (e) {
      console.warn('Error defining proj4 CRS, defaulting to flat transform:', e);
      useFlatTransformOnly = true;
    }
  }

  const projectPoint = (x: number, y: number): [number, number] => {
    if (useFlatTransformOnly) {
      return flatTransform(x, y);
    }
    try {
      const res = proj4(activeCrsCode, 'EPSG:4326').forward([x, y]);
      
      // Verify reprojection coordinates are valid WGS84
      const isInvalid =
        isNaN(res[0]) ||
        isNaN(res[1]) ||
        Math.abs(res[0]) > 180.0 ||
        Math.abs(res[1]) > 90.0 ||
        (Math.abs(res[0]) < 0.0001 && Math.abs(res[1]) < 0.0001) || // 0,0 Africa fallback
        // Check if projected latitude lands near equator due to local CAD Y coordinate (<2.0°) when origin is far from equator
        (Math.abs(originLat) > 5.0 && Math.abs(res[1]) < 2.0) ||
        // Check if projected result is further than 10 degrees (~1000km) from workspace origin (local CAD coords vs projected CRS)
        (Math.abs(res[0] - originLon) > 10.0 || Math.abs(res[1] - originLat) > 10.0);

      if (isInvalid) {
        return flatTransform(x, y);
      }
      return [res[0], res[1]];
    } catch (e) {
      console.warn('Proj4 transformation failed, falling back to flat:', e);
      return flatTransform(x, y);
    }
  };

  // Process features
  const parsedFeatures: ShapefileFeature[] = [];

  targetEntities.forEach((ent: any, idx: number) => {
    const rawVertices = ent.vertices;
    const positions: [number, number][] = rawVertices.map((v: any) =>
      projectPoint(v.x, v.y)
    );

    // Close the loop if not closed in vertices array and entity is closed
    if (ent.isClosed && positions.length >= 3) {
      const first = positions[0];
      const last = positions[positions.length - 1];
      if (first && last && (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7)) {
        positions.push([first[0], first[1]]);
      }
    }

    // Bounding Box
    let fMinLng = Infinity,
      fMaxLng = -Infinity,
      fMinLat = Infinity,
      fMaxLat = -Infinity;
    positions.forEach(([lng, lat]) => {
      if (lng < fMinLng) fMinLng = lng;
      if (lng > fMaxLng) fMaxLng = lng;
      if (lat < fMinLat) fMinLat = lat;
      if (lat > fMaxLat) fMaxLat = lat;
    });

    const layerProps = {
      name: ent.name || dxfFileName || 'Imported CAD Boundary',
      handle: ent.handle || `cad_h_${idx}`,
      layer: ent.layer || '0',
      color: ent.color || '#000000',
      height: ent.elevation || 0,
      type: ent.layer || '0', // Expose layer name as type for utilities classification
      depth: ent.elevation !== 0 ? ent.elevation : undefined
    };

    // Simple center
    let centerLng = 0;
    let centerLat = 0;
    positions.forEach(([lng, lat]) => {
      centerLng += lng;
      centerLat += lat;
    });
    const center: [number, number] = [
      positions.length > 0 ? centerLng / positions.length : originLon,
      positions.length > 0 ? centerLat / positions.length : originLat
    ];

    parsedFeatures.push({
      id: ent.handle || `cad_${Date.now()}_${idx}`,
      positions,
      properties: layerProps,
      center,
      isLine: !ent.isClosed, // If not closed, treat as open polyline segment (Line)
      bounds: {
        west: fMinLng,
        south: fMinLat,
        east: fMaxLng,
        north: fMaxLat
      }
    });
  });

  if (parsedFeatures.length === 0) {
    throw new Error('No coordinates extracted successfully.');
  }

  // Robust vertex-level outlier filter to eliminate stray (0,0) CAD origin points or distant paper-space blocks
  const rawLats: number[] = [];
  const rawLngs: number[] = [];
  parsedFeatures.forEach((f) => {
    f.positions.forEach(([lng, lat]) => {
      if (!isNaN(lng) && !isNaN(lat)) {
        rawLngs.push(lng);
        rawLats.push(lat);
      }
    });
  });

  let medianLng = originLon;
  let medianLat = originLat;
  if (rawLats.length > 0 && rawLngs.length > 0) {
    rawLats.sort((a, b) => a - b);
    rawLngs.sort((a, b) => a - b);
    medianLat = rawLats[Math.floor(rawLats.length / 2)];
    medianLng = rawLngs[Math.floor(rawLngs.length / 2)];
  }

  // Filter vertices at the individual feature level
  const cleanFeatures: ShapefileFeature[] = [];
  const cleanCoordinates: [number, number][] = [];

  parsedFeatures.forEach((f) => {
    // Keep vertices within 0.25 degrees (~25km) of median cluster
    const filteredPositions = f.positions.filter(([lng, lat]) => {
      const dLng = Math.abs(lng - medianLng);
      const dLat = Math.abs(lat - medianLat);
      return dLng < 0.25 && dLat < 0.25;
    });

    const activePositions = filteredPositions.length >= 2 ? filteredPositions : f.positions;

    let fMinLng = Infinity,
      fMaxLng = -Infinity,
      fMinLat = Infinity,
      fMaxLat = -Infinity;
    let sumLng = 0,
      sumLat = 0;

    activePositions.forEach(([lng, lat]) => {
      if (lng < fMinLng) fMinLng = lng;
      if (lng > fMaxLng) fMaxLng = lng;
      if (lat < fMinLat) fMinLat = lat;
      if (lat > fMaxLat) fMaxLat = lat;
      sumLng += lng;
      sumLat += lat;
      cleanCoordinates.push([lng, lat]);
    });

    cleanFeatures.push({
      ...f,
      positions: activePositions,
      center: activePositions.length > 0 ? [sumLng / activePositions.length, sumLat / activePositions.length] : f.center,
      bounds: {
        west: fMinLng,
        south: fMinLat,
        east: fMaxLng,
        north: fMaxLat
      }
    });
  });

  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  cleanCoordinates.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  // Prevent degenerate 0-size bounding box
  if (maxLng - minLng < 0.0001) {
    minLng -= 0.0001;
    maxLng += 0.0001;
  }
  if (maxLat - minLat < 0.0001) {
    minLat -= 0.0001;
    maxLat += 0.0001;
  }

  const bounds = {
    west: minLng,
    south: minLat,
    east: maxLng,
    north: maxLat
  };

  // Select main feature with largest vertex count for polygonData.positions
  let mainFeature = cleanFeatures[0];
  let maxPoints = 0;
  cleanFeatures.forEach((f) => {
    if (f.positions && f.positions.length > maxPoints) {
      maxPoints = f.positions.length;
      mainFeature = f;
    }
  });

  const polygonData: PolygonData = {
    positions: mainFeature ? mainFeature.positions : [],
    bounds
  };

  const shapefileData: ShapefileData = {
    features: cleanFeatures,
    bounds,
    fields: ['height'],
    isCad: true
  };

  return {
    polygonData,
    shapefileData,
    hasOpenPolylines
  };
}
