import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://privacyeraser.ai";

export const SEO_HUB_LINKS: readonly { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/#scanner", label: "Free identity scan" },
  { href: "/remove-personal-data", label: "Remove personal data" },
  { href: "/data-broker-removal", label: "Data broker removal" },
  { href: "/opt-out-data-brokers", label: "Opt out of data brokers" },
  { href: "/delete-my-information", label: "Delete my information" }
] as const;

export type SeoPageKey =
  | "remove-personal-data"
  | "data-broker-removal"
  | "opt-out-data-brokers"
  | "delete-my-information"
  | "remove-spokeo"
  | "remove-whitepages"
  | "remove-beenverified"
  | "remove-truthfinder";

export type SeoPageDef = {
  key: SeoPageKey;
  h1: string;
  title: string;
  description: string;
  openGraphTitle?: string;
  openGraphDescription?: string;
  breadcrumbLabel: string;
  intro: readonly string[];
  problem: { h2: string; body: readonly string[] };
  solution: { h2: string; body: readonly string[] };
};

const pages: Record<SeoPageKey, SeoPageDef> = {
  "remove-personal-data": {
    key: "remove-personal-data",
    h1: "How to Remove My Personal Information From the Internet",
    title: "Remove My Personal Information From the Internet | PrivacyEraser.ai",
    description:
      "Step-by-step help to remove my personal information from the internet. Scan 100+ U.S. data broker and people-search sources, then protect your identity with one-time Lifetime Protection.",
    breadcrumbLabel: "Remove personal data",
    intro: [
      "In the United States, your name, address, phone number, and family ties are routinely packaged and resold. If you have searched for how to remove my personal information from the internet, you are not overreacting — the exposure is real, and the listings update constantly.",
      "People ask whether there is a single permanent fix. The best path is to first see where you appear, then work removals through broker-specific channels. PrivacyEraser.ai is built to show exposure fast and support ongoing takedowns when you activate Lifetime Protection."
    ],
    problem: {
      h2: "Why “remove my personal information from the internet” keeps coming back",
      body: [
        "A serious data broker removal service has to work the same way you do: brokers refresh profiles when new public records, marketing lists, or third-party data matches appear. If you are asking is my personal data exposed online, the honest answer is often yes — the question is how widely and in which networks.",
        "When you need to remove leaked personal data, partial opt-outs are common. A manual delete on one site may leave copies on people search aggregators, which is a common reason your details resurface when you ask how does my data end up on Google again through indexed people-search pages.",
        "Risks go beyond ads. Exposed information fuels phishing, sim-swap and account takeover, and imposter scams. A practical path for how to protect my identity online is to cut off easy recon first — the exact listings brokers sell — before fraud scales."
      ]
    },
    solution: {
      h2: "A scan-first way to find exposure and act",
      body: [
        "PrivacyEraser.ai starts with a free identity scan. We detect where your data may be exposed across 100+ broker-style and people-search style sources for your U.S. state context — a practical answer when you are comparing the best way to delete your information from people search sites without guessing.",
        "From the exposure result, you can move to Lifetime Protection: supported removal requests, monitoring, and re-submission when data reappears. You get one CTA, one price — the same path every SEO page on this site is designed to support."
      ]
    }
  },
  "data-broker-removal": {
    key: "data-broker-removal",
    h1: "Data Broker Removal Service for the United States",
    title: "Data Broker Removal Service | Personal Data Removal in the USA | PrivacyEraser",
    description:
      "A personal data removal service for USA residents: see broker exposure, opt out where supported, and keep monitoring. Start with a free scan — $149 one-time Lifetime Protection with no recurring billing.",
    breadcrumbLabel: "Data broker removal",
    intro: [
      "A modern data broker removal service is not a single “delete” button. Brokers operate under different rules, some require ID checks, and many re-list your profile after a few months. For U.S. users who want a structured approach, the goal is a repeatable workflow: find listings, request removal, verify, and re-check.",
      "If you are comparing a personal data removal service in the USA, look for software that shows what was found (not a vague “score”) and that can keep working after the first takedown wave."
    ],
    problem: {
      h2: "What are data brokers — and what they do with your file",
      body: [
        "Data brokers collect identifiers from public records, marketing data, and partner feeds. If you are researching how do data brokers get my information, the short version is: public-record digitization, marketing cooperatives, and data matching — and the same inputs power background checks and people search sites, which is why you may need both broker opt-outs and people-search clean-up.",
        "Scams and account takeover often start with a single accurate detail pulled from a broker page. A personal data removal service in the U.S. has to address scale: dozens of sites, not one form."
      ]
    },
    solution: {
      h2: "PrivacyEraser: scan, then support removals at scale",
      body: [
        "We help you start with a free scan that flags exposure patterns tied to 100+ sources in a U.S. state context, then you can move into Lifetime Protection for ongoing opt-out and monitoring workflows. No new accounts are required to run the first scan on our home experience."
      ]
    }
  },
  "opt-out-data-brokers": {
    key: "opt-out-data-brokers",
    h1: "Opt Out of Data Brokers — the Realistic Way",
    title: "Opt Out of Data Brokers | Bulk Opt-Out & Monitoring | PrivacyEraser",
    description:
      "How to opt out of data broker websites: find what lists you, submit supported requests, and keep watching for relisting. Free scan, then $149 one-time lifetime coverage.",
    breadcrumbLabel: "Opt out of data brokers",
    intro: [
      "To opt out of data brokers, you have to outlast their refresh cycles. Some forms take minutes, others need mail or ID checks. The intent keyword people search is often how to opt out of all data broker websites at once — in practice, “all at once” is automation plus persistence, not one magical checkbox.",
      "PrivacyEraser is built to reduce guesswork: we surface what the scan can see, then you choose Lifetime Protection to operationalize the follow-through."
    ],
    problem: {
      h2: "How to stop data brokers from selling my data (without burning out)",
      body: [
        "Brokers are incentivized to republish data when they believe it is still “accurate enough.” If you are researching how to stop data brokers from selling my data, expect a maintenance mindset — not a one-time purge, and a realistic answer to how to opt out of all data broker websites at once is automation with verification — not a single checkbox for every network.",
        "If you are asking why is my information online, brokers treat verified fragments as a product. The defensive goal is to stop identity theft before it happens by shrinking what a criminal can buy or guess cheaply, because even “stale” address history can work in a social-engineering script."
      ]
    },
    solution: {
      h2: "Start with a scan, then let opt-outs compound",
      body: [
        "Start free: we map exposure signals in our scan, then you can add Lifetime Protection for removal support and re-submission. That is the same opt-out of data brokers strategy large privacy teams use — packaged for individuals."
      ]
    }
  },
  "delete-my-information": {
    key: "delete-my-information",
    h1: "Delete My Data From Data Brokers — What Actually Works",
    title: "Delete My Data From Data Brokers | People-Search Removal | PrivacyEraser",
    description:
      "Delete my data from data broker listings and people search sites. Free exposure scan, then one-time $149 Lifetime Protection to pursue removals and monitor relisting.",
    breadcrumbLabel: "Delete my information",
    intro: [
      "The phrase delete my data from data brokers is one of the clearest high-intent searches: you are not looking for a blog, you are looking to reduce harm. The constraint is that brokers differ — some have fast portals, some hide behind data vendors.",
      "A practical first step is to know where a profile likely exists, then work supported deletion paths. PrivacyEraser starts with a scan that reflects real broker-style exposure, not a personality quiz."
    ],
    problem: {
      h2: "Am I on people search websites? Probably — here is why that matters",
      body: [
        "Even if you are careful online, you can appear on people search websites through property records, voter rolls where applicable, and old breaches. If you are asking am I on people search websites, assume yes until a scan or manual review proves otherwise.",
        "To remove your information from people search sites, you will repeat similar identity verification steps. That repetition is what makes automation and monitoring part of a serious answer to delete my data from the internet, not a weekend project you finish once and forget."
      ]
    },
    solution: {
      h2: "Run the scan, then protect against relisting",
      body: [
        "PrivacyEraser’s scan shows exposure context so you are not working blind, and Lifetime Protection helps keep removals moving when new listings appear. That is a practical, step by step path compared with guessing your way through dozens of one-off opt-outs when you need to delete my data from the internet in more than one place at once."
      ]
    }
  },
  "remove-spokeo": {
    key: "remove-spokeo",
    h1: "How to Remove Data From Spokeo and Similar People Search Listings",
    title: "Remove My Information From Spokeo | Spokeo Opt-Out & Scan | PrivacyEraser",
    description:
      "How to remove data from Spokeo: opt-out path, what to expect, and how to see broader broker exposure. Start with a free U.S. identity scan, then $149 Lifetime Protection.",
    breadcrumbLabel: "Remove Spokeo",
    intro: [
      "Spokeo is one of the most-searched people data brands in the U.S. If you are trying to remove data from Spokeo specifically, the goal is the same as every similar network: get the record suppressed, then check whether copies live on other brokers and aggregators.",
      "Our tool is not a single-site widget — it is a scan-first way to see where else your identity is exposed, which matters because Spokeo-style data rarely appears in one place only."
    ],
    problem: {
      h2: "Why Spokeo removal can look “done” and come back",
      body: [
        "People search networks refresh from upstream providers. A successful opt-out on one day does not always stop re-ingestion. That is why a scan plus monitoring beats a one-off form when you are serious about remove my information from people search sites."
      ]
    },
    solution: {
      h2: "Start with a free scan, then scale removal",
      body: [
        "PrivacyEraser shows exposure across 100+ broker-style sources, then you can add Lifetime Protection to help pursue removals and resubmit if your profile returns — a stronger complement than Spokeo-only cleanup alone."
      ]
    }
  },
  "remove-whitepages": {
    key: "remove-whitepages",
    h1: "How to Remove Data From Whitepages and Public Listings",
    title: "Remove Data From Whitepages | Opt-Out & Broader Scan | PrivacyEraser",
    description:
      "Remove data from Whitepages: what to know about opt-out, relisting, and your wider broker footprint. Free identity scan, then $149 one-time lifetime protection and monitoring.",
    breadcrumbLabel: "Remove Whitepages",
    intro: [
      "Many consumers start with remove data from Whitepages because the brand is well known in the U.S. and results often surface on the first page of search. The technical reality is the same as other data brokers: suppress the display, then watch for the same contact graph to reappear.",
      "Use PrivacyEraser to understand exposure beyond a single site — a requirement if you are comparing the best way to delete your information from people search sites."
    ],
    problem: {
      h2: "What data brokers are doing when they “verify” a profile",
      body: [
        "If you are learning what are data brokers, think of them as data warehouses that also sell a search experience. A Whitepages page is one storefront; the inventory may be mirrored elsewhere, which is how does my data end up on Google even after a removal — copies and cache."
      ]
    },
    solution: {
      h2: "One scan, then a protection layer that can keep working",
      body: [
        "Run the free scan, review exposure, and move into Lifetime Protection when you are ready for ongoing removal and monitoring — the same CTA you will see on every page in this section."
      ]
    }
  },
  "remove-beenverified": {
    key: "remove-beenverified",
    h1: "How to Remove My Information From BeenVerified",
    title: "Remove My Information From BeenVerified | Scan + Lifetime Removal | PrivacyEraser",
    description:
      "How to remove data from BeenVerified and see where else you appear. Free scan across 100+ U.S. sources, then $149 Lifetime Protection for removal support and relisting watch.",
    breadcrumbLabel: "Remove BeenVerified",
    intro: [
      "Searches to remove my information from BeenVerified are common for job seekers, abuse survivors, and anyone who saw their phone number in a public hit. A brand-specific opt-out is a good start, but the durable fix is a wider inventory of where your identifiers appear.",
      "PrivacyEraser is built to answer the next question: what else is still exposed after BeenVerified is addressed?"
    ],
    problem: {
      h2: "Identity theft risk when phone and address stay public",
      body: [
        "When you are comparing an identity theft protection service with broker-focused work, the difference is where the work happens. Alerts after misuse help, but removing broker listings targets the same phone + address + relatives bundle that scammers use for impersonation before a transaction starts.",
        "A BeenVerified page can feed that package. The goal is to remove leaked personal data at the source where possible, not only hide one URL."
      ]
    },
    solution: {
      h2: "Map exposure, then work removals with a plan",
      body: [
        "Our scan highlights broker-style risk so you are not working site-by-site in the dark, then you can add Lifetime Protection for removal workflows that track relisting. That is the same funnel as every other page here: scan → result → one-time offer."
      ]
    }
  },
  "remove-truthfinder": {
    key: "remove-truthfinder",
    h1: "How to Remove Data From TruthFinder-Style People Search Records",
    title: "Remove Data From TruthFinder & Similar Sites | Free Scan | PrivacyEraser",
    description:
      "How to remove data from TruthFinder and related people-search profiles. Start with a free U.S. scan across 100+ sources, then $149 Lifetime Protection for removal support and monitoring.",
    breadcrumbLabel: "Remove TruthFinder",
    intro: [
      "If you are trying to remove data from TruthFinder or similar public-record aggregators, you are dealing with a high-friction class of data brokers: they often use verification, retention windows, and partner feeds that reintroduce the same identity graph.",
      "PrivacyEraser does not replace a broker’s official form, but it does give you a scan-first view of the broader field so you are not “done” on one page while a dozen mirrors remain."
    ],
    problem: {
      h2: "Fear, fraud, and the cost of a stale profile",
      body: [
        "Many users ask is my personal data exposed online in the first place. With people search markets, the answer is often yes at the listing level, even if you never signed up. That is why a remove leaked personal data strategy is defensive: you reduce what criminals can buy or scrape cheaply."
      ]
    },
    solution: {
      h2: "Start free, then one upgrade path for ongoing defense",
      body: [
        "Our scan shows exposure risk for your U.S. state context; when you are ready, Lifetime Protection is the only paid step — the same as what are data brokers articles usually skip: continuous follow-through."
      ]
    }
  }
};

export function getSeoPage(key: SeoPageKey): SeoPageDef {
  return pages[key];
}

export function buildSeoMetadata(key: SeoPageKey): Metadata {
  const p = pages[key];
  const path = `/${key}`;
  const url = new URL(path, siteUrl).toString();
  const ogTitle = p.openGraphTitle ?? p.title;
  const ogDescription = p.openGraphDescription ?? p.description;
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "PrivacyEraser.ai",
      title: ogTitle,
      description: ogDescription,
      url,
      locale: "en_US"
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription
    }
  };
}
