export type ButtonVariant = "primary" | "outline" | "danger";

export type ScanStatus = "idle" | "scanning" | "complete";

export interface ScannerFinding {
  id: string;
  label: string;
  detected: boolean;
}

export interface BrokerHit {
  id: string;
  name: string;
  status: "checking" | "found";
}
