import assert from "node:assert/strict";
import test from "node:test";

import { decodeQuery } from "../../src/dns/decode-query.js";

test("assemble l'en-tête, les flags et les questions d'une requête", () => {
  const payload = createQuery([
    encodeQuestion("example.com", 1, 1),
    encodeQuestion("example.com", 28, 1),
  ]);

  const result = decodeQuery(payload);

  assert.equal(result.ok, true);

  if (!result.ok) {
    return;
  }

  assert.equal(result.query.header.id, 0x1234);
  assert.equal(result.query.header.questionCount, 2);
  assert.equal(result.query.flags.isResponse, false);
  assert.equal(result.query.flags.recursionDesired, true);
  assert.deepEqual(result.query.questions, [
    { name: "example.com", type: 1, class: 1 },
    { name: "example.com", type: 28, class: 1 },
  ]);
  assert.equal(result.bytesRead, payload.length);
});

test("rejette le message entier lorsque la deuxième question est absente", () => {
  const payload = createQuery([encodeQuestion("example.com", 1, 1)], 2);

  assert.deepEqual(decodeQuery(payload), {
    ok: false,
    error: "INVALID_QUESTION",
    questionIndex: 1,
    cause: {
      error: "NAME_TERMINATOR_MISSING",
      offset: payload.length,
    },
  });
});

test("rejette immédiatement un nombre de questions impossible", () => {
  const payload = createQuery([encodeQuestion("example.com", 1, 1)], 4);

  assert.deepEqual(decodeQuery(payload), {
    ok: false,
    error: "QUESTION_COUNT_EXCEEDS_PAYLOAD",
    questionCount: 4,
    minimumBytes: 20,
    actualBytes: payload.length - 12,
  });
});

test("indique l'index de la question invalide sans retourner de résultat partiel", () => {
  const firstQuestion = encodeQuestion("example.com", 1, 1);
  const invalidQuestion = Buffer.from([
    0x07,
    ...Buffer.from("example"),
    0x03,
    ...Buffer.from("com"),
    0x00,
    0x00,
    0x01,
  ]);
  const payload = createQuery([firstQuestion, invalidQuestion]);

  assert.deepEqual(decodeQuery(payload), {
    ok: false,
    error: "INVALID_QUESTION",
    questionIndex: 1,
    cause: {
      error: "QUESTION_FIELDS_TOO_SHORT",
      offset: payload.length - 2,
      expectedBytes: 4,
      actualBytes: 2,
    },
  });
});

test("propage une erreur d'en-tête sans tenter de lire les questions", () => {
  assert.deepEqual(decodeQuery(Buffer.alloc(8)), {
    ok: false,
    error: "HEADER_TOO_SHORT",
    expectedBytes: 12,
    actualBytes: 8,
  });
});

function createQuery(
  questions: readonly Buffer[],
  declaredQuestionCount = questions.length,
): Buffer {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x1234, 0);
  header.writeUInt16BE(0x0100, 2);
  header.writeUInt16BE(declaredQuestionCount, 4);

  return Buffer.concat([header, ...questions]);
}

function encodeQuestion(name: string, type: number, dnsClass: number): Buffer {
  const labels = name.split(".");
  const encodedLabels = labels.map((label) => {
    const value = Buffer.from(label);
    return Buffer.concat([Buffer.from([value.length]), value]);
  });
  const fields = Buffer.alloc(5);
  fields.writeUInt16BE(type, 1);
  fields.writeUInt16BE(dnsClass, 3);

  return Buffer.concat([...encodedLabels, fields]);
}
