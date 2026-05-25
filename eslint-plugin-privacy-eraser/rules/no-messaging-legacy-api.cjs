/**
 * Prevents reintroducing legacy or abstraction APIs around `CORE_PRODUCT_COPY`
 * and blocks namespace / wildcard re-exports of `lib/product-messaging` outside that module.
 * @type {import('eslint').Rule.RuleModule}
 */
const BANNED_NAMED = new Set([
  "getProductCopy",
  "getProductMessage",
  "getProductMessageString",
  "UI_MESSAGE_MAP",
  "getProductMap",
  "PRODUCT_MESSAGING"
]);

const BANNED_NAMED_INCLUDING_CONTEXT = new Set([...BANNED_NAMED, "CONTEXTUAL_OVERRIDES"]);

const MODULE = "@/lib/product-messaging";

/**
 * @param {string} [id]
 * @returns {boolean}
 */
function isProductMessagingModule(id) {
  if (!id || typeof id !== "string") {
    return false;
  }
  if (id === MODULE) {
    return true;
  }
  return id.split(/[/\\]/).join("/").endsWith("lib/product-messaging");
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isDefiningModuleFile(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }
  return filePath.split(/[/\\]/).join("/").endsWith("lib/product-messaging.ts");
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow legacy / abstraction imports from `lib/product-messaging` (e.g. getProductMessage, UI_MESSAGE_MAP, getProductCopy). Use `CORE_PRODUCT_COPY` as `COPY` and direct property access only."
    },
    schema: [],
    messages: {
      banned:
        "Locked messaging API: do not import \"{{name}}\" from @/lib/product-messaging. Use `CORE_PRODUCT_COPY` as COPY and `COPY…` only, plus existing format/scan exports.",
      noNamespace:
        "Locked messaging API: do not use namespace or default imports from @/lib/product-messaging. Use named imports: `CORE_PRODUCT_COPY as COPY`, `getScanPipelineStatusMessages`, `formatDashboard…`, or `PRODUCT_PHILOSOPHY`."
    }
  },

  create(context) {
    const filePath = context.getFilename() || context.filename;
    if (isDefiningModuleFile(String(filePath))) {
      return {};
    }

    return {
      /** @param {import('estree').ImportDeclaration} node */
      ImportDeclaration(node) {
        const id = node.source && node.source.value;
        if (!isProductMessagingModule(/** @type {string} */ (id))) {
          return;
        }

        if (node.specifiers && node.specifiers.length === 0) {
          return;
        }

        for (const spec of node.specifiers) {
          if (spec.type === "ImportNamespaceSpecifier") {
            context.report({ node, messageId: "noNamespace" });
            return;
          }
          if (spec.type === "ImportDefaultSpecifier") {
            context.report({ node, messageId: "noNamespace" });
            return;
          }
          if (spec.type === "ImportSpecifier" && spec.imported) {
            const name =
              spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.name || spec.imported.value;
            if (BANNED_NAMED_INCLUDING_CONTEXT.has(name)) {
              context.report({ node, messageId: "banned", data: { name } });
            }
          }
        }
      },

      /** @param {import('estree').ExportNamedDeclaration} node */
      ExportNamedDeclaration(node) {
        if (!node.source) {
          return;
        }
        const id = node.source.value;
        if (!isProductMessagingModule(/** @type {string} */ (id))) {
          return;
        }
        for (const spec of node.specifiers) {
          if (spec.type === "ExportSpecifier" && spec.local) {
            const name = spec.local.type === "Identifier" ? spec.local.name : spec.local.name;
            if (BANNED_NAMED_INCLUDING_CONTEXT.has(name)) {
              context.report({ node, messageId: "banned", data: { name } });
            }
          }
        }
      },

      /** `export * from` would bypass named bans — forbidden outside `lib/product-messaging`. */
      ExportAllDeclaration(node) {
        const id = node.source && node.source.value;
        if (isProductMessagingModule(/** @type {string} */ (id))) {
          context.report({ node, messageId: "noNamespace" });
        }
      }
    };
  }
};
