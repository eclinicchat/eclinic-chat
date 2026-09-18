export default function manifest() {
  return {
    name: "eClinTalk",
    short_name: "eClinTalk",
    description: "Conversații private și comunități conectate",
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
