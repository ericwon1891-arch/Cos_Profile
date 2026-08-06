# 미사용 파일 일괄 정리 + 휴지통 비우기 버튼 설계

## 배경 / 문제

"전체 파일 보기"([[2026-08-06-storage-trash-design.md]])와 "미사용" 배지([[2026-08-06-media-usage-badge-design.md]])로 미사용 파일을 식별할 수는 있지만, 여러 개를 지우려면 체크박스를 일일이 눌러야 한다. 휴지통도 항목마다 "지금 영구 삭제"를 반복 클릭해야 전부 비울 수 있다.

## 목표

1. "전체 파일 보기"에서 미사용 파일 전체를 한 번의 클릭(+확인)으로 휴지통에 보낼 수 있다.
2. 휴지통에서 전체 파일을 한 번의 클릭(+확인)으로 영구 삭제할 수 있다.

## 범위 밖

- 체크박스 기반 다중 선택 삭제(이미 존재) 자체의 변경 — 새 버튼은 기존 흐름 위에 "전체 선택"에 해당하는 단축 동작을 추가하는 것뿐이다.
- 휴지통 다중 선택(체크박스) — "비우기"는 전부 지우는 단일 동작이므로 개별 선택 UI가 필요 없다.

## 컴포넌트 변경

**`StorageFileList.jsx`**: `usedPaths`에 없는 파일 이름 목록(`unusedNames`)을 렌더링 시점에 계산한다. `unusedNames.length > 0`이면 기존 "선택 삭제" 버튼 옆에 "미사용 파일 정리(N)" 버튼을 표시한다. 클릭 시 `confirm('미사용 파일 N개를 휴지통으로 이동할까요?')` → 확인되면 기존 `onDelete(unusedNames)`를 그대로 호출한다(새 prop 불필요, 기존 인터페이스 재사용).

**`StorageTrash.jsx`**: 새 prop `onEmptyTrash: () => Promise<void>`를 받는다. `files.length > 0`이면 목록 위에 "휴지통 비우기" 버튼을 표시한다. 클릭 시 `confirm('휴지통의 파일 N개를 전부 영구 삭제할까요? 되돌릴 수 없습니다.')` → 확인되면 `onEmptyTrash()`를 호출한다.

**`StorageUsage.jsx`(컨테이너)**: `handleEmptyTrash` 함수를 추가해 현재 휴지통 파일 전체 이름을 한 번의 `supabase.storage.from('media').remove(names)` 호출로 영구 삭제하고(만료 자동 청소와 동일한 배치 삭제 패턴), 실패 시 기존 `describeStorageActionError` 기반 알림을 재사용한다. `StorageTrash`에 `onEmptyTrash={handleEmptyTrash}`로 연결한다.

## 에러 처리

두 버튼 모두 기존 `moveFiles`/`describeStorageActionError` 패턴을 그대로 재사용한다 — 별도 에러 처리 로직을 새로 만들지 않는다.

## 테스트 계획

- `StorageFileList.jsx`: 미사용 파일이 없으면 버튼이 안 보이는지, 있으면 버튼 텍스트에 개수가 표시되는지, 클릭+확인 시 미사용 파일 이름 전체로 `onDelete`가 호출되는지, 취소 시 호출되지 않는지.
- `StorageTrash.jsx`: 파일이 없으면 버튼이 안 보이는지, 있으면 클릭+확인 시 `onEmptyTrash`가 호출되는지, 취소 시 호출되지 않는지.
- `StorageUsage.jsx`: "휴지통 비우기" 클릭 시 휴지통의 모든 파일 이름으로 `remove()`가 한 번 호출되는지.
