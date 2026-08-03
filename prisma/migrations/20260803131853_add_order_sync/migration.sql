-- CreateTable
CREATE TABLE "OrderSync" (
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderName" TEXT,
    "status" TEXT NOT NULL,
    "odooOrderId" INTEGER,
    "odooOrderName" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("shop", "shopifyOrderId")
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Integration" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "odooUrl" TEXT,
    "odooDb" TEXT,
    "odooLogin" TEXT,
    "odooKeyEnc" TEXT,
    "matchBy" TEXT,
    "pushOrders" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Integration" ("odooDb", "odooKeyEnc", "odooLogin", "odooUrl", "shop", "updatedAt") SELECT "odooDb", "odooKeyEnc", "odooLogin", "odooUrl", "shop", "updatedAt" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OrderSync_shop_updatedAt_idx" ON "OrderSync"("shop", "updatedAt");
