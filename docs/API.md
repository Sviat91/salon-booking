# 📡 API Documentation

## Base URL
```
Development: http://localhost:3000
Production: https://facemassage.net
```

## Authentication
Большинство endpoints не требуют аутентификации. Защита через:
- Cloudflare Turnstile (bot protection)
- Rate limiting (IP-based)
- Booking verification (phone + name matching)

---

## 📚 Endpoints

### Procedures

#### GET `/api/procedures`
Получить список всех активных процедур.

**Response 200:**
```json
{
  "items": [
    {
      "id": "proc_60min",
      "name_pl": "Masaż twarzy japoński lifting",
      "duration_min": 60,
      "price_pln": 200,
      "active": true
    }
  ]
}
```

**Cache:** 1 hour (client), 10 minutes (server)

---

### Availability

#### GET `/api/availability`
Проверить доступность дат для процедуры.

**Query Parameters:**
- `from` (required): YYYY-MM-DD
- `until` (required): YYYY-MM-DD
- `procedureId` (optional): ID процедуры

**Response 200:**
```json
{
  "days": [
    {
      "date": "2025-10-06",
      "hasWindow": true,
      "dayOff": false
    },
    {
      "date": "2025-10-05",
      "hasWindow": false,
      "dayOff": true,
      "reason": "Sunday"
    }
  ]
}
```

**Cache:** 10 minutes

---

#### GET `/api/day/:date`
Получить доступные слоты на конкретную дату.

**Path Parameters:**
- `date`: YYYY-MM-DD

**Query Parameters:**
- `procedureId` (required): ID процедуры

**Response 200:**
```json
{
  "slots": [
    {
      "startISO": "2025-10-06T08:00:00.000Z",
      "endISO": "2025-10-06T09:00:00.000Z"
    },
    {
      "startISO": "2025-10-06T09:00:00.000Z",
      "endISO": "2025-10-06T10:00:00.000Z"
    }
  ]
}
```

**Cache:** 5 minutes

---

### Booking

#### POST `/api/book`
Создать новое бронирование.

**Request Body:**
```json
{
  "startISO": "2025-10-06T08:00:00.000Z",
  "endISO": "2025-10-06T09:00:00.000Z",
  "procedureId": "proc_60min",
  "name": "Jan Kowalski",
  "phone": "+48123456789",
  "email": "jan@example.com",
  "turnstileToken": "xxx",
  "consents": {
    "dataProcessing": true,
    "terms": true,
    "notifications": false
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "eventId": "abc123xyz",
  "summary": "Masaż twarzy - Jan Kowalski",
  "start": "2025-10-06T08:00:00.000Z",
  "end": "2025-10-06T09:00:00.000Z"
}
```

