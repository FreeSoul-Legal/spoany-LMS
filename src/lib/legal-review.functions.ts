import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

// 이 도구는 담당자 1인 전용이다. DB 쪽 RLS로도 동일하게 막혀 있지만,
// AI 호출(=비용 발생 지점)에서도 이중으로 방어한다.
export const ALLOWED_EMAIL = "zzang9kim@gmail.com";

function assertAllowed(claims: unknown) {
  const email =
    claims && typeof claims === "object" && "email" in claims && typeof claims.email === "string" ? claims.email : undefined;
  if (email !== ALLOWED_EMAIL) {
    throw new Error("이 기능은 담당자 계정에서만 사용할 수 있습니다.");
  }
}

type ClaudeMessage = { role: "user" | "assistant"; content: string };

async function callClaude(system: string, messages: ClaudeMessage[], maxTokens = 4096): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다. 서버 환경변수에 Claude API 키를 등록해주세요.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 분석 요청이 실패했습니다. (${res.status}) ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("AI 응답이 비어 있습니다.");
  return text;
}

/** Claude 응답에서 ```json 코드펜스 등을 제거하고 JSON 객체만 추출한다. */
function extractJson(text: string): unknown {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");
  }
  candidate = candidate.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("AI 응답 형식을 해석하지 못했습니다. 다시 시도해주세요.");
  }
}

const levelSchema = z.enum(["high", "dispute", "low"]);

const caseAssessmentSchema = z.object({
  applicable: z.boolean(),
  level: levelSchema,
  facts: z.string(),
  basis: z.string(),
  explanation: z.string(),
});

export const analysisResultSchema = z.object({
  summary: z.string(),
  caseTypes: z.object({
    criminal: z.boolean(),
    civil: z.boolean(),
    reasoning: z.string(),
  }),
  criminal: caseAssessmentSchema.nullable(),
  civil: caseAssessmentSchema.nullable(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export type QAPair = { question: string; answer: string };

const classifyResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("need_more_info"), questions: z.array(z.string().min(1)).min(1).max(4) }),
  z.object({ status: z.literal("complete") }).extend(analysisResultSchema.shape),
]);

export type ClassifyResponse = z.infer<typeof classifyResponseSchema>;

const CLASSIFY_SYSTEM = `당신은 15년 이상 경력의 대한민국 법률전문가입니다. 회사(헬스장 직영점 및 본사 각 부서)에서 검토를 요청한 사안을 분석합니다.
다음 원칙을 지키세요.
- 결론을 먼저 명확히 제시하고, 근거는 간결하게 제시합니다.
- 격식 있는 문어체를 사용하고 반말을 쓰지 않습니다.
- 반드시 아래 두 JSON 스키마 중 하나와 정확히 동일한 구조의 JSON만 출력합니다. 다른 설명, 인사말, 코드펜스 표시(\`\`\`)를 포함하지 마세요.

1) 제공된 사실관계만으로는 처벌·승소 가능성을 판단하기에 결정적으로 부족한 경우(예: 발언·행위가 있었던 장소/공연성 여부, 목격자·전달 범위, 발생 시기, 당사자 간 관계, 손해 규모 등 핵심 요건 사실이 빠진 경우)에는 아래 "질문형" JSON만 출력하여 최대 4개의 구체적이고 답하기 쉬운 질문을 하세요.
{
  "status": "need_more_info",
  "questions": string[]   // 판단에 결정적으로 필요한 사실관계를 확인하는 질문들. 이미 답변된 내용은 다시 묻지 마세요.
}

2) 판단하기에 충분한 정보가 있으면(또는 더 이상 질문해도 새로운 정보를 얻기 어려우면) 아래 "완료형" JSON을 출력하세요. 이때도 여전히 불확실한 부분은 explanation에 "추가 확인이 필요하다"는 취지로 명시하세요.
{
  "status": "complete",
  "summary": string,               // 사안을 1~2문장으로 요약
  "caseTypes": {
    "criminal": boolean,           // 형사사건으로 진행 가능/검토 실익이 있는지
    "civil": boolean,              // 민사사건으로 진행 가능/검토 실익이 있는지
    "reasoning": string            // 형사/민사 중 무엇으로 갈지(또는 둘 다인지) 판단한 이유
  },
  "criminal": {                    // caseTypes.criminal이 false면 null
    "applicable": true,
    "level": "high" | "dispute" | "low",  // high=처벌가능성 높음, dispute=다툼의 여지가 있음, low=처벌이 안 될 가능성이 높음
    "facts": string,               // 사실관계 간단 요약
    "basis": string,               // 죄명 및 관련 법조문(예: 형법 제355조 횡령 등) 근거
    "explanation": string          // 구체적 설명(왜 그 level인지, 입증 포인트, 유의사항)
  } | null,
  "civil": {                       // caseTypes.civil이 false면 null
    "applicable": true,
    "level": "high" | "dispute" | "low",  // high=승소가능성 높음, dispute=다툼의 여지가 있음, low=패소가능성이 높음
    "facts": string,               // 사실관계 간단 요약
    "basis": string,               // 관련 법률 근거(민법 조문, 관련 판례 등)
    "explanation": string          // 구체적 설명
  } | null
}`;

