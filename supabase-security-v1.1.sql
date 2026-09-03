-- eClinic Chat v1.1: protectie server-side pentru grupurile cu parola.
-- Ruleaza integral, o singura data, in Supabase > SQL Editor > New query > Run.
-- Scriptul nu sterge conversatii, mesaje sau imagini.

create table if not exists public.conversation_unlocks(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 unlocked_until timestamptz not null,
 created_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

create index if not exists conversation_unlocks_expiry_idx
on public.conversation_unlocks(unlocked_until);

alter table public.conversation_unlocks enable row level security;
revoke all on public.conversation_unlocks from public,anon,authenticated;

create or replace function public.has_conversation_access(check_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
 select
  public.is_conversation_member(check_conversation_id)
  and (
   not exists(
    select 1 from public.conversation_passwords p
    where p.conversation_id=check_conversation_id
   )
   or exists(
    select 1 from public.conversation_unlocks u
    where u.conversation_id=check_conversation_id
      and u.user_id=auth.uid()
      and u.unlocked_until>now()
   )
  )
$$;

revoke all on function public.has_conversation_access(uuid) from public;
grant execute on function public.has_conversation_access(uuid) to authenticated;

create or replace function public.verify_conversation_password(
 target_conversation_id uuid,supplied_password text
)
returns boolean
language plpgsql security definer
set search_path=public,extensions
as $$
declare stored_hash text;failures integer:=0;blocked timestamptz;
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
 end if;

 select failed_count,blocked_until into failures,blocked
 from public.conversation_password_attempts
 where conversation_id=target_conversation_id and user_id=auth.uid();

 if blocked is not null and blocked>now() then
  raise exception 'Prea multe incercari. Incearca din nou peste cateva minute.';
 end if;
 if blocked is not null and blocked<=now() then failures:=0; end if;

 select password_hash into stored_hash
 from public.conversation_passwords
 where conversation_id=target_conversation_id;

 if stored_hash is null then
  delete from public.conversation_password_attempts
  where conversation_id=target_conversation_id and user_id=auth.uid();
  return true;
 end if;

 if crypt(coalesce(supplied_password,''),stored_hash)=stored_hash then
  delete from public.conversation_password_attempts
  where conversation_id=target_conversation_id and user_id=auth.uid();
  insert into public.conversation_unlocks(conversation_id,user_id,unlocked_until,created_at)
  values(target_conversation_id,auth.uid(),now()+interval '15 minutes',now())
  on conflict(conversation_id,user_id) do update
  set unlocked_until=excluded.unlocked_until,created_at=excluded.created_at;
  return true;
 end if;

 failures:=coalesce(failures,0)+1;
 insert into public.conversation_password_attempts(conversation_id,user_id,failed_count,blocked_until)
 values(target_conversation_id,auth.uid(),failures,
  case when failures>=5 then now()+interval '5 minutes' else null end)
 on conflict(conversation_id,user_id) do update set
  failed_count=excluded.failed_count,blocked_until=excluded.blocked_until;
 return false;
end
$$;

revoke all on function public.verify_conversation_password(uuid,text) from public;
grant execute on function public.verify_conversation_password(uuid,text) to authenticated;

create or replace function public.lock_conversation(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 delete from public.conversation_unlocks
 where conversation_id=target_conversation_id and user_id=auth.uid();
end
$$;

revoke all on function public.lock_conversation(uuid) from public;
grant execute on function public.lock_conversation(uuid) to authenticated;

-- Orice schimbare a parolei inchide imediat accesul temporar al tuturor membrilor.
create or replace function public.set_conversation_password(target_conversation_id uuid,new_password text)
returns void
language plpgsql security definer
set search_path=public,extensions
as $$
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii grupului pot modifica parola.';
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

revoke all on function public.set_conversation_password(uuid,text) from public;
grant execute on function public.set_conversation_password(uuid,text) to authenticated;

-- Mesajele nu pot fi citite sau trimise inainte de deblocarea grupului.
drop policy if exists "Members read messages" on public.private_messages;
create policy "Members read messages" on public.private_messages
for select to authenticated
using(public.has_conversation_access(conversation_id));

drop policy if exists "Members send messages" on public.private_messages;
create policy "Members send messages" on public.private_messages
for insert to authenticated
with check(auth.uid()=user_id and public.has_conversation_access(conversation_id));

drop policy if exists "Members read reactions" on public.message_reactions;
create policy "Members read reactions" on public.message_reactions
for select to authenticated
using(public.has_conversation_access(conversation_id));

-- Imaginile raman private si necesita aceeasi deblocare ca mesajele.
drop policy if exists "Members view chat images" on storage.objects;
create policy "Members view chat images" on storage.objects
for select to authenticated
using(
 bucket_id='chat-images'
 and public.has_conversation_access(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Members upload chat images" on storage.objects;
create policy "Members upload chat images" on storage.objects
for insert to authenticated
with check(
 bucket_id='chat-images'
 and owner_id=auth.uid()::text
 and public.has_conversation_access(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Owners delete chat images" on storage.objects;
drop policy if exists "Conversation owners delete chat images" on storage.objects;
create policy "Members delete own chat images" on storage.objects
for delete to authenticated
using(
 bucket_id='chat-images'
 and owner_id=auth.uid()::text
 and public.has_conversation_access(((storage.foldername(name))[1])::uuid)
);

-- Operatiile asupra continutului verifica si ele deblocarea server-side.
create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.has_conversation_access(target_conversation_id) then
  raise exception 'Grupul trebuie deblocat.';
 end if;
 insert into public.conversation_read_states(conversation_id,user_id,last_read_at)
 values(target_conversation_id,auth.uid(),now())
 on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at;
end
$$;

create or replace function public.set_message_reaction(target_message_id uuid,reaction_emoji text)
returns void
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;current_emoji text;
begin
 if reaction_emoji not in ('👍','❤️','😂','🤣','😮','😢','👏','🙏','🔥','✅','👀','💯') then
  raise exception 'Reactia nu este acceptata.';
 end if;
 select conversation_id into target_conversation_id
 from public.private_messages where id=target_message_id;
 if target_conversation_id is null or not public.has_conversation_access(target_conversation_id) then
  raise exception 'Grupul trebuie deblocat.';
 end if;
 select emoji into current_emoji from public.message_reactions
 where message_id=target_message_id and user_id=auth.uid();
 if current_emoji=reaction_emoji then
  delete from public.message_reactions
  where message_id=target_message_id and user_id=auth.uid();
 else
  insert into public.message_reactions(message_id,conversation_id,user_id,emoji,created_at)
  values(target_message_id,target_conversation_id,auth.uid(),reaction_emoji,now())
  on conflict(message_id,user_id) do update
  set emoji=excluded.emoji,created_at=excluded.created_at;
 end if;
end
$$;

create or replace function public.toggle_message_pin(target_message_id uuid)
returns boolean
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;currently_pinned timestamptz;
begin
 select conversation_id,pinned_at into target_conversation_id,currently_pinned
 from public.private_messages where id=target_message_id;
 if target_conversation_id is null
    or not public.has_conversation_access(target_conversation_id)
    or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii unui grup deblocat pot fixa mesaje.';
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

revoke all on function public.mark_conversation_read(uuid) from public;
revoke all on function public.set_message_reaction(uuid,text) from public;
revoke all on function public.toggle_message_pin(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.set_message_reaction(uuid,text) to authenticated;
grant execute on function public.toggle_message_pin(uuid) to authenticated;

