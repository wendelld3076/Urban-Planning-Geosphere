import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mouse, 
  Smartphone, 
  Tablet, 
  RotateCw, 
  ZoomIn, 
  Move, 
  Hand, 
  Sparkles, 
  Check, 
  HelpCircle,
  Compass,
  Sliders,
  Maximize2
} from 'lucide-react';

interface NavigationControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NavigationControlsModal: React.FC<NavigationControlsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'mouse' | 'touch' | 'shortcuts'>('mouse');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="nav-controls-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[10000] bg-[#070b14]/90 backdrop-blur-xl flex items-start sm:items-center justify-center p-2.5 sm:p-5 md:p-6 overflow-y-auto font-sans select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Background ambient lighting */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[110px]" />
        </div>

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-3xl max-h-[90vh] sm:max-h-[88vh] md:max-h-none overflow-y-auto bg-[#0b1220]/95 border border-cyan-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_60px_rgba(0,242,254,0.15)] p-4 sm:p-6 text-slate-100 flex flex-col gap-4 sm:gap-5 overflow-x-hidden my-auto custom-scrollbar"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-wide">
                    Navigation & Camera Controls
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                    <Tablet className="w-3 h-3" /> Tablet Friendly
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Interactive guide for Desktop Mouse, Tablet Touch Gestures & 3D Navigation
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Close Instructions"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 border border-white/10 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('mouse')}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'mouse'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Mouse className="w-4 h-4 text-cyan-300" />
              <span className="hidden sm:inline">Desktop Mouse</span>
              <span className="sm:hidden">Mouse</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('touch')}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'touch'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Tablet className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Tablet & Touch Gestures</span>
              <span className="sm:hidden">Tablet / Touch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('shortcuts')}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4 text-indigo-300" />
              <span className="hidden sm:inline">3D Tools & Shortcuts</span>
              <span className="sm:hidden">Shortcuts</span>
            </button>
          </div>

          {/* TAB CONTENT 1: DESKTOP MOUSE INFOGRAPHIC */}
          {activeTab === 'mouse' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Mouse Left Click */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/20 flex gap-3.5 items-start hover:border-cyan-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-cyan-400/40 flex flex-col overflow-hidden p-1 shadow-md">
                    <div className="h-1/2 w-full flex gap-1">
                      <div className="w-1/2 h-full bg-cyan-400 rounded-tl-md animate-pulse shadow-[0_0_10px_#00f2fe]" />
                      <div className="w-1/2 h-full bg-slate-700/60 rounded-tr-md" />
                    </div>
                    <div className="h-1/2 w-full bg-slate-800 rounded-b-md border-t border-slate-700/50 flex items-center justify-center">
                      <Move className="w-3.5 h-3.5 text-cyan-300" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>Left Mouse Button + Drag</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Pan & Rotate Globe View
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Click and hold left button to smoothly translate and orbit the camera around the ground surface target.
                    </p>
                  </div>
                </div>

                {/* Mouse Right Click */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 flex gap-3.5 items-start hover:border-amber-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-amber-400/40 flex flex-col overflow-hidden p-1 shadow-md">
                    <div className="h-1/2 w-full flex gap-1">
                      <div className="w-1/2 h-full bg-slate-700/60 rounded-tl-md" />
                      <div className="w-1/2 h-full bg-amber-400 rounded-tr-md animate-pulse shadow-[0_0_10px_#fbbf24]" />
                    </div>
                    <div className="h-1/2 w-full bg-slate-800 rounded-b-md border-t border-slate-700/50 flex items-center justify-center">
                      <RotateCw className="w-3.5 h-3.5 text-amber-300" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>Right Mouse Button + Drag</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Pitch, Tilt & Rotate Camera
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Drag up/down to tilt horizon angle. Drag left/right to rotate North compass direction around focal target.
                    </p>
                  </div>
                </div>

                {/* Scroll Wheel */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 flex gap-3.5 items-start hover:border-emerald-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-emerald-400/40 flex flex-col overflow-hidden p-1 shadow-md">
                    <div className="h-full w-full bg-slate-800 rounded-md border border-slate-700/50 flex flex-col items-center justify-center gap-1">
                      <div className="w-2.5 h-4 bg-emerald-400 rounded-full animate-bounce shadow-[0_0_8px_#34d399]" />
                      <ZoomIn className="w-3.5 h-3.5 text-emerald-300" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>Scroll Wheel (or Pinch)</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Smooth Zoom In / Zoom Out
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Scroll forward to zoom into building details. Scroll backward to zoom out to regional or satellite view.
                    </p>
                  </div>
                </div>

                {/* Middle Click / Shift + Click */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/20 flex gap-3.5 items-start hover:border-indigo-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-indigo-400/40 flex flex-col overflow-hidden p-1 shadow-md">
                    <div className="h-full w-full bg-slate-800 rounded-md border border-slate-700/50 flex flex-col items-center justify-center gap-1">
                      <Compass className="w-5 h-5 text-indigo-300 animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span>Middle Click or Shift + Drag</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Free Orbit Around Cursor
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Press middle mouse wheel or Shift key while dragging to pivot camera precisely around the exact cursor location.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB CONTENT 2: TABLET & TOUCH GESTURES */}
          {activeTab === 'touch' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Tablet Friendly Highlight Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-slate-900 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Tablet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-300">
                      Fully Optimized for iPad, Android Tablets & Touchscreens
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Supports high-DPI retina touch displays, gesture multi-touch navigation, and touch targets ≥44px.
                    </p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 shrink-0 hidden sm:block">
                  100% Touch Ready
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1-Finger Pan */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 flex gap-3.5 items-start hover:border-emerald-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-emerald-400/40 flex flex-col items-center justify-center p-1 shadow-md">
                    <Hand className="w-6 h-6 text-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-emerald-300 font-mono mt-0.5">1 Finger</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>One-Finger Swipe</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Pan Globe & Map Terrain
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Drag one finger across the screen to glide across 3D terrain, cities, and satellite basemaps smoothly.
                    </p>
                  </div>
                </div>

                {/* 2-Finger Pinch Zoom */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/20 flex gap-3.5 items-start hover:border-cyan-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-cyan-400/40 flex flex-col items-center justify-center p-1 shadow-md">
                    <ZoomIn className="w-6 h-6 text-cyan-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-cyan-300 font-mono mt-0.5">2 Fingers</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>Two-Finger Pinch / Spread</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Pinch to Zoom In / Zoom Out
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Pinch two fingers together to zoom out, or spread two fingers apart to inspect building facades and underground pipes.
                    </p>
                  </div>
                </div>

                {/* 2-Finger Rotate */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 flex gap-3.5 items-start hover:border-amber-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-amber-400/40 flex flex-col items-center justify-center p-1 shadow-md">
                    <RotateCw className="w-6 h-6 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span className="text-[9px] font-bold text-amber-300 font-mono mt-0.5">Twist</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>Two-Finger Rotation</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Rotate Camera Bearing Angle
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Place two fingers on the tablet screen and rotate them like a dial to re-orient North facing compass direction.
                    </p>
                  </div>
                </div>

                {/* 2-Finger Vertical Tilt */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/20 flex gap-3.5 items-start hover:border-indigo-400/40 transition-all">
                  <div className="relative shrink-0 w-12 h-14 bg-slate-800 rounded-xl border border-indigo-400/40 flex flex-col items-center justify-center p-1 shadow-md">
                    <Move className="w-6 h-6 text-indigo-400" />
                    <span className="text-[9px] font-bold text-indigo-300 font-mono mt-0.5">2 Vertical</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span>Two-Finger Vertical Swipe</span>
                    </h3>
                    <p className="text-xs text-slate-200 font-semibold">
                      Pitch & Tilt Perspective Angle
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Swipe two fingers up or down simultaneously to transition from a top-down 2D map to a 3D isometric perspective.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB CONTENT 3: 3D DRAWING & TOOL SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Measuring & Vertex Placement */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                    <span className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30">🎯</span>
                    <span>Placing Vertices (Distance & Area)</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 pl-2 list-disc list-inside font-medium">
                    <li><strong className="text-slate-100">Left Click / Tap:</strong> Drop vertex on ground or building mesh.</li>
                    <li><strong className="text-slate-100">Right Click / Double Tap:</strong> Complete measurement shape & render summary.</li>
                    <li><strong className="text-slate-100">ESC Key:</strong> Cancel current drawing operation.</li>
                  </ul>
                </div>

                {/* Subsurface Excavation */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">⛏️</span>
                    <span>3D Excavation & Shoring</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 pl-2 list-disc list-inside font-medium">
                    <li><strong className="text-slate-100">Draw Boundary:</strong> Click points around target pit.</li>
                    <li><strong className="text-slate-100">Right Click:</strong> Cut 3D excavation cavity into terrain.</li>
                    <li><strong className="text-slate-100">Depth Slider:</strong> Adjust excavation depth (1m - 50m) in sidebar.</li>
                  </ul>
                </div>

                {/* Viewshed & Corridor Analysis */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                    <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30">👁️</span>
                    <span>Viewshed & Sight Corridors</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 pl-2 list-disc list-inside font-medium">
                    <li><strong className="text-slate-100">1st Click:</strong> Place observer viewpoint position.</li>
                    <li><strong className="text-slate-100">2nd Click:</strong> Target direction line for sight cone.</li>
                    <li><strong className="text-slate-100">Green / Red Volumes:</strong> Visually highlights visible vs obstructed line of sight.</li>
                  </ul>
                </div>

                {/* Responsive Touch Toolbar */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                    <span className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">📱</span>
                    <span>Tablet Viewport Toolbar</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 pl-2 list-disc list-inside font-medium">
                    <li><strong className="text-slate-100">Floating Toolbar:</strong> Positioned at bottom center for easy thumb access.</li>
                    <li><strong className="text-slate-100">More Tools (...) Button:</strong> Expands compact tool tray on tablet screens.</li>
                    <li><strong className="text-slate-100">Reset View Button:</strong> Recenters camera and restores North direction.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* Footer Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10 mt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Touch or click anywhere outside to close this guide</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-md shadow-cyan-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              Got It, Close Instructions
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
