/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  compress: true,
  // Enable Turbopack explicitly for Next.js 16
  turbopack: {},
}

export default nextConfig
