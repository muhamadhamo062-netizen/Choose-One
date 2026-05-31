export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = (event: BeforeInstallPromptEvent | null) => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureReady = false;
const listeners = new Set<Listener>();

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt(): void {
  deferredPrompt = null;
  listeners.forEach((fn) => fn(null));
}

export function subscribeDeferredInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  listener(deferredPrompt);
  return () => listeners.delete(listener);
}

/** Call once on the client before React paint — keeps the native install event. */
export function initDeferredInstallCapture(): void {
  if (captureReady || typeof window === "undefined") {
    return;
  }
  captureReady = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn(deferredPrompt));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(null));
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
