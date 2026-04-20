import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FrootAI Platform",
  description:
    "Interactive platform for AI primitives — browse, test, and configure FrootAI solution plays.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-frootai-dark text-frootai-text font-sans">
        <Sidebar />
        <main className="min-h-screen pt-14 lg:pl-64 lg:pt-0">
          <div className="mx-auto max-w-7xl p-5 lg:p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
