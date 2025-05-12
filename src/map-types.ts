/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

//
type Constructor<T = any> = new (...args: any[]) => T;

export function PartialType<T>(
  BaseClass: Constructor<T>,
): Constructor<Partial<T>> {
  const baseProperties: string[] = [];
  let currentPrototype = BaseClass.prototype;

  // Collect properties from the base class (including inherited ones)
  while (currentPrototype && currentPrototype !== Object.prototype) {
    const properties = Object.getOwnPropertyNames(currentPrototype).filter(
      (prop) => prop !== 'constructor', // Exclude the constructor
    );

    // Retrieve metadata for each property
    properties.forEach((key) => {
      // Check if the property has type metadata (design:type)
      const designType = Reflect.getMetadata(
        'design:type',
        currentPrototype,
        key,
      );
      if (designType) {
        baseProperties.push(key);
      }

      // Retrieve validation metadata (class-validator)
      const validationMetadata = Reflect.getMetadataKeys(currentPrototype, key);
      validationMetadata.forEach((metadataKey) => {});
    });

    currentPrototype = Object.getPrototypeOf(currentPrototype); // Move up the prototype chain
  }

  class PartialClass {}

  // Define properties as optional and copy metadata
  baseProperties.forEach((key) => {
    const propertyType = Reflect.getMetadata(
      'design:type',
      BaseClass.prototype,
      key,
    );
    Reflect.defineMetadata(
      'design:type',
      propertyType,
      PartialClass.prototype,
      key,
    );

    // Propagate class-validator metadata to the new class
    const validationMetadataKeys =
      Reflect.getMetadataKeys(BaseClass.prototype, key) || [];
    validationMetadataKeys.forEach((metadataKey) => {
      const metadataValue = Reflect.getMetadata(
        metadataKey,
        BaseClass.prototype,
        key,
      );
      Reflect.defineMetadata(
        metadataKey,
        metadataValue,
        PartialClass.prototype,
        key,
      );
    });
  });

  // Copy other metadata from the base class (non-property metadata)
  Reflect.getMetadataKeys(BaseClass.prototype).forEach((key) => {
    const metadataValue = Reflect.getMetadata(key, BaseClass.prototype);
    Reflect.defineMetadata(key, metadataValue, PartialClass.prototype);
  });

  return PartialClass as Constructor<Partial<T>>;
}

/**
 * Utility to pick specific properties from a class.
 */
export function PickType<T, K extends keyof T>(
  BaseClass: Constructor<T>,
  keys: K[],
): Constructor<Pick<T, K>> {
  class PickClass {
    constructor() {
      (keys as string[]).forEach((key: string) => {
        Reflect.defineMetadata(
          'design:type',
          Reflect.getMetadata('design:type', BaseClass.prototype, key),
          this,
          key,
        );
      });
    }
  }

  Reflect.decorate([Reflect.metadata('design:properties', keys)], PickClass);

  // Copy metadata from BaseClass to PickClass
  Reflect.getMetadataKeys(BaseClass.prototype).forEach((key) => {
    Reflect.defineMetadata(
      key,
      Reflect.getMetadata(key, BaseClass.prototype),
      PickClass.prototype,
    );
  });

  return PickClass as Constructor<Pick<T, K>>;
}

/**
 * Utility to omit specific properties from a class.
 */
export function OmitType<T, K extends keyof T>(
  BaseClass: Constructor<T>,
  keys: K[],
): Constructor<Omit<T, K>> {
  const allKeys = Reflect.getMetadata('design:properties', BaseClass) || [];
  const omitKeys = new Set(keys);
  const finalKeys = allKeys.filter((key: string) => !omitKeys.has(key as any));

  class OmitClass {
    constructor() {
      finalKeys.forEach((key: string) => {
        Reflect.defineMetadata(
          'design:type',
          Reflect.getMetadata('design:type', BaseClass.prototype, key),
          this,
          key,
        );
      });
    }
  }

  Reflect.decorate(
    [Reflect.metadata('design:properties', finalKeys)],
    OmitClass,
  );

  // Copy metadata from BaseClass to OmitClass
  Reflect.getMetadataKeys(BaseClass.prototype).forEach((key) => {
    Reflect.defineMetadata(
      key,
      Reflect.getMetadata(key, BaseClass.prototype),
      OmitClass.prototype,
    );
  });

  return OmitClass as Constructor<Omit<T, K>>;
}
