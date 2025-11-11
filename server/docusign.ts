import { createSign, randomUUID } from "crypto";
import dotenv from "dotenv";

// ✅ Ensure .env is loaded when backend runs
dotenv.config({ path: "/var/www/app/.env" });

type TabClass<T> = {
  constructFromObject(data: Record<string, unknown>): T;
};

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
  traceToken?: string | null;
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
  // ✅ Debug log for environment variable presence
  console.log("🔍 DS_INTEGRATION_KEY:", process.env.DS_INTEGRATION_KEY);

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
  const audience = new URL(config.authBaseUrl).host;
  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: audience,
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

const mapFieldEntries = (
  fields: DocuSignFieldMap | undefined,
): Array<{ tabLabel: string; value: string }> => {
  if (!fields) {
    return [];
  }

  const entries: Array<{ tabLabel: string; value: string }> = [];
  for (const [tabLabel, rawValue] of Object.entries(fields)) {
    if (rawValue === null || rawValue === undefined) continue;
    const value = String(rawValue).trim();
    if (!value) continue;
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
    if (rawValue === null || rawValue === undefined) continue;
    const value = String(rawValue).trim();
    if (!value) continue;
    entries.push({ tabLabel, value });
  }
  return entries;
};

const buildTabs = (fields: DocuSignContractFields):
  | {
      fullNameTabs?: Array<{ tabLabel: string; value: string }>;
      emailTabs?: Array<{ tabLabel: string; value: string }>;
      textTabs?: Array<{ tabLabel: string; value: string }>;
      numericalTabs?: Array<{ tabLabel: string; value: string }>;
      listTabs?: Array<{ tabLabel: string; value: string }>;
    }
  | undefined => {
  const fullNameTabs = mapFieldEntries(fields.fullName);
  const emailTabs = mapFieldEntries(fields.email);
  const textTabs = mapFieldEntries(fields.text);
  const numberTabs = mapNumericEntries(fields.numerical);
  const listTabs = mapFieldEntries(fields.list);

  const tabs: Record<string, unknown> = {};
  if (fullNameTabs.length > 0) tabs.fullNameTabs = fullNameTabs;
  if (emailTabs.length > 0) tabs.emailTabs = emailTabs;
  if (textTabs.length > 0) tabs.textTabs = textTabs;
  if (numberTabs.length > 0) tabs.numericalTabs = numberTabs;
  if (listTabs.length > 0) tabs.listTabs = listTabs;

  return Object.keys(tabs).length > 0 ? (tabs as any) : undefined;
};

const mapEntriesToTabs = <T>(
  entries: Array<{ tabLabel: string; value: string }>,
  TabCtor: TabClass<T>,
): T[] => {
  return entries.map(({ tabLabel, value }) => {
    try {
      return TabCtor.constructFromObject({ tabLabel, value });
    } catch {
      return { tabLabel, value } as unknown as T;
    }
  });
};

type DocuSignTabFactory = {
  Tabs: TabClass<Record<string, unknown>>;
  PrefillTabs: TabClass<Record<string, unknown>>;
  FullName: TabClass<unknown>;
  Email: TabClass<unknown>;
  Text: TabClass<unknown>;
  Numerical: TabClass<unknown>;
  List: TabClass<unknown>;
};

let docuSignFactoriesPromise: Promise<DocuSignTabFactory | null> | null = null;

const resolveDocuSignFactories = async (): Promise<DocuSignTabFactory | null> => {
  if (!docuSignFactoriesPromise) {
    docuSignFactoriesPromise = (async () => {
      try {
        const mod = await import("docusign-esign");
        const client = mod.default ?? mod;
        const factories: Partial<DocuSignTabFactory> = {
          Tabs: client.Tabs,
          PrefillTabs: client.PrefillTabs,
          FullName: client.FullName,
          Email: client.Email,
          Text: client.Text,
          Numerical: client.Numerical ?? client.Number,
          List: client.List,
        };

        const hasAllFactories = Object.values(factories).every(Boolean);
        return hasAllFactories ? (factories as DocuSignTabFactory) : null;
      } catch (error) {
        console.warn("DocuSign SDK is not available, falling back to raw payload tabs", error);
        return null;
      }
    })();
  }

  return docuSignFactoriesPromise;
};

