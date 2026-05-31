/**
 * LOCKED — production UX copy system (end of architecture phase for messaging).
 * Source of truth: `CORE_PRODUCT_COPY` only. UI: `import { CORE_PRODUCT_COPY as COPY }` and `COPY.*` property access.
 * Do not add access layers, path getters, UI_MESSAGE_MAP, runtime contextual merge, or new helpers that return
 * the whole copy object. See `eslint-plugin-privacy-eraser` rule `no-messaging-legacy-api`.
 * Content edits: strings inside `_CORE_RAW` / copy tree only. Run `npm run lint:product`.
 * `ContextualOverrideShape` / `CONTEXTUAL_OVERRIDES`: future build-time A/B only — not merged at runtime.
 */

import { PRODUCT_PHILOSOPHY } from "./product-language-rules";

export { PRODUCT_PHILOSOPHY };

/** @remarks Reserved for a future A/B or segmentation map — not read at runtime today. */
export type MessageContext = "dashboard" | "scanner" | "paywall" | "marketing";

const _CORE_RAW = {
  philosophy: PRODUCT_PHILOSOPHY,

  meta: {
    title: "PrivacyEraser.ai — Personal Data Protection",
    description:
      "Identity exposure detection and removal for the U.S.: scan data-broker and public sources, then opt in once for Lifetime Protection — permanent removal attempts and continuous monitoring."
  },

  hero: {
    headline: "We Nuke Your Exposure Before It Nukes You.",
    subtext:
      "This is an intelligence operation. We scan, identify, neutralize, and verify the brokers and breach nodes leaking your identity — then we keep them down.",
    primaryCta: "Launch Free Exposure Scan",
    secondaryCta: "See how it works",
    noCardFootnote: "Live scan across broker indexes + secure vault partitions",
    trustLayer: [
      "Verified signals — not guesswork",
      "Local vault search when enabled",
      "Real-time session intelligence"
    ] as const
  },

  /** Landing + scan page: instant credibility (no implied press logos). */
  instantCredibility: {
    line1: "Used by individuals concerned about online data exposure",
    line2: "Scanning 100+ data broker sources",
    line3: "Built for privacy and data exposure detection"
  },

  /** Short labels; realistic — session encryption, not full-disk product claim. */
  trustIndicators: [
    { title: "Encryption", text: "AES-256 encryption protects your account and session data" },
    { title: "No data selling", text: "We never sell or share your personal information" },
    {
      title: "Continuous Protection",
      text:
        "Your protection runs automatically in the background. We continuously monitor data broker exposure and initiate ongoing removal requests."
    },
    { title: "On-Demand Scans", text: "Run a scan anytime to instantly check your current exposure" },
    {
      title: "Regular Privacy Reports",
      text:
        "Receive monthly email summaries of your exposure and removal activity — plus updates whenever important changes are detected."
    },
    { title: "Privacy-first", text: "Built to minimize data collection and protect your privacy at every step" }
  ] as const,

  /** Qualitative, compliance-safe. Placeholder quotes are labeled in UI, not as reviews. */
  socialProof: {
    lines: [
      "Thousands of exposure scans completed across the U.S.",
      "Users across the United States",
      "High-risk identity exposure is detected every day across the U.S."
    ] as const,
    exampleNote: "Sample quotes (illustration only — not verified customer stories):",
    exampleQuotes: [
      {
        text: "I didn’t know my address was public until I scanned.",
        by: "Example user"
      },
      {
        text: "This showed me data I had no idea was online.",
        by: "Example user"
      }
    ] as const
  },

  securityShield: {
    badge: "Dark Web Surveillance",
    title: "Continuous Dark Web Surveillance & Live Identity Interception",
    body:
      "PrivacyEraser does not just monitor the web—we take action. While Dark Web breaches are kept under 24/7 surveillance with instant emergency alerts to secure your accounts, our system actively deploys automated removal protocols to completely erase your personal information, home addresses, and phone numbers from all major data broker sites across the internet.",
    badges: [
      "24/7 Dark Web Monitoring",
      "Automated Data Removal From All Broker Sites",
      "Instant Emergency Alerts"
    ] as const
  },

  scan: {
    sectionTitle: "Free exposure scan",
    sectionDescription:
      "Run a high-stakes scan across broker indexes and your secure vault.",
    panelTitle: "Launch your scan",
    panelDescription: "Primary targeting: Full Name + State. Email is used for breach matching and your report delivery.",
    valueProp: {
      kicker: "Not a toy scanner.",
      body:
        "We nuke the listings and signals that expose your address, phone, and identity graph — and keep watching for re-appearance."
    },
    form: {
      fullNameLabel: "Full name",
      fullNamePlaceholder: "Target name (required)",
      emailLabel: "Email",
      emailPlaceholder: "Required for breach matching",
      emailUsageNote:
        "Used to compute breach exposure and deliver your report. No spam. No selling.",
      stateLabel: "State",
      statePlaceholder: "Select your state (required)",
      stateError: "Select your U.S. state to run the scan",
      runButton: "Run Exposure Scan",
      nameTooLong: "Name is too long",
      emailInvalid: "Enter a valid email"
    },
    trustDataHandling: {
      line1: "We never sell your data. Ever.",
      line2: "We only store what’s required to run your protection.",
      line3: "Sensitive data is automatically deleted after processing."
    },
    scannerIdle:
      "Enter your Full Name + State. Provide your email to compute breach matches and generate your report — no sign-in required.",
    scanningHelper:
      "We use aggregated and publicly available signals to model exposure — without accessing private user credentials or third-party logins.",
    result: {
      /** Shock result — one headline + subtext, risk line, then four rows only. */
      shockHeadline: "Your Personal Data Exposure Report",
      shockSubtext:
        "We identified potential exposure across multiple independent data broker sources",
      exposureRiskLine:
        "This type of exposure is commonly used for identity theft, scams, and unwanted contact.",
      categoryLabel: {
        address: "Potentially exposed in public records and broker listings",
        phone: "Often found in data broker and marketing databases",
        email: "Commonly linked across multiple online data sources",
        relatives: "Associated profiles and household connections may be visible"
      } as const,
      statusExposed: "EXPOSED",
      statusFound: "FOUND",
      statusLinked: "LINKED",
      cta: "Activate Lifetime Protection",
      /** Subtle line below primary CTA on result (optional emphasis). */
      postCtaNote: "One-time payment • Permanent protection system access",
      viewFullReport: "View details and pricing",
      identityAudit: {
        title: "Identity Exposure Audit",
        addressesTitle: "Address Signals",
        phoneTitle: "Phone Signals",
        photoTitle: "Public Identity Photo",
        brokerTitle: "Data Broker Exposure",
        photoDetected: "Public Identity Photo Detected",
        legalDisclaimer:
          "All data shown is retrieved from public records and data broker databases. We do not store this data; we only facilitate its removal."
      }
    },
    pipeline: {
      scanStep1: "Scanning data broker networks…",
      scanStep2: "Analyzing identity exposure…",
      scanStep3: "Checking public data sources…"
    },
    genericError: "We couldn’t complete the scan. Check your connection and try again."
  },

  /** Post-scan / post-paywall: private warning to share a heads-up (no public posting). */
  privateInvite: {
    title: "Want to check if your friends are exposed too?",
    message:
      "I just scanned my identity and found my data exposed. You should check yours too.",
    ctaCopyLink: "Copy link",
    ctaSms: "Share via SMS",
    ctaEmail: "Share via Email",
    emailSubject: "Worth a quick look — your personal data may be exposed",
    helperLine: "Private warning · not a public post"
  },

  paywall: {
    headline: "Remove & Protect Your Personal Data Permanently",
    priceMain: "$149 — Lifetime Access",
    priceOneTime: "one-time payment",
    noSubscriptionsLine: "One-time payment • Permanent protection system access",
    valueStack: [
      { line: "Continuous monitoring of data broker exposure" },
      { line: "Automated removal request system" },
      { line: "Re-submission if data reappears" },
      { line: "Verification-based removal tracking" },
      { line: "Monthly privacy exposure reports" },
      { line: "Real-time exposure alerts" },
      { line: "AES-256 encrypted session protection" },
      { line: "No data selling or third-party sharing" },
      { line: "Designed to align with modern U.S. consumer privacy and data protection standards" }
    ] as const,
    trustLine: "One-time payment • Continuous protection • No recurring charges",
    cta: "Activate Lifetime Protection",
    ctaLoading: "Opening secure checkout…",
    viewDetails: "View details",
    trustDataHandling: {
      line1: "We never sell your data. Ever.",
      line2: "We only store what’s required to run your protection.",
      line3: "Sensitive data is automatically deleted after processing."
    }
  },

  howItWorks: {
    title: "How the operation runs",
    subtext: "Scan. Identify. Neutralize. Verify. Repeat until the exposure stays down.",
    steps: [
      {
        id: "scan",
        title: "Scan",
        body: "Sweep broker indexes + secure vault partitions to map your exposure surface."
      },
      {
        id: "detect",
        title: "Identify",
        body: "Correlate signals to your identity footprint and flag the highest-risk nodes."
      },
      {
        id: "remove",
        title: "Neutralize",
        body: "Paid users trigger automated legal notices + evidence packets to brokers."
      },
      {
        id: "verify",
        title: "Verify results",
        body: "Continuously re-verify deletion status and re-trigger operations if exposure returns."
      }
    ] as const
  },

  trust: {
    kicker: "Method",
    headline: "Identity exposure detection and removal system for U.S. residents",
    badges: [
      "No data selling — your information is never sold to third parties",
      "Secure encryption (AES-256) protects your account and session data",
      "Sensitive data auto deletion policy after processing",
      "We use aggregated and publicly available signals to model exposure — without accessing private user credentials or third-party logins."
    ] as const
  },

  pricing: {
    sectionTitle: "Lifetime protection",
    sectionSubtext: "One primary offer — permanent data exposure control for your identity footprint.",
    cardKicker: "Primary offer",
    offerTitle: "Lifetime Protection",
    price: "$149",
    oneTimeLabel: "one-time",
    payOnceLine: "Pay once. Stay protected forever.",
    cta: "Get Lifetime Protection — $149",
    features: [
      "Automatic data broker removal",
      "Continuous monitoring for relisted data",
      "Re-submission if your information reappears",
      "Lifetime product updates for supported brokers"
    ] as const
  },

  footer: {
    brand: "PrivacyEraser.ai",
    blurb:
      "U.S. exposure neutralization: scan for broker + breach signals, nuke listings, and verify reappearance — pay once for lifetime coverage.",
    columns: {
      product: "Product",
      company: "Company",
      legal: "Legal",
      support: "Support"
    },
    links: {
      freeScan: "Free privacy scan",
      manualGuides: "Manual Removal Guides",
      removePersonalData: "Remove personal data",
      dataBrokerRemoval: "Data broker removal",
      optOutBrokers: "Opt out of data brokers",
      about: "About",
      contact: "Contact",
      support: "Support",
      faq: "FAQ",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      help: "Help Center",
      status: "Status"
    },
    copyright: "© 2026 PrivacyEraser.ai. All rights reserved.",
    privacyNote:
      "We never sell your data. Ever. We only store what’s required to run your protection. Sensitive data is automatically deleted after processing.",
    disclaimer:
      "PrivacyEraser.ai provides privacy automation tools. Results vary by data broker. Not a law firm and not legal advice."
  },

  /** /contact — support and response expectations. */
  contact: {
    pageTitle: "Contact PrivacyEraser.ai",
    kicker: "We're here to help.",
    intro:
      "If you have any questions about your scan results, Lifetime Protection, or how the system works, you can reach us directly.",
    emailLabel: "Email:",
    emailAddress: "support@privacyeraser.ai",
    responseTimeLabel: "Response time:",
    responseTimeBody: "We typically respond within 24–48 hours.",
    urgentNote:
      "For urgent issues related to data exposure or account access, please include your scan ID or email used during the scan.",
    divider: "—",
    signOffLine1: "PrivacyEraser.ai Support Team",
    signOffLine2: "U.S. data-broker exposure detection and removal system"
  },

  /** /support — contact form + enterprise framing (Resend → CONTACT_INBOX_TO). */
  supportCenter: {
    metaTitle: "Support | PrivacyEraser.ai",
    metaDescription:
      "Contact PrivacyEraser.ai for Lifetime Protection, data broker removal, and account questions. We respond within one to two business days.",
    badge: "Customer success",
    headline: "How can we help?",
    subhead:
      "Reach our team for billing, Lifetime Protection, removal status, or technical questions. Secure delivery goes straight to our operations inbox.",
    bullets: [
      "Responses typically within 24–48 hours on business days",
      "Include the email you used at checkout or during your scan for faster matching",
      "Encrypted transit; we never sell your information"
    ] as const,
    columnTitle: "Send a message",
    columnHint:
      "Use the form below so your request is routed with full context. For sensitive details, describe the issue without posting passwords or payment card numbers.",
    faqTeaser: "Looking for quick answers about Lifetime Protection?",
    faqLinkLabel: "Open FAQ",
    form: {
      nameLabel: "Name",
      namePlaceholder: "Your full name",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      subjectLabel: "Subject",
      subjectPlaceholder: "e.g. Lifetime access, removal status",
      messageLabel: "Message",
      messagePlaceholder: "Describe your question or issue — the more detail, the faster we can help.",
      submit: "Send message",
      submitting: "Sending…",
      successTitle: "Message delivered",
      successBody: "Thank you. Our team has received your message and will reply by email.",
      sendAnother: "Send another message",
      errorName: "Please enter your name",
      errorEmail: "Please enter a valid email",
      errorSubject: "Subject should be at least 3 characters",
      errorSubjectLong: "Subject must be 200 characters or fewer",
      errorMessageShort: "Message should be at least 10 characters",
      errorSend: "Could not send your message. Try again or email us directly.",
      errorNotConfiguredPrefix: "This form is not active for message delivery. Email us directly:"
    }
  },

  /** /faq — Lifetime-focused questions (dedicated page; landing uses `faq`). */
  faqPage: {
    metaTitle: "FAQ — Lifetime Protection | PrivacyEraser.ai",
    metaDescription:
      "Answers about PrivacyEraser.ai Lifetime Protection, how broker removal works, and how we protect your data.",
    kicker: "Lifetime Protection",
    headline: "Frequently asked questions",
    subhead:
      "Straight answers about coverage, removal process, and how we handle your data.",
    supportPrompt: "Still need help?",
    supportLinkLabel: "Contact support",
    items: [
      {
        question: "How does the Lifetime Deal work?",
        answer:
          "Lifetime Protection is a one-time purchase with no recurring subscription. That includes automated data broker removal attempts where supported, ongoing monitoring for relisting, and resubmission workflows when your information reappears on covered sources — plus product updates for brokers we integrate with over time."
      },
      {
        question: "How do you remove my data from brokers?",
        answer:
          "We use lawful consumer opt-out, suppression, and deletion channels each broker provides (where available). After you activate protection, we submit and track requests on your behalf and report progress in your dashboard. Brokers set their own processing timelines; when data comes back, our monitoring is designed to detect it so we can follow up again."
      },
      {
        question: "Is my data secure?",
        answer:
          "We apply industry-standard protections including encryption for account and session data, strict access controls on our systems, and a privacy-first data minimization policy: we only retain what we need to run removals and monitoring, we never sell your personal information, and sensitive inputs are removed automatically after processing whenever possible."
      }
    ] as const
  },

  faq: {
    title: "Frequently asked questions",
    items: [
      {
        question: "How does data removal work?",
        answer:
          "We identify broker and people-search listings tied to your scan, submit opt-out and deletion requests where supported, and keep watching for relisting so we can resubmit."
      },
      {
        question: "How long does it take?",
        answer:
          "Work starts as soon as Lifetime Protection is active. Timelines depend on each broker’s process; many begin responding within days."
      },
      {
        question: "Do I pay every month?",
        answer:
          "No. PrivacyEraser.ai uses a one-time Lifetime Protection payment. There are no recurring fees."
      },
      {
        question: "Is this legitimate?",
        answer:
          "We use lawful consumer opt-out and deletion channels offered by data brokers and similar sites in the regions we support."
      }
    ] as const
  },

  dashboard: {
    brokerRowLocked: "Locked",
    labels: {
      loading: "Loading",
      noScan: "No scan on file",
      exposed: "EXPOSED",
      cleaning: "CLEANING",
      protected: "PROTECTED",
      critical: "CRITICAL"
    },
    freeHeroLine: "Exposure Level: CRITICAL",
    pageTitle: "Your Exposure Control Center",
    protectionBanner: {
      headline: "Security systems active",
      body: "24/7 dark web monitoring and automated data broker removal are fully active on your account."
    },
    nav: {
      overview: "Overview",
      removal: "Removal Status",
      darkweb: "Dark Web Monitoring",
      settings: "Settings",
      support: "Support"
    },
    signedIn: "Signed in as",
    systems: {
      loadError: "Could not load your account",
      sessionNote: "Session: server (httpOnly cookie)."
    },
    free: {
      cardLabel: "Exposure level",
      exposureLevelPrefix: "Exposure Level: ",
      levelCritical: "CRITICAL",
      runScanHint: "Run a scan to detect your exposure.",
      activateCta: "Activate Lifetime Protection",
      brokerFeedTitle: "Data broker status",
      brokerFeedLocked: "Listings show exposure until Lifetime Protection is active.",
      statBrokerHits: "Broker source hits (last scan)",
      statActiveRemovals: "Active removals (queue)",
      statCompleted: "Completed removals"
    },
    paid: {
      /** Top-of-dashboard frame for all Lifetime users. */
      protectionActive: {
        title: "Protection Active",
        subtext:
          "Your protection system is continuously active in the background, monitoring exposure and maintaining ongoing removal coverage.",
        liveLabel: "Live monitoring enabled"
      },
      /** Timeline labels; which lines appear is driven by client state (scan, monitoring, queue). */
      activityTimeline: {
        sectionTitle: "Activity timeline",
        scanCompletedBackground: "Data broker scan completed in background",
        exposureRecheck: "Exposure check re-verified",
        noNewLeaks: "No new data leaks detected",
        removalRecheckActive: "Removal request re-checked and confirmed active"
      },
      valueInAction: {
        title: "Your Protection in Action",
        line1: "Continuous monitoring is running silently in the background",
        line2: "Exposure sources are continuously re-checked over time",
        line3: "Removal coverage remains active with periodic updates"
      },
      /** Section title + body; mirrors valueInAction when a dedicated “Reporting” block is rendered. */
      reporting: {
        title: "Reporting",
        body:
          "You receive periodic summaries by email with activity and current protection status. Monthly summaries are typical; timing may vary.",
        auditPdfCta: "Download Luxury PDF Report"
      },
      noFurtherAction:
        "No further action is required — your protection continues running automatically in the background.",
      cardLabel: "Data exposure control",
      statusTitle: "PROTECTED",
      labelLifetimeActive: "Lifetime Protection Active",
      headlineMonitored: "Monitoring Active",
      headlineRemovals: "Removal Requests Running",
      /** Explainer under the status lines when Lifetime Protection is active. */
      continuousProtection: {
        lead: "Your protection runs automatically in the background.",
        onceActivated:
          "We continuously monitor exposure, maintain ongoing removal requests, and re-check over time.",
        noManual:
          "No day-to-day action is required to keep this protection running in the background.",
        weHandle: "You can run a scan anytime for an on-demand look at your exposure when you want it.",
        periodicSummaries:
          "You receive periodic updates on your protection status, including monthly email summaries and additional updates when meaningful changes occur.",
        notOneTime: "This is not a one-time scan.",
        continuousIdentity: "It is continuous identity protection."
      },
      continuousMonitoring: "Status:",
      continuousMonitoringValue: "Continuous monitoring and relisting watch are on",
      removalStatus: "Removals:",
      removalStatusValue: "Opt-out and verification requests in progress with supported brokers",
      brokerFeedPaid:
        "Permanent removal and continuous monitoring: broker opt-out and verification status on file. Next scheduled re-check: ",
      monitoringNotScheduled: "— (configure in settings when available)"
    },
    greeting: {
      free: (firstName: string) =>
        `Hi, ${firstName} — one step left to lock down your exposure.`,
      paid: (firstName: string) =>
        `Hi, ${firstName} — Lifetime Protection is active. Removal and monitoring are running for your account.`
    },
    removalSection: {
      title: "Removal queue",
      lineBefore: "Without Lifetime Protection, broker targets read as ",
      lineHighlight: "EXPOSED",
      lineAfter:
        ". After purchase, the queue uses automated opt-outs, verification, and scheduled re-checks."
    },
    /** Removal tab when Lifetime is already active — no pre-purchase / upgrade framing. */
    removalSectionLifetime: {
      title: "Removal queue",
      body:
        "Your automated removal and verification requests are active. The queue re-checks in the background as brokers update, without any action required from you."
    },
    darkwebSection: {
      title: "Dark web monitoring",
      body:
        "Monitor breach dumps for your identifiers. With Lifetime Protection, alerts and coverage follow the product configuration on your account.",
      riskMeterLabel: "Live exposure risk"
    },
    settingsSection: {
      title: "Account",
      name: "Name:",
      email: "Email:"
    }
  }
} as const;

