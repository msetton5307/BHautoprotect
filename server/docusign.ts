import { createSign } from "crypto";
import dotenv from "dotenv";
dotenv.config();

type DocuSignConfig = {
  integrationKey: string;
  userId: string;
  accountId: string;
  authBaseUrl: string;
  basePath: string;
  templateId: string;
  privateKeyPem: string;
};

type DocuSignContractFields = {
  fullName?: Record<string, string>;
  email?: Record<string, string>;
  text?: Record<string, string>;
  numerical?: Record<string, string | number>;
  list?: Record<string, string>;
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

type DocuSignEnvelopeStatusResponse = {
  envelopeId: string;
  status: string | null;
  statusDateTime: string | null;
  statusChangedDateTime: string | null;
  sentDateTime: string | null;
  completedDateTime: string | null;
};

// --------------------------------------------------------
// Utilities
// --------------------------------------------------------

const base64UrlEncode = (value: Buffer | string): string => {
  const buffer =
    typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
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
  if (!value || value.trim().length === 0)
    throw new Error(`Missing environment variable ${key}`);
  return value.trim();
};

const decodePrivateKey = (base64Value: string): string =>
  Buffer.from(base64Value, "base64").toString("utf8");

const getConfig = (): DocuSignConfig => ({
  integrationKey: readEnv("DS_INTEGRATION_KEY"),
  userId: readEnv("DS_USER_ID"),
  accountId: readEnv("DS_ACCOUNT_ID"),
  authBaseUrl: readEnv("DS_AUTH_BASE_URL"),
  basePath: readEnv("DS_BASE_PATH"),
  templateId: readEnv("DS_TEMPLATE_ID"),
  privateKeyPem: decodePrivateKey(readEnv("DS_PRIVATE_KEY_BASE64")),
});

// --------------------------------------------------------
// JWT Token
// --------------------------------------------------------

const createJwtAssertion = (config: DocuSignConfig): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: new URL(config.authBaseUrl).host,
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

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token)
    throw new Error(data?.error_description || "DocuSign authentication failed");

  return data.access_token;
};

// --------------------------------------------------------
// Main Function
// --------------------------------------------------------

export const sendContractEnvelope = async (
  options: SendContractOptions
): Promise<DocuSignEnvelopeResponse> => {
  const config = getConfig();
  console.log("🔍 DS_INTEGRATION_KEY:", config.integrationKey);

  const accessToken = await requestAccessToken(config);

  // Helper: convert field object to array
  const mapTabs = (obj?: Record<string, string | number>) =>
    obj ? Object.entries(obj).map(([tabLabel, value]) => ({ tabLabel, value })) : [];

  // Helper: convert numerical fields to proper DocuSign format
  const mapNumericalTabs = (obj?: Record<string, string | number>) =>
    obj
      ? Object.entries(obj).map(([tabLabel, value]) => ({
          tabLabel,
          value: String(value),
          numericalValue: Number(value),
        }))
      : [];

  // Split numeric vs text-only numeric-looking fields
  const numericMoneyFields = {
    Premium: options.fields.numerical?.Premium,
    DownPayment: options.fields.numerical?.DownPayment,
    MonthlyPayment: options.fields.numerical?.MonthlyPayment,
    NumberOfPayments: options.fields.numerical?.NumberOfPayments,
    Deductible: options.fields.numerical?.Deductible,
  };

  const numericTextFields = {
    Phone: options.fields.numerical?.Phone,
    Year: options.fields.numerical?.Year,
    Mileage: options.fields.numerical?.Mileage,
    StartMileage: options.fields.numerical?.StartMileage,
    EndMileage: options.fields.numerical?.EndMileage,
  };

  const payload = {
    emailSubject: "Please sign your Vehicle Service Program",
    templateId: config.templateId,
    status: "sent",
    templateRoles: [
      {
        roleName: "Customer",
        name: options.customer.name,
        email: options.customer.email,
        tabs: {
          fullNameTabs: mapTabs(options.fields.fullName),
          emailAddressTabs: mapTabs(options.fields.email),
          textTabs: [
            ...(mapTabs(options.fields.text) || []),
            ...(mapTabs(numericTextFields) || []),
          ],
          numberTabs: [
            { tabLabel: "VIN", value: options.fields.text?.["VIN"] || "" },
          ],
          numericalTabs: mapNumericalTabs(numericMoneyFields),
          listTabs: mapTabs(options.fields.list),
        },
      },
    ],
  };

  console.log("📤 Sending DocuSign payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await response.text();
  console.log("📥 DocuSign response:", response.status, text);

  if (!response.ok)
    throw new Error(`DocuSign error: ${response.statusText} - ${text}`);

  const data = JSON.parse(text);
  return {
    envelopeId: data.envelopeId,
    status: data.status,
    traceToken: response.headers.get("x-docusign-trace-token"),
  };
};

const parseDispositionFileName = (headerValue: string | null): string | null => {
  if (!headerValue) {
    return null;
  }

  const match = /filename\*?=([^;]+)/i.exec(headerValue);
  if (match && match[1]) {
    const value = match[1].trim().replace(/^UTF-8''/, '');
    return value.replace(/"/g, '').split('/').pop() ?? null;
  }

  return null;
};

export const downloadEnvelopeDocuments = async (
  envelopeId: string,
): Promise<{ buffer: Buffer; fileName: string }> => {
  const config = getConfig();
  const accessToken = await requestAccessToken(config);
  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Failed to download DocuSign documents (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fallbackName = `docusign-${envelopeId}.pdf`;
  const fileName = parseDispositionFileName(response.headers.get('content-disposition')) ?? fallbackName;
  return { buffer, fileName };
};

export const fetchEnvelopeStatus = async (
  envelopeId: string,
): Promise<DocuSignEnvelopeStatusResponse> => {
  const config = getConfig();
  const accessToken = await requestAccessToken(config);
  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch DocuSign envelope status (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = await response.json().catch(() => ({}));
  const getString = (key: string): string | null => {
    const value = data?.[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  return {
    envelopeId: getString("envelopeId") ?? envelopeId,
    status: getString("status"),
    statusDateTime: getString("statusDateTime"),
    statusChangedDateTime: getString("statusChangedDateTime"),
    sentDateTime: getString("sentDateTime"),
    completedDateTime: getString("completedDateTime"),
  };
};

export type { DocuSignContractFields, SendContractOptions };
