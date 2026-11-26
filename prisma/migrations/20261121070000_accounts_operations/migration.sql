-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "forceChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffScope" TEXT;

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "applicationRef" TEXT,
ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'WEBSITE',
ADD COLUMN     "suppressed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AccountToken" (
    "digest" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "LeadContact" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorAvailability" (
    "mentorId" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorAvailability_pkey" PRIMARY KEY ("mentorId")
);

-- CreateTable
CREATE TABLE "PartnerStatus" (
    "employerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerStatus_pkey" PRIMARY KEY ("employerId")
);

-- CreateTable
CREATE TABLE "PasswordCredential" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "PasswordCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "AccountToken_userId_purpose_idx" ON "AccountToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "LeadContact_leadId_createdAt_idx" ON "LeadContact"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_paymentId_status_idx" ON "RefundRequest"("paymentId", "status");

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordCredential" ADD CONSTRAINT "PasswordCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "one_bootstrap_super_admin" ON "User" ("staffScope") WHERE "staffScope"='SUPER_ADMIN';
ALTER TABLE "User" ADD CHECK ("staffScope" IS NULL OR (role='ADMIN' AND "staffScope" IN ('SUPER_ADMIN','ADMISSIONS_STAFF','ACADEMIC_STAFF','FINANCE_STAFF','PLACEMENT_STAFF')));
ALTER TABLE "RefundRequest" ADD FOREIGN KEY ("paymentId") REFERENCES "Payment"(id), ADD CHECK ("amountMinor">0);
ALTER TABLE "MentorAvailability" ADD FOREIGN KEY ("mentorId") REFERENCES "Mentor"(id);
ALTER TABLE "PartnerStatus" ADD FOREIGN KEY ("employerId") REFERENCES "Employer"(id);
