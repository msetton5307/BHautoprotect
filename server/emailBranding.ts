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
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
};

export const getEmailBrandingAttachments = (): MailAttachment[] => {
  return [];
};

export const hasEmailLogoAsset = (): boolean => EMAIL_LOGO_URL.length > 0;

export const getEmailLogoUrl = (): string => EMAIL_LOGO_URL;

export const renderEmailLogo = (options: RenderEmailLogoOptions = {}): string => {
  const marginBottom = options.marginBottom ?? 16;
  const align = options.align ?? "left";
  const backgroundColor = options.backgroundColor;
  const padding = options.padding ?? (backgroundColor ? 12 : 0);
  const borderRadius = options.borderRadius ?? (backgroundColor ? 16 : 12);
  const borderColor = options.borderColor;
  const borderWidth = options.borderWidth ?? (borderColor ? 1 : 0);

  const outerStyle = `margin-bottom:${marginBottom}px;text-align:${align};`;

  if (EMAIL_LOGO_URL) {
    const height = options.height ?? 48;
    const maxWidth = options.maxWidth ?? 220;
    const imageStyles = [
      "display:block",
      `height:${height}px`,
      `max-width:${maxWidth}px`,
      "width:auto",
      "object-fit:contain",
    ];

    if (!backgroundColor && borderRadius > 0) {
      imageStyles.push(`border-radius:${borderRadius}px`);
    }

    const imageMarkup = `<img src="${EMAIL_LOGO_URL}" alt="${EMAIL_LOGO_ALT_TEXT}" style="${imageStyles.join(";")}" />`;

    if (backgroundColor || padding > 0 || borderWidth > 0) {
      const wrapperStyles = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        `border-radius:${borderRadius}px`,
      ];

      if (backgroundColor) {
        wrapperStyles.push(`background:${backgroundColor}`);
      }

      if (padding > 0) {
        wrapperStyles.push(`padding:${padding}px`);
      }

      if (borderWidth > 0 && borderColor) {
        wrapperStyles.push(`border:${borderWidth}px solid ${borderColor}`);
      }

      return `<div style="${outerStyle}"><span style="${wrapperStyles.join(";")}">${imageMarkup}</span></div>`;
    }

    return `<div style="${outerStyle}">${imageMarkup}</div>`;
  }

  const textColor = options.textColor ?? "#ffffff";
  const fallbackStyles = [
    "display:inline-block",
    "font-size:12px",
    "letter-spacing:0.28em",
    "text-transform:uppercase",
    "opacity:0.7",
    `color:${textColor}`,
    `border-radius:${borderRadius}px`,
  ];

  if (backgroundColor) {
    fallbackStyles.push(`background:${backgroundColor}`);
  }

  if (padding > 0) {
    fallbackStyles.push(`padding:${padding}px`);
  }

  if (borderWidth > 0 && borderColor) {
    fallbackStyles.push(`border:${borderWidth}px solid ${borderColor}`);
  }

  return `<div style="${outerStyle}"><span style="${fallbackStyles.join(";")}">${EMAIL_LOGO_ALT_TEXT.toUpperCase()}</span></div>`;
};
