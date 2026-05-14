import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvConfig(repoRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    instrumentationHook: false,
  },
  transpilePackages: ["@lectio/core"],
};

export default nextConfig;
