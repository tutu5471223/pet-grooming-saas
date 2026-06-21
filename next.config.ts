import type { NextConfig } from "next";

// Pragmatic CSP for a standard Next.js app. script-src keeps 'unsafe-inline'
// /'unsafe-eval' because the app does not use a nonce/hash pipeline; the value
// here still blocks data exfiltration to arbitrary origins (connect/img/form),
// disallows plugins (object-src none), and prevents clickjacking
// (frame-ancestors none). It is defense-in-depth on top of server-side HTML
// sanitization (see lib/sanitize.ts).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ["trycloudflare.com"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
};

export default nextConfig;
