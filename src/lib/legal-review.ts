import { supabase } from "@/lib/supabase/client";
import type { AnalysisResult, LegalDocType } from "@/lib/legal-review.functions";

export type { AnalysisResult, LegalDocType };

export type LegalDocuments = Partial<Record<LegalDocType, string>>;

export type LegalReviewRow = {
  id: string;
  user_id: string;
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
};

export function deriveTitle(inputText: string) {
  const firstLine = inputText.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const t = firstLine || inputText.trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || "제목 없음";
}

const SELECT_COLUMNS = "id, user_id, title, input_text, analysis, documents, created_at, updated_at";

export async function fetchLegalReviews() {
  const { data, error } = await supabase.from("legal_reviews").select(SELECT_COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  return data as LegalReviewRow[];
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

export function fmtDateTime(v: string) {
  const d = new Date(v);
  return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
