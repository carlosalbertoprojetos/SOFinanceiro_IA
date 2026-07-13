-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "issuer" VARCHAR(512) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_issuer_subject_key" ON "UserIdentity"("issuer", "subject");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- AddForeignKey
ALTER TABLE "UserIdentity"
ADD CONSTRAINT "UserIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
