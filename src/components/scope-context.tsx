"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Owner } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Users } from "lucide-react";

export type ScopeValue = { kind: "all" } | { kind: "owner"; ownerId: string };

interface ScopeContextValue {
  scope: ScopeValue;
  setScope: (s: ScopeValue) => void;
  owners: Owner[];
  /** owner ids included by current scope; null = all owners. */
  ownerIds: string[] | null;
  includesOwner: (ownerId: string | null | undefined) => boolean;
}

const ScopeContext = createContext<ScopeContextValue | null>(null);
const STORAGE_KEY = "orbis.scope";

export function ScopeProvider({
  owners,
  children,
}: {
  owners: Owner[];
  children: React.ReactNode;
}) {
  const [scope, setScopeState] = useState<ScopeValue>({ kind: "all" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ScopeValue;
        if (parsed.kind === "owner") {
          if (owners.some((o) => o.id === parsed.ownerId)) setScopeState(parsed);
        } else {
          setScopeState(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, [owners]);

  function setScope(s: ScopeValue) {
    setScopeState(s);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  const ownerIds = useMemo(
    () => (scope.kind === "all" ? null : [scope.ownerId]),
    [scope],
  );

  const includesOwner = (ownerId: string | null | undefined) =>
    ownerIds === null || (ownerId != null && ownerIds.includes(ownerId));

  return (
    <ScopeContext.Provider value={{ scope, setScope, owners, ownerIds, includesOwner }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope outside ScopeProvider");
  return ctx;
}

export function ScopePicker() {
  const { scope, setScope, owners } = useScope();
  const value = scope.kind === "owner" ? `owner:${scope.ownerId}` : "all";

  function onChange(v: string) {
    if (v === "all") setScope({ kind: "all" });
    else if (v.startsWith("owner:")) setScope({ kind: "owner", ownerId: v.slice(6) });
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[170px] gap-1.5">
        <Users className="h-3.5 w-3.5 opacity-60" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Whole family</SelectItem>
        {owners.length > 0 && (
          <SelectGroup>
            <SelectLabel>Member / entity</SelectLabel>
            {owners.map((o) => (
              <SelectItem key={o.id} value={`owner:${o.id}`}>
                {o.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
