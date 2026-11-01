-- eClinTalk v1.20.1
-- Ruleaza o singura data in Supabase > SQL Editor dupa scripturile anterioare.
-- Administratorul decide daca un membru nou vede istoricul sau numai mesajele noi.

alter table public.conversation_members
 add column if not exists history_visible_from timestamptz;

alter table public.community_invitations
 add column if not exists include_message_history boolean not null default false;

create or replace function public.can_read_conversation_history(
 target_conversation_id uuid,
 message_created_at timestamptz
)
returns boolean
language sql stable security definer
set search_path=public
as $$
 select exists(
  select 1
  from public.conversation_members cm
  where cm.conversation_id=target_conversation_id
    and cm.user_id=auth.uid()
    and (cm.history_visible_from is null or message_created_at>=cm.history_visible_from)
 )
$$;

revoke all on function public.can_read_conversation_history(uuid,timestamptz) from public;
grant execute on function public.can_read_conversation_history(uuid,timestamptz) to authenticated;

create or replace function public.can_read_message(target_message_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
 select exists(
  select 1
  from public.private_messages pm
  where pm.id=target_message_id
    and public.has_conversation_access(pm.conversation_id)
    and public.can_read_conversation_history(pm.conversation_id,pm.created_at)
 )
$$;

revoke all on function public.can_read_message(uuid) from public;
grant execute on function public.can_read_message(uuid) to authenticated;

drop policy if exists "Members read messages" on public.private_messages;
create policy "Members read messages" on public.private_messages
for select to authenticated
using(
 public.has_conversation_access(conversation_id)
 and public.can_read_conversation_history(conversation_id,created_at)
);

drop policy if exists "Members read reactions" on public.message_reactions;
create policy "Members read reactions" on public.message_reactions
for select to authenticated
using(public.can_read_message(message_id));

drop policy if exists "Members view chat images" on storage.objects;
create policy "Members view chat images" on storage.objects
for select to authenticated
using(
 bucket_id='chat-images'
 and exists(
  select 1 from public.private_messages pm
  where pm.attachment_path=storage.objects.name
    and public.can_read_message(pm.id)
 )
);

drop function if exists public.add_conversation_members(uuid,text[]);
drop function if exists public.add_conversation_members(uuid,text[],boolean);
create function public.add_conversation_members(
 target_conversation_id uuid,
 member_emails text[] default array[]::text[],
 include_message_history boolean default false
)
returns integer
language plpgsql security definer
set search_path=public,auth
as $$
declare requested_count integer;found_count integer;inserted_count integer;target_community_id uuid;
begin
 if auth.uid() is null
    or not public.has_conversation_access(target_conversation_id)
    or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii unui grup deblocat pot adauga membri.';
 end if;
 select community_id into target_community_id from public.conversations where id=target_conversation_id;
 select count(distinct lower(trim(email))) into requested_count
 from unnest(coalesce(member_emails,array[]::text[])) email where trim(email)<>'';
 if requested_count=0 then raise exception 'Introdu cel putin o adresa de email.'; end if;
 select count(*) into found_count from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
 );
 if found_count<>requested_count then raise exception 'Unul sau mai multe emailuri nu au inca un cont.'; end if;
 if target_community_id is not null and exists(
  select 1 from auth.users u where lower(u.email) in(
   select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
  ) and not exists(
   select 1 from public.community_members cm
   where cm.community_id=target_community_id and cm.user_id=u.id
  )
 ) then raise exception 'Membrul trebuie adaugat mai intai in comunitate.'; end if;
 insert into public.conversation_members(conversation_id,user_id,is_admin,history_visible_from)
 select target_conversation_id,u.id,false,
  case when include_message_history then null else now() end
 from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
 ) on conflict do nothing;
 get diagnostics inserted_count=row_count;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.members.add','conversation',target_conversation_id,
  jsonb_build_object('count',inserted_count,'include_history',include_message_history));
 return inserted_count;
end
$$;

revoke all on function public.add_conversation_members(uuid,text[],boolean) from public;
grant execute on function public.add_conversation_members(uuid,text[],boolean) to authenticated;

