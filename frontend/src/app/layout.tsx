import type { Metadata } from "next";
import GoogleIdentityScript from "@/components/GoogleIdentityScript";
import ThemeController from "@/components/ThemeController";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency OS — Run your creative agency without WhatsApp, Notion, and Excel",
  description:
    "Agency OS helps creative agencies plan campaigns, manage content, and run approvals from one clear workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeController />
        <GoogleIdentityScript />
      </body>
    </html>
  );
}
