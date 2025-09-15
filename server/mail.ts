import net from "node:net";
import tls from "node:tls";
import os from "node:os";

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
): Promise<SmtpResponse> => {
  const expectedCodes = Array.isArray(expected) ? expected : [expected];
  socket.write(`${command}\r\n`);
  const response = await waitForResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`Unexpected SMTP response (${response.code}) for command "${command}": ${response.message}`);
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
  await sendCommand(socket, Buffer.from(smtpUser, "utf8").toString("base64"), 334);
  await sendCommand(socket, Buffer.from(smtpPass, "utf8").toString("base64"), 235);
};

const dotStuff = (value: string): string => {
  return value.replace(/(^|\n)\./g, "$1..");
};

const normalizeNewlines = (value: string): string => value.replace(/\r?\n/g, "\n");

const buildDataBlock = (options: MailRequestResolved): string => {
  const headers: string[] = [];
  headers.push(`From: ${options.from}`);
  headers.push(`To: ${options.to.join(", ")}`);
  if (options.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`);
  }
  headers.push(`Subject: ${options.subject}`);
  headers.push("MIME-Version: 1.0");

  if (options.html) {
    headers.push("Content-Type: text/html; charset=UTF-8");
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
  }

  headers.push("Content-Transfer-Encoding: 7bit");
  const headerBlock = headers.join("\r\n");

  const bodyContent = options.html ?? options.text;
  const normalized = normalizeNewlines(bodyContent);
  const stuffed = dotStuff(normalized);
  const withCrlf = stuffed.replace(/\n/g, "\r\n");
  return `${headerBlock}\r\n\r\n${withCrlf}\r\n.`;
};

type MailRequestResolved = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type MailRequest = {
  from?: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
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
  };

  let socket: SmtpSocket | undefined;
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

    await sendCommand(socket, "QUIT", 221);
  } finally {
    if (socket) {
      socket.end();
    }
  }
}
