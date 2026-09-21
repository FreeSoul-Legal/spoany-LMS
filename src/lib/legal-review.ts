import { supabase } from "@/lib/supabase/client";
import type { AnalysisResult, CaseAttachment, ClassifyResponse, LegalDocType, QAPair } from "@/lib/legal-review.functions";

export type { AnalysisResult, CaseAttachment, ClassifyResponse, LegalDocType, QAPair };

/**
 * 서버 함수(RPC)를 넘어온 에러는 `instanceof Error`가 항상 참이라는 보장이 없다
 * (직렬화 과정에서 프로토타입 체인이 유지되지 않는 경우가 있다). instanceof 대신
 * message 속성 유무만 구조적으로 확인해 실제 원인 메시지가 화면에서 사라지지 않게 한다.
 */
export function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

export type LegalDocuments = Partial<Record<LegalDocType, string>>;

export type LegalReviewRow = {
  id: string;
  title: string;
  input_text: string;
  analysis: AnalysisResult | null;
  documents: LegalDocuments;
  created_at: string;
  updated_at: string;
};

export const LEVEL_LABEL = {
  criminal: {
    high: "처벌가능성 높음",
    dispute: "다툼의 여지 있음",
    low: "처벌이 안 될 가능성 높음",
  },
  civil: {
    high: "승소가능성 높음",
    dispute: "다툼의 여지 있음",
    low: "패소가능성 높음",
  },
} as const;

export const DOC_TYPE_LABEL: Record<LegalDocType, string> = {
  criminal_report: "형사 검토보고서",
  civil_report: "민사 검토보고서",
  criminal_complaint: "고소장",
  civil_complaint: "소장(민사)",
  content_cert: "내용증명",
  criminal_opinion: "의견서(형사)",
  civil_answer: "답변서(민사)",
};

export function deriveTitle(inputText: string) {
  const firstLine = inputText.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const t = firstLine || inputText.trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || "제목 없음";
}

/** classify 완료 응답에서 상태 판별용 필드를 제외한 AnalysisResult만 추출한다. */
export function toAnalysisResult(res: Extract<ClassifyResponse, { status: "complete" }>): AnalysisResult {
  const { status: _status, ...analysis } = res;
  return analysis;
}

/** 원본 사안 설명 + 추가 확인 질문/답변을 하나의 텍스트로 합친다(저장·서면 작성에 사용). */
export function combineInputWithQA(inputText: string, qaHistory: QAPair[]) {
  if (qaHistory.length === 0) return inputText;
  const qaText = qaHistory.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n");
  return `${inputText}\n\n[추가 확인 사항]\n${qaText}`;
}

export function fmtDateTime(v: string) {
  const d = new Date(v);
  return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const SELECT_COLUMNS = "id, title, input_text, analysis, documents, created_at, updated_at";

export async function fetchLegalReviews() {
  const { data, error } = await supabase.from("legal_reviews").select(SELECT_COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchLegalReview(id: string) {
  const { data, error } = await supabase.from("legal_reviews").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createLegalReview(input: { title: string; inputText: string; analysis: AnalysisResult }) {
  const { data, error } = await supabase
    .from("legal_reviews")
    .insert({ title: input.title, input_text: input.inputText, analysis: input.analysis })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function saveLegalReviewDocument(id: string, docType: LegalDocType, content: string, current: LegalDocuments) {
  const documents = { ...current, [docType]: content };
  const { data, error } = await supabase.from("legal_reviews").update({ documents }).eq("id", id).select(SELECT_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function deleteLegalReview(id: string) {
  const { error } = await supabase.from("legal_reviews").delete().eq("id", id);
  if (error) throw error;
}

export async function updateLegalReviewTitle(id: string, title: string) {
  const { data, error } = await supabase.from("legal_reviews").update({ title }).eq("id", id).select(SELECT_COLUMNS).single();
  if (error) throw error;
  return data;
}
