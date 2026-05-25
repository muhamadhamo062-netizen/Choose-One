import type { ReactNode } from "react";
export function LegalProseLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <main className="min-h-0 w-full flex-1 pb-20 pt-8">
        <article className="section-container max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">Last updated: April 1, 2026</p>
          <div className="prose-legal mt-8 space-y-6 text-slate-300 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white first:[&_h2]:mt-0 [&_p]:leading-7">
            {children}
          </div>
          <p className="mt-12 border-t border-slate-800 pt-6 text-sm italic text-slate-500">
            This is placeholder legal content and should be reviewed by a licensed attorney before production use.
          </p>
        </article>
      </main>
    </>
  );
}
