// 引入 Prisma 在 Next.js monorepo 中的打包兼容插件
// 该插件用于解决 Prisma Client 在 Next.js monorepo 中打包时的模块解析问题
const { PrismaPlugin } = require("@prisma/nextjs-monorepo-plugin");

// 抑制特定的外部包警告（屏蔽掉一些无意义的告警输出）
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(" ");
  // 当警告信息包含以下关键字时，直接返回不输出
  // 这些警告通常来自数据库驱动（mongodb/pg/sqlite3）、typeorm 或 serverExternalPackages 配置
  if (
    message.includes("Package mongodb can't be external") ||
    message.includes("Package pg can't be external") ||
    message.includes("Package sqlite3 can't be external") ||
    message.includes("Package typeorm can't be external") ||
    message.includes("matches serverExternalPackages") ||
    message.includes("Try to install it into the project directory")
  ) {
    return; // 屏蔽这些警告
  }
  originalConsoleWarn.apply(console, args);
};

/** @type {import('next').NextConfig} */
module.exports = {
  // 关闭 React 严格模式
  // 严格模式会在开发环境下双重调用一些函数（如 useEffect），关闭可避免开发中的副作用问题
  reactStrictMode: false,
  // 允许的开发环境来源（用于本地局域网调试访问）
  allowedDevOrigins: ["192.168.31.11"],
  // 需要被 Next.js 转译（babel/swc 编译）的第三方包
  // 这些包默认是 ESM 或 TS 源码，需要 Next.js 进行转译后才能在项目中使用
  transpilePackages: [
    "prettier",
    "shiki",
    "@dub/prisma",
    "@dub/email",
    "@boxyhq/saml-jackson",
  ],
  // 配置文件输出追踪时要包含的依赖文件
  // 确保 SAML token 接口在部署时能正确打包 jose 和 openid-client 依赖
  outputFileTracingIncludes: {
    "/api/auth/saml/token": [
      "./node_modules/jose/**/*",
      "./node_modules/openid-client/**/*",
    ],
  },
  experimental: {
    // 实验性功能：优化包的导入（按需加载，减少打包体积）
    optimizePackageImports: [
      "@dub/email",
      "@dub/ui",
      "@dub/utils",
      "@team-plain/typescript-sdk",
    ],
    // Server Actions（服务端动作）的请求体大小限制为 2MB
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // 自定义 webpack 配置
  webpack: (config, { webpack, isServer }) => {
    if (isServer) {
      // 服务端构建时添加插件
      config.plugins.push(
        // 忽略 typeorm 中未使用的依赖，避免编译错误
        // 这些依赖（如各种数据库驱动）在 typeorm 中被引用但本项目并未实际使用
        new webpack.IgnorePlugin({
          resourceRegExp:
            /(^@google-cloud\/spanner|^@mongodb-js\/zstd|^aws-crt|^aws4$|^pg-native$|^mongodb-client-encryption$|^@sap\/hana-client$|^@sap\/hana-client\/extension\/Stream$|^snappy$|^react-native-sqlite-storage$|^bson-ext$|^cardinal$|^kerberos$|^hdb-pool$|^sql.js$|^sqlite3$|^better-sqlite3$|^ioredis$|^typeorm-aurora-data-api-driver$|^pg-query-stream$|^oracledb$|^mysql$|^snappy\/package\.json$|^cloudflare:sockets$)/,
        }),
      );

      // 添加 Prisma monorepo 兼容插件
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    // 关闭 webpack 对表达式上下文的关键性警告
    // 避免在动态 require 时出现大量警告信息
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
  // 配置允许优化的远程图片域名（Next.js Image 组件使用）
  images: {
    remotePatterns: [
      {
        hostname: "assets.dub.co", // Dub 的静态资源
      },
      {
        hostname: "dubassets.com", // Dub 的用户生成图片
      },
      {
        hostname: "dev.dubassets.com", // 开发环境存储桶
      },
      {
        hostname: "www.google.com", // Google 服务（如 favicon）
      },
      {
        hostname: "avatar.vercel.sh", // Vercel 提供的头像服务
      },
      {
        hostname: "faisalman.github.io", // GitHub Pages 上的资源
      },
      {
        hostname: "api.dicebear.com", // DiceBear 头像生成服务
      },
      {
        hostname: "pbs.twimg.com", // Twitter 图片
      },
      {
        hostname: "lh3.googleusercontent.com", // Google 用户头像
      },
      {
        hostname: "avatars.githubusercontent.com", // GitHub 用户头像
      },
      {
        hostname: "media.cleanshot.cloud", // 仅用于暂存（staging）环境
      },
    ],
  },
  // 自定义 HTTP 响应头
  async headers() {
    return [
      {
        // 对所有路径生效
        source: "/:path*",
        headers: [
          {
            // Referrer 策略：仅在协议降级时不发送 Referrer
            key: "Referrer-Policy",
            value: "no-referrer-when-downgrade",
          },
          {
            // 启用 DNS 预解析，加速域名解析
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // 禁止页面被嵌入 iframe（防止点击劫持攻击）
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
      {
        // 针对 /embed 路径下的所有嵌入页面
        source: "/embed/:path*",
        headers: [
          {
            // 内容安全策略：允许任意域名通过 iframe 嵌入此页面
            // （用于支持嵌入式分析面板等场景）
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
  // 自定义重定向规则
  async redirects() {
    return [
      {
        // 当访问 app.dub.sh 根路径时，永久重定向到 app.dub.co
        source: "/",
        has: [
          {
            type: "host",
            value: "app.dub.sh",
          },
        ],
        destination: "https://app.dub.co",
        permanent: true,
        statusCode: 301,
      },
      {
        // 当访问 app.dub.sh 下任意路径时，带路径永久重定向到 app.dub.co
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "app.dub.sh",
          },
        ],
        destination: "https://app.dub.co/:path*",
        permanent: true,
        statusCode: 301,
      },
      {
        // staging.dub.sh 根路径 → dub.co（staging 环境指向正式站）
        source: "/",
        has: [
          {
            type: "host",
            value: "staging.dub.sh",
          },
        ],
        destination: "https://dub.co",
        permanent: true,
        statusCode: 301,
      },
      {
        // preview.dub.sh 根路径 → preview.dub.co（预览环境域名统一）
        source: "/",
        has: [
          {
            type: "host",
            value: "preview.dub.sh",
          },
        ],
        destination: "https://preview.dub.co",
        permanent: true,
        statusCode: 301,
      },
      {
        // admin.dub.sh 根路径 → admin.dub.co（后台管理域名统一）
        source: "/",
        has: [
          {
            type: "host",
            value: "admin.dub.sh",
          },
        ],
        destination: "https://admin.dub.co",
        permanent: true,
        statusCode: 301,
      },
    ];
  },
  // 自定义重写规则（URL 代理转发，地址栏 URL 不变）
  async rewrites() {
    return [
      // 用于 Dub 点击追踪的代理接口
      // 将本地的 /_proxy/dub/track/click 请求代理到 Dub 官方 API
      {
        source: "/_proxy/dub/track/click",
        destination: "https://api.dub.co/track/click",
      },
    ];
  },
};
