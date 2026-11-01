-- eClinTalk v1.19.0
-- Forward securizat, confirmari de citire si feedback.

-- Extinde bucket-ul privat existent pentru documentele acceptate de v1.18+.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
 'chat-images','chat-images',false,20971520,
 array[
  'image/jpeg','image/png','image/webp','image/heic','image/heif',
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
 ]
)
on conflict(id) do update
set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.private_messages
 add column if not exists forwarded_from_message_id uuid references public.private_messages(id) on delete set null,
 add column if not exists forwarded_from_sender text,
 add column if not exists forwarded_at timestamptz;

create index if not exists private_messages_forwarded_from_idx
on public.private_messages(forwarded_from_message_id)
where forwarded_from_message_id is not null;

create or replace function public.validate_forwarded_message()
returns trigger
language plpgsql security definer
set search_path=public
as $$
declare source_row public.private_messages%rowtype;
declare source_is_protected boolean;
declare target_is_protected boolean;
begin
 if new.forwarded_from_message_id is null then return new; end if;

 select * into source_row from public.private_messages
 where id=new.forwarded_from_message_id and deleted_at is null;
 if source_row.id is null then raise exception 'Mesajul original nu mai este disponibil.'; end if;
 if not public.is_conversation_member(source_row.conversation_id)
  or not public.is_conversation_member(new.conversation_id) then
  raise exception 'Nu ai acces la conversatia sursa sau destinatie.';
 end if;

 select protected_content into source_is_protected from public.conversations where id=source_row.conversation_id;
 select protected_content into target_is_protected from public.conversations where id=new.conversation_id;
 if coalesce(source_is_protected,false) and not coalesce(target_is_protected,false) then
  raise exception 'Continutul protejat poate fi redirectionat numai catre un grup protejat.';
 end if;

 new.forwarded_from_sender:=coalesce(source_row.sender_email,'eClinTalk');
 new.forwarded_at:=now();
 return new;
end
$$;

drop trigger if exists private_message_forward_guard on public.private_messages;
create trigger private_message_forward_guard
before insert on public.private_messages
for each row execute function public.validate_forwarded_message();

create or replace function public.get_conversation_read_markers(target_conversation_id uuid)
returns table(user_id uuid,email text,display_name text,last_read_at timestamptz)
language plpgsql stable security definer
set search_path=public,auth
as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then
  raise exception 'Nu ai acces la aceasta conversatie.';
 end if;
 return query
 select cm.user_id,u.email::text,p.display_name,rs.last_read_at
 from public.conversation_members cm
 join auth.users u on u.id=cm.user_id
 left join public.profiles p on p.user_id=cm.user_id
 left join public.conversation_read_states rs
  on rs.conversation_id=cm.conversation_id and rs.user_id=cm.user_id
 where cm.conversation_id=target_conversation_id
 order by lower(coalesce(nullif(p.display_name,''),u.email::text));
end
$$;

revoke all on function public.get_conversation_read_markers(uuid) from public;
grant execute on function public.get_conversation_read_markers(uuid) to authenticated;

create table if not exists public.app_feedback(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check(char_length(message) between 3 and 2000),
 page_context jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 status text not null default 'new' check(status in('new','reviewed','resolved'))
);

alter table public.app_feedback enable row level security;

drop policy if exists "Users read own feedback" on public.app_feedback;
create policy "Users read own feedback" on public.app_feedback
for select to authenticated using(user_id=auth.uid() or public.is_general_admin());

create or replace function public.submit_app_feedback(feedback_message text,feedback_context jsonb default '{}'::jsonb)
returns uuid
language plpgsql security definer
set search_path=public
as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Trebuie sa fii conectat.'; end if;
 if char_length(trim(coalesce(feedback_message,''))) not between 3 and 2000 then
  raise exception 'Mesajul trebuie sa contina intre 3 si 2000 de caractere.';
 end if;
 insert into public.app_feedback(user_id,message,page_context)
 values(auth.uid(),trim(feedback_message),coalesce(feedback_context,'{}'::jsonb))
 returning id into new_id;
 perform public.write_app_audit('feedback.create','feedback',new_id,'{}'::jsonb);
 return new_id;
end
$$;

revoke all on function public.submit_app_feedback(text,jsonb) from public;
grant execute on function public.submit_app_feedback(text,jsonb) to authenticated;

