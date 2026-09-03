-- eClinic Chat v1.2: identitatea expeditorului si administrarea grupurilor protejate.
-- Ruleaza integral, o singura data, dupa supabase-security-v1.1.sql.
-- Nu modifica si nu sterge mesajele existente.

create or replace function public.secure_private_message_sender()
returns trigger
language plpgsql security definer
set search_path=public
as $$
declare expected_prefix text;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;

 -- Identitatea este stabilita de server, nu de browser.
 new.user_id:=auth.uid();
 new.sender_email:=lower(coalesce(auth.jwt()->>'email',''));

 if new.attachment_path is not null then
  expected_prefix:=new.conversation_id::text||'/'||auth.uid()::text||'/';
  if left(new.attachment_path,char_length(expected_prefix))<>expected_prefix then
   raise exception 'Calea imaginii nu este valida.';
  end if;
  if new.attachment_size is null or new.attachment_size<1 or new.attachment_size>10485760 then
   raise exception 'Dimensiunea imaginii nu este valida.';
  end if;
  if new.attachment_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then
   raise exception 'Tipul imaginii nu este acceptat.';
  end if;
 end if;

 return new;
end
$$;

drop trigger if exists private_message_secure_sender on public.private_messages;
create trigger private_message_secure_sender
before insert on public.private_messages
for each row execute function public.secure_private_message_sender();

revoke all on function public.secure_private_message_sender() from public,anon,authenticated;

create or replace function public.get_conversation_members(target_conversation_id uuid)
returns table(user_id uuid,email text,joined_at timestamptz,is_admin boolean,is_owner boolean)
language plpgsql stable security definer
set search_path=public,auth
as $$
begin
 if auth.uid() is null or not public.has_conversation_access(target_conversation_id) then
  raise exception 'Grupul trebuie deblocat.';
 end if;
 return query
 select m.user_id,u.email::text,m.joined_at,m.is_admin,(c.created_by=m.user_id)
 from public.conversation_members m
 join public.conversations c on c.id=m.conversation_id
 join auth.users u on u.id=m.user_id
 where m.conversation_id=target_conversation_id
 order by (c.created_by=m.user_id) desc,m.is_admin desc,lower(u.email);
end
$$;

create or replace function public.rename_private_conversation(target_conversation_id uuid,new_title text)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null
    or not public.has_conversation_access(target_conversation_id)
    or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii unui grup deblocat il pot redenumi.';
 end if;
 if nullif(trim(new_title),'') is null or char_length(trim(new_title))>80 then
  raise exception 'Numele grupului nu este valid.';
 end if;
 update public.conversations set title=trim(new_title),updated_at=now()
 where id=target_conversation_id;
 if not found then raise exception 'Grupul nu exista.'; end if;
 perform public.write_app_audit('group.rename','conversation',target_conversation_id,
  jsonb_build_object('title',trim(new_title)));
end
$$;

create or replace function public.add_conversation_members(
 target_conversation_id uuid,member_emails text[] default array[]::text[]
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
 insert into public.conversation_members(conversation_id,user_id,is_admin)
 select target_conversation_id,u.id,false from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
 ) on conflict do nothing;
 get diagnostics inserted_count=row_count;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.members.add','conversation',target_conversation_id,
  jsonb_build_object('count',inserted_count));
 return inserted_count;
end
$$;

create or replace function public.set_conversation_admin(
 target_conversation_id uuid,target_user_id uuid,make_admin boolean
)
returns void
language plpgsql security definer
set search_path=public
as $$
declare owner_id uuid;
begin
 if auth.uid() is null or not public.has_conversation_access(target_conversation_id) then
  raise exception 'Grupul trebuie deblocat.';
 end if;
 select created_by into owner_id from public.conversations where id=target_conversation_id;
 if owner_id is distinct from auth.uid() then
  raise exception 'Numai proprietarul poate modifica administratorii.';
 end if;
 if target_user_id=owner_id then raise exception 'Proprietarul ramane intotdeauna administrator.'; end if;
 update public.conversation_members set is_admin=make_admin
 where conversation_id=target_conversation_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membra a grupului.'; end if;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.admin.change','conversation',target_conversation_id,
  jsonb_build_object('user_id',target_user_id,'is_admin',make_admin));
