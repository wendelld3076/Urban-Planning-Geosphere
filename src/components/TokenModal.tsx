import React, { useState } from 'react';
import { Shield, Key, ArrowRight, HelpCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TokenModalProps {
  onTokenSubmit: (token: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenModal({ onTokenSubmit, isOpen, onClose }: TokenModalProps) {
  const [inputToken, setInputToken] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      setError('Token cannot be empty');
      return;
    }
    if (inputToken.trim().length < 20) {
      setError('This token looks too short to be a valid Cesium Ion token.');
      return;
    }
    setError('');
    onTokenSubmit(inputToken.trim());
  };

  const handleUseDemo = () => {
    // Some basic demo mode or fallback
    onTokenSubmit('DEMO_FALLBACK');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div id="token-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          id="token-modal-content"
          className="w-full max-w-lg bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl text-slate-100"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Cesium Ion Access Token</h2>
              <p className="text-xs text-slate-400 mt-0.5">Required for high-resolution 3D buildings, terrain, and imagery.</p>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Token Missing:</span> No token was found in your <code>.env</code> file. Enter one below to initialize high-fidelity 3D assets.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Ion Token
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIs..."
                    value={inputToken}
                    onChange={(e) => {
                      setInputToken(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full px-4 py-3 bg-slate-950/60 border border-white/10 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all pr-10"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center text-slate-500">
                    <Shield className="w-4 h-4" />
                  </div>
                </div>
                {error && <p className="text-xs text-rose-400 mt-2 font-medium">{error}</p>}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  Apply Token <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={handleUseDemo}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 active:bg-slate-900 text-slate-300 font-medium text-sm rounded-xl transition-all cursor-pointer border border-white/5"
                >
                  Use Demo Mode
                </button>
              </div>
            </form>

            {/* Expandable Help */}
            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" /> How do I get an access token?
              </button>

              <AnimatePresence>
                {showHelp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3 text-xs text-slate-400 space-y-2 bg-slate-950/40 p-3 rounded-lg border border-white/10"
                  >
                    <p>
                      1. Go to <a href="https://ion.cesium.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">cesium.com/ion</a> and sign up for a free developer account.
                    </p>
                    <p>
                      2. Go to the <span className="text-slate-200 font-semibold">Access Tokens</span> tab in your Ion dashboard.
                    </p>
                    <p>
                      3. Copy the <span className="text-slate-200 font-semibold">Default Access Token</span> (or create a custom one with read/write access).
                    </p>
                    <p>
                      4. Paste it above, or add it to your project root's <code>.env</code> file as <code>VITE_CESIUM_ION_TOKEN="your_token"</code> for automatic login.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-950/40 border-t border-white/10 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Secure connection &bull; Local session storage only</span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
