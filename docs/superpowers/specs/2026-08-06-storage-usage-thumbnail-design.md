# 스토리지 사용량 화면 - 용량 큰 파일 썸네일 미리보기 설계

## 배경 / 문제

[[2026-08-05-korean-filename-fix-storage-usage-design.md]]에서 업로드 경로를 `타임스탬프.확장자`로 바꾸면서 한글 파일명 업로드 오류는 해결됐지만, 그 결과 "스토리지 사용량" 관리자 화면의 "용량 큰 파일 Top 10" 목록이 `1700000000000.jpg` 같은 의미 없는 이름만 보여주게 됐다. 관리자가 파일명만으로는 어떤 사진인지 전혀 알 수 없다.

## 목표

Top 10 목록에서 각 파일이 어떤 사진인지 한눈에 알아볼 수 있게 한다.

## 범위 밖

- 원본 파일명 저장(업로드 시 metadata 추가) — 이미 업로드된 기존 파일에는 적용되지 않아 근본 해결이 아니므로 채택하지 않는다.
- 이미지 삭제/교체 기능 — 이번 요청과 무관.

## 변경 대상

`src/components/admin/sections/StorageUsage.jsx`

## 설계

`media` 버킷이 public이므로 파일명만으로 `supabase.storage.from('media').getPublicUrl(name)` 호출 시 네트워크 요청 없이 즉시 public URL을 계산할 수 있다. 별도 API 호출, 상태 추가, DB 변경이 필요 없다.

Top 10 목록의 각 `<li>` 항목 왼쪽에 작은 썸네일을 추가한다:

```jsx
<a href={supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl} target="_blank" rel="noreferrer">
  <img
    src={supabase.storage.from('media').getPublicUrl(f.name).data.publicUrl}
    alt={f.name}
    className="w-10 h-10 object-cover rounded"
  />
</a>
```

- 썸네일 클릭 시 원본 크기 이미지를 새 탭에서 연다(`target="_blank" rel="noreferrer"`).
- 이미지 로드 실패 시 별도 fallback UI는 만들지 않는다(YAGNI) — `alt` 속성만 지정해 브라우저 기본 동작에 맡긴다.
- 렌더링 시점에 동기 계산되는 값이라 로딩 상태나 에러 처리가 추가로 필요 없다.

## 테스트 계획

`src/components/__tests__/StorageUsage.test.jsx`에 케이스 추가:

- `getPublicUrl` mock을 설정하고, Top 10 목록의 각 항목에 렌더링된 `<img>`의 `src`와 감싸는 `<a>`의 `href`가 `getPublicUrl`이 반환한 URL과 일치하는지 검증한다.
