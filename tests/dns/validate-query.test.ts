import assert from "node:assert/strict";
import test from "node:test";

import { decodeFlags } from "../../src/dns/decode-flags.js";
import { validateQuery } from "../../src/dns/validate-query.js";

import type { DnsQuery } from "../../src/dns/decode-query.js";

test("accepte une requête standard contenant exactement une question", () => {
  const query = createQuery();

  assert.deepEqual(validateQuery(query), {
    ok: true,
    query,
  });
});

test("refuse une réponse DNS valide reçue à la place d'une requête", () => {
  assert.deepEqual(validateQuery(createQuery(0x8000)), {
    ok: false,
    error: "UNEXPECTED_RESPONSE",
  });
});

test("refuse un opcode que le serveur n'implémente pas", () => {
  assert.deepEqual(validateQuery(createQuery(0x0800)), {
    ok: false,
    error: "UNSUPPORTED_OPCODE",
    opcode: 1,
  });
});

test("refuse le bit Z réellement réservé", () => {
  assert.deepEqual(validateQuery(createQuery(0x0040)), {
    ok: false,
    error: "RESERVED_Z_BIT_SET",
  });
});

test("ne confond pas les bits DNSSEC AD et CD avec le bit réservé", () => {
  assert.equal(validateQuery(createQuery(0x0030)).ok, true);
});

test("exige exactement une question pour cette première version", () => {
  const withoutQuestion = createQuery();
  withoutQuestion.questions = [];

  assert.deepEqual(validateQuery(withoutQuestion), {
    ok: false,
    error: "QUESTION_REQUIRED",
  });

  const withTwoQuestions = createQuery();
  withTwoQuestions.questions.push({ name: "example.org", type: 1, class: 1 });

  assert.deepEqual(validateQuery(withTwoQuestions), {
    ok: false,
    error: "MULTIPLE_QUESTIONS_NOT_SUPPORTED",
    questionCount: 2,
  });
});

function createQuery(flags = 0): DnsQuery {
  return {
    header: {
      id: 0x1234,
      flags,
      questionCount: 1,
      answerCount: 0,
      authorityCount: 0,
      additionalCount: 0,
    },
    flags: decodeFlags(flags),
    questions: [{ name: "example.com", type: 1, class: 1 }],
  };
}
