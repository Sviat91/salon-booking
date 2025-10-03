"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PhoneInput from "./ui/PhoneInput";
import { clientLog } from "@/lib/client-logger";

type ModalState =
  | "idle"
  | "loading"
  | "success"
  | "already-processed"
  | "not-found"
  | "error";

type DataErasureModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

interface ApiError {
  error: string;
  code?: string;
  hints?: string[];
}

interface SuccessResponse {
  status: string;
  message: string;
  details: {
    erasedData: string[];
    retainedData: string[];
    bookingInfo: string[];
    notice: string;
  };
}

const generateRequestId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function DataErasureModal({
  isOpen,
  onClose,
}: DataErasureModalProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as
    | string
    | undefined;
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [successData, setSuccessData] = useState<SuccessResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>(() => generateRequestId());

  const resetTurnstile = useCallback(() => {
    setToken(null);
    if (!siteKey || typeof window === "undefined") {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnstile = (window as any)?.turnstile;
    if (turnstile && widgetIdRef.current) {
      try {
        turnstile.reset(widgetIdRef.current);
      } catch (err) {
        clientLog.warn("Turnstile reset failed", err);
      }
    }
  }, [siteKey]);

  const resetForm = useCallback(() => {
    setName("");
    setPhone("");
    setEmail("");
    setAcknowledged(false);
    setState("idle");
    setError(null);
    setSuccessData(null);
    setRequestId(generateRequestId());
    resetTurnstile();
  }, [resetTurnstile]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

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
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose, isOpen]);

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
      if (turnstile && turnstileRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            language: "pl",
            callback: (value: string) => setToken(value),
            "error-callback": () => resetTurnstile(),
            "expired-callback": () => resetTurnstile(),
          });
          clearInterval(interval);
        } catch (err) {
          clientLog.warn("Turnstile render failed", err);
        }
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (!siteKey || typeof window === "undefined") {
        widgetIdRef.current = null;
        return;
      }
      const turnstile = (window as any)?.turnstile;
      if (turnstile && widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch (err) {
          clientLog.warn("Turnstile cleanup failed", err);
        }
      }
      widgetIdRef.current = null;
    };
  }, [isOpen, resetTurnstile, siteKey]);

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
      const res = await fetch("/api/consents/erase", {
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
        resetTurnstile();
        setRequestId(generateRequestId());
        return;
      }

      if (res.status === 409) {
        const payload = (await res.json()) as any;
        if (payload.code === 'ALREADY_ERASED') {
          setState("already-processed");
        } else {
          setError(payload);
          setState("error");
        }
        resetTurnstile();
        setRequestId(generateRequestId());
        return;
      }

      if (!res.ok) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("error");
        resetTurnstile();
        setRequestId(generateRequestId());
        return;
      }

      const successPayload = (await res.json()) as SuccessResponse;
      setSuccessData(successPayload);
      setState("success");
    } catch (err) {
      clientLog.error("Data erasure failed", err);
      setError({
        error: "Wystąpił błąd połączenia. Spróbuj ponownie później.",
        code: "NETWORK_ERROR",
      });
      setState("error");
      resetTurnstile();
      setRequestId(generateRequestId());
    }
  }

  const showHints = !!(error?.hints && error.hints.length > 0);
  const isLoading = state === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="erase-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="erase-modal-title" className="text-xl font-semibold text-text dark:text-dark-text">
              Usuń moje dane
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-dark-muted">
              Wypełnij formularz, aby trwale usunąć swoje dane osobowe.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-200/70 dark:text-dark-muted dark:hover:bg-dark-border"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        {state === "success" && successData ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden="true">✓</span>
                {successData.message}
              </h3>
              
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="font-medium">Zgodnie z Twoim żądaniem usunięto następujące dane:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {successData.details.erasedData.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium">Co zostało zachowane (wymogi prawne RODO):</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {successData.details.retainedData.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium">Istniejące rezerwacje:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {successData.details.bookingInfo.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
                
                <p className="font-medium">{successData.details.notice}</p>
                <p>Dziękujemy za zrozumienie i zaufanie.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn btn-primary flex-1" onClick={handleClose}>
                Zamknij
              </button>
            </div>
          </div>
        ) : state === "already-processed" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden="true">ℹ</span>
                Dane były już wcześniej usunięte
              </h3>
              <p className="mt-2 text-sm">
                Twoje dane zostały już usunięte z naszego systemu. Jeśli nadal masz pytania, skontaktuj się z nami przez formularz wsparcia.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn btn-primary flex-1" onClick={handleClose}>
                Zamknij
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="erase-name">
                Imię i nazwisko
              </label>
              <input
                id="erase-name"
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
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="erase-phone">
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
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="erase-email">
                E-mail <span className="text-xs text-neutral-500 dark:text-dark-muted">(opcjonalnie)</span>
              </label>
              <input
                id="erase-email"
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
                Rozumiem, że usunięcie danych jest nieodwracalne i może wpłynąć na możliwość korzystania z usług. Chcę trwale usunąć wszystkie moje dane osobowe z systemu.
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
                onClick={handleClose}
                disabled={isLoading}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className={`btn btn-primary flex-1 ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? 'Usuwanie danych…' : 'Usuń moje dane'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
