import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sun, Play, Pause, Video, Bookmark, Compass, Crosshair, Locate,
  Sparkles, Sliders, Layers, Eye, Aperture, Minus, Plus, Globe,
  Download, Trash2, Film, X
} from 'lucide-react';
import { PolygonData, LocationPreset } from '../../types';

export const TIMEZONES = [
  { label: 'UTC-12 (Baker Island)', value: 'Etc/GMT+12' },
  { label: 'UTC-11 (Pago Pago)', value: 'Pacific/Pago_Pago' },
  { label: 'UTC-10 (Honolulu)', value: 'Pacific/Honolulu' },
  { label: 'UTC-9 (Anchorage)', value: 'America/Anchorage' },
  { label: 'UTC-8 (Los Angeles, SF)', value: 'America/Los_Angeles' },
  { label: 'UTC-7 (Denver, Phoenix)', value: 'America/Denver' },
  { label: 'UTC-6 (Chicago, Mexico City)', value: 'America/Chicago' },
  { label: 'UTC-5 (New York, Toronto)', value: 'America/New_York' },
  { label: 'UTC-4 (Santiago, Halifax)', value: 'America/Santiago' },
  { label: 'UTC-3 (Sao Paulo, Buenos Aires)', value: 'America/Sao_Paulo' },
  { label: 'UTC-2 (South Georgia)', value: 'Atlantic/South_Georgia' },
  { label: 'UTC-1 (Azores, Cape Verde)', value: 'Atlantic/Azores' },
  { label: 'UTC+0 (London, Dublin, Lisbon)', value: 'Europe/London' },
  { label: 'UTC+1 (Paris, Berlin, Rome)', value: 'Europe/Paris' },
  { label: 'UTC+2 (Cairo, Athens, Jerusalem)', value: 'Europe/Athens' },
  { label: 'UTC+3 (Moscow, Riyadh, Istanbul)', value: 'Europe/Moscow' },
  { label: 'UTC+4 (Dubai, Baku)', value: 'Asia/Dubai' },
  { label: 'UTC+5 (Karachi, Tashkent)', value: 'Asia/Karachi' },
  { label: 'UTC+5:30 (Mumbai, New Delhi)', value: 'Asia/Kolkata' },
  { label: 'UTC+6 (Dhaka, Almaty)', value: 'Asia/Dhaka' },
  { label: 'UTC+7 (Bangkok, Jakarta)', value: 'Asia/Bangkok' },
  { label: 'UTC+8 (Singapore, Beijing, Perth)', value: 'Asia/Singapore' },
  { label: 'UTC+9 (Tokyo, Seoul)', value: 'Asia/Tokyo' },
  { label: 'UTC+9:30 (Adelaide, Darwin)', value: 'Australia/Adelaide' },
  { label: 'UTC+10 (Sydney, Melbourne, Brisbane)', value: 'Australia/Sydney' },
  { label: 'UTC+11 (Solomon Islands)', value: 'Pacific/Guadalcanal' },
  { label: 'UTC+12 (Auckland, Fiji)', value: 'Pacific/Auckland' },
];

export interface SimulationVideo {
  id: string;
  title: string;
  blobUrl: string;
  blob: Blob;
  thumbnailUrl: string;
  date: string;
  startTimeStr: string;
  endTimeStr: string;
  fileSizeStr: string;
  mimeType: string;
}

