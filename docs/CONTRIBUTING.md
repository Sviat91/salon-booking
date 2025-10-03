# Contributing to FaceMassage.net

## Development Workflow

### Git Workflow

1. **Create a feature branch** for any changes:
   ```bash
   git checkout -b feature/your-feature-name
   git checkout -b fix/bug-description
   git checkout -b refactor/component-name
   ```

2. **Make commits with clear messages**:
   ```bash
   git commit -m "feat: add new booking feature"
   git commit -m "fix: resolve calendar date issue"
   git commit -m "refactor: split BookingForm component"
   ```

3. **Run tests before committing**:
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Push and create Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Standards

### File Organization

- **Maximum file length**: 500 lines of code
- **Organize by feature**: Group related components, hooks, and utilities
- **Consistent naming**: Use kebab-case for files, PascalCase for components

### Code Quality

- Use TypeScript strict mode
- No `any` types without justification
- Implement proper error handling
- Follow existing code patterns
- Add JSDoc comments for public functions

### Testing

Tests should live in `/tests` folder mirroring the main app structure.

**Minimum test coverage per function**:
- 1 test for expected use case
- 1 edge case test
- 1 failure case test

Run tests:
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test -- --coverage # Coverage report
```

## GDPR Utilities

### Administrative Scripts Location

All GDPR maintenance scripts are located in `/scripts`:

- `consent-cli.ts` - Main CLI tool for consent management
- `inspect-consent.ts` - Inspect consent sheet with data masking
- `debug-find-consent.js` - Find specific user consent
- `debug-dates.js` - Test date parsing from Google Sheets
- `test-withdraw.js` - Test consent withdrawal API

### Using GDPR Scripts

#### Prerequisites

1. Ensure `.env` file exists with Google Sheets credentials
2. Install dependencies: `npm install`

#### Consent Management CLI

**Show sheet structure**:
```bash
npx tsx scripts/consent-cli.ts header
```

**Find user consent**:
```bash
npx tsx scripts/consent-cli.ts show "48501234567" "Jan Kowalski" "jan@example.com"
```

**Withdraw consent**:
```bash
npx tsx scripts/consent-cli.ts withdraw "48501234567" "Jan Kowalski" "jan@example.com"
```

**Add test consent** (development only):
```bash
npx tsx scripts/consent-cli.ts append "48501234567" "Jan Kowalski" "jan@example.com" "127.0.0.1"
```

#### Debug Scripts

**Inspect consent sheet** (with data masking):
```bash
npx tsx scripts/inspect-consent.ts
```

**Test date parsing**:
```bash
node scripts/debug-dates.js
```

**Find specific consent**:
Edit `scripts/debug-find-consent.js` with test data, then run:
```bash
node scripts/debug-find-consent.js
```

**Test withdrawal API**:
Edit `scripts/test-withdraw.js` with test data, then run:
```bash
node scripts/test-withdraw.js
```

### GDPR Compliance Notes

⚠️ **Important**:
- Never commit real user data to git
- Always use data masking when logging
- Test GDPR operations in staging first
- Backup Google Sheets before running bulk operations
- Follow GDPR retention policies

### Google Sheets Structure

User consents are stored with the following columns:

| Column | Index | Name | Type |
|--------|-------|------|------|
| A | 0 | phone | String (normalized) |
| B | 1 | email | String |
| C | 2 | name | String |
| D | 3 | consent_date | DateTime |
| E | 4 | ip_hash | String (masked) |
| F | 5 | consent_privacy_v1.0 | Boolean |
| G | 6 | consent_terms_v1.0 | Boolean |
| H | 7 | consent_notifications_v1.0 | Boolean |
| I | 8 | consent_withdrawn_date | DateTime |
| J | 9 | withdrawal_method | String |
| K | 10 | request_erasure_date | DateTime |
| L | 11 | erasure_date | DateTime |
| M | 12 | erasure_method | String |

## Project Structure

```
facemassage.net/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Business logic and utilities
│   └── styles/           # Global styles
├── tests/                # Test files (mirrors src structure)
├── scripts/              # Administrative and debug scripts
├── docs/                 # Documentation
└── public/               # Static assets
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Google Services
GOOGLE_APPLICATION_CREDENTIALS_JSON=<service_account_json>
GOOGLE_CALENDAR_ID=<calendar_id>
GOOGLE_SHEET_ID=<procedures_sheet_id>
USER_CONSENTS_GOOGLE_SHEET_ID=<consent_sheet_id>

# Redis Cache
UPSTASH_REDIS_REST_URL=<redis_url>
UPSTASH_REDIS_REST_TOKEN=<redis_token>

# Security
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<turnstile_site_key>
TURNSTILE_SECRET_KEY=<turnstile_secret>
```

## Deployment Checklist

Before deploying to production:

- [ ] All tests pass (`npm run test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables configured
- [ ] Google Sheets structure verified
- [ ] GDPR endpoints tested in staging
- [ ] Monitoring alerts configured

## Getting Help

- Check existing documentation in `/docs`
- Review similar code patterns in the codebase
- Ask questions in pull request comments
- Consult GDPR-TESTING.md for GDPR-specific testing

## Code Review Guidelines

When reviewing code:

- Verify tests are included
- Check for proper error handling
- Ensure TypeScript types are correct
- Validate GDPR compliance for data operations
- Confirm no console.log in production code
- Review bundle size impact for client components
