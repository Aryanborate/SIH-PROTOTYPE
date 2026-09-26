import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GigSetu — India's Cooperative Workforce Operating System",
  description:
    "Cooperative-owned digital operating system connecting labour cooperative societies, federations, verified skilled workers, households and institutions — AI matching, fair pricing, welfare wallets and federation intelligence. SIH prototype.",
  keywords: ["GigSetu", "cooperative", "workforce", "SIH", "Smart India Hackathon", "labour cooperative"],
};

/**
 * Theme bootstrap.
 *
 * This must be server-rendered: React 19 does not execute <script> elements
 * produced while rendering a client component, so the equivalent bootstrap
 * inside a client ThemeProvider is dead code (and logs
 * "Encountered a script tag while rendering React component"). Rendered here on
 * the server it runs before paint, so a returning dark-mode visitor never sees
 * a flash of the light theme.
 *
 * Keep the storage key in sync with THEME_STORAGE_KEY in components/theme-provider.tsx.
 */
const themeBootstrap = `(function(){try{var k='gigsetu-theme';var s=localStorage.getItem(k);var t=(s==='dark'||s==='light')?s:'light';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider defaultTheme="light">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