export type CoreProductCopy = typeof _CORE_RAW;

function deepFreeze<T extends object>(obj: T): T {
  for (const key of Object.getOwnPropertyNames(obj)) {
    const v = (obj as Record<string, unknown>)[key];
    if (v && typeof v === "object" && v !== null && !Object.isFrozen(v)) {
      deepFreeze(v as object);
    }
  }
  return Object.freeze(obj);
}

/** Immutable tree: hero, scan, paywall, pricing, dashboard, faq, plus marketing sections. */
export const CORE_PRODUCT_COPY: CoreProductCopy = deepFreeze(
  _CORE_RAW
) as CoreProductCopy;

type DeepMutable<T> = T extends string | number | boolean
  ? T
  : T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends ReadonlyArray<infer U>
  ? U[]
  : T extends object
  ? { -readonly [K in keyof T]?: DeepMutable<T[K]> }
  : T;

type ContextualOverrideShape = {
  [K in MessageContext]?: DeepMutable<CoreProductCopy> | undefined;
};

const _CONTEXT_OVERRIDES_MUTABLE: ContextualOverrideShape = {};

/**
 * Future feature: A/B, segmentation, or build-time copy overlays. Type-only contract today; nothing in this
 * module merges these into `CORE_PRODUCT_COPY` at runtime.
 */
