-- CreateTable
CREATE TABLE "MissionDocument" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionDocument_missionId_createdAt_idx" ON "MissionDocument"("missionId", "createdAt");

-- AddForeignKey
ALTER TABLE "MissionDocument" ADD CONSTRAINT "MissionDocument_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
