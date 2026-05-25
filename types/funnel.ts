import type { ScannerFinding } from "@/types";

export type UserPlan = "free" | "lifetime";

export interface PeScanData {
  fullName: string;
  email: string;
  stateCode: string;
  stateLabel: string;
  /** 0–100 — alias for product copy ("exposure score"). */
  exposurePercent: number;
  exposureScore: number;
  /** True when name/email not provided. */
  anonymous: boolean;
  /** Count of real broker source hits from discovery (not fabricated). */
  brokerHits: number;
  brokersFound: number;
  relativesCount: number;
  completedAt: string;
  findingLabels: string[];
  /** From risk engine when available. */
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** provenance: connector | input_only | no_connector_configured */
  discoveryProvenance?: string;
  /** Names/ids returned by discovery (may be empty). */
  brokerSourceNames?: string[];
  discoveryConnectorNote?: string;
  /** Whether phone/address were returned (consented retrieval only). */
  hasStructuredPiiFromSources?: boolean;
  /** Present when scan was run through the unified session flow. */
  scanId?: string;
}

export interface PeUser {
  fullName: string;
  email: string;
  createdAt: string;
  /** Linked `ScanSession.scanId` after signup when a pre-signup scan exists. */
  scanId?: string;
  hasScan?: boolean;
  /** User's shareable code; used in /referral and viral links. */
  referralCode?: string;
  /** Optional code used at signup (friend referred). */
  referredByCode?: string;
}

export type DashboardSectionId = "overview" | "removal" | "darkweb" | "settings";

/** Aggregate dashboard funnel state for the control panel. */
export type PrivacyControlState = "EXPOSED" | "REMOVAL_IN_PROGRESS" | "REMOVED" | "PROTECTED";

export type BrokerListStatus = "exposed" | "cleaning" | "removed";

export interface DashboardBrokerRow {
  id: string;
  name: string;
  status: BrokerListStatus;
}

/** Builds personalized findings for the free privacy scan result UI. */
export function buildPersonalizedFindings(stateLabel: string, relativesCount: number): ScannerFinding[] {
  return [
    { id: "f1", label: `Address Found in ${stateLabel}`, detected: true },
    { id: "f2", label: `Relatives Identified (${relativesCount} matches)`, detected: true },
    { id: "f3", label: "Estimated Net Worth Range Exposed", detected: true },
    { id: "f4", label: "Phone Number Linked", detected: true },
    { id: "f5", label: "Email found in breached databases", detected: true }
  ];
}
