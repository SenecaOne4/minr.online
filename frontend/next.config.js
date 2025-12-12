/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure Next.js runs on a different port than backend
  // Backend uses 3000, frontend should use 3001
  // This is set via PORT env var or defaults to 3000
}

module.exports = nextConfig

