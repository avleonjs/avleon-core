import { PathLike } from "node:fs";
import { Server } from "socket.io";
import { Service, Token } from "typedi";

export const SocketIoServer = new Token<Server>("SocketIoServer");

type FileAdapter = {
  type: "file";
  url?: PathLike;
};

type RedisAdapter = {
  type: "redis";
  url?: string;
  username?: string;
  password?: string;
};

type AdapterType = FileAdapter | RedisAdapter;

interface BrodcastAble {
  channel: string;
  broadstTo: () => void;
}

@Service()
export class AvleonSocketIo {
  private io?: Server;

  sendToAll() { }

  sendOnly() { }

  sendRoom() { }

  receive(channel: string) { }
}
