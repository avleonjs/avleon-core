"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvleonConfig = void 0;
exports.AppConfig = AppConfig;
exports.GetConfig = GetConfig;
exports.CreateConfig = CreateConfig;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const typedi_1 = require("typedi");
const environment_variables_1 = require("./environment-variables");
const helpers_1 = require("./helpers");
function AppConfig(target) {
    typedi_1.Container.set({ id: target, type: target });
}
class AvleonConfig {
    get(configClass) {
        const instance = typedi_1.Container.get(configClass);
        if (!instance) {
            throw new Error(`Configuration for ${configClass.name} not found.`);
        }
        return instance.config(new environment_variables_1.Environment());
    }
}
exports.AvleonConfig = AvleonConfig;
// Implementation
function GetConfig(token) {
    // 1. Class‐based: token.prototype.config is a function
    if (typeof token === "function" &&
        token.prototype != null &&
        typeof token.prototype.config === "function") {
        const instance = typedi_1.Container.get(token);
        if (!instance) {
            throw new Error(`Class "${token.name}" is not registered as a config.`);
        }
        return instance.config((0, helpers_1.inject)(environment_variables_1.Environment));
    }
    // 2. Functional: token is the callback itself
    const stored = typedi_1.Container.get(token);
    if (!stored) {
        throw new Error("Config object is not registered.");
    }
    return stored;
}
function CreateConfig(token, callback) {
    let env;
    try {
        env = typedi_1.Container.get(environment_variables_1.Environment);
    }
    catch (error) {
        env = new environment_variables_1.Environment();
    }
    let config = callback(env);
    typedi_1.Container.set(token, config);
}
