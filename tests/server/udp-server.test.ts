import assert from "node:assert/strict";
import { createSocket } from "node:dgram";
import test from "node:test";

import { createUdpServer } from "../../src/server/udp-server.js";

test("transmet le datagramme au handler et renvoie sa réponse au client", async () => {
  const receivedPayloads: Buffer[] = [];
  const server = createUdpServer(
    { host: "127.0.0.1", port: 0 },
    async ({ payload, remote }) => {
      receivedPayloads.push(Buffer.from(payload));
      assert.equal(remote.address, "127.0.0.1");
      assert.ok(remote.port > 0);
      assert.equal(remote.family, "IPv4");
      return Buffer.from("pong");
    },
  );

  const address = await server.start();

  try {
    const response = await sendAndReceive(
      Buffer.from("ping"),
      address.address,
      address.port,
    );

    assert.deepEqual(receivedPayloads, [Buffer.from("ping")]);
    assert.deepEqual(response, Buffer.from("pong"));
  } finally {
    await server.close();
  }
});

test("ne répond pas lorsque le handler retourne undefined", async () => {
  const server = createUdpServer(
    { host: "127.0.0.1", port: 0 },
    async () => undefined,
  );

  const address = await server.start();

  try {
    const response = await sendAndWait(
      Buffer.from("ignore me"),
      address.address,
      address.port,
      100,
    );

    assert.equal(response, undefined);
  } finally {
    await server.close();
  }
});

test("rapporte une exception du handler sans l'envoyer au client", async () => {
  const errors: Error[] = [];
  const server = createUdpServer(
    { host: "127.0.0.1", port: 0 },
    async () => {
      throw new Error("handler failed");
    },
    { onError: (error) => errors.push(error) },
  );

  const address = await server.start();

  try {
    const response = await sendAndWait(
      Buffer.from("request"),
      address.address,
      address.port,
      100,
    );

    assert.equal(response, undefined);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.message, "handler failed");
  } finally {
    await server.close();
  }
});

test("rejette le démarrage quand le port est déjà utilisé", async () => {
  const firstServer = createUdpServer(
    { host: "127.0.0.1", port: 0 },
    async () => undefined,
  );
  const firstAddress = await firstServer.start();
  const secondServer = createUdpServer(
    { host: "127.0.0.1", port: firstAddress.port },
    async () => undefined,
  );

  try {
    await assert.rejects(secondServer.start(), { code: "EADDRINUSE" });
  } finally {
    await secondServer.close();
    await firstServer.close();
  }
});

function sendAndReceive(
  payload: Buffer,
  host: string,
  port: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = createSocket("udp4");
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error("Timed out while waiting for a UDP response."));
    }, 1_000);

    client.once("error", (error) => {
      clearTimeout(timeout);
      client.close();
      reject(error);
    });
    client.once("message", (response) => {
      clearTimeout(timeout);
      client.close();
      resolve(Buffer.from(response));
    });
    client.send(payload, port, host, (error) => {
      if (error !== null) {
        clearTimeout(timeout);
        client.close();
        reject(error);
      }
    });
  });
}

function sendAndWait(
  payload: Buffer,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const client = createSocket("udp4");
    const timeout = setTimeout(() => {
      client.close();
      resolve(undefined);
    }, timeoutMs);

    client.once("error", (error) => {
      clearTimeout(timeout);
      client.close();
      reject(error);
    });
    client.once("message", (response) => {
      clearTimeout(timeout);
      client.close();
      resolve(Buffer.from(response));
    });
    client.send(payload, port, host, (error) => {
      if (error !== null) {
        clearTimeout(timeout);
        client.close();
        reject(error);
      }
    });
  });
}
