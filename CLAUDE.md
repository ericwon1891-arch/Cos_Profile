# Portfolio Cosplay — Claude Code 설정

## 언어 설정

**모든 질문과 답변은 한국어로 진행한다.**
코드, 파일명, 기술 용어는 영어 그대로 사용하되, 설명과 커뮤니케이션은 반드시 한국어로 한다.

## 프로젝트 개요

코스플레이어 · 모델 · MC "나나리(NANARY)"를 위한 포트폴리오 사이트.
`C:\Users\Eric\portfolio`(영상 편집자 포트폴리오)를 포크해 만든 완전히 독립된 프로젝트로, 이후 코드 공유 없이 별도로 진화한다.

- 최초 설계 문서: `C:\Users\Eric\docs\superpowers\specs\2026-07-19-portfolio-cosplay-design.md`
- 이후 진행된 기능별 계획/설계 문서는 프로젝트 안 `docs/superpowers/plans`, `docs/superpowers/specs`에 있음. 전체 작업 이력 요약은 `docs/UPDATE_HISTORY.md` 참고
- 관람 대상: 행사 주최자, 브랜드 담당자, 팬
- 콘텐츠는 관리자(`/admin`) 로그인 후 코드 수정 없이 웹에서 직접 편집 가능해야 한다.

## 기술 스택

- **프레임워크**: React 19 + Vite
- **스타일링**: Tailwind CSS (다크/모노톤 비주얼)
- **라우팅**: react-router-dom (`/` 공개 페이지, `/admin/*` 관리자 페이지)
- **백엔드(BaaS)**: Supabase — Postgres DB + Auth + Storage
- **스크롤**: react-scroll (공개 페이지 내 앵커 이동)
- **테스트**: Vitest + @testing-library/react

## 주요 명령어

```bash
npm run dev       # 개발 서버
npm test          # 단위 테스트 (Vitest)
npm run build     # 프로덕션 빌드
npm run lint      # oxlint
```

## 아키텍처

### 공개 페이지 (`/`)
섹션 컴포넌트가 마운트 시 `useSectionContent(section)` 훅으로 Supabase `site_content` 테이블에서 해당 row를 fetch한다. 로딩 중에는 스켈레톤, 실패 시 조용히 빈 상태로 렌더링한다.

섹션 순서: Hero → About → Strength → Career → Characters(대표 캐릭터) → Available → SNS → Services → Personality → Contact

### 관리자 페이지 (`/admin`)
`RequireAuth`로 라우트 보호 → `AdminLogin`(Supabase Auth 이메일/비밀번호) → `AdminDashboard`에서 섹션 선택 후 해당 `*Form.jsx`가 현재 데이터로 폼을 채움 → 저장 시 `supabase.from('site_content').update({ data, updated_at })`. 이미지 필드는 Storage에 먼저 업로드 후 public URL을 `data`에 반영한다. 계정 설정(비밀번호 변경)은 `AccountForm`이 담당하며 `site_content` 조회를 건너뛴다 (`useAuth().changePassword` — 현재 비밀번호로 재인증 후 변경).

### 대표 캐릭터 갤러리 (핵심 도메인 로직)
`characters` 섹션의 `data`는 단일 리스트가 아니라 **여러 개의 독립된 하위 섹션 배열**이다: `{ sections: [{ id, heading, categories, items, showMoreEnabled }] }`. 관리자가 섹션 자체를 추가/삭제/순서 변경할 수 있다.

- `CharactersSection` — `data.sections`를 순회하며 `CharacterSectionBlock`을 렌더링하는 컨테이너
- `CharacterSectionBlock` — 카테고리 필터, 카드 그리드, "더보기" 토글(6개 초과 시, `showMoreEnabled`가 섹션별로 켜고 끌 수 있음), `PhotoModal` 오픈을 담당
- `WorkCard` — 사진/영상 아이콘 분기는 `type` 필드가 아니라 **영상 관련 필드(`youtubeId`/`localVideoSrc`) 존재 여부**로 판단
- `PhotoModal` — 사진+영상 슬라이드를 함께 순회하는 통합 모달. **`VideoModal`은 존재하지 않는다** (기존에 있었으나 PhotoModal로 완전히 통합·삭제됨)
- `Navbar` — 캐릭터 섹션마다 네비게이션 항목을 동적으로 생성

