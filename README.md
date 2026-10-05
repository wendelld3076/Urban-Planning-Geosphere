# 3D Geospatial Web Application - Urban Planning Geosphere

A clean, modern, and high-performance **3D Geospatial Web Application** built with **React**, **Vite**, **TypeScript**, **CesiumJS**, and **ArcGIS REST Imagery Services**.

## Features

- **Full-Screen 3D Globe**: Direct WebGL 3D globe visualization optimized to hide default timeline, animation, and geocoding overlays for a clean display.
- **Secure Token Management**: Built-in support for loading the **Cesium Ion Access Token** securely from environment variables, with a modern glassmorphism popup modal fallback if missing.
- **Floating Glassmorphic Sidebar**: Sleek panel built with Tailwind CSS containing:
  - **Dynamic Landmark Search**: Teleport or glide fly-to iconic presets (Manhattan, Grand Canyon, Mt. Everest, Tokyo, Giza).
  - **Basemap Imagery Presets**: Instant switcher between High-Resolution Satellite, Dark Matter, Streets, and Topographic styles.
  - **Atmospheric Enhancements**: Live switches for Atmospheric Fog, Scattering, and 3D buildings/mesh terrain.
- **Layer Control Manager**: Active state array structures configured to load custom GeoJSON landmarks and parabolic 3D flight lines dynamically.
- **Responsive Telemetry Analytics**: Frame timers, camera fields-of-view, rendering statistics, and projection models directly retrieved from the active WebGL context.

---

## Getting Started

### 1. Set Up Cesium Ion Token

This application requires a **Cesium Ion Access Token** to load high-resolution global assets like 3D Buildings and Elevation Terrain. 

1. Sign up for a free developer account at [cesium.com/ion](https://ion.cesium.com/).
2. Navigate to the **Access Tokens** tab in your dashboard and copy your **Default Access Token**.
3. Create a `.env` file in the project's root directory (or use `.env.example` as a template).
4. Paste your token into the environment variable:

```env
VITE_CESIUM_ION_TOKEN="your_copied_access_token_here"
```

*Note: If no token is provided in the environment variables, the app will launch in **Demo Mode**, utilizing standard open-source basemaps and prompting you to enter a token directly in the UI if needed.*

### 2. Install & Start Development

To run the application locally, install dependencies and launch the Vite server:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will start on `http://localhost:3000`.

---

## File Structure

```text
/src
 ├── main.tsx              # Main application entry point
 ├── App.tsx               # Orchestrates globe states and modals
 ├── types.ts              # Strongly typed shared interfaces
 ├── index.css             # Imports and configurations for Tailwind CSS
 ├── data/
 │    ├── locations.ts     # Pre-defined iconic fly-to coordinate datasets
 │    └── layers.ts        # Setup definitions for 3D datasets and vector overlays
 └── components/
      ├── CesiumGlobe.tsx  # Houses WebGL container, canvas lifecycle, and loaders
      ├── Sidebar.tsx      # Sleek floating panel with UI toggles
      └── TokenModal.tsx   # Glassmorphic modal guiding missing token config
```

---

## Development & Deployment Best Practices

- **Resource Disposal**: The `CesiumGlobe.tsx` component is engineered to automatically dispose of the WebGL canvas, event listeners, and data-workers on unmount (`viewer.destroy()`), preventing critical memory leaks.
- **Optimized Rendering**: The viewer is configured with `requestRenderMode: true` to prevent constant frame rendering, resulting in massive CPU savings and improved battery life on laptops and mobile devices.
