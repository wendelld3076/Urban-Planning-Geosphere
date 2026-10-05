import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Layers, 
  Sun, 
  Video, 
  BarChart3, 
  X, 
  Sparkles, 
  Mail, 
  Check, 
  ArrowRight,
  Compass,
  Cpu,
  Layers3,
  Rocket,
  Tablet,
  Mouse,
  HelpCircle
} from 'lucide-react';
import { NavigationControlsModal } from './NavigationControlsModal';

interface GeosphereIntroOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNavInstructions?: () => void;
}

export const GeosphereIntroOverlay: React.FC<GeosphereIntroOverlayProps> = ({
  isOpen,
  onClose,
  onOpenNavInstructions,
}) => {
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [isNavModalOpen, setIsNavModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPhase(1);
      return;
    }

    // Phase 1 (0s - 1.2s): Radar / Wireframe scanning graphic
    // Phase 2 (1.2s - 2.0s): Smooth transition into full card view
    const timer = setTimeout(() => {
      setPhase(2);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleLaunch = () => {
    if (doNotShowAgain) {
      localStorage.setItem('geosphere_hide_intro', 'true');
    }
    onClose();
  };

  const handleClose = () => {
    if (doNotShowAgain) {
      localStorage.setItem('geosphere_hide_intro', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="geosphere-intro-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[9999] bg-[#0a0f1e]/95 backdrop-blur-2xl flex items-start sm:items-center justify-center p-3 sm:p-5 md:p-8 overflow-y-auto select-none font-sans"
      >
        {/* Background Ambient Glows & Grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[550px] md:w-[600px] h-[350px] sm:h-[550px] md:h-[600px] bg-cyan-500/10 rounded-full blur-[90px] sm:blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/3 w-[300px] sm:w-[450px] md:w-[500px] h-[300px] sm:h-[450px] md:h-[500px] bg-blue-600/10 rounded-full blur-[80px] sm:blur-[100px]" />
          <div className="absolute top-1/3 right-1/4 w-[250px] sm:w-[350px] md:w-[400px] h-[250px] sm:h-[350px] md:h-[400px] bg-amber-500/10 rounded-full blur-[70px] sm:blur-[90px]" />
          
          {/* Subtle Cyber Grid Lines */}
          <div 
            className="absolute inset-0 opacity-[0.03]" 
            style={{ 
              backgroundImage: `linear-gradient(#00f2fe 1px, transparent 1px), linear-gradient(90deg, #00f2fe 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }} 
          />
        </div>

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={handleClose}
          className="fixed top-3 right-3 sm:top-5 sm:right-5 md:top-7 md:right-7 p-2 sm:p-2.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-slate-400 hover:text-white hover:bg-slate-800/90 hover:border-cyan-400/50 transition-all cursor-pointer z-50 group shadow-lg"
          title="Close Welcome Overlay"
          aria-label="Close"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-90" />
        </button>

        {/* Main Modal Container */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl max-h-[90vh] sm:max-h-[88vh] md:max-h-none overflow-y-auto bg-[#0c1322]/95 border border-cyan-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_80px_rgba(0,242,254,0.12)] p-4 sm:p-6 md:p-8 my-auto text-slate-100 flex flex-col items-center gap-4 sm:gap-6 overflow-x-hidden custom-scrollbar"
        >
          {/* Top Decorative Border Highlight */}
          <div className="absolute top-0 left-8 right-8 sm:left-12 sm:right-12 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

          {/* Phase 1 & 2 Animated 3D Wireframe / Radar Globe Graphic */}
          <motion.div
            layout
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="relative flex flex-col items-center justify-center pt-1"
          >
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 flex items-center justify-center">
              {/* Outer Pulsing Rings */}
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full border border-cyan-500/30 bg-cyan-500/5"
              />
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.4, 0.15] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -inset-2.5 sm:-inset-3 rounded-full border border-amber-400/20"
              />

              {/* Rotating Radar Scanner Beam */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
              >
                <div className="w-1/2 h-1/2 bg-gradient-to-br from-cyan-400/40 via-cyan-400/10 to-transparent origin-bottom-right" />
              </motion.div>

              {/* Central Glowing Globe Icon & Latitude/Longitude Rings */}
              <div className="relative z-10 w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-slate-900/90 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_25px_rgba(0,242,254,0.3)]">
                <Globe className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 text-cyan-400 animate-pulse" />
                
                {/* Floating Cyan & Gold Particle Nodes */}
                <motion.div
                  animate={{ y: [-3, 3, -3], x: [-2, 2, -2] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-1.5 right-2 sm:top-2 sm:right-3 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#00f2fe]"
                />
                <motion.div
                  animate={{ y: [3, -3, 3], x: [2, -2, 2] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]"
                />
                <motion.div
                  animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                  className="absolute top-3 left-1.5 sm:top-4 sm:left-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                />
              </div>
            </div>
          </motion.div>

          {/* Main Content (Fades in / expands gracefully during Phase 2) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 15 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full flex flex-col items-center text-center gap-3.5 sm:gap-5"
          >
            {/* Header Tag */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                <span>Next-Gen Geospatial Platform</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] sm:text-xs font-bold tracking-wide shadow-md shadow-emerald-500/10">
                <Tablet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                <span>Tablet & Mobile Friendly</span>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h1 className="flex flex-col items-center justify-center gap-0.5 tracking-tight drop-shadow-[0_2px_15px_rgba(0,242,254,0.3)]">
                <span className="font-urban-script text-xl sm:text-2xl md:text-3xl text-cyan-300 font-semibold tracking-wide -mb-1">
                  Urban Planning
                </span>
                <span className="text-2xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
                  Geosphere
                </span>
              </h1>
              <p className="text-xs sm:text-base md:text-lg font-medium text-cyan-100/90 tracking-wide">
                3D Urban Planning & Geospatial Workspace
              </p>
            </div>

            {/* Overview Description */}
            <p className="text-[11px] sm:text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed text-center font-normal px-1 sm:px-2">
              Welcome to <span className="text-cyan-300 font-semibold">Urban Planning Geosphere</span> — an advanced 3D geospatial application designed for urban planning and environmental simulation.
              Seamlessly stream 3D Tiles, I3S layers, Shapefiles, and CAD models on a photorealistic 3D globe.
              <span className="text-emerald-300 font-semibold"> Fully optimized for tablet touchscreens, iPads, mobile devices, and desktop workstations.</span>
            </p>

            {/* Feature Grid (4 Core Cards) - Grid cols 1 on mobile/tablets, 2 on md+ */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 mt-1 sm:mt-2 text-left">
              {/* Card 1 */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/70 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-300 flex items-start gap-2.5 sm:gap-3.5 group hover:bg-slate-900/90">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Layers3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
                    <span>📦 3D Data Integration</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 leading-snug">
                    Import and stream 3D Tiles, Cesium Ion assets, I3S datasets, DXF files, and GIS Shapefiles.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/70 border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300 flex items-start gap-2.5 sm:gap-3.5 group hover:bg-slate-900/90">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
                    <span>☀️ Environmental Simulation</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 leading-snug">
                    Real-time solar positioning, dynamic shadow casting, IBL/PBR lighting, and time-lapse recordings.
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/70 border border-indigo-500/20 hover:border-indigo-400/40 transition-all duration-300 flex items-start gap-2.5 sm:gap-3.5 group hover:bg-slate-900/90">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
                    <span>🎬 Cinematic Camera Control</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 leading-snug">
                    Save custom views, define smooth flythrough trajectories, and export video sequences.
                  </p>
                </div>
              </div>

              {/* Card 4 */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/70 border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 flex items-start gap-2.5 sm:gap-3.5 group hover:bg-slate-900/90">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Tablet className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5 truncate">
                    <span>📱 Tablet & Touch Responsive</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 leading-snug">
                    Touch-optimized drawers, 1-finger pan, 2-finger pinch zoom, multi-touch gestures, & site analytics.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Controls & Preference Checkbox */}
            <div className="w-full flex flex-col items-center gap-3 mt-1 sm:mt-2">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full max-w-md sm:max-w-xl">
                <button
                  type="button"
                  onClick={handleLaunch}
                  className="w-full sm:w-auto flex-1 group relative inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-[0_0_30px_rgba(0,242,254,0.3)] hover:shadow-[0_0_40px_rgba(0,242,254,0.5)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] min-h-[44px]"
                >
                  <span>Launch Workspace</span>
                  <Rocket className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenNavInstructions) {
                      onOpenNavInstructions();
                    } else {
                      setIsNavModalOpen(true);
                    }
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white font-semibold text-xs transition-all cursor-pointer hover:bg-cyan-950/40 shadow-lg min-h-[44px]"
                >
                  <Mouse className="w-4 h-4 text-cyan-400" />
                  <span>Mouse & Touch Controls</span>
                </button>
              </div>

              <label className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors select-none pt-1">
                <input
                  type="checkbox"
                  checked={doNotShowAgain}
                  onChange={(e) => setDoNotShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                />
                <span>Do not show again on this device</span>
              </label>
            </div>

            {/* Developer Contact Footer Notice */}
            <div className="w-full pt-3 sm:pt-4 mt-1 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-400 font-mono text-center">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>For comments and suggestions, please email the developer:</span>
              </div>
              <a
                href="mailto:Wendell.Dimaculangan@dmt.gov.ae"
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 transition-colors hover:scale-[1.02]"
              >
                Wendell.Dimaculangan@dmt.gov.ae
              </a>
            </div>
          </motion.div>
        </motion.div>

        {/* Mouse & Touch Navigation Controls Infographic Modal */}
        <NavigationControlsModal
          isOpen={isNavModalOpen}
          onClose={() => setIsNavModalOpen(false)}
        />
      </motion.div>
    </AnimatePresence>
  );
};
