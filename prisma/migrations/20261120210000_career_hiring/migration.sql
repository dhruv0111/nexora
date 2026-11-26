-- AlterTable
ALTER TABLE "Employer" ADD COLUMN     "businessEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "industry" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recruiterName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requirements" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "compensationMax" INTEGER,
ADD COLUMN     "compensationMin" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "duplicateKey" TEXT,
ADD COLUMN     "eligibility" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "minExperience" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "moderatedBy" TEXT,
ADD COLUMN     "moderation" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "moderationNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workMode" TEXT NOT NULL DEFAULT 'ONSITE';

-- CreateTable
CREATE TABLE "CareerProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "education" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workModes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibility" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "shareContact" BOOLEAN NOT NULL DEFAULT false,
    "seeking" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT NOT NULL DEFAULT 'career-v1',
    "consentedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CareerResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "CareerResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "noticeVersion" TEXT NOT NULL DEFAULT 'career-v1',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CareerConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statement" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "availability" TEXT NOT NULL DEFAULT '',
    "meetingUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "feedback" TEXT NOT NULL DEFAULT '',
    "privateFeedback" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringOutcome" (
    "applicationId" TEXT NOT NULL,
    "offerReference" TEXT NOT NULL DEFAULT '',
    "offeredAt" TIMESTAMP(3),
    "offerVerifiedAt" TIMESTAMP(3),
    "offerVerifierId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "joiningVerifiedAt" TIMESTAMP(3),
    "joiningVerifierId" TEXT,
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HiringOutcome_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "CareerReadiness" (
    "userId" TEXT NOT NULL,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "communication" INTEGER NOT NULL DEFAULT 0,
    "preparation" INTEGER NOT NULL DEFAULT 0,
    "overrideScore" INTEGER,
    "reason" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerReadiness_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CareerMock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "availability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "feedback" TEXT NOT NULL DEFAULT '',
    "score" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerMock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerId" TEXT,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentContract" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "feeType" TEXT NOT NULL DEFAULT 'FIXED',
    "feeValue" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "replacementDays" INTEGER NOT NULL DEFAULT 0,
    "refundDays" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentInvoice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerProfile_visibility_seeking_updatedAt_idx" ON "CareerProfile"("visibility", "seeking", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerResume_userId_version_key" ON "CareerResume"("userId", "version");

-- CreateIndex
CREATE INDEX "CareerConsent_employerId_revokedAt_idx" ON "CareerConsent"("employerId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerConsent_userId_employerId_key" ON "CareerConsent"("userId", "employerId");

-- CreateIndex
CREATE INDEX "HiringApplication_opportunityId_status_updatedAt_idx" ON "HiringApplication"("opportunityId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HiringApplication_userId_updatedAt_idx" ON "HiringApplication"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HiringApplication_userId_opportunityId_key" ON "HiringApplication"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "HiringHistory_applicationId_createdAt_idx" ON "HiringHistory"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "HiringInterview_applicationId_startsAt_idx" ON "HiringInterview"("applicationId", "startsAt");

-- CreateIndex
CREATE INDEX "HiringOutcome_offerVerifiedAt_idx" ON "HiringOutcome"("offerVerifiedAt");

-- CreateIndex
CREATE INDEX "HiringOutcome_joiningVerifiedAt_idx" ON "HiringOutcome"("joiningVerifiedAt");

-- CreateIndex
CREATE INDEX "CareerMock_userId_startsAt_idx" ON "CareerMock"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "CareerMock_mentorId_startsAt_idx" ON "CareerMock"("mentorId", "startsAt");

-- CreateIndex
CREATE INDEX "CareerRequest_userId_createdAt_idx" ON "CareerRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CareerRequest_status_createdAt_idx" ON "CareerRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CareerDocument_userId_createdAt_idx" ON "CareerDocument"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CareerDocument_employerId_idx" ON "CareerDocument"("employerId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentContract_employerId_reference_key" ON "RecruitmentContract"("employerId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentInvoice_reference_key" ON "RecruitmentInvoice"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_duplicateKey_key" ON "Opportunity"("duplicateKey");

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerResume" ADD CONSTRAINT "CareerResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerConsent" ADD CONSTRAINT "CareerConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerConsent" ADD CONSTRAINT "CareerConsent_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringHistory" ADD CONSTRAINT "HiringHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringInterview" ADD CONSTRAINT "HiringInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringOutcome" ADD CONSTRAINT "HiringOutcome_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerReadiness" ADD CONSTRAINT "CareerReadiness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerMock" ADD CONSTRAINT "CareerMock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerRequest" ADD CONSTRAINT "CareerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerDocument" ADD CONSTRAINT "CareerDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerDocument" ADD CONSTRAINT "CareerDocument_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentContract" ADD CONSTRAINT "RecruitmentContract_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentInvoice" ADD CONSTRAINT "RecruitmentInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RecruitmentContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing employers remain unverified until an administrator reviews this workflow.
ALTER TABLE "Employer" ADD CONSTRAINT "Employer_verification_state" CHECK ("verificationStatus" IN ('REGISTERED','PENDING_REVIEW','VERIFIED','REJECTED','SUSPENDED'));
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_visibility" CHECK (visibility IN ('PRIVATE','EMPLOYERS','PUBLIC'));
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_experience" CHECK ("experienceYears" BETWEEN 0 AND 60);
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_state" CHECK (status IN ('DRAFT','APPLIED','SCREENING','SHORTLISTED','INTERVIEW','OFFERED','HIRED','REJECTED','WITHDRAWN','CLOSED'));
ALTER TABLE "HiringInterview" ADD CONSTRAINT "HiringInterview_state" CHECK (status IN ('REQUESTED','CONFIRMED','CANCELLED','COMPLETED'));
ALTER TABLE "HiringInterview" ADD CONSTRAINT "HiringInterview_duration" CHECK ("endsAt">"startsAt");
ALTER TABLE "CareerMock" ADD CONSTRAINT "CareerMock_state" CHECK (status IN ('REQUESTED','CONFIRMED','CANCELLED','COMPLETED'));
ALTER TABLE "CareerMock" ADD CONSTRAINT "CareerMock_score" CHECK (score IS NULL OR score BETWEEN 0 AND 100);
ALTER TABLE "CareerReadiness" ADD CONSTRAINT "CareerReadiness_score" CHECK (communication BETWEEN 0 AND 10 AND preparation BETWEEN 0 AND 10 AND ("overrideScore" IS NULL OR "overrideScore" BETWEEN 0 AND 100));
ALTER TABLE "CareerDocument" ADD CONSTRAINT "CareerDocument_size" CHECK (size BETWEEN 1 AND 2097152);
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_moderation" CHECK (moderation IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE "RecruitmentContract" ADD CONSTRAINT "RecruitmentContract_disabled" CHECK (status='DRAFT' AND "feeType" IN ('FIXED','PERCENTAGE') AND "feeValue">=0 AND ("feeType"<>'PERCENTAGE' OR "feeValue"<=10000));
ALTER TABLE "RecruitmentInvoice" ADD CONSTRAINT "RecruitmentInvoice_disabled" CHECK (status='DRAFT' AND "amountMinor">0);
