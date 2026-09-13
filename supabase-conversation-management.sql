-- eClinic Chat v0.8: administratori si parola suplimentara optionala pe grup.
-- Ruleaza integral in Supabase > SQL Editor > New query > Run.

alter table public.conversation_members
add column if not exists is_admin boolean not null default false;

update public.conversation_members m
set is_admin=true
from public.conversations c
where c.id=m.conversation_id and c.created_by=m.user_id;

create or replace function public.ensure_conversation_owner_admin()
returns trigger
language plpgsql security definer
set search_path=public
as $$
begin
 if exists(
  select 1 from public.conversations c
  where c.id=new.conversation_id and c.created_by=new.user_id
 ) then new.is_admin=true; end if;
 return new;
end
$$;

drop trigger if exists conversation_owner_is_admin on public.conversation_members;
create trigger conversation_owner_is_admin
before insert on public.conversation_members
for each row execute function public.ensure_conversation_owner_admin();

create or replace function public.is_conversation_admin(check_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
 select exists(
  select 1 from public.conversation_members
  where conversation_id=check_conversation_id
  and user_id=auth.uid() and is_admin=true
 )
$$;

revoke all on function public.is_conversation_admin(uuid) from public;
grant execute on function public.is_conversation_admin(uuid) to authenticated;

create table if not exists public.conversation_passwords(
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 password_hash text not null,
 updated_by uuid not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);

create table if not exists public.conversation_password_attempts(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 failed_count integer not null default 0,
 blocked_until timestamptz,
 primary key(conversation_id,user_id)
);

alter table public.conversation_passwords enable row level security;
alter table public.conversation_password_attempts enable row level security;
revoke all on public.conversation_passwords from public,anon,authenticated;
revoke all on public.conversation_password_attempts from public,anon,authenticated;

create or replace function public.get_conversation_members(target_conversation_id uuid)
returns table(user_id uuid,email text,joined_at timestamptz,is_admin boolean,is_owner boolean)
language plpgsql stable security definer
set search_path=public,auth
as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
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

revoke all on function public.get_conversation_members(uuid) from public;
grant execute on function public.get_conversation_members(uuid) to authenticated;

create or replace function public.rename_private_conversation(target_conversation_id uuid,new_title text)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if nullif(trim(new_title),'') is null or char_length(trim(new_title))>80 then
  raise exception 'Numele conversatiei nu este valid.';
 end if;
 if not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii pot redenumi conversatia.';
 end if;
 update public.conversations set title=trim(new_title),updated_at=now()
 where id=target_conversation_id;
end
$$;

revoke all on function public.rename_private_conversation(uuid,text) from public;
grant execute on function public.rename_private_conversation(uuid,text) to authenticated;

create or replace function public.add_conversation_members(
 target_conversation_id uuid,member_emails text[] default array[]::text[]
)
returns integer
language plpgsql security definer
set search_path=public,auth
as $$
declare requested_count integer;found_count integer;inserted_count integer;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii pot adauga membri.';
 end if;
 select count(distinct lower(trim(email))) into requested_count
 from unnest(coalesce(member_emails,array[]::text[])) email where trim(email)<>'';
 if requested_count=0 then raise exception 'Introdu cel putin o adresa de email.'; end if;
 select count(*) into found_count from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email
  where trim(email)<>'');
 if found_count<>requested_count then
  raise exception 'Unul sau mai multe emailuri nu au inca un cont.';
 end if;
 insert into public.conversation_members(conversation_id,user_id,is_admin)
 select target_conversation_id,u.id,false from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email
  where trim(email)<>'') on conflict do nothing;
 get diagnostics inserted_count=row_count;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 return inserted_count;
end
$$;

revoke all on function public.add_conversation_members(uuid,text[]) from public;
grant execute on function public.add_conversation_members(uuid,text[]) to authenticated;

