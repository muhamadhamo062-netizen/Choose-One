interface LemonSqueezyCheckoutEvent {
  event: string;
  data?: {
    id?: string;
    type?: string;
    attributes?: Record<string, unknown>;
  };
}

interface LemonSqueezyGlobal {
  Setup: (options: { eventHandler?: (event: LemonSqueezyCheckoutEvent) => void }) => void;
  Url: {
    Open: (url: string) => void;
    Close: () => void;
  };
  Refresh?: () => void;
}

declare global {
  interface Window {
    LemonSqueezy?: LemonSqueezyGlobal;
    createLemonSqueezy?: () => void;
  }
}

export {};
