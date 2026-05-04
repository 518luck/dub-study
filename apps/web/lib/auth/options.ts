import { isBlacklistedEmail } from "@/lib/edge-config";
import { jackson } from "@/lib/jackson";
import { isStored, storage } from "@/lib/storage";
import { UserProps } from "@/lib/types";
import { ratelimit } from "@/lib/upstash";
import { sendEmail } from "@dub/email";
import LoginLink from "@dub/email/templates/login-link";
import { prisma } from "@dub/prisma";
import { PrismaClient } from "@dub/prisma/client";
import { APP_DOMAIN_WITH_NGROK } from "@dub/utils";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { waitUntil } from "@vercel/functions";
import { User, type NextAuthOptions } from "next-auth";
import { AdapterUser } from "next-auth/adapters";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { createId } from "../api/create-id";
import { isProduction, skipAuthThrottling } from "../api/environment";
import { isSamlEnforcedForEmailDomain } from "../api/workspaces/is-saml-enforced-for-email-domain";
import { qstash } from "../cron";
import { completeProgramApplications } from "../partners/complete-program-applications";
import { FRAMER_API_HOST } from "./constants";
import {
  exceededLoginAttemptsThreshold,
  incrementLoginAttempts,
} from "./lock-account";
import { validatePassword } from "./password";
import { trackDubLead } from "./track-dub-lead";

const VERCEL_DEPLOYMENT = !!process.env.VERCEL_URL;

//基于官方的 PrismaAdapter 生成一个自定义 adapter，并重写其中的 createUser 方法。
const CustomPrismaAdapter = (p: PrismaClient) => {
  return {
    ...PrismaAdapter(p), //先调用官方提供的 PrismaAdapter(p) 它会返回一个标准的 Prisma adapter 对象
    createUser: async (data: any) => {
      //createUser 是 NextAuth adapter 里的一个标准方法。  当 NextAuth 需要创建用户时，就会调用这个方法。
      return p.user.create({
        data: {
          ...data, // 先把 NextAuth 传进来的用户数据全部展开进来
          id: createId({ prefix: "user_" }), // 自定义用户主键格式。
          notificationPreferences: {
            //顺手把这个用户对应的 notificationPreferences 记录也一起创建出来
            create: {},
          },
        },
      });
    },
  };
};

