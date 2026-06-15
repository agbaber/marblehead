-- Adds drip_week_index counter to subscriber.
-- Semantics: count of primer cards already delivered to this subscriber.
-- 0 = no primer sent yet. Incremented atomically with a successful digest send
-- that included a primer card.

ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0;
