import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEPL ERP - Enterprise Resource Planning",
  description: "Comprehensive ERP system for industrial business operations with India compliance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
