import type { Metadata } from "next";
import "../styles/globals.css";
import Providers from "@/components/layout/Providers";

export const metadata: Metadata = {
  title: "Fuji Solar CRM + ERP",
  description: "Enterprise management panel for solar installations and client pipelines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-text">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