drop function if exists public.create_community_invitation(uuid,text,uuid[]);
drop function if exists public.create_community_invitation(uuid,text,uuid[],boolean);
create function public.create_community_invitation(
 target_community_id uuid,
 invitee_email text,
 target_conversation_ids uuid[] default array[]::uuid[],
 include_message_history boolean default false
)
returns table(outcome text,invitation_token uuid,normalized_email text,invitation_expires_at timestamptz)
language plpgsql security definer
set search_path=public,auth
as $$
declare
 clean_email text:=lower(trim(invitee_email));
 target_user_id uuid;
 new_invitation_id uuid;
 new_token uuid;
 new_expiry timestamptz;
begin
 if auth.uid() is null or not public.is_community_admin(target_community_id) then
  raise exception 'Numai administratorii comunitatii pot trimite invitatii.';
 end if;
 if clean_email='' or clean_email not like '%_@_%._%' or char_length(clean_email)>320 then
  raise exception 'Adresa de email nu este valida.';
 end if;
 if exists(
  select 1 from unnest(coalesce(target_conversation_ids,array[]::uuid[])) as selected(selected_id)
  where not exists(
   select 1 from public.conversations c
   where c.id=selected_id and c.community_id=target_community_id
     and not public.conversation_requires_password(c.id)
  )
 ) then raise exception 'Grupurile selectate trebuie sa apartina comunitatii si sa nu fie protejate cu parola.'; end if;

 select u.id into target_user_id from auth.users u where lower(u.email)=clean_email limit 1;
 if target_user_id is not null then
  insert into public.community_members(community_id,user_id,is_admin)
  values(target_community_id,target_user_id,false) on conflict do nothing;
  insert into public.conversation_members(conversation_id,user_id,is_admin,history_visible_from)
  select distinct selected.selected_id,target_user_id,false,
   case when include_message_history then null else now() end
  from unnest(coalesce(target_conversation_ids,array[]::uuid[])) as selected(selected_id)
  join public.conversations c on c.id=selected.selected_id
  where c.community_id=target_community_id and not public.conversation_requires_password(c.id)
  on conflict do nothing;
  update public.communities set updated_at=now() where id=target_community_id;
  perform public.write_app_audit('community.invitation.account_added','community',target_community_id,
   jsonb_build_object('email',clean_email,'groups',coalesce(array_length(target_conversation_ids,1),0),'include_history',include_message_history));
  return query select 'added'::text,null::uuid,clean_email,null::timestamptz;
  return;
 end if;

 delete from public.community_invitations i
 where i.community_id=target_community_id and i.email=clean_email and i.accepted_at is null;
 insert into public.community_invitations(community_id,email,created_by,include_message_history)
 values(target_community_id,clean_email,auth.uid(),include_message_history)
 returning id,token,expires_at into new_invitation_id,new_token,new_expiry;
 insert into public.community_invitation_groups(invitation_id,conversation_id)
 select new_invitation_id,selected.selected_id
 from unnest(coalesce(target_conversation_ids,array[]::uuid[])) as selected(selected_id)
 join public.conversations c on c.id=selected.selected_id
 where c.community_id=target_community_id and not public.conversation_requires_password(c.id)
 on conflict do nothing;
 perform public.write_app_audit('community.invitation.create','community',target_community_id,
  jsonb_build_object('email',clean_email,'groups',coalesce(array_length(target_conversation_ids,1),0),'include_history',include_message_history));
 return query select 'invited'::text,new_token,clean_email,new_expiry;
end
$$;

revoke all on function public.create_community_invitation(uuid,text,uuid[],boolean) from public;
grant execute on function public.create_community_invitation(uuid,text,uuid[],boolean) to authenticated;

