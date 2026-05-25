interface PaddleCheckoutCompletedEvent {
  name: "checkout.completed";
  data?: {
    customer?: {
      email?: string;
    };
  };
}

interface PaddleUnknownEvent {
  name: string;
  data?: unknown;
}

type PaddleEvent = PaddleCheckoutCompletedEvent | PaddleUnknownEvent;

interface PaddleSDK {
  Environment: {
    set: (mode: "sandbox" | "production") => void;
  };
  Initialize: (options: { token: string; eventCallback?: (event: PaddleEvent) => void }) => void;
  Checkout: {
    open: (options: {
      items: Array<{ priceId: string; quantity?: number }>;
      customer?: { email?: string };
    }) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleSDK;
  }
}

export {};
