# FaceMassage.net

Next.js application for face massage booking with GDPR compliance features.

## Features

- 📅 **Booking System**: Google Calendar integration for appointment scheduling
- 👥 **Multi-Master Support**: Separate calendars and schedules for multiple beauty masters
- 🛡️ **GDPR Compliance**: Data export, erasure, and consent management.
- 🔒 **Security**: Turnstile protection, rate limiting, data masking
- 🌙 **Dark/Light Theme**: Automatic theme switching with localStorage persistence.
- 📱 **Mobile Responsive**: Optimized for all device sizes
- ✨ **Smooth Animations**: Framer Motion transitions with reduced motion support.
- 💬 **Support System**: Secure contact form with N8N integration

## Setup

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Google Services
GOOGLE_APPLICATION_CREDENTIALS_JSON=<service_account_json_or_base64>

# Master 1 (Olga) - Default
GOOGLE_CALENDAR_ID=<olga_calendar_id>
GOOGLE_SHEET_ID=<olga_procedures_sheet_id>

# Master 2 (Yuliia)
GOOGLE_CALENDAR_ID_YULIIA=<yuliia_calendar_id>
GOOGLE_SHEET_ID_YULIIA=<yuliia_procedures_sheet_id>

# Shared Consent Tracking
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

### Multi-Master Configuration

The application supports multiple beauty masters, each with their own:
- Google Calendar for bookings
- Google Sheet for procedures and schedule
- Dedicated URL route (`/olga`, `/yuliia`)
- Separate cache entries for data isolation

#### Adding a New Master

1. **Update Configuration** (`src/config/masters.ts`):
   ```typescript
   export const MASTERS = {
     olga: { id: 'olga', name: 'Olga', avatar: '/photo_master_olga.png' },
     yuliia: { id: 'yuliia', name: 'Yuliia', avatar: '/photo_master_yuliia.png' },
     // Add new master here
   }
   ```

2. **Add Environment Variables**:
   ```bash
   GOOGLE_CALENDAR_ID_NEWMASTER=<calendar_id>
   GOOGLE_SHEET_ID_NEWMASTER=<sheet_id>
   ```

3. **Update Server Config** (`src/config/masters.server.ts`):
   Add case for new master in `getMasterCalendarId()` and `getMasterSheetId()`

4. **Add Master Photo**:
   Place photo in `/public/photo_master_<name>.png`

#### Master Selection Flow

1. User visits landing page (`/`)
2. Selects master from photo cards
3. Selection saved to localStorage
4. Redirects to master-specific page (`/[masterId]`)
5. All API calls include `masterId` parameter

#### Cache Strategy

Each master has isolated cache entries:
- `procedures:v2:olga` vs `procedures:v2:juli`
- `availability:olga:...` vs `availability:juli:...`
- Switching masters doesn't invalidate other master's cache
- Prefetching on landing page for instant loading

### Google Sheets Setup

#### Procedures & Exceptions Sheets

- **PROCEDURES**: include `Name`, `Duration`, optional `Category` (`All`/`Osteo`/`Cosmet`/`Massage`/blank) and `Availability` (checkbox). Only rows with `Availability` = true are exposed in `/api/procedures`.
- **EXCEPTIONS**: `Notes` column acts as a category gate. `All` or empty allows all procedures; a specific value (`Osteo`, `Cosmet`, `Massage`) allows booking only for that category on that date.
- Procedures with an empty `Category` are treated as `All` and are blocked on category-restricted exception days (e.g., day = `Osteo`).
- Day and procedure caches now use the updated `v2` keys to reflect the new filtering rules.

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
