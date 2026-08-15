import type { Metadata } from "next";
import GoogleIdentityScript from "@/components/GoogleIdentityScript";
import QueryProvider from "@/components/QueryProvider";
import ThemeController from "@/components/ThemeController";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGENCIE - Operating System for Marketing Agencies",
  description:
    "AGENCIE is a creative agency operations platform for managing clients, campaigns, content production, team assignments, approvals, deadlines, and delivery in one workspace.",
  openGraph: {
    title: "AGENCIE - Operating System for Marketing Agencies",
    description:
      "AGENCIE is a creative agency operations platform for managing clients, campaigns, content production, team assignments, approvals, deadlines, and delivery in one workspace.",
    siteName: "AGENCIE",
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
        <QueryProvider>
          {children}
          <ThemeController />
          <GoogleIdentityScript />
        </QueryProvider>
      </body>
    </html>
  );
}
