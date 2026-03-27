"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSubscriberRegistry = void 0;
exports.Private = Private;
exports.isPrivate = isPrivate;
exports.getPrivateChannelResolver = getPrivateChannelResolver;
exports.registerSocketSubscriber = registerSocketSubscriber;
exports.getSocketSubscribers = getSocketSubscribers;
exports.Subscribe = Subscribe;
const typedi_1 = require("typedi");
const event_dispatcher_1 = require("./event-dispatcher");
require("reflect-metadata");
const PRIVATE_META_KEY = "avleon:private";
function Private(channelResolver) {
    return function (target, propertyKey) {
        Reflect.defineMetadata(PRIVATE_META_KEY, true, target, propertyKey);
        Reflect.defineMetadata(`private:channel:${propertyKey}`, channelResolver, target);
    };
}
function isPrivate(target, propertyKey) {
    return Reflect.getMetadata(PRIVATE_META_KEY, target, propertyKey) || false;
}
function getPrivateChannelResolver(target, propertyKey) {
    return Reflect.getMetadata(`private:channel:${propertyKey}`, target);
}
const socketSubscriberClasses = new Set();
function registerSocketSubscriber(target) {
    socketSubscriberClasses.add(target);
}
function getSocketSubscribers() {
    return Array.from(socketSubscriberClasses);
}
function Subscribe(event) {
    return (target, propertyKey) => {
        Reflect.defineMetadata("socket:event", event, target, propertyKey);
        registerSocketSubscriber(target.constructor);
    };
}
let EventSubscriberRegistry = class EventSubscriberRegistry {
    socketContext;
    constructor(socketContext) {
        this.socketContext = socketContext;
    }
    register(socket) {
        const subscriberClasses = getSocketSubscribers();
        for (const SubscriberClass of subscriberClasses) {
            const instance = typedi_1.Container.get(SubscriberClass);
            const prototype = Object.getPrototypeOf(instance);
            const methodNames = Object.getOwnPropertyNames(prototype).filter((name) => typeof prototype[name] === "function");
            for (const methodName of methodNames) {
                const event = Reflect.getMetadata("socket:event", prototype, methodName);
                const isPrivateListener = isPrivate(instance, methodName);
                const channelResolver = getPrivateChannelResolver(instance, methodName);
                if (event) {
                    const channel = isPrivateListener && channelResolver
                        ? channelResolver(socket)
                        : event;
                    console.log("Channel", channel);
                    socket.on(channel, (payload) => {
                        this.socketContext.run(socket, async () => {
                            if (isPrivateListener) {
                                const user = socket.data.user;
                                if (!user)
                                    return; // unauthorized
                                // optionally add more validation here
                            }
                            await instance[methodName](payload, socket.data);
                        });
                    });
                }
            }
        }
    }
};
exports.EventSubscriberRegistry = EventSubscriberRegistry;
exports.EventSubscriberRegistry = EventSubscriberRegistry = __decorate([
    (0, typedi_1.Service)(),
    __metadata("design:paramtypes", [event_dispatcher_1.SocketContextService])
], EventSubscriberRegistry);
