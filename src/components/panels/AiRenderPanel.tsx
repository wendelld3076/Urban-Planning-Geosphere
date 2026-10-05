import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Key, Eye, EyeOff, Camera, Upload, Trash2,
  AlertCircle, RefreshCw, Image, Maximize2, X, ExternalLink
} from 'lucide-react';
import { getApiUrl } from '../../utils/api';

export interface AiRenderPanelProps {
  sidebarTheme?: 'light' | 'dark';
  aiScreenshotDataUrl?: string | null;
  onTriggerAiScreenshot?: () => void;
  onClearAiScreenshot?: () => void;
  showSafeFrame?: boolean;
  onShowSafeFrameChange?: (show: boolean) => void;
}

export function AiRenderPanel({
  sidebarTheme = 'dark',
  aiScreenshotDataUrl = null,
  onTriggerAiScreenshot,
  onClearAiScreenshot,
  showSafeFrame = false,
  onShowSafeFrameChange,
}: AiRenderPanelProps) {
  // AiStudio / Custom API Key state
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('nano_banana_api_key') || '';
  });
  const [tempApiKey, setTempApiKey] = useState<string>(() => {
    return localStorage.getItem('nano_banana_api_key') || '';
  });
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);

  // Reference images & rendering options
  const [uploadedImageRefDataUrl, setUploadedImageRefDataUrl] = useState<string | null>(null);
  const [uploadedImageRefName, setUploadedImageRefName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [aiModel, setAiModel] = useState<string>('nano banana pro');
  const [imgPrompt, setImgPrompt] = useState<string>(
    'create photo real twilight render of this image'
  );
  const [imgResolution, setImgResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [isImgGenerating, setIsImgGenerating] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgGatewayLog, setImgGatewayLog] = useState<string | null>(null);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [generatedImgDesc, setGeneratedImgDesc] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);

  const fetchCredits = async () => {
    try {
      const res = await fetch(getApiUrl('/api/user/credits'));
      if (res.ok) {
        const data = await res.json();
        setUserCredits(data.credits);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const handleGenerateRendering = async () => {
    const cost = imgResolution === '1K' ? 1 : imgResolution === '2K' ? 2 : 4;
    const hasCustomKey = customApiKey && customApiKey.trim() !== '';

    if (!hasCustomKey && userCredits !== null && userCredits < cost) {
      setIsCreditModalOpen(true);
      return;
    }

    setIsImgGenerating(true);
    setImgError(null);
    setImgGatewayLog(null);

    const activeImageRef = aiScreenshotDataUrl || uploadedImageRefDataUrl || '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (hasCustomKey) {
        headers['X-User-Custom-AI-Key'] = customApiKey;
      }

      let targetWidth = 1920;
      let targetHeight = 1080;
      if (imgResolution === '2K') {
        targetWidth = 2560;
        targetHeight = 1440;
      } else if (imgResolution === '4K') {
        targetWidth = 3840;
        targetHeight = 2160;
      }

      let targetModelID = 'gemini-3.1-flash-image';
      if (aiModel === 'nano banana pro') {
        targetModelID = 'gemini-3.1-pro-image-preview';
      } else if (aiModel === 'nano banana lite') {
        targetModelID = 'gemini-3.1-flash-lite';
      } else if (aiModel === 'nano banana 2') {
        targetModelID = 'gemini-3.1-flash-image';
      }

      const apiUrl = getApiUrl('/api/render/img2img');
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: imgPrompt,
          resolution: imgResolution,
          imageRef: activeImageRef,
          model: targetModelID,
          aspect_ratio: '16:9',
          output_width: targetWidth,
          output_height: targetHeight,
        }),
      });

      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        setImgError(errorData.error || 'Credit threshold reached.');
        setIsCreditModalOpen(true);
        setIsImgGenerating(false);
        fetchCredits();
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      }

      if (res.ok && data && data.success) {
        const finalUrl = data.imageUrl;
        const finalDesc = data.description;
        const finalLog = data.gatewayLog;

        setGeneratedImgUrl(finalUrl);
        setGeneratedImgDesc(finalDesc);
        if (data.creditsRemaining !== undefined) {
          setUserCredits(data.creditsRemaining);
        }
        setImgGatewayLog(finalLog);
        setImgError(null);
      } else {
        const errMsg =
          data?.error || 'API Gateway image rendering failed. Please check your Gemini API key.';
        console.warn('API Gateway returned error:', errMsg);
        setImgError(errMsg);
      }
    } catch (e: any) {
      console.warn('Network exception during image generation:', e);
      setImgError(e?.message || 'Network exception during image-to-image render.');
    } finally {
      setIsImgGenerating(false);
    }
  };

  const handleOpenPresentation = () => {
    if (!generatedImgUrl) return;

    try {
      const presentationWindow = window.open('', '_blank');
      if (
        !presentationWindow ||
        presentationWindow.closed ||
        typeof presentationWindow.closed === 'undefined'
      ) {
        throw new Error('Popup blocked');
      }

      const finalImageURL = generatedImgUrl;
      const selectedResolution = imgResolution;
      const originalImageURL = aiScreenshotDataUrl || uploadedImageRefDataUrl || '';

      // Escape prompt for safe inclusion in inner JS and HTML attributes
      const activePrompt = imgPrompt;
      const activePromptEscaped = activePrompt
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');
      const escapedPromptForTitle = activePrompt.replace(/"/g, '&quot;');
      const activeModel = aiModel;

      presentationWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Architectural Render - Comparison Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #030406;
      --panel-color: rgba(11, 13, 18, 0.75);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --accent-color: #f59e0b; /* Amber */
      --accent-green: #10b981; /* Emerald */
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body { 
      background-color: var(--bg-color); 
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
      display: flex; 
      flex-direction: column;
      width: 100vw;
      height: 100vh; 
      overflow: hidden; 
      position: relative;
    }

    /* Header Styling */
    header {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      background-color: var(--panel-color);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .header-title-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background-color: var(--accent-green);
      border-radius: 50%;
      box-shadow: 0 0 12px var(--accent-green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .header-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-primary);
      text-transform: uppercase;
    }

    .header-subtitle {
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-secondary);
      background: rgba(255,255,255,0.04);
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .button-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      border: 1px solid transparent;
    }

    .btn-secondary {
      background-color: rgba(255, 255, 255, 0.06);
      color: var(--text-primary);
      border-color: var(--border-color);
    }

    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-primary {
      background: linear-gradient(135deg, #d97706, #f59e0b);
      color: #000;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.2);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #b45309, #d97706);
      transform: translateY(-1px);
    }

    /* Main Area Styling */
    main {
      position: absolute;
      inset: 0;
      padding: 0;
      margin: 0;
      background: #000;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10;
    }

    /* Compare Slider Container - FULL SCREEN */
    .slider-container {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #000;
    }

    .slider-container img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover; /* default */
      pointer-events: none;
      transition: object-fit 0.2s ease;
    }

    /* Contain image styling when toggled */
    body.img-fit-contain .slider-container img,
    body.img-fit-contain .single-image-wrapper img {
      object-fit: contain;
    }

    .before-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
      transition: clip-path 0.05s linear;
      z-index: 2;
    }

    /* Slider Line and Handle */
    .slider-handle {
      position: absolute;
      top: 0;
      left: 50%;
      height: 100%;
      width: 2px;
      background-color: #fff;
      pointer-events: none;
      z-index: 12;
      transform: translateX(-50%);
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
      transition: left 0.05s linear;
    }

    .slider-handle-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 48px;
      height: 48px;
      background-color: #111318;
      color: #fff;
      border: 2px solid #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.7);
      font-size: 14px;
      transition: background-color 0.2s, transform 0.2s;
    }

    .slider-container:hover .slider-handle-button {
      background-color: #1f222e;
      transform: translate(-50%, -50%) scale(1.08);
    }

    /* Range Input overlay */
    .slider-range {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: col-resize;
      z-index: 20;
      margin: 0;
      -webkit-appearance: none;
      appearance: none;
    }

    /* Overlaid Text Badges */
    .image-label {
      position: absolute;
      bottom: 100px; /* shift up to clear the footer */
      padding: 8px 16px;
      background-color: rgba(15, 17, 23, 0.75);
      border: 1px solid var(--border-color);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 8px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      z-index: 5;
      pointer-events: none;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }

    .label-before {
      left: 20px;
      color: var(--accent-color);
      border-left: 3px solid var(--accent-color);
    }

    .label-after {
      right: 20px;
      color: var(--accent-green);
      border-right: 3px solid var(--accent-green);
    }

    .slider-container.is-dragging .image-label {
      opacity: 0.15;
    }

    /* Single Image Mode (when no before image exists) */
    .single-image-mode {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100%;
    }

    .single-image-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .single-image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: object-fit 0.2s ease;
    }

    /* Footer Styling */
    footer {
      position: absolute;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background-color: var(--panel-color);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      border-radius: 16px;
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .prompt-container {
      flex: 1;
      max-width: 65%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .prompt-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--text-secondary);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }

    .prompt-text {
      font-size: 12px;
      color: var(--text-primary);
      line-height: 1.5;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prompt-text:hover {
      white-space: normal;
      overflow: visible;
      word-break: break-all;
    }

    .meta-container {
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .meta-label {
      font-size: 9px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .meta-val {
      color: var(--text-primary);
      font-weight: 500;
    }

    /* HUD collapsing classes */
    body.hide-hud header {
      opacity: 0;
      pointer-events: none;
      transform: translateY(-30px);
    }

    body.hide-hud footer {
      opacity: 0;
      pointer-events: none;
      transform: translateY(30px);
    }

    body.hide-hud .image-label {
      bottom: 24px;
    }

    /* Small persistent trigger for bringing back HUD when hidden */
    .hud-unhide-button {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 101;
      width: 40px;
      height: 40px;
      background: rgba(11, 13, 18, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }

    .hud-unhide-button:hover {
      background: rgba(31, 34, 46, 0.9);
      transform: scale(1.05);
    }

    body.hide-hud .hud-unhide-button {
      opacity: 1;
      pointer-events: auto;
    }

    /* Responsive */
    @media (max-width: 768px) {
      header {
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        flex-direction: column;
        border-radius: 12px;
        padding: 10px;
        gap: 10px;
      }
      .button-group {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 6px;
      }
      .btn {
        padding: 6px 12px;
        font-size: 11px;
        flex: 1;
        justify-content: center;
      }
      main {
        padding: 0;
      }
      footer {
        position: fixed;
        bottom: 10px;
        left: 10px;
        right: 10px;
        flex-direction: column;
        border-radius: 12px;
        padding: 10px;
        gap: 10px;
      }
      .prompt-container {
        max-width: 100%;
      }
      .meta-container {
        width: 100%;
        justify-content: space-between;
      }
      .meta-item {
        align-items: flex-start;
      }
      .image-label {
        bottom: 140px;
      }
    }
  </style>
</head>
<body>

  <!-- Persistent HUD Unhide Trigger -->
  <div class="hud-unhide-button" id="btn-unhide" title="Show UI overlays (H)">
    <svg style="width: 18px; height: 18px; color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  </div>

  <!-- Header -->
  <header id="hud-header">
    <div class="header-title-container">
      <div class="status-dot"></div>
      <div>
        <h1 class="header-title">Architectural Render Compare</h1>
      </div>
      <div class="header-subtitle">COMPARISON DASHBOARD</div>
    </div>
    
    <div class="button-group">
      <!-- Image Fit Toggle -->
      <button class="btn btn-secondary" id="btn-fit" title="Toggle between covering screen or containing image inside screen">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        <span>Fit: Cover</span>
      </button>

      <!-- Toggle UI Overlay -->
      <button class="btn btn-secondary" id="btn-toggle-hud" title="Toggle HUD overlays. (Keyboard: H)">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <span>Hide UI</span>
      </button>

      <!-- True Fullscreen API Button -->
      <button class="btn btn-secondary" id="btn-fullscreen" title="Toggle true system full screen mode">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span>Fullscreen</span>
      </button>

      <button class="btn btn-secondary" id="btn-sweep" title="Auto-sweep the comparison slider to demo the before and after transition">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Play Demo Sweep</span>
      </button>
      
      ${originalImageURL ? `
        <a href="${originalImageURL}" download="AI_Render_Before_Reference.png" class="btn btn-secondary" id="btn-download-before">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Download Before</span>
        </a>
      ` : ''}
      
      <a href="${finalImageURL}" download="AI_Render_Export_${selectedResolution}.png" class="btn btn-primary" id="btn-download-after">
        <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download AI Render</span>
      </a>
    </div>
  </header>

  <!-- Main Comparison Area -->
  <main>
    ${originalImageURL ? `
      <!-- Before & After Comparison Slider -->
      <div class="slider-container" id="slider-box">
        <!-- After Image (Base) -->
        <img src="${finalImageURL}" alt="AI Refined Architectural Render (After)" id="img-after" />
        
        <!-- Before Image (Clipped Container) -->
        <div class="before-container" id="before-box">
          <img src="${originalImageURL}" alt="Original Viewport Reference (Before)" id="img-before" />
        </div>
        
        <!-- Dynamic Slideline and Handle Button -->
        <div class="slider-handle" id="slider-bar">
          <div class="slider-handle-button">
            <!-- Chevrons Left/Right -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 7-5 5 5 5"></path>
              <path d="m15 7 5 5-5 5"></path>
            </svg>
          </div>
        </div>
        
        <!-- Position Indicators -->
        <div class="image-label label-before" id="lbl-before">Before: Reference</div>
        <div class="image-label label-after" id="lbl-after">After: AI Refined</div>
        
        <!-- Invisible Range Input for Full-Area Touch & Drag Controls -->
        <input type="range" min="0" max="100" value="50" class="slider-range" id="compare-slider" />
      </div>
    ` : `
      <!-- Fallback Single Image View if No Reference Capture exists -->
      <div class="single-image-mode">
        <div class="single-image-wrapper">
          <img src="${finalImageURL}" alt="AI Refined Architectural Render" />
          <div class="image-label label-after" style="bottom: 100px; right: 20px;">AI Refined Output</div>
        </div>
      </div>
    `}
  </main>

  <!-- Footer Info Bar -->
  <footer id="hud-footer">
    <div class="prompt-container">
      <div class="prompt-label">AI Rendering Prompt</div>
      <div class="prompt-text prompt-tooltip-trigger" title="${escapedPromptForTitle}">
        "${activePromptEscaped}"
      </div>
    </div>
    
    <div class="meta-container">
      <div class="meta-item">
        <span class="meta-label">Active AI Model</span>
        <span class="meta-val">${activeModel.toUpperCase()}</span>
      </div>
      <div class="meta-item" style="border-left: 1px solid var(--border-color); padding-left: 16px;">
        <span class="meta-label">Selected Resolution</span>
        <span class="meta-val">${selectedResolution}</span>
      </div>
    </div>
  </footer>

  <!-- Interactivity Script -->
  <script>
    const slider = document.getElementById('compare-slider');
    const beforeBox = document.getElementById('before-box');
    const sliderBar = document.getElementById('slider-bar');
    const sliderBox = document.getElementById('slider-box');
    const btnSweep = document.getElementById('btn-sweep');
    const btnToggleHud = document.getElementById('btn-toggle-hud');
    const btnUnhide = document.getElementById('btn-unhide');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnFit = document.getElementById('btn-fit');

    // 1. Comparison Slider Handling
    if (slider && beforeBox && sliderBar) {
      // Input Event: Dragging/clicking the comparison slider range
      slider.addEventListener('input', (e) => {
        const val = e.target.value;
        updateSliderPosition(val);
      });

      // Show/Hide indicators on active dragging
      slider.addEventListener('mousedown', () => {
        sliderBox.classList.add('is-dragging');
      });
      slider.addEventListener('touchstart', () => {
        sliderBox.classList.add('is-dragging');
      });
      slider.addEventListener('mouseup', () => {
        sliderBox.classList.remove('is-dragging');
      });
      slider.addEventListener('touchend', () => {
        sliderBox.classList.remove('is-dragging');
      });

      function updateSliderPosition(percent) {
        beforeBox.style.clipPath = \`polygon(0 0, \${percent}% 0, \${percent}% 100%, 0 100%)\`;
        sliderBar.style.left = \`\${percent}%\`;
      }

      // Auto-Sweep Demo Feature
      let sweepInterval = null;
      let sweepingRight = true;
      let sweepVal = 50;

      if (btnSweep) {
        btnSweep.addEventListener('click', () => {
          if (sweepInterval) {
            // Stop Sweep
            clearInterval(sweepInterval);
            sweepInterval = null;
            btnSweep.classList.remove('btn-primary');
            btnSweep.classList.add('btn-secondary');
            btnSweep.querySelector('span').textContent = 'Play Demo Sweep';
            btnSweep.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
          } else {
            // Start Sweep
            btnSweep.classList.remove('btn-secondary');
            btnSweep.classList.add('btn-primary');
            btnSweep.querySelector('span').textContent = 'Stop Demo Sweep';
            btnSweep.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
            
            sweepInterval = setInterval(() => {
              if (sweepingRight) {
                sweepVal += 1.2;
                if (sweepVal >= 95) {
                  sweepingRight = false;
                }
              } else {
                sweepVal -= 1.2;
                if (sweepVal <= 5) {
                  sweepingRight = true;
                }
              }
              slider.value = sweepVal;
              updateSliderPosition(sweepVal);
            }, 20);
          }
        });
      }
    } else {
      // Hide Demo button if no slider exists (e.g., single image view)
      if (btnSweep) {
        btnSweep.style.display = 'none';
      }
    }

    // 2. Toggle HUD UI (Collapsible layout)
    function toggleHud() {
      document.body.classList.toggle('hide-hud');
      if (document.body.classList.contains('hide-hud')) {
        if (btnToggleHud) btnToggleHud.querySelector('span').textContent = 'Show UI';
      } else {
        if (btnToggleHud) btnToggleHud.querySelector('span').textContent = 'Hide UI';
      }
    }

    if (btnToggleHud) {
      btnToggleHud.addEventListener('click', toggleHud);
    }
    if (btnUnhide) {
      btnUnhide.addEventListener('click', toggleHud);
    }

    // Toggle via Keyboard: "H" key
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h') {
        toggleHud();
      }
    });

    // 3. System Fullscreen API Handling
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn("Fullscreen request denied or failed:", err);
          });
          btnFullscreen.querySelector('span').textContent = 'Exit Fullscreen';
        } else {
          document.exitFullscreen();
        }
      });
    }

    // Update button text if fullscreen status changes externally
    document.addEventListener('fullscreenchange', () => {
      if (btnFullscreen) {
        if (document.fullscreenElement) {
          btnFullscreen.querySelector('span').textContent = 'Exit Fullscreen';
        } else {
          btnFullscreen.querySelector('span').textContent = 'Fullscreen';
        }
      }
    });

    // 4. Image Fit Toggle (Cover vs. Contain)
    let isCover = true;
    if (btnFit) {
      btnFit.addEventListener('click', () => {
        isCover = !isCover;
        if (isCover) {
          document.body.classList.remove('img-fit-contain');
          btnFit.querySelector('span').textContent = 'Fit: Cover';
          btnFit.querySelector('svg').innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line>';
        } else {
          document.body.classList.add('img-fit-contain');
          btnFit.querySelector('span').textContent = 'Fit: Contain';
          btnFit.querySelector('svg').innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line>';
        }
      });
    }
  </script>
</body>
</html>
      `);
      presentationWindow.document.close();
    } catch (e) {
      console.warn('Failed to launch full-screen presentation window:', e);
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            AI Render Studio
          </h3>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono font-bold border border-amber-500/20">
          Photorealistic
        </span>
      </div>

      <div className="text-[11px] text-slate-400 leading-relaxed">
        Generate photorealistic, high-fidelity architectural renders of your urban layouts directly from the 3D viewport.
      </div>

      {/* AiStudio API Key Configuration Section */}
      <div className="bg-slate-900 border border-white/5 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center gap-2 border-b border-white/5 pb-1.5 justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
              AiStudio API Key
            </span>
          </div>
          {customApiKey && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              Active
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="relative font-sans">
            <input
              type={isApiKeyVisible ? 'text' : 'password'}
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter AiStudio API Key..."
              className={`w-full bg-slate-950/80 border rounded-lg py-2 pl-3 pr-10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono ${
                tempApiKey.trim().startsWith('AIzaSy')
                  ? 'border-emerald-500 focus:ring-1 focus:ring-emerald-500/50'
                  : 'border-white/10 focus:ring-1 focus:ring-amber-500/50'
              }`}
            />
            <button
              type="button"
              onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 flex items-center justify-center border-0 bg-transparent"
            >
              {isApiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {tempApiKey.trim().startsWith('AIzaSy') && (
            <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-1">
              ✓ Key Format Validated
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('nano_banana_api_key', tempApiKey);
                setCustomApiKey(tempApiKey);
              }}
              className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 border-0 rounded-lg text-xs font-bold text-slate-950 transition-all cursor-pointer text-center font-sans"
            >
              Apply & Save Key
            </button>
            {customApiKey && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('nano_banana_api_key');
                  setTempApiKey('');
                  setCustomApiKey('');
                }}
                className="px-2.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-all cursor-pointer text-center font-sans"
              >
                Clear
              </button>
            )}
          </div>

          {/* Onboarding Helper Link and Accordion Guide */}
          <div className="pt-2 border-t border-white/5 space-y-1.5">
            <button
              type="button"
              onClick={() => setShowOnboardingGuide(!showOnboardingGuide)}
              className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors text-left font-medium flex items-center gap-1 border-0 bg-transparent p-0 cursor-pointer w-full leading-normal"
            >
              👉 Don't have a key? Get a free Google AI Studio key here.
            </button>

            <AnimatePresence>
              {showOnboardingGuide && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-950/70 border border-white/5 rounded-lg p-2.5 mt-1.5 space-y-2 text-slate-400 text-xs leading-relaxed font-sans">
                    <p className="font-semibold text-slate-300 text-xs uppercase tracking-wider font-mono">
                      Google AI Studio Key Guide
                    </p>
                    <ul className="space-y-1.5 list-none pl-0 m-0 text-slate-400 text-xs">
                      <li className="flex gap-1.5 items-start">
                        <span className="text-slate-500 font-mono flex-shrink-0">1.</span>
                        <span>
                          Click{' '}
                          <a
                            href="https://aistudio.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            aistudio.google.com
                          </a>{' '}
                          to open the developer dashboard.
                        </span>
                      </li>
                      <li className="flex gap-1.5 items-start">
                        <span className="text-slate-500 font-mono flex-shrink-0">2.</span>
                        <span>Sign in using your Google account.</span>
                      </li>
                      <li className="flex gap-1.5 items-start">
                        <span className="text-slate-500 font-mono flex-shrink-0">3.</span>
                        <span>Click 'Get API Key' and generate a new key string starting with <code>AIzaSy...</code></span>
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Reference selection & viewport capture */}
      <div className="bg-slate-900 border border-white/5 rounded-xl p-3.5 space-y-3.5">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono flex items-center justify-between">
            <span>Image-to-Image Reference</span>
            <span className="text-[9px] text-slate-500 lowercase font-normal">(optional)</span>
          </label>

          {aiScreenshotDataUrl || uploadedImageRefDataUrl ? (
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-3 space-y-3 relative">
              <div className="flex gap-3 items-center">
                <div className="relative w-16 h-12 rounded overflow-hidden border border-white/10 bg-black flex-shrink-0">
                  <img
                    src={aiScreenshotDataUrl || uploadedImageRefDataUrl || ''}
                    alt="Reference"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-200 truncate">
                    {aiScreenshotDataUrl ? 'Viewport Screenshot' : uploadedImageRefName || 'Uploaded Image'}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {aiScreenshotDataUrl ? 'Captured from 3D Engine' : 'Custom Image Upload'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onTriggerAiScreenshot) {
                      onTriggerAiScreenshot();
                    }
                  }}
                  className="flex-1 py-1 px-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded text-[10px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3 h-3 text-amber-400" />
                  <span>Recapture View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImageRefDataUrl(null);
                    setUploadedImageRefName(null);
                    if (onClearAiScreenshot) {
                      onClearAiScreenshot();
                    }
                  }}
                  className="px-2 py-1 bg-red-500/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/40 rounded text-[10px] font-semibold text-red-400 hover:text-red-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setUploadedImageRefDataUrl(reader.result as string);
                    setUploadedImageRefName(file.name);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className={`border border-dashed rounded-lg p-4 text-center transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-slate-950/60'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onTriggerAiScreenshot) {
                      onTriggerAiScreenshot();
                    }
                  }}
                  className="py-2 px-3 bg-gradient-to-r from-amber-600/20 to-amber-500/20 hover:from-amber-600/35 hover:to-amber-500/35 border border-amber-500/40 hover:border-amber-500/60 text-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Camera className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Capture Viewport Screenshot</span>
                </button>

                <div className="text-[10px] text-slate-500 font-medium my-0.5">— OR —</div>

                <label className="cursor-pointer group flex flex-col items-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setUploadedImageRefDataUrl(reader.result as string);
                          setUploadedImageRefName(file.name);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <span className="text-[11px] text-slate-400 font-semibold group-hover:text-slate-200 transition-colors flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    Upload reference photo
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono mt-0.5">
                    Drag & drop PNG/JPEG image here
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Show 16:9 Safe Frame Switch */}
        <div className="flex items-center justify-between bg-slate-950/50 border border-white/5 rounded-xl p-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-300">Show 16:9 Safe Frame</span>
            <span className="text-[9px] text-slate-500 font-mono">Capture boundary guide</span>
          </div>
          <button
            type="button"
            onClick={() => onShowSafeFrameChange?.(!showSafeFrame)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              showSafeFrame ? 'bg-amber-600 shadow-sm shadow-amber-500/20' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                showSafeFrame ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* AI Model Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Render Model</span>
          </label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all font-sans cursor-pointer"
          >
            <option value="nano banana pro">Nano Banana Pro (Max Realism)</option>
            <option value="nano banana ai model">Nano Banana AI Model (Standard)</option>
            <option value="nano banana lite">Nano Banana Lite (Fast - 720p only)</option>
            <option value="nano banana 2">Nano Banana 2 (High Quality)</option>
          </select>
        </div>

        {/* Prompt */}
        <div className="space-y-1.5 font-sans">
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
            Render Prompt
          </label>
          <textarea
            value={imgPrompt}
            onChange={(e) => setImgPrompt(e.target.value)}
            placeholder="e.g., A futuristic sustainable waterfront city with towers and gardens..."
            rows={3}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all resize-none"
          />
        </div>

        {/* Output Resolution & Cost */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-mono">
            Output Resolution & Cost
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { res: '1K', label: '1K (Standard)', cost: '1' },
              { res: '2K', label: '2K (HD)', cost: '2' },
              { res: '4K', label: '4K (UHD)', cost: '4' },
            ].map((opt) => (
              <button
                key={opt.res}
                type="button"
                onClick={() => setImgResolution(opt.res as any)}
                className={`py-2 border rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                  imgResolution === opt.res
                    ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                    : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-950/60'
                }`}
              >
                <span>{opt.res}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {opt.cost} {opt.cost === '1' ? 'credit' : 'credits'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {imgError && (
          <div className="bg-red-500/15 border border-red-500/20 rounded-lg p-3 text-[11px] text-red-400 leading-snug">
            {imgError}
          </div>
        )}

        {/* Generate Button */}
        {(!customApiKey || customApiKey.trim() === '') &&
        userCredits !== null &&
        userCredits < (imgResolution === '1K' ? 1 : imgResolution === '2K' ? 2 : 4) ? (
          <button
            type="button"
            onClick={() => setIsCreditModalOpen(true)}
            className="w-full py-3 bg-red-600/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all cursor-not-allowed select-none flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Generate AI Rendering (Insufficient Credits)</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isImgGenerating}
            onClick={handleGenerateRendering}
            className={`w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border-0 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 ${
              isImgGenerating ? 'opacity-80' : ''
            }`}
          >
            {isImgGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Rendering Premium 3D Scene...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Generate AI Rendering</span>
              </>
            )}
          </button>
        )}

        {imgGatewayLog && (
          <div className="text-[9px] font-mono text-slate-500 text-center uppercase tracking-wider">
            {imgGatewayLog}
          </div>
        )}
      </div>

      {/* Generated Image Preview Card */}
      {(isImgGenerating || generatedImgUrl) && (
        <div className="bg-slate-900 border border-white/5 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Image className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Output Preview ({imgResolution})
            </span>
          </div>

          <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 border border-white/5 flex items-center justify-center group">
            {isImgGenerating ? (
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                <div className="text-xs font-semibold text-slate-200 animate-pulse">
                  Running GPU Inference Pass...
                </div>
                <div className="text-[9px] text-slate-500 font-mono font-semibold">
                  Syncing with external rendering pipeline
                </div>
              </div>
            ) : (
              generatedImgUrl && (
                <>
                  <img
                    src={generatedImgUrl}
                    alt="AI Generated Architectural Render"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={!generatedImgUrl || isImgGenerating}
                      onClick={handleOpenPresentation}
                      className="p-2 bg-slate-900/90 border border-white/10 rounded-lg hover:bg-slate-800 hover:border-white/20 transition-all text-amber-400 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-md"
                      title="Open Full-Screen Presentation"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>Presentation</span>
                    </button>
                  </div>
                </>
              )
            )}
          </div>

          <div className="w-full">
            <button
              type="button"
              disabled={!generatedImgUrl || isImgGenerating}
              onClick={handleOpenPresentation}
              className={`w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 border-0 text-slate-950 disabled:text-slate-500 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                !generatedImgUrl || isImgGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
            >
              <Maximize2 className="w-4 h-4" />
              <span>Open Full-Screen Presentation</span>
            </button>
          </div>

          {!isImgGenerating && generatedImgDesc && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold font-mono">
                Scene Description
              </div>
              <div className="text-xs text-slate-300 font-sans leading-relaxed italic bg-slate-950/40 p-2.5 rounded-lg border border-white/5">
                "{generatedImgDesc}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
