"use client";
import * as Toast from "@radix-ui/react-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToasts, dismissToast, type ToastVariant } from "./use-toast";

const ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
};

const ICON_COLOR: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  destructive: "text-destructive",
};

export function Toaster() {
  const items = useToasts();
  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {items.map((t) => {
        const variant = t.variant ?? "default";
        const Icon = ICON[variant];
        return (
          <Toast.Root
            key={t.id}
            onOpenChange={(o) => {
              if (!o) dismissToast(t.id);
            }}
            className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-right-full data-[swipe=end]:animate-out"
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[variant]}`} />
            <div className="min-w-0 flex-1">
              {t.title && (
                <Toast.Title className="text-sm font-medium">{t.title}</Toast.Title>
              )}
              {t.description && (
                <Toast.Description className="text-sm text-muted-foreground">
                  {t.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close className="rounded-sm text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
            </Toast.Close>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="fixed bottom-0 right-0 z-[100] m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none" />
    </Toast.Provider>
  );
}
