-- Convert the former 1-10 scale (10 strongest) into the new 1-6 scale
-- where Tier 1 is strongest and Tier 6 is weakest.
UPDATE "players"
SET "tier" = CASE
  WHEN "tier" >= 10 THEN 1
  WHEN "tier" = 9 THEN 2
  WHEN "tier" >= 7 THEN 3
  WHEN "tier" >= 5 THEN 4
  WHEN "tier" >= 3 THEN 5
  ELSE 6
END;
