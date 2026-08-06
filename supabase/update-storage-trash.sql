-- 스토리지 사용량 화면의 휴지통 기능(파일 이동/영구삭제)이 동작하도록
-- authenticated 역할에 한정해 UPDATE(이동)/DELETE(영구삭제) 권한을 부여.
create policy "media authenticated move" on storage.objects
  for update to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

create policy "media authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
