import "./globals.css";

export const metadata = {
  applicationName: "eClinTalk",
  title: {
    default: "eClinTalk",
    template: "%s · eClinTalk",
  },
  description: "Comunicare sigură pentru echipe și comunități",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "eClinTalk",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "eClinTalk",
    description: "Comunicare sigură pentru echipe și comunități",
    type: "website",
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
