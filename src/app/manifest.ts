import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cook-Till-Empty",
    short_name: "Cook-Till-Empty",
    description: "Cook what you have. Buy only what you need. ทำจากของที่มี ซื้อเฉพาะที่ขาด",
    start_url: "/",
    display: "standalone",
    background_color: "#edf0ea",
    theme_color: "#2c6a45",
    lang: "en",
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
