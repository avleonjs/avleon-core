"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Helper = exports.Utility = void 0;
exports.AppService = AppService;
const typedi_1 = require("typedi");
function AppService(target) {
    if (target) {
        (0, typedi_1.Service)()(target);
    }
    else {
        return function (tg) {
            (0, typedi_1.Service)()(tg);
        };
    }
}
__exportStar(require("./controller"), exports);
__exportStar(require("./route-methods"), exports);
__exportStar(require("./openapi"), exports);
exports.Utility = typedi_1.Service;
exports.Helper = typedi_1.Service;
__exportStar(require("./params"), exports);
