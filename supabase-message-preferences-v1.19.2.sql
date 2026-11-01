-- eClinTalk v1.19.2
-- Preferinte personale pentru mesaje: fixare si stergere doar pentru utilizatorul curent.

create table if not exists public.message_user_preferences(
 message_id uuid not null references public.private_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 pinned_at timestamptz,
 hidden_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(message_id,user_id)
);

create index if not exists message_user_preferences_user_idx
on public.message_user_preferences(user_id,updated_at desc);

alter table public.message_user_preferences enable row level security;
revoke all on table public.message_user_preferences from public,anon,authenticated;

create or replace function public.get_my_message_preferences(target_conversation_id uuid)
returns table(message_id uuid,pinned_at timestamptz,hidden_at timestamptz)
language plpgsql stable security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
 end if;
 return query
 select preference.message_id,preference.pinned_at,preference.hidden_at
 from public.message_user_preferences preference
 join public.private_messages message on message.id=preference.message_id
 where preference.user_id=auth.uid()
  and message.conversation_id=target_conversation_id;
end
$$;

create or replace function public.toggle_personal_message_pin(target_message_id uuid)
returns timestamptz
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;
declare result timestamptz;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select conversation_id into target_conversation_id
 from public.private_messages where id=target_message_id and deleted_at is null;
 if target_conversation_id is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Mesajul nu este disponibil.';
 end if;

 insert into public.message_user_preferences(message_id,user_id,pinned_at,updated_at)
 values(target_message_id,auth.uid(),now(),now())
 on conflict(message_id,user_id) do update
 set pinned_at=case when message_user_preferences.pinned_at is null then now() else null end,
     updated_at=now()
 returning pinned_at into result;
 return result;
end
$$;

create or replace function public.hide_message_for_me(target_message_id uuid)
returns timestamptz
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;
declare result timestamptz;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select conversation_id into target_conversation_id
 from public.private_messages where id=target_message_id and deleted_at is null;
 if target_conversation_id is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Mesajul nu este disponibil.';
 end if;

 insert into public.message_user_preferences(message_id,user_id,hidden_at,updated_at)
 values(target_message_id,auth.uid(),now(),now())
 on conflict(message_id,user_id) do update
 set hidden_at=now(),pinned_at=null,updated_at=now()
 returning hidden_at into result;
 return result;
end
$$;

revoke all on function public.get_my_message_preferences(uuid) from public;
revoke all on function public.toggle_personal_message_pin(uuid) from public;
revoke all on function public.hide_message_for_me(uuid) from public;
grant execute on function public.get_my_message_preferences(uuid) to authenticated;
grant execute on function public.toggle_personal_message_pin(uuid) to authenticated;
grant execute on function public.hide_message_for_me(uuid) to authenticated;

-- Orice membru al grupului poate fixa sau scoate un mesaj din fixatele tuturor.
create or replace function public.toggle_message_pin(target_message_id uuid)
returns boolean
language plpgsql security definer
set search_path=public
as $$
declare target_conversation_id uuid;
declare currently_pinned timestamptz;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 select conversation_id,pinned_at into target_conversation_id,currently_pinned
 from public.private_messages where id=target_message_id and deleted_at is null;
 if target_conversation_id is null or not public.has_conversation_access(target_conversation_id) then
  raise exception 'Nu ai acces la acest mesaj.';
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

revoke all on function public.toggle_message_pin(uuid) from public,anon,authenticated;
grant execute on function public.toggle_message_pin(uuid) to authenticated;

-- Stergerea pentru toti este permisa exclusiv autorului mesajului.
create or replace function public.delete_private_message(target_message_id uuid)
returns void
language plpgsql security definer
set search_path=public
as $$
declare
 target_conversation_id uuid;
 message_owner_id uuid;
 target_attachment_path text;
 target_deleted_at timestamptz;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;

 select conversation_id,user_id,attachment_path,deleted_at
 into target_conversation_id,message_owner_id,target_attachment_path,target_deleted_at
 from public.private_messages where id=target_message_id;

 if target_conversation_id is null then raise exception 'Mesajul nu exista.'; end if;
 if target_deleted_at is not null then return; end if;
 if not public.has_conversation_access(target_conversation_id) then raise exception 'Grupul trebuie deblocat.'; end if;
 if message_owner_id<>auth.uid() then raise exception 'Poti sterge pentru toti numai mesajele scrise de tine.'; end if;

 perform public.write_app_audit(
  'message.delete','message',target_message_id,
  jsonb_build_object('conversation_id',target_conversation_id,'message_owner_id',message_owner_id,'had_attachment',target_attachment_path is not null)
 );

 delete from public.message_reactions where message_id=target_message_id;
 update public.private_messages
 set body=null,attachment_path=null,attachment_name=null,attachment_type=null,
     attachment_size=null,reply_to_id=null,pinned_at=null,pinned_by=null,
     deleted_at=now(),deleted_by=auth.uid()
 where id=target_message_id and deleted_at is null;
end
$$;

revoke all on function public.delete_private_message(uuid) from public,anon,authenticated;
grant execute on function public.delete_private_message(uuid) to authenticated;

