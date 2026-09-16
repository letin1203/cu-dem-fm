-- A player may have only one pending swap request per tournament, either as
-- the requester or as the requested replacement.
CREATE UNIQUE INDEX "tournament_swap_requests_one_pending_requester"
  ON "tournament_swap_requests" ("tournamentId", "requesterPlayerId")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "tournament_swap_requests_one_pending_target"
  ON "tournament_swap_requests" ("tournamentId", "targetPlayerId")
  WHERE "status" = 'PENDING';
