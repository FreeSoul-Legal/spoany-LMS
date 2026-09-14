-- 사안 검토(형사/민사 분석 및 서면 초안 작성) 시스템용 테이블.
-- spoany-cms와 동일한 Supabase 프로젝트를 재사용하므로, public.set_updated_at()
-- 트리거 함수는 이미 존재한다(spoany-cms 마이그레이션에서 생성됨).
--
-- 이 앱은 로그인 화면이 없는 단일 사용자 도구이며, 브라우저에서 공개용
-- publishable(anon) 키로 직접 이 테이블에 접근한다. 그래서 사용자별
-- 소유권 컬럼(user_id)은 두지 않고, RLS는 anon 역할에 전체 접근을 허용한다.
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

-- 로그인이 없으므로 anon(공개) 역할에 전체 CRUD를 허용한다.
-- 이 URL/앱에 접근할 수 있는 사람은 누구나 데이터를 보고 쓸 수 있다는 뜻이므로,
-- 외부에 공개 배포할 때는 README의 "배포 시 참고"를 확인할 것.
CREATE POLICY "legal_reviews_anon_full_access" ON public.legal_reviews
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER legal_reviews_set_updated_at
  BEFORE UPDATE ON public.legal_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
