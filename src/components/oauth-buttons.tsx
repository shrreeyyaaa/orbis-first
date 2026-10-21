"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Set NEXT_PUBLIC_ENABLE_APPLE_SSO="false" to hide Apple until it's configured
// (Apple sign-in requires a paid Apple Developer account).
const SHOW_APPLE = process.env.NEXT_PUBLIC_ENABLE_APPLE_SSO !== "false";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor">
      <path d="M16.37 12.78c.03 2.94 2.58 3.92 2.61 3.93-.02.07-.41 1.4-1.35 2.78-.81 1.19-1.65 2.38-2.98 2.4-1.3.03-1.72-.77-3.21-.77-1.49 0-1.95.75-3.18.8-1.28.05-2.25-1.29-3.07-2.48-1.67-2.42-2.95-6.83-1.23-9.81.85-1.48 2.38-2.42 4.04-2.44 1.26-.03 2.44.85 3.21.85.77 0 2.21-1.05 3.72-.9.63.03 2.41.26 3.55 1.92-.09.06-2.12 1.24-2.1 3.69M13.94 4.5c.68-.83 1.14-1.98.99-3.13-.98.04-2.17.66-2.88 1.48-.63.73-1.18 1.9-1.03 3.02 1.1.09 2.23-.56 2.92-1.37" />
    </svg>
  );
}

export function OAuthButtons({ next }: { next?: string | null }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "apple") {
    setLoading(provider);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // on success the browser is redirected to the provider
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Button variant="outline" className="w-full" onClick={() => signIn("google")} disabled={loading !== null}>
          <GoogleIcon />
          {loading === "google" ? "Redirecting…" : "Continue with Google"}
        </Button>
        {SHOW_APPLE && (
          <Button variant="outline" className="w-full" onClick={() => signIn("apple")} disabled={loading !== null}>
            <AppleIcon />
            {loading === "apple" ? "Redirecting…" : "Continue with Apple"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="relative text-center">
        <span className="bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
          or
        </span>
        <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
      </div>
    </div>
  );
}
