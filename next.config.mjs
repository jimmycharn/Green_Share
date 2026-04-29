/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // LIFF ต้องรันใน iframe ของ LINE ดังนั้นใช้ frame-ancestors ผ่าน CSP แทนการบล็อกทั้งหมด
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // LIFF SDK มาจาก static.line-scdn.net; อนุญาต inline ชั่วคราว (จะลดลงตอน refactor UI)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://*.line-scdn.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.line.me https://*.line.me https://*.line-scdn.net https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.groq.com",
      'frame-ancestors https://liff.line.me https://*.line.me',
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
