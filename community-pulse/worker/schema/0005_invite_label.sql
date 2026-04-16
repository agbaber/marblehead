-- Add display label to invites so the inviter can identify recipients.
ALTER TABLE invites ADD COLUMN recipient_label TEXT DEFAULT '';
