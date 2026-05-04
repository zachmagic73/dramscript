-- Push Notifications Tables
-- Run: npx wrangler d1 execute dramscript-db --local --file=add-push-notifications.sql
-- Or: npx wrangler d1 execute dramscript-db --remote --file=add-push-notifications.sql --yes

-- Store device push subscriptions for each user
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL UNIQUE,
  auth_key      TEXT NOT NULL,
  p256dh_key    TEXT NOT NULL,
  user_agent    TEXT,
  subscribed_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Audit log of notifications sent
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL, -- 'friend_request_received', 'friend_request_accepted', etc.
  related_user_id TEXT,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  icon_url        TEXT,
  badge_url       TEXT,
  tag             TEXT,
  data            TEXT,
  sent_at         INTEGER DEFAULT (strftime('%s', 'now')),
  read_at         INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);
