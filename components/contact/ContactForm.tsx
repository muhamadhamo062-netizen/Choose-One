"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const supportEmail = COPY.contact.emailAddress;

type FormState = "idle" | "submitting" | "success";

const initial = { name: "", email: "", message: "" };

export function ContactForm() {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const name = values.name.trim();
    const email = values.email.trim();
    const message = values.message.trim();
    if (name.length < 2) {
      setError("Please enter your name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    if (message.length < 10) {
      setError("Message should be at least 10 characters");
      return;
    }
    setState("submitting");
    void (async () => {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      });
      if (res.status === 503) {
        setError(
          `This form is not active for message delivery. Email us directly: ${supportEmail}`
        );
        setState("idle");
        return;
      }
      if (!res.ok) {
        setError("Could not send your message. Try again or use email.");
        setState("idle");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        code?: string;
      };
      if (!j.ok) {
        if (j.state === "EMAIL_NOT_CONFIGURED" || j.code === "contact_delivery_not_configured") {
          setError(`This form is not active for message delivery. Email us directly: ${supportEmail}`);
        } else {
          setError("Could not send your message. Try again or use email.");
        }
        setState("idle");
        return;
      }
      setState("success");
    })();
  };

  if (state === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full"
      >
        <Card className="border border-accent/30 bg-accent/5 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/30">
            <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">Message sent</h2>
          <p className="mt-2 text-sm text-slate-300">Your message was delivered to our inbox.</p>
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setValues(initial);
                setState("idle");
              }}
            >
              Send another message
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-400">
            Name
          </label>
          <input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            autoComplete="name"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            placeholder="Your name"
            disabled={state === "submitting"}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-400">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            autoComplete="email"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            placeholder="you@example.com"
            disabled={state === "submitting"}
          />
        </div>
        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-400">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={values.message}
            onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
            rows={5}
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            placeholder="How can we help?"
            disabled={state === "submitting"}
          />
        </div>

        <AnimatePresence>
          {error ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-danger"
              role="alert"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="pt-1">
          <Button
            type="submit"
            className="w-full"
            disabled={state === "submitting"}
            aria-busy={state === "submitting"}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {state === "submitting" ? "Sending…" : "Send Message"}
              <Send className={cn("h-4 w-4", state === "submitting" && "opacity-40")} aria-hidden />
            </span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
