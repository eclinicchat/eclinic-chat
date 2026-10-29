-- eClinTalk v1.12: invitatii prin link pentru comunitati si grupuri.
-- Ruleaza integral in Supabase > SQL Editor > New query > Run.

create table if not exists public.community_invitations(
 id uuid primary key default gen_random_uuid(),
 token uuid not null unique default gen_random_uuid(),
 community_id uuid not null references public.communities(id) on delete cascade,
 email text not null check(email=lower(trim(email)) and char_length(email) between 3 and 320),
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.community_invitation_groups(
 invitation_id uuid not null references public.community_invitations(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 primary key(invitation_id,conversation_id)
);

create index if not exists community_invitations_email_idx
on public.community_invitations(email,community_id,expires_at desc);

alter table public.community_invitations enable row level security;
alter table public.community_invitation_groups enable row level security;
revoke all on public.community_invitations from public,anon,authenticated;
revoke all on public.community_invitation_groups from public,anon,authenticated;

create or replace function public.get_invitation_preview(invitation_token uuid)
returns table(community_name text,invitee_email text,expires_at timestamptz,is_valid boolean)
language sql stable security definer
set search_path=public
as $$
 select c.name,i.email,i.expires_at,
  (i.accepted_at is null and i.expires_at>now())
 from public.community_invitations i
 join public.communities c on c.id=i.community_id
 where i.token=invitation_token
 limit 1
$$;

revoke all on function public.get_invitation_preview(uuid) from public;
grant execute on function public.get_invitation_preview(uuid) to anon,authenticated;

create or replace function public.create_community_invitation(
 target_community_id uuid,
 invitee_email text,
 target_conversation_ids uuid[] default array[]::uuid[]
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
  select 1 from unnest(coalesce(target_conversation_ids,array[]::uuid[])) selected_id
  where not exists(
   select 1 from public.conversations c
   where c.id=selected_id and c.community_id=target_community_id
  )
 ) then
  raise exception 'Unul dintre grupurile selectate nu apartine comunitatii.';
 end if;

 select u.id into target_user_id from auth.users u where lower(u.email)=clean_email limit 1;
 if target_user_id is not null then
  insert into public.community_members(community_id,user_id,is_admin)
  values(target_community_id,target_user_id,false)
  on conflict do nothing;
  insert into public.conversation_members(conversation_id,user_id,is_admin)
  select distinct selected_id,target_user_id,false
  from unnest(coalesce(target_conversation_ids,array[]::uuid[])) selected_id
  on conflict do nothing;
  update public.communities set updated_at=now() where id=target_community_id;
  perform public.write_app_audit('community.invitation.account_added','community',target_community_id,
   jsonb_build_object('email',clean_email,'groups',coalesce(array_length(target_conversation_ids,1),0)));
  return query select 'added'::text,null::uuid,clean_email,null::timestamptz;
  return;
 end if;

 delete from public.community_invitations i
 where i.community_id=target_community_id and i.email=clean_email and i.accepted_at is null;
 insert into public.community_invitations(community_id,email,created_by)
 values(target_community_id,clean_email,auth.uid())
 returning id,token,expires_at into new_invitation_id,new_token,new_expiry;
 insert into public.community_invitation_groups(invitation_id,conversation_id)
 select new_invitation_id,selected_id
 from unnest(coalesce(target_conversation_ids,array[]::uuid[])) selected_id
 on conflict do nothing;
 perform public.write_app_audit('community.invitation.create','community',target_community_id,
  jsonb_build_object('email',clean_email,'groups',coalesce(array_length(target_conversation_ids,1),0)));
 return query select 'invited'::text,new_token,clean_email,new_expiry;
end
$$;

revoke all on function public.create_community_invitation(uuid,text,uuid[]) from public;
grant execute on function public.create_community_invitation(uuid,text,uuid[]) to authenticated;

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
 select * into selected_invitation
 from public.community_invitations i
 where i.token=invitation_token
 for update;
 if not found then raise exception 'Invitatia nu exista.'; end if;
 if selected_invitation.accepted_at is not null then raise exception 'Invitatia a fost deja folosita.'; end if;
 if selected_invitation.expires_at<=now() then raise exception 'Invitatia a expirat.'; end if;
 if current_email<>selected_invitation.email then
  raise exception 'Invitatia este destinata altei adrese de email.';
 end if;

 insert into public.community_members(community_id,user_id,is_admin)
 values(selected_invitation.community_id,auth.uid(),false)
 on conflict do nothing;
 insert into public.conversation_members(conversation_id,user_id,is_admin)
 select g.conversation_id,auth.uid(),false
 from public.community_invitation_groups g
 join public.conversations c on c.id=g.conversation_id
 where g.invitation_id=selected_invitation.id
   and c.community_id=selected_invitation.community_id
 on conflict do nothing;
 get diagnostics added_groups=row_count;
 update public.community_invitations
 set accepted_at=now(),accepted_by=auth.uid()
 where id=selected_invitation.id;
 update public.communities set updated_at=now() where id=selected_invitation.community_id;
 select c.name into selected_community_name from public.communities c where c.id=selected_invitation.community_id;
 perform public.write_app_audit('community.invitation.accept','community',selected_invitation.community_id,
  jsonb_build_object('groups_added',added_groups));
 return query select selected_community_name,added_groups;
end
$$;

revoke all on function public.accept_community_invitation(uuid) from public;
grant execute on function public.accept_community_invitation(uuid) to authenticated;

