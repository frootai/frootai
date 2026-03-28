import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "FrootAI — From the Roots to the Fruits",
    template: "%s | FrootAI",
  },
  description: "The open glue for AI architecture. 22 MCP tools, 20 solution plays, 18 knowledge modules. From the roots to the fruits.",
  keywords: ["FrootAI", "AI", "MCP", "solution plays", "agents", "RAG", "Azure", "LLM", "enterprise AI"],
  metadataBase: new URL("https://frootai.dev"),
  openGraph: {
    title: "FrootAI — From the Roots to the Fruits",
    description: "22 MCP tools, 20 solution plays, 18 knowledge modules. The open glue for AI architecture.",
    type: "website",
    locale: "en_US",
    siteName: "FrootAI",
    url: "https://frootai.dev",
    images: [{ url: "/img/frootai-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FrootAI — From the Roots to the Fruits",
    description: "22 MCP tools, 20 solution plays, 18 knowledge modules.",
    images: ["/img/frootai-og.png"],
  },
  icons: { icon: [{ url: "/img/frootai-mark.svg", type: "image/svg+xml", sizes: "any" }], apple: { url: "/img/frootai-logo.png", sizes: "180x180" } },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased">
        <AnnouncementBar />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
