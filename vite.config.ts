import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Custom plugin to replace Cesium imports with the global CDN-loaded instance
const cesiumShimPlugin = () => {
  return {
    name: 'cesium-shim',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === 'cesium') {
        return '\0cesium-virtual';
      }
      if (id === 'cesium/Source/Widgets/widgets.css') {
        return '\0cesium-css-virtual';
      }
      return null;
    },
    load(id: string) {
      if (id === '\0cesium-virtual') {
        return `
          const Cesium = (window as any).Cesium;
          export default Cesium;
          export * from 'cesium';
        `;
      }
      if (id === '\0cesium-css-virtual') {
        return '';
      }
      return null;
    },
    transform(code: string, id: string) {
      if (id.endsWith('.tsx') || id.endsWith('.ts')) {
        if (code.includes("import * as Cesium from 'cesium'") || code.includes("import * as Cesium from \"cesium\"")) {
          const newCode = code
            .replace(/import\s+\*\s+as\s+Cesium\s+from\s+['"]cesium['"];?/g, "const Cesium = (window as any).Cesium;")
            .replace(/import\s+['"]cesium\/Source\/Widgets\/widgets\.css['"];?/g, "/* cesium css from cdn */");
          return {
            code: newCode,
            map: null
          };
        }
      }
      return null;
    }
  };
};

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      cesiumShimPlugin(),
      viteSingleFile(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