create or replace function public.accept_community_invitation(invitation_token uuid)
returns table(community_name text,groups_added integer)
language plpgsql security definer
set search_path=public,auth
as $$
declare
 selected_invitation public.community_invitations%rowtype;
 current_email text:=lower(coalesce(auth.jwt()->>'email',''));
 added_groups integer:=0;
 selected_community_name text;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select * into selected_invitation from public.community_invitations i
 where i.token=invitation_token for update;
 if not found then raise exception 'Invitatia nu exista.'; end if;
 if selected_invitation.accepted_at is not null then raise exception 'Invitatia a fost deja folosita.'; end if;
 if selected_invitation.expires_at<=now() then raise exception 'Invitatia a expirat.'; end if;
 if current_email<>selected_invitation.email then raise exception 'Invitatia este destinata altei adrese de email.'; end if;

 insert into public.community_members(community_id,user_id,is_admin)
 values(selected_invitation.community_id,auth.uid(),false) on conflict do nothing;
 insert into public.conversation_members(conversation_id,user_id,is_admin,history_visible_from)
 select g.conversation_id,auth.uid(),false,
  case when selected_invitation.include_message_history then null else now() end
 from public.community_invitation_groups g
 join public.conversations c on c.id=g.conversation_id
 where g.invitation_id=selected_invitation.id
   and c.community_id=selected_invitation.community_id
   and not public.conversation_requires_password(c.id)
 on conflict do nothing;
 get diagnostics added_groups=row_count;
 update public.community_invitations set accepted_at=now(),accepted_by=auth.uid()
 where id=selected_invitation.id;
 update public.communities set updated_at=now() where id=selected_invitation.community_id;
 select c.name into selected_community_name from public.communities c where c.id=selected_invitation.community_id;
 perform public.write_app_audit('community.invitation.accept','community',selected_invitation.community_id,
  jsonb_build_object('groups_added',added_groups,'include_history',selected_invitation.include_message_history));
 return query select selected_community_name,added_groups;
end
$$;

revoke all on function public.accept_community_invitation(uuid) from public;
grant execute on function public.accept_community_invitation(uuid) to authenticated;

drop function if exists public.set_community_member_groups(uuid,uuid,uuid[]);
drop function if exists public.set_community_member_groups(uuid,uuid,uuid[],boolean);
create function public.set_community_member_groups(
 target_community_id uuid,
 target_user_id uuid,
 target_conversation_ids uuid[] default array[]::uuid[],
 include_message_history boolean default false
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
 if not exists(select 1 from public.community_members cm
  where cm.community_id=target_community_id and cm.user_id=target_user_id) then
  raise exception 'Persoana nu este membra a comunitatii.';
 end if;
 if exists(
  select 1 from unnest(selected_ids) as selected(selected_id)
  where not exists(
   select 1 from public.conversations c
   where c.id=selected_id and c.community_id=target_community_id
    and (not public.conversation_requires_password(c.id)
     or public.is_general_admin() or public.is_conversation_admin(c.id))
  )
 ) then raise exception 'Nu ai dreptul sa modifici accesul la unul dintre grupurile selectate.'; end if;

 delete from public.conversation_members m using public.conversations c
 where m.conversation_id=c.id and c.community_id=target_community_id
  and m.user_id=target_user_id and c.created_by<>target_user_id
  and coalesce(m.is_admin,false)=false
  and (not public.conversation_requires_password(c.id)
   or public.is_general_admin() or public.is_conversation_admin(c.id))
  and not (c.id=any(selected_ids));

 insert into public.conversation_members(conversation_id,user_id,is_admin,history_visible_from)
 select c.id,target_user_id,false,
  case when include_message_history then null else now() end
 from public.conversations c
 where c.community_id=target_community_id and c.id=any(selected_ids)
  and (not public.conversation_requires_password(c.id)
   or public.is_general_admin() or public.is_conversation_admin(c.id))
 on conflict do nothing;

 perform public.write_app_audit('community.member.groups.update','community',target_community_id,
  jsonb_build_object('user_id',target_user_id,'groups',coalesce(array_length(selected_ids,1),0),'include_history',include_message_history));
end
$$;

revoke all on function public.set_community_member_groups(uuid,uuid,uuid[],boolean) from public;
grant execute on function public.set_community_member_groups(uuid,uuid,uuid[],boolean) to authenticated;

notify pgrst,'reload schema';
