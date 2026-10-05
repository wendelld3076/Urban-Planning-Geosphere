import * as Cesium from 'cesium';
import { ShapefileFeature, ShapefileData, ParcelStyleConfig } from '../types';

export interface ParcelStyleOptions {
  showFill?: boolean;
  fillColor?: string; // Hex string e.g. '#3B82F6'
  fillOpacity?: number; // 0.0 to 1.0
  showBorder?: boolean;
  showStroke?: boolean;
  borderOpacity?: number; // 0.0 to 1.0
  strokeOpacity?: number; // 0.0 to 1.0
  strokeColor?: string; // Hex string e.g. '#FFFFFF'
  strokeWidth?: number; // 1 to 10 px
  filterField?: string;
  filterValue?: string;

  // 3D Attribute Label Options
  showLabel?: boolean;
  labelField?: string;
  labelFontHeight?: number; // px e.g. 14
  labelFontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  labelFontFamily?: 'sans-serif' | 'monospace' | 'serif' | 'Arial' | 'Roboto' | string;
  labelFontColor?: string; // Hex string
  labelOutlineColor?: string; // Hex string
  labelOutlineWidth?: number;
  labelElevationOffset?: number;
}

export const DEFAULT_PARCEL_STYLE: ParcelStyleConfig = {
  showFill: true,
  fillColor: '#3B82F6',
  fillOpacity: 0.65,
  showBorder: true,
  borderOpacity: 1.0,
  strokeColor: '#FFFFFF',
  strokeWidth: 2.5,
  filterField: '',
  filterValue: 'ALL',

  // 3D Label Defaults
  showLabel: false,
  labelField: '',
  labelFontHeight: 14,
  labelFontStyle: 'bold',
  labelFontFamily: 'sans-serif',
  labelFontColor: '#FFFFFF',
  labelOutlineColor: '#000000',
  labelOutlineWidth: 2.5,
  labelElevationOffset: 5
};

/**
 * Ensures coordinate rings are closed by appending the first coordinate to the end if needed.
 */
export function getClosedRingPositions(positions: [number, number][]): [number, number][] {
  if (!positions || positions.length === 0) return [];
  const closed = [...positions];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closed.push([first[0], first[1]]);
  }
  return closed;
}

/**
 * Extracts all unique attribute field names from a list of ShapefileFeatures.
 * E.g., ['ZONING', 'OWNER', 'LAND_USE', 'PHASE', 'PARCEL_ID', ...]
 */
