/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure Next.js runs on a different port than backend
  // Backend uses 3000, frontend should use 3001
  // This is set via PORT env var or defaults to 3000
  
  // Add cache headers to prevent stale UI
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig

