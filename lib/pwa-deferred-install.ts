export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = (event: BeforeInstallPromptEvent | null) => void;

declare global {
  interface Window {
    __peDeferredInstall?: BeforeInstallPromptEvent | null;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureReady = false;
const listeners = new Set<Listener>();

function publishDeferred(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  if (typeof window !== "undefined") {
    window.__peDeferredInstall = event;
  }
  listeners.forEach((fn) => fn(event));
}

function hydrateFromWindow(): void {
  const stored = typeof window !== "undefined" ? window.__peDeferredInstall : null;
  if (stored && stored !== deferredPrompt) {
    publishDeferred(stored);
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  hydrateFromWindow();
  return deferredPrompt ?? (typeof window !== "undefined" ? window.__peDeferredInstall ?? null : null);
}

export function clearDeferredInstallPrompt(): void {
  publishDeferred(null);
}

export function subscribeDeferredInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  listener(getDeferredInstallPrompt());
  return () => listeners.delete(listener);
}

/** Sync with inline layout capture + live beforeinstallprompt events. */
export function initDeferredInstallCapture(): void {
  if (captureReady || typeof window === "undefined") {
    return;
  }
  captureReady = true;

  hydrateFromWindow();

  window.addEventListener("pe-install-ready", () => {
    hydrateFromWindow();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    publishDeferred(event as BeforeInstallPromptEvent);
    window.dispatchEvent(new Event("pe-install-ready"));
  });

  window.addEventListener("appinstalled", () => {
    publishDeferred(null);
  });
}

export async function promptNativeInstall(
  event: BeforeInstallPromptEvent
): Promise<"accepted" | "dismissed" | "error"> {
  try {
    await event.prompt();
    const choice = await event.userChoice;
    clearDeferredInstallPrompt();
    return choice.outcome;
  } catch {
    return "error";
  }
}

/** Wait for Chrome to emit beforeinstallprompt (after SW + manifest are ready). */
export async function waitForDeferredInstallPrompt(maxMs = 4000): Promise<BeforeInstallPromptEvent | null> {
  const existing = getDeferredInstallPrompt();
  if (existing) {
    return existing;
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const tryResolve = () => {
      const prompt = getDeferredInstallPrompt();
      if (prompt) {
        cleanup();
        resolve(prompt);
        return;
      }
      if (Date.now() - started >= maxMs) {
        cleanup();
        resolve(null);
      }
    };
    const onReady = () => tryResolve();
    const interval = window.setInterval(tryResolve, 200);
    window.addEventListener("pe-install-ready", onReady);
    const cleanup = () => {
      window.clearInterval(interval);
      window.removeEventListener("pe-install-ready", onReady);
    };
    tryResolve();
  });
}