export function extractAttributeFields(features: ShapefileFeature[]): string[] {
  if (!features || features.length === 0) return [];
  const fieldSet = new Set<string>();
  
  features.forEach(feat => {
    if (feat.properties) {
      Object.keys(feat.properties).forEach(key => {
        const trimmed = key.trim();
        if (trimmed && !trimmed.startsWith('__')) {
          fieldSet.add(trimmed);
        }
      });
    }
  });

  return Array.from(fieldSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Extracts all distinct values for a specific attribute field from ShapefileFeatures.
 * Formats null/undefined safely and returns sorted distinct string values.
 */
export function extractDistinctAttributeValues(features: ShapefileFeature[], field: string): string[] {
  if (!features || !field) return [];
  const valueSet = new Set<string>();

  features.forEach(feat => {
    if (feat.properties && feat.properties[field] !== undefined && feat.properties[field] !== null) {
      const raw = feat.properties[field];
      const str = String(raw).trim();
      if (str !== '') {
        valueSet.add(str);
      }
    }
  });

  return Array.from(valueSet).sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Creates a Cesium Entity featuring the Dual Polygon + Ground Polyline Setup:
 * 1. Polygon geometry for the fill area with `fill: true` and clamped to terrain.
 * 2. Closed `Cesium.PolylineGraphics` along the outer ring boundary with `clampToGround: true`
 *    to support user-defined `width` from 1px to 10px (circumventing WebGL 1px outline restrictions).
 */
export function createDualPolygonEntity(
  viewer: Cesium.Viewer,
  feat: ShapefileFeature,
  options: ParcelStyleOptions = {},
  layerId?: string,
  sunShadowsEnabled = false,
  rtxUltraEnabled = false
): Cesium.Entity {
  const showFill = options.showFill !== false;
  const fillColorHex = options.fillColor || '#3B82F6';
  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.65;
  const showBorder = options.showBorder !== undefined 
    ? options.showBorder 
    : (options.showStroke !== undefined ? options.showStroke : true);
  const borderOpacity = options.borderOpacity !== undefined 
    ? options.borderOpacity 
    : (options.strokeOpacity !== undefined ? options.strokeOpacity : 1.0);
  const strokeColorHex = options.strokeColor || '#FFFFFF';
  const strokeWidth = options.strokeWidth !== undefined ? options.strokeWidth : 2.5;

  let fillCesiumColor = Cesium.Color.fromCssColorString(fillColorHex).withAlpha(fillOpacity);
  let strokeCesiumColor = Cesium.Color.fromCssColorString(strokeColorHex).withAlpha(borderOpacity);

  // 1. Polygon Hierarchy
  const outerPositions = feat.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
  const holesList = feat.holes?.map(h => {
    return new Cesium.PolygonHierarchy(h.positions.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)));
  }) || [];
  const hierarchy = new Cesium.PolygonHierarchy(outerPositions, holesList);

  // 2. Closed Polyline Positions for perimeter outline
  const closedCoords = getClosedRingPositions(feat.positions);
  const polylinePositions = closedCoords.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));

  const entityId = layerId 
    ? `shapefile-feature-${layerId}-${feat.id}` 
    : `shapefile-feature-${feat.id}`;

  const labelAttr = options.labelField || options.filterField;
  let labelText = '';
  if (labelAttr && feat.properties) {
    const rawVal = feat.properties[labelAttr];
    if (rawVal !== undefined && rawVal !== null) labelText = String(rawVal);
  }
  const showLabel = Boolean(options.showLabel && labelText);
  const fontHeight = options.labelFontHeight || 14;
  const fontStyle = options.labelFontStyle || 'bold';
  const fontFamily = options.labelFontFamily || 'sans-serif';
  const fontString = `${fontStyle === 'bold' ? 'bold ' : fontStyle === 'italic' ? 'italic ' : fontStyle === 'bold italic' ? 'bold italic ' : ''}${fontHeight}px ${fontFamily}`;
  let lColor = Cesium.Color.WHITE;
  try { if (options.labelFontColor) lColor = Cesium.Color.fromCssColorString(options.labelFontColor); } catch (_) {}
  let oColor = Cesium.Color.BLACK;
  try { if (options.labelOutlineColor) oColor = Cesium.Color.fromCssColorString(options.labelOutlineColor); } catch (_) {}
  const oWidth = options.labelOutlineWidth !== undefined ? options.labelOutlineWidth : 2.5;
  const elevOffset = options.labelElevationOffset !== undefined ? options.labelElevationOffset : 5;
  const centerPos = feat.center ? Cesium.Cartesian3.fromDegrees(feat.center[0], feat.center[1], elevOffset) : undefined;

  const entity = viewer.entities.add({
    id: entityId,
    position: centerPos,
    polygon: {
      hierarchy: hierarchy,
      material: new Cesium.ColorMaterialProperty(fillCesiumColor),
      fill: showFill,
      classificationType: Cesium.ClassificationType.TERRAIN,
      shadows: (sunShadowsEnabled || rtxUltraEnabled) ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED,
    },
    polyline: {
      positions: polylinePositions,
      width: strokeWidth,
      material: new Cesium.ColorMaterialProperty(strokeCesiumColor),
      clampToGround: true,
      shadows: Cesium.ShadowMode.DISABLED,
      show: Boolean(showBorder && borderOpacity > 0),
    },
    label: showLabel ? {
      text: labelText,
      font: fontString,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      fillColor: lColor,
      outlineColor: oColor,
      outlineWidth: oWidth,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      pixelOffset: new Cesium.Cartesian2(0, -elevOffset * 2),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80000)
    } : undefined,
    properties: new Cesium.PropertyBag(feat.properties)
  });

  return entity;
}

/**
 * Dynamically updates entity visibility based on attribute field and target value:
 * viewer.entities.values.forEach((entity) => {
 *   if (entity.properties && entity.properties.hasProperty(selectedField)) {
 *     const val = entity.properties[selectedField].getValue();
 *     entity.show = (selectedTarget === 'ALL' || val === selectedTarget);
 *   }
 * });
 */
