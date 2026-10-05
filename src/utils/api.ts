/**
 * Dynamically resolves API endpoints to accommodate:
 * 1. Standard root deployment (e.g., http://localhost:3000/api/...)
 * 2. IIS Virtual Directories / Applications (e.g., https://10.188.53.5/UrbanPlanningGeosphere/api/...)
 */
export function getApiUrl(endpoint: string): string {
  // Strip leading slashes
  const cleanEndpoint = endpoint.replace(/^\/+/, '');

  if (typeof window === 'undefined') {
    return `/${cleanEndpoint}`;
  }

  // Get current pathname (e.g. "/UrbanPlanningGeosphere/" or "/UrbanPlanningGeosphere/index.html")
  let basePath = window.location.pathname || '/';

  // Remove filename if present (e.g., index.html)
  if (/\.[a-zA-Z0-9]+$/.test(basePath)) {
    basePath = basePath.substring(0, basePath.lastIndexOf('/'));
  }

  // Ensure trailing slash on base path
  if (!basePath.endsWith('/')) {
    basePath += '/';
  }

  return `${basePath}${cleanEndpoint}`;
}
