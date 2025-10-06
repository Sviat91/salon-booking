# QA Checklist - Multi-Master Support

## ✅ Pre-Launch Checklist

### Environment Setup
- [ ] All environment variables configured for both masters
  - [ ] `GOOGLE_CALENDAR_ID` (Olga)
  - [ ] `GOOGLE_CALENDAR_ID_JULI` (Juli)
  - [ ] `GOOGLE_SHEET_ID` (Olga)
  - [ ] `GOOGLE_SHEET_ID_JULI` (Juli)
- [ ] Master photos exist in `/public/`
  - [ ] `/public/photo_master_olga.png`
  - [ ] `/public/photo_master_juli.png`
- [ ] Google Sheets have correct structure
  - [ ] Procedures sheet for Olga
  - [ ] Procedures sheet for Juli
  - [ ] Weekly schedule configured
  - [ ] Exceptions configured

### Landing Page Testing
- [ ] Landing page loads successfully at `/`
- [ ] Both master cards are visible
- [ ] Master photos display correctly
- [ ] Hover effects work smoothly
- [ ] Theme toggle works (light/dark)
- [ ] Responsive layout:
  - [ ] Mobile portrait (vertical cards)
  - [ ] Mobile landscape (horizontal cards)
  - [ ] Desktop (horizontal cards)

### Master Selection Flow
- [ ] Clicking Olga card navigates to `/olga`
- [ ] Clicking Juli card navigates to `/juli`
- [ ] Selection saved to localStorage
- [ ] Page refresh maintains selection
- [ ] Invalid URL (e.g., `/invalid`) redirects to `/`

### Shared Element Transitions
- [ ] Master photo morphs from landing to booking page
- [ ] Transition is smooth (no flicker)
- [ ] Animation respects `prefers-reduced-motion`
- [ ] No layout shifts during transition

### Booking Page - Olga
- [ ] Back button navigates to landing page
- [ ] Master photo displays in header (circular, 80x80px)
- [ ] Procedures load for Olga
- [ ] Calendar shows Olga's availability
- [ ] Time slots match Olga's schedule
- [ ] Booking creates event in Olga's calendar
- [ ] Success message displays correctly

### Booking Page - Juli
- [ ] Back button navigates to landing page
- [ ] Master photo displays in header (circular, 80x80px)
- [ ] Procedures load for Juli
- [ ] Calendar shows Juli's availability
- [ ] Time slots match Juli's schedule
- [ ] Booking creates event in Juli's calendar
- [ ] Success message displays correctly

### Data Isolation
- [ ] Olga's procedures ≠ Juli's procedures
- [ ] Olga's availability ≠ Juli's availability
- [ ] Bookings go to correct calendar
- [ ] Cache keys are separate per master
- [ ] Switching masters doesn't mix data

### Booking Management
- [ ] Can find existing bookings for Olga
- [ ] Can find existing bookings for Juli
- [ ] Can modify Olga's bookings
- [ ] Can modify Juli's bookings
- [ ] Can cancel Olga's bookings
- [ ] Can cancel Juli's bookings
- [ ] Changes go to correct calendar

### Performance
- [ ] Landing page prefetches procedures for both masters
- [ ] Navigation to master page is instant (prefetched data)
- [ ] Cache hit rate is high for repeated visits
- [ ] No duplicate API calls
- [ ] Redis cache TTL is appropriate

### Accessibility
- [ ] Keyboard navigation works on landing page
- [ ] Screen reader announces master names
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Reduced motion preference respected
- [ ] Alt text present on all images

### Mobile Testing
- [ ] Touch targets are 44x44px minimum
- [ ] Swipe gestures don't interfere
- [ ] Viewport meta tag correct
- [ ] No horizontal scroll
- [ ] Auto-scroll behavior smooth
- [ ] Forms are mobile-friendly

### Cross-Browser Testing
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)

### Error Handling
- [ ] Invalid master ID shows 404 or redirects
- [ ] Missing environment variables fail gracefully
- [ ] Google API errors logged to Sentry
- [ ] Network errors show user-friendly message
- [ ] Cache miss doesn't break page

### Security
- [ ] Master ID validation on all endpoints
- [ ] No sensitive data in client bundles
- [ ] Calendar IDs only in server code
- [ ] Sheet IDs only in server code
- [ ] Rate limiting works per master
- [ ] Turnstile validation passes

### SEO & Meta
- [ ] Each master page has unique title
- [ ] Meta descriptions reference master
- [ ] Open Graph images correct
- [ ] Canonical URLs set properly
- [ ] Sitemap includes both masters

## 🧪 Test Scenarios

### Scenario 1: New User Flow
1. Visit `/` (landing page)
2. See both master cards
3. Click Olga
4. Redirected to `/olga`
5. See Olga's photo in header
6. Select procedure
7. Select date and time
8. Complete booking
9. Verify event in Olga's calendar

### Scenario 2: Returning User
1. User previously selected Juli
2. Visit `/` 
3. Click Juli (localStorage restores selection)
4. Procedures load instantly (prefetched)
5. Complete booking
6. Event created in Juli's calendar

### Scenario 3: Direct URL Access
1. User visits `/juli` directly
2. Context sets Juli as selected master
3. Procedures and availability load correctly
4. Booking works normally

### Scenario 4: Master Switching
1. User on `/olga` 
2. Click back button
3. Return to landing page
4. Click Juli
5. Data switches to Juli
6. No Olga data visible

### Scenario 5: Cache Validation
1. Load Olga's procedures
2. Switch to Juli
3. Load Juli's procedures
4. Switch back to Olga
5. Olga's data loads from cache (instant)

### Scenario 6: Booking Management
1. User has booking with Olga
2. Search for booking
3. Modify time/procedure
4. Changes saved to Olga's calendar
5. Switch to Juli
6. Different set of bookings visible

## 🐛 Known Issues

_(Document any known issues here)_

## 📊 Metrics to Monitor

Post-launch monitoring:

- **Master Selection Distribution**: 
  - Track which master is selected more often
  - Compare booking conversion rates per master

- **Performance Metrics**:
  - Page load time for landing vs booking pages
  - Cache hit ratio per master
  - API response times per master

- **Error Rates**:
  - Failed bookings per master
  - Calendar API errors per calendar
  - Sheets API errors per sheet

- **User Behavior**:
  - Master switching frequency
  - Direct URL access vs landing page
  - localStorage persistence rate

## ✨ Launch Criteria

All items must pass before production deployment:

- [ ] All environment variables set in production
- [ ] Both master calendars accessible
- [ ] Both procedure sheets populated
- [ ] All critical paths tested
- [ ] No console errors on clean run
- [ ] Lighthouse score > 90 (performance, accessibility)
- [ ] All API endpoints return 200 for valid requests
- [ ] Sentry configured and receiving test events
- [ ] Redis cache working in production
- [ ] Backup procedure in place

---

**Last Updated**: 2025-10-06  
**Version**: 1.0.0  
**Tested By**: _[Name]_  
**Status**: _[Ready/Not Ready]_
