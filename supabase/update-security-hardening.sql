-- Supabase Security Advisor 경고 대응
-- 기능에 영향 없이 불필요한 권한만 제거한다.

-- 1) storage.media 공개 버킷의 SELECT 정책 제거
-- public 버킷은 이 정책 없이도 getPublicUrl()로 생성한 URL로 개별 파일 접근이 가능하다.
-- 이 정책은 storage.objects 목록 조회(list)까지 열어주고 있었는데, 앱은 upload/getPublicUrl만 쓰고
-- list를 쓰지 않으므로 제거해도 기능에 영향이 없다.
drop policy "media public read" on storage.objects;

-- 2) 트리거 전용 함수의 불필요한 EXECUTE 권한 회수
-- fn_archive_site_content_history()는 site_content 트리거를 통해서만 호출되도록 설계된 함수인데,
-- 함수 생성 시 기본으로 부여되는 EXECUTE 권한 때문에 로그인 없이도 /rest/v1/rpc/...로 직접 호출 가능했다.
-- 트리거 실행은 EXECUTE 권한과 무관하게 동작하므로 회수해도 이력 자동 기록 기능에는 영향이 없다.
revoke execute on function fn_archive_site_content_history() from public, anon, authenticated;
