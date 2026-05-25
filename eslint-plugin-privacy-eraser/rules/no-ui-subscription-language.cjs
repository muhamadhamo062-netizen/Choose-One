/**
 * Fails the build if forbidden subscription-funnel language appears in UI source.
 * Match word boundaries to reduce false positives (e.g. "industrial" vs "\btrial\b").
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow subscription-funnel terms in UI; use `lib/product-messaging.ts` and Lifetime Protection language."
    },
    schema: [],
    messages: {
      forbidden:
        "Forbidden product language \"{{term}}\" in UI. Use Lifetime Protection copy from lib/product-messaging.ts."
    }
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    const text = sourceCode.getText();
    const checks = [
      { re: /\bupgrade\s+plans?\b/gi, term: "upgrade plan" },
      { re: /\bmonthly\s+plans?\b/gi, term: "monthly plan" },
      { re: /\bsubscriptions?\b/gi, term: "subscription" },
      { re: /\btrial\b/gi, term: "trial" }
    ];

    return {
      Program() {
        for (const { re, term } of checks) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            const startLoc = sourceCode.getLocFromIndex(start);
            const endLoc = sourceCode.getLocFromIndex(end);
            context.report({
              loc: { start: startLoc, end: endLoc },
              messageId: "forbidden",
              data: { term }
            });
          }
        }
      }
    };
  }
};
