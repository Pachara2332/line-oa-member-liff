# LINE OA Member LIFF

Customer-facing membership registration for a LINE Official Account. The app
opens through LIFF, identifies each LINE user securely, remembers returning
members, tracks registration sources, and provides member coupons.

This repository intentionally contains no admin dashboard. A separate dashboard
can connect to the same PostgreSQL database or use the integration APIs.

## Features

- LIFF member registration form
- Secure LINE user ID lookup from a server-verified ID token
- Returning member restore flow based on LINE user ID
- QR and Rich Menu source tracking through `?source=SOURCE_CODE`
- Scan records before and after registration conversion
- Member tagging by brand and acquisition source
- Coupon list, claim, and redemption flow
- LINE Messaging API follow webhook with signature verification
- Brand integration APIs for sources, members, audiences, coupons, and claims
- Local demo mode for browser testing without LINE Login

## How member identity works

LINE returns a stable user ID in the ID token as `sub`. The backend verifies the
ID token with LINE and saves this value as `Member.lineUserId`.

When a registered user opens the LIFF app again:

1. LIFF obtains a fresh ID token.
2. The frontend calls `POST /api/liff/member`.
3. The backend verifies the token with LINE.
4. The backend finds the member by `brandId` and `lineUserId`.
5. The app restores the member screen and previously claimed coupons.

The browser does not need to keep the UUID or member state after the LIFF window
is closed.

## Profile autofill

The registration form uses profile fields from the decoded LINE ID token when
LINE provides them:

| Field | Availability |
| --- | --- |
| Display name | Available with the `profile` scope |
| Email | Available when the LIFF app has the `email` scope and the user grants permission |
| Phone number | Requires approved LINE Profile+ access and the `phone` scope |
| Birth date | Requires approved LINE Profile+ access and the `birthdate` scope |

Phone number and birth date are not available from a normal LIFF configuration.
Without LINE Profile+ approval, users must enter them manually.

## Requirements

- Node.js and npm
- PostgreSQL
- A LINE Developers provider
- A LINE Login channel with a LIFF app
- A Messaging API channel under the same provider if follow events or LINE
  audiences are needed

Keep the LINE Login channel and Messaging API channel under the same provider.
LINE assigns the same user ID across channel types only when the provider is the
same.

## Environment variables

Copy `.env.example` to `.env` and update the values:

```env
DATABASE_URL="postgresql://postgres:your-password@localhost:5432/line_oa_member_liff"
SESSION_SECRET="replace-with-at-least-32-random-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_LIFF_ID=""
NEXT_PUBLIC_ALLOW_DEMO_LIFF="true"
LINE_LIFF_CHANNEL_ID=""
LINE_LOGIN_CHANNEL_ID=""
LINE_LOGIN_CHANNEL_SECRET=""
LINE_MESSAGING_CHANNEL_SECRET=""
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=""
INTEGRATION_API_KEY=""
ALLOW_DEMO_LIFF="true"
```

Important variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Signs scan and member tokens |
| `NEXT_PUBLIC_APP_URL` | Base URL used while seeding QR sources |
| `NEXT_PUBLIC_LIFF_ID` | LIFF ID such as `1234567890-AbCdEfGh` |
| `LINE_LIFF_CHANNEL_ID` | LINE Login channel ID used to verify ID tokens |
| `NEXT_PUBLIC_ALLOW_DEMO_LIFF` | Allows browser demo mode on the frontend |
| `ALLOW_DEMO_LIFF` | Allows demo identities on the backend |

Set both demo flags to `false` in production.

## Local setup

1. Create a PostgreSQL database named `line_oa_member_liff`.
2. Copy `.env.example` to `.env`.
3. Update `DATABASE_URL`.
4. Install dependencies and prepare the database:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open a seeded demo source:

```text
http://localhost:3000/join?source=CAN-A-001&demo=1
http://localhost:3000/join?source=SOCIAL-001&demo=1
```

The `demo=1` parameter bypasses LINE Login for local browser testing only.

## LINE Developers setup

1. Create or open a LINE Login channel.
2. Add a LIFF app.
3. Set the Endpoint URL:

```text
https://your-domain.example/join
```

4. Enable at least the `openid` and `profile` scopes.
5. Enable `email` if email autofill is needed.
6. Set production environment variables:

