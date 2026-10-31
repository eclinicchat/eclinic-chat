-- eClinTalk v1.17.0
-- Ruleaza o singura data in Supabase SQL Editor dupa scripturile anterioare.
-- Permite administratorilor comunitatii sa stabileasca ulterior grupurile vizibile fiecarui membru.

drop function if exists public.get_community_member_group_access(uuid,uuid);
create function public.get_community_member_group_access(
 target_community_id uuid,
 target_user_id uuid
)
returns table(
 conversation_id uuid,
 title text,
 is_member boolean,
 is_admin boolean,
 is_owner boolean,
 password_protected boolean,
 can_manage boolean
)
language plpgsql stable security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_community_admin(target_community_id) then
  raise exception 'Nu ai dreptul sa administrezi aceasta comunitate.';
 end if;
 if not exists(
  select 1 from public.community_members cm
  where cm.community_id=target_community_id and cm.user_id=target_user_id
 ) then
  raise exception 'Persoana nu este membra a comunitatii.';
 end if;

 return query
 select c.id,c.title,
  (m.user_id is not null),
  coalesce(m.is_admin,false),
  (c.created_by=target_user_id),
  public.conversation_requires_password(c.id),
  (
   not public.conversation_requires_password(c.id)
   or public.is_general_admin()
   or public.is_conversation_admin(c.id)
  )
 from public.conversations c
 left join public.conversation_members m
  on m.conversation_id=c.id and m.user_id=target_user_id
 where c.community_id=target_community_id
   and (
    not public.conversation_requires_password(c.id)
    or public.is_general_admin()
    or public.is_conversation_member(c.id)
   )
 order by lower(c.title);
end
$$;

revoke all on function public.get_community_member_group_access(uuid,uuid) from public;
grant execute on function public.get_community_member_group_access(uuid,uuid) to authenticated;

drop function if exists public.set_community_member_groups(uuid,uuid,uuid[]);
create function public.set_community_member_groups(
 target_community_id uuid,
 target_user_id uuid,
 target_conversation_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql security definer
set search_path=public
as $$
declare selected_ids uuid[]:=coalesce(target_conversation_ids,array[]::uuid[]);
begin
 if auth.uid() is null or not public.is_community_admin(target_community_id) then
  raise exception 'Nu ai dreptul sa administrezi aceasta comunitate.';
 end if;
 if not exists(
  select 1 from public.community_members cm
  where cm.community_id=target_community_id and cm.user_id=target_user_id
 ) then
  raise exception 'Persoana nu este membra a comunitatii.';
 end if;
 if exists(
  select 1 from unnest(selected_ids) as selected(selected_id)
  where not exists(
   select 1 from public.conversations c
   where c.id=selected_id
     and c.community_id=target_community_id
     and (
      not public.conversation_requires_password(c.id)
      or public.is_general_admin()
      or public.is_conversation_admin(c.id)
     )
  )
 ) then
  raise exception 'Nu ai dreptul sa modifici accesul la unul dintre grupurile selectate.';
 end if;

 -- Accesul proprietarilor si administratorilor de grup nu este retras din acest ecran.
 delete from public.conversation_members m
 using public.conversations c
 where m.conversation_id=c.id
   and c.community_id=target_community_id
   and m.user_id=target_user_id
   and c.created_by<>target_user_id
   and coalesce(m.is_admin,false)=false
   and (
    not public.conversation_requires_password(c.id)
    or public.is_general_admin()
    or public.is_conversation_admin(c.id)
   )
   and not (c.id=any(selected_ids));

 insert into public.conversation_members(conversation_id,user_id,is_admin)
 select c.id,target_user_id,false
 from public.conversations c
 where c.community_id=target_community_id
   and c.id=any(selected_ids)
   and (
    not public.conversation_requires_password(c.id)
    or public.is_general_admin()
    or public.is_conversation_admin(c.id)
   )
 on conflict do nothing;

 perform public.write_app_audit(
  'community.member.groups.update','community',target_community_id,
  jsonb_build_object('user_id',target_user_id,'groups',coalesce(array_length(selected_ids,1),0))
 );
end
$$;

revoke all on function public.set_community_member_groups(uuid,uuid,uuid[]) from public;
grant execute on function public.set_community_member_groups(uuid,uuid,uuid[]) to authenticated;
