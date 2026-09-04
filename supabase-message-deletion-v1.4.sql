-- eClinic Chat v1.4: stergerea securizata a mesajelor si imaginilor.
-- Ruleaza integral, o singura data, dupa supabase-security-v1.2.sql.
-- Nu sterge automat niciun mesaj existent.

alter table public.private_messages
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.private_messages
drop constraint if exists private_messages_body_or_attachment_check;

alter table public.private_messages
add constraint private_messages_body_or_attachment_check
check (
 deleted_at is not null
 or (body is not null and char_length(trim(body)) between 1 and 4000)
 or attachment_path is not null
);

-- Imaginea poate fi eliminata numai cat timp apartine unui mesaj activ,
-- de catre autorul mesajului sau un administrator al grupului deblocat.
drop policy if exists "Members delete own chat images" on storage.objects;
drop policy if exists "Message authors and admins delete chat images" on storage.objects;
create policy "Message authors and admins delete chat images"
on storage.objects for delete to authenticated
using(
 bucket_id='chat-images'
 and public.has_conversation_access(((storage.foldername(name))[1])::uuid)
 and exists(
  select 1
  from public.private_messages m
  where m.attachment_path=storage.objects.name
    and m.deleted_at is null
    and (
     m.user_id=auth.uid()
     or public.is_conversation_admin(m.conversation_id)
    )
 )
);

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
 from public.private_messages
 where id=target_message_id;

 if target_conversation_id is null then raise exception 'Mesajul nu exista.'; end if;
 if target_deleted_at is not null then return; end if;
 if not public.has_conversation_access(target_conversation_id) then
  raise exception 'Grupul trebuie deblocat.';
 end if;
 if message_owner_id<>auth.uid()
    and not public.is_conversation_admin(target_conversation_id) then
  raise exception 'Poti sterge numai mesajele proprii.';
 end if;

 perform public.write_app_audit(
  'message.delete','message',target_message_id,
  jsonb_build_object(
   'conversation_id',target_conversation_id,
   'message_owner_id',message_owner_id,
   'deleted_by_admin',message_owner_id<>auth.uid(),
   'had_attachment',target_attachment_path is not null
  )
 );

 delete from public.message_reactions where message_id=target_message_id;

 update public.private_messages
 set body=null,
     attachment_path=null,
     attachment_name=null,
     attachment_type=null,
     attachment_size=null,
     reply_to_id=null,
     pinned_at=null,
     pinned_by=null,
     deleted_at=now(),
     deleted_by=auth.uid()
 where id=target_message_id and deleted_at is null;
end
$$;

revoke all on function public.delete_private_message(uuid) from public,anon,authenticated;
grant execute on function public.delete_private_message(uuid) to authenticated;
