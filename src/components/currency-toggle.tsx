"use client";
import { useCurrency } from "@/components/currency-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";
import { Coins } from "lucide-react";

export function CurrencyToggle() {
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  return (
    <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
      <SelectTrigger className="h-8 w-[100px] gap-1.5" title="Display currency">
        <Coins className="h-3.5 w-3.5 opacity-60" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
