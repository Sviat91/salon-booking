// Проверим что находит findUserConsent для ваших данных
import { findUserConsent, withdrawUserConsent } from '../src/lib/google/sheets.js';

const testData = {
  phone: "48501748708", // Без + как в таблице
  name: "Sviatoslav Upirow",
  email: "s.upirow@gmail.com"
};

console.log('Ищем согласие для:', testData);

try {
  const consent = await findUserConsent(testData.phone, testData.name, testData.email);
  console.log('Найденное согласие:', consent);
  
  if (consent) {
    console.log('Детали:');
    console.log('- Дата согласия:', consent.consentDate);
    console.log('- Дата отзыва:', consent.consentWithdrawnDate || 'НЕТ');
    console.log('- Privacy:', consent.consentPrivacyV10);
    console.log('- Terms:', consent.consentTermsV10);
    console.log('- Notifications:', consent.consentNotificationsV10);
    console.log('- Активно:', !consent.consentWithdrawnDate && consent.consentPrivacyV10 && consent.consentTermsV10);
  }
} catch (error) {
  console.error('Ошибка:', error);
}
