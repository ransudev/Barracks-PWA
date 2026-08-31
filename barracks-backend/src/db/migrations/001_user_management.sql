CREATE TABLE IF NOT EXISTS roles (
  roleid SERIAL PRIMARY KEY,
  rolename VARCHAR(50) NOT NULL UNIQUE,
  permissions TEXT NOT NULL DEFAULT ''
);

INSERT INTO roles (rolename, permissions)
VALUES
  ('administrator', 'create_user,update_user,delete_user,assign_roles,manage_settings,view_reports'),
  ('barber', 'view_appointments,manage_appointments,view_clients,manage_queue'),
  ('front_desk', 'create_clients,update_clients,view_clients,schedule_appointments,view_appointments,process_payments,view_transactions')
ON CONFLICT (rolename) DO UPDATE
SET permissions = EXCLUDED.permissions;

CREATE TABLE IF NOT EXISTS users (
  userid SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role VARCHAR(50) NOT NULL REFERENCES roles (rolename),
  lastlogin TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS users_role_idx
  ON users (role);
