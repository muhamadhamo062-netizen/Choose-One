/**
 * Data returned by the discovery engine — every field not supplied by the user
 * must come from a real retrieval path (API / connector), never from random generation.
 */
export type DiscoveryProvenance = "connector" | "input_only" | "no_connector_configured";

export interface IdentityDiscoveryInput {
  fullName: string;
  email?: string;
  stateCode?: string;
  stateLabel?: string;
}

export interface DiscoveryResult {
  name: string;
  possibleAddresses: string[];
  phones: string[];
  emails: string[];
  /** e.g. broker or index names where a match was found */
  brokerSources: string[];
  /** 0–1 normalized confidence in aggregate match quality */
  confidenceScore: number;
  provenance: DiscoveryProvenance;
  /** Optional message for ops / UI when no external sources are connected */
  connectorNote?: string;
}
