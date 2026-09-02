-- =============================================
-- 供电工区工作台 · Supabase 建表脚本
-- 在 Supabase 控制台 -> SQL Editor 中执行本脚本
-- =============================================

-- 1. 账号表：用户名唯一、手机号唯一
create table if not exists public.gd_accounts (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  phone text unique,
  pass_hash text not null,
  created_at timestamptz default now()
);

-- 2. 用户数据表：每个账号一行一个数据块（key 为 roster/schedule/todos 等）
create table if not exists public.gd_user_data (
  account_id uuid not null references public.gd_accounts(id) on delete cascade,
  data_key text not null,
  data_value jsonb,
  updated_at timestamptz default now(),
  primary key (account_id, data_key)
);

-- 3. 关闭 RLS（内部使用，允许 anon key 读写）。
--    注意：生产环境建议改用 Supabase Auth + RLS 以增强安全。
alter table public.gd_accounts disable row level security;
alter table public.gd_user_data disable row level security;

-- 4. 索引（可选，提高查询速度）
create index if not exists idx_gd_user_data_account on public.gd_user_data (account_id);
