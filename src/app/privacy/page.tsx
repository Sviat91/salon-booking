import type { Metadata } from 'next'
import Link from 'next/link'
import BackButton from '../../components/BackButton'

export const metadata: Metadata = {
  title: 'Polityka Prywatności - Somique Beauty',
  description: 'Polityka prywatności Somique Beauty - ochrona danych osobowych',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFF6E9] to-[#FDE5C3] dark:from-[#9c6849] dark:to-[#7A4F35] transition-all duration-300">
      <BackButton />
      <div className="container mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-2">
            Polityka Prywatności
          </h1>
        </div>

        {/* Content */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-8">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-0">
                Zgodnie z art. 13 ust. 1 i ust. 2 Ogólnego Rozporządzenia o Ochronie Danych Osobowych (GDPR) z dnia 27 kwietnia 2016 r. informujemy:
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 1. ADMINISTRATOR DANYCH</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Administratorem Państwa danych osobowych jest:
              </p>
              <div className="bg-neutral-50 dark:bg-dark-border/30 rounded-lg p-4">
                <div className="space-y-1 text-neutral-700 dark:text-dark-text">
                  <p><strong>KOSMETOLOGIA I MASAŻ YULIIA YAKOVENKO</strong></p>
                  <p>NIP: 9512580063</p>
                  <p>Adres: Herbu Janina 3a/40, 02-972 Warszawa</p>
                  <p>Telefon: +48 789 894 948</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 2. ZAKRES PRZETWARZANYCH DANYCH</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                W ramach rezerwacji zabiegów przetwarzamy następujące dane osobowe:
              </p>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Imię i nazwisko</li>
                <li>Numer telefonu</li>
                <li>Adres e-mail (jeśli podany)</li>
                <li>Data i godzina zabiegu</li>
                <li>Rodzaj wybranej usługi</li>
                <li>Adres IP (automatycznie przy korzystaniu ze strony)</li>
                <li>Informacje o udzielonych zgodach (data, wersja dokumentów, status zgód)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 3. CELE I PODSTAWA PRAWNA PRZETWARZANIA</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-text dark:text-dark-text mb-2">Główny cel przetwarzania:</h3>
                  <p className="text-neutral-700 dark:text-dark-text">
                    Organizacja i realizacja rezerwacji zabiegów kosmetycznych i masażu
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-dark-muted">
                    <strong>Podstawa prawna:</strong> Art. 6 ust. 1 lit. b) GDPR - przetwarzanie niezbędne do wykonania umowy świadczenia usług
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium text-text dark:text-dark-text mb-2">Dodatkowe cele:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-dark-text">
                    <li>Zarządzanie zgodami na przetwarzanie danych <span className="text-sm text-neutral-600 dark:text-dark-muted">(podstawa: art. 6 ust. 1 lit. c) GDPR - obowiązek prawny)</span></li>
                    <li>Powiadomienia wewnętrzne o rezerwacjach <span className="text-sm text-neutral-600 dark:text-dark-muted">(podstawa: art. 6 ust. 1 lit. f) GDPR - prawnie uzasadniony interes)</span></li>
                    <li>Przyszłe powiadomienia SMS/e-mail o zbliżających się wizytach <span className="text-sm text-neutral-600 dark:text-dark-muted">(na podstawie zgody - art. 6 ust. 1 lit. a) GDPR)</span></li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 6. ZARZĄDZANIE ZGODAMI</h2>
              
              <h3 className="text-lg font-medium text-text dark:text-dark-text mt-6 mb-3">Rejestrowanie zgód:</h3>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Informacje o udzielonych zgodach przechowujemy w Google Sheets w celu:
              </p>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Unikania wielokrotnego wyświetlania formularza zgody stałym klientom</li>
                <li>Dokumentowania podstawy prawnej przetwarzania zgodnie z wymogami GDPR</li>
                <li>Zarządzania procesem wycofania zgód</li>
                <li>Zapewnienia compliance z wymogami transparentności</li>
              </ul>

              <h3 className="text-lg font-medium text-text dark:text-dark-text mt-6 mb-3">Zakres rejestrowanych informacji o zgodach:</h3>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Numer telefonu (w formie zahashowanej dla ochrony prywatności)</li>
                <li>Data i dokładny czas udzielenia zgody</li>
                <li>Wersja akceptowanych dokumentów (Polityka Prywatności, Warunki Korzystania)</li>
                <li>Informacja o ewentualnym wycofaniu zgody i jego dacie</li>
                <li>Adres IP (częściowo zamaskowany) w momencie udzielenia zgody</li>
              </ul>

              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  <strong>Aktualizacja zgód:</strong> Po istotnej zmianie Polityki Prywatności lub Warunków Korzystania, system automatycznie wyświetli formularz zgody z zaktualizowanymi dokumentami wszystkim użytkownikom.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 7. PRAWA OSOBY, KTÓREJ DANE DOTYCZĄ</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                Przysługują Państwu następujące prawa:
              </p>
              <ul className="list-disc pl-6 mb-4 text-neutral-700 dark:text-dark-text">
                <li>Prawo dostępu do swoich danych osobowych (art. 15 GDPR)</li>
                <li>Prawo do sprostowania danych (art. 16 GDPR)</li>
                <li>Prawo do usunięcia danych (art. 17 GDPR)</li>
                <li>Prawo do ograniczenia przetwarzania (art. 18 GDPR)</li>
                <li>Prawo do przenoszenia danych (art. 20 GDPR)</li>
                <li>Prawo sprzeciwu wobec przetwarzania (art. 21 GDPR)</li>
                <li>Prawo do cofnięcia zgody w dowolnym momencie</li>
              </ul>
              <p className="text-neutral-700 dark:text-dark-text">
                Aby skorzystać z powyższych praw, prosimy o kontakt poprzez naszą <Link href="/support" className="text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">stronę wsparcia</Link> lub bezpośrednio pod podanymi kontaktami.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">§ 12. KONTAKT W SPRAWACH OCHRONY DANYCH</h2>
              <p className="text-neutral-700 dark:text-dark-text mb-4">
                W sprawach dotyczących ochrony danych osobowych można kontaktować się:
              </p>
              <div className="bg-neutral-50 dark:bg-dark-border/30 rounded-lg p-6">
                <div className="space-y-2 text-neutral-700 dark:text-dark-text">
                  <p><strong>Poprzez stronę wsparcia:</strong> <Link href="/support" className="text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80">Centrum pomocy</Link></p>
                  <p><strong>Telefonicznie:</strong> +48 789 894 948</p>
                  <p><strong>Pisemnie:</strong> Herbu Janina 3a/40, 02-972 Warszawa</p>
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
