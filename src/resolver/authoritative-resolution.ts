import type { DnsQuestion } from "../dns/decode-question.js";

export type ARecord = {
  readonly address: string;
  readonly ttl: number;
};

export type ZoneNode = {
  readonly name: string;
  readonly aRecords: readonly ARecord[];
};

export type AuthoritativeZone = readonly ZoneNode[];

export type AuthoritativeResolution =
  | { kind: "answer"; records: readonly [ARecord, ...ARecord[]] }
  | { kind: "nodata" }
  | { kind: "nxdomain" }
  | { kind: "refused"; reason: "UNSUPPORTED_CLASS" };

const A_RECORD_TYPE = 1;
const INTERNET_CLASS = 1;

export function resolveAuthoritativeQuestion(
  zone: AuthoritativeZone,
  question: DnsQuestion,
): AuthoritativeResolution {
  if (question.class !== INTERNET_CLASS) {
    return { kind: "refused", reason: "UNSUPPORTED_CLASS" };
  }

  const normalizedQuestionName = normalizeDomainName(question.name);
  const zoneNode = zone.find(
    ({ name }) => normalizeDomainName(name) === normalizedQuestionName,
  );

  if (zoneNode === undefined) {
    return { kind: "nxdomain" };
  }

  const firstRecord = zoneNode.aRecords[0];
  const hasRequestedRecords =
    question.type === A_RECORD_TYPE && firstRecord !== undefined;

  if (!hasRequestedRecords) {
    return { kind: "nodata" };
  }

  return {
    kind: "answer",
    records: [firstRecord, ...zoneNode.aRecords.slice(1)],
  };
}

function normalizeDomainName(name: string): string {
  const nameWithoutFinalDot = name.endsWith(".") ? name.slice(0, -1) : name;
  return nameWithoutFinalDot.toLowerCase();
}
