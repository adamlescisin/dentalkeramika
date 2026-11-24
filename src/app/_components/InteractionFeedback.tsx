"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const CONTROL = "button, a, [role='button'], input[type='submit']";
const NAV_TIMEOUT_MS = 12000;

// Router prefetches and third-party calls (analytics) are not user actions.
function isBackgroundRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("Next-Router-Prefetch")) return true;
  const raw = input instanceof Request ? input.url : input.toString();
  return new URL(raw, window.location.href).origin !== window.location.origin;
}

// Marks the control the user just activated as pending (spinner + click lock) while the
// navigation or API requests it started are in flight, and shows a top progress bar.
export function InteractionFeedback() {
  const pathname = usePathname();
  const [inflight, setInflight] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const armed = useRef<HTMLElement | null>(null);
  const navEl = useRef<HTMLElement | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const pendingCounts = new Map<HTMLElement, number>();

    const setPending = (el: HTMLElement) => el.setAttribute("data-pending", "");
    const clearPending = (el: HTMLElement) => el.removeAttribute("data-pending");

    const arm = (el: HTMLElement | null) => {
      armed.current = el;
      // Click handlers start their fetch synchronously; disarm once they have run.
      setTimeout(() => { if (armed.current === el) armed.current = null; }, 60);
    };

    const startNav = (el: HTMLElement | null) => {
      setNavigating(true);
      if (el) { navEl.current = el; setPending(el); }
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(endNav, NAV_TIMEOUT_MS);
    };

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(CONTROL) as HTMLElement | null;
      if (!el || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;

      if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href");
        if (!href || href.startsWith("#") || el.target === "_blank" || el.hasAttribute("download")) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const url = new URL(el.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        startNav(el);
        return;
      }
      arm(el);
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const submitter = (e.submitter as HTMLElement | null)
        ?? form.querySelector<HTMLElement>("button[type='submit'], button:not([type]), input[type='submit']");
      // A form without a JS handler performs a full navigation (e.g. logout).
      setTimeout(() => {
        if (!e.defaultPrevented) startNav(submitter);
      }, 0);
      arm(submitter);
    };

    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      if (isBackgroundRequest(input, init)) return originalFetch(input, init);
      const el = armed.current;
      setInflight((n) => n + 1);
      if (el) {
        pendingCounts.set(el, (pendingCounts.get(el) ?? 0) + 1);
        setPending(el);
      }
      return originalFetch(input, init).finally(() => {
        setInflight((n) => Math.max(0, n - 1));
        if (el) {
          const left = (pendingCounts.get(el) ?? 1) - 1;
          if (left <= 0) {
            pendingCounts.delete(el);
            if (navEl.current !== el) clearPending(el);
          } else {
            pendingCounts.set(el, left);
          }
        }
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", endNav);
    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", endNav);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function endNav() {
    setNavigating(false);
    if (navEl.current) { navEl.current.removeAttribute("data-pending"); navEl.current = null; }
    if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null; }
  }

  useEffect(() => { endNav(); }, [pathname]);

  const busy = navigating || inflight > 0;

  useEffect(() => {
    if (busy) document.body.setAttribute("data-busy", "");
    else document.body.removeAttribute("data-busy");
  }, [busy]);

  return <div className="dk-progress" data-active={busy ? "" : undefined} role="progressbar" aria-hidden={!busy} aria-label="Načítání" />;
}
