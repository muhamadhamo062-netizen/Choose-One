import { VisLogo } from "./VisaLogo";
import { MastercardMark } from "./MastercardMark";
import { ApplePayMark } from "./ApplePayMark";
import { PayPalMark } from "./PayPalMark";

const iconWrap =
  "flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-md border border-slate-700/80 bg-slate-900/60 text-slate-200";

export function PaymentBrandRow() {
  return (
    <div
      className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3"
      role="list"
      aria-label="Supported payment methods"
    >
      <div className={iconWrap} role="listitem" title="Visa">
        <VisLogo className="h-3" />
      </div>
      <div className={iconWrap} role="listitem" title="Mastercard">
        <MastercardMark className="h-3.5" />
      </div>
      <div className={iconWrap} role="listitem" title="Apple Pay">
        <ApplePayMark className="h-2.5" />
      </div>
      <div className={iconWrap} role="listitem" title="PayPal">
        <PayPalMark className="h-2.5" />
      </div>
    </div>
  );
}
