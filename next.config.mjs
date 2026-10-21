/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type errors still fail the build; style-only lint rules don't block it.
  eslint: { ignoreDuringBuilds: true },
  typedRoutes: false
};

export default nextConfig;
