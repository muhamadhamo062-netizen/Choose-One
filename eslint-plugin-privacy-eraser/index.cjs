const noUiSubscriptionLanguage = require("./rules/no-ui-subscription-language.cjs");
const noMessagingLegacyApi = require("./rules/no-messaging-legacy-api.cjs");

module.exports = {
  rules: {
    "no-ui-subscription-language": noUiSubscriptionLanguage,
    "no-messaging-legacy-api": noMessagingLegacyApi
  }
};
