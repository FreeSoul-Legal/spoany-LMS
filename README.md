# 사안 검토 시스템 (spoany-LMS)

직영점(헬스장)이나 본사 각 부서에서 검토를 요청한 사안을 입력하면, AI(Claude)가 형사·민사 진행 가능성을 분석하고
필요한 보고서·서면(고소장/소장/내용증명) 초안을 작성해주는 사내 법률 검토 도구입니다.

로그인 화면 없이 바로 사용하는 단일 사용자용 도구입니다. (외부에 공개 배포할 경우, 접근 제한 방법을 별도로
추가하는 것을 권장합니다 — 아래 "배포 시 참고" 참조.)

## 기능

1. 사안 입력 → AI가 판단에 필요한 정보가 부족하면 확인 질문을 먼저 던지고, 답변을 반영해 분석
2. 형사/민사 해당 여부 판단
3. 형사: 처벌가능성(높음/다툼의 여지/낮음) 체크 + 사실관계·죄명및근거·설명 표시 → 보고서 작성/인쇄 → (높음일 때) 고소장 작성
4. 민사: 승소가능성(높음/다툼의 여지/낮음) 체크 + 사실관계·근거·설명 표시 → 보고서 작성/인쇄 → (높음일 때) 소장/내용증명 작성
5. 분석·서면 이력은 저장되어 `/history`에서 다시 확인 가능

## 기술 스택

- TanStack Start (React, SSR, 서버 함수) + TanStack Router + TanStack Query
- Nitro — 어떤 Node 호환 호스팅에도 배포 가능한 범용 서버 어댑터
- Supabase Postgres — spoany-cms와 같은 프로젝트를 재사용 (서버 함수에서 서비스 롤 키로만 접근)
- Claude API (Anthropic) — 서버 함수에서 직접 호출
- Tailwind CSS

## 환경변수 설정

`.env.example`을 복사해 `.env`를 만들고 값을 채워주세요.

```bash
cp .env.example .env
```

- `SUPABASE_URL`: Supabase 프로젝트 설정(Project Settings → API)에서 확인 (spoany-cms와 동일 프로젝트 사용 시 그 값 그대로 사용)
- `SUPABASE_SERVICE_ROLE_KEY`: 같은 화면(Project Settings → API)의 **service_role** 키. `anon`/`publishable` 키가 아니라
  RLS를 우회하는 비밀 키이므로, 절대 외부에 노출하거나 클라이언트 코드에 넣지 마세요.
- `ANTHROPIC_API_KEY`: Claude API 키. https://console.anthropic.com 에서 발급

배포 환경(호스팅 플랫폼)에도 동일한 환경변수를 등록해야 합니다.

## 데이터베이스 준비

`supabase/migrations/0001_legal_reviews.sql`을 Supabase 대시보드의 SQL Editor에서 실행하거나,
Supabase CLI가 연결되어 있다면 `supabase db push`로 적용하세요.

## 로컬 실행

```bash
bun install
bun run dev
```

기본적으로 http://localhost:3000 에서 바로 사용할 수 있습니다(로그인 불필요).

## 빌드 및 배포 (Nitro)

이 프로젝트는 Nitro를 범용 서버 어댑터로 사용하므로, Node를 지원하는 어떤 호스팅에도 배포할 수 있습니다.

```bash
bun run build
node dist/server/index.mjs
```

빌드 결과물은 독립적으로 실행되는 Node 서버입니다. 배포하려면 `dist/` 디렉터리를 호스팅 환경(Render, Fly.io,
자체 VPS 등)에 올리고 위 실행 명령을 실행하면 됩니다. 이때도 위 환경변수(`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`)를 호스팅 플랫폼에 등록해야 합니다.

Vercel/Netlify/Cloudflare/AWS Lambda 등 특정 플랫폼 전용 설정이 필요하면 https://v3.nitro.build/deploy 를 참고하세요.

## 배포 시 참고

로그인이 없으므로, 이 앱의 URL을 아는 사람은 누구나 사용할 수 있고 그때마다 Claude API 비용이 발생합니다.
외부에 공개 배포한다면 아래 중 하나를 함께 고려하세요.

- 호스팅 플랫폼(Vercel/Cloudflare 등)의 비밀번호 보호·접근 제한 기능 사용
- URL을 공유하지 않고 본인만 아는 상태로 유지
- 필요 시 이전처럼 Supabase Auth 로그인 화면을 다시 추가 (요청 시 원복 가능)
