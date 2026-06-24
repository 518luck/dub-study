import { isBlacklistedDomain } from "@/lib/edge-config";
import { verifyFolderAccess } from "@/lib/folder/permissions";
import { checkIfUserExists, getRandomKey } from "@/lib/planetscale";
import { isNotHostedImage } from "@/lib/storage";
import { NewLinkProps, ProcessedLinkProps } from "@/lib/types";
import { prisma } from "@dub/prisma";
import { Project, WorkspaceRole } from "@dub/prisma/client";
import {
  DUB_DOMAINS,
  UTMTags,
  constructURLFromUTMParams,
  getApexDomain,
  getDomainWithoutWWW,
  getUrlFromString,
  isDubDomain,
  isValidUrl,
  parseDateTime,
  pluralize,
} from "@dub/utils";
import { combineTagIds } from "../tags/combine-tag-ids";
import { businessFeaturesCheck, proFeaturesCheck } from "./plan-features-check";
import { keyChecks, processKey } from "./utils";

// ============================================================
// processLink —— 创建/更新短链的核心校验层（纯函数，不写库）
// ------------------------------------------------------------
// 职责：把用户提交的原始 payload 按多维规则一一校验、规范化，
//       返回"可直接落库"的 link 对象；任一校验失败就返回错误。
//
// 设计哲学：
//   · 纯函数（只读，不写库）→ create / update / upsert / bulk 都能复用
//   · 多个 skip 开关 → 让 update 场景跳过不必要的查重
//   · 返回判别联合类型 → 下游能类型安全地 narrow
//
// 调用关系：POST /api/links → processLink → createLink
// ============================================================
export async function processLink<T extends Record<string, any>>({
  payload,                          // 用户提交的原始数据
  workspace,                        // 当前 workspace（匿名创建时为 undefined）
  userId,                           // 当前用户 id（匿名创建时不传）
  bulk = false,                     // 是否批量创建（批量场景会跳过部分校验）
  skipKeyChecks = false,            // 跳过 key 查重（编辑且 key 不变时用）
  skipExternalIdChecks = false,     // 跳过 externalId 查重（编辑且 externalId 不变时用）
  skipFolderChecks = false,         // 跳过 folder 权限校验（update / upsert 时用）
  skipProgramChecks = false,        // 跳过 program 校验（program 已被上游校验过时用）
}: {
  payload: NewLinkProps & T;
  workspace?: Pick<Project, "id" | "plan"> & {
    users: { role: WorkspaceRole }[];
  };
  userId?: string;
  bulk?: boolean;
  skipKeyChecks?: boolean;
  skipExternalIdChecks?: boolean;
  skipFolderChecks?: boolean;
  skipProgramChecks?: boolean;
}): Promise<
  | {
      link: NewLinkProps & T;
      error: string;
      code?: string;
      status?: number;
    }
  | {
      link: ProcessedLinkProps & T;
      error: null;
      code?: never;
      status?: never;
    }