export const CONTEXTUAL_OVERRIDES: Readonly<ContextualOverrideShape> = deepFreeze(
  _CONTEXT_OVERRIDES_MUTABLE
) as Readonly<ContextualOverrideShape>;

export type ProductMessaging = CoreProductCopy;

/** @internal — scan pipeline (functions + strings). */
export function getScanPipelineStatusMessages(_stateLabel: string): string[] {
  return [
    "Connecting to data broker sources...",
    "Searching public exposure indexes...",
    "Analyzing leaked datasets...",
    "Compiling verified results..."
  ];
}

export function formatDashboardGreeting(free: boolean, firstName: string): string {
  const f = firstName || "there";
  return free ? CORE_PRODUCT_COPY.dashboard.greeting.free(f) : CORE_PRODUCT_COPY.dashboard.greeting.paid(f);
}

export function formatDashboardExposureSubFreeWithScan(exposureScore: number, brokersFound: number): string {
  return `Last scan: exposure score ${exposureScore} — ${brokersFound} broker source match${brokersFound === 1 ? "" : "es"}. Activate Lifetime Protection to begin removals and monitoring.`;
}

export function formatDashboardExposureSubFreeNoScanOnFile(): string {
  return "No scan on file yet. Run a free scan on the home page, then return here to review your report.";
}

