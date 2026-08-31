import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gleicher Grund wie in apps/web: @pivot/blocks liefert TS/TSX-Quellcode
  // ohne eigenen Build-Schritt und muss deshalb hier mit transpiliert
  // werden – Frontend und Backend rendern Blöcke dadurch mit exakt
  // demselben Code (siehe knowledge-base/frontend/public-website.md).
  transpilePackages: ["@pivot/blocks"],
};

export default nextConfig;
