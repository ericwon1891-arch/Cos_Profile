-- 스토리지 사용량 관리자 화면(StorageUsage)이 media 버킷의 파일 목록을 조회할 수 있도록 허용.
-- update-security-hardening.sql에서 익명(anon) 목록 조회만 제거했으므로,
-- authenticated로 범위를 한정해 다시 추가해도 원래 보안 강화 취지에 어긋나지 않는다.
create policy "media authenticated list" on storage.objects
  for select to authenticated using (bucket_id = 'media');
