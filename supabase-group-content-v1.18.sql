-- eClinTalk v1.18.0
-- Informatii despre grup, fisiere partajate si protectie suplimentara a imaginilor.

alter table public.conversations
add column if not exists protected_content boolean not null default false;

create or replace function public.set_conversation_protected_content(
 target_conversation_id uuid,
 enabled boolean
)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null then
  raise exception 'Trebuie sa fii conectat.';
 end if;

 if not exists(
  select 1
  from public.conversations c
  join public.conversation_members m on m.conversation_id=c.id
  where c.id=target_conversation_id
   and m.user_id=auth.uid()
   and (c.created_by=auth.uid() or m.is_admin=true)
 ) then
  raise exception 'Numai proprietarul sau administratorii grupului pot schimba protectia continutului.';
 end if;

 update public.conversations
 set protected_content=coalesce(enabled,false),updated_at=now()
 where id=target_conversation_id;

 if not found then
  raise exception 'Grupul nu exista.';
 end if;

 perform public.write_app_audit(
  'group.content_protection.change',
  'conversation',
  target_conversation_id,
  jsonb_build_object('enabled',coalesce(enabled,false))
 );
end
$$;

revoke all on function public.set_conversation_protected_content(uuid,boolean) from public;
grant execute on function public.set_conversation_protected_content(uuid,boolean) to authenticated;

-- View-ul trebuie recreat pentru a include noua coloana intre datele grupului.
drop view if exists public.my_conversations;

create or replace view public.my_conversations
with(security_invoker=true)
as
 select c.id,c.title,c.created_by,c.created_at,c.updated_at,c.community_id,co.name as community_name,
 count(distinct all_members.user_id)::integer member_count,
 current_member.is_admin as my_is_admin,
 (pin.conversation_id is not null) as is_pinned,
 public.conversation_requires_password(c.id) as password_protected,
 c.protected_content,
 case when public.conversation_requires_password(c.id) then null
 else count(distinct unread.id) filter(where unread.user_id<>auth.uid())::integer end as unread_count
 from public.conversations c
 join public.conversation_members current_member
  on current_member.conversation_id=c.id and current_member.user_id=auth.uid()
 join public.conversation_members all_members on all_members.conversation_id=c.id
 left join public.communities co on co.id=c.community_id
 left join public.conversation_read_states read_state
  on read_state.conversation_id=c.id and read_state.user_id=auth.uid()
 left join public.private_messages unread
  on unread.conversation_id=c.id
  and unread.created_at>coalesce(read_state.last_read_at,'epoch'::timestamptz)
 left join public.conversation_pins pin
  on pin.conversation_id=c.id and pin.user_id=auth.uid()
 group by c.id,co.name,current_member.is_admin,pin.conversation_id,read_state.last_read_at;

grant select on public.my_conversations to authenticated;

