import { extractEmailDomain } from "./email/extract-email-domain";
// generic 公共
//这是一个“精确匹配列表”。  如果邮箱域名刚好等于这里面的某一个，就认定它是公共邮箱。
const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "ymail.com",
  "icloud.com",
  "aol.com",
  "comcast.net",
  "verizon.net",
  "att.net",
  "me.com",
  "mac.com",
  "msn.com",
  "live.com",
  "live.dk",
  "web.de",
  "protonmail.com",
  "proton.me",
  "passinbox.com",
  "163.com",
  "duck.com",
  "qq.com",
  "zoho.com",
  "fastmail.com",
  "tutanota.com",
  "tuta.com",
  "privaterelay.appleid.com",
  "qyver.online",
  "naver.com",
  "yeah.net",
  "example.com",
  "wp.pl",
  "seznam.cz",
  "myyahoo.com",
  "mail.com",
  "mail.ru",
  "email.cz",
  "email.de",
  "t-online.de",
];
//如果域名是以这些前缀开头，也认定为公共邮箱。
const GENERIC_EMAIL_DOMAIN_PREFIXES = [
  "yahoo.",
  "hotmail.",
  "outlook.",
  "gmx.",
  "yandex.",
];

// 这个邮箱是不是公共邮箱/通用邮箱，而不是公司自定义邮箱。
export const isGenericEmail = (email: string) => {
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) {
    return false;
  }

  return (
    GENERIC_EMAIL_DOMAINS.includes(emailDomain) ||
    // some 是数组方法,只要数组有至少一个元素满足条件,就返回 true, 否则返回 false
    GENERIC_EMAIL_DOMAIN_PREFIXES.some((prefix) =>
      emailDomain.startsWith(prefix),
    )
  );
};