export function formatDashboardExposureSubFreeGeneric(): string {
  return "Your profile is not protected. Activate Lifetime Protection to remove broker listings and turn on monitoring.";
}

export function formatDashboardExposureExposedWithRisk(
  _riskLevel: string,
  exposureScore: number,
  brokersFound: number
): string {
  return `From your last scan — score ${exposureScore} (${brokersFound} broker source hits)`;
}

export function formatDashboardFromLastScanScoreLine(exposureScore: number, brokersFound: number): string {
  return `From your last scan — score ${exposureScore} (${brokersFound} broker source hit${brokersFound === 1 ? "" : "s"})`;
}

export function formatDashboardNoScanNeutral(): string {
  return "Run a scan on the home page to assess exposure.";
}

export function formatDashboardFallbackExposed(): string {
  return "Review your exposure in the home scanner.";
}

export function formatDashboardLoadingSub(): string {
  return "Fetching your account…";
}

export function formatDashboardProtectedCleaning(): string {
  return "Automated opt-outs in progress; brokers vary in response time.";
}

export function formatDashboardProtectedMonitoring(): string {
  return "Lifetime Protection is active. Continuous monitoring and resubmission run when data reappears.";
}

export function formatDashboardProtectedGeneric(): string {
  return "Your Lifetime Protection is active.";
}
