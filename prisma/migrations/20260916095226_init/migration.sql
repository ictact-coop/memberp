-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('PERSON', 'ORGANIZATION', 'TEAM', 'ORG_UNIT');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE', 'DORMANT', 'CLOSED', 'NEEDS_CONFIRMATION');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PermissionRole" AS ENUM ('MEMBER', 'ACTIVITY_MANAGER', 'DOMAIN_OPERATOR', 'SECRETARIAT', 'FINANCE', 'BOARD', 'SYSTEM_ADMIN', 'EXTERNAL_PARTICIPANT');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('GLOBAL', 'ACTIVITY', 'ORG_UNIT');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PENDING_REVIEW', 'MEMBER', 'TEAM', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "NeedChannel" AS ENUM ('PHONE', 'EMAIL', 'REFERRAL', 'EVENT', 'SELF_DISCOVERED', 'PUBLIC_CALL');

-- CreateEnum
CREATE TYPE "NeedStatus" AS ENUM ('RECEIVED', 'REVIEWING', 'PROPOSING', 'CONVERTED', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "NeedCloseType" AS ENUM ('SELF_RESOLVED', 'REFERRED_ELSEWHERE', 'NOT_PROGRESSED', 'WITHDRAWN', 'CONVERTED_TO_ACTIVITY');

-- CreateEnum
CREATE TYPE "NeedActivityLinkType" AS ENUM ('PRIMARY', 'ADDITIONAL', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "ActivityManagementType" AS ENUM ('BUSINESS', 'ORG_ACTIVITY');

-- CreateEnum
CREATE TYPE "Mission" AS ENUM ('CONSUMER_GROWTH', 'PRODUCER_SUSTAINABILITY', 'SHARED_RESOURCE_EXPANSION');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNING', 'PENDING_APPROVAL', 'PREPARING', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompensationBasis" AS ENUM ('PAID', 'UNPAID_CONSENT', 'MIXED_NEEDS_SPLIT', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('TIME', 'EXPERTISE', 'EXECUTION', 'RELATIONSHIP', 'RESOURCE', 'KNOWLEDGE', 'GOVERNANCE', 'CARE');

-- CreateEnum
CREATE TYPE "ContributionEvidenceLevel" AS ENUM ('SELF_REPORTED', 'PARTICIPANT_CONFIRMED', 'DOCUMENTED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_REVISION', 'CONFIRMED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttachmentEntityType" AS ENUM ('NEED', 'ACTIVITY', 'CONTRIBUTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REVISION_REQUESTED', 'CONTRIBUTION_CONFIRMED', 'ASSIGNMENT_CHANGED', 'NEED_ASSIGNED', 'GENERIC');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'CONFIRM', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "SystemOfRecord" AS ENUM ('NOTION', 'NEW_SYSTEM');

-- CreateEnum
CREATE TYPE "MigrationRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "classifications" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_classifications" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,

    CONSTRAINT "activity_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "display_sequences" (
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "display_sequences_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "type" "SubjectType" NOT NULL,
    "name" TEXT NOT NULL,
    "previousNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SubjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "region" TEXT,
    "expertiseTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactInfo" JSONB,
    "contactConsent" JSONB,
    "responsibleAccountId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "legacyId" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'TEAM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "subjectId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByAccountId" TEXT NOT NULL,
    "prelinkedSubjectId" TEXT,
    "suggestedRole" "PermissionRole",
    "acceptedAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "PermissionRole" NOT NULL,
    "scopeType" "ScopeType" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "grantedByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "needs" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "channel" "NeedChannel" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "raisedBySubjectId" TEXT,
    "beneficiarySubjectId" TEXT,
    "assigneeAccountId" TEXT,
    "status" "NeedStatus" NOT NULL DEFAULT 'RECEIVED',
    "urgency" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "closeType" "NeedCloseType",
    "closeReason" TEXT,
    "sourceUrl" TEXT,
    "legacyId" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'TEAM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_activity_links" (
    "id" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "linkType" "NeedActivityLinkType" NOT NULL DEFAULT 'PRIMARY',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByAccountId" TEXT NOT NULL,

    CONSTRAINT "need_activity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "managementType" "ActivityManagementType" NOT NULL,
    "missions" "Mission"[] DEFAULT ARRAY[]::"Mission"[],
    "purpose" TEXT NOT NULL,
    "parentActivityId" TEXT,
    "managerAccountId" TEXT NOT NULL,
    "organizerSubjectId" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNING',
    "visibility" "Visibility" NOT NULL DEFAULT 'TEAM',
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "budgetBaseline" DECIMAL(14,2),
    "closeEvaluationNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_assignments" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "plannedMinutes" INTEGER,
    "compensationBasis" "CompensationBasis",
    "conditionsDocumentUrl" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByAccountId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "contributorSubjectId" TEXT NOT NULL,
    "authorAccountId" TEXT NOT NULL,
    "activityId" TEXT,
    "needId" TEXT,
    "assignmentId" TEXT,
    "performedDate" TIMESTAMP(3) NOT NULL,
    "contributionType" "ContributionType" NOT NULL,
    "minutes" INTEGER,
    "compensationBasis" "CompensationBasis" NOT NULL DEFAULT 'UNCONFIRMED',
    "expertiseArea" TEXT,
    "description" TEXT NOT NULL,
    "evidenceLevel" "ContributionEvidenceLevel" NOT NULL DEFAULT 'SELF_REPORTED',
    "status" "ContributionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "confirmedByAccountId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "revisionReason" TEXT,
    "revisionOfId" TEXT,
    "supersededByContributionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entityType" "AttachmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "contributionId" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'RESTRICTED',
    "uploadedByAccountId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "replacesAttachmentId" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorAccountId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeData" JSONB,
    "afterData" JSONB,
    "reason" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_runs" (
    "id" TEXT NOT NULL,
    "sourceSystem" "SystemOfRecord" NOT NULL DEFAULT 'NOTION',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "MigrationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredByAccountId" TEXT NOT NULL,
    "summary" JSONB,

    CONSTRAINT "migration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_links" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceSystem" "SystemOfRecord" NOT NULL DEFAULT 'NOTION',
    "sourcePageId" TEXT,
    "sourceDbId" TEXT,
    "sourceUrl" TEXT,
    "sourceModifiedAt" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "migrationRunId" TEXT,

    CONSTRAINT "source_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_of_record_assignments" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "systemOfRecord" "SystemOfRecord" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "decidedByAccountId" TEXT NOT NULL,

    CONSTRAINT "system_of_record_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classifications_domain_code_key" ON "classifications"("domain", "code");

-- CreateIndex
CREATE UNIQUE INDEX "activity_classifications_activityId_classificationId_key" ON "activity_classifications"("activityId", "classificationId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_displayId_key" ON "subjects"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_subjectId_key" ON "accounts"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_acceptedAccountId_key" ON "invitations"("acceptedAccountId");

-- CreateIndex
CREATE INDEX "permission_grants_accountId_role_idx" ON "permission_grants"("accountId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "needs_displayId_key" ON "needs"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "need_activity_links_needId_activityId_linkType_key" ON "need_activity_links"("needId", "activityId", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "activities_displayId_key" ON "activities"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_displayId_key" ON "contributions"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_submissionKey_key" ON "contributions"("submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_supersededByContributionId_key" ON "contributions"("supersededByContributionId");

-- CreateIndex
CREATE INDEX "contributions_contributorSubjectId_performedDate_idx" ON "contributions"("contributorSubjectId", "performedDate");

-- CreateIndex
CREATE INDEX "contributions_activityId_status_idx" ON "contributions"("activityId", "status");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notifications_accountId_status_idx" ON "notifications"("accountId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "source_links_sourceSystem_sourcePageId_idx" ON "source_links"("sourceSystem", "sourcePageId");

-- CreateIndex
CREATE UNIQUE INDEX "source_links_entityType_entityId_sourceSystem_key" ON "source_links"("entityType", "entityId", "sourceSystem");

-- CreateIndex
CREATE UNIQUE INDEX "system_of_record_assignments_scopeType_scopeId_key" ON "system_of_record_assignments"("scopeType", "scopeId");

-- AddForeignKey
ALTER TABLE "activity_classifications" ADD CONSTRAINT "activity_classifications_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_classifications" ADD CONSTRAINT "activity_classifications_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "classifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "needs" ADD CONSTRAINT "needs_raisedBySubjectId_fkey" FOREIGN KEY ("raisedBySubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "needs" ADD CONSTRAINT "needs_beneficiarySubjectId_fkey" FOREIGN KEY ("beneficiarySubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_activity_links" ADD CONSTRAINT "need_activity_links_needId_fkey" FOREIGN KEY ("needId") REFERENCES "needs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_activity_links" ADD CONSTRAINT "need_activity_links_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_parentActivityId_fkey" FOREIGN KEY ("parentActivityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizerSubjectId_fkey" FOREIGN KEY ("organizerSubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_assignments" ADD CONSTRAINT "activity_assignments_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_assignments" ADD CONSTRAINT "activity_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_contributorSubjectId_fkey" FOREIGN KEY ("contributorSubjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_needId_fkey" FOREIGN KEY ("needId") REFERENCES "needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "activity_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_replacesAttachmentId_fkey" FOREIGN KEY ("replacesAttachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_links" ADD CONSTRAINT "source_links_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "migration_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
