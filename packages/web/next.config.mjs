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
