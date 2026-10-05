/**
 * Geospatial metadata extractor for 3D models (.glb and .gltf).
 * Scans glTF JSON extras and custom attributes for coordinate metadata (latitude, longitude, elevation).
 */
export async function parseGeospatialMetadata(
  file: File
): Promise<{ latitude?: number; longitude?: number; height?: number } | null> {
  try {
    let jsonText = '';
    if (file.name.toLowerCase().endsWith('.gltf')) {
      jsonText = await file.text();
    } else if (file.name.toLowerCase().endsWith('.glb')) {
      const arrayBuffer = await file.arrayBuffer();
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 20) return null;
      const magic = view.getUint32(0, true);
      if (magic !== 0x46546c67) return null; // "glTF"
      
      const chunkLength = view.getUint32(12, true);
      const chunkType = view.getUint32(16, true);
      if (chunkType !== 0x4E4F534A) return null; // "JSON"
      
      const textDecoder = new TextDecoder('utf-8');
      const jsonBytes = new Uint8Array(arrayBuffer, 20, chunkLength);
      jsonText = textDecoder.decode(jsonBytes);
    } else {
      return null;
    }

    const gltf = JSON.parse(jsonText);
    
    const searchInObject = (obj: any): { latitude?: number; longitude?: number; height?: number } | null => {
      if (!obj || typeof obj !== 'object') return null;
      
      const latKeys = ['latitude', 'lat', 'Latitude', 'LAT'];
      const lngKeys = ['longitude', 'lon', 'lng', 'Longitude', 'LON', 'LNG'];
      const altKeys = ['height', 'altitude', 'alt', 'Height', 'ALT', 'elevation', 'Elevation'];
      
      let lat: number | undefined;
      let lng: number | undefined;
      let alt: number | undefined;
      
      for (const key of Object.keys(obj)) {
        if (latKeys.includes(key) && typeof obj[key] === 'number') {
          lat = obj[key];
        }
        if (lngKeys.includes(key) && typeof obj[key] === 'number') {
          lng = obj[key];
        }
        if (altKeys.includes(key) && typeof obj[key] === 'number') {
          alt = obj[key];
        }
      }
      
      if (lat !== undefined || lng !== undefined || alt !== undefined) {
        return { latitude: lat, longitude: lng, height: alt };
      }
      return null;
    };

    if (gltf.asset?.extras) {
      const res = searchInObject(gltf.asset.extras);
      if (res) return res;
    }
    if (gltf.extras) {
      const res = searchInObject(gltf.extras);
      if (res) return res;
    }
    if (gltf.scenes) {
      for (const scene of gltf.scenes) {
        if (scene.extras) {
          const res = searchInObject(scene.extras);
          if (res) return res;
        }
      }
    }
    if (gltf.nodes) {
      for (const node of gltf.nodes) {
        if (node.extras) {
          const res = searchInObject(node.extras);
          if (res) return res;
        }
      }
    }
  } catch (e) {
    console.warn('Could not extract geospatial metadata from model:', e);
  }
  return null;
}
