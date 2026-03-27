"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsArrayNotEmpty = IsArrayNotEmpty;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
function IsArrayNotEmpty(validationOptions) {
    const { registerDecorator, ValidationArguments } = require("class-validator");
    return function (object, propertyName) {
        registerDecorator({
            name: "isArrayWithAtLeastOneElement",
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value, args) {
                    return Array.isArray(value) && value.length > 0;
                },
                defaultMessage(args) {
                    return `${args.property} must contain at least one item.`;
                },
            },
        });
    };
}
