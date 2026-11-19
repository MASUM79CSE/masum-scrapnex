export interface AnalysisLimits {
  /** Counts every entered DOM node, including non-element and pruned nodes. */
  maxNodes: number;
  maxDepth: number;
  maxTimeMs: number;
  /** Maximum tree/analysis work items between yields. */
  yieldEvery: number;
  maxSiblings: number;
  maxCandidates: number;
}

export type ReasonCode =
  | "repeat"
  | "similarity"
  | "aligned-signals"
  | "record-content"
  | "visible"
  | "landmark"
  | "link-only"
  | "sampled";
export interface CandidateReason {
  code: ReasonCode;
  message: string;
}
export interface StructureCandidate {
  id: string;
  kind: "repeated-siblings";
  tag: string;
  parentDepth: number;
  observedRows: number;
  estimatedRows: number;
  sampled: boolean;
  score: number;
  confidence: "strong" | "possible" | "weak";
  reasons: CandidateReason[];
}

export interface AnalyzerOptions {
  signal?: AbortSignal;
  limits?: Partial<AnalysisLimits>;
  /** Test seam; default yields to the browser task queue. */
  schedule?: () => Promise<void>;
}

export interface AnalysisResult {
  status: "complete" | "partial" | "cancelled";
  reason?:
    "node-limit" | "depth-limit" | "time-limit" | "dom-changed" | "aborted";
  candidates: StructureCandidate[];
  stats: {
    visited: number;
    visibleElements: number;
    pruned: number;
    depthLimited: number;
    sampledParents: number;
    rankedGroups: number;
    elapsedMs: number;
  };
}
