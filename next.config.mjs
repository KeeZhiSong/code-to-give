import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // There's a stray package-lock.json in C:\Users\keezh, which made Next infer
  // the whole home directory as the workspace root and trace files across it.
  // Pin the root to this project.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
