-- ======================================================================================
-- LAVITREE SPRINT 2: READ-ONLY AGENT SERVICE DATABASE ROLE (SSOT)
-- Tuân thủ nguyên tắc Read-Only Enforcement (Chặn ghi 100% đối với Agent Service)
--
-- Chạy bằng tài khoản quản trị DB, sau khi đã chạy migration của Core API:
--   psql -v agent_db_password="$AGENT_DB_PASSWORD" -f 03_create_agent_readonly_role.sql "<ADMIN_DB_URL>"
-- Mật khẩu chỉ truyền lúc chạy, không ghi vào file này. Chạy lại script sẽ đổi sang mật khẩu mới.
-- ======================================================================================

\set ON_ERROR_STOP on

\if :{?agent_db_password}
\else
DO $$ BEGIN RAISE EXCEPTION 'Thieu mat khau: chay psql voi -v agent_db_password=...'; END $$;
\endif

SELECT 'CREATE ROLE lavitree_agent WITH LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lavitree_agent')
\gexec

SELECT format('ALTER ROLE lavitree_agent WITH LOGIN PASSWORD %L', :'agent_db_password')
\gexec

-- Lớp bảo vệ thứ hai: mọi phiên của role này mặc định là chỉ đọc
ALTER ROLE lavitree_agent SET default_transaction_read_only = on;

-- Cấp quyền kết nối vào đúng DB đang chạy (lavitree ở Docker local, postgres ở Supabase)
SELECT format('GRANT CONNECT ON DATABASE %I TO lavitree_agent', current_database())
\gexec
GRANT USAGE ON SCHEMA public TO lavitree_agent;

-- Rút mọi quyền rồi chỉ cấp lại SELECT trên 2 bảng Agent thực sự cần
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM lavitree_agent;
REVOKE CREATE ON SCHEMA public FROM lavitree_agent;

GRANT SELECT ON TABLE "KnowledgeSources" TO lavitree_agent; -- Hybrid RAG (TASK-06)
GRANT SELECT ON TABLE "Products" TO lavitree_agent;         -- export_offline_cache (TASK-07)
