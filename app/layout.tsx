import type { Metadata, Viewport } from "next";
import "./globals.css";
import PinGate from "@/components/PinGate";
import PersonPicker from "@/components/PersonPicker";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "App de Gastos",
  description: "Gastos e ingresos en pareja, en tiempo real",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gastos",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <PinGate>
          <PersonPicker />
          <main className="mx-auto min-h-screen max-w-md pb-24">{children}</main>
          <Nav />
        </PinGate>
      </body>
    </html>
  );
}
