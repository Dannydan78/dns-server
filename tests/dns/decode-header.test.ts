import assert from "node:assert/strict";
import test from "node:test";

import {
  DNS_HEADER_LENGTH,
  decodeHeader,
} from "../../src/dns/decode-header.js";

test("décode les six champs de l'en-tête en big-endian", () => {
  const payload = Buffer.from([
    0x12, 0x34, // ID
    0x01, 0x20, // FLAGS
    0x00, 0x01, // QDCOUNT
    0x00, 0x02, // ANCOUNT
    0x00, 0x03, // NSCOUNT
    0x00, 0x04, // ARCOUNT
  ]);

  assert.deepEqual(decodeHeader(payload), {
    ok: true,
    header: {
      id: 0x1234,
      flags: 0x0120,
      questionCount: 1,
      answerCount: 2,
      authorityCount: 3,
      additionalCount: 4,
    },
  });
});

test("décode seulement l'en-tête lorsque le message contient des sections", () => {
  const payload = Buffer.alloc(DNS_HEADER_LENGTH + 5);
  payload.writeUInt16BE(0xabcd, 0);

  assert.deepEqual(decodeHeader(payload), {
    ok: true,
    header: {
      id: 0xabcd,
      flags: 0,
      questionCount: 0,
      answerCount: 0,
      authorityCount: 0,
      additionalCount: 0,
    },
  });
});

test("retourne une erreur explicite lorsque l'en-tête est trop court", () => {
  assert.deepEqual(decodeHeader(Buffer.alloc(DNS_HEADER_LENGTH - 1)), {
    ok: false,
    error: "HEADER_TOO_SHORT",
    expectedBytes: DNS_HEADER_LENGTH,
    actualBytes: DNS_HEADER_LENGTH - 1,
  });
});
