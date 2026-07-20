# Portfolio Cosplay

코스플레이어 포트폴리오 사이트. Vite + React 프론트엔드와 Supabase(DB/Auth) 기반 관리자 페이지로 구성되어 있습니다.

## 시작하기

1. 패키지 설치

```bash
npm install
```

2. Supabase 프로젝트를 생성하고, `.env.example`을 복사해 `.env.local`을 만든 뒤 Project URL과 anon key를 채워 넣습니다.

```bash
cp .env.example .env.local
```

3. Supabase 대시보드의 SQL Editor에서 스키마와 시드 데이터를 순서대로 실행합니다.

```
supabase/schema.sql
supabase/seed.sql
```

4. 관리자 계정 생성: 별도의 회원가입 화면이 없으므로, Supabase 대시보드 → Authentication → Users 에서 관리자 계정을 **직접 생성**해야 합니다.

5. 개발 서버 실행

```bash
npm run dev
```

- 공개 사이트: `/`
- 관리자 로그인: `/admin/login`

## 테스트 & 빌드

```bash
npm test        # 단위 테스트
npm run build   # 프로덕션 빌드
```
