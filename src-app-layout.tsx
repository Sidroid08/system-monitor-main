import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { RedisProvider } from "@/context/RedisContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sidroid Dashboard - Multi-Org Monitoring",
  description: "Real-time monitoring dashboard for cloud and local systems",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RedisProvider>
          <AuthProvider>{children}</AuthProvider>
        </RedisProvider>
      </body>
    </html>
  );
}
