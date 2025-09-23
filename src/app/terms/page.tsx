import type { Metadata } from 'next'
import Link from 'next/link'
import BackButton from '../../components/BackButton'

export const metadata: Metadata = {
  title: 'Warunki Korzystania - Somique Beauty',
  description: 'Warunki korzystania z usług Somique Beauty',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFF6E9] to-[#FDE5C3] dark:from-[#9c6849] dark:to-[#7A4F35] transition-all duration-300">
      <BackButton />
      <div className="container mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-2">
            Warunki Korzystania z Usług
          </h1>
        </div>

        {/* Content */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-8">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 1. POSTANOWIENIA OGÓLNE</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Niniejszy regulamin określa zasady korzystania z usług świadczonych przez <strong>KOSMETOLOGIA I MASAŻ YULIIA YAKOVENKO</strong>, NIP: 9512580063, z siedzibą przy ul. Herbu Janina 3a/40, 02-972 Warszawa, tel. +48 789 894 948.
              </p>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Regulamin stanowi integralną część umowy o świadczenie usług zawartej między Usługodawcą a Klientem.
              </p>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Skorzystanie z systemu rezerwacji online oznacza akceptację niniejszego regulaminu oraz Polityki Prywatności.
              </p>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Usługodawca świadczy usługi w zakresie:
              </p>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Masażu terapeutycznego i relaksacyjnego</li>
                <li>Zabiegów kosmetycznych</li>
                <li>Osteopatii</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 2. DEFINICJE</h2>
              <ul className="space-y-2 text-neutral-700 dark:text-dark-text">
                <li><strong>Klient</strong> – osoba fizyczna korzystająca z usług Salonu</li>
                <li><strong>Usługodawca</strong> – KOSMETOLOGIA I MASAŻ YULIIA YAKOVENKO</li>
                <li><strong>Rezerwacja</strong> – zarezerwowanie terminu zabiegu przez system online</li>
                <li><strong>Zabieg</strong> – usługa świadczona przez Usługodawcę na rzecz Klienta</li>
                <li><strong>System zgód</strong> – elektroniczny system zarządzania zgodami na przetwarzanie danych</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 3. ZASADY REZERWACJI</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Rezerwacji można dokonać online na stronie internetowej, wybierając:
              </p>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Rodzaj zabiegu z dostępnej listy usług</li>
                <li>Dostępny termin w kalendarzu (do 90 dni naprzód)</li>
                <li>Podając wymagane dane: imię, nazwisko i numer telefonu</li>
              </ul>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Rezerwacja jest potwierdzona automatycznie po wypełnieniu formularza i udzieleniu wymaganych zgód.
              </p>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Minimalna długość zabiegu wynosi 30 minut, sloty dostępne są co 30 minut zgodnie z grafikiem pracy.
              </p>
              
              <h3 className="text-lg font-medium text-text dark:text-dark-text mt-6 mb-3">Zarządzanie zgodami w procesie rezerwacji:</h3>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Przy pierwszej rezerwacji system wyświetli formularz zgód na przetwarzanie danych</li>
                <li>Informacje o udzielonych zgodach przechowujemy w bezpiecznej bazie danych (Google Sheets)</li>
                <li>Stali klienci nie muszą ponownie akceptować warunków przy kolejnych rezerwacjach</li>
                <li>System ponownie wyświetli formularz zgód tylko w przypadku aktualizacji dokumentów</li>
              </ul>
              
              <p className="text-neutral-700 dark:text-dark-text">
                Dostępność terminów jest obliczana w czasie rzeczywistym na podstawie kalendarza Google i może ulec zmianie.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 4. ANULOWANIE I ZMIANY REZERWACJI</h2>
              <ul className="space-y-3 text-neutral-700 dark:text-dark-text">
                <li>Anulowanie lub zmiana rezerwacji możliwa jest do <strong>24 godzin</strong> przed planowanym zabiegiem poprzez kontakt telefoniczny.</li>
                <li>W przypadku anulowania w krótszym terminie niż 24 godziny, Usługodawca zastrzega sobie prawo do naliczenia opłaty w wysokości <strong>50%</strong> wartości zabiegu.</li>
                <li>Brak stawienia się na umówiony zabieg bez uprzedzenia skutkuje naliczeniem <strong>100%</strong> wartości zabiegu.</li>
                <li>Spóźnienie powyżej 15 minut może skutkować skróceniem czasu zabiegu proporcjonalnie do spóźnienia lub jego anulowaniem.</li>
                <li>W przypadkach losowych lub zdrowotnych (choroba, wypadek) anulowanie jest możliwe bez dodatkowych opłat za okazaniem odpowiedniego zaświadczenia.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 5. CENY I PŁATNOŚCI</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Aktualny cennik dostępny jest na stronie internetowej i może ulec zmianie z 7-dniowym wyprzedzeniem.
              </p>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Płatność następuje po wykonaniu zabiegu w jednej z następujących form:
              </p>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Gotówka</li>
                <li>Karta płatnicza (Visa, Mastercard)</li>
                <li>BLIK</li>
                <li>Przelew bankowy (dla firm)</li>
              </ul>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Wszystkie ceny są podane w złotych polskich (PLN) i zawierają podatek VAT zgodnie z obowiązującymi przepisami.
              </p>
              <p className="text-neutral-700 dark:text-dark-text">
                W przypadku zabiegów wieloetapowych możliwa jest płatność ratalna po uprzednim uzgodnieniu.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 12. KONTAKT</h2>
              <div className="bg-neutral-50 dark:bg-dark-border/30 rounded-lg p-6">
                <h3 className="font-medium text-text dark:text-dark-text mb-3">KOSMETOLOGIA I MASAŻ YULIIA YAKOVENKO</h3>
                <div className="space-y-2 text-neutral-700 dark:text-dark-text">
                  <p><strong>Adres:</strong> Herbu Janina 3a/40, 02-972 Warszawa</p>
                  <p><strong>Telefon:</strong> +48 789 894 948</p>
                  <p><strong>NIP:</strong> 9512580063</p>
                  <p><strong>Strona wsparcia:</strong> <Link href="/support" className="text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">Centrum pomocy</Link></p>
                </div>
                <p className="text-sm text-neutral-600 dark:text-dark-muted mt-4">
                  Data ostatniej aktualizacji: 23 września 2025 r.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  )
}
