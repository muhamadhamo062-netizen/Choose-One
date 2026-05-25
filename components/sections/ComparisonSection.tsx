import { Card } from "@/components/ui/Card";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { cn } from "@/lib/utils";

const rows = [
  { metric: "Time required", values: ["10 mins setup", "30-40 hours", "3-5 hours"] },
  { metric: "Automation", values: ["Full automation", "None", "Partial"] },
  { metric: "Coverage", values: ["100+ brokers", "10-15 manually", "30-50 sites"] },
  { metric: "Cost", values: ["$149 one-time (lifetime)", "Your time cost", "$300/year (typical)"] }
];

const headers = ["PrivacyEraser.ai", "Manual Removal", "Competitors"];

export function ComparisonSection() {
  return (
    <section className="py-14">
      <div className="section-container">
        <SectionReveal>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Why serious users choose this system</h2>
          <Card className="mt-6 overflow-hidden p-0">
            <div className="grid grid-cols-4 border-b border-slate-700">
              <div className="p-4 text-sm font-semibold text-slate-400">Features</div>
              {headers.map((header, index) => (
                <div
                  key={header}
                  className={cn(
                    "p-4 text-center text-sm font-semibold",
                    index === 0 ? "bg-primary/15 text-primary" : "text-slate-300"
                  )}
                >
                  {header}
                </div>
              ))}
            </div>

            {rows.map((row) => (
              <div key={row.metric} className="grid grid-cols-4 border-b border-slate-800 last:border-none">
                <div className="p-4 text-sm text-slate-300">{row.metric}</div>
                {row.values.map((value, index) => (
                  <div
                    key={value}
                    className={cn(
                      "p-4 text-center text-sm",
                      index === 0 ? "font-semibold text-accent" : "text-slate-400"
                    )}
                  >
                    {value}
                  </div>
                ))}
              </div>
            ))}
          </Card>
        </SectionReveal>
      </div>
    </section>
  );
}
