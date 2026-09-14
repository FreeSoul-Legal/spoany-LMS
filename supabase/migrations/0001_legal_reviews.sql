-- 사안 검토(형사/민사 분석 및 서면 초안 작성) 시스템용 테이블.
-- spoany-cms와 동일한 Supabase 프로젝트를 재사용하므로, public.set_updated_at()
-- 트리거 함수는 이미 존재한다(spoany-cms 마이그레이션에서 생성됨).
CREATE TABLE public.legal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  input_text text NOT NULL,
  -- 사건 분류 및 형사/민사 체크리스트 결과 (case types, criminal, civil 등)
  analysis jsonb,
  -- 생성된 보고서/서면 모음: criminal_report, civil_report, criminal_complaint, civil_complaint, content_cert
  documents jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX legal_reviews_user_idx ON public.legal_reviews(user_id);
CREATE INDEX legal_reviews_created_at_idx ON public.legal_reviews(created_at DESC);

ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;

-- 이 시스템은 담당자 1인 전용이므로, 해당 계정 이메일로 접근을 제한한다.
CREATE POLICY "legal_reviews_owner_email_only" ON public.legal_reviews
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'zzang9kim@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'zzang9kim@gmail.com' AND user_id = auth.uid());

CREATE TRIGGER legal_reviews_set_updated_at
  BEFORE UPDATE ON public.legal_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