export function applyAttributeFilter(
  viewer: any,
  selectedField: string,
  selectedTarget: string,
  targetLayerId?: string
): { matchedCount: number; totalCount: number } {
  if (!viewer || viewer.isDestroyed?.() || !viewer.entities) {
    return { matchedCount: 0, totalCount: 0 };
  }

  let matchedCount = 0;
  let totalCount = 0;

  const isAll = !selectedField || !selectedTarget || selectedTarget === 'ALL' || selectedTarget === 'Show All';

  const entities = viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const id = String(entity.id || '');

    if (id.startsWith('shapefile-feature-')) {
      if (targetLayerId && id.includes('layer_') && !id.includes(targetLayerId)) {
        continue;
      }

      totalCount++;

      if (isAll) {
        entity.show = true;
        matchedCount++;
      } else if (entity.properties && entity.properties.hasProperty(selectedField)) {
        const rawProp = entity.properties[selectedField];
        const propVal = (rawProp && typeof rawProp.getValue === 'function') 
          ? rawProp.getValue() 
          : (rawProp !== undefined ? rawProp : (entity.properties?.getValue ? entity.properties.getValue(Cesium.JulianDate.now())?.[selectedField] : undefined));
        const valStr = propVal !== undefined && propVal !== null ? String(propVal).trim() : '';
        const isMatch = (selectedTarget === 'ALL' || valStr === selectedTarget);
        entity.show = isMatch;
        if (isMatch) matchedCount++;
      } else {
        // Entity doesn't have the selected property
        entity.show = false;
      }
    }
  }

  viewer.scene?.requestRender?.();
  return { matchedCount, totalCount };
}

/**
 * Dynamically updates the styling of instantiated parcel entities on the viewer.
 * Modifies polygon.fill, polygon.material, polyline.material, and polyline.width in real time.
 */
