/**
 * 5-step automated follow-up (copy for Resend/Loops sequences).
 * Drip delays are suggestions only — map to your ESP scheduling.
 */

export const EMAIL_SEQUENCE = [
  {
    step: 1,
    delayLabel: "Immediate",
    subject: "We found your data online",
    body: `Hi there,

Your PrivacyEraser exposure scan is complete — and the results are more serious than most people expect.

**What this means (recap)**
- Your contact details and public-record signals are visible across data broker and people-search sites.
- These listings are a direct path to spam, social engineering, and identity-adjacent fraud.

**The fear trigger (read this once)**
The longer you wait, the more this data is scraped, re-sold, and re-indexed. That is the default behavior of the broker ecosystem.

**CTA: Remove your exposure now** — don't wait for "later."
→ https://privacyeraser.ai/#pricing (replace with your live pricing URL)

— PrivacyEraser.ai`
  },
  {
    step: 2,
    delayLabel: "6 hours",
    subject: "Your data is still exposed",
    body: `Quick check-in.

Right now, many brokers still have public-facing listings tied to the signals we flagged — including the categories that show up in places like:
Spokeo, Whitepages, BeenVerified, PeopleFinder, TruthFinder, and Intelius (and dozens more in the same market).

**Why this still matters at hour 6**
Listings can refresh from new public datasets even when you change nothing about your own behavior.

**CTA: Start automated removal** before new scrapes re-create what you "already handled."
→ https://privacyeraser.ai/#pricing`
  },
  {
    step: 3,
    delayLabel: "24 hours (next day)",
    subject: "This gets worse over time",
    body: `This is a direct note, no fluff.

**Long-term risk (what we see)**
- More spam and targeted phishing as your info propagates
- More social engineering (because the attacker has "real" details)
- More friction when you get locked out, SIM-swapped, or targeted by scams

**Authority tone, simple truth**
Private data in public index pages is a risk multiplier, not a one-time inconvenience.

**CTA: Lock down your personal footprint.**
→ https://privacyeraser.ai/#pricing`
  },
  {
    step: 4,
    delayLabel: "Day 3",
    subject: "Manual removal takes weeks",
    body: `If you're trying the manual path, you already know: it's slow, repetitive, and it breaks again when a broker re-ingests a dataset.

**Manual vs automated (honest)**
- Manual: many forms, email verification, weeks of waiting, re-checking URLs, and re-submitting
- With PrivacyEraser: persistent removal workflows + re-submission coverage when a listing returns

**CTA: Choose automation, not a weekend project.**
→ https://privacyeraser.ai/#pricing`
  },
  {
    step: 5,
    delayLabel: "Final push",
    subject: "Last chance: Protect your data",
    body: `This is the final nudge in this sequence.

**Urgency (real)**
If your data is public today, the risk clock is running — not because of alarmism, but because the ecosystem re-lists, re-buys, and re-scrapes constantly.

**Scarcity reminder (where applicable)**
If you're seeing a time-boxed offer on the site, it's because we intentionally limit how many lifetime seats we can support at a given time.

**CTA: Remove my data now.**
→ https://privacyeraser.ai/#pricing

— Done with this series. If you want to stop emails, use the link in the footer of any message.`
  }
] as const;

export type EmailSequenceItem = (typeof EMAIL_SEQUENCE)[number];
