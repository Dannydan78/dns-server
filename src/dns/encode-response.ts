import type { DnsQuestion } from "./decode-question.js";
import type { ValidatedQuery } from "./validate-query.js";

export type EmptyResponseOptions = {
  responseCode: number;
  authoritativeAnswer?: boolean;
  recursionAvailable?: boolean;
};

export type EncodeResponseResult =
  | { ok: true; payload: Buffer }
  | { ok: false; error: "INVALID_RESPONSE_CODE"; responseCode: number }
  | {
      ok: false;
      error: "LABEL_TOO_LONG";
      label: string;
      actualBytes: number;
      maximumBytes: number;
    }
  | {
      ok: false;
      error: "NAME_TOO_LONG";
      actualBytes: number;
      maximumBytes: number;
    };

const DNS_HEADER_LENGTH = 12;
const MAXIMUM_LABEL_LENGTH = 63;
const MAXIMUM_NAME_LENGTH = 255;

export function encodeEmptyResponse(
  query: ValidatedQuery,
  options: EmptyResponseOptions,
): EncodeResponseResult {
  if (
    !Number.isInteger(options.responseCode) ||
    options.responseCode < 0 ||
    options.responseCode > 15
  ) {
    return {
      ok: false,
      error: "INVALID_RESPONSE_CODE",
      responseCode: options.responseCode,
    };
  }

  const questionResult = encodeQuestion(query.questions[0]);

  if (!questionResult.ok) {
    return questionResult;
  }

  const header = Buffer.alloc(DNS_HEADER_LENGTH);
  header.writeUInt16BE(query.header.id, 0);
  header.writeUInt16BE(buildResponseFlags(query, options), 2);
  header.writeUInt16BE(1, 4);

  return {
    ok: true,
    payload: Buffer.concat([header, questionResult.payload]),
  };
}

function buildResponseFlags(
  query: ValidatedQuery,
  options: EmptyResponseOptions,
): number {
  let flags = 0x8000;

  flags |= query.flags.opcode << 11;

  if (options.authoritativeAnswer === true) {
    flags |= 0x0400;
  }

  if (query.flags.recursionDesired) {
    flags |= 0x0100;
  }

  if (options.recursionAvailable === true) {
    flags |= 0x0080;
  }

  if (query.flags.checkingDisabled) {
    flags |= 0x0010;
  }

  flags |= options.responseCode;

  return flags;
}

function encodeQuestion(
  question: DnsQuestion,
): { ok: true; payload: Buffer } | Exclude<EncodeResponseResult, { ok: true }> {
  const labels = question.name.length === 0 ? [] : question.name.split(".");
  const encodedLabels: Buffer[] = [];
  let encodedNameLength = 1;

  for (const label of labels) {
    const encodedLabel = Buffer.from(label, "ascii");

    if (encodedLabel.length > MAXIMUM_LABEL_LENGTH) {
      return {
        ok: false,
        error: "LABEL_TOO_LONG",
        label,
        actualBytes: encodedLabel.length,
        maximumBytes: MAXIMUM_LABEL_LENGTH,
      };
    }

    encodedNameLength += 1 + encodedLabel.length;

    if (encodedNameLength > MAXIMUM_NAME_LENGTH) {
      return {
        ok: false,
        error: "NAME_TOO_LONG",
        actualBytes: encodedNameLength,
        maximumBytes: MAXIMUM_NAME_LENGTH,
      };
    }

    encodedLabels.push(Buffer.from([encodedLabel.length]), encodedLabel);
  }

  const fields = Buffer.alloc(5);
  fields.writeUInt16BE(question.type, 1);
  fields.writeUInt16BE(question.class, 3);

  return {
    ok: true,
    payload: Buffer.concat([...encodedLabels, fields]),
  };
}
