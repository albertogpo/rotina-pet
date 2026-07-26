import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";

export default defineConfig({
  base:"./",
  plugins:[
    react(),
    VitePWA({
      registerType:"autoUpdate",
      includeAssets:[
        "favicon.svg",
        "icons/icon-32-v072.png",
        "icons/apple-touch-icon-v072.png",
        "icons/icon-192-v072.png",
        "icons/icon-512-v072.png",
        "icons/icon-maskable-512-v072.png",
        "icons/icon-1024-v072.png",
      ],
      manifest:{
        name:"Rotina Pet",
        short_name:"Rotina Pet",
        description:"Organize a alimentação, os horários e a evolução de peso dos seus animais.",
        theme_color:"#f7f5f0",
        background_color:"#f7f5f0",
        display:"standalone",
        start_url:"./",
        icons:[
          {src:"icons/icon-192-v072.png",sizes:"192x192",type:"image/png",purpose:"any"},
          {src:"icons/icon-512-v072.png",sizes:"512x512",type:"image/png",purpose:"any"},
          {src:"icons/icon-maskable-512-v072.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
        ],
      },
      workbox:{navigateFallback:"index.html",cleanupOutdatedCaches:true},
    }),
  ],
});
