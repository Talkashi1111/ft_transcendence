-- CreateTable
CREATE TABLE "LocalTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizerId" TEXT NOT NULL,
    "organizerAlias" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "winner" TEXT NOT NULL,
    "blockchainId" INTEGER,
    "txHash" TEXT,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" DATETIME,
    CONSTRAINT "LocalTournament_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "tournamentId" TEXT,
    "player1Id" TEXT NOT NULL,
    "player1Alias" TEXT NOT NULL,
    "player2Id" TEXT,
    "player2Alias" TEXT NOT NULL,
    "score1" INTEGER NOT NULL,
    "score2" INTEGER NOT NULL,
    "round" INTEGER,
    "matchOrder" INTEGER,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchHistory_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "LocalTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchHistory_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchHistory_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LocalTournament_organizerId_idx" ON "LocalTournament"("organizerId");

-- CreateIndex
CREATE INDEX "LocalTournament_playedAt_idx" ON "LocalTournament"("playedAt");

-- CreateIndex
CREATE INDEX "MatchHistory_tournamentId_idx" ON "MatchHistory"("tournamentId");

-- CreateIndex
CREATE INDEX "MatchHistory_player1Id_idx" ON "MatchHistory"("player1Id");

-- CreateIndex
CREATE INDEX "MatchHistory_player2Id_idx" ON "MatchHistory"("player2Id");

-- CreateIndex
CREATE INDEX "MatchHistory_playedAt_idx" ON "MatchHistory"("playedAt");
