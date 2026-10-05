// pre-init.ts: Establish early error interceptors before any ESM modules (like Cesium) evaluate.
if (typeof window !== 'undefined') {
  const formatArg = (arg: any): string => {
    if (arg === null || arg === undefined) return '';
    if (arg instanceof Error) {
      return `${arg.name || 'Error'}: ${arg.message || ''} ${arg.stack || ''}`;
    }
    if (typeof arg === 'object') {
      try {
        if (arg.statusCode) {
          return `HTTP Error ${arg.statusCode}: ${arg.statusText || (typeof arg.response === 'string' && arg.response.includes('404') ? 'Resource not found (404)' : 'Request error')}`;
        }
        if (arg.message || arg.statusText || arg.status) {
          return `${arg.name || 'Error'}: ${arg.message || arg.statusText || arg.status}`;
        }
        const keys = Object.keys(arg);
        if (keys.length === 0) return '';
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  };

  // Check if an error message represents a known, expected Cesium asset 404/ResourceNotFound failure, tile 404, or empty object
  const isCesiumAssetFailure = (str: string): boolean => {
    if (!str || str.trim() === '' || str.trim() === '{}') return true;
    const lower = str.toLowerCase();
    return (
      lower.includes('resourcenotfound') ||
      lower.includes('resource not found') ||
      lower.includes('404') ||
      lower.includes('statuscode":404') ||
      lower.includes('statuscode: 404') ||
      lower.includes('file or directory not found') ||
      lower.includes('server error') ||
      lower.includes('96188') ||
      lower.includes('assetid') ||
      lower.includes('assets/1') ||
      lower.includes('terrainprovider') ||
      lower.includes('failed to load right 3d buildings') ||
      lower.includes('failed to load left 3d buildings') ||
      lower.includes('failed to force active 3d world terrain') ||
      lower.includes('failed to load terrain provider') ||
      (lower.includes('failed to fetch') && lower.includes('dmt.gov.ae'))
    );
  };

  const logGracefulError = (error: any, context: string) => {
    let errStr = formatArg(error);
    if (!errStr || errStr.trim() === '' || errStr.trim() === '{}') {
      errStr = 'Empty error object';
    }

    if (isCesiumAssetFailure(errStr)) {
      console.log(`[Graceful Interceptor] Captured expected asset failure ${context} (suppressed modal):`, errStr);
      return;
    }

    console.warn(`[Graceful Interceptor] Captured uncaught ${context}:`, errStr);
  };

  // Overwrite console.warn and console.error to filter out known failed/expired Cesium assets warnings from prompting system alerts
  const originalWarn = console.warn;
  console.warn = function (...args) {
    const msg = args.map(formatArg).join(' ');
    if (isCesiumAssetFailure(msg)) {
      console.log('[Suppressed Console Warning]:', ...args);
      return;
    }
    const sanitizedArgs = args.map(arg => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (arg && typeof arg === 'object' && Object.keys(arg).length === 0 && !arg.message) return '[Warning Object]';
      return arg;
    });
    originalWarn.apply(console, sanitizedArgs);
  };

  const originalError = console.error;
  console.error = function (...args) {
    const msg = args.map(formatArg).join(' ');
    if (isCesiumAssetFailure(msg)) {
      console.log('[Suppressed Console Error]:', ...args);
      return;
    }
    const sanitizedArgs = args.map(arg => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
      if (arg && typeof arg === 'object' && Object.keys(arg).length === 0 && !arg.message) return '[Error Object]';
      return arg;
    });
    originalError.apply(console, sanitizedArgs);
  };

  // Listen to promise rejections (Cesium asynchronous loading rejections)
  window.addEventListener('unhandledrejection', (event) => {
    logGracefulError(event.reason, 'unhandled promise rejection');
    event.preventDefault();
  }, { capture: true });

  // Listen to uncaught runtime exceptions
  window.addEventListener('error', (event) => {
    const msg = event.message ? String(event.message) : '';
    const isObject = event.error && typeof event.error === 'object' && !(event.error instanceof Error);
    const isObjectError = isObject || msg.includes('[object Object]') || msg.includes('Object') || !msg;

    if (isObjectError) {
      logGracefulError(event.error, 'uncaught object error exception');
      event.preventDefault();
    }
  }, { capture: true });

  // Ultimate fallback via window.onerror to suppress browser-stopping visual popups for objects
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = String(message);
    if (
      !msgStr ||
      msgStr.includes('[object Object]') ||
      msgStr.includes('Object') ||
      (error && typeof error === 'object' && !(error instanceof Error))
    ) {
      logGracefulError(error || message, 'onerror object exception');
      return true; // Prevents default browser crash banner
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
}
export {};
