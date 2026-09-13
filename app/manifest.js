export default function manifest() {
  return {
    name: "eClinic Chat",
    short_name: "eClinic Chat",
    description: "Chat securizat pentru echipe medicale",
    start_url: "/",
    display: "standalone",
    background_color: "#07101d",
    theme_color: "#07101d",
    lang: "ro",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
