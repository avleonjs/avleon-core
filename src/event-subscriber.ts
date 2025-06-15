import { Container, Service } from "typedi";
import { Socket, Server } from "socket.io";
import { SocketContextService } from "./event-dispatcher";
import "reflect-metadata";

const PRIVATE_META_KEY = "avleon:private";

export function Private(channelResolver?: (socket: any) => string) {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata(PRIVATE_META_KEY, true, target, propertyKey);
    Reflect.defineMetadata(
      `private:channel:${propertyKey}`,
      channelResolver,
      target,
    );
  };
}

export function isPrivate(target: any, propertyKey: string): boolean {
  return Reflect.getMetadata(PRIVATE_META_KEY, target, propertyKey) || false;
}

export function getPrivateChannelResolver(
  target: any,
  propertyKey: string,
): ((socket: any) => string) | undefined {
  return Reflect.getMetadata(`private:channel:${propertyKey}`, target);
}

const socketSubscriberClasses = new Set<Function>();

export function registerSocketSubscriber(target: Function) {
  socketSubscriberClasses.add(target);
}

export function getSocketSubscribers(): Function[] {
  return Array.from(socketSubscriberClasses);
}

export function Subscribe(event: string): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata("socket:event", event, target, propertyKey);
    registerSocketSubscriber(target.constructor);
  };
}

@Service()
export class EventSubscriberRegistry {
  constructor(private readonly socketContext: SocketContextService) {}

  register(socket: Socket) {
    const subscriberClasses = getSocketSubscribers();

    for (const SubscriberClass of subscriberClasses) {
      const instance: any = Container.get(SubscriberClass);
      const prototype = Object.getPrototypeOf(instance);

      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) => typeof prototype[name] === "function",
      );

      for (const methodName of methodNames) {
        const event = Reflect.getMetadata(
          "socket:event",
          prototype,
          methodName,
        );
        const isPrivateListener = isPrivate(instance, methodName);
        const channelResolver = getPrivateChannelResolver(instance, methodName);

        if (event) {
          const channel =
            isPrivateListener && channelResolver
              ? channelResolver(socket)
              : event;
          console.log("Channel", channel);
          socket.on(channel, (payload: any) => {
            this.socketContext.run(socket, async () => {
              if (isPrivateListener) {
                const user = socket.data.user;
                if (!user) return; // unauthorized
                // optionally add more validation here
              }
              await instance[methodName](payload, socket.data);
            });
          });
        }
      }
    }
  }
}
