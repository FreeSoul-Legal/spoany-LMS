import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { classifyLegalCase, generateLegalDocument } from "@/lib/legal-review.functions";
import {
  DOC_TYPE_LABEL,
  LEVEL_LABEL,
  combineInputWithQA,
  createLegalReview,
  deriveTitle,
  errorMessage,
  saveLegalReviewDocument,
  toAnalysisResult,
} from "@/lib/legal-review";
import type { AnalysisResult, CaseAttachment, LegalDocType, LegalReviewRow, QAPair } from "@/lib/legal-review";

const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain";
const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"] as const;
type AttachmentMediaType = (typeof ATTACHMENT_TYPES)[number];
const ATTACHMENT_TYPE_LABEL: Record<AttachmentMediaType, string> = {
  "image/jpeg": "이미지",
  "image/png": "이미지",
  "image/webp": "이미지",
  "image/gif": "이미지",
  "application/pdf": "PDF",
  "text/plain": "텍스트",
};
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function isAttachmentMediaType(type: string): type is AttachmentMediaType {
  return (ATTACHMENT_TYPES as readonly string[]).includes(type);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

/** body.printing 클래스가 있을 때 이 포탈 내용만 보이도록 styles.css에서 처리한다. */
function usePrint() {
  const [job, setJob] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (!job) return;
    document.body.classList.add("printing");
    const raf = requestAnimationFrame(() => window.print());
    const cleanup = () => {
      document.body.classList.remove("printing");
      setJob(null);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", cleanup);
    };
  }, [job]);

  const printDoc = (title: string, content: string) => {
    if (!content) {
      toast.error("먼저 문서를 작성해주세요.");
      return;
    }
    setJob({ title, content });
  };

  const portal = (
    <div id="print-portal">
      {job && (
        <>
          <h1>{job.title}</h1>
          <pre>{job.content}</pre>
        </>
      )}
    </div>
  );

  return { printDoc, portal };
}

function LevelChecklist({ type, level }: { type: "criminal" | "civil"; level: "high" | "dispute" | "low" }) {
  const options = ["high", "dispute", "low"] as const;
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={level === opt} readOnly className="h-4 w-4 accent-primary" />
          <span className={level === opt ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {LEVEL_LABEL[type][opt]}
          </span>
        </label>
      ))}
    </div>
  );
}

function AssessmentDetail({
  facts,
  basis,
  basisLabel,
  explanation,
}: {
  facts: string;
  basis: string;
  basisLabel: string;
  explanation: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium">1) 사실관계</p>
        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{facts}</p>
      </div>
      <div>
        <p className="font-medium">2) {basisLabel}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{basis}</p>
      </div>
      <div>
        <p className="font-medium">3) 구체적 설명</p>
        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{explanation}</p>
      </div>
    </div>
  );
}

function GeneratedDocBlock({
  label,
  buttonLabel,
  content,
  generating,
  onGenerate,
  onPrint,
}: {
  label: string;
  buttonLabel: string;
  content: string | undefined;
  generating: boolean;
  onGenerate: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      {!content ? (
        <Button size="sm" onClick={onGenerate} disabled={generating}>
          {generating ? "작성 중…" : buttonLabel}
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{label}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onGenerate} disabled={generating}>
                {generating ? "작성 중…" : "다시 작성"}
              </Button>
              <Button size="sm" variant="outline" onClick={onPrint}>
                인쇄
              </Button>
            </div>
          </div>
          <pre className="mt-2 max-h-[560px] overflow-auto whitespace-pre-wrap rounded border bg-background p-4 font-serif text-sm leading-7">
            {content}
          </pre>
        </>
      )}
    </div>
  );
}

type Assessment = NonNullable<AnalysisResult["criminal"]>;