> {
  // ----------------------------------------------------------
  // ① 解构 payload：取出所有可能用到的字段
  // 用 let 是因为后面会被规范化后重新赋值
  // ----------------------------------------------------------
  let {
    domain,
    key,
    keyLength,
    url,
    image,
    proxy,
    trackConversion,
    expiredUrl,
    tagNames,
    folderId,
    externalId,
    tenantId,
    partnerId,
    programId,
    webhookIds,
    testVariants,
  } = payload;

  // 日期字段单独取出（要被 parseDateTime 校验/转换）
  let expiresAt: string | Date | null | undefined = payload.expiresAt;
  let testCompletedAt: string | Date | null | undefined =
    payload.testCompletedAt;

  let defaultProgramFolderId: string | null = null;
  // 合并 tagIds + tagNames → 统一成 tagIds 数组（后续统一校验）
  const tagIds = combineTagIds(payload);

  // ----------------------------------------------------------
  // ② URL 校验 + UTM 参数合并
  //   · url 必须合法（自动补 https:// 前缀）
  //   · UTMTags 任一字段出现 → 把 utm_* 合并到 url 的 query 里
  //   · 例外：key === "_root"（根域名）允许 url 为空
  // ----------------------------------------------------------
  if (url) {
    url = getUrlFromString(url);
    if (!isValidUrl(url)) {
      return {
        link: payload,
        error: "Invalid destination URL",
        code: "unprocessable_entity",
      };
    }

    // Process UTM params only if the key exists, allowing null/empty to clear them.
    if (UTMTags.some((tag) => tag in payload)) {
      const utmParams = UTMTags.reduce((acc, tag) => {
        if (tag in payload) {
          acc[tag] = payload[tag];
        }
        return acc;
      }, {});
      url = constructURLFromUTMParams(url, utmParams);
    }
    // only root domain links can have empty desintation URL
  } else if (key !== "_root") {
    return {
      link: payload,
      error: "Missing destination URL",
      code: "bad_request",
    };
  }

  // ----------------------------------------------------------
  // ③ 套餐功能限制（free / pro / business 三档）
  //   · free：禁止给根域名设跳转；同时跑 pro + business 检查
  //   · pro：只跑 business 检查（business 字段在 pro 不可用）
  //   · business+：无检查
  //   两个 check 函数遇到禁用字段会抛错，这里捕获并转成错误返回
  // ----------------------------------------------------------
  // free plan restrictions
  if (!workspace || workspace.plan === "free") {
    if (key === "_root" && url) {
      return {
        link: payload,
        error:
          "You can only set a redirect for a root domain link on a Pro plan and above. Upgrade to Pro to use this feature.",
        code: "forbidden",
      };
    }
    try {
      businessFeaturesCheck(payload);
      proFeaturesCheck(payload);
    } catch (error) {
      return {
        link: payload,
        error: error.message,
        code: "forbidden",
      };
    }
  } else if (workspace.plan === "pro") {
    try {
      businessFeaturesCheck(payload);
    } catch (error) {
      return {
        link: payload,
        error: error.message,
        code: "forbidden",
      };
    }
  }

  // ----------------------------------------------------------
  // ④ A/B 测试依赖：要开 A/B 测试必须先开转化追踪
  // testVariants 是 A/B 测试的分流配置，没开转化追踪就无意义
  // ----------------------------------------------------------
  if (!trackConversion && testVariants) {
    return {
      link: payload,
      error: "Conversion tracking must be enabled to use A/B testing.",
      code: "unprocessable_entity",
    };
  }

  // ----------------------------------------------------------
  // ⑤ 拉取 workspace 下所有域名（后续多项校验需要）
  // 匿名创建时 workspace 为 undefined → domains 为空数组
  // ----------------------------------------------------------
  const domains = workspace
    ? await prisma.domain.findMany({
        where: { projectId: workspace.id },
      })
    : [];

  // 用户没传 domain → 用 workspace 的主域名；都没有则兜底 dub.sh
  // if domain is not defined, set it to the workspace's primary domain
  if (!domain) {
    domain = domains?.find((d) => d.primary)?.slug || "dub.sh";
  }

  // ----------------------------------------------------------
  // ⑥ 域名权限分级校验（4 种情况分支）
  //   a) dub.sh / dub.link：Dub 官方公共域名
  //   b) 其它 Dub 自营域（chatg.pt、spti.fi 等）：URL 必须在白名单
  //   c) 自定义域：必须属于当前 workspace
  //   d) .link 免费域名：免费套餐不可用
  // ----------------------------------------------------------
  // checks for dub.sh and dub.link links
  if (domain === "dub.sh" || domain === "dub.link") {
    // dub.link 需要 Pro+ 套餐
    // for dub.link: check if workspace plan is pro+
    if (domain === "dub.link" && (!workspace || workspace.plan === "free")) {
      return {
        link: payload,
        error:
          "You can only use dub.link on a Pro plan and above. Upgrade to Pro to use this domain.",
        code: "forbidden",
      };
    }

    // dub.sh 带 userId 时校验用户是否还存在（防止会话失效后乱建链）
    // for dub.sh: check if user exists (if userId is passed)
    if (domain === "dub.sh" && userId) {
      const userExists = await checkIfUserExists(userId);
      if (!userExists) {
        return {
          link: payload,
          error: "Session expired. Please log in again.",
          code: "not_found",
        };
      }
    }

    // 公共域名必须做恶意链接检测（防钓鱼/防滥用）
    const isMaliciousLink = await maliciousLinkCheck(url);
    if (isMaliciousLink) {
      return {
        link: payload,
        error: "Malicious URL detected",
        code: "unprocessable_entity",
      };
    }
    // checks for other Dub-owned domains (chatg.pt, spti.fi, etc.)
  } else if (isDubDomain(domain)) {
    // 其它 Dub 自营域有 allowedHostnames 白名单（比如 chatg.pt 只能跳 chatgpt.com）
    // coerce type with ! cause we already checked if it exists
    const { allowedHostnames } = DUB_DOMAINS.find((d) => d.slug === domain)!;
    const urlDomain = getDomainWithoutWWW(url) || "";
    const apexDomain = getApexDomain(url);
    if (
      key !== "_root" &&
      allowedHostnames &&
      !allowedHostnames.includes(urlDomain) &&
      !allowedHostnames.includes(apexDomain)
    ) {
      return {
        link: payload,
        error: `Invalid destination URL. You can only create ${domain} short links for URLs with the ${pluralize("domain", allowedHostnames.length)} ${allowedHostnames
          .map((d) => `"${d}"`)
          .join(", ")}.`,
        code: "unprocessable_entity",
      };
    }

    // 子目录短链（key 含 /）：必须有父级 link 的归属权
    // 例如要建 chatg.pt/github/repo，必须先拥有 chatg.pt/github
    if (!skipKeyChecks && key?.includes("/")) {
      // check if the workspace has access to the parent link
      const parentKey = key.split("/")[0];
      const parentLink = await prisma.link.findUnique({
        where: { domain_key: { domain, key: parentKey } },
      });
      if (parentLink?.projectId !== workspace?.id) {
        return {
          link: payload,
          error: `You do not have access to create links in the ${domain}/${parentKey}/ subdirectory.`,
          code: "forbidden",
        };
      }
    }

    // 自定义域：必须属于当前 workspace
    // else, check if the domain belongs to the workspace
  } else if (!domains?.find((d) => d.slug === domain)) {
    return {
      link: payload,
      error: "Domain does not belong to workspace.",
      code: "forbidden",
    };

    // Dub 提供的免费 .link 域名：免费套餐不可用
    // else, check if the domain is a free .link and whether the workspace is pro+
  } else if (domain.endsWith(".link") && workspace?.plan === "free") {
    // Dub provisioned .link domains can only be used on a Pro plan and above
    const domainId = domains?.find((d) => d.slug === domain)?.id;
    const registeredDomain = await prisma.registeredDomain.findUnique({
      where: {
        domainId,
      },
    });
    if (registeredDomain) {
      return {
        link: payload,
        error:
          "You can only use your free .link domain on a Pro plan and above. Upgrade to Pro to use this domain.",
        code: "forbidden",
      };
    }
  }

  // ----------------------------------------------------------
  // ⑦ Key 生成 + 规范化 + 冲突检测
  //   · 用户没传 key → getRandomKey 自动生成（避免与已存在的 key 冲突）
  //   · 用户传了 key → processKey 规范化（Punycode、保留字过滤）→ keyChecks 查重
  //   · skipKeyChecks=true 时跳过查重（编辑场景 key 不变）
  // ----------------------------------------------------------
  if (!key) {
    key = await getRandomKey({
      domain,
      prefix: payload["prefix"],
      length: keyLength,
    });
  } else if (!skipKeyChecks) {
    const processedKey = processKey({ domain, key });
    if (processedKey === null) {
      return {
        link: payload,
        error: "Invalid key.",
        code: "unprocessable_entity",
      };
    }
    key = processedKey;

    // keyChecks 会查 PlanetScale 边缘节点，确认 (domain, key) 没被占用
    const response = await keyChecks({ domain, key, workspace });
    if (response.error && response.code) {
      return {
        link: payload,
        error: response.error,
        code: response.code,
      };
    }
  }

  // ----------------------------------------------------------
  // ⑧ externalId 唯一性校验（仅 workspace 内）
  // externalId 是用户自定义的外部 ID，用于和自己的系统对接
  // 靠 (projectId, externalId) 复合唯一索引保证唯一
  // ----------------------------------------------------------
  if (externalId && workspace && !skipExternalIdChecks) {
    const link = await prisma.link.findUnique({
      where: {
        projectId_externalId: {
          projectId: workspace.id,
          externalId,
        },
      },
    });

    if (link) {
      return {
        link: payload,
        error: "A link with this externalId already exists in this workspace.",
        code: "conflict",
      };
    }
  }

  // ----------------------------------------------------------
  // ⑨ 单条 vs 批量：分叉处理（bulk=true 跳过这部分校验）
  //   · 批量：禁止上传自定义 OG 图片（性能考虑，R2 上传是异步的）
  //   · 单条：依次校验 tag / folder / program / webhook 四种关联资源
  //           （批量场景这些校验在 route 层统一做）
  // ----------------------------------------------------------
  if (bulk) {
    if (proxy && image && isNotHostedImage(image)) {
      return {
        link: payload,
        error:
          "You cannot upload custom link preview images with bulk link creation.",
        code: "unprocessable_entity",
      };
    }
  } else {
    // --------------------------------------------------------
    // ⑨-a tag 校验：tagIds 或 tagNames 必须属于当前 workspace
    // 两种传参方式：直接传 id 数组，或传 name 数组（会反向查 id）
    // --------------------------------------------------------
    // only perform tag validity checks if:
    // - not bulk creation (we do that check separately in the route itself)
    // - tagIds are present
    if (tagIds && tagIds.length > 0) {
      if (!workspace) {
        return {
          link: payload,
          error:
            "Workspace not found. You can't add tags to a link without a workspace.",
          code: "not_found",
        };
      }
      const tags = await prisma.tag.findMany({
        select: {
          id: true,
        },
        where: { projectId: workspace.id, id: { in: tagIds } },
      });

      if (tags.length !== tagIds.length) {
        return {
          link: payload,
          error:
            "Invalid tagIds detected: " +
            tagIds
              .filter(
                (tagId) => tags.find(({ id }) => tagId === id) === undefined,
              )
              .join(", "),
          code: "unprocessable_entity",
        };
      }
    } else if (tagNames && tagNames.length > 0) {
      if (!workspace) {
        return {
          link: payload,
          error:
            "Workspace not found. You can't add tags to a link without a workspace.",
          code: "not_found",
        };
      }

      const tags = await prisma.tag.findMany({
        select: {
          name: true,
        },
        where: {
          projectId: workspace.id,
          name: { in: tagNames },
        },
      });

      if (tags.length !== tagNames.length) {
        return {
          link: payload,
          error:
            "Invalid tagNames detected: " +
            tagNames
              .filter(
                (tagName) =>
                  tags.find(({ name }) => tagName === name) === undefined,
              )
              .join(", "),
          code: "unprocessable_entity",
        };
      }
    }

    // --------------------------------------------------------
    // ⑨-b folder 校验：folder 必须属于 workspace + 用户有写权限
    //   · 需要 Pro+ 套餐
    //   · 用 verifyFolderAccess 做 RBAC（检查 folders.links.write 权限）
    // --------------------------------------------------------
    // only perform folder validity checks if:
    // - not bulk creation (we do that check separately in the route itself)
    // - folderId is present and we're not skipping folder checks
    if (folderId && !skipFolderChecks) {
      if (!workspace || !userId) {
        return {
          link: payload,
          error:
            "Workspace or user ID not found. You can't add a folder to a link without a workspace or user ID.",
          code: "not_found",
        };
      }

      if (workspace.plan === "free") {
        return {
          link: payload,
          error: "You can't add a folder to a link on a free plan.",
          code: "forbidden",
        };
      }

      try {
        await verifyFolderAccess({
          workspace,
          userId,
          folderId,
          requiredPermission: "folders.links.write",
        });
      } catch (error) {
        return {
          link: payload,
          error: error.message,
          code: error.code,
        };
      }
    }

    // --------------------------------------------------------
    // ⑨-c program 校验：合作伙伴计划归属（affiliate 业务）
    //   · program 必须属于当前 workspace
    //   · 如果没传 partnerId 但传了 tenantId，用 tenantId 反查 partner
    //   · 把 program 的 defaultFolderId 记下来（后面默认归类用）
    // --------------------------------------------------------
    // Program validity checks
    if (programId && !skipProgramChecks) {
      const program = await prisma.program.findUnique({
        where: { id: programId },
        select: {
          workspaceId: true,
          defaultFolderId: true,
          ...(!partnerId && tenantId
            ? {
                partners: {
                  where: {
                    tenantId,
                  },
                },
              }
            : {}),
        },
      });

      if (!program || program.workspaceId !== workspace?.id) {
        return {
          link: payload,
          error: "Program not found.",
          code: "not_found",
        };
      }

      if (!partnerId) {
        partnerId =
          program?.partners?.length > 0 ? program.partners[0].partnerId : null;
      }

      defaultProgramFolderId = program.defaultFolderId;
    }

    // --------------------------------------------------------
    // ⑨-d webhook 校验：webhook 必须属于 workspace + Business+ 套餐
    //   · webhookIds 先去重，避免重复触发
    //   · 全部 webhook 必须能在当前 workspace 查到
    // --------------------------------------------------------
    // Webhook validity checks
    if (webhookIds && webhookIds.length > 0) {
      if (!workspace || workspace.plan === "free" || workspace.plan === "pro") {
        return {
          link: payload,
          error:
            "You can only use webhooks on a Business plan and above. Upgrade to Business to use this feature.",
          code: "forbidden",
        };
      }

      // 去重：用 Set 把重复的 webhookId 过滤掉
      webhookIds = [...new Set(webhookIds)];

      const webhooks = await prisma.webhook.findMany({
        select: {
          id: true,
        },
        where: { projectId: workspace?.id, id: { in: webhookIds } },
      });

      if (webhooks.length !== webhookIds.length) {
        const invalidWebhookIds = webhookIds.filter(
          (webhookId) =>
            webhooks.find(({ id }) => webhookId === id) === undefined,
        );

        return {
          link: payload,
          error: "Invalid webhookIds detected: " + invalidWebhookIds.join(", "),
          code: "unprocessable_entity",
        };
      }
    }
  }

  // ----------------------------------------------------------
  // ⑩ 图片代理校验：开启 proxy 时必须有 R2 凭证
  // STORAGE_SECRET_ACCESS_KEY 是 Cloudflare R2 的密钥
  // ----------------------------------------------------------
  // custom social media image checks (see if R2 is configured)
  if (proxy && !process.env.STORAGE_SECRET_ACCESS_KEY) {
    return {
      link: payload,
      error: "Missing storage access key.",
      code: "bad_request",
    };
  }

  // ----------------------------------------------------------
  // ⑪ 过期时间 + 过期跳转 URL 校验
  //   · expiresAt 必须是合法日期（parseDateTime 会做解析）
  //   · 如果配了 expiredUrl，也要是合法 URL
  // ----------------------------------------------------------
  // expire date checks
  if (expiresAt) {
    const datetime = parseDateTime(expiresAt);

    if (!datetime) {
      return {
        link: payload,
        error: "Invalid expiration date.",
        code: "unprocessable_entity",
      };
    }

    // 解析成功后用规范化后的 datetime 覆盖原值（可能是 string → Date）
    expiresAt = datetime;

    if (expiredUrl) {
      expiredUrl = getUrlFromString(expiredUrl);

      if (!isValidUrl(expiredUrl)) {
        return {
          link: payload,
          error: "Invalid expired URL.",
          code: "unprocessable_entity",
        };
      }
    }
  }

  // ----------------------------------------------------------
  // ⑫ A/B 测试结束时间校验（同 ⑪ 的日期校验逻辑）
  // ----------------------------------------------------------
  if (testCompletedAt) {
    const datetime = parseDateTime(testCompletedAt);

    if (!datetime) {
      return {
        link: payload,
        error: "Invalid test completion date.",
        code: "unprocessable_entity",
      };
    }

    testCompletedAt = datetime;
  }

  // ----------------------------------------------------------
  // ⑬ 清理 polyfill 字段（这些只用于前端展示，不能写库）
  //   · shortLink / qrCode：是计算字段，由 domain+key 推导
  //   · keyLength / prefix：只在 key 生成时用一次，用完即丢
  //   · utm_*：已经合并进 url 的 query，不能重复存
  // ----------------------------------------------------------
  // remove polyfill attributes from payload
  delete payload["shortLink"];
  delete payload["qrCode"];
  delete payload["keyLength"];
  delete payload["prefix"];
  UTMTags.forEach((tag) => {
    delete payload[tag];
  });

  // ----------------------------------------------------------
  // ⑭ 返回加工后的 link（成功路径）
  //   合并所有规范化后的字段，并强制注入：
  //   · partnerId：来自 payload 或 program 反查
  //   · projectId：绑定当前 workspace（匿名创建为 null）
  //   · userId：仅在传入时设置（编辑场景不覆盖原值）
  //   · folderId：用户传的优先，否则用 program 的默认 folder
  // ----------------------------------------------------------
  return {
    link: {
      ...payload,
      domain,
      key,
      // we're redefining these fields because they're processed in the function
      url,
      expiresAt,
      expiredUrl,
      testVariants,
      testCompletedAt,
      // partnerId derived from payload or program enrollment
      partnerId: partnerId || null,
      // make sure projectId is set to the current workspace
      projectId: workspace?.id || null,
      // if userId is passed, set it (we don't change the userId if it's already set, e.g. when editing a link)
      ...(userId && {
        userId,
      }),
      ...(webhookIds && {
        webhookIds,
      }),
      folderId: folderId || defaultProgramFolderId,
    },
    error: null,
  };
}

// ============================================================
// maliciousLinkCheck —— 恶意链接检测
// ------------------------------------------------------------
// 仅用于 dub.sh / dub.link 这种 Dub 公共域名（自定义域名不查）。
// 原因：公共域名的滥用会牵连整个 Dub 服务声誉，自定义域名由
//       workspace 所有者自己负责。
// 实现：调 isBlacklistedDomain → 查 Edge Config 维护的域名黑名单。
// ============================================================
async function maliciousLinkCheck(url: string) {
  // 先从 URL 提取主域名（去掉 www、path、query）
  const domain = getDomainWithoutWWW(url);

  // 提不出域名（比如 URL 格式异常）→ 不算恶意，直接放行
  if (!domain) {
    return false;
  }

  // 查 Edge Config 黑名单（这是 Vercel 边缘同步的 KV，读取极快）
  const domainBlacklisted = await isBlacklistedDomain(domain);
  if (domainBlacklisted === true) {
    return true;
  }

  return false;
}
