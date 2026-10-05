import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft, RefreshCw, KeyRound, ServerOff, Copy, Check, Terminal, Shield, Home, LayoutTemplate, Monitor } from 'lucide-react';
import { motion } from 'motion/react';

interface Error401PageProps {
  onReturn?: () => void;
  onRetry?: () => void;
  theme?: 'dark' | 'light';
  defaultViewMode?: 'classic' | 'modern';
}

export function Error401Page({ onReturn, onRetry, theme = 'dark', defaultViewMode = 'classic' }: Error401PageProps) {
  const [viewMode, setViewMode] = useState<'classic' | 'modern'>(defaultViewMode);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const errorTitle = "Server Error";
  const errorMessageLine1 = "401 - Unauthorized: Access is denied due to invalid credentials.";
  const errorMessageLine2 = "You do not have permission to view this directory or page using the credentials that you supplied.";

  const handleCopyDetails = () => {
    const errorText = `${errorTitle}\n\n${errorMessageLine1}\n${errorMessageLine2}`;
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetryClick = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      if (onRetry) onRetry();
    }, 600);
  };

  const isLight = theme === 'light';

  // --- 1. CLASSIC IIS SERVER ERROR VIEW (Pixel-perfect matching IIS screenshot) ---
  if (viewMode === 'classic') {
    return (
      <div id="error-401-classic-container" className="fixed inset-0 z-[1000] flex flex-col bg-[#EEEEEE] text-[#000000] font-sans antialiased overflow-y-auto select-text">
        {/* Dark Gray Banner Header */}
        <div className="w-full bg-[#515357] text-white px-8 py-3 sm:py-4 shadow-md flex items-center justify-between border-b border-[#3A3B3E]">
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight font-sans text-white">
            Server Error
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('modern')}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#3a3c40] hover:bg-[#2c2d30] text-xs font-sans text-slate-200 hover:text-white rounded border border-white/20 transition-colors cursor-pointer"
              title="Switch to Modern Application Theme"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-cyan-400" />
              <span>Modern Theme</span>
            </button>

            {onReturn && (
              <button
                onClick={onReturn}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-xs font-sans text-white rounded transition-colors cursor-pointer"
                title="Return to GeoSphere"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Body Content Box */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 flex-1">
          {/* Classic IIS White Box Container */}
          <div className="bg-white border border-[#B5B5B5] shadow-sm p-6 sm:p-8 mb-6 rounded-none">
            {/* Red Bold Error Heading */}
            <h2 className="text-red-700 font-bold text-lg sm:text-xl font-sans tracking-tight mb-2 leading-snug">
              401 - Unauthorized: Access is denied due to invalid credentials.
            </h2>

            {/* Black Bold Subheading */}
            <p className="text-black font-bold text-sm sm:text-base font-sans leading-normal">
              You do not have permission to view this directory or page using the credentials that you supplied.
            </p>
          </div>

          {/* Action Toolbar & Diagnostic Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 border-t border-[#CCCCCC] pt-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 border border-slate-300">
                HTTP / IIS 401 RESPONSE
              </span>
              <button
                onClick={handleCopyDetails}
                className="flex items-center gap-1 text-blue-700 hover:underline font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Error Message' : 'Copy Message'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRetryClick}
                disabled={isRetrying}
                className="px-3 py-1.5 bg-[#005A9C] hover:bg-[#004070] text-white font-medium text-xs rounded-none transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Authenticating...' : 'Re-authenticate Credentials'}</span>
              </button>

              {onReturn && (
                <button
                  onClick={onReturn}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium text-xs border border-slate-400 rounded-none transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full bg-[#E5E5E5] border-t border-[#D0D0D0] px-8 py-2 text-[11px] text-slate-500 font-sans flex items-center justify-between">
          <span>GeoSphere Urban Planning &bull; Server IIS / Gateway Response</span>
          <span>HTTP 401 Unauthorized</span>
        </div>
      </div>
    );
  }

  // --- 2. MODERN GEOSPHERE APP THEME VIEW ---
  return (
    <div
      id="error-401-page-container"
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto select-none transition-colors duration-300 ${
        isLight
          ? 'bg-slate-100 text-slate-900'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Background Decorative Grid & Neon Radial Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute inset-0 opacity-[0.03] ${
            isLight ? 'bg-[radial-gradient(#0f172a_1px,transparent_1px)]' : 'bg-[radial-gradient(#e2e8f0_1px,transparent_1px)]'
          } [background-size:24px_24px]`}
        />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[150px] pointer-events-none" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-2xl transition-all duration-300 ${
          isLight
            ? 'bg-white/95 border-slate-200 shadow-slate-300/50'
            : 'bg-slate-900/90 border-white/10 shadow-black/80'
        }`}
      >
        {/* Top Metallic Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

        {/* Card Header */}
        <div className={`p-6 sm:p-8 border-b transition-colors ${
          isLight ? 'border-slate-200 bg-slate-50/60' : 'border-white/5 bg-slate-950/40'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/10 shrink-0">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white text-[9px] font-bold">
                  !
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-[11px] font-bold tracking-wider uppercase">
                    HTTP 401 &bull; UNAUTHORIZED
                  </span>
                </div>
                <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  {errorTitle}
                </h1>
              </div>
            </div>

            <button
              onClick={() => setViewMode('classic')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-mono transition-all cursor-pointer"
              title="Switch to IIS Classic Server Error Theme"
            >
              <Monitor className="w-3.5 h-3.5 text-amber-400" />
              <span>Classic IIS Theme</span>
            </button>
          </div>
        </div>

        {/* Main Error Details Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Formatted Error Banner */}
          <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
            isLight
              ? 'bg-rose-50/80 border-rose-200/80 text-rose-950'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
          }`}>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="font-mono text-sm sm:text-base font-semibold tracking-tight leading-snug">
                  {errorMessageLine1}
                </p>
              </div>
              <p className={`text-xs sm:text-sm font-sans leading-relaxed pl-8 ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                {errorMessageLine2}
              </p>
            </div>
          </div>

          {/* Diagnostic Console Box */}
          <div className={`rounded-2xl border overflow-hidden ${
            isLight ? 'bg-slate-900 text-slate-200 border-slate-800' : 'bg-slate-950 border-white/10'
          }`}>
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>DIAGNOSTIC LOG</span>
              </div>
              <button
                onClick={handleCopyDetails}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy error details"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 font-mono text-[11px] sm:text-xs space-y-1.5 text-slate-300 overflow-x-auto scrollbar-thin">
              <div className="flex gap-2">
                <span className="text-rose-400 font-bold">[ERROR]</span>
                <span className="text-slate-400">STATUS:</span>
                <span className="text-amber-400">401 Unauthorized</span>
              </div>
              <div className="flex gap-2">
                <span className="text-rose-400 font-bold">[ERROR]</span>
                <span className="text-slate-400">REASON:</span>
                <span className="text-slate-300">Invalid or Expired Security Token</span>
              </div>
              <div className="flex gap-2">
                <span className="text-rose-400 font-bold">[ERROR]</span>
                <span className="text-slate-400">SCOPE:</span>
                <span className="text-cyan-400">/UrbanPlanningGeosphere/</span>
              </div>
            </div>
          </div>

          {/* Guidelines / Helper Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-white/5'
            }`}>
              <KeyRound className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h4 className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  Check Credentials
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Ensure your account session has active permissions and a valid access token.
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-white/5'
            }`}>
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  Contact Support
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Contact system administrator if you believe your user account should have access.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className={`p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
          isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/10 bg-slate-950/60'
        }`}>
          {onReturn ? (
            <button
              onClick={onReturn}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Reload Page</span>
            </button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRetryClick}
              disabled={isRetrying}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 active:from-rose-700 active:to-rose-600 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Authenticating...' : 'Retry Credentials'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Error401Page;

