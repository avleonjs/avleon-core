"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isClassValidatorClass = exports.isClassValidator = void 0;
exports.getDataType = getDataType;
exports.isValidType = isValidType;
exports.isValidJsonString = isValidJsonString;
exports.validateObjectByInstance = validateObjectByInstance;
exports.validateRequestBody = validateRequestBody;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const class_validator_1 = require("class-validator");
const exceptions_1 = require("../exceptions"); // Need to check path relative to utils
const class_transformer_1 = require("class-transformer");
const isClassValidator = (target) => {
    try {
        const clsval = require("class-validator");
        const result = (0, class_validator_1.getMetadataStorage)().getTargetValidationMetadatas(target, "", false, false);
        return result.length > 0;
    }
    catch (err) {
        console.log(err);
        return false;
    }
};
exports.isClassValidator = isClassValidator;
function getDataType(expectedType) {
    switch (expectedType.name) {
        case "Object":
            if (Array.isArray(expectedType)) {
                return "array";
            }
            return "object";
        case "String":
            return "string";
        case "Number":
            return "number";
        case "Boolean":
            return "boolean";
        default:
            return expectedType;
    }
}
function isValidType(value, expectedType) {
    if (value === undefined || value === null)
        return true;
    switch (expectedType.name) {
        case "String":
            return typeof value === "string";
        case "Number":
            return typeof value === "number" || !isNaN(Number(value));
        case "Boolean":
            return typeof value === "boolean";
        default:
            return value instanceof expectedType;
    }
}
function isValidJsonString(value) {
    try {
        return JSON.parse(value);
    }
    catch (err) {
        return false;
    }
}
const isClassValidatorClass = (target) => {
    try {
        const clsval = require("class-validator");
        const result = clsval
            .getMetadataStorage()
            .getTargetValidationMetadatas(target, undefined, false, false);
        return result.length > 0;
    }
    catch (err) {
        return false;
    }
};
exports.isClassValidatorClass = isClassValidatorClass;
async function validateObjectByInstance(target, value = {}, options = "array") {
    try {
        const { validateOrReject } = require("class-validator");
        const { plainToInstance } = require("class-transformer");
        await validateOrReject(plainToInstance(target, value));
    }
    catch (error) {
        if (typeof error == "object" && Array.isArray(error)) {
            const errors = options == "object"
                ? error.reduce((acc, x) => {
                    //acc[x.property] = Object.values(x.constraints);
                    acc[x.property] = x.constraints;
                    return acc;
                }, {})
                : error.map((x) => ({
                    path: x.property,
                    constraints: x.constraints,
                }));
            return errors;
        }
        else {
            throw new exceptions_1.InternalErrorException("Can't validate object");
        }
    }
}
function validateRequestBody(target, value, options = "array") {
    if (!(0, exports.isClassValidatorClass)(target))
        return { count: 0, errors: {} };
    const error = (0, class_validator_1.validateSync)((0, class_transformer_1.plainToInstance)(target, value ? value : {}));
    const errors = options == "object"
        ? error.reduce((acc, x) => {
            //acc[x.property] = Object.values(x.constraints);
            acc[x.property] = x.constraints;
            return acc;
        }, {})
        : error.map((x) => ({ path: x.property, constraints: x.constraints }));
    return { count: error.length, errors };
}
