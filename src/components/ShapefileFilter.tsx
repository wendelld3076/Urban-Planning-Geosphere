import React, { useMemo } from 'react';
import { Filter, X, Check, Search, Layers, Database } from 'lucide-react';
import { ShapefileFeature } from '../types';
import { extractAttributeFields, extractDistinctAttributeValues } from '../services/ImportParcelService';

export interface ShapefileFilterProps {
  features?: ShapefileFeature[];
  allFields?: string[];
  selectedField: string;
  onSelectField: (field: string) => void;
  selectedTarget: string;
  onSelectTarget: (target: string) => void;
  matchedCount?: number;
  totalCount?: number;
  onClearFilter?: () => void;
  compact?: boolean;
  sidebarTheme?: 'light' | 'dark';
}

export function ShapefileFilter({
  features = [],
  allFields,
  selectedField,
  onSelectField,
  selectedTarget,
  onSelectTarget,
  matchedCount,
  totalCount,
  onClearFilter,
  compact = false,
  sidebarTheme = 'dark'
}: ShapefileFilterProps) {
  const isLight = sidebarTheme === 'light';

  // 1. Compute list of available attribute fields
  const availableFields = useMemo(() => {
    if (allFields && allFields.length > 0) {
      return allFields;
    }
    return extractAttributeFields(features);
  }, [allFields, features]);

  // 2. Compute distinct values for current selectedField
  const distinctValues = useMemo(() => {
    if (!selectedField) return [];
    return extractDistinctAttributeValues(features, selectedField);
  }, [features, selectedField]);

  const total = totalCount !== undefined ? totalCount : features.length;
  const matched = matchedCount !== undefined ? matchedCount : (
    selectedTarget && selectedTarget !== 'ALL' && selectedTarget !== 'Show All'
      ? features.filter(f => {
          if (!f.properties || !selectedField) return false;
          return String(f.properties[selectedField]).trim() === selectedTarget;
        }).length
      : total
  );

  const isFilterActive = Boolean(
    selectedField && selectedTarget && selectedTarget !== 'ALL' && selectedTarget !== 'Show All'
  );

  return (
    <div className={`flex flex-col gap-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Header with Title & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium">
          <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className={isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'}>
            Attribute Filter
          </span>
          {isFilterActive && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
              Active
            </span>
          )}
        </div>

        {isFilterActive && onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer transition-colors border ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Reset attribute filter"
          >
            <X className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {availableFields.length === 0 ? (
        <div className={`p-2.5 rounded-lg border text-center text-xs ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900/60 border-slate-800 text-slate-400'
        }`}>
          No property attributes found in this layer.
        </div>
      ) : (
        <div className="space-y-2">
          {/* 1. Field Selector */}
          <div>
            <label className={`block text-[11px] font-mono uppercase tracking-wider mb-1 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              1. Attribute Field
            </label>
            <div className="relative">
              <select
                id="shapefile-filter-field-select"
                value={selectedField}
                onChange={(e) => {
                  const newField = e.target.value;
                  onSelectField(newField);
                  onSelectTarget('ALL');
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer appearance-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800 hover:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
                    : 'bg-slate-950/80 border-slate-700 text-slate-200 hover:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
                }`}
              >
                <option value="">-- Choose Field (e.g. ZONING, OWNER) --</option>
                {availableFields.map(f => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <Database className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* 2. Target Value Selector */}
          <div>
            <label className={`block text-[11px] font-mono uppercase tracking-wider mb-1 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              2. Distinct Value
            </label>
            <div className="relative">
              <select
                id="shapefile-filter-target-select"
                value={selectedTarget || 'ALL'}
                disabled={!selectedField}
                onChange={(e) => onSelectTarget(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer appearance-none ${
                  !selectedField 
                    ? 'opacity-50 cursor-not-allowed bg-slate-900/40 border-slate-800 text-slate-500' 
                    : isLight
                      ? 'bg-white border-slate-300 text-slate-800 hover:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
                      : 'bg-slate-950/80 border-slate-700 text-slate-200 hover:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
                }`}
              >
                <option value="ALL">Show All ({total} features)</option>
                {distinctValues.map(val => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <Filter className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          {selectedField && (
            <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border text-[11px] ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}>
              <span>Visible parcels:</span>
              <div className="flex items-center gap-1 font-mono font-semibold">
                <span className={isFilterActive ? 'text-sky-400' : 'text-slate-400'}>
                  {matched}
                </span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{total}</span>
                <span className="text-slate-500 text-[10px]">
                  ({total > 0 ? Math.round((matched / total) * 100) : 100}%)
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ShapefileFilter;
