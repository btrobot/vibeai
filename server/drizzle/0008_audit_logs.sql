-- Audit Logs table - 记录所有管理员操作
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(50) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id varchar(255),
  changes jsonb,
  status varchar(20) NOT NULL DEFAULT 'success',
  ip_address varchar(50),
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
