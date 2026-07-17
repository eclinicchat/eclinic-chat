import "./globals.css";

export const metadata = {
  title: "eClinic Chat",
  description: "Prototip de chat securizat pentru echipe medicale",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
