"use client";
import { useEffect, useState } from "react";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastItem {
  id: number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<(t: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(items);
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(t: Omit<ToastItem, "id">) {
  const item: ToastItem = { id: ++seq, variant: "default", ...t };
  items = [...items, item];
  emit();
  setTimeout(() => dismissToast(item.id), 4000);
  return item.id;
}

export function useToasts() {
  const [state, setState] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setState);
    setState(items);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
