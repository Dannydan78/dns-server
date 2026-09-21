import { decodeFlags } from "./decode-flags.js";
import { DNS_HEADER_LENGTH, decodeHeader } from "./decode-header.js";
import { decodeQuestion } from "./decode-question.js";

import type { DnsFlags } from "./decode-flags.js";
import type { DnsHeader } from "./decode-header.js";
import type {
  DecodeQuestionError,
  DnsQuestion,
} from "./decode-question.js";

export type DnsQuery = {
  header: DnsHeader;
  flags: DnsFlags;
  questions: DnsQuestion[];
};

export type DecodeQueryResult =
  | {
      ok: true;
      query: DnsQuery;
      bytesRead: number;
    }
  | {
      ok: false;
      error: "HEADER_TOO_SHORT";
      expectedBytes: number;
      actualBytes: number;
    }
  | {
      ok: false;
      error: "QUESTION_COUNT_EXCEEDS_PAYLOAD";
      questionCount: number;
      minimumBytes: number;
      actualBytes: number;
    }
  | {
      ok: false;
      error: "INVALID_QUESTION";
      questionIndex: number;
      cause: DecodeQuestionError;
    };

const MINIMUM_QUESTION_LENGTH = 5;

export function decodeQuery(payload: Buffer): DecodeQueryResult {
  const headerResult = decodeHeader(payload);

  if (!headerResult.ok) {
    return headerResult;
  }

  const { header } = headerResult;
  const questionBytes = payload.length - DNS_HEADER_LENGTH;
  const minimumQuestionBytes = header.questionCount * MINIMUM_QUESTION_LENGTH;

  if (questionBytes < minimumQuestionBytes) {
    return {
      ok: false,
      error: "QUESTION_COUNT_EXCEEDS_PAYLOAD",
      questionCount: header.questionCount,
      minimumBytes: minimumQuestionBytes,
      actualBytes: questionBytes,
    };
  }

  const questions: DnsQuestion[] = [];
  let offset = DNS_HEADER_LENGTH;

  for (let questionIndex = 0; questionIndex < header.questionCount; questionIndex += 1) {
    const questionResult = decodeQuestion(payload, offset);

    if (!questionResult.ok) {
      const { ok: _, ...cause } = questionResult;

      return {
        ok: false,
        error: "INVALID_QUESTION",
        questionIndex,
        cause,
      };
    }

    questions.push(questionResult.question);
    offset += questionResult.bytesRead;
  }

  return {
    ok: true,
    query: {
      header,
      flags: decodeFlags(header.flags),
      questions,
    },
    bytesRead: offset,
  };
}
