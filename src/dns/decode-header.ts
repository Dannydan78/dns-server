export const DNS_HEADER_LENGTH = 12;

export type DnsHeader = {
  id: number;
  flags: number;
  questionCount: number;
  answerCount: number;
  authorityCount: number;
  additionalCount: number;
};

export type DecodeHeaderResult =
  | { ok: true; header: DnsHeader }
  | {
      ok: false;
      error: "HEADER_TOO_SHORT";
      expectedBytes: number;
      actualBytes: number;
    };

export function decodeHeader(payload: Buffer): DecodeHeaderResult {
  if (payload.length < DNS_HEADER_LENGTH) {
    return {
      ok: false,
      error: "HEADER_TOO_SHORT",
      expectedBytes: DNS_HEADER_LENGTH,
      actualBytes: payload.length,
    };
  }

  return {
    ok: true,
    header: {
      id: payload.readUInt16BE(0),
      flags: payload.readUInt16BE(2),
      questionCount: payload.readUInt16BE(4),
      answerCount: payload.readUInt16BE(6),
      authorityCount: payload.readUInt16BE(8),
      additionalCount: payload.readUInt16BE(10),
    },
  };
}
