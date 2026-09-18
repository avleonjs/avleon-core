/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { getMetadataStorage, validateSync } from "class-validator";
import { Constructor } from "./common-utils";
import { InternalErrorException } from "../exceptions"; // Need to check path relative to utils
import { plainToInstance } from "class-transformer";

export const isClassValidator = (target: Constructor) => {
    try {
        const clsval = require("class-validator");
        const result = getMetadataStorage().getTargetValidationMetadatas(
            target,
            "",
            false,
            false,
        );
        return result.length > 0;
    } catch (err: any) {
        console.log(err);
        return false;
    }
};

export function getDataType(expectedType: any) {
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

export function isValidType(value: any, expectedType: any): boolean {
    if (value === undefined || value === null) return true;

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

export function isValidJsonString(value: string): object | boolean {
    try {
        return JSON.parse(value);
    } catch (err: any) {
        return false;
    }
}

export const isClassValidatorClass = (target: Constructor) => {
    try {
        const clsval = require("class-validator");
        const result = clsval
            .getMetadataStorage()
            .getTargetValidationMetadatas(target, undefined, false, false);
        return result.length > 0;
    } catch (err: any) {
        return false;
    }
};

export async function validateObjectByInstance(
    target: Constructor,
    value: object = {},
    options: "object" | "array" = "array",
) {
    try {
        const { validateOrReject } = require("class-validator");
        const { plainToInstance } = require("class-transformer");
        await validateOrReject(plainToInstance(target, value));
    } catch (error: any) {
        if (typeof error == "object" && Array.isArray(error)) {
            const errors =
                options == "object"
                    ? error.reduce((acc: any, x: any) => {
                        //acc[x.property] = Object.values(x.constraints);
                        acc[x.property] = x.constraints;
                        return acc;
                    }, {})
                    : error.map((x) => ({
                        path: x.property,
                        constraints: x.constraints,
                    }));
            return errors;
        } else {
            throw new InternalErrorException("Can't validate object");
        }
    }
}

type ValidationError = {
    count: number;
    errors: any;
};

export function validateRequestBody(
    target: Constructor,
    value: object,
    options: "object" | "array" = "array",
): ValidationError {
    if (!isClassValidatorClass(target)) return { count: 0, errors: {} };
    const error = validateSync(plainToInstance(target, value ? value : {}));
    const errors =
        options == "object"
            ? error.reduce((acc: any, x: any) => {
                //acc[x.property] = Object.values(x.constraints);
                acc[x.property] = x.constraints;
                return acc;
            }, {})
            : error.map((x) => ({ path: x.property, constraints: x.constraints }));
    return { count: error.length, errors } as ValidationError;
}
