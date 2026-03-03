"use client";

import React, { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "app_pin_authed";
const PIN = process.env.NEXT_PUBLIC_APP_PIN;

export function PinGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    // If no PIN is configured, skip the gate entirely
    if (!PIN) {
      setAuthed(true);
      return;
    }
    setAuthed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input === PIN) {
        localStorage.setItem(STORAGE_KEY, "true");
        setAuthed(true);
      } else {
        setError(true);
        setInput("");
      }
    },
    [input]
  );

  // Still checking localStorage
  if (authed === null) return null;

  if (authed) return <>{children}</>;

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Deep Agent</h1>
          <p className="text-sm text-muted-foreground">Enter your PIN to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="PIN"
            autoFocus
            className="w-full rounded-md border border-border bg-card px-4 py-3 text-center text-lg tracking-widest text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && (
            <p className="text-center text-sm text-destructive">Incorrect PIN. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-[#2F6868] py-3 text-sm font-medium text-white hover:bg-[#2F6868]/80"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
