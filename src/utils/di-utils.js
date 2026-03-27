"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = inject;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const container_1 = __importDefault(require("../container"));
const system_exception_1 = require("../exceptions/system-exception");
function inject(cls) {
    try {
        return container_1.default.get(cls);
    }
    catch (error) {
        throw new system_exception_1.SystemUseError("Not a project class. Maybe you wanna register it first.");
    }
}
