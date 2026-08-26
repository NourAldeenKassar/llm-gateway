-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL DEFAULT 'latest',
    "status" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "providers" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);
