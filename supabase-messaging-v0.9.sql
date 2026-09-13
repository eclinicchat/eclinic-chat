-- eClinic Chat v0.9: reply, reactii, pin si mesaje necitite.
-- Ruleaza integral in Supabase > SQL Editor > New query > Run.

alter table public.private_messages
add column if not exists reply_to_id uuid references public.private_messages(id) on delete set null,
add column if not exists pinned_at timestamptz,
add column if not exists pinned_by uuid references auth.users(id) on delete set null;

create index if not exists private_messages_reply_idx
on public.private_messages(reply_to_id);

create or replace function public.validate_message_reply()
returns trigger
language plpgsql security definer
set search_path=public
as $$
begin
 if new.reply_to_id is not null and not exists(
  select 1 from public.private_messages original
  where original.id=new.reply_to_id
  and original.conversation_id=new.conversation_id
 ) then raise exception 'Mesajul citat nu apartine acestei conversatii.'; end if;
 return new;
end
$$;

drop trigger if exists private_message_validate_reply on public.private_messages;
create trigger private_message_validate_reply
before insert or update of reply_to_id on public.private_messages
for each row execute function public.validate_message_reply();

create table if not exists public.message_reactions(
 message_id uuid not null references public.private_messages(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null,
 created_at timestamptz not null default now(),
 primary key(message_id,user_id)
);

create index if not exists message_reactions_conversation_idx
on public.message_reactions(conversation_id,message_id);

create table if not exists public.conversation_read_states(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

create table if not exists public.conversation_pins(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 pinned_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

alter table public.message_reactions enable row level security;
alter table public.conversation_read_states enable row level security;
alter table public.conversation_pins enable row level security;

drop policy if exists "Members read reactions" on public.message_reactions;
create policy "Members read reactions" on public.message_reactions
for select to authenticated
using(public.is_conversation_member(conversation_id));

drop policy if exists "Users read own states" on public.conversation_read_states;
create policy "Users read own states" on public.conversation_read_states
for select to authenticated using(user_id=auth.uid());

drop policy if exists "Users read own pins" on public.conversation_pins;
create policy "Users read own pins" on public.conversation_pins
for select to authenticated using(user_id=auth.uid());

insert into public.conversation_read_states(conversation_id,user_id,last_read_at)
select conversation_id,user_id,now() from public.conversation_members
on conflict do nothing;

create or replace function public.create_member_read_state()
returns trigger
language plpgsql security definer
set search_path=public
as $$
begin
 insert into public.conversation_read_states(conversation_id,user_id,last_read_at)
 values(new.conversation_id,new.user_id,now()) on conflict do nothing;
 return new;
end
$$;

drop trigger if exists conversation_member_read_state on public.conversation_members;
create trigger conversation_member_read_state
after insert on public.conversation_members
for each row execute function public.create_member_read_state();

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
 end if;
 insert into public.conversation_read_states(conversation_id,user_id,last_read_at)
 values(target_conversation_id,auth.uid(),now())
 on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at;
end
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.toggle_conversation_pin(target_conversation_id uuid)
returns boolean
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
 end if;
 if exists(select 1 from public.conversation_pins
  where conversation_id=target_conversation_id and user_id=auth.uid()) then
  delete from public.conversation_pins
  where conversation_id=target_conversation_id and user_id=auth.uid();
  return false;
 end if;
 insert into public.conversation_pins(conversation_id,user_id)
 values(target_conversation_id,auth.uid());
 return true;
end
$$;

revoke all on function public.toggle_conversation_pin(uuid) from public;
grant execute on function public.toggle_conversation_pin(uuid) to authenticated;

create or replace function public.set_message_reaction(
 target_message_id uuid,reaction_emoji text
)
returns void
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;current_emoji text;
begin
 if reaction_emoji not in ('👍','❤️','😂','😮','😢','🙏') then
  raise exception 'Reactia nu este acceptata.';
 end if;
 select conversation_id into target_conversation_id
 from public.private_messages where id=target_message_id;
 if target_conversation_id is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la acest mesaj.';
 end if;
 select emoji into current_emoji from public.message_reactions
 where message_id=target_message_id and user_id=auth.uid();
 if current_emoji=reaction_emoji then
  delete from public.message_reactions
  where message_id=target_message_id and user_id=auth.uid();
 else
  insert into public.message_reactions(message_id,conversation_id,user_id,emoji,created_at)
  values(target_message_id,target_conversation_id,auth.uid(),reaction_emoji,now())
  on conflict(message_id,user_id) do update set emoji=excluded.emoji,created_at=excluded.created_at;
 end if;
end
$$;

revoke all on function public.set_message_reaction(uuid,text) from public;
grant execute on function public.set_message_reaction(uuid,text) to authenticated;

create or replace function public.toggle_message_pin(target_message_id uuid)
returns boolean
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;currently_pinned timestamptz;
begin
 select conversation_id,pinned_at into target_conversation_id,currently_pinned
 from public.private_messages where id=target_message_id;
 if target_conversation_id is null or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii pot fixa mesaje.';
 end if;
 if currently_pinned is null then
  update public.private_messages set pinned_at=now(),pinned_by=auth.uid()
  where id=target_message_id;
  return true;
 end if;
 update public.private_messages set pinned_at=null,pinned_by=null
 where id=target_message_id;
 return false;
end
$$;

revoke all on function public.toggle_message_pin(uuid) from public;
grant execute on function public.toggle_message_pin(uuid) to authenticated;

create or replace view public.my_conversations
with(security_invoker=true)
as
 select c.id,c.title,c.created_by,c.created_at,c.updated_at,
 count(distinct all_members.user_id)::integer member_count,
 current_member.is_admin as my_is_admin,
 (pin.conversation_id is not null) as is_pinned,
 public.conversation_requires_password(c.id) as password_protected,
 case when public.conversation_requires_password(c.id) then null
 else count(distinct unread.id) filter(where unread.user_id<>auth.uid())::integer end as unread_count
 from public.conversations c
 join public.conversation_members current_member
  on current_member.conversation_id=c.id and current_member.user_id=auth.uid()
 join public.conversation_members all_members on all_members.conversation_id=c.id
 left join public.conversation_read_states read_state
  on read_state.conversation_id=c.id and read_state.user_id=auth.uid()
 left join public.private_messages unread
  on unread.conversation_id=c.id
  and unread.created_at>coalesce(read_state.last_read_at,'epoch'::timestamptz)
 left join public.conversation_pins pin
  on pin.conversation_id=c.id and pin.user_id=auth.uid()
 group by c.id,current_member.is_admin,pin.conversation_id,read_state.last_read_at;

grant select on public.my_conversations to authenticated;

do $$
begin
 alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end
$$;
