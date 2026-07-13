-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseBriefId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "redlines" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileUrl_key" ON "Document"("fileUrl");

-- CreateIndex
CREATE INDEX "Document_caseBriefId_idx" ON "Document"("caseBriefId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseBriefId_fkey" FOREIGN KEY ("caseBriefId") REFERENCES "CaseBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
