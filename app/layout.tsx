import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AuthService — Enterprise Authentication Platform",
  description: "Production-grade authentication infrastructure. JWT, WebAuthn/Passkeys, Device Attestation, Adaptive Risk Engine, PSD2 SCA. PCI DSS v4.0 · GDPR · FIDO2 L2 compliant.",
  keywords: ["authentication", "JWT", "WebAuthn", "passkeys", "SCA", "PSD2", "FIDO2", "risk engine", "device attestation"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
