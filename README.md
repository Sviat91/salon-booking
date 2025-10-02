# FaceMassage.net

Next.js application for face massage booking with GDPR compliance features.

## Features

- 📅 **Booking System**: Google Calendar integration for appointment scheduling
- 🛡️ **GDPR Compliance**: Data export, erasure, and consent management
- 🔒 **Security**: Turnstile protection, rate limiting, data masking
- 🌙 **Dark/Light Theme**: Automatic theme switching with localStorage persistence
- 📱 **Mobile Responsive**: Optimized for all device sizes
- 💬 **Support System**: Secure contact form with N8N integration

## Setup

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Google Services
GOOGLE_APPLICATION_CREDENTIALS_JSON=<service_account_json_or_base64>
GOOGLE_CALENDAR_ID=<calendar_id>
GOOGLE_SHEET_ID=<procedures_sheet_id>
USER_CONSENTS_GOOGLE_SHEET_ID=<consent_tracking_sheet_id>

# Redis Cache (Upstash)
UPSTASH_REDIS_REST_URL=<redis_url>
UPSTASH_REDIS_REST_TOKEN=<redis_token>

# Security
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<turnstile_site_key>
TURNSTILE_SECRET_KEY=<turnstile_secret>

# Optional
SENTRY_DSN=<sentry_dsn>
N8N_WEBHOOK_URL=<n8n_support_webhook_url>
N8N_SECRET_TOKEN=<n8n_bearer_token>
```

### Google Sheets Setup

#### User Consents Sheet Structure

Create a Google Sheet with the following columns:

| Column | Index | Name | Type | Description |
|--------|-------|------|------|-------------|
| A | 0 | `phone` | String | Normalized phone number |
| B | 1 | `email` | String | User email address |
| C | 2 | `name` | String | Full name |
| D | 3 | `consent_date` | DateTime | When consent was given |
| E | 4 | `ip_hash` | String | Masked IP address |
| F | 5 | `consent_privacy_v1.0` | Boolean | Privacy consent |
| G | 6 | `consent_terms_v1.0` | Boolean | Terms consent |
| H | 7 | `consent_notifications_v1.0` | Boolean | Marketing consent |
| I | 8 | `consent_withdrawn_date` | DateTime | When withdrawn |
| J | 9 | `withdrawal_method` | String | How withdrawn |
| K | 10 | `request_erasure_date` | DateTime | Erasure requested |
| L | 11 | `erasure_date` | DateTime | Data actually erased |
| M | 12 | `erasure_method` | String | How data was erased |

### N8N Support Integration

Configure N8N workflow to receive support messages:

1. Create HTTP webhook trigger in N8N
2. Set webhook URL in `N8N_WEBHOOK_URL`
3. Generate secure token for `N8N_SECRET_TOKEN`
4. Process payload:
   ```json
   {
     "name": "User Name",
     "email": "user@email.com", 
     "subject": "booking|technical|privacy|other",
     "message": "Support message",
     "metadata": {
       "ip": "masked_ip",
       "userAgent": "browser_info",
       "timestamp": "iso_date",
       "requestId": "unique_id"
     }
   }
   ```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test
npm run test:watch

# Build for production
npm run build
npm start
```

### Administrative Scripts

The `/scripts` folder contains GDPR maintenance utilities:

#### Consent Management CLI
```bash
# Show consent sheet header and first rows
npx tsx scripts/consent-cli.ts header

# Find user consent by phone and name
npx tsx scripts/consent-cli.ts show <phone> <name> [email]

# Withdraw user consent
npx tsx scripts/consent-cli.ts withdraw <phone> <name> [email]

# Append test consent (debug only)
npx tsx scripts/consent-cli.ts append <phone> <name> [email] [ip]
```

#### Debug Scripts
```bash
# Inspect consent sheet with data masking
npx tsx scripts/inspect-consent.ts

# Find specific user consent
node scripts/debug-find-consent.js

# Test date parsing from Google Sheets
node scripts/debug-dates.js

# Test consent withdrawal API
node scripts/test-withdraw.js
```

**Note**: These scripts require `.env` file with Google Sheets credentials.

## GDPR Features

### Data Export
Users can export their personal data via `/support` page:
- All consent history
- Personal information
- Download as CSV or JSON
- Automatic filename generation

### Data Erasure  
Secure data deletion with audit trail:
- Anonymizes phone numbers (SHA256 hash)
- Clears name and email
- Preserves consent dates for compliance
- Records erasure method and timestamp

### Consent Withdrawal
Revoke marketing permissions:
- Sets consent flags to FALSE  
- Records withdrawal date and method
- Maintains data for legal compliance

## API Endpoints

- `POST /api/consents/export` - Export user data
- `POST /api/consents/erase` - Delete user data
- `POST /api/consents/withdraw` - Withdraw consents
- `POST /api/support/contact` - Submit support message

All endpoints include:
- Rate limiting (Redis)
- Turnstile validation
- Input validation (Zod)
- Error logging (Sentry)

## Security

- **Rate Limiting**: Per-IP and per-endpoint limits
- **Data Masking**: Phone numbers and emails in logs
- **Input Validation**: Strict schemas for all inputs  
- **CSRF Protection**: Turnstile verification
- **Secure Headers**: Next.js security defaults
- **Token Protection**: N8N tokens never exposed to client

## Testing

```bash
# Unit tests
npm run test tests/lib/

# API tests  
npm run test tests/app/api/

# Integration tests
npm run test tests/app/

# Coverage report
npm run test -- --coverage
```

## Deployment

1. Set up environment variables
2. Configure Google Sheets with proper structure
3. Set up N8N workflow for support (optional)
4. Deploy to Vercel/Netlify
5. Test GDPR endpoints in staging
6. Configure monitoring alerts

## Monitoring

Set up alerts for:
- High error rates on GDPR endpoints
- Rate limiting abuse
- N8N webhook failures
- Google Sheets API errors

Monitor metrics:
- Data export requests
- Erasure completion rates
- Support form submissions
- Response times