```env
NEXT_PUBLIC_APP_URL="https://your-domain.example"
NEXT_PUBLIC_LIFF_ID="YOUR_LIFF_ID"
LINE_LIFF_CHANNEL_ID="YOUR_LINE_LOGIN_CHANNEL_ID"
NEXT_PUBLIC_ALLOW_DEMO_LIFF="false"
ALLOW_DEMO_LIFF="false"
```

7. Change the LINE Login channel status from `Developing` to `Published` before
   releasing the Rich Menu to ordinary users.

While the channel is `Developing`, only channel administrators and testers can
open the LIFF app. Other LINE accounts may receive a `404`.

## Rich Menu and QR links

Use the LIFF URL in Rich Menu actions and QR codes:

```text
https://liff.line.me/YOUR_LIFF_ID?source=ORGANIC
https://liff.line.me/YOUR_LIFF_ID?source=CAN-A-001
https://liff.line.me/YOUR_LIFF_ID?source=SOCIAL-001
```

Do not use the Vercel or application URL directly in a Rich Menu action:

```text
https://your-domain.example/join?source=ORGANIC
```

The application URL is the LIFF Endpoint URL. The `liff.line.me` URL is the
public entry point users should open.

## Production database

`DATABASE_URL` on the hosting platform must point to an online PostgreSQL
database. Do not deploy a `localhost` connection string.

Apply the schema and seed the initial sources:

```bash
npx prisma db push
npm run db:seed
```

The seed creates:

```text
CAN-A-001
SOCIAL-001
ORGANIC
```

## LINE Messaging API webhook

Set `LINE_MESSAGING_CHANNEL_SECRET` using the secret from the Messaging API
channel, not the LINE Login channel. Configure this webhook URL:

```text
https://your-domain.example/api/webhooks/line
```

The app verifies the `x-line-signature` header before accepting follow events.
Follow events do not include a QR source. The app assigns a source tag after the
LIFF flow identifies the member.

## Brand integration API

Set `INTEGRATION_API_KEY`, run `npm run db:seed`, and send the key as:

```text
x-api-key: your-brand-api-key
```

Available endpoints:

```text
GET  /api/integrations/v1/sources
POST /api/integrations/v1/sources
GET  /api/integrations/v1/members
GET  /api/integrations/v1/members/export
GET  /api/integrations/v1/audiences
POST /api/integrations/v1/audiences/sync
GET  /api/integrations/v1/follow-events
GET  /api/integrations/v1/coupons
POST /api/integrations/v1/coupons
GET  /api/integrations/v1/claims
POST /api/integrations/v1/coupons/redeem
```

API keys are stored as SHA-256 hashes. Each key belongs to one brand. The server
derives `brandId` from the key rather than accepting it from the client.

To upload an internal source tag to a LINE Messaging API audience, set
`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` and call:

```json
POST /api/integrations/v1/audiences/sync
{ "tagCode": "source:CAN-A-001" }
```

LINE creates uploaded audiences asynchronously. Check their status in LINE
Official Account Manager before using them for narrowcast.

## Troubleshooting

### The channel owner can open LIFF but other users receive `404`

Publish the LINE Login channel. A channel in `Developing` status is available
only to administrators and testers.

### Rich Menu opens the app but registration fails to load

Confirm that the Rich Menu action uses:

```text
https://liff.line.me/YOUR_LIFF_ID?source=ORGANIC
```

Confirm that the LIFF Endpoint URL uses:

```text
https://your-domain.example/join
```

### The registration screen shows an API or database error

Check the deployed `DATABASE_URL`, apply the Prisma schema, and seed the
`ORGANIC` source.

### Local LIFF login warns that the endpoint does not match

The protocol, domain, port, and path must match the configured LIFF Endpoint URL.
For real LINE Login during local development, expose port `3000` through an HTTPS
tunnel and temporarily configure the LIFF Endpoint URL:

```text
https://your-tunnel.example/join
```

## Production checklist

- Publish the LINE Login channel.
- Configure the LIFF Endpoint URL with `/join`.
- Use `https://liff.line.me/YOUR_LIFF_ID?...` in Rich Menu and QR links.
- Set production database and LINE environment variables.
- Disable both demo mode flags.
- Apply the Prisma schema and seed required sources.
- Configure and verify the LINE Messaging API webhook if used.
- Add rate limiting, audit logs, automated integration tests, and approved
  consent text before a full rollout.
