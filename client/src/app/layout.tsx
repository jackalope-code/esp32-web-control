import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ESP32 Sensor Dashboard',
  description: 'Monitor and control your ESP32 sensor node',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
