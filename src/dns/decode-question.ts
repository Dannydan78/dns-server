export type DnsQuestion = {
  name: string;
  type: number;
  class: number;
};

export type DecodeQuestionError =
  | {
      error: "NAME_TERMINATOR_MISSING";
      offset: number;
    }
  | {
      error: "TRUNCATED_LABEL";
      offset: number;
      expectedBytes: number;
      actualBytes: number;
    }
  | {
      error: "UNSUPPORTED_NAME_COMPRESSION";
      offset: number;
    }
  | {
      error: "INVALID_LABEL_TYPE";
      offset: number;
    }
  | {
      error: "QUESTION_FIELDS_TOO_SHORT";
      offset: number;
      expectedBytes: number;
      actualBytes: number;
    };

export type DecodeQuestionResult =
  | {
      ok: true;
      question: DnsQuestion;
      bytesRead: number;
    }
  | ({ ok: false } & DecodeQuestionError);

type DecodeNameResult =
  | {
      ok: true;
      name: string;
      bytesRead: number;
    }
  | ({ ok: false } & DecodeQuestionError);

export function decodeQuestion(
  payload: Buffer,
  offset: number,
): DecodeQuestionResult {
  const nameResult = decodeName(payload, offset);

  if (!nameResult.ok) {
    return nameResult;
  }

  const fieldsOffset = offset + nameResult.bytesRead;
  const availableBytes = Math.max(payload.length - fieldsOffset, 0);

  if (availableBytes < 4) {
    return {
      ok: false,
      error: "QUESTION_FIELDS_TOO_SHORT",
      offset: fieldsOffset,
      expectedBytes: 4,
      actualBytes: availableBytes,
    };
  }

  return {
    ok: true,
    question: {
      name: nameResult.name,
      type: payload.readUInt16BE(fieldsOffset),
      class: payload.readUInt16BE(fieldsOffset + 2),
    },
    bytesRead: nameResult.bytesRead + 4,
  };
}

function decodeName(payload: Buffer, offset: number): DecodeNameResult {
  const labels: string[] = [];
  let cursor = offset;

  while (cursor < payload.length) {
    const labelOffset = cursor;
    const labelLength = payload[cursor];

    if (labelLength === undefined) {
      break;
    }

    cursor += 1;

    if (labelLength === 0) {
      return {
        ok: true,
        name: labels.join("."),
        bytesRead: cursor - offset,
      };
    }

    const labelType = labelLength & 0xc0;

    if (labelType === 0xc0) {
      return {
        ok: false,
        error: "UNSUPPORTED_NAME_COMPRESSION",
        offset: labelOffset,
      };
    }

    if (labelType !== 0) {
      return {
        ok: false,
        error: "INVALID_LABEL_TYPE",
        offset: labelOffset,
      };
    }

    const availableBytes = payload.length - cursor;

    if (availableBytes < labelLength) {
      return {
        ok: false,
        error: "TRUNCATED_LABEL",
        offset: labelOffset,
        expectedBytes: labelLength,
        actualBytes: availableBytes,
      };
    }

    labels.push(payload.toString("ascii", cursor, cursor + labelLength));
    cursor += labelLength;
  }

  return {
    ok: false,
    error: "NAME_TERMINATOR_MISSING",
    offset: cursor,
  };
}