function CaseSection({
  type,
  data,
  review,
  generating,
  onGenerate,
  printDoc,
}: {
  type: "criminal" | "civil";
  data: Assessment;
  review: LegalReviewRow;
  generating: Partial<Record<LegalDocType, boolean>>;
  onGenerate: (docType: LegalDocType) => void;
  printDoc: (title: string, content: string) => void;
}) {
  const reportType: LegalDocType = type === "criminal" ? "criminal_report" : "civil_report";
  const basisLabel = type === "criminal" ? "죄명 및 관련 근거" : "관련 근거";
  const isClaimant = data.role === "claimant";
  const roleLabel =
    type === "criminal" ? (isClaimant ? "피해자(고소인) 입장" : "피의자(피고소인) 입장") : isClaimant ? "원고 입장" : "피고 입장";

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{type === "criminal" ? "형사사건 검토" : "민사사건 검토"}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{roleLabel}</span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr]">
        <LevelChecklist type={type} level={data.level} />
        <AssessmentDetail facts={data.facts} basis={data.basis} basisLabel={basisLabel} explanation={data.explanation} />
      </div>

      <div className="mt-4 border-t pt-4">
        <GeneratedDocBlock
          label={DOC_TYPE_LABEL[reportType]}
          buttonLabel="보고서 작성"
          content={review.documents[reportType]}
          generating={!!generating[reportType]}
          onGenerate={() => onGenerate(reportType)}
          onPrint={() => printDoc(DOC_TYPE_LABEL[reportType], review.documents[reportType] ?? "")}
        />
      </div>

      {data.level === "high" && (
        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-medium">
            {type === "criminal"
              ? isClaimant
                ? "처벌가능성이 높다고 판단됩니다. 고소장을 작성하시겠습니까?"
                : "처벌가능성이 높다고 판단됩니다. 의견서(형사)를 작성하시겠습니까?"
              : isClaimant
                ? "승소가능성이 높다고 판단됩니다. 소장을 작성하시겠습니까? 내용증명을 작성하시겠습니까?"
                : "승소가능성이 높다고 판단됩니다. 답변서(민사)를 작성하시겠습니까?"}
          </p>
          <div className="mt-3 space-y-3">
            {type === "criminal" ? (
              isClaimant ? (
                <GeneratedDocBlock
                  label="고소장"
                  buttonLabel="고소장 작성"
                  content={review.documents.criminal_complaint}
                  generating={!!generating.criminal_complaint}
                  onGenerate={() => onGenerate("criminal_complaint")}
                  onPrint={() => printDoc("고소장", review.documents.criminal_complaint ?? "")}
                />
              ) : (
                <GeneratedDocBlock
                  label="의견서(형사)"
                  buttonLabel="의견서 작성"
                  content={review.documents.criminal_opinion}
                  generating={!!generating.criminal_opinion}
                  onGenerate={() => onGenerate("criminal_opinion")}
                  onPrint={() => printDoc("의견서(형사)", review.documents.criminal_opinion ?? "")}
                />
              )
            ) : isClaimant ? (
              <>
                <GeneratedDocBlock
                  label="소장(민사)"
                  buttonLabel="소장 작성"
                  content={review.documents.civil_complaint}
                  generating={!!generating.civil_complaint}
                  onGenerate={() => onGenerate("civil_complaint")}
                  onPrint={() => printDoc("소장", review.documents.civil_complaint ?? "")}
                />
                <GeneratedDocBlock
                  label="내용증명"
                  buttonLabel="내용증명 작성"
                  content={review.documents.content_cert}
                  generating={!!generating.content_cert}
                  onGenerate={() => onGenerate("content_cert")}
                  onPrint={() => printDoc("내용증명", review.documents.content_cert ?? "")}
                />
              </>
            ) : (
              <GeneratedDocBlock
                label="답변서(민사)"
                buttonLabel="답변서 작성"
                content={review.documents.civil_answer}
                generating={!!generating.civil_answer}
                onGenerate={() => onGenerate("civil_answer")}
                onPrint={() => printDoc("답변서(민사)", review.documents.civil_answer ?? "")}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function QuestionForm({
  questions,
  answers,
  onChange,
  onSubmit,
  submitting,
}: {
  questions: string[];
  answers: string[];
  onChange: (index: number, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <section className="no-print rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">추가 확인이 필요합니다</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        정확한 판단을 위해 아래 사항을 확인해주세요. 확실하지 않으면 아는 대로만 적어도 괜찮습니다.
      </p>
      <div className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="space-y-1.5">
            <label className="text-sm font-medium">{`${i + 1}. ${q}`}</label>
            <Textarea rows={2} value={answers[i] ?? ""} onChange={(e) => onChange(i, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? "분석 중…" : "답변 제출"}
        </Button>
      </div>
    </section>
  );
}

export function LegalReviewWorkspace({ initial }: { initial?: LegalReviewRow }) {
  const [inputText, setInputText] = useState(initial?.input_text ?? "");
  const [review, setReview] = useState<LegalReviewRow | null>(initial ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState<Partial<Record<LegalDocType, boolean>>>({});
  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { printDoc, portal } = usePrint();

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`파일은 최대 ${MAX_ATTACHMENTS}개까지 첨부할 수 있습니다.`);
      return;
    }
    for (const file of files) {
      const mediaType = file.type;
      if (!isAttachmentMediaType(mediaType)) {
        toast.error(`지원하지 않는 파일 형식입니다: ${file.name} (이미지, PDF, 텍스트 파일만 가능)`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`파일 용량이 너무 큽니다(최대 10MB): ${file.name}`);
        continue;
      }
      try {
        const data = await fileToBase64(file);
        setAttachments((prev) => [...prev, { name: file.name, mediaType, data }]);
      } catch {
        toast.error(`파일을 읽지 못했습니다: ${file.name}`);
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function runClassify(qaSoFar: QAPair[], forceComplete: boolean) {
    const res = await classifyLegalCase({ data: { inputText, qaHistory: qaSoFar, forceComplete, attachments } });
    if (res.status === "need_more_info") {
      setPendingQuestions(res.questions);
      setAnswers(res.questions.map(() => ""));
      return;
    }
    const combinedInput = combineInputWithQA(inputText, qaSoFar);
    const saved = await createLegalReview({ title: deriveTitle(inputText), inputText: combinedInput, analysis: toAnalysisResult(res) });
    setReview(saved);
    setPendingQuestions(null);
    toast.success("사안 분석이 완료되었습니다.");
  }

  async function handleAnalyze() {
    if (inputText.trim().length < 10) {
      toast.error("사안을 조금 더 구체적으로 입력해주세요.");
      return;
    }
    setAnalyzing(true);
    try {
      await runClassify([], false);
    } catch (err) {
      toast.error(errorMessage(err, "분석에 실패했습니다."));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAnswerSubmit() {
    if (!pendingQuestions) return;
    const newQa = pendingQuestions.map((q, i) => ({ question: q, answer: answers[i]?.trim() || "확인되지 않음" }));
    const combined = [...qaHistory, ...newQa];
    setAnalyzing(true);
    try {
      // 한 차례 답변을 받은 뒤에는 추가 질문 없이 최종 판단하도록 요청한다.
      await runClassify(combined, true);
      setQaHistory(combined);
    } catch (err) {
      toast.error(errorMessage(err, "분석에 실패했습니다."));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate(docType: LegalDocType) {
    if (!review || !review.analysis) return;
    setGenerating((g) => ({ ...g, [docType]: true }));
    try {
      const { content } = await generateLegalDocument({
        data: { inputText: review.input_text, analysis: review.analysis, docType },
      });
      const updated = await saveLegalReviewDocument(review.id, docType, content, review.documents);
      setReview(updated);
      toast.success(`${DOC_TYPE_LABEL[docType]} 작성이 완료되었습니다.`);
    } catch (err) {
      toast.error(errorMessage(err, "문서 작성에 실패했습니다."));
    } finally {
      setGenerating((g) => ({ ...g, [docType]: false }));
    }
  }

  function reset() {
    setReview(null);
    setInputText("");
    setQaHistory([]);
    setPendingQuestions(null);
    setAnswers([]);
    setAttachments([]);
  }

  return (
    <div className="space-y-6">
      <section className="no-print rounded-lg border bg-card p-4">
        <label className="text-sm font-medium">검토 요청 사안</label>
        <Textarea
          rows={8}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="검토를 요청한 사안의 경위, 관련자, 일시, 손해 내용 등을 육하원칙에 따라 최대한 구체적으로 입력해주세요."
          className="mt-2"
          disabled={!!review || !!pendingQuestions}
        />
        {!review && !pendingQuestions && attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs">
                <span className="max-w-[160px] truncate">{a.name}</span>
                <span className="text-muted-foreground">({ATTACHMENT_TYPE_LABEL[a.mediaType]})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="첨부 삭제"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          {(review || pendingQuestions) && (
            <Button variant="outline" size="sm" onClick={reset}>
              신규 검토
            </Button>
          )}
          {!review && !pendingQuestions && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
                파일첨부
              </Button>
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "분석 중…" : "사안 분석하기"}
              </Button>
            </>
          )}
        </div>
      </section>

      {pendingQuestions && !review && (
        <QuestionForm
          questions={pendingQuestions}
          answers={answers}
          onChange={(i, v) => setAnswers((a) => a.map((x, idx) => (idx === i ? v : x)))}
          onSubmit={handleAnswerSubmit}
          submitting={analyzing}
        />
      )}

      {review?.analysis && (
        <>
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">사건 유형 판단</h2>
            <p className="mt-1 text-sm text-muted-foreground">{review.analysis.summary}</p>
            <div className="mt-3 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={review.analysis.caseTypes.criminal} readOnly className="h-4 w-4 accent-primary" />
                형사사건
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={review.analysis.caseTypes.civil} readOnly className="h-4 w-4 accent-primary" />
                민사사건
              </label>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{review.analysis.caseTypes.reasoning}</p>
          </section>

          {review.analysis.criminal && (
            <CaseSection
              type="criminal"
              data={review.analysis.criminal}
              review={review}
              generating={generating}
              onGenerate={handleGenerate}
              printDoc={printDoc}
            />
          )}

          {review.analysis.civil && (
            <CaseSection
              type="civil"
              data={review.analysis.civil}
              review={review}
              generating={generating}
              onGenerate={handleGenerate}
              printDoc={printDoc}
            />
          )}
        </>
      )}

      {portal}
    </div>
  );
}
