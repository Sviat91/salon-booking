"use client";

import { useEffect, useRef, useState } from "react";
import PhoneInput from "./ui/PhoneInput";

type ModalState = "idle" | "loading" | "success" | "not-found" | "error";

type ConsentWithdrawalModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

interface ApiError {
  error: string;
  code?: string;
  hints?: string[];
}

export default function ConsentWithdrawalModal({
  isOpen,
  onClose,
}: ConsentWithdrawalModalProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as
    | string
    | undefined;
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setName("");
      setPhone("");
      setEmail("");
      setAcknowledged(false);
      setState("idle");
      setError(null);
      setToken(null);
      const newId =
        typeof window !== "undefined" && window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setRequestId(newId);
    }
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 50);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  // Prevent body scroll while modal open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // ESC handling
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Load Turnstile
  useEffect(() => {
    if (!isOpen || !siteKey) return;
    const scriptId = "cf-turnstile";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnstile = (window as any)?.turnstile;
      if (turnstile && turnstileRef.current) {
        try {
          turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            language: "pl",
            callback: (value: string) => setToken(value),
            "error-callback": () => setToken(null),
          });
          clearInterval(interval);
        } catch (err) {
          console.warn("Turnstile render failed", err);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, siteKey]);

  if (!isOpen) return null;

  const canSubmit =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 8 &&
    acknowledged &&
    (siteKey ? !!token : true) &&
    state !== "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/consents/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
          consentAcknowledged: acknowledged,
          turnstileToken: token,
          requestId,
        }),
      });

      if (res.status === 404) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("not-found");
        return;
      }

      if (res.status === 202) {
        setState("success");
        return;
      }

      if (!res.ok) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("error");
        return;
      }

      setState("success");
    } catch (err) {
      console.error("Consent withdraw failed", err);
      setError({
        error: "Wystąpił błąd połączenia. Spróbuj ponownie później.",
        code: "NETWORK_ERROR",
      });
      setState("error");
    }
  }

  const showHints = !!(error?.hints && error.hints.length > 0);
  const isLoading = state === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="withdraw-modal-title" className="text-xl font-semibold text-text dark:text-dark-text">
              Wycofanie zgód
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-dark-muted">
              Wypełnij formularz, a skontaktujemy się w ciągu 72 godzin. Pełne usunięcie danych trwa maksymalnie 30 dni.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-200/70 dark:text-dark-muted dark:hover:bg-dark-border"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        {state === "success" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
              <h3 className="text-lg font-medium">Twoja prośba została przyjęta</h3>
              <p className="mt-1 text-sm">
                Potwierdzamy przyjęcie zgłoszenia. Odpowiemy w ciągu 72 godzin, a pełne wycofanie zgód nastąpi do 30 dni.
              </p>
            </div>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-dark-muted">
              <p>Jeśli potrzebujesz pilnych zmian, skontaktuj się telefonicznie z mistrzem.</p>
              <p>Wiadomość potwierdzająca została wysłana na kanały podane przy rezerwacji (bez danych wrażliwych).</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn btn-primary flex-1" onClick={onClose}>
                Zamknij
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="withdraw-name">
                Imię i nazwisko
              </label>
              <input
                id="withdraw-name"
                ref={firstFieldRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-border bg-white/90 px-4 py-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-dark-border dark:bg-dark-card/80 dark:text-dark-text"
                placeholder="Wpisz tak, jak w rezerwacji"
                autoComplete="name"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="withdraw-phone">
                Telefon
              </label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="Numer telefonu z kodem kraju"
                error={state === "error" && error?.code === "INVALID_PHONE" ? error.error : undefined}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="withdraw-email">
                E-mail <span className="text-xs text-neutral-500 dark:text-dark-muted">(opcjonalnie)</span>
              </label>
              <input
                id="withdraw-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-border bg-white/90 px-4 py-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-dark-border dark:bg-dark-card/80 dark:text-dark-text"
                placeholder="twoj.email@example.com"
                autoComplete="email"
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-neutral-50/80 p-4 text-sm text-text transition dark:border-dark-border/70 dark:bg-dark-border/20 dark:text-dark-text">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary dark:border-dark-border"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                required
              />
              <span>
                Rozumiem, że wycofanie zgód może wpłynąć na możliwość korzystania z wybranych usług oraz wymaga do 30 dni na pełną realizację.
              </span>
            </label>

            {siteKey && (
              <div className="rounded-xl border border-border/60 bg-white/60 p-3 dark:border-dark-border/60 dark:bg-dark-border/20">
                <div ref={turnstileRef} />
              </div>
            )}

            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200"
                role="alert"
                aria-live="assertive"
              >
                <p className="font-medium">{error.error}</p>
                {showHints && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {error.hints!.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => {
                  setState('idle')
                  setError(null)
                  onClose()
                }}
                disabled={isLoading}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className={`btn btn-primary flex-1 ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? 'Wysyłanie…' : 'Wyślij prośbę'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