// “登录注册总配置文件”或者“认证系统总说明书”。
// - export const authOptions：导出一个常量，名字叫 authOptions
// - : NextAuthOptions：这个常量必须符合 NextAuth 规定的配置类型
export const authOptions: NextAuthOptions = {
  providers: [
    // 邮箱登录
    EmailProvider({
      // 自定义发送方式
      sendVerificationRequest({ identifier, url }) {
        if (!isProduction) {
          console.log(`Login link: ${url}`);
          return;
        }

        sendEmail({
          to: identifier,
          subject: `Your ${process.env.NEXT_PUBLIC_APP_NAME} Login Link`,
          react: LoginLink({ url, email: identifier }),
        });
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string, //  这是 Google 分配给你这个应用的 应用 ID。
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, // 这是 Google 分配给你这个应用的 应用密钥。
      allowDangerousEmailAccountLinking: true, //允许按相同邮箱把 Google 登录和已有账号关联起来
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    // saml 是普通 SAML SSO 登录的第一步入口。
    {
      id: "saml",
      name: "BoxyHQ",
      type: "oauth",
      version: "2.0",
      checks: ["pkce", "state"],
      authorization: {
        url: `${process.env.NEXTAUTH_URL}/api/auth/saml/authorize`,
        params: {
          scope: "",
          response_type: "code",
          provider: "saml",
        },
      },
      token: {
        url: `${process.env.NEXTAUTH_URL}/api/auth/saml/token`,
        params: { grant_type: "authorization_code" },
      },
      userinfo: `${process.env.NEXTAUTH_URL}/api/auth/saml/userinfo`,
      profile: async (profile) => {
        let existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        // user is authorized but doesn't have a Dub account, create one for them
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              id: createId({ prefix: "user_" }),
              email: profile.email,
              name: `${profile.firstName || ""} ${
                profile.lastName || ""
              }`.trim(),
              notificationPreferences: {
                create: {},
              },
            },
          });
        }

        const { id, name, email, image } = existingUser;

        return {
          id,
          name,
          email,
          image,
        };
      },
      options: {
        // 这是这个自定义 provider 的附加配置。
        clientId: "dummy",
        clientSecret: process.env.NEXTAUTH_SECRET as string,
      },
      allowDangerousEmailAccountLinking: true,
    },
    // saml-idp  是 IdP-initiated 登录回调后的承接入口。
    CredentialsProvider({
      id: "saml-idp", // 这个 provider 的唯一标识；前端/NextAuth 会用它区分这是哪一种登录方式
      name: "IdP Login", // 这个 provider 的显示名称，通常用于登录页按钮或内部标识
      credentials: {
        code: {}, // 定义这个登录入口期望接收的凭证字段；这里只需要一个 code
      },
      async authorize(credentials) {
        // 用户提交这个 provider 的凭证后，NextAuth 会调 用这里；你自己决定如何校验
        if (!credentials) {
          return null; // 没收到任何凭证，登录失败
        }

        const { code } = credentials; // 从提交的凭证里取出 code

        if (!code) {
          return null; // code 不存在，登录失败
        }

        const { oauthController } = await jackson(); // 获取 SSO/SAML 这套桥接认证里用到的控制器

        // Fetch access token
        const { access_token } = await oauthController.token({
          code, // 前一步拿到的授权码，用它去换 access token
          grant_type: "authorization_code", // OAuth 标准授权码模式
          redirect_uri: process.env.NEXTAUTH_URL as string, // 回调地址/重定向地址，要和发起登录时保持一致
          client_id: "dummy", // 客户端 ID；这里是桥接场景里的占位值，不是像 Google 那样的真实应用 ID
          client_secret: process.env.NEXTAUTH_SECRET as string, // 客户端密钥；这里用项目自己的密钥参与校验
        });

        if (!access_token) {
          return null; // token 没换到，登录失败
        }

        // Fetch user info
        const userInfo = await oauthController.userInfo(access_token); // 用 access token 去拿用户资料

        if (!userInfo) {
          return null; // 没拿到用户资料，登录失败
        }

        let existingUser = await prisma.user.findUnique({
          where: { email: userInfo.email }, // 用 SSO 返回的邮箱去本地数据库找是否已有对应用户
        });

        // user is authorized but doesn't have a Dub account, create one for them
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              id: createId({ prefix: "user_" }), // 创建本地用户 ID
              email: userInfo.email, // 用外部身份系统返回的邮箱创建本地用户
              name: `${userInfo.firstName || ""} ${
                userInfo.lastName || ""
              }`.trim(), // 用外部身份系统返回的名和姓拼成本地用户名
              notificationPreferences: {
                create: {}, // 顺手创建这个用户的通知偏好默认记录
              },
            },
          });
        }

        const { id, name, email, image } = existingUser; // 从本地用户记录里取出后面要返回的字段;

        return {
          id, // 返回给 NextAuth 的用户 ID
          email, // 返回给 NextAuth 的用户邮箱
          name, // 返回给 NextAuth 的用户名
          email_verified: true, // 标记这个邮箱已验证；因为 SSO 身份系统已经完成了身份确认
          image, // 返回用户头像
          // adding profile here so we can access it in signIn callback
          profile: userInfo, // 额外挂上原始外部用户信息，后面的 signIn callback 还会继续用
        };
      },
    }),

    // Sign in with email and password
    CredentialsProvider({
      id: "credentials",
      name: "Dub.co",
      type: "credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          throw new Error("no-credentials");
        }

        const { email, password } = credentials;

        if (!email || !password) {
          throw new Error("no-credentials");
        }

        if (!skipAuthThrottling) {
          const { success } = await ratelimit(5, "1 m").limit(
            `login-attempts:${email}`,
          );

          if (!success) {
            throw new Error("too-many-login-attempts");
          }
        }

        // SSO enforcement check
        const ssoEnforced = await isSamlEnforcedForEmailDomain(email);

        if (ssoEnforced) {
          throw new Error("require-saml-sso");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            passwordHash: true,
            name: true,
            email: true,
            image: true,
            invalidLoginAttempts: true,
            emailVerified: true,
          },
        });

        if (!user || !user.passwordHash) {
          throw new Error("invalid-credentials");
        }

        if (exceededLoginAttemptsThreshold(user)) {
          throw new Error("exceeded-login-attempts");
        }

        const passwordMatch = await validatePassword({
          password,
          passwordHash: user.passwordHash,
        });

        if (!passwordMatch) {
          const exceededLoginAttempts = exceededLoginAttemptsThreshold(
            await incrementLoginAttempts(user),
          );

          if (exceededLoginAttempts) {
            throw new Error("exceeded-login-attempts");
          } else {
            throw new Error("invalid-credentials");
          }
        }

        if (!user.emailVerified) {
          throw new Error("email-not-verified");
        }

        // Reset invalid login attempts
        await prisma.user.update({
          where: { id: user.id },
          data: {
            invalidLoginAttempts: 0,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),

    // Framer
    {
      id: "framer", // 这个 provider 的唯一标识。
      name: "Framer", //通常给 UI 或日志看。
      type: "oauth", //它告诉 NextAuth：  这个 provider 要按 OAuth 流程处理。
      clientId: process.env.FRAMER_CLIENT_ID, // 你的 Framer 应用的客户端 ID
      clientSecret: process.env.FRAMER_CLIENT_SECRET, // 你的 Framer 应用的客户端密钥
      checks: ["state"], //  OAuth 流程中的安全检查
      authorization: {
        //去哪个地址发起授权  带哪些参数
        url: `${FRAMER_API_HOST}/auth/oauth/authorize`,
        params: {
          scope: "email",
          response_type: "code",
        },
      },
      token: `${FRAMER_API_HOST}/auth/oauth/token`, //告诉 NextAuth：  授权成功拿到 code 后 去哪个地址换 access_token
      userinfo: `${FRAMER_API_HOST}/auth/oauth/profile`, //token 拿到后 去哪个地址拿用户资料
      profile({ sub, email, name, picture }) {
        //拿到外部身份系统返回的用户资料后
        //  转成你系统里需要的用户对象格式
        return {
          id: sub,
          name,
          email,
          image: picture,
        };
      },
    },
  ],
  // @ts-ignore
  adapter: CustomPrismaAdapter(prisma), // 负责让 NextAuth 和你的数据库对接。
  session: { strategy: "jwt" }, //用户登录后的“登录状态”。 用户登录成功以后，系统不能每次都让他重新输密码。所以需要有一种“记住你已经登录”的机制。
  // 字段是用来配置 浏览器里保存登录凭证的 cookie 长什么样、怎么发、在哪些域名下生 效。
  cookies: {
    sessionToken: {
      name: `${VERCEL_DEPLOYMENT ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // When working on localhost, the cookie domain must be omitted entirely (https://stackoverflow.com/a/1188145)
        domain: VERCEL_DEPLOYMENT
          ? `.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
          : undefined,
        secure: VERCEL_DEPLOYMENT,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      console.log({ user, account, profile });

      if (!user.email || (await isBlacklistedEmail(user.email))) {
        return false;
      }

      if (user?.lockedAt) {
        return false;
      }

      // If the user is not using SAML, we need to check if SAML is enforced for the email domain
      if (
        account?.provider !== "saml" &&
        account?.provider !== "saml-idp" &&
        account?.provider !== "credentials" // for credentials, we do the check in the CredentialsProvider
      ) {
        const ssoEnforced = await isSamlEnforcedForEmailDomain(user.email);

        if (ssoEnforced) {
          throw new Error("require-saml-sso");
        }
      }

      if (account?.provider === "google" || account?.provider === "github") {
        const userExists = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, name: true, image: true },
        });
        if (!userExists || !profile) {
          return true;
        }
        // if the user already exists via email,
        // update the user with their name and image
        if (userExists && profile) {
          const profilePic =
            profile[account.provider === "google" ? "picture" : "avatar_url"];
          let newAvatar: string | null = null;
          // if the existing user doesn't have an image or the image is not stored in R2
          if (
            (!userExists.image || !isStored(userExists.image)) &&
            profilePic
          ) {
            const { url } = await storage.upload({
              key: `avatars/${userExists.id}`,
              body: profilePic,
            });
            newAvatar = url;
          }
          await prisma.user.update({
            where: { email: user.email },
            data: {
              // @ts-expect-error - this is a bug in the types, `login` is a valid on the `Profile` type
              ...(!userExists.name && { name: profile.name || profile.login }),
              ...(newAvatar && { image: newAvatar }),
            },
          });
        }
      } else if (
        account?.provider === "saml" ||
        account?.provider === "saml-idp"
      ) {
        let samlProfile;

        if (account?.provider === "saml-idp") {
          // @ts-ignore
          samlProfile = user.profile;
          if (!samlProfile) {
            return true;
          }
        } else {
          samlProfile = profile;
        }

        if (!samlProfile?.requested?.tenant) {
          return false;
        }

        const workspace = await prisma.project.findUnique({
          where: {
            id: samlProfile.requested.tenant,
          },
          select: {
            id: true,
            ssoEmailDomain: true,
          },
        });

        if (workspace) {
          const { ssoEmailDomain } = workspace;
          const emailDomain = user.email.split("@")[1];

          // ssoEmailDomain should be required for all SAML enabled workspace
          // this should not happen
          if (!ssoEmailDomain) {
            return false;
          }

          if (
            emailDomain.toLocaleLowerCase() !==
            ssoEmailDomain.toLocaleLowerCase()
          ) {
            return false;
          }

          await Promise.allSettled([
            // add user to workspace
            prisma.projectUsers.upsert({
              where: {
                userId_projectId: {
                  userId: user.id,
                  projectId: workspace.id,
                },
              },
              update: {},
              create: {
                projectId: workspace.id,
                userId: user.id,
              },
            }),
            // delete any pending invites for this user
            prisma.projectInvite.delete({
              where: {
                email_projectId: {
                  email: user.email,
                  projectId: workspace.id,
                },
              },
            }),
          ]);
        }
        // Login with Framer
      } else if (account?.provider === "framer") {
        const userFound = await prisma.user.findUnique({
          where: {
            email: user.email,
          },
          include: {
            accounts: true,
          },
        });

        // account doesn't exist, let the user sign in
        if (!userFound) {
          return true;
        }

        const otherAccounts = userFound?.accounts.filter(
          (account) => account.provider !== "framer",
        );

        // we don't allow account linking for Framer partners
        // so redirect to the standard login page
        if (otherAccounts && otherAccounts.length > 0) {
          throw new Error("framer-account-linking-not-allowed");
        }

        return true;
      }
      return true;
    },
    jwt: async ({
      token,
      user,
      trigger,
    }: {
      token: JWT;
      user: User | AdapterUser | UserProps;
      trigger?: "signIn" | "update" | "signUp";
    }) => {
      if (user) {
        token.user = user;
      }

      // refresh the user's data if they update their name / email
      if (trigger === "update") {
        const refreshedUser = await prisma.user.findUnique({
          where: {
            id: token.sub,
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isMachine: true,
            defaultWorkspace: true,
            defaultPartnerId: true,
          },
        });

        if (refreshedUser) {
          token.user = refreshedUser;
        } else {
          return {};
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      session.user = {
        id: token.sub,
        // @ts-ignore
        ...(token || session).user,
      };
      return session;
    },
  },
  events: {
    async signIn(message) {
      console.log("signIn", message);
      const email = message.user.email as string;
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      });
      if (!user) {
        console.log(
          `User ${message.user.email} not found, skipping welcome workflow...`,
        );
        return;
      }
      // only process new user workflow if the user was created in the last 15s (newly created user)
      if (
        user.createdAt &&
        new Date(user.createdAt).getTime() > Date.now() - 15000
      ) {
        console.log(
          `New user ${user.email} created,  triggering welcome workflow...`,
        );
        waitUntil(
          Promise.allSettled([
            // track lead if dub_id cookie is present
            trackDubLead(user),
            // trigger welcome workflow 45 minutes after the user signed up
            qstash.publishJSON({
              url: `${APP_DOMAIN_WITH_NGROK}/api/cron/welcome-user`,
              delay: 45 * 60,
              body: { userId: user.id },
            }),
          ]),
        );
      }

      // lazily backup user avatar to R2
      const currentImage = message.user.image;
      if (currentImage && !isStored(currentImage)) {
        waitUntil(
          (async () => {
            const { url } = await storage.upload({
              key: `avatars/${message.user.id}`,
              body: currentImage,
            });
            await prisma.user.update({
              where: {
                id: message.user.id,
              },
              data: {
                image: url,
              },
            });
          })(),
        );
      }

      // Complete any outstanding program applications
      if (message.user.email) {
        waitUntil(completeProgramApplications(message.user.email));
      }
    },
  },
};
