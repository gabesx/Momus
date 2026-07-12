import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@momus/shared', '@momus/infra', '@momus/domain', '@momus/jobs'],
};

export default nextConfig;
