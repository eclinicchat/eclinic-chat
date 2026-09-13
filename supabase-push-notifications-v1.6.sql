-- eClinic Chat v1.6: preferințe și abonamente Web Push.
-- Rulează integral în Supabase > SQL Editor > New query > Run.

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  notifications_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  mentions_only boolean not null default false,
  muted_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, conversation_id)
);

create table if not exists public.muted_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_user_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default false,
  sound_enabled boolean not null default false,
  muted_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, muted_user_id),
  check(user_id <> muted_user_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_dispatches (
  message_id uuid primary key references public.private_messages(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.notification_preferences enable row level security;
alter table public.muted_users enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_dispatches enable row level security;

drop policy if exists "Users read own notification preferences" on public.notification_preferences;
create policy "Users read own notification preferences"
  on public.notification_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create own notification preferences" on public.notification_preferences;
create policy "Users create own notification preferences"
  on public.notification_preferences for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "Users update own notification preferences" on public.notification_preferences;
create policy "Users update own notification preferences"
  on public.notification_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "Users delete own notification preferences" on public.notification_preferences;
create policy "Users delete own notification preferences"
  on public.notification_preferences for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users manage own muted users" on public.muted_users;
create policy "Users manage own muted users"
  on public.muted_users for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.muted_users to authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_dispatches from anon, authenticated;

comment on table public.push_subscriptions is
  'Abonamente Web Push private; accesibile numai backend-ului cu service role.';
