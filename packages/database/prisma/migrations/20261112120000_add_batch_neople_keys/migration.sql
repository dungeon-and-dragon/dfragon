BEGIN;

-- CreateTable
CREATE TABLE "batch_neople_keys" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejected_at" TIMESTAMPTZ(3),

    CONSTRAINT "batch_neople_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batch_neople_keys_key_key" ON "batch_neople_keys"("key");

COMMIT;
