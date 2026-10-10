-- Jump won / jump lost is its own event.
-- The new enum value has to be committed before a later migration can use it.

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'jump';
