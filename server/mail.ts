import net from "node:net";
import tls from "node:tls";
import os from "node:os";
import { randomUUID } from "node:crypto";

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === null) return fallback;
  return /^(true|1|yes|on)$/i.test(value.trim());
};

const smtpHost = process.env.SMTP_HOST;
const smtpPortValue = process.env.SMTP_PORT;
const smtpPort = smtpPortValue ? Number.parseInt(smtpPortValue, 10) : undefined;
const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);
const smtpStartTLS = parseBoolean(process.env.SMTP_STARTTLS, smtpPort === 587 && !smtpSecure);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const smtpClientName = process.env.SMTP_CLIENT_NAME || os.hostname();
const rejectUnauthorized = parseBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

if (!smtpHost || !smtpPort) {
  console.warn(
    "SMTP configuration is incomplete. Set SMTP_HOST and SMTP_PORT to enable transactional email support.",
  );
}

type SmtpSocket = net.Socket | tls.TLSSocket;

type SmtpResponse = {
  code: number;
  message: string;
};

class SmtpCommandError extends Error {
  readonly response: SmtpResponse;
  readonly command: string;
  readonly displayCommand: string;

  constructor(command: string, displayCommand: string, response: SmtpResponse) {
    super(
      `Unexpected SMTP response (${response.code}) for command "${displayCommand}": ${response.message}`,
    );
    this.name = "SmtpCommandError";
    this.command = command;
    this.displayCommand = displayCommand;
    this.response = response;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type SendCommandOptions = {
  label?: string;
  sensitive?: boolean;
};

const waitForResponse = (socket: SmtpSocket): Promise<SmtpResponse> => {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
      socket.off("end", onClose);
      socket.off("timeout", onTimeout);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("SMTP connection timed out"));
    };

    const onClose = () => {
      cleanup();
      reject(new Error(`SMTP connection closed unexpectedly. Partial response: ${buffer}`));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      const lastLine = lines[lines.length - 1];
      if (!/^\d{3} /.test(lastLine)) {
        return;
      }
      cleanup();
      const code = Number.parseInt(lastLine.slice(0, 3), 10);
      resolve({ code, message: buffer });
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
    socket.once("end", onClose);
    socket.once("timeout", onTimeout);
  });
};

const sendCommand = async (
  socket: SmtpSocket,
  command: string,
  expected: number | number[],
  options: SendCommandOptions = {},
): Promise<SmtpResponse> => {
  const expectedCodes = Array.isArray(expected) ? expected : [expected];
  const displayCommand = options.label ?? (options.sensitive ? "<REDACTED>" : command);
  socket.write(`${command}\r\n`);
  const response = await waitForResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new SmtpCommandError(command, displayCommand, response);
  }
  return response;
};

const readGreeting = async (socket: SmtpSocket): Promise<void> => {
  const response = await waitForResponse(socket);
  if (response.code !== 220) {
    throw new Error(`Unexpected SMTP greeting: ${response.message}`);
  }
};

const establishConnection = async (): Promise<SmtpSocket> => {
  if (!smtpHost || !smtpPort) {
    throw new Error("SMTP is not configured");
  }

  const baseSocket = smtpSecure
    ? tls.connect({
        host: smtpHost,
        port: smtpPort,
        servername: smtpHost,
        rejectUnauthorized,
      })
    : net.createConnection({
        host: smtpHost,
        port: smtpPort,
      });

  baseSocket.setTimeout(15000);
  baseSocket.setEncoding("utf8");

  await new Promise<void>((resolve, reject) => {
    baseSocket.once("error", reject);
    baseSocket.once("connect", () => resolve());
    baseSocket.once("secureConnect", () => resolve());
  });

  await readGreeting(baseSocket);
  return baseSocket;
};

const upgradeToTls = async (socket: SmtpSocket): Promise<SmtpSocket> => {
  if (socket instanceof tls.TLSSocket) {
    return socket;
  }

  return await new Promise<SmtpSocket>((resolve, reject) => {
    const tlsSocket = tls.connect({
      socket,
      host: smtpHost,
      servername: smtpHost,
      rejectUnauthorized,
    });
    tlsSocket.setTimeout(15000);
    tlsSocket.setEncoding("utf8");
    tlsSocket.once("error", reject);
    tlsSocket.once("secureConnect", () => resolve(tlsSocket));
  });
};

