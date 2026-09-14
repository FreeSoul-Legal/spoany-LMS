-- 사안 검토(형사/민사 분석 및 서면 초안 작성) 시스템용 테이블.
-- spoany-cms와 동일한 Supabase 프로젝트를 재사용하므로, public.set_updated_at()
-- 트리거 함수는 이미 존재한다(spoany-cms 마이그레이션에서 생성됨).
--
-- 이 앱은 로그인 화면이 없는 단일 사용자 도구이며, 데이터베이스 접근은
-- 전부 서버 함수에서 서비스 롤 키로만 수행한다(RLS 우회). 그래서 사용자별
-- 소유권 컬럼(user_id)은 두지 않는다.
CREATE TABLE public.legal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  input_text text NOT NULL,
  -- 사건 분류 및 형사/민사 체크리스트 결과 (case types, criminal, civil 등)
  analysis jsonb,
  -- 생성된 보고서/서면 모음: criminal_report, civil_report, criminal_complaint, civil_complaint, content_cert
  documents jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX legal_reviews_created_at_idx ON public.legal_reviews(created_at DESC);

ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;

-- 서비스 롤 키는 RLS를 우회하므로 서버 함수는 항상 접근 가능하다.
-- 혹시라도 publishable(anon) 키로 클라이언트에서 직접 접근을 시도하는 경우를
-- 막기 위해 일반 클라이언트 접근은 전부 차단해둔다.
CREATE POLICY "legal_reviews_deny_all_client_access" ON public.legal_reviews
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER legal_reviews_set_updated_at
  BEFORE UPDATE ON public.legal_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
