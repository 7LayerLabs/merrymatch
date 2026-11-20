import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Merry Match",
    short_name: "Merry Match",
    description: "Secret Santa and family wishlists.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf6ea",
    theme_color: "#214337",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
