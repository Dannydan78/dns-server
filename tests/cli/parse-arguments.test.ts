import assert from "node:assert/strict";
import test from "node:test";

import { parseArguments } from "../../src/cli/parse-arguments.js";

test("utilise une configuration locale sûre sans argument", () => {
  assert.deepEqual(parseArguments([]), {
    kind: "start",
    config: {
      host: "127.0.0.1",
      port: 5353,
    },
  });
});

test("utilise l'adresse et le port fournis par l'utilisateur", () => {
  assert.deepEqual(
    parseArguments(["--host", "0.0.0.0", "--port", "8053"]),
    {
      kind: "start",
      config: {
        host: "0.0.0.0",
        port: 8053,
      },
    },
  );
});

test("refuse un port qui n'est pas un nombre entier", () => {
  assert.deepEqual(parseArguments(["--port", "abc"]), {
    kind: "error",
    message: "The port must be an integer between 1 and 65535.",
  });
});

test("refuse un port hors de l'intervalle 1 à 65535", () => {
  assert.deepEqual(parseArguments(["--port", "70000"]), {
    kind: "error",
    message: "The port must be an integer between 1 and 65535.",
  });
});

test("refuse une option sans valeur", () => {
  assert.deepEqual(parseArguments(["--host"]), {
    kind: "error",
    message: "Option '--host <value>' argument missing",
  });
});

test("ne prend pas une option suivante pour une valeur", () => {
  assert.deepEqual(parseArguments(["--host", "--port", "8053"]), {
    kind: "error",
    message:
      "Option '--host' argument is ambiguous.\n" +
      "Did you forget to specify the option argument for '--host'?\n" +
      "To specify an option argument starting with a dash use '--host=-XYZ'.",
  });
});

test("utilise la dernière valeur d'une option répétée", () => {
  assert.deepEqual(
    parseArguments(["--port", "5353", "--port", "8053"]),
    {
      kind: "start",
      config: {
        host: "127.0.0.1",
        port: 8053,
      },
    },
  );
});

test("reconnaît la demande d'aide", () => {
  assert.deepEqual(parseArguments(["--help"]), { kind: "help" });
});

test("refuse une adresse d'écoute vide", () => {
  assert.deepEqual(parseArguments(["--host", ""]), {
    kind: "error",
    message: "The listening address cannot be empty.",
  });
});

test("refuse une option inconnue", () => {
  assert.deepEqual(parseArguments(["--unknown"]), {
    kind: "error",
    message: "Unknown option '--unknown'",
  });
});
