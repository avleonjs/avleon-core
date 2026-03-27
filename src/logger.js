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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const pino_1 = __importDefault(require("pino"));
const decorators_1 = require("./decorators");
let LoggerService = class LoggerService {
    logger;
    constructor() {
        this.logger = (0, pino_1.default)({
            level: process.env.LOG_LEVEL || "info",
            transport: {
                target: "pino-pretty",
                options: {
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            },
        });
    }
    getLogger() {
        return this.logger;
    }
    info(message, obj) {
        if (obj) {
            this.logger.info(obj, message);
        }
        else {
            this.logger.info(message);
        }
    }
    error(message, obj) {
        if (obj) {
            this.logger.error(obj, message);
        }
        else {
            this.logger.error(message);
        }
    }
    warn(message, obj) {
        if (obj) {
            this.logger.warn(obj, message);
        }
        else {
            this.logger.warn(message);
        }
    }
    debug(message, obj) {
        if (obj) {
            this.logger.debug(obj, message);
        }
        else {
            this.logger.debug(message);
        }
    }
    fatal(message, obj) {
        if (obj) {
            this.logger.fatal(obj, message);
        }
        else {
            this.logger.fatal(message);
        }
    }
    trace(message, obj) {
        if (obj) {
            this.logger.trace(obj, message);
        }
        else {
            this.logger.trace(message);
        }
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    decorators_1.AppService,
    __metadata("design:paramtypes", [])
], LoggerService);
