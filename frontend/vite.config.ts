import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import removeConsole from 'vite-plugin-remove-console';
import svgr from 'vite-plugin-svgr';
import wails from "@wailsio/runtime/plugins/vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  plugins: [react(), svgr({ 
      // This forces Vite to process SVGs as React components when '?react' is appended
      svgrOptions: { exportType: 'default', ref: true },
    }),
    removeConsole(), wails("./bindings")],
});
