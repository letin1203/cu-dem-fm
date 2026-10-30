export type AiNodeStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type AiNodeKind = 'CORE' | 'TIER' | 'THINKING' | 'TEAM';

export interface AiGraphPlayer {
  id: string;
  name: string;
  tier: number;
  position: string;
  avatar: string | null;
}

export interface AiGraphNode {
  id: string;
  kind: AiNodeKind;
  label: string;
  sublabel: string;
  status: AiNodeStatus;
  depth: number;
  lane: number;
  metrics: Record<string, string | number>;
  phases?: AiGraphPhaseTiming[];
  players?: AiGraphPlayer[];
}

export interface AiGraphPhaseTiming {
  id: string;
  label: string;
  detail: string;
  status: AiNodeStatus;
  durationMs: number;
}

export interface AiGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'SPINE' | 'TIER_FLOW' | 'THINKING' | 'TEAM_FLOW';
  label: string;
  status: AiNodeStatus;
}

export type AiEventKind = 'START' | 'PHASE' | 'ALLOCATE' | 'SWAP' | 'FAILURE';

export interface AiTaskEvent {
  id: string;
  at: string;
  phase: string;
  message: string;
  status: AiNodeStatus;
  durationMs: number;
  kind: AiEventKind;
  /** Node ids this entry activates while it plays. */
  nodeIds?: string[];
}

export interface AiAllocationStep {
  id: string;
  playerId: string;
  playerName: string;
  tier: number;
  teamNodeId: string;
  teamLabel: string;
  stage: string;
}

export interface AiSwapStep {
  id: string;
  firstId: string;
  firstName: string;
  secondId: string;
  secondName: string;
  firstTeamNodeId: string;
  secondTeamNodeId: string;
  stage: string;
}

export interface AiSplitGraphSummary {
  players: number;
  teams: number;
  swaps: number;
  repeatTeammateSwaps: number;
  totalTierSpread: number;
  tierOneSpread: number;
}

export interface AiSplitGraph {
  taskId: string;
  createdAt: string;
  instruction?: string;
  status: AiNodeStatus;
  durationMs: number;
  summary: AiSplitGraphSummary;
  nodes: AiGraphNode[];
  edges: AiGraphEdge[];
  events: AiTaskEvent[];
  allocations: AiAllocationStep[];
  swaps: AiSwapStep[];
}
