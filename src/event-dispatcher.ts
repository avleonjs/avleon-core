import { Service, Container } from "typedi";
import { Server as SocketIOServer, Socket, ServerOptions } from "socket.io";
import { AsyncLocalStorage } from "node:async_hooks";


@Service()
export class SocketContextService {
  private readonly storage = new AsyncLocalStorage<{ socket: Socket }>();

  run(socket: Socket, fn: () => void | Promise<void>) {
    this.storage.run({ socket }, fn);
  }

  getSocket(): Socket | undefined {
    return this.storage.getStore()?.socket;
  }
}

export type DispatchOptions = {
  room?: string;
  broadcast?: boolean;
  transports?: ("socket" | "kafka" | "rabbitmq")[];
  retry?: number;
  retryDelay?: number;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Service()
export class EventDispatcher {
  constructor(private readonly _context: SocketContextService) {}

  async dispatch<T = any>(
    event: string,
    data: T,
    options: DispatchOptions = {}
  ) {
    const retryCount = options.retry ?? 0;
    const delay = options.retryDelay ?? 300;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        await this.dispatchToTransports(event, data, options);
        break;
      } catch (err) {
        if (attempt === retryCount) throw err;
        await sleep(delay * (attempt + 1));
      }
    }
  }

  private async dispatchToTransports(event: string, data: any, options: DispatchOptions) {
    const transports = options.transports ?? ["socket"];

    for (const transport of transports) {
      if (transport === "socket") {
        const io = Container.get(SocketIOServer);

        //console.log('SOckert', Container.get(SocketContextService));

        const context = Container.get(SocketContextService);
        const socket = context.getSocket();

      

        if (options.broadcast && socket) {
          if (options.room) {
            socket.broadcast.to(options.room).emit(event, data);
          } else {
            socket.broadcast.emit(event, data);
          }
        } else {
          if (options.room) {
            io.to(options.room).emit(event, data);
          } else {
            io.emit(event, data);
          }
        }
      }
    }
  }
}


export function Dispatch(event: string, options?: Omit<DispatchOptions, "transports"> & { transports?: DispatchOptions["transports"] }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await original.apply(this, args);

      const dispatcher = Container.get(EventDispatcher);
      await dispatcher.dispatch(event, result, options);

      return result;
    };
  };
}
