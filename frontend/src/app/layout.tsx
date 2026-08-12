import type { Metadata } from "next";
import GoogleIdentityScript from "@/components/GoogleIdentityScript";
import ThemeController from "@/components/ThemeController";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGOS | Creative Agency Operations Platform",
  description:
    "AGOS is a creative agency operations platform for managing clients, campaigns, content production, team assignments, approvals, deadlines, and delivery in one workspace.",
  openGraph: {
    title: "AGOS | Creative Agency Operations Platform",
    description:
      "AGOS is a creative agency operations platform for managing clients, campaigns, content production, team assignments, approvals, deadlines, and delivery in one workspace.",
    siteName: "AGOS",
  },
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
