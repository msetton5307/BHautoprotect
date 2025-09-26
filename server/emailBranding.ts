import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EMAIL_LOGO_FILENAME = "IMG_1498.jpeg";
const EMAIL_LOGO_ALT_TEXT = "BH Auto Protect";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emailLogoPath = path.join(__dirname, "assets", EMAIL_LOGO_FILENAME);

let emailLogoDataUrl: string | null = null;

try {
  if (fs.existsSync(emailLogoPath)) {
    const base64 = fs.readFileSync(emailLogoPath).toString("base64");
    emailLogoDataUrl = `data:image/jpeg;base64,${base64}`;
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

export const getEmailLogoDataUrl = (): string | null => emailLogoDataUrl;

export const renderEmailLogo = (options: RenderEmailLogoOptions = {}): string => {
  const marginBottom = options.marginBottom ?? 16;
  const align = options.align ?? "left";

  if (emailLogoDataUrl) {
    const height = options.height ?? 48;
    const maxWidth = options.maxWidth ?? 220;
    return `<div style="margin-bottom:${marginBottom}px;text-align:${align};"><img src="${emailLogoDataUrl}" alt="${EMAIL_LOGO_ALT_TEXT}" style="display:inline-block;height:${height}px;max-width:${maxWidth}px;width:auto;border-radius:12px;object-fit:contain;" /></div>`;
  }

  const textColor = options.textColor ?? "#ffffff";
  return `<div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;margin-bottom:${marginBottom}px;color:${textColor};text-align:${align};">${EMAIL_LOGO_ALT_TEXT.toUpperCase()}</div>`;
};
