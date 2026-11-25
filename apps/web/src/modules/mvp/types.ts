import type {
  InstallationScenario,
  RequirementDraft,
} from "@elevator/contracts";
import type {
  SelectionProduct,
  SelectionResult,
} from "../../../../../packages/selection-engine/src/index";

export interface ConversationSummary {
  id: string;
  projectId: string;
  provider: "MOCK" | "REAL_PROVIDER";
  status: "ACTIVE" | "CLOSED";
  createdAt: Date;
  messageCount: number;
  latestMessage: string | null;
}

export interface AdvisorMessageRecord {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider: "MOCK" | "REAL_PROVIDER";
  structuredPayload: unknown;
  createdAt: Date;
}

export interface RequirementRecord {
  id: string;
  projectId: string;
  conversationId: string | null;
  installationScenario: InstallationScenario;
  status: "DRAFT" | "CUSTOMER_CONFIRMED";
  version: number;
  fields: RequirementDraft;
  missingFields: string[];
  professionalReviewRequired: boolean;
  updatedAt: Date;
}

export interface CatalogProductRecord extends SelectionProduct {
  specificationId: string;
  specificationVersion: number;
  priceVersion: number | null;
  updatedAt: Date;
}

export interface SelectionRunRecord {
  id: string;
  projectId: string;
  requirementId: string;
  status: "COMPLETED" | "NO_VALID_MATCH";
  rulesVersion: string;
  result: SelectionResult;
  createdAt: Date;
}

export interface SalesHandoffRecord {
  id: string;
  projectId: string;
  projectName: string;
  status:
    | "PENDING_FOLLOW_UP"
    | "IN_FOLLOW_UP"
    | "CUSTOMER_RESPONDED"
    | "CLOSED";
  summary: string | null;
  budgetConcern: string | null;
  createdAt: Date;
  requirement: RequirementRecord | null;
  selectionRun: Pick<
    SelectionRunRecord,
    "id" | "status" | "result" | "createdAt"
  > | null;
  followUpNotes: Array<{
    id: string;
    contactStatus: string;
    note: string;
    createdAt: Date;
  }>;
}
