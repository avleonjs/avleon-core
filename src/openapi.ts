/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
export interface InfoObject {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}
export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}
export interface LicenseObject {
  name: string;
  url?: string;
}
export interface ServerObject {
  url: string;
  description?: string;
  variables?: {
    [variable: string]: ServerVariableObject;
  };
}
export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export type OpenApiUiOptions = {
  logo?: any;
  theme?: any;
  ui?: "default" | "scalar";
  openapi?: string;
  configuration?: any;
  routePrefix?: string;
  info?: InfoObject;
  servers?: ServerObject[];
  paths?: PathsObject<any>;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: any;
  "x-express-openapi-additional-middleware"?: (
    | ((request: any, response: any, next: any) => Promise<void>)
    | ((request: any, response: any, next: any) => void)
  )[];
  "x-express-openapi-validation-strict"?: boolean;
};
export interface PathsObject<T extends {} = {}, P extends {} = {}> {
  [pattern: string]: (PathItemObject<T> & P) | undefined;
}
enum HttpMethods {
  GET = "get",
  PUT = "put",
  POST = "post",
  DELETE = "delete",
  OPTIONS = "options",
  HEAD = "head",
  PATCH = "patch",
  TRACE = "trace",
}
export type PathItemObject<T extends {} = {}> = {
  $ref?: string;
  summary?: string;
  description?: string;
  servers?: ServerObject[];
  parameters?: (ReferenceObject | ParameterObject)[];
} & {
  [method in HttpMethods]?: OperationObject<T>;
};
export type OperationObject<T extends {} = {}> = {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: (ReferenceObject | ParameterObject)[];
  requestBody?: ReferenceObject | RequestBodyObject;
  responses: ResponsesObject;
  callbacks?: {
    [callback: string]: ReferenceObject | CallbackObject;
  };
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
} & T;
export interface ExternalDocumentationObject {
  description?: string;
  url: string;
}
export interface ParameterObject extends ParameterBaseObject {
  name: string;
  in: string;
}
export interface HeaderObject extends ParameterBaseObject {}
export interface ParameterBaseObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: ReferenceObject | SchemaObject;
  example?: any;
  examples?: {
    [media: string]: ReferenceObject | ExampleObject;
  };
  content?: {
    [media: string]: MediaTypeObject;
  };
}
export type NonArraySchemaObjectType =
  | "boolean"
  | "object"
  | "number"
  | "string"
  | "integer";