export interface SimulationPanelProps {
  sidebarTheme?: 'light' | 'dark';
  sunHour: number;
  onSunHourChange: (hour: number) => void;
  sunShadowsEnabled: boolean;
  onSunShadowsEnabledChange: (enabled: boolean) => void;
  shadowDarkness: number;
  onShadowDarknessChange?: (darkness: number) => void;
  softShadows: boolean;
  onSoftShadowsChange?: (soft: boolean) => void;
  shadowBias: number;
  onShadowBiasChange?: (bias: number) => void;
  normalOffsetBias: number;
  onNormalOffsetBiasChange?: (bias: number) => void;
  shadowMaxDistance: number;
  onShadowMaxDistanceChange?: (dist: number) => void;
  shadowMapResolution: number;
  onShadowMapResolutionChange?: (res: number) => void;
  realisticLighting: boolean;
  onRealisticLightingChange?: (enabled: boolean) => void;
  ambientLightingIntensity: number;
  onAmbientLightingIntensityChange?: (intensity: number) => void;
  nightAmbientIntensity: number;
  onNightAmbientIntensityChange?: (intensity: number) => void;
  hdrPipelineEnabled: boolean;
  onHdrPipelineEnabledChange?: (enabled: boolean) => void;
  sunLightAmbientPbr: number;
  onSunLightAmbientPbrChange?: (val: number) => void;
  iblReflectionFactor: number;
  onIblReflectionFactorChange?: (val: number) => void;
  zenithLuminance: number;
  onZenithLuminanceChange?: (val: number) => void;
  ssaoEnabled: boolean;
  onSsaoEnabledChange?: (enabled: boolean) => void;
  ssaoIntensity: number;
  onSsaoIntensityChange?: (val: number) => void;
  eyeAdaptationTonemap: boolean;
  onEyeAdaptationTonemapChange?: (enabled: boolean) => void;
  bloomGlareEnabled?: boolean;
  onBloomGlareEnabledChange?: (enabled: boolean) => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  solarPathEnabled?: boolean;
  onSolarPathEnabledChange?: (enabled: boolean) => void;
  solarPathRadius?: number;
  onSolarPathRadiusChange?: (radius: number) => void;
  activeAnalysisCenter?: { latitude: number; longitude: number; height?: number } | null;
  onActiveAnalysisCenterChange?: (center: { latitude: number; longitude: number; height?: number } | null) => void;
  simulationTimezone?: string;
  onSimulationTimezoneChange?: (tz: string) => void;
  activeTimezoneOffset?: number;
  detectedTimezone?: string;
  polygonData?: PolygonData | null;
  selectedPreset?: LocationPreset | null;
  rtxUltraEnabled?: boolean;
}

