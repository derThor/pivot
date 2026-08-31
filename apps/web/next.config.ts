import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Backend liegt unter einem Pfad derselben Domain wie die öffentliche
  // Website (https://kunde.de/admin) – Nutzerentscheidung 2026-08-31, siehe
  // knowledge-base/platform/deployment.md. Muss mit BASE_PATH in
  // src/lib/bff.ts übereinstimmen; "" schaltet auf Subdomain-Betrieb um.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/admin",
  // @pivot/blocks liefert TS/TSX-Quellcode ohne eigenen Build-Schritt
  // (siehe knowledge-base/frontend/taxonomy-management.md) – Next.js muss
  // ihn deshalb selbst transpilieren, genau wie den App-eigenen Code.
  transpilePackages: ["@pivot/blocks"],
};

export default nextConfig;
