/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
export function IsArrayNotEmpty(validationOptions?: any) {
  const { registerDecorator, ValidationArguments } = require('class-validator');
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isArrayWithAtLeastOneElement',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: any) {
          return Array.isArray(value) && value.length > 0;
        },
        defaultMessage(args: any) {
          return `${args.property} must contain at least one item.`;
        },
      },
    });
  };
}
