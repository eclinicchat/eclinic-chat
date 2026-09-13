import "./globals.css";

export const metadata = {
  title: "eClinic Chat",
  description: "Chat securizat pentru echipe medicale",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "eClinic Chat",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return <html lang="ro"><body>{children}</body></html>;
}
