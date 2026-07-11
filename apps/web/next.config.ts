import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@momus/shared', '@momus/infra'],
  output: 'standalone',
};

export default nextConfig;
