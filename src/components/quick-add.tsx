"use client";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Wallet,
  TrendingUp,
  Landmark,
  CreditCard,
  ArrowDownUp,
  Target,
  Users,
} from "lucide-react";

const ITEMS = [
  { href: "/accounts?new=1", label: "Account", icon: Wallet },
  { href: "/investments?new=1", label: "Holding", icon: TrendingUp },
  { href: "/assets?new=1", label: "Asset", icon: Landmark },
  { href: "/liabilities?new=1", label: "Liability", icon: CreditCard },
  { href: "/cashflow?new=1", label: "Income / Expense", icon: ArrowDownUp },
  { href: "/goals?new=1", label: "Goal", icon: Target },
  { href: "/family?new=1", label: "Family / Entity", icon: Users },
];

export function QuickAdd() {
  const router = useRouter();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="gold" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[13rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Add new
          </DropdownMenu.Label>
          {ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <DropdownMenu.Item
                key={it.href}
                onSelect={() => router.push(it.href)}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {it.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
