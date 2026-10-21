"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  LineChart,
  Wallet,
  TrendingUp,
  Landmark,
  CreditCard,
  ArrowDownUp,
  Target,
  FlaskConical,
  Trophy,
  Users,
  Settings,
  Plus,
  SunMoon,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { OPEN_ASSISTANT_EVENT } from "@/components/assistant/assistant-panel";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/net-worth", label: "Net Worth", icon: LineChart },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/assets", label: "Assets", icon: Landmark },
  { href: "/liabilities", label: "Liabilities", icon: CreditCard },
  { href: "/cashflow", label: "Cash Flow", icon: ArrowDownUp },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/simulate", label: "Simulate", icon: FlaskConical },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/family", label: "Family", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADD = [
  { href: "/accounts?new=1", label: "Add account" },
  { href: "/investments?new=1", label: "Add holding" },
  { href: "/assets?new=1", label: "Add asset" },
  { href: "/liabilities?new=1", label: "Add liability" },
  { href: "/cashflow?new=1", label: "Add income or expense" },
  { href: "/goals?new=1", label: "Add goal" },
  { href: "/family?new=1", label: "Add family member or entity" },
];

export const OPEN_COMMAND_EVENT = "orbis:open-command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Assistant">
          <CommandItem
            value="ask orbis ai assistant"
            onSelect={() => {
              setOpen(false);
              window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
            }}
          >
            <Sparkles />
            Ask Orbis
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} value={`go ${item.label}`} onSelect={() => go(item.href)}>
                <Icon />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Quick add">
          {ADD.map((item) => (
            <CommandItem key={item.href} value={`add ${item.label}`} onSelect={() => go(item.href)}>
              <Plus />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Preferences">
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            <SunMoon />
            Toggle light / dark theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
