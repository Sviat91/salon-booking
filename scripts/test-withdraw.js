// Тестирование API отзыва согласий
const testData = {
  name: "Sviatoslav Upirow",
  phone: "+48501748708", 
  email: "sviatoslav@gmail.com",
  consentAcknowledged: true,
  turnstileToken: "dummy-token-for-dev", // В dev режиме должно работать
  requestId: "test-" + Date.now()
};

console.log('Testing withdrawal with data:', testData);

fetch('http://localhost:3001/api/consents/withdraw', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
.then(response => {
  console.log('Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Response data:', data);
})
.catch(error => {
  console.error('Error:', error);
});
