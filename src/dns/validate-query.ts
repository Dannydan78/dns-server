import type { DnsQuery } from "./decode-query.js";
import type { DnsQuestion } from "./decode-question.js";

export type ValidatedQuery = Omit<DnsQuery, "questions"> & {
  questions: [DnsQuestion];
};

export type ValidateQueryResult =
  | { ok: true; query: ValidatedQuery }
  | { ok: false; error: "UNEXPECTED_RESPONSE" }
  | { ok: false; error: "UNSUPPORTED_OPCODE"; opcode: number }
  | { ok: false; error: "RESERVED_Z_BIT_SET" }
  | { ok: false; error: "QUESTION_REQUIRED" }
  | {
      ok: false;
      error: "MULTIPLE_QUESTIONS_NOT_SUPPORTED";
      questionCount: number;
    };

export function validateQuery(query: DnsQuery): ValidateQueryResult {
  if (query.flags.isResponse) {
    return { ok: false, error: "UNEXPECTED_RESPONSE" };
  }

  if (query.flags.opcode !== 0) {
    return {
      ok: false,
      error: "UNSUPPORTED_OPCODE",
      opcode: query.flags.opcode,
    };
  }

  if (query.flags.reservedZ) {
    return { ok: false, error: "RESERVED_Z_BIT_SET" };
  }

  if (query.questions.length === 0) {
    return { ok: false, error: "QUESTION_REQUIRED" };
  }

  if (query.questions.length > 1) {
    return {
      ok: false,
      error: "MULTIPLE_QUESTIONS_NOT_SUPPORTED",
      questionCount: query.questions.length,
    };
  }

  return {
    ok: true,
    query: {
      ...query,
      questions: [query.questions[0]],
    },
  };
}