**Error 400 - Validation:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": {
      "phone": "Phone number is too short"
    }
  }
}
```

**Error 403 - Turnstile:**
```json
{
  "error": "Security verification failed",
  "code": "TURNSTILE_FAILED"
}
```

**Error 409 - Conflict:**
```json
{
  "error": "This time slot is already booked",
  "code": "SLOT_ALREADY_BOOKED"
}
```

**Error 429 - Rate Limited:**
```json
{
  "error": "Too many requests. Please try again later. (1m)",
  "code": "RATE_LIMITED"
}
```

**Rate Limits:**
- 10 requests / minute per IP
- 50 requests / hour per IP

**Idempotency:** 10 минут (по хэшу: phone + start + end)

---

### Booking Management

#### POST `/api/bookings/search`
Найти бронирования пользователя.

**Request Body:**
```json
{
  "phone": "+48123456789",
  "name": "Jan Kowalski"
}
```

**Response 200:**
```json
{
  "results": [
    {
      "id": "abc123xyz",
      "summary": "Masaż twarzy - Jan Kowalski",
      "start": "2025-10-06T08:00:00.000Z",
      "end": "2025-10-06T09:00:00.000Z",
      "procedureId": "proc_60min",
      "procedureName": "Masaż twarzy",
      "procedureDurationMin": 60,
      "canModify": true,
      "canCancel": true
    }
  ]
}
```

**Access Rules:**
- Нормализованное совпадение phone + name
- Поддержка Cyrillic/Latin conversion

---

#### POST `/api/bookings/cancel`
Отменить бронирование.

**Request Body:**
```json
{
  "eventId": "abc123xyz",
  "phone": "+48123456789",
  "name": "Jan Kowalski"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

**Error 404:**
```json
{
  "error": "Booking not found or access denied",
  "code": "BOOKING_NOT_FOUND"
}
```

**Ограничения:** Нет

---

#### POST `/api/bookings/update-time`
Изменить время бронирования.

**Request Body:**
```json
{
  "eventId": "abc123xyz",
  "phone": "+48123456789",
  "name": "Jan Kowalski",
  "newStartISO": "2025-10-06T10:00:00.000Z",
  "newEndISO": "2025-10-06T11:00:00.000Z"
}
```

**Response 200:**
```json
{
  "success": true,
  "eventId": "abc123xyz",
  "newStart": "2025-10-06T10:00:00.000Z",
  "newEnd": "2025-10-06T11:00:00.000Z"
}
```

**Error 422 - Deadline:**
```json
{
  "error": "Cannot modify booking less than 24 hours before appointment",
  "code": "MODIFICATION_DEADLINE_PASSED"
}
```

**Бизнес-правила:**
- Можно изменить только >24 часа до визита
- Проверка доступности нового слота
- Автоматическая проверка конфликтов

---

#### POST `/api/bookings/update-procedure`
Изменить процедуру бронирования.

**Request Body:**
```json
{
  "eventId": "abc123xyz",
  "phone": "+48123456789",
  "name": "Jan Kowalski",
  "newProcedureId": "proc_90min",
  "newStartISO": "2025-10-06T08:00:00.000Z",
  "newEndISO": "2025-10-06T09:30:00.000Z"
}
```

**Response 200:**
```json
{
  "success": true,
  "eventId": "abc123xyz",
  "newProcedureId": "proc_90min",
  "newStart": "2025-10-06T08:00:00.000Z",
  "newEnd": "2025-10-06T09:30:00.000Z"
}
```

**Бизнес-правила:**
- Правило 24 часа
- Автоматическая корректировка времени для новой длительности

---

#### GET `/api/bookings/[id]/check-extension`
Проверить возможность продления процедуры.

**Path Parameters:**
- `id`: Event ID

**Query Parameters:**
- `phone` (required)
- `name` (required)
- `currentStartISO` (required)
- `currentEndISO` (required)
- `newDurationMin` (required)

**Response 200:**
```json
{
  "status": "can_extend",
  "suggestedStartISO": "2025-10-06T08:00:00.000Z",
  "suggestedEndISO": "2025-10-06T09:30:00.000Z"
}
```

**Response 200 - No availability:**
```json
{
  "status": "no_availability",
  "alternativeSlots": [
    {
      "startISO": "2025-10-06T10:00:00.000Z",
      "endISO": "2025-10-06T11:30:00.000Z"
    }
  ]
}
```

---

### GDPR & Consents

#### POST `/api/consents/check`
Проверить наличие действительных согласий.

**Request Body:**
```json
{
  "phone": "+48123456789",
  "name": "Jan Kowalski",
  "email": "jan@example.com"
}
```

**Response 200:**
```json
{
  "skipConsentModal": true,
  "hasValidConsent": true,
  "consentDate": "2025-01-15T10:30:00.000Z"
}
```

**Cache:** None (real-time check)

---

#### POST `/api/consents/withdraw`
Отозвать согласие на обработку данных.

**Request Body:**
```json
{
  "phone": "+48123456789",
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "turnstileToken": "xxx"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Consent withdrawn successfully",
  "withdrawnDate": "2025-10-03T08:30:00.000Z"
}
```

**GDPR Compliance:**
- Audit trail в Google Sheets
- IP hash сохраняется
- Нельзя отозвать дважды

---

#### POST `/api/consents/erase`
Удалить персональные данные (Right to be forgotten).

**Request Body:**
```json
{
  "phone": "+48123456789",
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "turnstileToken": "xxx"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Data erased successfully",
  "erasedRecordsCount": 2,
  "anonymizedRecordsCount": 1
}
```

**GDPR Implementation:**
- Анонимизация вместо удаления
- Сохранение audit trail
- Phone → SHA-256 hash
- Name → "[ERASED]"
- Email → "[ERASED]"

---

#### POST `/api/consents/export`
Экспорт всех данных пользователя (Data portability).

**Request Body:**
```json
{
  "phone": "+48123456789",
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "turnstileToken": "xxx"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "personalData": {
      "name": "Jan Kowalski",
      "phone": "+48123456789",
      "email": "jan@example.com"
    },
    "consentHistory": [
      {
        "consentDate": "2025-01-15T10:30:00.000Z",
        "ipHash": "abc...123",
        "privacyV10": true,
        "termsV10": true,
        "notificationsV10": false,
        "withdrawnDate": null
      }
    ],
    "bookings": [
      {
        "date": "2025-10-06T08:00:00.000Z",
        "procedureName": "Masaż twarzy",
        "status": "confirmed"
      }
    ],
    "isAnonymized": false,
    "exportTimestamp": "2025-10-03T08:30:00.000Z"
  }
}
```

---

## 🔐 Error Codes Reference

### Client Errors (4xx)

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `INVALID_INPUT` | 400 | Invalid field value |
| `MISSING_REQUIRED_FIELD` | 400 | Required field missing |
| `UNAUTHORIZED` | 401 | Authentication required |
| `ACCESS_DENIED` | 403 | No permission to access resource |
| `TURNSTILE_FAILED` | 403 | Bot protection check failed |
| `NOT_FOUND` | 404 | Resource not found |
| `BOOKING_NOT_FOUND` | 404 | Booking not found or access denied |
| `SLOT_ALREADY_BOOKED` | 409 | Time slot conflict |
| `DUPLICATE_BOOKING` | 409 | Duplicate booking attempt |
| `SLOT_UNAVAILABLE` | 422 | Time slot not available |
| `MODIFICATION_DEADLINE_PASSED` | 422 | Cannot modify <24h before |
| `INVALID_TIME_RANGE` | 422 | Invalid start/end time |
| `RATE_LIMITED` | 429 | Too many requests |

### Server Errors (5xx)

| Code | HTTP | Description |
|------|------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `CALENDAR_ERROR` | 500 | Google Calendar API error |
| `SHEETS_ERROR` | 500 | Google Sheets API error |
| `CACHE_ERROR` | 500 | Redis cache error |

---

## 📝 Best Practices

### Rate Limiting
- Implement exponential backoff
- Show user-friendly error messages
- Cache responses when possible

### Error Handling
```typescript
try {
  const response = await fetch('/api/book', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    // Handle by error code
    switch (error.code) {
      case 'SLOT_ALREADY_BOOKED':
        // Refresh availability
        break
      case 'RATE_LIMITED':
        // Show retry message
        break
    }
  }
} catch (err) {
  // Network error
}
```

### Phone Numbers
- Always send normalized format: `+48123456789`
- Support formats: `123 456 789`, `+48 123 456 789`, `(123) 456-789`
- Server normalizes automatically

### Names
- Support Cyrillic (Олександр) and Latin (Aleksandr)
- Server normalizes for matching
- Case-insensitive comparison

### Timestamps
- Always use ISO 8601: `2025-10-06T08:00:00.000Z`
- Server timezone: Europe/Warsaw (UTC+1/+2)

---

## 🧪 Testing

### cURL Examples

**Create booking:**
```bash
curl -X POST https://facemassage.net/api/book \
  -H "Content-Type: application/json" \
  -d '{
    "startISO": "2025-10-06T08:00:00.000Z",
    "endISO": "2025-10-06T09:00:00.000Z",
    "procedureId": "proc_60min",
    "name": "Jan Kowalski",
    "phone": "+48123456789",
    "consents": {
      "dataProcessing": true,
      "terms": true,
      "notifications": false
    }
  }'
```

**Search bookings:**
```bash
curl -X POST https://facemassage.net/api/bookings/search \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+48123456789",
    "name": "Jan Kowalski"
  }'
```

---

## 📚 Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines
