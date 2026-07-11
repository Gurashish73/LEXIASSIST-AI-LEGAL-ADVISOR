-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'LAWYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('TRIAGE', 'REVIEW', 'MATCHED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialization" TEXT[],
    "jurisdiction" TEXT NOT NULL,
    "experienceYrs" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LawyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseBrief" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lawyerId" TEXT,
    "title" TEXT NOT NULL,
    "rawDescription" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'TRIAGE',
    "aiTimeline" JSONB,
    "aiEntities" JSONB,
    "aiRiskAnalysis" JSONB,
    "estimatedValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "caseBriefId" TEXT NOT NULL,
    "webrtcRoomId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "caseBriefId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "content" TEXT,
    "metadata" JSONB,
    "messages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "LawyerProfile_userId_key" ON "LawyerProfile"("userId");

-- CreateIndex
CREATE INDEX "LawyerProfile_userId_idx" ON "LawyerProfile"("userId");

-- CreateIndex
CREATE INDEX "LawyerProfile_jurisdiction_idx" ON "LawyerProfile"("jurisdiction");

-- CreateIndex
CREATE INDEX "LawyerProfile_isAvailable_idx" ON "LawyerProfile"("isAvailable");

-- CreateIndex
CREATE INDEX "CaseBrief_clientId_idx" ON "CaseBrief"("clientId");

-- CreateIndex
CREATE INDEX "CaseBrief_lawyerId_idx" ON "CaseBrief"("lawyerId");

-- CreateIndex
CREATE INDEX "CaseBrief_status_idx" ON "CaseBrief"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_webrtcRoomId_key" ON "Consultation"("webrtcRoomId");

-- CreateIndex
CREATE INDEX "Consultation_caseBriefId_idx" ON "Consultation"("caseBriefId");

-- CreateIndex
CREATE INDEX "Consultation_webrtcRoomId_idx" ON "Consultation"("webrtcRoomId");

-- CreateIndex
CREATE INDEX "AgentSession_clientId_idx" ON "AgentSession"("clientId");

-- CreateIndex
CREATE INDEX "AgentSession_status_idx" ON "AgentSession"("status");

-- AddForeignKey
ALTER TABLE "LawyerProfile" ADD CONSTRAINT "LawyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseBrief" ADD CONSTRAINT "CaseBrief_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseBrief" ADD CONSTRAINT "CaseBrief_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "LawyerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_caseBriefId_fkey" FOREIGN KEY ("caseBriefId") REFERENCES "CaseBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_caseBriefId_fkey" FOREIGN KEY ("caseBriefId") REFERENCES "CaseBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
