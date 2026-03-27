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
exports.EventDispatcher = exports.SocketContextService = void 0;
exports.Dispatch = Dispatch;
const typedi_1 = require("typedi");
const websocket_1 = require("./websocket");
const node_async_hooks_1 = require("node:async_hooks");
const helpers_1 = require("./helpers");
let SocketContextService = class SocketContextService {
    storage = new node_async_hooks_1.AsyncLocalStorage();
    run(socket, fn) {
        this.storage.run({ socket }, fn);
    }
    getSocket() {
        return this.storage.getStore()?.socket;
    }
};
exports.SocketContextService = SocketContextService;
exports.SocketContextService = SocketContextService = __decorate([
    (0, typedi_1.Service)()
], SocketContextService);
let EventDispatcher = class EventDispatcher {
    _context;
    constructor(_context) {
        this._context = _context;
    }
    async dispatch(event, data, options = {}) {
        const retryCount = options.retry ?? 0;
        const delay = options.retryDelay ?? 300;
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                await this.dispatchToTransports(event, data, options);
                break;
            }
            catch (err) {
                if (attempt === retryCount)
                    throw err;
                await (0, helpers_1.sleep)(delay * (attempt + 1));
            }
        }
    }
    async dispatchToTransports(event, data, options) {
        const transports = options.transports ?? ["socket"];
        for (const transport of transports) {
            if (transport === "socket") {
                const io = typedi_1.Container.get(websocket_1.SocketIoServer);
                const context = typedi_1.Container.get(SocketContextService);
                const socket = context.getSocket();
                if (options.broadcast && socket) {
                    if (options.room) {
                        socket.broadcast.to(options.room).emit(event, data);
                    }
                    else {
                        socket.broadcast.emit(event, data);
                    }
                }
                else {
                    if (options.room) {
                        io.to(options.room).emit(event, data);
                    }
                    else {
                        io.emit(event, data);
                    }
                }
            }
        }
    }
};
exports.EventDispatcher = EventDispatcher;
exports.EventDispatcher = EventDispatcher = __decorate([
    (0, typedi_1.Service)(),
    __metadata("design:paramtypes", [SocketContextService])
], EventDispatcher);
function Dispatch(event, options) {
    return function (target, propertyKey, descriptor) {
        const original = descriptor.value;
        descriptor.value = async function (...args) {
            const result = await original.apply(this, args);
            const dispatcher = typedi_1.Container.get(EventDispatcher);
            await dispatcher.dispatch(event, result, options);
            return result;
        };
    };
}
