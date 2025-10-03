// Тестируем парсинг дат из Google Sheets
const dates = [
  '2025-09-24T08:08:02+02:00',
  '2025-09-24T18:46:03+02:00', 
  '2025-09-24T18:51:52+02:00',
  '2025-09-24T19:20:18+02:00',
  '2025-09-24T21:51:15+02:00',
  '2025-09-24T22:15:43+02:00'  // Должна быть последней
];

function parseConsentTimestamp(value) {
  if (!value) return Number.NaN
  let cleaned = value.trim().replace(/^'+|'+$/g, '')
  if (!cleaned) return Number.NaN
  cleaned = cleaned.replace(/\s+/g, ' ')
  if (!cleaned.includes('T') && cleaned.includes(' ')) {
    cleaned = cleaned.replace(' ', 'T')
  }
  const tzMatch = cleaned.match(/([+-])(\d{2})(:?)(\d{0,2})$/)
  if (tzMatch) {
    const [, sign, hours, colon, minutesRaw] = tzMatch
    let minutes = minutesRaw || ''
    if (!colon) {
      if (minutes.length === 0) minutes = '00'
      if (minutes.length === 1) minutes = `0${minutes}`
      if (minutes.length > 2) minutes = minutes.slice(0, 2)
      cleaned = cleaned.replace(tzMatch[0], `${sign}${hours}:${minutes}`)
    }
  } else if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(cleaned)) {
    cleaned = `${cleaned}${cleaned.endsWith('Z') ? '' : 'Z'}`
  }
  const ts = Date.parse(cleaned)
  if (!Number.isNaN(ts)) return ts
  const fallback = Date.parse(cleaned.replace(/ /g, 'T'))
  return Number.isNaN(fallback) ? Number.NaN : fallback
}

console.log('Тестируем сортировку дат:');
dates.forEach((date, i) => {
  const timestamp = parseConsentTimestamp(date);
  console.log(`${i+1}. ${date} → ${timestamp} (${new Date(timestamp).toISOString()})`);
});

// Тестируем сортировку
const sortedDates = dates
  .map(date => ({ date, timestamp: parseConsentTimestamp(date) }))
  .sort((a, b) => b.timestamp - a.timestamp); // По убыванию (новые первыми)

console.log('\nОтсортированные даты (новые первыми):');
sortedDates.forEach((item, i) => {
  console.log(`${i+1}. ${item.date} → ${new Date(item.timestamp).toISOString()}`);
});
