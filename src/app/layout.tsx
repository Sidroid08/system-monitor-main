import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { RedisProvider } from "@/context/RedisContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Sidroid — Multi-Org Monitoring Dashboard",
  description: "Real-time monitoring dashboard for cloud and local systems. Personalized telemetry powered by VictoriaMetrics.",
  keywords: ["monitoring", "dashboard", "cloud", "metrics", "grafana", "prometheus"],
  authors: [{ name: "Sidroid Team" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <RedisProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </RedisProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
