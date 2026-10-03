/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next's dev server names this package's chunk vendor-chunks/@supabase.js.
  // That file is removed on recompile, and the static-paths worker then crashes
  // with "Cannot find module './vendor-chunks/@supabase.js'".
  serverExternalPackages: ['@supabase/supabase-js'],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // Match Storage bucket 5MB limit for avatar uploads
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;
