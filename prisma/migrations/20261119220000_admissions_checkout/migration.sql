-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'REVIEW_REQUIRED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ASSESSMENT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'WAITLISTED';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "assessmentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contentApprovedAt" TIMESTAMP(3),
ADD COLUMN     "contentSource" TEXT,
ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'INR',
ADD COLUMN     "deliveryFormat" TEXT NOT NULL DEFAULT 'Live mentor-led training',
ADD COLUMN     "durationWeeks" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "enrollmentTerms" TEXT,
ADD COLUMN     "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "previewVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceApprovedAt" TIMESTAMP(3),
ADD COLUMN     "priceMinor" INTEGER,
ADD COLUMN     "priceVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "refundPolicy" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "termsApprovedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "admissionsOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "agreedAt" TIMESTAMP(3),
ADD COLUMN     "agreementHash" TEXT,
ADD COLUMN     "amountMinor" INTEGER,
ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "currency" CHAR(3),
ADD COLUMN     "priceVersion" INTEGER,
ADD COLUMN     "refundSnapshot" TEXT,
ADD COLUMN     "reservedUntil" TIMESTAMP(3),
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "termsSnapshot" TEXT,
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "failureCode" TEXT,
ADD COLUMN     "orderState" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "providerReceipt" TEXT,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "refundedMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "admittedCourseVersion" INTEGER,
ADD COLUMN     "assessmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "details" JSONB,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "triageStatus" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "triagedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CurriculumModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "weeklyTopics" TEXT[],

    CONSTRAINT "CurriculumModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseInstructor" (
    "courseId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,

    CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("courseId","mentorId")
);

-- CreateTable
CREATE TABLE "ApplicantProfile" (
    "userId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'RECEIVED',
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CourseRevision" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumModule_courseId_startWeek_key" ON "CurriculumModule"("courseId", "startWeek");

-- CreateIndex
CREATE INDEX "CourseInstructor_mentorId_idx" ON "CourseInstructor"("mentorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_providerEventId_key" ON "PaymentEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_state_receivedAt_idx" ON "PaymentEvent"("state", "receivedAt");

-- CreateIndex
CREATE INDEX "ActionRateBucket_expiresAt_idx" ON "ActionRateBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRevision_courseId_version_key" ON "CourseRevision"("courseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_applicationId_key" ON "Enrollment"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReceipt_key" ON "Payment"("providerReceipt");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumModule" ADD CONSTRAINT "CurriculumModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantProfile" ADD CONSTRAINT "ApplicantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRevision" ADD CONSTRAINT "CourseRevision_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve legacy nullable snapshots while constraining all new financial records.
ALTER TABLE "Course" ADD CONSTRAINT "course_fee_nonnegative" CHECK ("priceMinor" IS NULL OR "priceMinor" >= 100);
ALTER TABLE "CurriculumModule" ADD CONSTRAINT "module_four_week_structure" CHECK ("startWeek" IN (1,5,9,13,17,21) AND cardinality("weeklyTopics") = 4);
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_quote_positive" CHECK ("amountMinor" IS NULL OR "amountMinor" >= 100);
ALTER TABLE "Payment" ADD CONSTRAINT "payment_refund_bounds" CHECK ("refundedMinor" >= 0 AND "refundedMinor" <= "amountMinor");
CREATE UNIQUE INDEX "Payment_one_razorpay_order_per_enrollment" ON "Payment"("enrollmentId") WHERE "provider" = 'razorpay';
