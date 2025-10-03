# GDPR Features Testing Guide

## Quick Testing Checklist

### Data Export Feature ✅
- [ ] Open `/support` page
- [ ] Click "Pobierz moje dane" in Quick Actions
- [ ] Fill form with valid data (name, phone, email)
- [ ] Complete Turnstile (if enabled)  
- [ ] Submit and verify success message
- [ ] Test CSV download with meaningful filename
- [ ] Test JSON download with meaningful filename
- [ ] Verify exported data matches Google Sheet
- [ ] Test "not found" error with invalid data
- [ ] Test rate limiting (5 requests per 15 min)

### Data Erasure Feature ✅  
- [ ] Open `/support` page
- [ ] Click "Usuń moje dane" in Quick Actions
- [ ] Fill form and acknowledge deletion
- [ ] Submit and verify success response
- [ ] Check Google Sheet: phone hashed, name/email cleared
- [ ] Verify `erasure_date` and `erasure_method` populated
- [ ] Test repeated request returns "already processed"
- [ ] Test with non-existent user data

### Contact Form ✅
- [ ] Fill out support form on `/support`
- [ ] Test all subject categories
- [ ] Submit and verify success message
- [ ] Check N8N receives webhook (if configured)
- [ ] Test validation errors (empty fields, invalid email)
- [ ] Test rate limiting (3 requests per 15 min)

### Consent Withdrawal ✅
- [ ] Click "Wycofaj zgody" in Quick Actions
- [ ] Fill form with existing user data
- [ ] Submit and verify consent flags set to FALSE
- [ ] Check `withdrawal_date` and `withdrawal_method` recorded

## Manual Testing Scenarios

### Happy Path Testing
```bash
# 1. Create test user consent in Google Sheet
Phone: +48501748708
Name: Test User
Email: test@example.com
Privacy: TRUE
Terms: TRUE

# 2. Test export
curl -X POST http://localhost:3000/api/consents/export \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","phone":"+48501748708","email":"test@example.com","turnstileToken":"dev-token"}'

# 3. Test erasure  
curl -X POST http://localhost:3000/api/consents/erase \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","phone":"+48501748708","consentAcknowledged":true,"turnstileToken":"dev-token"}'
```

### Error Cases
- Invalid phone format: `123` 
- Name too short: `A`
- Missing consent acknowledgment
- Rate limit exceeded
- Non-existent user data

### Security Testing
- [ ] Verify N8N token never exposed in browser
- [ ] Check rate limiting works per IP
- [ ] Confirm phone numbers masked in logs
- [ ] Test Turnstile validation (if enabled)
- [ ] Verify input validation rejects malicious data

## Automated Test Commands

```bash
# Run all GDPR tests
npm test tests/lib/google/exportUserData.test.ts
npm test tests/lib/google/eraseUserData.test.ts  
npm test tests/app/api/consents/export.test.ts
npm test tests/app/api/consents/erase.test.ts
npm test tests/app/api/support/contact.test.ts

# Integration tests
npm test tests/app/api/

# Full test suite
npm test
```

## Production Verification

### Pre-Deploy Checklist
- [ ] All environment variables configured
- [ ] Google Sheet has correct column structure
- [ ] N8N webhook configured and tested
- [ ] Rate limiting Redis connection works
- [ ] Sentry error reporting configured

### Post-Deploy Verification  
- [ ] Test export on staging with real Google Sheet
- [ ] Verify erasure actually updates sheet data
- [ ] Check contact form delivers to N8N
- [ ] Confirm error alerts trigger properly
- [ ] Test mobile responsiveness

### Monitoring Setup
- [ ] Sentry alerts for API errors
- [ ] Upstash monitoring for rate limits
- [ ] N8N webhook failure notifications
- [ ] Google Sheets API quota monitoring

## Troubleshooting

### Common Issues
1. **Export returns 404**: Check user exists in sheet with exact name/phone
2. **Erasure doesn't work**: Verify column indexes match sheet structure  
3. **Contact form fails**: Check N8N_WEBHOOK_URL and N8N_SECRET_TOKEN
4. **Rate limiting too strict**: Adjust limits in API routes
5. **Turnstile errors**: Verify TURNSTILE_SECRET_KEY is correct

### Debug Commands
```bash
# Check environment config
node -e "console.log(require('./src/lib/env').config)"

# Test Google Sheets connection
npm run test tests/lib/google/

# Verify Redis connection
npm run test tests/lib/cache/

# Inspect consent sheet with data masking
npx tsx scripts/inspect-consent.ts

# Find specific user consent
node scripts/debug-find-consent.js

# Test date parsing from Google Sheets
node scripts/debug-dates.js

# Test consent withdrawal API
node scripts/test-withdraw.js

# Use consent management CLI
npx tsx scripts/consent-cli.ts header
npx tsx scripts/consent-cli.ts show <phone> <name> [email]
```

### Administrative Scripts

All GDPR maintenance scripts are now located in `/scripts` folder:
- `consent-cli.ts` - Main CLI tool for consent management
- `inspect-consent.ts` - Inspect consent sheet with data masking
- `debug-find-consent.js` - Find specific user consent
- `debug-dates.js` - Test date parsing from Google Sheets
- `test-withdraw.js` - Test consent withdrawal API

See `docs/CONTRIBUTING.md` for detailed usage instructions.
