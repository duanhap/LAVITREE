-- ======================================================================================
-- LAVITREE SPRINT 2: READ-ONLY AGENT SERVICE DATABASE ROLE (SSOT)
-- Tuân thủ nguyên tắc Read-Only Enforcement (Chặn ghi 100% đối với Agent Service)
-- ======================================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lavitree_agent') THEN
        CREATE ROLE lavitree_agent WITH LOGIN PASSWORD 'agent_readonly_secret_2026';
        RAISE NOTICE 'Role lavitree_agent created successfully.';
    ELSE
        RAISE NOTICE 'Role lavitree_agent already exists.';
    END IF;
END
$$;

-- Cấp quyền kết nối CSDL và sử dụng schema public
GRANT CONNECT ON DATABASE lavitree TO lavitree_agent;
GRANT USAGE ON SCHEMA public TO lavitree_agent;

-- Chỉ cấp quyền SELECT (đọc) trên 3 bảng tài nguyên tri thức nông nghiệp
GRANT SELECT ON TABLE "KnowledgeSources" TO lavitree_agent;
GRANT SELECT ON TABLE "Diseases" TO lavitree_agent;
GRANT SELECT ON TABLE "Plants" TO lavitree_agent;

-- Rút bỏ mọi quyền ghi/sửa/xóa để phòng ngừa rủi ro can thiệp CSDL
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM lavitree_agent;
REVOKE CREATE ON SCHEMA public FROM lavitree_agent;