create or replace function public.set_conversation_admin(
 target_conversation_id uuid,target_user_id uuid,make_admin boolean
)
returns void
language plpgsql security definer
set search_path=public
as $$
declare owner_id uuid;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select created_by into owner_id from public.conversations where id=target_conversation_id;
 if owner_id is distinct from auth.uid() then
  raise exception 'Numai proprietarul poate modifica administratorii.';
 end if;
 if target_user_id=owner_id then
  raise exception 'Proprietarul ramane intotdeauna administrator.';
 end if;
 update public.conversation_members set is_admin=make_admin
 where conversation_id=target_conversation_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membru al conversatiei.'; end if;
 update public.conversations set updated_at=now() where id=target_conversation_id;
end
$$;

revoke all on function public.set_conversation_admin(uuid,uuid,boolean) from public;
grant execute on function public.set_conversation_admin(uuid,uuid,boolean) to authenticated;

create or replace function public.remove_conversation_member(
 target_conversation_id uuid,target_user_id uuid
)
returns void
language plpgsql security definer
set search_path=public
as $$
declare owner_id uuid;target_is_admin boolean;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii pot elimina membri.';
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
 update public.conversations set updated_at=now() where id=target_conversation_id;
end
$$;

revoke all on function public.remove_conversation_member(uuid,uuid) from public;
grant execute on function public.remove_conversation_member(uuid,uuid) to authenticated;

create or replace function public.leave_private_conversation(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
declare owner_id uuid;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select created_by into owner_id from public.conversations where id=target_conversation_id;
 if owner_id=auth.uid() then
  raise exception 'Proprietarul trebuie sa stearga conversatia; nu o poate parasi.';
 end if;
 delete from public.conversation_members
 where conversation_id=target_conversation_id and user_id=auth.uid();
 if not found then raise exception 'Nu esti membru al acestei conversatii.'; end if;
 update public.conversations set updated_at=now() where id=target_conversation_id;
end
$$;

revoke all on function public.leave_private_conversation(uuid) from public;
grant execute on function public.leave_private_conversation(uuid) to authenticated;

create or replace function public.delete_private_conversation(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 delete from public.conversations where id=target_conversation_id and created_by=auth.uid();
 if not found then raise exception 'Numai proprietarul poate sterge conversatia.'; end if;
end
$$;

revoke all on function public.delete_private_conversation(uuid) from public;
grant execute on function public.delete_private_conversation(uuid) to authenticated;

create or replace function public.conversation_requires_password(target_conversation_id uuid)
returns boolean
language plpgsql stable security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
 end if;
 return exists(select 1 from public.conversation_passwords where conversation_id=target_conversation_id);
end
$$;

revoke all on function public.conversation_requires_password(uuid) from public;
grant execute on function public.conversation_requires_password(uuid) to authenticated;

create or replace function public.set_conversation_password(
 target_conversation_id uuid,new_password text
)
returns void
language plpgsql security definer
set search_path=public,extensions
as $$
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if not exists(select 1 from public.conversations
  where id=target_conversation_id and created_by=auth.uid()) then
  raise exception 'Numai proprietarul poate modifica parola grupului.';
 end if;
 if nullif(new_password,'') is null then
  delete from public.conversation_passwords where conversation_id=target_conversation_id;
  delete from public.conversation_password_attempts where conversation_id=target_conversation_id;
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
end
$$;

revoke all on function public.set_conversation_password(uuid,text) from public;
grant execute on function public.set_conversation_password(uuid,text) to authenticated;

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
 select password_hash into stored_hash from public.conversation_passwords
 where conversation_id=target_conversation_id;
 if stored_hash is null then return true; end if;
 if crypt(coalesce(supplied_password,''),stored_hash)=stored_hash then
  delete from public.conversation_password_attempts
  where conversation_id=target_conversation_id and user_id=auth.uid();
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

drop policy if exists "Conversation owners delete chat images" on storage.objects;
create policy "Conversation owners delete chat images"
on storage.objects for delete to authenticated
using(bucket_id='chat-images' and exists(
 select 1 from public.conversations c
 where c.id=((storage.foldername(name))[1])::uuid and c.created_by=auth.uid()
));
