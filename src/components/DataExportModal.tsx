"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PhoneInput from "./ui/PhoneInput";

type ModalState =
  | "idle"
  | "loading"
  | "success"
  | "not-found"
  | "error";

type DataExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

interface ApiError {
  error: string;
  code?: string;
  hints?: string[];
}

interface UserDataExport {
  personalData: {
    name: string;
    phone: string;
    email?: string;
  };
  consentHistory: {
    consentDate: string;
    ipHash: string;
    privacyV10: boolean;
    termsV10: boolean;
    notificationsV10: boolean;
    withdrawnDate?: string;
    withdrawalMethod?: string;
  }[];
  isAnonymized: boolean;
  exportTimestamp: string;
}

const generateRequestId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const generateCSV = (data: UserDataExport): string => {
  const rows = [
    ['Typ danych', 'Wartość', 'Data'],
    ['Imię i nazwisko', data.personalData.name, data.exportTimestamp],
    ['Telefon', data.personalData.phone, data.exportTimestamp],
    ['E-mail', data.personalData.email || 'Brak', data.exportTimestamp],
    ['', '', ''], // Empty row
    ['Historia zgód', '', ''],
  ];

  data.consentHistory.forEach((consent, index) => {
    rows.push([
      `Zgoda ${index + 1} - Data udzielenia`, 
      formatDate(consent.consentDate), 
      consent.consentDate
    ]);
    rows.push([
      `Zgoda ${index + 1} - Polityka Prywatności v1.0`, 
      consent.privacyV10 ? 'Wyrażono' : 'Nie wyrażono', 
      consent.consentDate
    ]);
    rows.push([
      `Zgoda ${index + 1} - Warunki Korzystania v1.0`, 
      consent.termsV10 ? 'Wyrażono' : 'Nie wyrażono', 
      consent.consentDate
    ]);
    rows.push([
      `Zgoda ${index + 1} - Powiadomienia`, 
      consent.notificationsV10 ? 'Wyrażono' : 'Nie wyrażono', 
      consent.consentDate
    ]);
    if (consent.withdrawnDate) {
      rows.push([
        `Zgoda ${index + 1} - Data wycofania`, 
        formatDate(consent.withdrawnDate), 
        consent.withdrawnDate
      ]);
      rows.push([
        `Zgoda ${index + 1} - Sposób wycofania`, 
        consent.withdrawalMethod || 'Nieznany', 
        consent.withdrawnDate
      ]);
    }
    rows.push(['', '', '']); // Empty row between consents
  });

  return rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

const generateJSON = (data: UserDataExport): string => {
  return JSON.stringify(data, null, 2);
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function DataExportModal({
  isOpen,
  onClose,
}: DataExportModalProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as
    | string
    | undefined;
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [exportData, setExportData] = useState<UserDataExport | null>(null);
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
        console.warn("Turnstile reset failed", err);
      }
    }
  }, [siteKey]);

  const resetForm = useCallback(() => {
    setName("");
    setPhone("");
    setEmail("");
    setState("idle");
    setError(null);
    setExportData(null);
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
          console.warn("Turnstile render failed", err);
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
          console.warn("Turnstile cleanup failed", err);
        }
      }
      widgetIdRef.current = null;
    };
  }, [isOpen, resetTurnstile, siteKey]);

  if (!isOpen) return null;

  const canSubmit =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, "").length >= 8 &&
    (siteKey ? !!token : true) &&
    state !== "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/consents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
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

      if (!res.ok) {
        const payload = (await res.json()) as ApiError;
        setError(payload);
        setState("error");
        resetTurnstile();
        setRequestId(generateRequestId());
        return;
      }

      const exportPayload = (await res.json()) as UserDataExport;
      setExportData(exportPayload);
      setState("success");
    } catch (err) {
      console.error("Data export failed", err);
      setError({
        error: "Wystąpił błąd połączenia. Spróbuj ponownie później.",
        code: "NETWORK_ERROR",
      });
      setState("error");
      resetTurnstile();
      setRequestId(generateRequestId());
    }
  }

  const handleDownloadCSV = () => {
    if (!exportData) return;
    const csv = generateCSV(exportData);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
    downloadFile(csv, `gdpr-export-${timestamp}.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadJSON = () => {
    if (!exportData) return;
    const json = generateJSON(exportData);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
    downloadFile(json, `gdpr-export-${timestamp}.json`, 'application/json;charset=utf-8');
  };

  const showHints = !!(error?.hints && error.hints.length > 0);
  const isLoading = state === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="export-modal-title" className="text-xl font-semibold text-text dark:text-dark-text">
              Pobierz moje dane
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-dark-muted">
              Wypełnij formularz, aby wyeksportować swoje dane osobowe.
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

        {state === "success" && exportData ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden="true">✓</span>
                Twoje dane osobowe
              </h3>
              
              <div className="mt-4 space-y-4 text-sm">
                <p>Dane zostały wyeksportowane: {formatDate(exportData.exportTimestamp)}</p>
                
                <div className="border-t border-emerald-300/50 pt-4">
                  <h4 className="font-semibold mb-2">📋 DANE OSOBOWE</h4>
                  <div className="space-y-1">
                    <div><strong>Imię i nazwisko:</strong> {exportData.personalData.name}</div>
                    <div><strong>Numer telefonu:</strong> {exportData.personalData.phone}</div>
                    <div><strong>Adres e-mail:</strong> {exportData.personalData.email || 'Brak'}</div>
                  </div>
                </div>
                
                <div className="border-t border-emerald-300/50 pt-4">
                  <h4 className="font-semibold mb-2">🔒 HISTORIA ZGÓD</h4>
                  {exportData.consentHistory.map((consent, index) => (
                    <div key={index} className="mb-3 p-2 bg-emerald-100/50 rounded">
                      <div><strong>Zgoda udzielona:</strong> {formatDate(consent.consentDate)}</div>
                      <div>• Polityka Prywatności v1.0: {consent.privacyV10 ? '✅ Wyrażono' : '❌ Nie wyrażono'}</div>
                      <div>• Warunki Korzystania v1.0: {consent.termsV10 ? '✅ Wyrażono' : '❌ Nie wyrażono'}</div>
                      <div>• Powiadomienia: {consent.notificationsV10 ? '✅ Wyrażono' : '❌ Nie wyrażono'}</div>
                      {consent.withdrawnDate && (
                        <div className="mt-1 text-orange-700">
                          <strong>Wycofano:</strong> {formatDate(consent.withdrawnDate)} ({consent.withdrawalMethod})
                        </div>
                      )}
                      <div><strong>Adres IP (zamaskowany):</strong> {consent.ipHash}</div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-emerald-300/50 pt-4">
                  <p><strong>ⓘ</strong> To wszystkie dane osobowe które nam przekazałeś/aś i które przechowujemy w naszym systemie.</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 sm:flex-row">
              <button 
                onClick={handleDownloadCSV}
                className="btn btn-outline flex-1"
              >
                Pobierz jako plik CSV
              </button>
              <button 
                onClick={handleDownloadJSON}
                className="btn btn-outline flex-1"
              >
                Pobierz jako plik JSON
              </button>
              <button className="btn btn-primary flex-1" onClick={handleClose}>
                Zamknij
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="export-name">
                Imię i nazwisko
              </label>
              <input
                id="export-name"
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
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="export-phone">
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
              <label className="text-sm font-medium text-text dark:text-dark-text" htmlFor="export-email">
                E-mail <span className="text-xs text-neutral-500 dark:text-dark-muted">(opcjonalnie)</span>
              </label>
              <input
                id="export-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-border bg-white/90 px-4 py-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-dark-border dark:bg-dark-card/80 dark:text-dark-text"
                placeholder="twoj.email@example.com"
                autoComplete="email"
              />
            </div>

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
                {isLoading ? 'Pobieranie danych…' : 'Pobierz moje dane'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
