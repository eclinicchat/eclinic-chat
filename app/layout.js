export const metadata = {
  title: "eClinic Chat",
  description: "Radiology chat application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
