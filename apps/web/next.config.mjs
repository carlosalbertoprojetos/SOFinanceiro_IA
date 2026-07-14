import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));

if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
