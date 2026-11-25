-- Additive Full MVP product-domain schema. No existing P1-3 table is dropped
-- or redefined.

ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'OLD_BUILDING_ADDITION';
ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'EXISTING_ELEVATOR_RENOVATION';
ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'NEW_BUILDING_INSTALLATION';

ALTER TABLE "customer" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "customer_userId_key" ON "customer"("userId");
ALTER TABLE "customer"
  ADD CONSTRAINT "customer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "AdvisorProviderKind" AS ENUM ('MOCK', 'REAL_PROVIDER');
CREATE TYPE "AdvisorConversationStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "AdvisorMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "InstallationScenario" AS ENUM (
  'OLD_BUILDING_ADDITION',
  'EXISTING_ELEVATOR_RENOVATION',
  'NEW_BUILDING_INSTALLATION'
);
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'CUSTOMER_CONFIRMED');
CREATE TYPE "RequirementRevisionSource" AS ENUM ('CHAT_USER', 'MOCK_AI', 'USER_EDIT');
CREATE TYPE "CatalogVerificationStatus" AS ENUM ('DEMO_MOCK', 'UNVERIFIED', 'VERIFIED', 'EXPIRED');
CREATE TYPE "PriceValidityStatus" AS ENUM ('DEMO_MOCK', 'VALID', 'EXPIRED');
CREATE TYPE "SelectionRunStatus" AS ENUM ('COMPLETED', 'NO_VALID_MATCH');
CREATE TYPE "BudgetAssessment" AS ENUM (
  'WITHIN_BUDGET',
  'SLIGHTLY_OVER_BUDGET_IMPROVEMENT',
  'OVER_BUDGET',
  'UNKNOWN'
);
CREATE TYPE "SalesHandoffStatus" AS ENUM (
  'PENDING_FOLLOW_UP',
  'IN_FOLLOW_UP',
  'CUSTOMER_RESPONDED',
  'CLOSED'
);

CREATE TABLE "advisor_conversation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "provider" "AdvisorProviderKind" NOT NULL DEFAULT 'MOCK',
  "status" "AdvisorConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "advisor_conversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "advisor_conversation_projectId_createdAt_idx"
  ON "advisor_conversation"("projectId", "createdAt");
CREATE INDEX "advisor_conversation_createdById_createdAt_idx"
  ON "advisor_conversation"("createdById", "createdAt");
ALTER TABLE "advisor_conversation"
  ADD CONSTRAINT "advisor_conversation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advisor_conversation"
  ADD CONSTRAINT "advisor_conversation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "advisor_message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "role" "AdvisorMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "provider" "AdvisorProviderKind" NOT NULL DEFAULT 'MOCK',
  "structuredPayload" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "advisor_message_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "advisor_message_conversationId_sequence_key"
  ON "advisor_message"("conversationId", "sequence");
CREATE INDEX "advisor_message_conversationId_createdAt_idx"
  ON "advisor_message"("conversationId", "createdAt");
ALTER TABLE "advisor_message"
  ADD CONSTRAINT "advisor_message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "advisor_conversation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "building_requirement" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "conversationId" TEXT,
  "installationScenario" "InstallationScenario" NOT NULL,
  "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "fields" JSONB NOT NULL,
  "missingFields" JSONB NOT NULL,
  "professionalReviewRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "building_requirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "building_requirement_projectId_version_key"
  ON "building_requirement"("projectId", "version");
CREATE INDEX "building_requirement_projectId_createdAt_idx"
  ON "building_requirement"("projectId", "createdAt");
ALTER TABLE "building_requirement"
  ADD CONSTRAINT "building_requirement_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "building_requirement"
  ADD CONSTRAINT "building_requirement_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "advisor_conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "building_requirement"
  ADD CONSTRAINT "building_requirement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "building_requirement"
  ADD CONSTRAINT "building_requirement_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "requirement_revision" (
  "id" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "source" "RequirementRevisionSource" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "missingFields" JSONB NOT NULL,
  "status" "RequirementStatus" NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requirement_revision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "requirement_revision_requirementId_version_key"
  ON "requirement_revision"("requirementId", "version");
CREATE INDEX "requirement_revision_requirementId_createdAt_idx"
  ON "requirement_revision"("requirementId", "createdAt");
ALTER TABLE "requirement_revision"
  ADD CONSTRAINT "requirement_revision_requirementId_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "building_requirement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_manufacturer" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "supplier" VARCHAR(160),
  "verificationStatus" "CatalogVerificationStatus" NOT NULL DEFAULT 'DEMO_MOCK',
  "sourceReference" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_manufacturer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_manufacturer_name_key"
  ON "product_manufacturer"("name");

