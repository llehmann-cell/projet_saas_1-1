import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avis Tranche | Diagnostic de projet",
  description: "Un diagnostic franc pour tester la solidite d'une idee SaaS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
