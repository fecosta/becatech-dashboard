import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. A stray package-lock.json sits in the parent directory
  // (with no package.json beside it), and Turbopack otherwise infers that as the root —
  // which resolves `[project]/node_modules/...` outside this repo and makes dev requests
  // fail with "Could not find the module ... in the React Client Manifest".
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
