import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flock Runner",
  description:
    "Count Masters tarzı kuş sürüsü flock-runner oyunu — kuşbakışı, tek elle oynanır.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#bfe3ff",
  // Mobil tarayıcı adres çubuğu rengini gökyüzüne uydur.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
