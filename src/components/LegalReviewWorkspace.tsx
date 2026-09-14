import { useEffect, useState } from "react";
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
  saveLegalReviewDocument,
  toAnalysisResult,
} from "@/lib/legal-review";
import type { AnalysisResult, LegalDocType, LegalReviewRow, QAPair } from "@/lib/legal-review";

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

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">{type === "criminal" ? "형사사건 검토" : "민사사건 검토"}</h2>

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
              ? "처벌가능성이 높다고 판단됩니다. 고소장을 작성하시겠습니까?"
              : "승소가능성이 높다고 판단됩니다. 소장을 작성하시겠습니까? 내용증명을 작성하시겠습니까?"}
          </p>
          <div className="mt-3 space-y-3">
            {type === "criminal" ? (
              <GeneratedDocBlock
                label="고소장"
                buttonLabel="고소장 작성"
                content={review.documents.criminal_complaint}
                generating={!!generating.criminal_complaint}
                onGenerate={() => onGenerate("criminal_complaint")}
                onPrint={() => printDoc("고소장", review.documents.criminal_complaint ?? "")}
              />
            ) : (
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
  const { printDoc, portal } = usePrint();

  async function runClassify(qaSoFar: QAPair[], forceComplete: boolean) {
    const res = await classifyLegalCase({ data: { inputText, qaHistory: qaSoFar, forceComplete } });
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
      toast.error(err instanceof Error ? err.message : "분석에 실패했습니다.");
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
      toast.error(err instanceof Error ? err.message : "분석에 실패했습니다.");
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
      toast.error(err instanceof Error ? err.message : "문서 작성에 실패했습니다.");
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
  }

  return (
    <div className="space-y-6">
      <section className="no-print rounded-lg border bg-card p-4">
        <label className="text-sm font-medium">검토 요청 사안</label>
        <Textarea
          rows={8}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="직영점/부서에서 검토를 요청한 사안의 경위, 관련자, 일시, 손해 내용 등을 육하원칙에 따라 최대한 구체적으로 입력해주세요."
          className="mt-2"
          disabled={!!review || !!pendingQuestions}
        />
        <div className="mt-3 flex justify-end gap-2">
          {(review || pendingQuestions) && (
            <Button variant="outline" size="sm" onClick={reset}>
              새 사안 검토
            </Button>
          )}
          {!review && !pendingQuestions && (
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? "분석 중…" : "사안 분석하기"}
            </Button>
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
