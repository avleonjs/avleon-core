"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
exports.validateOrThrow = validateOrThrow;
const exceptions_1 = require("./exceptions");
class PValidationRule {
    name;
    type;
    message;
    constructor(name, type, message) {
        this.name = name;
        this.type = type;
        this.message = message;
    }
}
class Validator {
    rules = [];
    options = {};
    constructor(obj, options) {
        this.init(obj);
        if (options) {
            this.options = options;
        }
    }
    init(obj) {
        Object.keys(obj).forEach((key) => {
            const rule = obj[key];
            this.rules.push(new PValidationRule(key, rule.type, rule.message));
        });
    }
    validate(obj, options) {
        const erors = [];
        this.rules.forEach((k) => {
            const r = Object.keys(obj).find((key) => key == k.name);
            let messages = [];
            if (!r || obj[r] == undefined || obj[r] == "") {
                messages.push({
                    constraint: "required",
                    message: k.name + " is required",
                });
            }
            if (k.type == "string" && typeof obj[k.name] != "string") {
                messages.push({
                    constraint: "type",
                    message: `${k.name} must be type ${k.type}`,
                });
            }
            if (k.type == "number" && !parseInt(obj[k.name])) {
                messages.push({
                    constraint: "type",
                    message: `${k.name} must be type ${k.type}`,
                });
            }
            if (k.type == "number") {
                obj[k.name] = parseInt(obj[k.name]);
            }
            if (k.type == "boolean" && !isBool(obj[k.name])) {
                messages.push({
                    constraint: "type",
                    message: `${k.name} must be type ${k.type}`,
                });
            }
            if (k.type == "boolean") {
                obj[k.name] = parseBoolean(obj[k.name]);
            }
            if (messages.length > 0) {
                erors.push({
                    path: k.name,
                    ...(this.options.location ? { location: this.options.location } : {}),
                    constraints: messages,
                });
            }
        });
        return [erors, obj];
    }
}
exports.Validator = Validator;
const isBool = (val) => {
    if (typeof val == "boolean")
        return true;
    if (parseInt(val) == 0 || parseInt(val) == 1)
        return true;
    if (val == "true" || val == "false")
        return true;
    return false;
};
const parseBoolean = (val) => {
    if (typeof val === "boolean")
        return val;
    if (parseInt(val) == 1)
        return true;
    if (typeof val === "string") {
        const normalized = val.trim().toLowerCase();
        return normalized === "true";
    }
    return false;
};
function validateOrThrow(obj, rules, options) {
    const valid = new Validator(rules, options);
    const errors = valid.validate(obj);
    if (errors[0].length > 0) {
        throw new exceptions_1.BadRequestException(errors[0]);
    }
    return errors[1];
}
