-- Phase 1 only: identity and staff membership, without operational scoping.
CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL CHECK (length(btrim(name)) > 0),
  code VARCHAR(40) NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  address VARCHAR(500) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_branches (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, branch_id)
);
CREATE UNIQUE INDEX user_branches_one_primary ON user_branches(user_id) WHERE is_primary;
CREATE INDEX user_branches_branch_idx ON user_branches(branch_id);

-- Enforce membership eligibility even for direct SQL writes. Lock the user so
-- concurrent role changes and assignment writes cannot leave invalid members.
CREATE FUNCTION validate_branch_staff() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE staff_role TEXT; removed_at TIMESTAMPTZ;
BEGIN
  SELECT r.name, u.deleted_at INTO staff_role, removed_at
  FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = NEW.user_id FOR UPDATE OF u;
  IF staff_role IS NULL OR staff_role NOT IN ('manager', 'front_desk') OR removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only active Manager and Front Desk accounts can be assigned' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_branches_staff_only BEFORE INSERT OR UPDATE ON user_branches
  FOR EACH ROW EXECUTE FUNCTION validate_branch_staff();

CREATE FUNCTION clear_ineligible_branch_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM roles WHERE id = NEW.role_id AND name IN ('manager', 'front_desk')
  ) THEN
    DELETE FROM user_branches WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_branch_membership_cleanup AFTER UPDATE OF role_id, deleted_at ON users
  FOR EACH ROW EXECUTE FUNCTION clear_ineligible_branch_assignments();

INSERT INTO branches (name, code) VALUES ('Main Branch', 'MAIN');
INSERT INTO user_branches (user_id, branch_id, is_primary)
SELECT u.id, b.id, TRUE FROM users u JOIN roles r ON r.id = u.role_id
CROSS JOIN branches b WHERE r.name IN ('manager', 'front_desk') AND u.deleted_at IS NULL AND b.code = 'MAIN';
