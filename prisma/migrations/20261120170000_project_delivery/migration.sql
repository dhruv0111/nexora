-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "confidential" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "engagementType" TEXT NOT NULL DEFAULT 'SUPERVISED_TRAINING',
ADD COLUMN     "productKey" TEXT NOT NULL DEFAULT 'training-product',
ADD COLUMN     "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AgilePod" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "cohortId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PodMember" ADD COLUMN     "discipline" "Track",
ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "leftAt" TIMESTAMP(3),
ADD COLUMN     "responsibility" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "supervisorId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ProjectStaff" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ProjectStaff_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ProjectSprint" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "retrospective" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProjectSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTicket" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "sprintId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "acceptance" TEXT[],
    "definitionOfDone" TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "kind" TEXT NOT NULL DEFAULT 'STORY',
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "dueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "codeReviewed" BOOLEAN NOT NULL DEFAULT false,
    "qaAccepted" BOOLEAN NOT NULL DEFAULT false,
    "dodAccepted" BOOLEAN NOT NULL DEFAULT false,
    "securityCleared" BOOLEAN NOT NULL DEFAULT false,
    "issueUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionEvidence" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewerId" TEXT,
    "feedback" TEXT,
    "evaluation" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "githubVerifiedAt" TIMESTAMP(3),
    "githubAuthorId" TEXT,
    "githubState" TEXT,
    "repositoryPublic" BOOLEAN NOT NULL DEFAULT false,
    "providerSha" TEXT,
    "ticketVersion" INTEGER NOT NULL,
    "requestKey" TEXT NOT NULL,

    CONSTRAINT "ContributionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRevision" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "challenges" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "feedback" TEXT,
    "reviewerId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectConcern" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectConcern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRelease" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "deploymentUrl" TEXT,
    "signedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "ProjectRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWebhook" (
    "processingAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "repository" TEXT,
    "state" TEXT NOT NULL DEFAULT 'RECEIVED',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStaff_userId_idx" ON "ProjectStaff"("userId");

-- CreateIndex
CREATE INDEX "ProjectSprint_podId_status_idx" ON "ProjectSprint"("podId", "status");

-- CreateIndex
CREATE INDEX "ProjectTicket_podId_status_updatedAt_idx" ON "ProjectTicket"("podId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectTicket_assigneeId_idx" ON "ProjectTicket"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionEvidence_requestKey_key" ON "ContributionEvidence"("requestKey");

-- CreateIndex
CREATE INDEX "ContributionEvidence_userId_status_idx" ON "ContributionEvidence"("userId", "status");

-- CreateIndex
CREATE INDEX "ContributionEvidence_ticketId_status_idx" ON "ContributionEvidence"("ticketId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRevision_evidenceId_version_key" ON "EvidenceRevision"("evidenceId", "version");

-- CreateIndex
CREATE INDEX "ProjectComment_ticketId_createdAt_idx" ON "ProjectComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectFile_evidenceId_idx" ON "ProjectFile"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioEntry_userId_evidenceId_key" ON "PortfolioEntry"("userId", "evidenceId");

-- CreateIndex
CREATE INDEX "ProjectConcern_podId_resolvedAt_idx" ON "ProjectConcern"("podId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ProjectRelease_podId_createdAt_idx" ON "ProjectRelease"("podId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRepository_fullName_key" ON "ProjectRepository"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWebhook_deliveryId_key" ON "ProjectWebhook"("deliveryId");

-- CreateIndex
CREATE INDEX "AgilePod_projectId_idx" ON "AgilePod"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AgilePod_projectId_name_key" ON "AgilePod"("projectId", "name");

-- AddForeignKey
ALTER TABLE "AgilePod" ADD CONSTRAINT "AgilePod_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMember" ADD CONSTRAINT "PodMember_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStaff" ADD CONSTRAINT "ProjectStaff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStaff" ADD CONSTRAINT "ProjectStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSprint" ADD CONSTRAINT "ProjectSprint_podId_fkey" FOREIGN KEY ("podId") REFERENCES "AgilePod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTicket" ADD CONSTRAINT "ProjectTicket_podId_fkey" FOREIGN KEY ("podId") REFERENCES "AgilePod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTicket" ADD CONSTRAINT "ProjectTicket_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "ProjectSprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTicket" ADD CONSTRAINT "ProjectTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionEvidence" ADD CONSTRAINT "ContributionEvidence_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ProjectTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionEvidence" ADD CONSTRAINT "ContributionEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRevision" ADD CONSTRAINT "EvidenceRevision_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ContributionEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ProjectTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ContributionEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioEntry" ADD CONSTRAINT "PortfolioEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioEntry" ADD CONSTRAINT "PortfolioEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ContributionEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectConcern" ADD CONSTRAINT "ProjectConcern_podId_fkey" FOREIGN KEY ("podId") REFERENCES "AgilePod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRelease" ADD CONSTRAINT "ProjectRelease_podId_fkey" FOREIGN KEY ("podId") REFERENCES "AgilePod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRepository" ADD CONSTRAINT "ProjectRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing project/pod records; new delivery state fields have conservative defaults.
ALTER TABLE "Project" ADD CONSTRAINT "Project_training_engagement" CHECK ("engagementType"='SUPERVISED_TRAINING');
ALTER TABLE "ProjectSprint" ADD CONSTRAINT "ProjectSprint_dates_state" CHECK ("endsAt">"startsAt" AND "status" IN ('PLANNED','ACTIVE','COMPLETED','CANCELLED'));
CREATE UNIQUE INDEX "ProjectSprint_one_active" ON "ProjectSprint"("podId") WHERE "status"='ACTIVE';
ALTER TABLE "ProjectTicket" ADD CONSTRAINT "ProjectTicket_status" CHECK ("status" IN ('BACKLOG','READY','IN_PROGRESS','IN_REVIEW','QA_TESTING','DONE') AND "priority" IN ('LOW','MEDIUM','HIGH','CRITICAL') AND "kind" IN ('STORY','TASK','DEFECT'));
ALTER TABLE "ContributionEvidence" ADD CONSTRAINT "ContributionEvidence_status" CHECK ("status" IN ('SUBMITTED','APPROVED','CHANGES_REQUESTED','REJECTED') AND ("evaluation" IS NULL OR "evaluation" BETWEEN 1 AND 5));
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_bounds" CHECK (("removedAt" IS NOT NULL AND "data" IS NULL) OR ("data" IS NOT NULL AND "size" BETWEEN 1 AND 2097152 AND octet_length("data")="size" AND "mime" IN ('text/plain','application/pdf')));
ALTER TABLE "PortfolioEntry" ADD CONSTRAINT "PortfolioEntry_state" CHECK ("status" IN ('DRAFT','APPROVED','CHANGES_REQUESTED'));