export function SimulationPanel({
  sidebarTheme = 'dark',
  sunHour,
  onSunHourChange,
  sunShadowsEnabled,
  onSunShadowsEnabledChange,
  shadowDarkness,
  onShadowDarknessChange,
  softShadows,
  onSoftShadowsChange,
  shadowBias,
  onShadowBiasChange,
  normalOffsetBias,
  onNormalOffsetBiasChange,
  shadowMaxDistance,
  onShadowMaxDistanceChange,
  shadowMapResolution,
  onShadowMapResolutionChange,
  realisticLighting,
  onRealisticLightingChange,
  ambientLightingIntensity,
  onAmbientLightingIntensityChange,
  nightAmbientIntensity,
  onNightAmbientIntensityChange,
  hdrPipelineEnabled,
  onHdrPipelineEnabledChange,
  sunLightAmbientPbr,
  onSunLightAmbientPbrChange,
  iblReflectionFactor,
  onIblReflectionFactorChange,
  zenithLuminance,
  onZenithLuminanceChange,
  ssaoEnabled,
  onSsaoEnabledChange,
  ssaoIntensity,
  onSsaoIntensityChange,
  eyeAdaptationTonemap,
  onEyeAdaptationTonemapChange,
  selectedDate,
  onSelectedDateChange,
  solarPathEnabled = false,
  onSolarPathEnabledChange = () => {},
  solarPathRadius = 1500,
  onSolarPathRadiusChange = () => {},
  activeAnalysisCenter,
  onActiveAnalysisCenterChange,
  simulationTimezone = 'UTC',
  onSimulationTimezoneChange,
  activeTimezoneOffset = 0,
  detectedTimezone,
  polygonData,
  selectedPreset,
  rtxUltraEnabled = false
}: SimulationPanelProps) {
  const [isSunPositionExpanded, setIsSunPositionExpanded] = useState(false);
  const [isShadowSolarAnalysisExpanded, setIsShadowSolarAnalysisExpanded] = useState(false);
  const [isIblPbrExpanded, setIsIblPbrExpanded] = useState(false);
  const [isSimRecordingExpanded, setIsSimRecordingExpanded] = useState(false);

  // Time-lapse animation
  const [isSunAnimating, setIsSunAnimating] = useState(false);
  const sunAnimRef = useRef<number | null>(null);

  // Video recording states
  const [simulationGallery, setSimulationGallery] = useState<SimulationVideo[]>([]);
  const [simBookmarkStart, setSimBookmarkStart] = useState<number>(6.0);
  const [simBookmarkEnd, setSimBookmarkEnd] = useState<number>(18.0);
  const [isSimRecording, setIsSimRecording] = useState<boolean>(false);
  const [simRecordProgress, setSimRecordProgress] = useState<number>(0);
  const [selectedModalVideo, setSelectedModalVideo] = useState<SimulationVideo | null>(null);

  const formatHour = (h: number) => {
    const hr = Math.floor(h);
    const min = Math.floor((h % 1) * 60);
    const period = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 === 0 ? 12 : hr % 12;
    return `${displayHr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${period}`;
  };

  // Sun continuous animation loop
  const sunHourRef = useRef(sunHour);
  useEffect(() => {
    sunHourRef.current = sunHour;
  }, [sunHour]);

  useEffect(() => {
    if (isSunAnimating) {
      const step = () => {
        let next = sunHourRef.current + 0.05;
        if (next >= 24) next = 0;
        sunHourRef.current = next;
        onSunHourChange(next);
        sunAnimRef.current = requestAnimationFrame(step);
      };
      sunAnimRef.current = requestAnimationFrame(step);
    } else {
      if (sunAnimRef.current) {
        cancelAnimationFrame(sunAnimRef.current);
      }
    }
    return () => {
      if (sunAnimRef.current) {
        cancelAnimationFrame(sunAnimRef.current);
      }
    };
  }, [isSunAnimating, onSunHourChange]);

  return (
    <div className="space-y-6">
      {/* SIMULATION SECTION CARD */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-1 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-amber-400 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Simulation
            </h3>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono font-bold border border-amber-500/20">
            Solar & Time-Lapse
          </span>
        </div>

        {/* CATEGORY 1: SUN POSITION & SOLAR TRAJECTORY */}
        <div className="space-y-3">
          <div 
            onClick={() => setIsSunPositionExpanded(!isSunPositionExpanded)}
            className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Sun Position & Solar Trajectory
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {formatHour(sunHour)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSunPositionExpanded(!isSunPositionExpanded);
                }}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                title={isSunPositionExpanded ? "Collapse All" : "Un-collapse All"}
              >
                {isSunPositionExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSunPositionExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 overflow-hidden text-left"
              >
                {/* Date Picker */}
                <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5">
                  <span className="text-xs text-slate-400 font-semibold">Simulation Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setIsSunAnimating(false);
                      onSelectedDateChange(e.target.value);
                    }}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all font-mono cursor-pointer"
                  />
                </div>

                {/* Time Zone Picker */}
                <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Time Zone</span>
                    <span className="text-[10px] text-amber-400/90 font-mono font-medium">
                      UTC{activeTimezoneOffset >= 0 ? `+${activeTimezoneOffset}` : activeTimezoneOffset}
                    </span>
                  </div>
                  <select
                    value={simulationTimezone}
                    onChange={(e) => {
                      setIsSunAnimating(false);
                      onSimulationTimezoneChange?.(e.target.value);
                    }}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-lg py-2 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all cursor-pointer font-sans"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-[#05070a] text-slate-200">
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  {detectedTimezone && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] text-amber-300 font-mono">
                      <Globe className="w-3 h-3 text-amber-400" />
                      <span>{detectedTimezone}</span>
                    </div>
                  )}
                </div>

                {/* Time of Day Slider & Play/Pause */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Time of Day</span>
                    <button
                      type="button"
                      onClick={() => setIsSunAnimating(!isSunAnimating)}
                      className={`p-1 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer border-0 ${
                        isSunAnimating 
                          ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 ring-1 ring-amber-500/30 animate-pulse' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title={isSunAnimating ? "Pause Sun Animation" : "Play Sun Animation (Time-lapse)"}
                    >
                      {isSunAnimating ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {formatHour(sunHour)}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="23.9"
                    step="0.1"
                    value={sunHour}
                    onChange={(e) => {
                      setIsSunAnimating(false);
                      onSunHourChange(parseFloat(e.target.value));
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>12 AM</span>
                    <span>6 AM</span>
                    <span>12 PM</span>
                    <span>6 PM</span>
                    <span>12 AM</span>
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold font-mono block">Time Presets</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'Morning', icon: '🌅', hour: 8.0 },
                      { name: 'Noon', icon: '☀️', hour: 12.0 },
                      { name: 'Afternoon', icon: '🌤️', hour: 16.0 },
                      { name: 'Sunset', icon: '🌇', hour: 19.5 }
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => onSunHourChange(preset.hour)}
                        className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          Math.abs(sunHour - preset.hour) < 0.2
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 24-Hour Solar Path Visualizer */}
                <div className="pt-3 border-t border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-200 font-semibold block">Solar Path Arc</span>
                      <span className="text-[9px] text-slate-500">Render 3D sun trajectory on globe</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSolarPathEnabledChange(!solarPathEnabled)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative ${solarPathEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${solarPathEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {solarPathEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pt-1.5 overflow-hidden"
                    >
                      {/* Arc Radius Slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-medium">Solar Dome Scale</span>
                          <span className="font-mono text-amber-400 font-bold">
                            {solarPathRadius >= 1000 ? `${(solarPathRadius / 1000).toFixed(1)} km` : `${solarPathRadius}m`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="200"
                          max="5000"
                          step="100"
                          value={solarPathRadius}
                          onChange={(e) => onSolarPathRadiusChange(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                          <span>200m</span>
                          <span>1.5km</span>
                          <span>3.0km</span>
                          <span>5.0km</span>
                        </div>
                      </div>

                      {/* Solar Arc Placement & Height Elevation Panel */}
                      <div className="p-2.5 bg-slate-900/90 border border-amber-500/20 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300">
                            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                            <span>Arc Center & Placement</span>
                          </div>
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            3D Gizmo Active
                          </span>
                        </div>

                        {/* Active Center Coordinates */}
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono bg-black/40 p-2 rounded border border-white/5 text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[8px]">LATITUDE</span>
                            <span className="text-amber-300 font-bold">{activeAnalysisCenter?.latitude ? activeAnalysisCenter.latitude.toFixed(5) : 'Auto (Viewport)'}°</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[8px]">LONGITUDE</span>
                            <span className="text-amber-300 font-bold">{activeAnalysisCenter?.longitude ? activeAnalysisCenter.longitude.toFixed(5) : 'Auto (Viewport)'}°</span>
                          </div>
                        </div>

                        {/* Base Elevation (MSL) Slider */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-medium">Base Elevation (MSL)</span>
                            <span className="font-mono text-amber-400 font-bold">
                              {(activeAnalysisCenter?.height ?? 0).toFixed(1)}m MSL
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-100"
                              max="1000"
                              step="1"
                              value={activeAnalysisCenter?.height ?? 0}
                              onChange={(e) => {
                                const newHeight = parseFloat(e.target.value);
                                const currentLat = activeAnalysisCenter?.latitude ?? 37.774929;
                                const currentLng = activeAnalysisCenter?.longitude ?? -122.419416;
                                onActiveAnalysisCenterChange?.({ latitude: currentLat, longitude: currentLng, height: newHeight });
                              }}
                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const currentLat = activeAnalysisCenter?.latitude ?? 37.774929;
                                const currentLng = activeAnalysisCenter?.longitude ?? -122.419416;
                                onActiveAnalysisCenterChange?.({ latitude: currentLat, longitude: currentLng, height: 0 });
                              }}
                              className="text-[9px] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-white/10 font-mono transition-colors shrink-0 cursor-pointer"
                              title="Reset base to Mean Sea Level (0m MSL)"
                            >
                              0m MSL
                            </button>
                          </div>
                        </div>

                        {/* Button to snap/recenter on current viewport center */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onActiveAnalysisCenterChange) {
                              onActiveAnalysisCenterChange(null);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded text-[10px] text-amber-200 font-semibold transition-colors cursor-pointer"
                        >
                          <Locate className="w-3.5 h-3.5 text-amber-400" />
                          <span>Recenter Arc to Viewport Center</span>
                        </button>
                      </div>

                      {/* Solar Analytics / Ephemeris Panel */}
                      <div className="p-3 bg-slate-900/80 border border-white/5 rounded-lg space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                          <Compass className="w-3.5 h-3.5 text-amber-500" />
                          <span>Local Solar Metrics</span>
                        </div>
                        
                        {(() => {
                          let lat = 37.774929;
                          if (polygonData && polygonData.bounds) {
                            lat = (polygonData.bounds.south + polygonData.bounds.north) / 2;
                          } else if (selectedPreset) {
                            lat = selectedPreset.latitude;
                          }
                          
                          // Solar Declination
                          const d = new Date(selectedDate);
                          const start = new Date(d.getFullYear(), 0, 0);
                          const diff = d.getTime() - start.getTime();
                          const oneDay = 1000 * 60 * 60 * 24;
                          const N = Math.floor(diff / oneDay);
                          const declination = 23.45 * Math.sin((360 / 365) * (284 + N) * Math.PI / 180);
                          
                          const latRad = lat * Math.PI / 180;
                          const decRad = declination * Math.PI / 180;
                          
                          const cos_H = -Math.tan(latRad) * Math.tan(decRad);
                          
                          let dayLength = 0;
                          let sunriseHour = 6.0;
                          let sunsetHour = 18.0;
                          
                          if (cos_H >= 1) {
                            dayLength = 0;
                            sunriseHour = 0;
                            sunsetHour = 0;
                          } else if (cos_H <= -1) {
                            dayLength = 24;
                            sunriseHour = 0;
                            sunsetHour = 24;
                          } else {
                            const H = Math.acos(cos_H) * 180 / Math.PI;
                            dayLength = (2 * H) / 15;
                            sunriseHour = 12 - (H / 15);
                            sunsetHour = 12 + (H / 15);
                          }
                          
                          const currentH = (sunHour - 12) * 15;
                          const currentH_rad = currentH * Math.PI / 180;
                          const sin_alt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(currentH_rad);
                          const alt_rad = Math.asin(Math.max(-1, Math.min(1, sin_alt)));
                          const alt_deg = alt_rad * 180 / Math.PI;
                          
                          const cos_az = (Math.sin(decRad) - Math.sin(latRad) * sin_alt) / (Math.cos(latRad) * Math.cos(alt_rad));
                          const sin_az = -Math.sin(currentH_rad) * Math.cos(decRad) / Math.cos(alt_rad);
                          let az_deg = Math.acos(Math.max(-1, Math.min(1, cos_az))) * 180 / Math.PI;
                          if (sin_az < 0) {
                            az_deg = 360 - az_deg;
                          }
                          
                          const formatTime = (h: number) => {
                            if (h === 0) return "N/A";
                            const hr = Math.floor(h);
                            const min = Math.round((h - hr) * 60);
                            const ampm = hr >= 12 ? "PM" : "AM";
                            const displayHr = hr % 12 === 0 ? 12 : hr % 12;
                            return `${displayHr}:${min.toString().padStart(2, '0')} ${ampm}`;
                          };

                          return (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono text-slate-300">
                              <div className="flex justify-between border-b border-white/5 py-0.5">
                                <span className="text-slate-500">Altitude:</span>
                                <span className={`font-semibold ${alt_deg >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                                  {alt_deg.toFixed(1)}°
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 py-0.5">
                                <span className="text-slate-500">Azimuth:</span>
                                <span className="text-slate-200 font-semibold">{az_deg.toFixed(0)}°</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 py-0.5">
                                <span className="text-slate-500">Sunrise:</span>
                                <span className="text-amber-300/90">{formatTime(sunriseHour)}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 py-0.5">
                                <span className="text-slate-500">Sunset:</span>
                                <span className="text-rose-400/90">{formatTime(sunsetHour)}</span>
                              </div>
                              <div className="flex justify-between col-span-2 pt-0.5">
                                <span className="text-slate-500">Day Duration:</span>
                                <span className="text-slate-200 font-semibold">{dayLength.toFixed(1)} hours</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIMULATION RECORDING & GALLERY */}
        <div className="space-y-3">
          <div 
            onClick={() => setIsSimRecordingExpanded(!isSimRecordingExpanded)}
            className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
          >
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Simulation Recording & Gallery
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {simulationGallery.length} {simulationGallery.length === 1 ? 'Video' : 'Videos'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSimRecordingExpanded(!isSimRecordingExpanded);
                }}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                title={isSimRecordingExpanded ? "Collapse All" : "Un-collapse All"}
              >
                {isSimRecordingExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSimRecordingExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 overflow-hidden text-left"
              >
                {/* Start Time & End Time Bookmarks */}
                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-xl space-y-3">
                  <div className="text-[10px] text-slate-300 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-amber-400" /> Time Bookmarks
                    </span>
                    <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {formatHour(simBookmarkStart)} ➔ {formatHour(simBookmarkEnd)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Start Time Bookmark */}
                    <div className="bg-slate-950/80 border border-white/5 p-2 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-amber-300 font-bold uppercase tracking-wider font-mono">Start Time</span>
                        <button
                          type="button"
                          onClick={() => setSimBookmarkStart(sunHour)}
                          className="text-[8px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-pointer font-mono transition-colors"
                          title="Set current time of day as Start Bookmark"
                        >
                          Set Current
                        </button>
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {formatHour(simBookmarkStart)}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="23.9"
                        step="0.1"
                        value={simBookmarkStart}
                        onChange={(e) => setSimBookmarkStart(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* End Time Bookmark */}
                    <div className="bg-slate-950/80 border border-white/5 p-2 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-rose-300 font-bold uppercase tracking-wider font-mono">End Time</span>
                        <button
                          type="button"
                          onClick={() => setSimBookmarkEnd(sunHour)}
                          className="text-[8px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20 cursor-pointer font-mono transition-colors"
                          title="Set current time of day as End Bookmark"
                        >
                          Set Current
                        </button>
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {formatHour(simBookmarkEnd)}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="23.9"
                        step="0.1"
                        value={simBookmarkEnd}
                        onChange={(e) => setSimBookmarkEnd(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>
                  </div>

                  {/* Quick Bookmark Presets */}
                  <div className="flex gap-1 overflow-x-auto pb-0.5 text-[8px] font-mono">
                    {[
                      { label: 'Full Day (06:00 - 18:00)', start: 6.0, end: 18.0 },
                      { label: 'Sunrise (05:00 - 09:00)', start: 5.0, end: 9.0 },
                      { label: 'Golden Hour (16:30 - 19:30)', start: 16.5, end: 19.5 },
                      { label: 'Sunset (18:00 - 21:00)', start: 18.0, end: 21.0 }
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setSimBookmarkStart(p.start);
                          setSimBookmarkEnd(p.end);
                        }}
                        className="px-2 py-1 bg-slate-950/80 hover:bg-slate-800 border border-white/5 rounded text-slate-300 hover:text-amber-300 whitespace-nowrap cursor-pointer transition-colors shrink-0"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Gallery List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-amber-400" /> Recorded Time-Lapse Clips
                    </span>
                    {simulationGallery.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSimulationGallery([])}
                        className="text-[9px] text-rose-400 hover:text-rose-300 transition-colors font-mono cursor-pointer border-0 bg-transparent"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {simulationGallery.length === 0 ? (
                    <div className="p-4 bg-slate-900/40 border border-dashed border-white/10 rounded-xl text-center">
                      <p className="text-[11px] text-slate-500 font-sans">
                        No simulation time-lapses recorded yet.
                      </p>
                      <p className="text-[9px] text-slate-600 font-mono mt-0.5">
                        Bookmark a time window and capture video.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {simulationGallery.map((vid) => (
                        <div
                          key={vid.id}
                          className="bg-slate-900/80 border border-white/5 hover:border-amber-500/30 p-2.5 rounded-xl flex items-center gap-3 transition-all group"
                        >
                          {/* Thumbnail / Play Preview Trigger */}
                          <div
                            onClick={() => setSelectedModalVideo(vid)}
                            className="relative w-16 h-12 bg-black rounded-lg overflow-hidden border border-white/10 cursor-pointer group/thumb shrink-0"
                          >
                            <img
                              src={vid.thumbnailUrl}
                              alt={vid.title}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/10 flex items-center justify-center transition-colors">
                              <div className="p-1 rounded-full bg-amber-500 text-slate-950 shadow-md">
                                <Play className="w-3 h-3 fill-current" />
                              </div>
                            </div>
                          </div>

                          {/* Video Info */}
                          <div className="flex-1 min-w-0 text-left">
                            <h4
                              onClick={() => setSelectedModalVideo(vid)}
                              className="text-xs font-bold text-slate-200 hover:text-amber-300 truncate cursor-pointer"
                              title={vid.title}
                            >
                              {vid.title}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                              {vid.date}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {vid.fileSizeStr}
                              </span>
                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-400">
                                {vid.mimeType.includes('mp4') ? 'MP4' : 'WEBM'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <a
                              href={vid.blobUrl}
                              download={`${vid.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                              title="Download MP4 Video"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setSimulationGallery(prev => prev.filter(item => item.id !== vid.id))}
                              title="Delete Recording"
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CATEGORY 2: SHADOW SETTINGS */}
        <div className="space-y-3">
          <div 
            onClick={() => setIsShadowSolarAnalysisExpanded(!isShadowSolarAnalysisExpanded)}
            className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Shadow Settings
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {sunShadowsEnabled ? 'Shadows ON' : 'OFF'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsShadowSolarAnalysisExpanded(!isShadowSolarAnalysisExpanded);
                }}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                title={isShadowSolarAnalysisExpanded ? "Collapse All" : "Un-collapse All"}
              >
                {isShadowSolarAnalysisExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isShadowSolarAnalysisExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4 overflow-hidden text-left"
              >
                {/* "Enable Shadows" Toggle Switch */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-200 font-semibold block">Enable Shadows</span>
                    <span className="text-[9px] text-slate-500 font-mono">Toggle scene-wide shadow casting</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSunShadowsEnabledChange(!sunShadowsEnabled)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                      sunShadowsEnabled 
                        ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                        : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${sunShadowsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* "Realistic Environment Lighting" Toggle Switch */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-200 font-semibold block">Realistic Environment Lighting</span>
                    <span className="text-[9px] text-slate-500 font-sans">Dark night cycle & dynamic twilight atmospheric shading</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRealisticLightingChange?.(!realisticLighting)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                      realisticLighting 
                        ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                        : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${realisticLighting ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* "Ambient Lighting" Slider */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-200 font-semibold block">Ambient Lighting</span>
                      <span className="text-[9px] text-slate-500 font-sans">Adjust viewport baseline ambient fill brightness</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {ambientLightingIntensity.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.50"
                    step="0.05"
                    value={ambientLightingIntensity}
                    onChange={(e) => onAmbientLightingIntensityChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>0.10 (Dim)</span>
                    <span>0.65 (Default)</span>
                    <span>1.50 (Bright)</span>
                  </div>
                </div>

                {/* "Night Ambient Fill Light" Slider */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-200 font-semibold block">Night Ambient Fill Light</span>
                      <span className="text-[9px] text-slate-500 font-sans">Control baseline visibility during night-time hours</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {nightAmbientIntensity.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={nightAmbientIntensity}
                    onChange={(e) => onNightAmbientIntensityChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>0.00 (Pitch Black)</span>
                    <span>1.00 (Fully Lit)</span>
                  </div>
                </div>

                {/* "Shadow Darkness" Slider (0.1 to 0.9) */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Shadow Darkness</span>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {(shadowDarkness * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={shadowDarkness}
                    onChange={(e) => onShadowDarknessChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>10% (Subtle)</span>
                    <span>50%</span>
                    <span>90% (Intense)</span>
                  </div>
                </div>

                {/* "Shadow Bias" Slider */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Anti-Moiré Depth Bias</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {shadowBias.toFixed(4)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0001"
                    max="0.0150"
                    step="0.0001"
                    value={shadowBias}
                    onChange={(e) => onShadowBiasChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>0.0001 (Sharp/Acne)</span>
                    <span>0.0050 (Standard)</span>
                    <span>0.0150 (High Offset)</span>
                  </div>
                </div>

                {/* "Normal Offset Bias" Slider */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Normal Offset Bias</span>
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {normalOffsetBias.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="2.50"
                    step="0.05"
                    value={normalOffsetBias}
                    onChange={(e) => onNormalOffsetBiasChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>0.00 (No Offset)</span>
                    <span>1.00</span>
                    <span>2.50 (Max Offset)</span>
                  </div>
                </div>

                {/* "Shadow Max Distance" Slider */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 font-semibold">Shadow Max Distance</span>
                      <span className="text-[9px] text-slate-500 font-sans">Lower distance = sharper shadows, no distant moiré</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {shadowMaxDistance.toFixed(0)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="100"
                    value={shadowMaxDistance}
                    onChange={(e) => onShadowMaxDistanceChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>500m (Ultra-Sharp)</span>
                    <span>3000m (Balanced)</span>
                    <span>10000m (Extreme)</span>
                  </div>
                </div>

                {/* "Shadow Map Resolution" Selector */}
                <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Shadow Map Resolution</span>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {shadowMapResolution === 1024 && '1K (1024px)'}
                      {shadowMapResolution === 2048 && '2K (2048px)'}
                      {shadowMapResolution === 4096 && '4K (4096px)'}
                      {shadowMapResolution === 8192 && '8K RTX (8192px)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-xl border border-white/10">
                    {[
                      { label: '1k', value: 1024 },
                      { label: '2k', value: 2048 },
                      { label: '4k', value: 4096 },
                      { label: '8k(RTX)', value: 8192 },
                    ].map((res) => (
                      <button
                        key={res.value}
                        type="button"
                        onClick={() => onShadowMapResolutionChange?.(res.value)}
                        className={`py-1 px-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center ${
                          shadowMapResolution === res.value
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border border-blue-400/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* "Soft Shadows" Toggle Switch */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-200 font-semibold block">Soft Shadows</span>
                    <span className="text-[9px] text-slate-500 font-mono">Enable percentage-closer shadow filtering</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSoftShadowsChange?.(!softShadows)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                      softShadows 
                        ? 'bg-blue-500 shadow-sm shadow-blue-500/20' 
                        : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${softShadows ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* RTX Ultra override status indicator */}
                {rtxUltraEnabled && (
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2 mt-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div className="text-[9px] text-blue-300 font-sans leading-normal">
                      <strong>RTX Ultra Mode is ON.</strong> Sharpness is locked to 4K Ultra HD (4096) & Max Rendering Distance is optimized to 3,000m for premium 1080p captures.
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CATEGORY 3: IBL, PBR & LIGHTING SHADERS */}
        <div className="space-y-3">
          <div 
            onClick={() => setIsIblPbrExpanded(!isIblPbrExpanded)}
            className="flex items-center justify-between pb-1 border-b border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                IBL, PBR & Lighting Shaders
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                HDR {hdrPipelineEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsIblPbrExpanded(!isIblPbrExpanded);
                }}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                title={isIblPbrExpanded ? "Collapse All" : "Un-collapse All"}
              >
                {isIblPbrExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isIblPbrExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-[#070b14]/90 border border-emerald-500/20 p-3.5 rounded-2xl space-y-3 overflow-hidden text-left shadow-2xl"
              >
                {/* Inner Card 1: Image-Based Lighting & HDR */}
                <div className="bg-[#0b1220]/80 border border-emerald-500/15 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <h4 className="text-xs font-bold text-emerald-400 font-sans">
                      Image–Based Lighting & HDR
                    </h4>
                  </div>

                  {/* HDR Pipeline Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Aperture className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-slate-200 font-medium">HDR Pipeline</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onHdrPipelineEnabledChange?.(!hdrPipelineEnabled)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                        hdrPipelineEnabled 
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' 
                          : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${hdrPipelineEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* SunLight Ambient PBR Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-slate-200 font-medium">SunLight Ambient PBR</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSunLightAmbientPbrChange?.(sunLightAmbientPbr > 0 ? 0 : 1)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                        sunLightAmbientPbr > 0
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' 
                          : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${sunLightAmbientPbr > 0 ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* IBL Reflection Factor Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">IBL Reflection Factor</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {iblReflectionFactor.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={iblReflectionFactor}
                      onChange={(e) => onIblReflectionFactorChange?.(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Zenith Luminance Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Zenith Luminance</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {zenithLuminance.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.02"
                      value={zenithLuminance}
                      onChange={(e) => onZenithLuminanceChange?.(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Inner Card 2: Lighting Shaders & Post-Process */}
                <div className="bg-[#0b1220]/80 border border-cyan-500/15 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <h4 className="text-xs font-bold text-cyan-400 font-sans">
                      Lighting Shaders & Post-Process
                    </h4>
                  </div>

                  {/* SSAO Ambient Occlusion Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs text-slate-200 font-medium">SSAO Ambient Occlusion</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSsaoEnabledChange?.(!ssaoEnabled)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                        ssaoEnabled 
                          ? 'bg-cyan-500 shadow-sm shadow-cyan-500/30' 
                          : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${ssaoEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* SSAO Occlusion Intensity Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">SSAO Occlusion Intensity</span>
                      <span className="text-xs font-mono font-bold text-cyan-400">
                        {ssaoIntensity.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="4.0"
                      step="0.1"
                      value={ssaoIntensity}
                      onChange={(e) => onSsaoIntensityChange?.(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Eye Adaptation & Tonemap Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs text-slate-200 font-medium">Eye Adaptation & Tonemap</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEyeAdaptationTonemapChange?.(!eyeAdaptationTonemap)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative cursor-pointer flex items-center ${
                        eyeAdaptationTonemap 
                          ? 'bg-cyan-500 shadow-sm shadow-cyan-500/30' 
                          : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${eyeAdaptationTonemap ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FLOATING SIMULATION GALLERY VIEWER WINDOW */}
      {selectedModalVideo && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedModalVideo(null);
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Film className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>{selectedModalVideo.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-medium border border-amber-500/30">
                      Simulation Playback
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Recorded: {selectedModalVideo.date} • Size: {selectedModalVideo.fileSizeStr}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedModalVideo.blobUrl}
                  download={`${selectedModalVideo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedModalVideo(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Close Floating Player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Container - Centered and constrained */}
            <div className="flex-1 flex items-center justify-center p-4 bg-slate-950/80 min-h-0 relative overflow-hidden">
              <video
                src={selectedModalVideo.blobUrl}
                controls
                autoPlay
                playsInline
                loop
                className="max-w-full max-h-[55vh] w-auto h-auto object-contain rounded-xl shadow-xl border border-white/10"
              />
            </div>

            {/* Bottom Control Bar */}
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 bg-slate-950/60 text-xs text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                  Scale: Fit Floating Window
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {selectedModalVideo.startTimeStr} ➔ {selectedModalVideo.endTimeStr}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <a
                  href={selectedModalVideo.blobUrl}
                  download={`${selectedModalVideo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                  className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save to Disk</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedModalVideo(null)}
                  className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-md text-xs font-semibold transition-all cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