function buildCaseMessage(inputText: string, qaHistory: QAPair[], forceComplete: boolean) {
  let content = `검토 요청 사안:\n\n${inputText}`;
  if (qaHistory.length > 0) {
    content += `\n\n[추가 확인 사항]\n${qaHistory.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n")}`;
  }
  if (forceComplete) {
    content += `\n\n(안내: 이미 한 차례 추가 질문을 드렸습니다. 지금까지 확인된 사실관계만으로 반드시 "complete" 상태의 최종 판단을 내려주세요. 더 이상 질문하지 마세요.)`;
  }
  return content;
}

export const classifyLegalCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        inputText: z.string().min(10).max(8000),
        qaHistory: z.array(z.object({ question: z.string(), answer: z.string() })).max(8).default([]),
        forceComplete: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    assertAllowed(context.claims);

    const text = await callClaude(CLASSIFY_SYSTEM, [
      { role: "user", content: buildCaseMessage(data.inputText, data.qaHistory, data.forceComplete) },
    ]);
    return classifyResponseSchema.parse(extractJson(text));
  });

export type LegalDocType = "criminal_report" | "civil_report" | "criminal_complaint" | "civil_complaint" | "content_cert";

const DOC_INSTRUCTIONS: Record<LegalDocType, string> = {
  criminal_report: `A4 한 장 분량의 "형사사건 검토보고서"를 작성하세요.
구성: 제목 / 1. 사실관계(간단 요약) / 2. 죄명 및 관련 근거 / 3. 처벌가능성 판단(높음·다툼의 여지·낮음 중 해당 결론과 이유) / 4. 검토의견 및 향후 조치 제안.
분량은 A4 1장을 넘지 않도록 핵심만 간결하게 작성하세요.`,
  civil_report: `A4 한 장 분량의 "민사사건 검토보고서"를 작성하세요.
구성: 제목 / 1. 사실관계(간단 요약) / 2. 관련 근거(법률·판례) / 3. 승소가능성 판단(높음·다툼의 여지·낮음 중 해당 결론과 이유) / 4. 검토의견 및 향후 조치 제안.
분량은 A4 1장을 넘지 않도록 핵심만 간결하게 작성하세요.`,
  criminal_complaint: `대한민국 경찰서/검찰청에 제출하는 정식 "고소장" 서식을 작성하세요.
구성: 고소장 제목 / 고소인 인적사항(성명·주민등록번호·주소·연락처는 "○○○" 등 괄호 안 안내 문구로 기재란만 표시) / 피고소인 인적사항(동일하게 기재란 표시) / 고소취지 / 고소사실(육하원칙에 따른 서술) / 적용법조 / 증거자료 / 관련사건의 수사 및 재판 여부 / 작성 연월일 / 고소인 (인) 순서로 작성하세요.
사실관계에 없는 구체적 인적사항·일시·금액 등은 임의로 지어내지 말고 "[ ]" 표시로 기재란을 남겨두세요.`,
  civil_complaint: `대한민국 법원에 제출하는 정식 민사 "소장" 서식을 작성하세요.
구성: 소장 제목 / 원고·피고 인적사항(기재란은 "[ ]"로 표시) / 사건명 / 청구취지 / 청구원인(육하원칙 서술, 관련 법률상 근거 포함) / 입증방법 / 첨부서류 / 작성 연월일 / 원고 (인), 관할법원 표시 순서로 작성하세요.
사실관계에 없는 구체적 인적사항·일시·금액 등은 임의로 지어내지 말고 "[ ]" 표시로 기재란을 남겨두세요.`,
  content_cert: `상대방에게 발송할 "내용증명" 우편 서식을 작성하세요.
구성: 제목(내용증명) / 발신인·수신인 표시(기재란은 "[ ]"로 표시) / 본문(사실관계 정리, 상대방의 의무 위반 또는 요청 사항 특정, 이행 요구 및 기한, 불이행 시 조치 예고) / 작성 연월일 / 발신인 (인) 순서로 격식 있는 문어체로 작성하세요.`,
};

export const generateLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        inputText: z.string().min(10).max(8000),
        analysis: analysisResultSchema,
        docType: z.enum(["criminal_report", "civil_report", "criminal_complaint", "civil_complaint", "content_cert"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    assertAllowed(context.claims);

    const system = `당신은 15년 이상 경력의 대한민국 법률전문가입니다. 아래 사안과 사전 분석 결과를 토대로 회사 내부 검토 및 제출용 문서를 작성합니다.
격식 있는 문어체를 사용하고 반말을 쓰지 마세요. 결과는 문서 본문 텍스트만 출력하고, 그 외의 설명·인사말·코드펜스는 포함하지 마세요.

${DOC_INSTRUCTIONS[data.docType]}`;

    const content = await callClaude(
      system,
      [
        {
          role: "user",
          content: `[검토 요청 사안 원문]\n${data.inputText}\n\n[사전 분석 결과(JSON)]\n${JSON.stringify(data.analysis, null, 2)}`,
        },
      ],
      4096,
    );
    return { content };
  });