CREATE TABLE "product_brand" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "verificationStatus" "CatalogVerificationStatus" NOT NULL DEFAULT 'DEMO_MOCK',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_brand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_brand_manufacturerId_name_key"
  ON "product_brand"("manufacturerId", "name");
ALTER TABLE "product_brand"
  ADD CONSTRAINT "product_brand_manufacturerId_fkey"
  FOREIGN KEY ("manufacturerId") REFERENCES "product_manufacturer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_model" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "modelCode" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "applicableScenarios" JSONB NOT NULL,
  "verificationStatus" "CatalogVerificationStatus" NOT NULL DEFAULT 'DEMO_MOCK',
  "sourceReference" VARCHAR(500),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_model_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_model_brandId_modelCode_key"
  ON "product_model"("brandId", "modelCode");
CREATE INDEX "product_model_verificationStatus_active_idx"
  ON "product_model"("verificationStatus", "active");
ALTER TABLE "product_model"
  ADD CONSTRAINT "product_model_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "product_brand"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_specification" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "capacityKg" INTEGER,
  "speedMps" DECIMAL(5,2),
  "maxFloors" INTEGER,
  "maxTravelM" DECIMAL(7,2),
  "shaftWidthMm" INTEGER,
  "shaftDepthMm" INTEGER,
  "pitDepthMm" INTEGER,
  "overheadMm" INTEGER,
  "doorConfiguration" VARCHAR(100),
  "machineRoomType" VARCHAR(50),
  "sourceReference" VARCHAR(500),
  "verificationStatus" "CatalogVerificationStatus" NOT NULL DEFAULT 'DEMO_MOCK',
  "effectiveFrom" TIMESTAMPTZ(6),
  "effectiveTo" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_specification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_specification_productId_version_key"
  ON "product_specification"("productId", "version");
ALTER TABLE "product_specification"
  ADD CONSTRAINT "product_specification_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product_model"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_price" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
  "region" VARCHAR(80) NOT NULL DEFAULT 'DEMO',
  "minimumAmount" INTEGER,
  "maximumAmount" INTEGER,
  "sourceReference" VARCHAR(500),
  "validityStatus" "PriceValidityStatus" NOT NULL DEFAULT 'DEMO_MOCK',
  "effectiveFrom" TIMESTAMPTZ(6),
  "effectiveTo" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_price_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_price_productId_version_key"
  ON "product_price"("productId", "version");
ALTER TABLE "product_price"
  ADD CONSTRAINT "product_price_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product_model"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "selection_run" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "rulesVersion" VARCHAR(50) NOT NULL,
  "status" "SelectionRunStatus" NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "outputSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "selection_run_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "selection_run_projectId_createdAt_idx"
  ON "selection_run"("projectId", "createdAt");
ALTER TABLE "selection_run"
  ADD CONSTRAINT "selection_run_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "selection_run"
  ADD CONSTRAINT "selection_run_requirementId_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "building_requirement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "selection_run"
  ADD CONSTRAINT "selection_run_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "selection_recommendation" (
  "id" TEXT NOT NULL,
  "selectionRunId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "specVersion" INTEGER NOT NULL,
  "budgetAssessment" "BudgetAssessment" NOT NULL,
  "recommendationType" VARCHAR(50) NOT NULL,
  "reasons" JSONB NOT NULL,
  "limitations" JSONB NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "selection_recommendation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "selection_recommendation_selectionRunId_budgetAssessment_idx"
  ON "selection_recommendation"("selectionRunId", "budgetAssessment");
ALTER TABLE "selection_recommendation"
  ADD CONSTRAINT "selection_recommendation_selectionRunId_fkey"
  FOREIGN KEY ("selectionRunId") REFERENCES "selection_run"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "selection_recommendation"
  ADD CONSTRAINT "selection_recommendation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product_model"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sales_handoff" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "status" "SalesHandoffStatus" NOT NULL DEFAULT 'PENDING_FOLLOW_UP',
  "budgetConcern" TEXT,
  "summary" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sales_handoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_handoff_projectId_key"
  ON "sales_handoff"("projectId");
ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_handoff"
  ADD CONSTRAINT "sales_handoff_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sales_follow_up_note" (
  "id" TEXT NOT NULL,
  "handoffId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "contactStatus" VARCHAR(80) NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_follow_up_note_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_follow_up_note_handoffId_createdAt_idx"
  ON "sales_follow_up_note"("handoffId", "createdAt");
ALTER TABLE "sales_follow_up_note"
  ADD CONSTRAINT "sales_follow_up_note_handoffId_fkey"
  FOREIGN KEY ("handoffId") REFERENCES "sales_handoff"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_follow_up_note"
  ADD CONSTRAINT "sales_follow_up_note_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
