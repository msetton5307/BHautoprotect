# Lead Webhook Posting Specs

Use this endpoint to send partner leads into the backend.

## Endpoint

- **Method:** `POST`
- **URL:** `/webhooks/leads`
- **Auth header:** `X-Lead-Secret: <LEAD_WEBHOOK_SECRET>`
- **Content-Type:** `application/json`

## Required partner fields

These values are validated when partner payload fields are present:

- `lsid` = `2959`
- `lcid` = `11564`
- `key` = `UL8F3w61Igfm`

Additional required fields for this partner format:

- `email`
- `fname`
- `lname`
- `zip`
- `homephone`
- `model_year`
- `make`
- `mileage`
- `xxTrustedFormCertUrl`
- `ip`
- `source_url`
- `universal_leadid`

Optional:

- `subid1`, `subid2`, `subid3`
- `model`

## Field mapping in backend

- `fname` → lead `firstName`
- `lname` → lead `lastName`
- `homephone` → lead `phone`
- `source_url` → lead `source`
- `subid1` (fallback to `universal_leadid`) → lead `subId`
- `model_year` → vehicle `year`
- `make` → vehicle `make`
- `model` → vehicle `model`
- `mileage` → vehicle `odometer`
- Full request body is stored in lead `rawPayload`

## Example request

```bash
curl -X POST "https://<your-domain>/webhooks/leads" \
  -H "Content-Type: application/json" \
  -H "X-Lead-Secret: <LEAD_WEBHOOK_SECRET>" \
  -d '{
    "lsid": 2959,
    "lcid": 11564,
    "key": "UL8F3w61Igfm",
    "subid1": "click-123",
    "subid2": "adgroup-a",
    "subid3": "creative-7",
    "email": "001@mailroot.net",
    "fname": "admtest",
    "lname": "admtest",
    "zip": "92705",
    "homephone": "3233565980",
    "model_year": "2006",
    "make": "Ford",
    "model": "Escape XLT",
    "mileage": 70000,
    "xxTrustedFormCertUrl": "https://cert.trustedform.com/bd1234",
    "ip": "8.8.4.4",
    "source_url": "https://yoursite.com/form",
    "universal_leadid": "lead-token-abc"
  }'
```

## Response

- `201` on success: `{ "ok": true, "id": "<lead_id>" }`
- `400` for validation failures
- `401` when `X-Lead-Secret` is missing/invalid
- `429` for rate limiting
- `503` when webhook is not configured (`LEAD_WEBHOOK_SECRET` missing)