const performAuthentication = async (socket: SmtpSocket): Promise<void> => {
  if (!smtpUser || !smtpPass) return;
  await sendCommand(socket, "AUTH LOGIN", 334);
  await sendCommand(socket, Buffer.from(smtpUser, "utf8").toString("base64"), 334, {
    label: "AUTH username",
    sensitive: true,
  });
  await sendCommand(socket, Buffer.from(smtpPass, "utf8").toString("base64"), 235, {
    label: "AUTH password",
    sensitive: true,
  });
};

const dotStuff = (value: string): string => {
  return value.replace(/(^|\n)\./g, "$1..");
};

const normalizeNewlines = (value: string): string => value.replace(/\r?\n/g, "\n");

const createBoundary = (label: string): string => {
  const unique = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `${label}-${unique}`;
};

const chunkString = (value: string, size = 76): string => {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks.join("\n");
};

const encodeAttachmentContent = (attachment: MailAttachment): string => {
  if (attachment.encoding === "base64") {
    if (typeof attachment.content === "string") {
      return attachment.content.replace(/\s+/g, "");
    }
    return attachment.content.toString("utf8").replace(/\s+/g, "");
  }

  if (typeof attachment.content === "string") {
    const buffer = Buffer.from(attachment.content, attachment.encoding ?? "utf8");
    return buffer.toString("base64");
  }

  return attachment.content.toString("base64");
};

