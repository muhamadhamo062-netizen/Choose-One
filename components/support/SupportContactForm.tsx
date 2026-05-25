"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const F = COPY.supportCenter.form;
const supportEmail = COPY.contact.emailAddress;

type FormState = "idle" | "submitting" | "success";

const initial = { name: "", email: "", subject: "", message: "" };

export function SupportContactForm() {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const name = values.name.trim();
    const email = values.email.trim();
    const subject = values.subject.trim();
    const message = values.message.trim();
    if (name.length < 2) {
      setError(F.errorName);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(F.errorEmail);
      return;
    }
    if (subject.length < 3) {
      setError(F.errorSubject);
      return;
    }
    if (message.length < 10) {
      setError(F.errorMessageShort);
      return;
    }
    setState("submitting");
    void (async () => {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message })
      });
      if (res.status === 503) {
        setError(`${F.errorNotConfiguredPrefix} ${supportEmail}`);
        setState("idle");
        return;
      }
      if (!res.ok) {
        setError(F.errorSend);
        setState("idle");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        state?: string;
        code?: string;
      };
      if (!j.ok) {
        if (j.state === "EMAIL_NOT_CONFIGURED" || j.code === "contact_delivery_not_configured") {
          setError(`${F.errorNotConfiguredPrefix} ${supportEmail}`);
          setState("idle");
          return;
        }
        if (j.error === "subject_too_short") {
          setError(F.errorSubject);
        } else if (j.error === "subject_too_long") {
          setError(F.errorSubjectLong);
        } else if (j.error === "message_too_short") {
          setError(F.errorMessageShort);
        } else {
          setError(F.errorSend);
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
          <h2 className="mt-4 text-lg font-bold text-white">{F.successTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{F.successBody}</p>
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setValues(initial);
                setState("idle");
              }}
            >
              {F.sendAnother}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

  return (
    <Card className="border-slate-700/80 p-6 shadow-xl shadow-black/20 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label htmlFor="support-name" className="mb-1.5 block text-sm font-medium text-slate-400">
              {F.nameLabel}
            </label>
            <input
              id="support-name"
              name="name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              autoComplete="name"
              className={inputClass}
              placeholder={F.namePlaceholder}
              disabled={state === "submitting"}
            />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="support-email" className="mb-1.5 block text-sm font-medium text-slate-400">
              {F.emailLabel}
            </label>
            <input
              id="support-email"
              name="email"
              type="email"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              autoComplete="email"
              className={inputClass}
              placeholder={F.emailPlaceholder}
              disabled={state === "submitting"}
            />
          </div>
        </div>
        <div>
          <label htmlFor="support-subject" className="mb-1.5 block text-sm font-medium text-slate-400">
            {F.subjectLabel}
          </label>
          <input
            id="support-subject"
            name="subject"
            value={values.subject}
            onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))}
            autoComplete="off"
            className={inputClass}
            placeholder={F.subjectPlaceholder}
            disabled={state === "submitting"}
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="support-message" className="mb-1.5 block text-sm font-medium text-slate-400">
            {F.messageLabel}
          </label>
          <textarea
            id="support-message"
            name="message"
            value={values.message}
            onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
            rows={6}
            className={cn(inputClass, "resize-y min-h-[140px]")}
            placeholder={F.messagePlaceholder}
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
            className="w-full sm:w-auto sm:min-w-[200px]"
            disabled={state === "submitting"}
            aria-busy={state === "submitting"}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {state === "submitting" ? F.submitting : F.submit}
              <Send className={cn("h-4 w-4", state === "submitting" && "opacity-40")} aria-hidden />
            </span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
