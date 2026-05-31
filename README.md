# LINE OA Member LIFF

Customer-facing LINE LIFF project, separated from the admin dashboard.

## Included MVP flow

- LIFF member registration form
- QR source tracking through `/join?source=SOURCE_CODE`
- Separate scan records before registration conversion
- Server-side LINE ID token verification
- Basic coupon list and claim flow
- Internal auto-tagging by brand and QR source
- LINE Messaging API follow webhook with signature verification
- Brand integration APIs for QR sources, coupons, audiences, members and claims
- Coupon redemption API with claim and usage timestamps
- Local demo mode before LINE Developers configuration is available

## Local setup

1. Copy `.env.example` to `.env`.
2. Update `DATABASE_URL` with your PostgreSQL password.
3. Create a PostgreSQL database named `line_oa_member_liff`.
4. Run:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open the seeded examples:

```text
http://localhost:3000/join?source=CAN-A-001
http://localhost:3000/join?source=SOCIAL-001
```

## LINE LIFF setup

For local browser testing without LINE Login, keep
`NEXT_PUBLIC_ALLOW_DEMO_LIFF=true` and `ALLOW_DEMO_LIFF=true`, then add
`demo=1` to the URL:

```text
http://localhost:3000/join?source=CAN-A-001&demo=1
```

Without `demo=1`, the app initializes LIFF and logs the user in through LINE.

### Authentication Flow (Background LINE UUID)

The application implements a seamless LINE Login experience:
1. **Auto-Login:** When opened via LINE OA or a LIFF URL, `liff.init()` securely binds the session without displaying the user's LINE UUID on the frontend.
2. **Registration Form:** The user is presented with a membership form (pre-filled with their LINE display name). 
3. **Secure Submission:** Upon submission, the app securely passes the LINE `idToken` to the backend (`/api/liff/register`).
4. **Backend Verification:** The backend verifies the `idToken` directly with LINE APIs to extract the LINE UUID (`userId` / `sub`), preventing front-end tampering before saving the user's data to the database.

For staging and production:

1. Create a LIFF app in LINE Developers.
2. Set the LIFF endpoint URL to `https://your-domain.example/join`.
3. Set `NEXT_PUBLIC_LIFF_ID` and `LINE_LIFF_CHANNEL_ID`.
4. Set `NEXT_PUBLIC_ALLOW_DEMO_LIFF=false` and `ALLOW_DEMO_LIFF=false`.
5. Generate each QR code with its own LIFF link:

```text
https://liff.line.me/YOUR_LIFF_ID?source=CAN-A-001
https://liff.line.me/YOUR_LIFF_ID?source=SOCIAL-001
```

LINE requires the LIFF endpoint protocol, domain, and port to match the page
that runs `liff.init()`. Do not configure `https://localhost:3000` while running
the Next.js dev server at `http://localhost:3000`.

To test real LINE Login during local development, expose port `3000` through an
HTTPS tunnel and configure the LIFF endpoint with that public URL:

```text
https://your-tunnel.example/join
```

The callback URL under the LINE Login tab is a separate setting. LIFF Login uses
the endpoint URL configured under the LIFF tab.

## LINE Messaging API webhook

Set `LINE_MESSAGING_CHANNEL_SECRET` to the secret from the Messaging API channel,
not the LINE Login channel secret. Configure this webhook URL:

```text
https://your-domain.example/api/webhooks/line
```

The app verifies the `x-line-signature` header before accepting follow events.
QR source tags are assigned when LIFF registration identifies the LINE user.
This is the reliable attribution point because LINE follow events do not include
the QR source.

## Brand integration API

Set `INTEGRATION_API_KEY`, run `npm run db:seed`, and send the key in:

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

API keys are stored as SHA-256 hashes. Each key belongs to one brand, and the
server derives `brandId` from the key rather than accepting it from the client.

To upload an internal source tag to a LINE Messaging API audience, set
`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` and call:

```json
POST /api/integrations/v1/audiences/sync
{ "tagCode": "source:CAN-A-001" }
```

LINE creates uploaded audiences asynchronously. Check their status in LINE
Official Account Manager before using them for narrowcast.

## Dashboard integration

This project intentionally has no admin pages. Connect the separate dashboard
to the same PostgreSQL database, or expose tenant-aware admin APIs from a
backend service. The key records for reporting are `QrScan`, `Member`,
`Coupon`, and `CouponClaim`.

Before production rollout, add rate limiting, outbound webhook retries, audit
logs, consent text approved by the business, automated integration tests, and
database row-level security if brands share the same database.