### 데이터 모델 (Supabase)
- `site_content` 테이블: `section`(PK, 섹션 키) + `data`(jsonb) + `updated_at`. 섹션마다 테이블을 나누지 않고 하나의 테이블 + jsonb로 관리해 스키마 마이그레이션 없이 섹션 형태를 바꿀 수 있다.
- Storage 버킷 `media`: 공개 읽기, `authenticated`만 업로드.
- RLS: `SELECT`는 `anon`/`authenticated` 모두 허용, `INSERT`/`UPDATE`는 `authenticated`만 허용. 회원가입 플로우는 없고 관리자 계정은 Supabase 대시보드에서 수동 생성.
- 스키마/시드/마이그레이션: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/update-*.sql` (캐릭터 섹션 구조 변경 등 실제 운영 DB에 적용된 마이그레이션 포함)

### 인증 세션
`supabaseClient.js`에서 `auth.storage`를 `window.sessionStorage`로 명시 설정 — 브라우저를 닫으면 관리자 세션이 만료된다 (기본 localStorage 사용 시 세션이 계속 유지되던 버그를 수정한 결과).

### 디렉터리 구조 (실제)
```
src/
├── components/
│   ├── Navbar.jsx, HeroSection.jsx, AboutSection.jsx, StrengthSection.jsx,
│   │   CareerSection.jsx, CharactersSection.jsx, CharacterSectionBlock.jsx,
│   │   AvailableSection.jsx, SnsSection.jsx, ServicesSection.jsx,
│   │   PersonalitySection.jsx, ContactSection.jsx
│   ├── PhotoModal.jsx, WorkCard.jsx    # 대표 캐릭터 갤러리 (사진+영상 통합, VideoModal 없음)
│   ├── admin/
│   │   ├── AdminLogin.jsx, AdminDashboard.jsx, RequireAuth.jsx
│   │   ├── fields/ (TextField, TextAreaField, ListField[reorderable 지원], ImageField, PasswordField)
│   │   └── sections/ (섹션별 *Form.jsx + AccountForm.jsx)
│   └── __tests__/
├── hooks/
│   ├── useSectionContent.js    # 공개 페이지 — 섹션 데이터 fetch
│   └── useAuth.js              # 로그인/로그아웃/세션 + changePassword
├── lib/supabaseClient.js       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, auth.storage=sessionStorage
├── App.jsx                     # 라우팅
└── main.jsx
```

### 반응형
Hero 이미지는 극단적 화면비율에서 레터박스로 전환되고, 모바일 세로모드에서는 Navbar가 햄버거 메뉴로 전환된다.

### 배포
- Vercel — org `nanary000`, project `cos-profile`, production URL `https://cos-profile.vercel.app`
- **git 연동 자동 배포는 설정되어 있지 않다.** `vercel --prod`로 수동 배포해야 반영된다.
- SPA 라우팅을 위해 `vercel.json`에 전체 경로 → `/index.html` rewrite 설정.

## 보안 원칙

- 쓰기 권한 강제 지점은 프론트엔드가 아니라 Supabase RLS. `/admin`에 비로그인 상태로 접근해도 화면엔 로그인 폼만 보이고, 요청을 직접 조작해도 DB가 거부한다.
- 프론트엔드에는 anon key만 존재(읽기 전용 + RLS로 보호되는 쓰기). service-role key는 절대 클라이언트 코드에 포함하지 않는다.
- `.env.local`, `.vercel`은 git에 커밋하지 않는다 (`.gitignore` 확인).

## 테스트 원칙

기존 `portfolio` 프로젝트 패턴을 따라 **상호작용/로직이 있는 컴포넌트만** 테스트한다. 정적 텍스트 섹션은 스냅샷성 테스트를 만들지 않는다. Supabase 클라이언트는 테스트에서 전부 mock 처리해 실제 네트워크 호출이 발생하지 않게 한다.
