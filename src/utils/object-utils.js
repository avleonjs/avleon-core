"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pick = pick;
exports.exclude = exclude;
exports.autoCast = autoCast;
exports.normalizeQueryDeep = normalizeQueryDeep;
exports.transformObjectByInstanceToObject = transformObjectByInstanceToObject;
exports.jsonToJs = jsonToJs;
exports.jsonToInstance = jsonToInstance;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const class_transformer_1 = require("class-transformer");
function pick(obj, paths) {
    const result = {};
    for (const path of paths) {
        const keys = path.split(".");
        let source = obj;
        let target = result;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (!(key in source))
                break;
            if (i === keys.length - 1) {
                target[key] = source[key];
            }
            else {
                source = source[key];
                target[key] = target[key] || {};
                target = target[key];
            }
        }
    }
    return result;
}
function exclude(obj, paths) {
    if (Array.isArray(obj)) {
        return obj.map((item) => exclude(item, paths));
    }
    const clone = structuredClone(obj); // Or use lodash.cloneDeep
    for (const path of paths) {
        const keys = path.split(".");
        let target = clone;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in target))
                break;
            target = target[keys[i]];
        }
        delete target?.[keys[keys.length - 1]];
    }
    return clone;
}
function autoCast(value, typeHint, schema) {
    if (value === null || value === undefined)
        return value;
    if (Array.isArray(value)) {
        const elementType = Array.isArray(typeHint) ? typeHint[0] : undefined;
        return value.map((v) => autoCast(v, elementType));
    }
    if (typeof value === "object" && !(value instanceof Date)) {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            let fieldType = undefined;
            if (schema?.properties?.[key]?.type) {
                const t = schema.properties[key].type;
                fieldType =
                    t === "integer" || t === "number"
                        ? Number
                        : t === "boolean"
                            ? Boolean
                            : t === "array"
                                ? Array
                                : t === "object"
                                    ? Object
                                    : String;
            }
            result[key] = autoCast(val, fieldType);
        }
        return result;
    }
    if (typeof value !== "string")
        return value;
    const trimmed = value.trim();
    if (typeHint === Boolean || trimmed.toLowerCase() === "true")
        return true;
    if (trimmed.toLowerCase() === "false")
        return false;
    if (typeHint === Number || (!isNaN(Number(trimmed)) && trimmed !== "")) {
        const n = Number(trimmed);
        if (!isNaN(n))
            return n;
    }
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
            const parsed = JSON.parse(trimmed);
            return autoCast(parsed, typeHint, schema);
        }
        catch {
            return trimmed;
        }
    }
    if (typeHint === Date ||
        /^\d{4}-\d{2}-\d{2}([Tt]\d{2}:\d{2})?/.test(trimmed)) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime()))
            return d;
    }
    return trimmed;
}
/**
 * Deeply normalizes query strings into nested JS objects.
 */
function normalizeQueryDeep(query) {
    const result = {};
    const setDeep = (obj, path, value) => {
        let current = obj;
        for (let i = 0; i < path.length; i++) {
            const key = path[i];
            const nextKey = path[i + 1];
            if (i === path.length - 1) {
                if (key === "") {
                    if (!Array.isArray(current))
                        current = [];
                    current.push(value);
                }
                else if (Array.isArray(current[key])) {
                    current[key].push(value);
                }
                else if (current[key] !== undefined) {
                    current[key] = [current[key], value];
                }
                else {
                    current[key] = value;
                }
            }
            else {
                if (!current[key]) {
                    current[key] = nextKey === "" || /^\d+$/.test(nextKey) ? [] : {};
                }
                current = current[key];
            }
        }
    };
    for (const [rawKey, rawValue] of Object.entries(query)) {
        const path = [];
        const regex = /([^\[\]]+)|(\[\])/g;
        let match;
        while ((match = regex.exec(rawKey)) !== null) {
            if (match[1])
                path.push(match[1]);
            else if (match[2])
                path.push("");
        }
        if (path.length === 0) {
            if (result[rawKey]) {
                if (Array.isArray(result[rawKey]))
                    result[rawKey].push(rawValue);
                else
                    result[rawKey] = [result[rawKey], rawValue];
            }
            else {
                result[rawKey] = rawValue;
            }
        }
        else {
            setDeep(result, path, rawValue);
        }
    }
    return result;
}
function transformObjectByInstanceToObject(instance, value) {
    return (0, class_transformer_1.instanceToPlain)((0, class_transformer_1.plainToInstance)(instance, value), {
        excludeExtraneousValues: true,
        exposeUnsetFields: true,
    });
}
function jsonToJs(value) {
    try {
        return JSON.parse(value);
    }
    catch (err) {
        return false;
    }
}
function jsonToInstance(value, instance) {
    try {
        const parsedValue = JSON.parse(value);
        return (0, class_transformer_1.plainToInstance)(instance, parsedValue);
    }
    catch (err) {
        return false;
    }
}