const buildDataBlock = (options: MailRequestResolved): string => {
  const headers: string[] = [];
  headers.push(`From: ${options.from}`);
  headers.push(`To: ${options.to.join(", ")}`);
  if (options.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`);
  }
  headers.push(`Subject: ${options.subject}`);
  headers.push("MIME-Version: 1.0");
  headers.push(`Date: ${options.sentAt.toUTCString()}`);
  headers.push(`Message-ID: ${options.messageId}`);

  const attachments = (options.attachments ?? []).filter((attachment) => {
    return Boolean(attachment && attachment.contentType && attachment.content !== undefined);
  });

  const hasHtml = typeof options.html === "string" && options.html.length > 0;
  const hasAttachments = attachments.length > 0;
  let bodyContent = "";

  if (hasHtml) {
    const altBoundary = createBoundary("ALT");
    const htmlContent = options.html ?? "";
    if (hasAttachments) {
      const relatedBoundary = createBoundary("REL");
      headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

      const parts: string[] = [];
      parts.push(`--${altBoundary}`);
      parts.push("Content-Type: text/plain; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: 7bit");
      parts.push("");
      parts.push(options.text);
      parts.push("");
      parts.push(`--${altBoundary}`);
      parts.push(`Content-Type: multipart/related; boundary="${relatedBoundary}"`);
      parts.push("");
      parts.push(`--${relatedBoundary}`);
      parts.push("Content-Type: text/html; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: 7bit");
      parts.push("");
      parts.push(htmlContent);
      parts.push("");

      for (const attachment of attachments) {
        parts.push(`--${relatedBoundary}`);
        const nameSegment = attachment.filename ? `; name="${attachment.filename}"` : "";
        parts.push(`Content-Type: ${attachment.contentType}${nameSegment}`);
        parts.push("Content-Transfer-Encoding: base64");
        if (attachment.contentId) {
          parts.push(`Content-ID: <${attachment.contentId}>`);
        }
        const disposition = attachment.disposition ?? (attachment.contentId ? "inline" : "attachment");
        const dispositionSegment = attachment.filename ? `; filename="${attachment.filename}"` : "";
        parts.push(`Content-Disposition: ${disposition}${dispositionSegment}`);
        parts.push("");
        parts.push(chunkString(encodeAttachmentContent(attachment)));
        parts.push("");
      }

      parts.push(`--${relatedBoundary}--`);
      parts.push("");
      parts.push(`--${altBoundary}--`);
      bodyContent = parts.join("\n");
    } else {
      headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      const parts: string[] = [];
      parts.push(`--${altBoundary}`);
      parts.push("Content-Type: text/plain; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: 7bit");
      parts.push("");
      parts.push(options.text);
      parts.push("");
      parts.push(`--${altBoundary}`);
      parts.push("Content-Type: text/html; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: 7bit");
      parts.push("");
      parts.push(htmlContent);
      parts.push("");
      parts.push(`--${altBoundary}--`);
      bodyContent = parts.join("\n");
    }
  } else if (hasAttachments) {
    const mixedBoundary = createBoundary("MIXED");
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    const parts: string[] = [];
    parts.push(`--${mixedBoundary}`);
    parts.push("Content-Type: text/plain; charset=UTF-8");
    parts.push("Content-Transfer-Encoding: 7bit");
    parts.push("");
    parts.push(options.text);
    parts.push("");

    for (const attachment of attachments) {
      parts.push(`--${mixedBoundary}`);
      const nameSegment = attachment.filename ? `; name="${attachment.filename}"` : "";
      parts.push(`Content-Type: ${attachment.contentType}${nameSegment}`);
      parts.push("Content-Transfer-Encoding: base64");
      if (attachment.contentId) {
        parts.push(`Content-ID: <${attachment.contentId}>`);
      }
      const disposition = attachment.disposition ?? "attachment";
      const dispositionSegment = attachment.filename ? `; filename="${attachment.filename}"` : "";
      parts.push(`Content-Disposition: ${disposition}${dispositionSegment}`);
      parts.push("");
      parts.push(chunkString(encodeAttachmentContent(attachment)));
      parts.push("");
    }

    parts.push(`--${mixedBoundary}--`);
    bodyContent = parts.join("\n");
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: 7bit");
    bodyContent = options.text;
  }

  const headerBlock = headers.join("\r\n");
  const normalized = normalizeNewlines(bodyContent);
  const stuffed = dotStuff(normalized);
  const withCrlf = stuffed.replace(/\n/g, "\r\n");
  return `${headerBlock}\r\n\r\n${withCrlf}\r\n.`;
};

export type MailAttachment = {
  filename?: string;
  contentType: string;
  content: Buffer | string;
  encoding?: "base64" | "utf8";
  disposition?: "inline" | "attachment";
  contentId?: string;
};

const createMessageId = (from: string): string => {
  const [, domainCandidate] = from.split("@");
  const domain = domainCandidate?.trim() || smtpHost || "localhost";
  return `<${randomUUID()}@${domain}>`;
};

type MailRequestResolved = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
  messageId: string;
  sentAt: Date;
};

export type MailRequest = {
  from?: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
  messageId?: string;
};

export async function sendMail(request: MailRequest): Promise<void> {
  if (!smtpHost || !smtpPort) {
    throw new Error("SMTP is not configured");
  }
  if (!smtpFrom && !request.from) {
    throw new Error("SMTP_FROM or explicit from address is required to send email");
  }

  const recipients = Array.isArray(request.to)
    ? request.to.map((value) => value.trim()).filter(Boolean)
    : request.to.split(",").map((value) => value.trim()).filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("At least one recipient is required");
  }

  const resolved: MailRequestResolved = {
    from: request.from || smtpFrom!,
    to: recipients,
    subject: request.subject,
    text: request.text,
    html: request.html,
    replyTo: request.replyTo,
    attachments:
      request.attachments && request.attachments.length > 0
        ? [...request.attachments]
        : undefined,
    messageId: request.messageId?.trim() || createMessageId(request.from || smtpFrom!),
    sentAt: new Date(),
  };

  let socket: SmtpSocket | undefined;
  const logContext = {
    to: resolved.to,
    subject: resolved.subject,
    messageId: resolved.messageId,
    attachmentCount: resolved.attachments?.length ?? 0,
  };

  console.info("[mail] Sending email", logContext);

  try {
    socket = await establishConnection();
    const ehloResponse = await sendCommand(socket, `EHLO ${smtpClientName}`, 250);

    const ehloMessage = ehloResponse.message.toUpperCase();
    if (smtpStartTLS && !smtpSecure && ehloMessage.includes('STARTTLS')) {
      await sendCommand(socket, "STARTTLS", 220);
      socket = await upgradeToTls(socket);
      await sendCommand(socket, `EHLO ${smtpClientName}`, 250);
    }

    await performAuthentication(socket);

    await sendCommand(socket, `MAIL FROM:<${resolved.from}>`, 250);

    for (const recipient of resolved.to) {
      try {
        await sendCommand(socket, `RCPT TO:<${recipient}>`, [250, 251]);
      } catch (error) {
        throw new Error(`Failed to add recipient ${recipient}: ${(error as Error).message}`);
      }
    }

    await sendCommand(socket, "DATA", 354);

    const dataBlock = buildDataBlock(resolved);
    socket.write(`${dataBlock}\r\n`);
    const dataResponse = await waitForResponse(socket);
    if (![250].includes(dataResponse.code)) {
      throw new Error(`Unexpected response after DATA: ${dataResponse.message}`);
    }

    console.info("[mail] Email sent", { ...logContext, responseCode: dataResponse.code });

    try {
      await sendCommand(socket, "QUIT", 221);
    } catch (error) {
      console.warn("[mail] Failed to terminate SMTP session after sending email", {
        ...logContext,
        error,
      });
    }
  } catch (error) {
    console.error("[mail] Failed to send email", { ...logContext, error });
    throw error;
  } finally {
    if (socket) {
      socket.end();
    }
  }
}
