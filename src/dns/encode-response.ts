import { isIPv4 } from "node:net";

import type { DnsQuestion } from "./decode-question.js";
import type { ValidatedQuery } from "./validate-query.js";

export type EmptyResponseOptions = {
  responseCode: number;
  authoritativeAnswer?: boolean;
  recursionAvailable?: boolean;
};

export type AResponseOptions = {
  records: readonly [AAnswer, ...AAnswer[]];
  authoritativeAnswer?: boolean;
  recursionAvailable?: boolean;
};

export type AAnswer = {
  readonly address: string;
  readonly ttl: number;
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
    }
  | { ok: false; error: "INVALID_IPV4_ADDRESS"; address: string }
  | { ok: false; error: "INVALID_TTL"; ttl: number }
  | {
      ok: false;
      error: "TOO_MANY_ANSWERS";
      answerCount: number;
      maximumAnswers: number;
    };

const DNS_HEADER_LENGTH = 12;
const MAXIMUM_LABEL_LENGTH = 63;
const MAXIMUM_NAME_LENGTH = 255;
const MAXIMUM_SECTION_RECORDS = 65_535;
const OPCODE_SHIFT = 11;

const RESPONSE_FLAG_MASKS = {
  response: 0x8000,
  authoritativeAnswer: 0x0400,
  recursionDesired: 0x0100,
  recursionAvailable: 0x0080,
  checkingDisabled: 0x0010,
} as const satisfies Record<string, number>;

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

  const header = encodeHeader(query, options, 0);

  return {
    ok: true,
    payload: Buffer.concat([header, questionResult.payload]),
  };
}

export function encodeAResponse(
  query: ValidatedQuery,
  options: AResponseOptions,
): EncodeResponseResult {
  if (options.records.length > MAXIMUM_SECTION_RECORDS) {
    return {
      ok: false,
      error: "TOO_MANY_ANSWERS",
      answerCount: options.records.length,
      maximumAnswers: MAXIMUM_SECTION_RECORDS,
    };
  }

  const questionResult = encodeQuestion(query.questions[0]);

  if (!questionResult.ok) {
    return questionResult;
  }

  const answerResults = options.records.map((record) =>
    encodeAResourceRecord(query.questions[0].name, record),
  );
  const invalidAnswer = answerResults.find((result) => !result.ok);

  if (invalidAnswer !== undefined) {
    return invalidAnswer;
  }

  const answerPayloads = answerResults.flatMap((result) =>
    result.ok ? [result.payload] : [],
  );

  const header = encodeHeader(
    query,
    {
      responseCode: 0,
      authoritativeAnswer: options.authoritativeAnswer,
      recursionAvailable: options.recursionAvailable,
    },
    options.records.length,
  );

  return {
    ok: true,
    payload: Buffer.concat([header, questionResult.payload, ...answerPayloads]),
  };
}

function encodeHeader(
  query: ValidatedQuery,
  options: EmptyResponseOptions,
  answerCount: number,
): Buffer {
  const header = Buffer.alloc(DNS_HEADER_LENGTH);
  header.writeUInt16BE(query.header.id, 0);
  header.writeUInt16BE(buildResponseFlags(query, options), 2);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(answerCount, 6);

  return header;
}

function buildResponseFlags(
  query: ValidatedQuery,
  options: EmptyResponseOptions,
): number {
  const { flags } = query;
  const {
    authoritativeAnswer = false,
    recursionAvailable = false,
    responseCode,
  } = options;
  const responseFlagValues = [
    RESPONSE_FLAG_MASKS.response,
    flags.opcode << OPCODE_SHIFT,
    flagMaskWhen(authoritativeAnswer, RESPONSE_FLAG_MASKS.authoritativeAnswer),
    flagMaskWhen(flags.recursionDesired, RESPONSE_FLAG_MASKS.recursionDesired),
    flagMaskWhen(recursionAvailable, RESPONSE_FLAG_MASKS.recursionAvailable),
    flagMaskWhen(flags.checkingDisabled, RESPONSE_FLAG_MASKS.checkingDisabled),
    responseCode,
  ];

  return responseFlagValues.reduce(
    (responseFlags, flagValue) => responseFlags | flagValue,
    0,
  );
}

function flagMaskWhen(condition: boolean, flagMask: number): number {
  return condition ? flagMask : 0;
}

function encodeAResourceRecord(
  name: string,
  { address, ttl }: AAnswer,
): EncodeResponseResult {
  if (!isIPv4(address)) {
    return { ok: false, error: "INVALID_IPV4_ADDRESS", address };
  }

  const isValidTtl =
    Number.isInteger(ttl) && ttl >= 0 && ttl <= 0xffff_ffff;

  if (!isValidTtl) {
    return { ok: false, error: "INVALID_TTL", ttl };
  }

  const nameResult = encodeName(name);

  if (!nameResult.ok) {
    return nameResult;
  }

  const resourceRecordFields = Buffer.alloc(14);
  resourceRecordFields.writeUInt16BE(1, 0);
  resourceRecordFields.writeUInt16BE(1, 2);
  resourceRecordFields.writeUInt32BE(ttl, 4);
  resourceRecordFields.writeUInt16BE(4, 8);

  const addressOctets = address.split(".").map(Number);
  Buffer.from(addressOctets).copy(resourceRecordFields, 10);

  return {
    ok: true,
    payload: Buffer.concat([nameResult.payload, resourceRecordFields]),
  };
}

function encodeQuestion(
  question: DnsQuestion,
): { ok: true; payload: Buffer } | Exclude<EncodeResponseResult, { ok: true }> {
  const nameResult = encodeName(question.name);

  if (!nameResult.ok) {
    return nameResult;
  }

  const fields = Buffer.alloc(4);
  fields.writeUInt16BE(question.type, 0);
  fields.writeUInt16BE(question.class, 2);

  return {
    ok: true,
    payload: Buffer.concat([nameResult.payload, fields]),
  };
}

function encodeName(
  name: string,
): { ok: true; payload: Buffer } | Exclude<EncodeResponseResult, { ok: true }> {
  const labels = name.length === 0 ? [] : name.split(".");
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

  return {
    ok: true,
    payload: Buffer.concat([...encodedLabels, Buffer.from([0])]),
  };
}
