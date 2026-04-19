import { conn } from "@/lib/planetscale/connection";
import { WorkspaceProps } from "@/lib/types";
import { redis } from "@/lib/upstash";
import { after } from "next/server";

// 判断某个 workspace 默认应该进入哪个产品页面。
export const getWorkspaceProduct = async (workspaceSlug: string) => {
  try {
    let workspaceProduct = await redis.get<"program" | "links">(
      `workspace:product:${workspaceSlug}`,
    );
    if (workspaceProduct) {
      return workspaceProduct;
    }

    //  去数据库里查：slug 等于 workspaceSlug 的那个工作区。
    const { rows } =
      (await conn.execute(`SELECT * FROM Project WHERE slug = ?`, [
        workspaceSlug,
      ])) || {};

    //如果数据库查到了工作区记录，就取第一条当作 workspace；如果没查到，就设为 null。
    const workspace =
      rows && Array.isArray(rows) && rows.length > 0
        ? (rows[0] as WorkspaceProps)
        : null;

    workspaceProduct = workspace?.defaultProgramId ? "program" : "links";

    after(async () => {
      await redis.set(`workspace:product:${workspaceSlug}`, workspaceProduct, {
        ex: 60 * 60 * 24 * 30, // cache for 30 days
      });
    });

    return workspaceProduct;
  } catch (error) {
    console.error(
      `Error getting workspace product for ${workspaceSlug}:`,
      error,
    );
    return "links"; // fallback to links if there's an error
  }
};
