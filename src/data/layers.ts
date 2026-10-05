import { MapLayer } from '../types';

export const DEFAULT_LAYERS: MapLayer[] = [
  {
    id: 'osm-buildings',
    name: '3D OSM Buildings',
    description: 'Global 3D buildings from OpenStreetMap, styled by height and type.',
    enabled: true,
    type: 'tileset',
    assetId: 96188 // Cesium Ion OSM Buildings asset ID
  },
  {
    id: 'google-3d-tiles',
    name: 'Google Photorealistic 3D Tiles',
    description: 'Highly detailed 3D photorealistic mesh of cityscapes, mountains, and landmarks globally.',
    enabled: false,
    type: 'tileset'
  },
  {
    id: 'historical-sites',
    name: 'Global Landmarks Marker',
    description: 'Dynamic GeoJSON layer highlighting iconic historical points on the globe.',
    enabled: false,
    type: 'geojson'
  },
  {
    id: 'flight-paths',
    name: 'Sample Flight Paths',
    description: 'A 3D curved polyline network representing global flight paths between hubs.',
    enabled: false,
    type: 'geojson'
  }
];
