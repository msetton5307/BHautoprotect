import type { MailAttachment } from "./mail";

const EMAIL_LOGO_URL =
  "https://bhautoprotect.com/uploads/branding/logo-1758137821844.png";
const EMAIL_LOGO_ALT_TEXT = "BH Auto Protect";

type RenderEmailLogoOptions = {
  textColor?: string;
  marginBottom?: number;
  align?: "left" | "center" | "right";
  height?: number;
  maxWidth?: number;
};

export const getEmailBrandingAttachments = (): MailAttachment[] => {
  return [];
};

export const hasEmailLogoAsset = (): boolean => EMAIL_LOGO_URL.length > 0;

export const getEmailLogoUrl = (): string => EMAIL_LOGO_URL;

export const renderEmailLogo = (options: RenderEmailLogoOptions = {}): string => {
  const marginBottom = options.marginBottom ?? 16;
  const align = options.align ?? "left";

  if (EMAIL_LOGO_URL) {
    const height = options.height ?? 48;
    const maxWidth = options.maxWidth ?? 220;
    return `<div style="margin-bottom:${marginBottom}px;text-align:${align};"><img src="${EMAIL_LOGO_URL}" alt="${EMAIL_LOGO_ALT_TEXT}" style="display:inline-block;height:${height}px;max-width:${maxWidth}px;width:auto;border-radius:12px;object-fit:contain;" /></div>`;
  }

  const textColor = options.textColor ?? "#ffffff";
  return `<div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;margin-bottom:${marginBottom}px;color:${textColor};text-align:${align};">${EMAIL_LOGO_ALT_TEXT.toUpperCase()}</div>`;
};