export type ArraySchemaObjectType = "array";
export type SchemaObject = ArraySchemaObject | NonArraySchemaObject;
export interface ArraySchemaObject extends BaseSchemaObject {
  type: ArraySchemaObjectType;
  items: ReferenceObject | SchemaObject;
}
export interface NonArraySchemaObject extends BaseSchemaObject {
  type?: NonArraySchemaObjectType;
}
export interface BaseSchemaObject {
  title?: string;
  description?: string;
  format?: string;
  default?: any;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  additionalProperties?: boolean | ReferenceObject | SchemaObject;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  properties?: {
    [name: string]: ReferenceObject | SchemaObject;
  };
  allOf?: (ReferenceObject | SchemaObject)[];
  oneOf?: (ReferenceObject | SchemaObject)[];
  anyOf?: (ReferenceObject | SchemaObject)[];
  not?: ReferenceObject | SchemaObject;
  nullable?: boolean;
  discriminator?: DiscriminatorObject;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: XMLObject;
  externalDocs?: ExternalDocumentationObject;
  example?: any;
  deprecated?: boolean;
}
export interface DiscriminatorObject {
  propertyName: string;
  mapping?: {
    [value: string]: string;
  };
}
export interface XMLObject {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}
export interface ReferenceObject {
  $ref: string;
}
export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}
export interface MediaTypeObject {
  schema?: ReferenceObject | SchemaObject;
  example?: any;
  examples?: {
    [media: string]: ReferenceObject | ExampleObject;
  };
  encoding?: {
    [media: string]: EncodingObject;
  };
}
export interface EncodingObject {
  contentType?: string;
  headers?: {
    [header: string]: ReferenceObject | HeaderObject;
  };
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}
export interface RequestBodyObject {
  description?: string;
  content: {
    [media: string]: MediaTypeObject;
  };
  required?: boolean;
}
export interface ResponsesObject {
  [code: string]: ReferenceObject | ResponseObject;
}
export interface ResponseObject {
  description: string;
  headers?: {
    [header: string]: ReferenceObject | HeaderObject;
  };
  content?: {
    [media: string]: MediaTypeObject;
  };
  links?: {
    [link: string]: ReferenceObject | LinkObject;
  };
}
export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: {
    [parameter: string]: any;
  };
  requestBody?: any;
  description?: string;
  server?: ServerObject;
}
export interface CallbackObject {
  [url: string]: PathItemObject;
}
export interface SecurityRequirementObject {
  [name: string]: string[];
}
export interface ComponentsObject {
  schemas?: {
    [key: string]: ReferenceObject | SchemaObject;
  };
  responses?: {
    [key: string]: ReferenceObject | ResponseObject;
  };
  parameters?: {
    [key: string]: ReferenceObject | ParameterObject;
  };
  examples?: {
    [key: string]: ReferenceObject | ExampleObject;
  };
  requestBodies?: {
    [key: string]: ReferenceObject | RequestBodyObject;
  };
  headers?: {
    [key: string]: ReferenceObject | HeaderObject;
  };
  securitySchemes?: {
    [key: string]: ReferenceObject | SecuritySchemeObject;
  };
  links?: {
    [key: string]: ReferenceObject | LinkObject;
  };
  callbacks?: {
    [key: string]: ReferenceObject | CallbackObject;
  };
}
export type SecuritySchemeObject =
  | HttpSecurityScheme
  | ApiKeySecurityScheme
  | OAuth2SecurityScheme
  | OpenIdSecurityScheme;
export interface HttpSecurityScheme {
  type: "http";
  description?: string;
  scheme: string;
  bearerFormat?: string;
}
export interface ApiKeySecurityScheme {
  type: "apiKey";
  description?: string;
  name: string;
  in: string;
}
export interface OAuth2SecurityScheme {
  type: "oauth2";
  description?: string;
  flows: {
    implicit?: {
      authorizationUrl: string;
      refreshUrl?: string;
      scopes: {
        [scope: string]: string;
      };
    };
    password?: {
      tokenUrl: string;
      refreshUrl?: string;
      scopes: {
        [scope: string]: string;
      };
    };
    clientCredentials?: {
      tokenUrl: string;
      refreshUrl?: string;
      scopes: {
        [scope: string]: string;
      };
    };
    authorizationCode?: {
      authorizationUrl: string;
      tokenUrl: string;
      refreshUrl?: string;
      scopes: {
        [scope: string]: string;
      };
    };
  };
}
export interface OpenIdSecurityScheme {
  type: "openIdConnect";
  description?: string;
  openIdConnectUrl: string;
}
export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

export type OpenApiOptions = {
  exclude?: boolean;
  deprecated?: boolean;
  tags?: readonly string[];
  description?: string;
  summary?: string;
  components?: ComponentsObject;
  response?: any;
  responseBody?: any;
  requestBody?: any;
} & any;

export function OpenApi(
  options: OpenApiOptions,
): MethodDecorator & ClassDecorator & PropertyDecorator {
  return function (
    target: Object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (typeof target === "function" && !propertyKey) {
      Reflect.defineMetadata("controller:openapi", options, target);
    } else if (descriptor) {
      Reflect.defineMetadata("route:openapi", options, target, propertyKey!);
    } else if (propertyKey) {
      Reflect.defineMetadata("property:openapi", options, target, propertyKey);
    }
  };
}
