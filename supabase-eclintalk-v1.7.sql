-- eClinTalk v1.7: profiluri, limba interfeței și menționări după nume.
-- Rulează integral în Supabase > SQL Editor > New query > Run.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  preferred_language text not null default 'ro' check (preferred_language in ('ro', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(display_name)) between 2 and 80)
);

insert into public.profiles(user_id, display_name)
select id,
  case
    when char_length(trim(split_part(coalesce(email, ''), '@', 1))) >= 2
      then initcap(replace(trim(split_part(email, '@', 1)), '.', ' '))
    else 'Utilizator'
  end
from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      case
        when char_length(trim(split_part(coalesce(new.email, ''), '@', 1))) >= 2
          then initcap(replace(trim(split_part(new.email, '@', 1)), '.', ' '))
        else 'Utilizator'
      end
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Users read profiles" on public.profiles;
create policy "Users read profiles" on public.profiles
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.profiles to authenticated;
grant update(display_name, preferred_language, updated_at) on public.profiles to authenticated;

alter table public.private_messages
  add column if not exists mentioned_user_ids uuid[] not null default '{}'::uuid[];

create index if not exists private_messages_mentions_idx
  on public.private_messages using gin(mentioned_user_ids);

drop function if exists public.get_conversation_members(uuid);
create function public.get_conversation_members(target_conversation_id uuid)
returns table(
  user_id uuid,
  email text,
  display_name text,
  joined_at timestamptz,
  is_admin boolean,
  is_owner boolean
)
language sql security definer set search_path=public as $$
  select m.user_id,
    u.email::text,
    coalesce(p.display_name, initcap(replace(split_part(u.email::text, '@', 1), '.', ' '))),
    m.joined_at,
    m.is_admin,
    (c.created_by=m.user_id)
  from public.conversation_members m
  join public.conversations c on c.id=m.conversation_id
  join auth.users u on u.id=m.user_id
  left join public.profiles p on p.user_id=m.user_id
  where m.conversation_id=target_conversation_id
    and public.is_conversation_member(target_conversation_id)
  order by (c.created_by=m.user_id) desc,m.is_admin desc,lower(coalesce(p.display_name,u.email::text));
$$;

revoke all on function public.get_conversation_members(uuid) from public;
grant execute on function public.get_conversation_members(uuid) to authenticated;

drop function if exists public.get_community_members(uuid);
create function public.get_community_members(target_community_id uuid)
returns table(
  user_id uuid,
  email text,
  display_name text,
  joined_at timestamptz,
  is_admin boolean,
  is_creator boolean
)
language sql security definer set search_path=public as $$
  select cm.user_id,
    u.email::text,
    coalesce(p.display_name, initcap(replace(split_part(u.email::text, '@', 1), '.', ' '))),
    cm.joined_at,
    cm.is_admin,
    (c.created_by=cm.user_id)
  from public.community_members cm
  join public.communities c on c.id=cm.community_id
  join auth.users u on u.id=cm.user_id
  left join public.profiles p on p.user_id=cm.user_id
  where cm.community_id=target_community_id
    and exists (
      select 1 from public.community_members mine
      where mine.community_id=target_community_id and mine.user_id=auth.uid()
    )
  order by cm.is_admin desc,lower(coalesce(p.display_name,u.email::text));
$$;

revoke all on function public.get_community_members(uuid) from public;
grant execute on function public.get_community_members(uuid) to authenticated;