export function updateParcelStyles(
  viewer: any,
  options: ParcelStyleOptions,
  targetLayerId?: string
): void {
  if (!viewer || viewer.isDestroyed?.() || !viewer.entities) return;

  const fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.65;
  const effectiveShowFill = options.showFill !== false && fillOpacity > 0;
  const fillColorHex = options.fillColor || '#3B82F6';

  const borderOpacity = options.borderOpacity !== undefined 
    ? options.borderOpacity 
    : (options.strokeOpacity !== undefined ? options.strokeOpacity : 1.0);
  const effectiveShowBorder = (options.showBorder !== false && options.showStroke !== false) && borderOpacity > 0;
  const strokeColorHex = options.strokeColor || '#FFFFFF';
  const strokeWidth = options.strokeWidth !== undefined ? options.strokeWidth : 2.5;

  let fillCesiumColor: Cesium.Color;
  let strokeCesiumColor: Cesium.Color;

  try {
    fillCesiumColor = Cesium.Color.fromCssColorString(fillColorHex).withAlpha(fillOpacity);
  } catch (_) {
    fillCesiumColor = Cesium.Color.BLUE.withAlpha(0.65);
  }

  try {
    strokeCesiumColor = Cesium.Color.fromCssColorString(strokeColorHex).withAlpha(borderOpacity);
  } catch (_) {
    strokeCesiumColor = Cesium.Color.WHITE.withAlpha(borderOpacity);
  }

  const entities = viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const id = String(entity.id || '');

    if (id.startsWith('shapefile-feature-')) {
      // If targetLayerId is specified, skip entities belonging to OTHER layers (that contain a different layer_ ID)
      if (targetLayerId && id.includes('layer_') && !id.includes(targetLayerId)) {
        continue;
      }

      // Update Polygon Fill and Material
      if (entity.polygon) {
        entity.polygon.fill = new Cesium.ConstantProperty(effectiveShowFill);
        entity.polygon.material = new Cesium.ColorMaterialProperty(fillCesiumColor);
        if (!effectiveShowFill) {
          entity.polygon.shadows = new Cesium.ConstantProperty(Cesium.ShadowMode.DISABLED);
        }
      }

      // Update Polyline Outline Material and Width
      if (entity.polyline) {
        entity.polyline.show = new Cesium.ConstantProperty(effectiveShowBorder);
        entity.polyline.material = new Cesium.ColorMaterialProperty(strokeCesiumColor);
        entity.polyline.width = new Cesium.ConstantProperty(strokeWidth);
      }

      // Update 3D Attribute Label
      if (options.showLabel !== undefined || options.labelField !== undefined || options.labelFontHeight !== undefined || options.labelFontStyle !== undefined || options.labelFontColor !== undefined || options.labelOutlineColor !== undefined || options.labelElevationOffset !== undefined) {
        if (options.showLabel === false) {
          if (entity.label) {
            entity.label.show = new Cesium.ConstantProperty(false);
          }
        } else if (options.showLabel === true || (entity.label && entity.label.show)) {
          const labelAttr = options.labelField || options.filterField;
          let labelText = '';
          if (labelAttr && entity.properties) {
            if (typeof entity.properties.hasProperty === 'function' && entity.properties.hasProperty(labelAttr)) {
              const raw = entity.properties[labelAttr];
              const val = (raw && typeof raw.getValue === 'function') ? raw.getValue() : raw;
              if (val !== undefined && val !== null) labelText = String(val);
            } else if (entity.properties[labelAttr] !== undefined) {
              const val = entity.properties[labelAttr];
              if (val !== undefined && val !== null) labelText = String(val);
            }
          }

          const fontHeight = options.labelFontHeight || 14;
          const fontStyle = options.labelFontStyle || 'bold';
          const fontFamily = options.labelFontFamily || 'sans-serif';
          const fontString = `${fontStyle === 'bold' ? 'bold ' : fontStyle === 'italic' ? 'italic ' : fontStyle === 'bold italic' ? 'bold italic ' : ''}${fontHeight}px ${fontFamily}`;
          
          let lColor = Cesium.Color.WHITE;
          try {
            if (options.labelFontColor) lColor = Cesium.Color.fromCssColorString(options.labelFontColor);
          } catch (_) {}

          let oColor = Cesium.Color.BLACK;
          try {
            if (options.labelOutlineColor) oColor = Cesium.Color.fromCssColorString(options.labelOutlineColor);
          } catch (_) {}

          const oWidth = options.labelOutlineWidth !== undefined ? options.labelOutlineWidth : 2.5;
          const elevOffset = options.labelElevationOffset !== undefined ? options.labelElevationOffset : 5;

          if (!entity.label) {
            // If entity doesn't have a label yet, initialize it
            if (!entity.position) {
              if (entity.polygon && entity.polygon.hierarchy) {
                const hier = typeof entity.polygon.hierarchy.getValue === 'function'
                  ? entity.polygon.hierarchy.getValue(Cesium.JulianDate.now())
                  : entity.polygon.hierarchy;
                if (hier && hier.positions && hier.positions.length > 0) {
                  let sumX = 0, sumY = 0, sumZ = 0;
                  hier.positions.forEach((p: Cesium.Cartesian3) => {
                    sumX += p.x; sumY += p.y; sumZ += p.z;
                  });
                  const count = hier.positions.length;
                  entity.position = new Cesium.ConstantPositionProperty(
                    new Cesium.Cartesian3(sumX / count, sumY / count, sumZ / count)
                  );
                }
              }
            }

            entity.label = new Cesium.LabelGraphics({
              text: new Cesium.ConstantProperty(labelText),
              font: new Cesium.ConstantProperty(fontString),
              style: new Cesium.ConstantProperty(Cesium.LabelStyle.FILL_AND_OUTLINE),
              fillColor: new Cesium.ConstantProperty(lColor),
              outlineColor: new Cesium.ConstantProperty(oColor),
              outlineWidth: new Cesium.ConstantProperty(oWidth),
              verticalOrigin: new Cesium.ConstantProperty(Cesium.VerticalOrigin.BOTTOM),
              heightReference: new Cesium.ConstantProperty(Cesium.HeightReference.RELATIVE_TO_GROUND),
              pixelOffset: new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -elevOffset * 2)),
              show: new Cesium.ConstantProperty(Boolean(labelText && options.showLabel)),
              disableDepthTestDistance: new Cesium.ConstantProperty(Number.POSITIVE_INFINITY),
              distanceDisplayCondition: new Cesium.ConstantProperty(new Cesium.DistanceDisplayCondition(0, 80000))
            });
          } else {
            const isLabelVisible = options.showLabel !== undefined ? Boolean(options.showLabel) : true;
            entity.label.show = new Cesium.ConstantProperty(Boolean(labelText && isLabelVisible));
            if (labelText) {
              entity.label.text = new Cesium.ConstantProperty(labelText);
            }
            entity.label.font = new Cesium.ConstantProperty(fontString);
            entity.label.fillColor = new Cesium.ConstantProperty(lColor);
            entity.label.outlineColor = new Cesium.ConstantProperty(oColor);
            entity.label.outlineWidth = new Cesium.ConstantProperty(oWidth);
            entity.label.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -elevOffset * 2));
          }
        }
      }
    }
  }

  viewer.scene?.requestRender?.();
}
