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
  async redirects() {
    return [
      { source: '/admin/ia', destination: '/admin/comando?tab=analise', permanent: false },
      { source: '/admin/lumin-growth', destination: '/admin/comando?tab=growth', permanent: false },
      { source: '/parceiro/ia', destination: '/parceiro/assistente-ia', permanent: false },
    ]
  },
}

export default nextConfig
