import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @pivot/blocks liefert TS/TSX-Quellcode ohne eigenen Build-Schritt
  // (siehe knowledge-base/frontend/taxonomy-management.md) – Next.js muss
  // ihn deshalb selbst transpilieren, genau wie den App-eigenen Code.
  transpilePackages: ["@pivot/blocks"],
};

export default nextConfig;