end
$$;

create or replace function public.remove_conversation_member(
 target_conversation_id uuid,target_user_id uuid
)
returns void
language plpgsql security definer
set search_path=public
as $$
declare owner_id uuid;target_is_admin boolean;
begin
 if auth.uid() is null
    or not public.has_conversation_access(target_conversation_id)
    or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii unui grup deblocat pot elimina membri.';
 end if;
 select created_by into owner_id from public.conversations where id=target_conversation_id;
 if target_user_id=owner_id then raise exception 'Proprietarul nu poate fi eliminat.'; end if;
 select is_admin into target_is_admin from public.conversation_members
 where conversation_id=target_conversation_id and user_id=target_user_id;
 if coalesce(target_is_admin,false) and auth.uid()<>owner_id then
  raise exception 'Numai proprietarul poate elimina un administrator.';
 end if;
 delete from public.conversation_members
 where conversation_id=target_conversation_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membra a grupului.'; end if;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.member.remove','conversation',target_conversation_id,
  jsonb_build_object('user_id',target_user_id));
end
$$;

create or replace function public.set_conversation_password(
 target_conversation_id uuid,new_password text
)
returns void
language plpgsql security definer
set search_path=public,extensions
as $$
begin
 if auth.uid() is null
    or not public.has_conversation_access(target_conversation_id)
    or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii unui grup deblocat pot modifica parola.';
 end if;
 if nullif(new_password,'') is null then
  delete from public.conversation_passwords where conversation_id=target_conversation_id;
  delete from public.conversation_password_attempts where conversation_id=target_conversation_id;
  delete from public.conversation_unlocks where conversation_id=target_conversation_id;
  perform public.write_app_audit('group.password.remove','conversation',target_conversation_id);
  return;
 end if;
 if char_length(new_password)<6 or char_length(new_password)>64 then
  raise exception 'Parola trebuie sa aiba intre 6 si 64 de caractere.';
 end if;
 insert into public.conversation_passwords(conversation_id,password_hash,updated_by,updated_at)
 values(target_conversation_id,crypt(new_password,gen_salt('bf',10)),auth.uid(),now())
 on conflict(conversation_id) do update set password_hash=excluded.password_hash,
  updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 delete from public.conversation_password_attempts where conversation_id=target_conversation_id;
 delete from public.conversation_unlocks where conversation_id=target_conversation_id;
 perform public.write_app_audit('group.password.change','conversation',target_conversation_id);
end
$$;

create or replace function public.delete_private_conversation(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.has_conversation_access(target_conversation_id) then
  raise exception 'Grupul trebuie deblocat.';
 end if;
 if not exists(
  select 1 from public.conversations
  where id=target_conversation_id and created_by=auth.uid()
 ) then raise exception 'Numai proprietarul poate sterge grupul.'; end if;
 perform public.write_app_audit('group.delete','conversation',target_conversation_id);
 delete from public.conversations
 where id=target_conversation_id and created_by=auth.uid();
end
$$;

revoke all on function public.get_conversation_members(uuid) from public;
revoke all on function public.rename_private_conversation(uuid,text) from public;
revoke all on function public.add_conversation_members(uuid,text[]) from public;
revoke all on function public.set_conversation_admin(uuid,uuid,boolean) from public;
revoke all on function public.remove_conversation_member(uuid,uuid) from public;
revoke all on function public.set_conversation_password(uuid,text) from public;
revoke all on function public.delete_private_conversation(uuid) from public;
grant execute on function public.get_conversation_members(uuid) to authenticated;
grant execute on function public.rename_private_conversation(uuid,text) to authenticated;
grant execute on function public.add_conversation_members(uuid,text[]) to authenticated;
grant execute on function public.set_conversation_admin(uuid,uuid,boolean) to authenticated;
grant execute on function public.remove_conversation_member(uuid,uuid) to authenticated;
grant execute on function public.set_conversation_password(uuid,text) to authenticated;
grant execute on function public.delete_private_conversation(uuid) to authenticated;

