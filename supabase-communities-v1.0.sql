-- eClinic Chat v1.0: administratori generali, comunitati si grupuri administrate.
-- Ruleaza integral o singura data in Supabase > SQL Editor > New query > Run.

create table if not exists public.app_admins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);

insert into public.app_admins(user_id,created_by)
select id,id from auth.users where lower(email)='cosmin@test.com'
on conflict(user_id) do nothing;

create table if not exists public.communities(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 1 and 80),
 description text not null default '' check(char_length(description)<=500),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.community_members(
 community_id uuid not null references public.communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 is_admin boolean not null default false,
 joined_at timestamptz not null default now(),
 primary key(community_id,user_id)
);

alter table public.conversations
add column if not exists community_id uuid references public.communities(id) on delete set null;

create index if not exists community_members_user_idx
on public.community_members(user_id,community_id);
create index if not exists conversations_community_idx
on public.conversations(community_id,updated_at desc);

create table if not exists public.app_audit_log(
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,
 entity_type text not null,
 entity_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.app_audit_log enable row level security;

revoke all on public.app_admins from public,anon,authenticated;
revoke all on public.app_audit_log from public,anon,authenticated;

create or replace function public.is_general_admin()
returns boolean
language sql stable security definer
set search_path=public
as $$
 select auth.uid() is not null and exists(
  select 1 from public.app_admins where user_id=auth.uid()
 )
$$;

create or replace function public.is_community_member(check_community_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
 select auth.uid() is not null and exists(
  select 1 from public.community_members
  where community_id=check_community_id and user_id=auth.uid()
 )
$$;

create or replace function public.is_community_admin(check_community_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
 select auth.uid() is not null and (
  public.is_general_admin() or exists(
   select 1 from public.community_members
   where community_id=check_community_id and user_id=auth.uid() and is_admin=true
  )
 )
$$;

revoke all on function public.is_general_admin() from public;
revoke all on function public.is_community_member(uuid) from public;
revoke all on function public.is_community_admin(uuid) from public;
grant execute on function public.is_general_admin() to authenticated;
grant execute on function public.is_community_member(uuid) to authenticated;
grant execute on function public.is_community_admin(uuid) to authenticated;

drop policy if exists "Members read communities" on public.communities;
create policy "Members read communities" on public.communities
for select to authenticated using(
 public.is_general_admin() or public.is_community_member(id)
);

drop policy if exists "Members read community memberships" on public.community_members;
create policy "Members read community memberships" on public.community_members
for select to authenticated using(
 public.is_general_admin() or public.is_community_member(community_id)
);

create or replace function public.write_app_audit(
 audit_action text,audit_entity_type text,audit_entity_id uuid,audit_details jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 insert into public.app_audit_log(actor_id,action,entity_type,entity_id,details)
 values(auth.uid(),audit_action,audit_entity_type,audit_entity_id,coalesce(audit_details,'{}'::jsonb));
end
$$;

revoke all on function public.write_app_audit(text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.get_app_context()
returns table(is_general_admin boolean)
language sql stable security definer
set search_path=public
as $$ select public.is_general_admin() $$;

revoke all on function public.get_app_context() from public;
grant execute on function public.get_app_context() to authenticated;

create or replace function public.get_my_communities()
returns table(
 id uuid,name text,description text,created_by uuid,created_at timestamptz,updated_at timestamptz,
 member_count integer,group_count integer,my_is_admin boolean
)
language sql stable security definer
set search_path=public
as $$
 select c.id,c.name,c.description,c.created_by,c.created_at,c.updated_at,
  (select count(*)::integer from public.community_members cm where cm.community_id=c.id),
  (select count(*)::integer from public.conversations cv where cv.community_id=c.id),
  (public.is_general_admin() or exists(
   select 1 from public.community_members mine
   where mine.community_id=c.id and mine.user_id=auth.uid() and mine.is_admin=true
  ))
 from public.communities c
 where public.is_general_admin() or public.is_community_member(c.id)
 order by lower(c.name)
$$;

revoke all on function public.get_my_communities() from public;
grant execute on function public.get_my_communities() to authenticated;

create or replace function public.create_community(community_name text,community_description text default '')
returns uuid
language plpgsql security definer
set search_path=public
as $$
declare new_id uuid;
begin
 if not public.is_general_admin() then
  raise exception 'Numai administratorii generali pot crea comunitati.';
 end if;
 if nullif(trim(community_name),'') is null or char_length(trim(community_name))>80 then
  raise exception 'Numele comunitatii nu este valid.';
 end if;
 insert into public.communities(name,description,created_by)
 values(trim(community_name),left(coalesce(trim(community_description),''),500),auth.uid())
 returning id into new_id;
 insert into public.community_members(community_id,user_id,is_admin)
 values(new_id,auth.uid(),true);
 perform public.write_app_audit('community.create','community',new_id,jsonb_build_object('name',trim(community_name)));
 return new_id;
end
$$;

revoke all on function public.create_community(text,text) from public;
grant execute on function public.create_community(text,text) to authenticated;

create or replace function public.update_community(target_community_id uuid,new_name text,new_description text)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if not public.is_community_admin(target_community_id) then
  raise exception 'Numai administratorii comunitatii pot modifica aceasta comunitate.';
 end if;
 if nullif(trim(new_name),'') is null or char_length(trim(new_name))>80 then
  raise exception 'Numele comunitatii nu este valid.';
 end if;
 update public.communities set name=trim(new_name),description=left(coalesce(trim(new_description),''),500),updated_at=now()
 where id=target_community_id;
 if not found then raise exception 'Comunitatea nu exista.'; end if;
 perform public.write_app_audit('community.update','community',target_community_id,jsonb_build_object('name',trim(new_name)));
end
$$;

revoke all on function public.update_community(uuid,text,text) from public;
grant execute on function public.update_community(uuid,text,text) to authenticated;

create or replace function public.get_community_members(target_community_id uuid)
returns table(user_id uuid,email text,joined_at timestamptz,is_admin boolean,is_creator boolean)
language plpgsql stable security definer
set search_path=public,auth
as $$
begin
 if not public.is_community_admin(target_community_id) then
  raise exception 'Nu ai dreptul sa administrezi aceasta comunitate.';
 end if;
 return query
 select cm.user_id,u.email::text,cm.joined_at,cm.is_admin,(c.created_by=cm.user_id)
 from public.community_members cm
 join public.communities c on c.id=cm.community_id
 join auth.users u on u.id=cm.user_id
 where cm.community_id=target_community_id
 order by cm.is_admin desc,lower(u.email);
end
$$;

revoke all on function public.get_community_members(uuid) from public;
grant execute on function public.get_community_members(uuid) to authenticated;

create or replace function public.add_community_members(target_community_id uuid,member_emails text[])
returns integer
language plpgsql security definer
set search_path=public,auth
as $$
declare requested_count integer;found_count integer;inserted_count integer;
begin
 if not public.is_community_admin(target_community_id) then
  raise exception 'Numai administratorii comunitatii pot adauga membri.';
 end if;
 select count(distinct lower(trim(email))) into requested_count
 from unnest(coalesce(member_emails,array[]::text[])) email where trim(email)<>'';
 if requested_count=0 then raise exception 'Introdu cel putin o adresa de email.'; end if;
 select count(*) into found_count from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
 );
 if found_count<>requested_count then raise exception 'Unul sau mai multe emailuri nu au inca un cont.'; end if;
 insert into public.community_members(community_id,user_id,is_admin)
 select target_community_id,u.id,false from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
 ) on conflict do nothing;
 get diagnostics inserted_count=row_count;
 update public.communities set updated_at=now() where id=target_community_id;
 perform public.write_app_audit('community.members.add','community',target_community_id,jsonb_build_object('count',inserted_count));
 return inserted_count;
end
$$;

revoke all on function public.add_community_members(uuid,text[]) from public;
grant execute on function public.add_community_members(uuid,text[]) to authenticated;

create or replace function public.set_community_admin(target_community_id uuid,target_user_id uuid,make_admin boolean)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if not public.is_general_admin() then
  raise exception 'Numai administratorii generali pot desemna administratorii comunitatii.';
 end if;
 update public.community_members set is_admin=make_admin
 where community_id=target_community_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membra a comunitatii.'; end if;
 perform public.write_app_audit('community.admin.change','community',target_community_id,
  jsonb_build_object('user_id',target_user_id,'is_admin',make_admin));
end
$$;

revoke all on function public.set_community_admin(uuid,uuid,boolean) from public;
grant execute on function public.set_community_admin(uuid,uuid,boolean) to authenticated;

create or replace function public.remove_community_member(target_community_id uuid,target_user_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if not public.is_community_admin(target_community_id) then
  raise exception 'Numai administratorii comunitatii pot elimina membri.';
 end if;
 if exists(select 1 from public.community_members where community_id=target_community_id and user_id=target_user_id and is_admin=true)
    and not public.is_general_admin() then
  raise exception 'Numai un administrator general poate elimina un administrator al comunitatii.';
 end if;
 if exists(select 1 from public.conversations where community_id=target_community_id and created_by=target_user_id) then
  raise exception 'Persoana este proprietara unui grup din comunitate si nu poate fi eliminata.';
 end if;
 delete from public.conversation_members cm using public.conversations c
 where cm.conversation_id=c.id and c.community_id=target_community_id and cm.user_id=target_user_id;
 delete from public.community_members where community_id=target_community_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membra a comunitatii.'; end if;
 perform public.write_app_audit('community.member.remove','community',target_community_id,jsonb_build_object('user_id',target_user_id));
end
$$;

revoke all on function public.remove_community_member(uuid,uuid) from public;
grant execute on function public.remove_community_member(uuid,uuid) to authenticated;

create or replace function public.delete_community(target_community_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if not public.is_general_admin() then
  raise exception 'Numai administratorii generali pot sterge comunitati.';
 end if;
 if exists(select 1 from public.conversations where community_id=target_community_id) then
  raise exception 'Comunitatea contine grupuri. Sterge sau muta mai intai grupurile.';
 end if;
 delete from public.communities where id=target_community_id;
 if not found then raise exception 'Comunitatea nu exista.'; end if;
 perform public.write_app_audit('community.delete','community',target_community_id);
end
$$;

revoke all on function public.delete_community(uuid) from public;
grant execute on function public.delete_community(uuid) to authenticated;

-- Vechea functie permitea oricarui utilizator sa creeze grupuri.
revoke execute on function public.create_private_conversation(text,text[]) from authenticated;

create or replace function public.create_managed_conversation(
 conversation_title text,member_emails text[] default array[]::text[],
 target_community_id uuid default null,initial_password text default null
)
returns uuid
language plpgsql security definer
set search_path=public,auth,extensions
as $$
declare new_id uuid;requested_count integer;found_count integer;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if target_community_id is null then
  if not public.is_general_admin() then raise exception 'Numai administratorii generali pot crea grupuri independente.'; end if;
 else
  if not public.is_community_admin(target_community_id) then
   raise exception 'Numai administratorii comunitatii pot crea grupuri aici.';
  end if;
  insert into public.community_members(community_id,user_id,is_admin)
  values(target_community_id,auth.uid(),true) on conflict do nothing;
 end if;
 if nullif(trim(conversation_title),'') is null or char_length(trim(conversation_title))>80 then
  raise exception 'Numele grupului nu este valid.';
 end if;
 if initial_password is not null and initial_password<>'' and (char_length(initial_password)<6 or char_length(initial_password)>64) then
  raise exception 'Parola trebuie sa aiba intre 6 si 64 de caractere.';
 end if;
 select count(distinct lower(trim(email))) into requested_count
 from unnest(coalesce(member_emails,array[]::text[])) email
 where trim(email)<>'' and lower(trim(email))<>lower(coalesce(auth.jwt()->>'email',''));
 select count(*) into found_count from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email
  where trim(email)<>'' and lower(trim(email))<>lower(coalesce(auth.jwt()->>'email',''))
 );
 if found_count<>requested_count then raise exception 'Unul sau mai multe emailuri nu au inca un cont.'; end if;
 if target_community_id is not null and exists(
  select 1 from auth.users u
  where lower(u.email) in(
   select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email where trim(email)<>''
  ) and not exists(
   select 1 from public.community_members cm where cm.community_id=target_community_id and cm.user_id=u.id
  )
 ) then raise exception 'Toti membrii grupului trebuie sa faca parte din comunitate.'; end if;
 insert into public.conversations(title,created_by,community_id)
 values(trim(conversation_title),auth.uid(),target_community_id) returning id into new_id;
 insert into public.conversation_members(conversation_id,user_id,is_admin)
 values(new_id,auth.uid(),true);
 insert into public.conversation_members(conversation_id,user_id,is_admin)
 select new_id,u.id,false from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(coalesce(member_emails,array[]::text[])) email where trim(email)<>''
 ) on conflict do nothing;
 if coalesce(initial_password,'')<>'' then
  insert into public.conversation_passwords(conversation_id,password_hash,updated_by)
  values(new_id,crypt(initial_password,gen_salt('bf',10)),auth.uid());
 end if;
 perform public.write_app_audit('group.create','conversation',new_id,
  jsonb_build_object('title',trim(conversation_title),'community_id',target_community_id));
 return new_id;
end
$$;

revoke all on function public.create_managed_conversation(text,text[],uuid,text) from public;
grant execute on function public.create_managed_conversation(text,text[],uuid,text) to authenticated;

create or replace function public.rename_private_conversation(target_conversation_id uuid,new_title text)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii grupului pot redenumi grupul.';
 end if;
 if nullif(trim(new_title),'') is null or char_length(trim(new_title))>80 then
  raise exception 'Numele grupului nu este valid.';
 end if;
 update public.conversations set title=trim(new_title),updated_at=now() where id=target_conversation_id;
 if not found then raise exception 'Grupul nu exista.'; end if;
 perform public.write_app_audit('group.rename','conversation',target_conversation_id,jsonb_build_object('title',trim(new_title)));
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
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select created_by into owner_id from public.conversations where id=target_conversation_id;
 if owner_id is distinct from auth.uid() then raise exception 'Numai proprietarul poate modifica administratorii.'; end if;
 if target_user_id=owner_id then raise exception 'Proprietarul ramane intotdeauna administrator.'; end if;
 update public.conversation_members set is_admin=make_admin
 where conversation_id=target_conversation_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membra a grupului.'; end if;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.admin.change','conversation',target_conversation_id,
  jsonb_build_object('user_id',target_user_id,'is_admin',make_admin));
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
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii grupului pot adauga membri.';
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
   select 1 from public.community_members cm where cm.community_id=target_community_id and cm.user_id=u.id
  )
 ) then raise exception 'Membrul trebuie adaugat mai intai in comunitate.'; end if;
 insert into public.conversation_members(conversation_id,user_id,is_admin)
 select target_conversation_id,u.id,false from auth.users u where lower(u.email) in(
  select distinct lower(trim(email)) from unnest(member_emails) email where trim(email)<>''
 ) on conflict do nothing;
 get diagnostics inserted_count=row_count;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.members.add','conversation',target_conversation_id,jsonb_build_object('count',inserted_count));
 return inserted_count;
