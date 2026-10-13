import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.MEENDOC_TEST_SERVER==="true"?".next-test":".next",
  devIndicators: false, poweredByHeader: false,
  headers(){return [{source:"/:path*",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(), geolocation=(), payment=(), microphone=(self)"},
  ]}];},
};
export default nextConfig;
