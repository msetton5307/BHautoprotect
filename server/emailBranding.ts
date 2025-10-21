import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MailAttachment } from "./mail";

const EMAIL_LOGO_FILENAME = "IMG_1498.jpeg";
const EMAIL_LOGO_ALT_TEXT = "BH Auto Protect";
const EMAIL_LOGO_CONTENT_ID = "bh-auto-protect-logo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emailLogoPath = path.join(__dirname, "assets", EMAIL_LOGO_FILENAME);

const resolveContentType = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
};

let emailLogoAttachment: MailAttachment | null = null;

try {
  if (fs.existsSync(emailLogoPath)) {
    const fileBuffer = fs.readFileSync(emailLogoPath);
    emailLogoAttachment = {
      filename: EMAIL_LOGO_FILENAME,
      contentType: resolveContentType(EMAIL_LOGO_FILENAME),
      content: fileBuffer,
      disposition: "inline",
      contentId: EMAIL_LOGO_CONTENT_ID,
    };
  } else {
    console.warn(`Email logo asset not found at ${emailLogoPath}`);
  }
} catch (error) {
  console.warn("Unable to load email logo asset:", error);
}

type RenderEmailLogoOptions = {
  textColor?: string;
  marginBottom?: number;
  align?: "left" | "center" | "right";
  height?: number;
  maxWidth?: number;
};

export const hasEmailLogoAsset = (): boolean => emailLogoAttachment !== null;

export const getEmailLogoCid = (): string => EMAIL_LOGO_CONTENT_ID;

export const getEmailBrandingAttachments = (): MailAttachment[] => {
  return emailLogoAttachment ? [{ ...emailLogoAttachment }] : [];
};

export const renderEmailLogo = (options: RenderEmailLogoOptions = {}): string => {
  const marginBottom = options.marginBottom ?? 16;
  const align = options.align ?? "left";

  if (emailLogoAttachment) {
    const height = options.height ?? 48;
    const maxWidth = options.maxWidth ?? 220;
    return `<div style="margin-bottom:${marginBottom}px;text-align:${align};"><img src="cid:${EMAIL_LOGO_CONTENT_ID}" alt="${EMAIL_LOGO_ALT_TEXT}" style="display:inline-block;height:${height}px;max-width:${maxWidth}px;width:auto;border-radius:12px;object-fit:contain;" /></div>`;
  }

  const textColor = options.textColor ?? "#ffffff";
  return `<div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;margin-bottom:${marginBottom}px;color:${textColor};text-align:${align};">${EMAIL_LOGO_ALT_TEXT.toUpperCase()}</div>`;
};
