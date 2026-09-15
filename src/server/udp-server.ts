import { createSocket } from "node:dgram";

import type { RemoteInfo, Socket } from "node:dgram";
import type { AddressInfo } from "node:net";

import type { ServerConfig } from "../config/server-config.js";

export type RemoteEndpoint = {
  address: string;
  port: number;
  family: string;
};

export type Datagram = {
  payload: Buffer;
  remote: RemoteEndpoint;
};

export type DatagramHandler = (
  datagram: Datagram,
) => Buffer | undefined | Promise<Buffer | undefined>;

export type BoundAddress = {
  address: string;
  port: number;
  family: string;
};

export type UdpServer = {
  start(): Promise<BoundAddress>;
  close(): Promise<void>;
};

export type UdpServerOptions = {
  onError?: (error: Error) => void;
};

export function createUdpServer(
  config: ServerConfig,
  handleDatagram: DatagramHandler,
  options: UdpServerOptions = {},
): UdpServer {
  const onError =
    options.onError ??
    ((error: Error) => console.error("UDP server error:", error));
  let socket: Socket | undefined;
  let listening = false;

  return {
    start,
    close,
  };

  function start(): Promise<BoundAddress> {
    if (socket !== undefined) {
      return Promise.reject(new Error("The UDP server has already been started."));
    }

    const createdSocket = createSocket("udp4");
    socket = createdSocket;

    createdSocket.on("message", (payload, remote) => {
      void processDatagram(createdSocket, payload, remote);
    });

    return new Promise((resolve, reject) => {
      const handleStartError = (error: Error): void => {
        createdSocket.off("listening", handleListening);
        socket = undefined;
        reject(error);
      };

      const handleListening = (): void => {
        createdSocket.off("error", handleStartError);
        createdSocket.on("error", onError);
        listening = true;
        resolve(toBoundAddress(createdSocket.address()));
      };

      createdSocket.once("error", handleStartError);
      createdSocket.once("listening", handleListening);

      try {
        createdSocket.bind(config.port, config.host);
      } catch (cause) {
        createdSocket.off("error", handleStartError);
        createdSocket.off("listening", handleListening);
        socket = undefined;
        reject(toError(cause));
      }
    });
  }

  function close(): Promise<void> {
    if (socket === undefined || !listening) {
      return Promise.resolve();
    }

    const currentSocket = socket;

    return new Promise((resolve) => {
      currentSocket.close(() => {
        listening = false;
        socket = undefined;
        resolve();
      });
    });
  }

  async function processDatagram(
    currentSocket: Socket,
    payload: Buffer,
    remote: RemoteInfo,
  ): Promise<void> {
    try {
      const response = await handleDatagram({
        payload,
        remote: {
          address: remote.address,
          port: remote.port,
          family: remote.family,
        },
      });

      if (response === undefined) {
        return;
      }

      currentSocket.send(
        response,
        remote.port,
        remote.address,
        (error) => {
          if (error !== null) {
            onError(error);
          }
        },
      );
    } catch (cause) {
      onError(toError(cause));
    }
  }
}

function toBoundAddress(address: AddressInfo | string): BoundAddress {
  if (typeof address === "string") {
    throw new Error("Expected the UDP socket to use an IP address.");
  }

  return {
    address: address.address,
    port: address.port,
    family: address.family,
  };
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}