const buildRecipientAndPrefillTabs = async (
  fields: DocuSignContractFields,
): Promise<{
  recipientTabs?: Record<string, unknown>;
  prefillTabs?: Record<string, unknown>;
}> => {
  const tabs = buildTabs(fields);
  if (!tabs) return {};

  const factories = await resolveDocuSignFactories();
  if (!factories) {
    return { recipientTabs: tabs, prefillTabs: tabs };
  }

  const recipientTabs: Record<string, unknown> = {};
  const prefillTabs: Record<string, unknown> = {};

  if (tabs.fullNameTabs) {
    const v = mapEntriesToTabs(tabs.fullNameTabs, factories.FullName);
    recipientTabs.fullNameTabs = v;
    prefillTabs.fullNameTabs = v;
  }
  if (tabs.emailTabs) {
    const v = mapEntriesToTabs(tabs.emailTabs, factories.Email);
    recipientTabs.emailTabs = v;
    prefillTabs.emailTabs = v;
  }
  if (tabs.textTabs) {
    const v = mapEntriesToTabs(tabs.textTabs, factories.Text);
    recipientTabs.textTabs = v;
    prefillTabs.textTabs = v;
  }
  if (tabs.numericalTabs) {
    const v = mapEntriesToTabs(tabs.numericalTabs, factories.Numerical);
    recipientTabs.numericalTabs = v;
    prefillTabs.numericalTabs = v;
  }
  if (tabs.listTabs) {
    const v = mapEntriesToTabs(tabs.listTabs, factories.List);
    recipientTabs.listTabs = v;
    prefillTabs.listTabs = v;
  }

  const buildWithFactory = (factory: TabClass<Record<string, unknown>>, val: Record<string, unknown>) => {
    try {
      return factory.constructFromObject(val);
    } catch {
      return val;
    }
  };

  return {
    recipientTabs: Object.keys(recipientTabs).length ? buildWithFactory(factories.Tabs, recipientTabs) : undefined,
    prefillTabs: Object.keys(prefillTabs).length ? buildWithFactory(factories.PrefillTabs, prefillTabs) : undefined,
  };
};

export const sendContractEnvelope = async (
  options: SendContractOptions,
): Promise<DocuSignEnvelopeResponse> => {
  const config = getConfig();
  const accessToken = await requestAccessToken(config);
  const { recipientTabs, prefillTabs } = await buildRecipientAndPrefillTabs(options.fields);

  const templateRole: Record<string, unknown> = {
    roleName: "Customer",
    name: options.customer.name,
    email: options.customer.email,
  };

  if (recipientTabs) {
    templateRole.tabs = recipientTabs;
  }

  const url = `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes`;
  const payload = {
    templateId: config.templateId,
    status: "sent",
    emailSubject: "Please sign your agreement",
    templateRoles: [templateRole],
    prefillTabs,
  };

  const serializeForLog = (v: unknown): unknown => {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return { error: "Failed to serialize" };
    }
  };

  console.info("DocuSign API request", {
    url,
    templateId: config.templateId,
    customer: options.customer,
    hasRecipientTabs: Boolean(recipientTabs),
    hasPrefillTabs: Boolean(prefillTabs),
    payload: serializeForLog(payload),
  });

  let response: Response | null = null;
  let responseText: string | null = null;
  try {
    console.log("[DEBUG] DocuSign payload:", JSON.stringify(payload, null, 2));
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-DocuSign-Idempotency-Key": `${Date.now()}-${options.customer.email}`,
      },
      body: JSON.stringify(payload),
    });
    responseText = await response.text();
    console.log("[DEBUG] DocuSign response:", response.status, responseText);
  } catch (error) {
    console.error("DocuSign API network error", { url, templateId: config.templateId, customer: options.customer, error });
    throw error;
  }

  if (!response) throw new Error("DocuSign API response is missing");

  const data = (() => {
    if (!responseText) return null;
    try {
      return JSON.parse(responseText) as {
        envelopeId?: string;
        status?: string;
        message?: string;
        errorCode?: string;
      };
    } catch {
      return null;
    }
  })();

  const traceToken = response.headers.get("x-docusign-trace-token");

  const responseLog = {
    url,
    status: response.status,
    ok: response.ok,
    traceToken: traceToken ?? undefined,
    body: serializeForLog(data ?? responseText),
  };

  if (!response.ok) {
    console.error("DocuSign API response error", responseLog);
    const message = data?.message ?? data?.errorCode ?? `Failed to send DocuSign envelope (status ${response.status})`;
    throw new Error(message);
  }

  console.info("DocuSign API response", responseLog);

  return {
    envelopeId: typeof data?.envelopeId === "string" ? data.envelopeId : "",
    status: typeof data?.status === "string" ? data.status : "",
    traceToken,
  };
};

export type { DocuSignContractFields, SendContractOptions };
