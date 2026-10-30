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
  themeColor: "#07111d",
};

export default function RootLayout({ children }) {
  const themeScript = `(function(){try{var p=localStorage.getItem('eclintalk-theme')||'auto';var t=p==='auto'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='light'?'#edf3f8':'#07111d'}catch(e){}})()`;
  return <html lang="ro" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
