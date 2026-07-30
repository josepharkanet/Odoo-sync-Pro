-- CreateTable
CREATE TABLE "DeliveryConfig" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "config" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Integration" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "odooUrl" TEXT,
    "odooDb" TEXT,
    "odooLogin" TEXT,
    "odooKeyEnc" TEXT,
    "updatedAt" DATETIME NOT NULL
);
