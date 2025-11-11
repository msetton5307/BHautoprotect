import { createSign, randomUUID } from "crypto";

type DocuSignConfig = {
  integrationKey: string;
  userId: string;
  accountId: string;
  authBaseUrl: string;
  basePath: string;
  templateId: string;
  privateKeyPem: string;
};

type DocuSignFieldMap = Record<string, string | null | undefined>;

type DocuSignContractFields = {
  fullName?: DocuSignFieldMap;
  email?: DocuSignFieldMap;
  text?: DocuSignFieldMap;
  numerical?: Record<string, string | number | null | undefined>;
  list?: DocuSignFieldMap;
};

type SendContractOptions = {
  customer: {
    name: string;
    email: string;
  };
  fields: DocuSignContractFields;
};

type DocuSignEnvelopeResponse = {
  envelopeId: string;
  status: string;
};

let cachedConfig: DocuSignConfig | null = null;

const base64UrlEncode = (value: Buffer | string): string => {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const signJwt = (payload: Record<string, unknown>, privateKeyPem: string): string => {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKeyPem);
  const encodedSignature = base64UrlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
};

const readEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value.trim();
};

const decodePrivateKey = (base64Value: string): string => {
  try {
    return Buffer.from(base64Value, "base64").toString("utf8");
  } catch (error) {
    throw new Error("Failed to decode DocuSign private key");
  }
};

const getConfig = (): DocuSignConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const integrationKey = readEnv("DS_INTEGRATION_KEY");
  const userId = readEnv("DS_USER_ID");
  const accountId = readEnv("DS_ACCOUNT_ID");
  const authBaseUrl = readEnv("DS_AUTH_BASE_URL");
  const basePath = readEnv("DS_BASE_PATH");
  const templateId = readEnv("DS_TEMPLATE_ID");
  const privateKeyBase64 = readEnv("DS_PRIVATE_KEY_BASE64");
  const privateKeyPem = decodePrivateKey(privateKeyBase64);

  cachedConfig = {
    integrationKey,
    userId,
    accountId,
    authBaseUrl,
    basePath,
    templateId,
    privateKeyPem,
  };

  return cachedConfig;
};

const createJwtAssertion = (config: DocuSignConfig): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.authBaseUrl,
    scope: "signature impersonation",
    iat: now,
    exp: now + 5 * 60,
  };
  return signJwt(payload, config.privateKeyPem);
};

const requestAccessToken = async (config: DocuSignConfig): Promise<string> => {
  const assertion = createJwtAssertion(config);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(`${config.authBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json().catch(() => null)) as
    | { access_token?: string; error?: string; error_description?: string }
    | null;

  if (!response.ok) {
    const message = data?.error_description ?? data?.error ?? "DocuSign authentication failed";
    throw new Error(message);
  }

  if (!data?.access_token) {
    throw new Error("DocuSign authentication failed");
  }

  return data.access_token;
};

const mapFieldEntries = (fields: DocuSignFieldMap | undefined): Array<{ tabLabel: string; value: string }> => {
  if (!fields) {
    return [];
  }

  const entries: Array<{ tabLabel: string; value: string }> = [];
  for (const [tabLabel, rawValue] of Object.entries(fields)) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }
    const value = String(rawValue).trim();
    if (!value) {
      continue;
    }
    entries.push({ tabLabel, value });
  }
  return entries;
};

const mapNumericEntries = (
  fields: Record<string, string | number | null | undefined> | undefined,
): Array<{ tabLabel: string; value: string }> => {
  if (!fields) {
    return [];
  }
  const entries: Array<{ tabLabel: string; value: string }> = [];
  for (const [tabLabel, rawValue] of Object.entries(fields)) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }
    const value = String(rawValue).trim();
    if (!value) {
      continue;
    }
    entries.push({ tabLabel, value });
  }
  return entries;
};

const buildTabs = (fields: DocuSignContractFields):
  | {
      fullNameTabs?: Array<{ tabLabel: string; value: string }>;
      emailTabs?: Array<{ tabLabel: string; value: string }>;
      textTabs?: Array<{ tabLabel: string; value: string }>;
      numberTabs?: Array<{ tabLabel: string; value: string }>;
      listTabs?: Array<{ tabLabel: string; value: string }>;
    }
  | undefined => {
  const fullNameTabs = mapFieldEntries(fields.fullName);
  const emailTabs = mapFieldEntries(fields.email);
  const textTabs = mapFieldEntries(fields.text);
  const numberTabs = mapNumericEntries(fields.numerical);
  const listTabs = mapFieldEntries(fields.list);

  const tabs: {
    fullNameTabs?: Array<{ tabLabel: string; value: string }>;
    emailTabs?: Array<{ tabLabel: string; value: string }>;
    textTabs?: Array<{ tabLabel: string; value: string }>;
    numberTabs?: Array<{ tabLabel: string; value: string }>;
    listTabs?: Array<{ tabLabel: string; value: string }>;
  } = {};

  if (fullNameTabs.length > 0) {
    tabs.fullNameTabs = fullNameTabs;
  }
  if (emailTabs.length > 0) {
    tabs.emailTabs = emailTabs;
  }
  if (textTabs.length > 0) {
    tabs.textTabs = textTabs;
  }
  if (numberTabs.length > 0) {
    tabs.numberTabs = numberTabs;
  }
  if (listTabs.length > 0) {
    tabs.listTabs = listTabs;
  }

  return Object.keys(tabs).length > 0 ? tabs : undefined;
};

export const sendContractEnvelope = async (
  options: SendContractOptions,
): Promise<DocuSignEnvelopeResponse> => {
  const config = getConfig();
  const accessToken = await requestAccessToken(config);
  const tabs = buildTabs(options.fields);

  const templateRole: Record<string, unknown> = {
    roleName: "Customer",
    name: options.customer.name,
    email: options.customer.email,
  };

  if (tabs) {
    templateRole.tabs = tabs;
  }

  const response = await fetch(`${config.basePath}/v2.1/accounts/${config.accountId}/envelopes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-DocuSign-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      templateId: config.templateId,
      status: "sent",
      templateRoles: [templateRole],
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | { envelopeId?: string; status?: string; message?: string; errorCode?: string }
    | null;

  if (!response.ok) {
    const message = data?.message ?? data?.errorCode ?? "Failed to send DocuSign envelope";
    throw new Error(message);
  }

  return {
    envelopeId: typeof data?.envelopeId === "string" ? data.envelopeId : "",
    status: typeof data?.status === "string" ? data.status : "",
  };
};

export type { DocuSignContractFields, SendContractOptions };
