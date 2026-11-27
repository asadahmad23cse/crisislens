import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrisisLens — Finding Silent Zones in Disaster Social Media",
  description:
    "Advisory decision-support system that inverts the crisis-informatics question: instead of ranking areas by how much they post, CrisisLens estimates how much an area SHOULD be posting given its exposure, then flags the gap. Silent zones are areas with high expected damage but anomalously low social-media reporting.",
  keywords: [
    "CrisisLens",
    "HumAID",
    "disaster response",
    "silent zones",
    "crisis informatics",
    "Nepal earthquake 2015",
    "decision support",
    "geoparsing",
  ],
  authors: [{ name: "CrisisLens Project" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "CrisisLens — Finding Silent Zones in Disaster Social Media",
    description:
      "Are the areas posting the most on social media actually the worst affected, or are some severely affected areas being missed because people there are unable to post?",
    url: "https://chat.z.ai",
    siteName: "CrisisLens",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CrisisLens — Finding Silent Zones",
    description:
      "High expected damage + low social-media activity = Silent Zone. Advisory decision-support for emergency response.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" />
      </body>
    </html>
  );
}
