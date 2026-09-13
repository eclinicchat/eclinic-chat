-- eClinic Chat v0.5: conversații private vizibile numai membrilor.
-- Rulează integral în Supabase > SQL Editor > New query > Run.
create extension if not exists pgcrypto;
create table if not exists public.conversations(
 id uuid primary key default gen_random_uuid(),title text not null check(char_length(title) between 1 and 80),
 created_by uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.conversation_members(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,joined_at timestamptz not null default now(),primary key(conversation_id,user_id));
create table if not exists public.private_messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,sender_email text,body text not null check(char_length(body) between 1 and 4000),created_at timestamptz not null default now());
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,conversation_id);
create index if not exists private_messages_conversation_created_idx on public.private_messages(conversation_id,created_at);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.private_messages enable row level security;
create or replace function public.is_conversation_member(check_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.conversation_members
  where conversation_id=check_conversation_id and user_id=auth.uid())
$$;
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;
drop policy if exists "Members read conversations" on public.conversations;
create policy "Members read conversations" on public.conversations for select to authenticated using(
 public.is_conversation_member(conversations.id));
drop policy if exists "Members read memberships" on public.conversation_members;
create policy "Members read memberships" on public.conversation_members for select to authenticated using(
 public.is_conversation_member(conversation_members.conversation_id));
drop policy if exists "Members read messages" on public.private_messages;
create policy "Members read messages" on public.private_messages for select to authenticated using(
 public.is_conversation_member(private_messages.conversation_id));
drop policy if exists "Members send messages" on public.private_messages;
create policy "Members send messages" on public.private_messages for insert to authenticated with check(
 auth.uid()=user_id and public.is_conversation_member(private_messages.conversation_id));
create or replace function public.create_private_conversation(conversation_title text,member_emails text[] default array[]::text[])
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare new_id uuid; requested_count integer; found_count integer;
begin
 if auth.uid() is null then raise exception 'Trebuie să fii conectat.'; end if;
 if nullif(trim(conversation_title),'') is null or char_length(trim(conversation_title))>80 then raise exception 'Numele conversației nu este valid.'; end if;
 select count(distinct lower(trim(email))) into requested_count from unnest(coalesce(member_emails,array[]::text[])) email
  where trim(email)<>'' and lower(trim(email))<>lower(coalesce(auth.jwt()->>'email',''));
 select count(*) into found_count from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email
  where trim(email)<>'' and lower(trim(email))<>lower(coalesce(auth.jwt()->>'email','')));
 if found_count<>requested_count then raise exception 'Unul sau mai multe emailuri nu au încă un cont.'; end if;
 insert into public.conversations(title,created_by) values(trim(conversation_title),auth.uid()) returning id into new_id;
 insert into public.conversation_members(conversation_id,user_id) values(new_id,auth.uid());
 insert into public.conversation_members(conversation_id,user_id)
  select new_id,u.id from auth.users u where lower(u.email) in(
   select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email where trim(email)<>'') on conflict do nothing;
 return new_id;
end $$;
revoke all on function public.create_private_conversation(text,text[]) from public;
grant execute on function public.create_private_conversation(text,text[]) to authenticated;
create or replace function public.touch_conversation() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.conversations set updated_at=now() where id=new.conversation_id;return new;end $$;
drop trigger if exists private_message_touch_conversation on public.private_messages;
create trigger private_message_touch_conversation after insert on public.private_messages for each row execute function public.touch_conversation();
create or replace view public.my_conversations with(security_invoker=true) as
 select c.id,c.title,c.created_by,c.created_at,c.updated_at,count(m.user_id)::integer member_count
 from public.conversations c join public.conversation_members m on m.conversation_id=c.id group by c.id;
grant select on public.my_conversations to authenticated;
do $$ begin alter publication supabase_realtime add table public.private_messages; exception when duplicate_object then null; end $$;
