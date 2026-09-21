import assert from "node:assert/strict";
import test from "node:test";

import { decodeQuestion } from "../../src/dns/decode-question.js";

test("décode le nom, le type et la classe d'une question", () => {
  const question = Buffer.from([
    0x07,
    ...Buffer.from("example"),
    0x03,
    ...Buffer.from("com"),
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
  ]);
  const payload = Buffer.concat([Buffer.alloc(12), question]);

  assert.deepEqual(decodeQuestion(payload, 12), {
    ok: true,
    question: {
      name: "example.com",
      type: 1,
      class: 1,
    },
    bytesRead: question.length,
  });
});

test("retourne une erreur lorsqu'un label dépasse les octets disponibles", () => {
  const payload = Buffer.from([0x07, 0x66, 0x6f, 0x6f]);

  assert.deepEqual(decodeQuestion(payload, 0), {
    ok: false,
    error: "TRUNCATED_LABEL",
    offset: 0,
    expectedBytes: 7,
    actualBytes: 3,
  });
});

test("retourne une erreur lorsque le nom n'a pas de terminateur", () => {
  const payload = Buffer.from([0x03, ...Buffer.from("com")]);

  assert.deepEqual(decodeQuestion(payload, 0), {
    ok: false,
    error: "NAME_TERMINATOR_MISSING",
    offset: payload.length,
  });
});

test("retourne une erreur lorsque QTYPE et QCLASS sont incomplets", () => {
  const payload = Buffer.from([0x00, 0x00, 0x01]);

  assert.deepEqual(decodeQuestion(payload, 0), {
    ok: false,
    error: "QUESTION_FIELDS_TOO_SHORT",
    offset: 1,
    expectedBytes: 4,
    actualBytes: 2,
  });
});

test("détecte un pointeur de compression sans tenter de le suivre", () => {
  const payload = Buffer.from([0xc0, 0x0c, 0x00, 0x01, 0x00, 0x01]);

  assert.deepEqual(decodeQuestion(payload, 0), {
    ok: false,
    error: "UNSUPPORTED_NAME_COMPRESSION",
    offset: 0,
  });
});

test("refuse les types de labels réservés par le protocole", () => {
  const payload = Buffer.from([0x40]);

  assert.deepEqual(decodeQuestion(payload, 0), {
    ok: false,
    error: "INVALID_LABEL_TYPE",
    offset: 0,
  });
});