end
$$;

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
 perform public.write_app_audit('group.password.change','conversation',target_conversation_id);
end
$$;

create or replace function public.remove_conversation_member(target_conversation_id uuid,target_user_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
declare owner_id uuid;target_is_admin boolean;
begin
 if auth.uid() is null or not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Numai administratorii grupului pot elimina membri.';
 end if;
 select created_by into owner_id from public.conversations where id=target_conversation_id;
 if target_user_id=owner_id then raise exception 'Proprietarul nu poate fi eliminat.'; end if;
 select is_admin into target_is_admin from public.conversation_members
 where conversation_id=target_conversation_id and user_id=target_user_id;
 if coalesce(target_is_admin,false) and auth.uid()<>owner_id then
  raise exception 'Numai proprietarul poate elimina un administrator.';
 end if;
 delete from public.conversation_members where conversation_id=target_conversation_id and user_id=target_user_id;
 if not found then raise exception 'Persoana nu este membra a grupului.'; end if;
 update public.conversations set updated_at=now() where id=target_conversation_id;
 perform public.write_app_audit('group.member.remove','conversation',target_conversation_id,jsonb_build_object('user_id',target_user_id));
end
$$;

create or replace function public.delete_private_conversation(target_conversation_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if not exists(
  select 1 from public.conversations where id=target_conversation_id and created_by=auth.uid()
 ) then raise exception 'Numai proprietarul poate sterge grupul.'; end if;
 perform public.write_app_audit('group.delete','conversation',target_conversation_id);
 delete from public.conversations where id=target_conversation_id and created_by=auth.uid();
end
$$;

-- Reface lista conversatiilor cu apartenenta la comunitate.
-- View-ul vechi trebuie eliminat deoarece PostgreSQL nu permite inserarea
-- coloanelor noi intre coloanele deja existente prin CREATE OR REPLACE VIEW.
drop view if exists public.my_conversations;

create or replace view public.my_conversations
with(security_invoker=true)
as
 select c.id,c.title,c.created_by,c.created_at,c.updated_at,c.community_id,co.name as community_name,
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

-- Reactiile extinse din interfata v0.9.1/v1.0.
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
 select conversation_id into target_conversation_id from public.private_messages where id=target_message_id;
 if target_conversation_id is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la acest mesaj.';
 end if;
 select emoji into current_emoji from public.message_reactions
 where message_id=target_message_id and user_id=auth.uid();
 if current_emoji=reaction_emoji then
  delete from public.message_reactions where message_id=target_message_id and user_id=auth.uid();
 else
  insert into public.message_reactions(message_id,conversation_id,user_id,emoji,created_at)
  values(target_message_id,target_conversation_id,auth.uid(),reaction_emoji,now())
  on conflict(message_id,user_id) do update set emoji=excluded.emoji,created_at=excluded.created_at;
 end if;
end
$$;

revoke all on function public.add_conversation_members(uuid,text[]) from public;
revoke all on function public.rename_private_conversation(uuid,text) from public;
revoke all on function public.set_conversation_admin(uuid,uuid,boolean) from public;
revoke all on function public.set_conversation_password(uuid,text) from public;
revoke all on function public.remove_conversation_member(uuid,uuid) from public;
revoke all on function public.delete_private_conversation(uuid) from public;
revoke all on function public.set_message_reaction(uuid,text) from public;
grant execute on function public.add_conversation_members(uuid,text[]) to authenticated;
grant execute on function public.rename_private_conversation(uuid,text) to authenticated;
grant execute on function public.set_conversation_admin(uuid,uuid,boolean) to authenticated;
grant execute on function public.set_conversation_password(uuid,text) to authenticated;
grant execute on function public.remove_conversation_member(uuid,uuid) to authenticated;
grant execute on function public.delete_private_conversation(uuid) to authenticated;
grant execute on function public.set_message_reaction(uuid,text) to authenticated;
