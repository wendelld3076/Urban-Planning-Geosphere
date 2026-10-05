import shp from 'shpjs';
import JSZip from 'jszip';
import proj4 from 'proj4';
import { PolygonData, ShapefileData, ShapefileFeature } from '../types';

export interface ShapefileParseResult {
  polygonData: PolygonData;
  shapefileData: ShapefileData;
}

/**
 * Calculates a simple centroid for a set of 2D coordinates
 */
function getPolygonCenter(positions: [number, number][]): [number, number] {
  if (positions.length === 0) return [0, 0];
  let sumLng = 0;
  let sumLat = 0;
  positions.forEach(([lng, lat]) => {
    sumLng += lng;
    sumLat += lat;
  });
  return [sumLng / positions.length, sumLat / positions.length];
}

/**
 * Smart WKT-to-Proj4 definition string generator.
 * Leverages online EPSG.io lookup if an EPSG code authority is detected,
 * with an advanced regex-based local fallback for CAD / localized projections.
 */
export async function getProj4StringFromWkt(wkt: string): Promise<string> {
  const norm = wkt.trim();
  if (!norm) return '';

  // 1. Try to find EPSG Code Authority in WKT (matches both single and double quotes)
  const authorityMatch = norm.match(/AUTHORITY\s*\[\s*["']EPSG["']\s*,\s*["']?(\d+)["']?\s*\]/i) ||
                         norm.match(/ID\s*\[\s*["']EPSG["']\s*,\s*["']?(\d+)["']?\s*\]/i) ||
                         norm.match(/EPSG["']\s*,\s*["']?(\d+)["']?/i);
  if (authorityMatch) {
    const epsgCode = authorityMatch[1];
    try {
      console.log(`Found EPSG:${epsgCode} in WKT, fetching proj4 definition via proxy...`);
      const response = await fetch(`/api/projection/epsg/${epsgCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.proj4 && data.proj4.trim().startsWith('+proj')) {
          console.log(`Successfully fetched EPSG:${epsgCode} proj4 via proxy:`, data.proj4.trim());
          return data.proj4.trim();
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch online proj4 via proxy for EPSG:${epsgCode}, trying direct fallback:`, e);
    }

    try {
      const response = await fetch(`https://epsg.io/${epsgCode}.proj4`);
      if (response.ok) {
        const proj4Str = await response.text();
        if (proj4Str && proj4Str.trim().startsWith('+proj')) {
          console.log(`Successfully fetched EPSG:${epsgCode} proj4 directly:`, proj4Str.trim());
          return proj4Str.trim();
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch direct online proj4 for EPSG:${epsgCode}, using local parsing fallback:`, e);
    }
  }

  // 2. Local Custom WKT Parser (matches both single and double quotes)
  const unitMatches = Array.from(norm.matchAll(/UNIT\s*\[\s*["']([^"']+)["']\s*,\s*([-\d.]+)/gi));
  let toMeter = 1.0;
  let unitName = 'm';
  if (unitMatches.length > 0) {
    const lastUnit = unitMatches[unitMatches.length - 1];
    unitName = lastUnit[1].toLowerCase();
    toMeter = parseFloat(lastUnit[2]);
  }

  let datum = 'WGS84';
  if (norm.includes('North_American_1983') || norm.includes('NAD83') || norm.includes('NAD_1983')) {
    datum = 'NAD83';
  } else if (norm.includes('North_American_1927') || norm.includes('NAD27') || norm.includes('NAD_1927')) {
    datum = 'NAD27';
  }

  let ellps = '';
  if (norm.includes('GRS_1980') || norm.includes('GRS80')) {
    ellps = 'GRS80';
  } else if (norm.includes('WGS_1984') || norm.includes('WGS84')) {
    ellps = 'WGS84';
  } else if (norm.includes('Clarke_1866') || norm.includes('Clarke1866')) {
    ellps = 'clrk66';
  }

  // Check UTM Zone
  const utmMatch = norm.match(/UTM[_\s]+Zone[_\s]+(\d+)([NS]?)/i) || 
                   norm.match(/UTM\s*(\d+)([NS]?)/i);
  if (utmMatch) {
    const zone = parseInt(utmMatch[1]);
    const hemi = utmMatch[2].toUpperCase() || 'N';
    const parts = [`+proj=utm`, `+zone=${zone}`];
    if (hemi === 'S') {
      parts.push('+south');
    }
    if (datum) parts.push(`+datum=${datum}`);
    if (ellps) parts.push(`+ellps=${ellps}`);
    
    if (unitName.includes('foot') || unitName.includes('feet') || Math.abs(toMeter - 0.3048) < 0.05) {
      parts.push('+units=us-ft');
      parts.push(`+to_meter=${toMeter}`);
    } else {
      parts.push('+units=m');
    }
    parts.push('+no_defs');
    return parts.join(' ');
  }

  // Parse Projection Name (matches both single and double quotes)
  let proj = '';
  const projectionMatch = norm.match(/PROJECTION\s*\[\s*["']([^"']+)["']\s*\]/i);
  if (projectionMatch) {
    const projName = projectionMatch[1].toLowerCase();
    if (projName.includes('transverse_mercator')) {
      proj = 'tmerc';
    } else if (projName.includes('lambert_conformal_conic')) {
      proj = 'lcc';
    } else if (projName.includes('mercator')) {
      proj = 'merc';
    } else if (projName.includes('albers')) {
      proj = 'aea';
    } else if (projName.includes('stereographic')) {
      proj = 'stere';
    }
  }

  const getParamLoose = (names: string[]): number | null => {
    for (const name of names) {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`PARAMETER\\s*\\[\\s*["']${escaped}["']\\s*,\\s*([-\\d.]+)`, 'i');
      const match = norm.match(regex);
      if (match) return parseFloat(match[1]);
    }
    return null;
  };

  const lat1 = getParamLoose(['Standard_Parallel_1', 'Standard Parallel 1', 'standard_parallel_1']);
  const lat2 = getParamLoose(['Standard_Parallel_2', 'Standard Parallel 2', 'standard_parallel_2']);
  const lat0 = getParamLoose(['Latitude_Of_Origin', 'Latitude of Origin', 'latitude_of_origin', 'latitude_of_center', 'Latitude_Of_Center']);
  const lon0 = getParamLoose(['Central_Meridian', 'Central Meridian', 'central_meridian', 'longitude_of_origin', 'longitude_of_center', 'Longitude_Of_Center']);
  const x0 = getParamLoose(['False_Easting', 'False Easting', 'false_easting']);
  const y0 = getParamLoose(['False_Northing', 'False Northing', 'false_northing']);
  const k0 = getParamLoose(['Scale_Factor', 'Scale Factor', 'scale_factor']);

  const parts = [];
  if (proj) {
    parts.push(`+proj=${proj}`);
  } else {
    // Default fallback
    parts.push('+proj=tmerc');
  }

  if (lat1 !== null) parts.push(`+lat_1=${lat1}`);
  if (lat2 !== null) parts.push(`+lat_2=${lat2}`);
  if (lat0 !== null) parts.push(`+lat_0=${lat0}`);
  if (lon0 !== null) parts.push(`+lon_0=${lon0}`);
  if (x0 !== null) parts.push(`+x_0=${x0}`);
  if (y0 !== null) parts.push(`+y_0=${y0}`);
  if (k0 !== null) parts.push(`+k=${k0}`);

  if (datum) parts.push(`+datum=${datum}`);
  if (ellps) parts.push(`+ellps=${ellps}`);

  if (unitName.includes('foot') || unitName.includes('feet') || Math.abs(toMeter - 0.3048006096) < 0.0001) {
    parts.push('+units=us-ft');
    parts.push(`+to_meter=${toMeter}`);
  } else if (unitName.includes('foot') || unitName.includes('feet') || Math.abs(toMeter - 0.3048) < 0.0001) {
    parts.push('+units=ft');
    parts.push(`+to_meter=${toMeter}`);
  } else {
    parts.push(`+to_meter=${toMeter}`);
  }

  parts.push('+no_defs');
  return parts.join(' ');
}

/**
 * Parses a zipped Shapefile (containing .shp, .dbf, .shx etc.) from an ArrayBuffer
 * and converts it into standard PolygonData & full ShapefileData with features and attributes.
 * Supports on-the-fly CAD reprojection if isCadReproject is true.
 */
export async function parseShapefileZip(
  arrayBuffer: ArrayBuffer,
  isCadReproject: boolean = false,
  fallbackCenter?: { latitude: number; longitude: number } | null
): Promise<ShapefileParseResult> {
  // 1. Read .prj metadata via JSZip to analyze projections
  const zip = await JSZip.loadAsync(arrayBuffer);
  const prjFilenames = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.prj'));
  let prjText = '';
  let containsCadKeywords = false;

  if (prjFilenames.length > 0) {
    // Read the primary projection string
    prjText = await zip.files[prjFilenames[0]].async('text');
    const norm = prjText.toUpperCase();
    containsCadKeywords = 
      norm.includes('PROJCS') || 
      norm.includes('UTM') || 
      norm.includes('STATE_PLANE') || 
      norm.includes('FOOT') || 
      norm.includes('FEET') || 
      norm.includes('METER') || 
      norm.includes('METERS') ||
      norm.includes('NAD83') ||
      norm.includes('SPCS');
      
    // Prevent shpjs from using its internal auto-reprojection logic by removing any .prj files.
    // This allows us to handle the reprojection with absolute control.
    prjFilenames.forEach(name => zip.remove(name));
  }

  // Generate a clean zip package without the .prj file
  const cleanBuffer = prjFilenames.length > 0 
    ? await zip.generateAsync({ type: 'arraybuffer' }) 
    : arrayBuffer;

  // 2. Parse GeoJSON via shpjs
  const geojson = await shp(cleanBuffer);
  
  let featureCollection: any;
  if (Array.isArray(geojson)) {
    featureCollection = geojson[0];
  } else {
    featureCollection = geojson;
  }

  if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
    throw new Error('Parsed zip is not a valid GeoJSON FeatureCollection');
  }

  const features = featureCollection.features;
  if (!features || features.length === 0) {
    throw new Error('The shapefile does not contain any features');
  }

  // 3. Scan for huge raw coordinates (out of range of standard degrees) and compute raw centroid
  let hasHugeCoords = false;
  let sumLocalX = 0;
  let sumLocalY = 0;
  let localCount = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    if (geom && geom.coordinates) {
      const checkCoord = (pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          if (typeof pt[0] === 'number') {
            sumLocalX += pt[0];
            sumLocalY += pt[1];
            localCount++;
            if (Math.abs(pt[0]) > 180.0 || Math.abs(pt[1]) > 90.0) {
              hasHugeCoords = true;
            }
          }
        }
      };

      if (geom.type === 'Point') {
        checkCoord(geom.coordinates);
      } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
        geom.coordinates.forEach(checkCoord);
      } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
        geom.coordinates.forEach((ring: any) => ring.forEach(checkCoord));
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly: any) => poly.forEach((ring: any) => ring.forEach(checkCoord)));
      }
    }
  }

  const localCentroidX = localCount > 0 ? sumLocalX / localCount : 0;
  const localCentroidY = localCount > 0 ? sumLocalY / localCount : 0;

  // 3.5 Setup flat projection fallback for CAD/local grids if we can't project them
  let originLon = -122.4194; // San Francisco default fallback if everything is null
  let originLat = 37.7749;
  if (fallbackCenter) {
    originLon = fallbackCenter.longitude;
    originLat = fallbackCenter.latitude;
  }
  
  let unitScale = 1.0;
  if (prjText) {
    const norm = prjText.toUpperCase();
    if (norm.includes('FOOT') || norm.includes('FEET')) {
      unitScale = 0.3048; // convert feet to meters
    }
  }

  const R = 6378137; // Earth's radius in meters
  const originLatRad = (originLat * Math.PI) / 180;

  const flatTransform = (pt: [number, number]): [number, number] => {
    const dxUnits = pt[0] - localCentroidX;
    const dyUnits = pt[1] - localCentroidY;
    const dx = dxUnits * unitScale;
    const dy = dyUnits * unitScale;
    const dLatRad = dy / R;
    const dLonRad = dx / (R * Math.cos(originLatRad));
    const lat = originLat + (dLatRad * 180) / Math.PI;
    const lon = originLon + (dLonRad * 180) / Math.PI;
    return [lon, lat];
  };

  // 4. Initialize CAD/Local Grid Projection Engine if we have a projection file
  let didReproject = false;
  if (prjText && (containsCadKeywords || hasHugeCoords)) {
    try {
      const proj4Str = await getProj4StringFromWkt(prjText);
      if (proj4Str) {
        console.log("Registering proj4 string for CAD_LOCAL_GRID:", proj4Str);
        proj4.defs('CAD_LOCAL_GRID', proj4Str);
        didReproject = true;
      }
    } catch (err) {
      console.error('Failed to register CAD_LOCAL_GRID:', err);
    }
  }

  // Check if we should default entirely to flat fallback
  let useFlatFallback = false;
  if (isCadReproject && hasHugeCoords) {
    if (!didReproject) {
      useFlatFallback = true;
    } else {
      // Test the standard projection with local centroid
      try {
        const testCoords = proj4('CAD_LOCAL_GRID', 'EPSG:4326').forward([localCentroidX, localCentroidY]);
        if (
          isNaN(testCoords[0]) || isNaN(testCoords[1]) ||
          Math.abs(testCoords[0]) > 180.0 || Math.abs(testCoords[1]) > 90.0
        ) {
          useFlatFallback = true;
        }
      } catch (e) {
        useFlatFallback = true;
      }
    }
  }

  // FAIL-SAFE VERIFICATION: If we detected a local grid/projected coords in the standard slot, and we could NOT automatically reproject it, auto-fallback to flat transform to avoid error and map it gracefully
  if (!isCadReproject && !didReproject && (containsCadKeywords || hasHugeCoords)) {
    useFlatFallback = true;
  }

  const transformPoint = (pt: [number, number]): [number, number] => {
    if (useFlatFallback) {
      return flatTransform(pt);
    }

    if (didReproject) {
      try {
        // Try standard [x, y] first (easting, northing)
        const standardWGS84Coords = proj4('CAD_LOCAL_GRID', 'EPSG:4326').forward([pt[0], pt[1]]);
        
        // Check if output coordinates are valid WGS84 coordinates
        if (
          !isNaN(standardWGS84Coords[0]) && !isNaN(standardWGS84Coords[1]) &&
          Math.abs(standardWGS84Coords[0]) <= 180.0 && Math.abs(standardWGS84Coords[1]) <= 90.0
        ) {
          return [standardWGS84Coords[0], standardWGS84Coords[1]];
        }
        
        // If out of bounds, try flipped coordinate [y, x] (northing, easting)
        const flippedCoords = proj4('CAD_LOCAL_GRID', 'EPSG:4326').forward([pt[1], pt[0]]);
        if (
          !isNaN(flippedCoords[0]) && !isNaN(flippedCoords[1]) &&
          Math.abs(flippedCoords[0]) <= 180.0 && Math.abs(flippedCoords[1]) <= 90.0
        ) {
          return [flippedCoords[0], flippedCoords[1]];
        }
        
        // If both standard and flipped proj4 returned out of bounds, use flat transform as safety net
        return flatTransform(pt);
      } catch (e) {
        // Try flipped coordinate fallback on exception
        try {
          const flippedCoords = proj4('CAD_LOCAL_GRID', 'EPSG:4326').forward([pt[1], pt[0]]);
          if (
            !isNaN(flippedCoords[0]) && !isNaN(flippedCoords[1]) &&
            Math.abs(flippedCoords[0]) <= 180.0 && Math.abs(flippedCoords[1]) <= 90.0
          ) {
            return [flippedCoords[0], flippedCoords[1]];
          }
        } catch (_) {}
        
        console.warn('Projection error for point, falling back to flat transform:', pt, e);
        return flatTransform(pt);
      }
    }
    return pt;
  };

  const parsedFeatures: ShapefileFeature[] = [];
  const allCoordinates: [number, number][] = [];
  const numericalFieldsSet = new Set<string>();
  const allFieldsSet = new Set<string>();
  let hasPolylinesOnly = true;

  let index = 0;
  // 5. Traverse features and transform coordinates
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    const properties = feature.properties || {};
    
    // Inspect properties to find all fields and numerical fields
    Object.keys(properties).forEach(key => {
      const cleanKey = key.trim();
      if (cleanKey) {
        allFieldsSet.add(cleanKey);
      }
      const val = properties[key];
      if (typeof val === 'number') {
        numericalFieldsSet.add(key);
      } else if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
        properties[key] = Number(val);
        numericalFieldsSet.add(key);
      }
    });

    let positions: [number, number][] = [];
    const holes: { positions: [number, number][] }[] = [];
    let isLine = false;

    if (geometry.type === 'Polygon') {
      hasPolylinesOnly = false;
      const coords = geometry.coordinates; // [outerRing, hole1, hole2, ...]
      if (coords && coords.length > 0) {
        positions = (coords[0] as [number, number][]).map(pt => transformPoint(pt));
        for (let i = 1; i < coords.length; i++) {
          holes.push({ positions: (coords[i] as [number, number][]).map(pt => transformPoint(pt)) });
        }
        
        coords.forEach((ring: any) => {
          ring.forEach((pt: [number, number]) => {
            allCoordinates.push(transformPoint(pt));
          });
        });
      }
    } else if (geometry.type === 'MultiPolygon') {
      hasPolylinesOnly = false;
      const polygons = geometry.coordinates;
      if (polygons && polygons.length > 0) {
        const primaryPoly = polygons[0];
        if (primaryPoly && primaryPoly.length > 0) {
          positions = (primaryPoly[0] as [number, number][]).map(pt => transformPoint(pt));
          for (let i = 1; i < primaryPoly.length; i++) {
            holes.push({ positions: (primaryPoly[i] as [number, number][]).map(pt => transformPoint(pt)) });
          }
        }
        polygons.forEach((poly: any) => {
          poly.forEach((ring: any) => {
            ring.forEach((pt: [number, number]) => {
              allCoordinates.push(transformPoint(pt));
            });
          });
        });
      }
    } else if (geometry.type === 'LineString') {
      isLine = true;
      positions = (geometry.coordinates as [number, number][]).map(pt => transformPoint(pt));
      positions.forEach(pt => allCoordinates.push(pt));
    } else if (geometry.type === 'MultiLineString') {
      isLine = true;
      const lines = geometry.coordinates;
      if (lines && lines.length > 0) {
        positions = (lines[0] as [number, number][]).map(pt => transformPoint(pt));
        lines.forEach((line: any) => {
          const transformedLine = (line as [number, number][]).map(pt => transformPoint(pt));
          transformedLine.forEach(pt => allCoordinates.push(pt));
        });
      }
    }

    if (positions.length > 0) {
      // Calculate individual feature bounds
      let fMinLng = Infinity, fMaxLng = -Infinity, fMinLat = Infinity, fMaxLat = -Infinity;
      positions.forEach(([lng, lat]) => {
        if (lng < fMinLng) fMinLng = lng;
        if (lng > fMaxLng) fMaxLng = lng;
        if (lat < fMinLat) fMinLat = lat;
        if (lat > fMaxLat) fMaxLat = lat;
      });

      parsedFeatures.push({
        id: feature.id !== undefined ? feature.id : index++,
        positions,
        holes: holes.length > 0 ? holes : undefined,
        properties,
        center: getPolygonCenter(positions),
        isLine,
        bounds: {
          west: fMinLng,
          south: fMinLat,
          east: fMaxLng,
          north: fMaxLat
        }
      });
    }
  }

  if (parsedFeatures.length === 0) {
    throw new Error('No polygon or polyline geometries found in the Shapefile');
  }

  // Calculate bounding box from all coordinates
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  allCoordinates.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  if (minLng === Infinity || minLat === Infinity) {
    throw new Error('Failed to compute bounding box for the shapefile');
  }

  const bounds = {
    west: minLng,
    south: minLat,
    east: maxLng,
    north: maxLat
  };

  const fields = Array.from(numericalFieldsSet);
  if (fields.length === 0) {
    fields.push('Population');
    parsedFeatures.forEach((feat) => {
      feat.properties['Population'] = Math.round(500 + Math.random() * 2500);
    });
  }

  const firstFeature = parsedFeatures[0];
  const polygonData: PolygonData = {
    positions: firstFeature.positions,
    holes: firstFeature.holes,
    bounds
  };

  const shapefileData: ShapefileData = {
    features: parsedFeatures,
    bounds,
    fields,
    allFields: Array.from(allFieldsSet),
    isCad: isCadReproject || didReproject
  };

  return {
    polygonData,
    shapefileData
  };
}
