// Resend 的联系人分组 ID，营销邮件发送时指定这个受众组，对应的收件人就能收到。
export const RESEND_AUDIENCE_ID = "f5ff0661-4234-43f6-b0ca-a3f3682934e3";

// 按邮件类型用不同的发件人地址：
export const VARIANT_TO_FROM_MAP = {
  primary: "Dub.co <system@dub.co>",
  notifications: "Dub.co <notifications@mail.dub.co>",
  marketing: "Steven from Dub.co <steven@ship.dub.co>",
};
