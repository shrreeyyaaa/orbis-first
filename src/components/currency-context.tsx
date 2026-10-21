"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildRateMap, toBase, type RateMap } from "@/lib/fx";
import { formatMoney } from "@/lib/currency";
import type { ExchangeRate } from "@/lib/types";

interface CurrencyContextValue {
  reportingCurrency: string;
  displayCurrency: string;
  setDisplayCurrency: (c: string) => void;
  rates: RateMap;
  /** format a reporting-currency minor value in the active display currency. */
  show: (minorInReporting: number, opts?: { compact?: boolean }) => string;
  /** convert a reporting-currency minor value into display-currency minor units. */
  toDisplay: (minorInReporting: number) => number;
  /** format minor units already in a given currency. */
  fmt: (minor: number, currency: string, opts?: { compact?: boolean }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const STORAGE_KEY = "orbis.displayCurrency";

export function CurrencyProvider({
  reportingCurrency,
  exchangeRates,
  initialDisplayCurrency,
  children,
}: {
  reportingCurrency: string;
  exchangeRates: ExchangeRate[];
  initialDisplayCurrency?: string | null;
  children: React.ReactNode;
}) {
  const rates = useMemo(() => buildRateMap(exchangeRates), [exchangeRates]);
  const [displayCurrency, setDisplayCurrencyState] = useState(
    initialDisplayCurrency || reportingCurrency,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDisplayCurrencyState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  function setDisplayCurrency(c: string) {
    setDisplayCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }

  const toDisplay = (minorInReporting: number) =>
    toBase(minorInReporting, reportingCurrency, displayCurrency, rates);

  const show = (minorInReporting: number, opts?: { compact?: boolean }) =>
    formatMoney(toDisplay(minorInReporting), displayCurrency, opts);

  const fmt = (minor: number, currency: string, opts?: { compact?: boolean }) =>
    formatMoney(minor, currency, opts);

  return (
    <CurrencyContext.Provider
      value={{
        reportingCurrency,
        displayCurrency,
        setDisplayCurrency,
        rates,
        show,
        toDisplay,
        fmt,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency outside CurrencyProvider");
  return ctx;
}
