-- eClinic Chat v0.7: imagini private in conversatii
alter table public.private_messages alter column body drop not null;
alter table public.private_messages
add column if not exists attachment_path text,
add column if not exists attachment_name text,
add column if not exists attachment_type text,
add column if not exists attachment_size bigint;
alter table public.private_messages drop constraint if exists private_messages_body_check;
alter table public.private_messages drop constraint if exists private_messages_body_or_attachment_check;
alter table public.private_messages add constraint private_messages_body_or_attachment_check
check ((body is not null and char_length(trim(body)) between 1 and 4000) or attachment_path is not null);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-images','chat-images',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif'];
drop policy if exists "Members view chat images" on storage.objects;
create policy "Members view chat images" on storage.objects for select to authenticated
using(bucket_id='chat-images' and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "Members upload chat images" on storage.objects;
create policy "Members upload chat images" on storage.objects for insert to authenticated
with check(bucket_id='chat-images' and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "Owners delete chat images" on storage.objects;
create policy "Owners delete chat images" on storage.objects for delete to authenticated
using(bucket_id='chat-images' and owner_id=auth.uid()::text and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
