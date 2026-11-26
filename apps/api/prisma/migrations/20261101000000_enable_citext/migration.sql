-- The users.email column uses CITEXT for case-insensitive uniqueness.
-- PostgreSQL does not ship the extension enabled by default, so it must be
-- created before the init migration runs (migration order is alphabetical).
CREATE EXTENSION IF NOT EXISTS citext;
