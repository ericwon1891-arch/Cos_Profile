# 업데이트 히스토리

> `portfolio-cosplay` (NANARY 코스플레이어 포트폴리오) 프로젝트의 작업 이력. git 커밋 로그를 기반으로 기능 단위로 정리했다.

---

## 2026-07-19 — 프로젝트 초기화 및 콘텐츠 인프라

기존 영상 편집자 포트폴리오(`portfolio`)를 포크하여 독립 저장소로 초기화하고, Supabase 기반 콘텐츠 관리 기반을 구축했다.

- `portfolio` 포크 → `portfolio-cosplay` 초기화, `react-router-dom` / `@supabase/supabase-js` 추가
- Supabase 클라이언트 초기화, `site_content` 테이블 + RLS 정책 + `media` Storage 버킷 스키마 작성
- 초기 시드 데이터 10개 섹션(hero/about/strength/career/characters/available/sns/services/personality/contact) 삽입
- `useSectionContent` 훅(섹션별 콘텐츠 조회) 추가, 네트워크 실패 대응 `.catch()` 보강
- `useAuth` 훅(로그인/로그아웃/세션) 추가
- `PhotoModal` 컴포넌트 추가 (사진 확대 보기)

## 2026-07-20 — 코스플레이어 콘텐츠로 전면 개편 + 관리자 CMS

영상 편집자용 정적 콘텐츠를 코스플레이어(NANARY)용 10개 섹션으로 전부 재작성하고, `/admin` 관리자 대시보드를 구축했다.

- `WorkCard`에 photo/video 타입별 아이콘 분기 추가
- `CharactersSection` 신규 추가 (`WorksSection`/`data/works.js` 제거)
- `HeroSection`, `AboutSection` 코스플레이어 콘텐츠로 재작성
- `StrengthSection`, `CareerSection`, `AvailableSection`, `SnsSection`, `ServicesSection`, `PersonalitySection`, `ContactSection` 신규 추가 (Footer 대체)
- `Navbar` 앵커를 코스플레이어 섹션 구조로 업데이트
- 관리자 폼 공용 필드 컴포넌트(Text/TextArea/List/Image) 추가
- `AdminLogin`, `RequireAuth` 라우트 가드, `AdminDashboard` + 섹션별 편집 폼 10개 추가
- `react-router-dom`으로 공개 페이지(`/`) / 관리자 페이지(`/admin`) 라우팅 통합
- 버그 수정: 로그인 후 대시보드 미이동, Vercel SPA rewrite(새로고침 404) 누락, 섹션 전환 시 이전 데이터 잔존, 관리자 세션이 브라우저 종료 후에도 유지되던 문제(→ `sessionStorage`로 전환)
- 실제 서비스 데이터 반영: 대표 캐릭터 카테고리 확정(게임/애니메이션/오리지널), 캐릭터 추가(그로자), SNS 실제 팔로워/링크, Contact 실제 이메일/SNS 링크
- Hero 배경 이미지 반응형 크롭 + 이미지 업로드 용량 초과 안내 메시지

## 2026-07-20 ~ 07-21 — 캐릭터 갤러리 고도화

캐릭터 카드 하나에 사진 여러 장, 그리고 사진+영상을 함께 담을 수 있도록 갤러리 기능을 확장했다.

**다중 사진 갤러리**
- `PhotoModal`에 다중 사진 좌우 탐색 추가, 캐릭터 전환 시 사진 인덱스 초기화 버그 수정
- `ListField`에 opt-in 드래그 순서 정렬(`reorderable`) 추가 (기존 미사용 화면은 그대로 유지)
- 캐릭터 관리자 폼에 갤러리 사진 목록(드래그 순서 정렬 포함) 추가
- 빈 문자열 슬롯이 대표 사진 폴백을 우회하던 버그 수정

**사진+영상 혼합 갤러리**
- `PhotoModal`이 사진+영상 슬라이드를 함께 순회하도록 확장, `VideoModal` 제거하고 `PhotoModal`로 통합
- `WorkCard` 재생 아이콘 표시 기준을 `type` 필드 대신 영상 유무로 변경
- 캐릭터 관리자 폼에서 타입 선택 UI 제거, 유튜브 시작시간/로컬 영상 필드 추가
- 유튜브 링크를 그대로 붙여넣어도 영상 ID만 자동 추출하도록 개선
- 저장 완료/실패 메시지를 화면 고정 위치 토스트로 표시

## 2026-07-21 ~ 07-22 — 대표 캐릭터 섹션 분리(사진/영상)

"대표 캐릭터"를 사진 섹션과 영상 섹션으로 나누고, 섹션 자체를 관리자가 추가/삭제/순서 변경할 수 있게 만들었다.

- `CharacterSectionBlock` 컴포넌트로 섹션 렌더링 로직 추출
- `CharactersSection`을 여러 섹션을 순회하는 컨테이너로 축소
- `Navbar`가 캐릭터 섹션마다 네비게이션 항목을 동적으로 생성하도록 변경
- 관리자 캐릭터 폼에서 섹션 단위 추가/삭제/순서변경 지원
- 대표 캐릭터 데이터 구조 마이그레이션 SQL 작성 및 실행 (NULL-safe 타입 비교, seed 데이터 안정성 보강 포함) — **실제 운영 Supabase에 적용 완료**

## 2026-07-22 — 더보기 토글 + 반응형 Hero/Navbar

- 캐릭터 카드가 6개를 넘으면 "더보기" 버튼으로 나머지를 펼치는 기능 추가
- 섹션별로 더보기 기능을 켜고 끌 수 있는 관리자 토글 추가
- Hero 이미지가 극단적 화면비율에서 레터박스로 전환되도록 수정
- 모바일 세로모드에서 Navbar가 햄버거 메뉴로 전환되도록 추가

## 2026-07-22 — 관리자 비밀번호 변경 기능

- 표시/숨김 토글이 가능한 `PasswordField` 컴포넌트 추가
- `useAuth`에 `changePassword` 추가 (현재 비밀번호로 재인증 후 변경)
- 비밀번호 변경 `AccountForm` 컴포넌트 추가 (검증 + 에러 메시지)
- 관리자 사이드바에 "계정 설정" 메뉴 연결
- 버그 수정: 계정 설정 탭에서 불필요한 `site_content` 조회를 건너뛰도록 수정

## 2026-07-22 — site_content 변경 이력 및 롤백

- `site_content_history` 테이블 + `AFTER UPDATE` 트리거 추가 (섹션별 최근 5개 변경 이력 자동 보관)
- 트리거 함수는 `security definer`로 실행, `site_content_history`는 `authenticated` 롤에 `select`만 허용 — 관리자 세션이 탈취돼도 이력 자체는 API로 조작 불가
- 복원은 관리자 UI 없이 Supabase SQL Editor에서 수동 수행 (절차: `docs/superpowers/specs/2026-07-22-content-history-rollback-design.md` 참고)
- 프로덕션 Supabase에 마이그레이션 적용 및 검증 완료: 6회 연속 업데이트 시 이력 5개로 유지, 동일 값 재저장 시 이력 미증가, `authenticated` 롤의 직접 insert/delete 전부 거부, 복원 SQL로 실제 섹션 복원 확인

## 배포

- 배포처: Vercel — org `nanary000`, project `cos-profile`, production URL `https://cos-profile.vercel.app`
- 자동 배포(Git 연동) 미설정 — `vercel --prod`로 수동 배포
- 현재 상태(2026-07-22 기준): 모든 기능 커밋 완료, 테스트 82개 전체 통과, 최신 커밋 프로덕션 배포 완료
