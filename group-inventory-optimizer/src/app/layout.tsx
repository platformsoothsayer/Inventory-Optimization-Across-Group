import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppStateProvider } from "@/state/AppState";
import { Shell, LoadingShell } from "@/components/Shell";
import { GROUP_NAME } from "@/config";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `Optimización de Inventario del Grupo | ${GROUP_NAME}`,
  description: "Demo de optimización de inventario con IA. Soothsayer Analytics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${plex.variable} antialiased`}>
        <Suspense fallback={<LoadingShell />}>
          <AppStateProvider>
            <Shell>{children}</Shell>
          </AppStateProvider>
        </Suspense>
      </body>
    </html>
  );
}
