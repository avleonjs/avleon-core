import 'reflect-metadata';
import {

OpenApi,
OpenApiOptions,
InfoObject,
ContactObject,
LicenseObject,
ServerObject,
ServerVariableObject,
PathsObject,
PathItemObject,
OperationObject,
ExternalDocumentationObject,
ParameterObject,
HeaderObject,
ParameterBaseObject,
SchemaObject,
ArraySchemaObject,
NonArraySchemaObject,
BaseSchemaObject,
DiscriminatorObject,
XMLObject,
ReferenceObject,
ExampleObject,
MediaTypeObject,
EncodingObject,
RequestBodyObject,
ResponsesObject,
ResponseObject,
LinkObject,
CallbackObject,
SecurityRequirementObject,
ComponentsObject,
SecuritySchemeObject,
TagObject,
} from './openapi';

describe('OpenApi Decorator', () => {
it('should define metadata on class', () => {
    @OpenApi({ description: 'Test Controller' })
    class TestController {}

    const metadata = Reflect.getMetadata('controller:openapi', TestController);
    expect(metadata).toEqual({ description: 'Test Controller' });
});

it('should define metadata on method', () => {
    class TestController {
        @OpenApi({ description: 'Test Route' })
        testMethod() {}
    }

    const metadata = Reflect.getMetadata(
        'route:openapi',
        TestController.prototype,
        'testMethod'
    );
    expect(metadata).toEqual({ description: 'Test Route' });
});

it('should define metadata on property', () => {
    class TestController {
        @OpenApi({ description: 'Test Property' })
        testProperty: string = '';
    }

    const metadata = Reflect.getMetadata(
        'property:openapi',
        TestController.prototype,
        'testProperty'
    );
    expect(metadata).toEqual({ description: 'Test Property' });
});
});

describe('Type Definitions', () => {
it('InfoObject should allow optional description', () => {
    const info: InfoObject = {
        title: 'API',
        version: '1.0.0',
        description: 'API Description',
    };
    expect(info.description).toBe('API Description');
});

it('ContactObject should allow optional fields', () => {
    const contact: ContactObject = {
        name: 'John Doe',
        email: 'john@example.com',
    };
    expect(contact.name).toBe('John Doe');
    expect(contact.email).toBe('john@example.com');
});

it('LicenseObject should require name', () => {
    const license: LicenseObject = {
        name: 'MIT',
    };
    expect(license.name).toBe('MIT');
});

it('ServerObject should allow variables', () => {
    const server: ServerObject = {
        url: 'https://api.example.com',
        variables: {
            version: {
                default: 'v1',
                enum: ['v1', 'v2'],
            },
        },
    };
    expect(server.variables?.version.default).toBe('v1');
});

it('SchemaObject should allow array and non-array types', () => {
    const arraySchema: ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
    };
    expect(arraySchema.type).toBe('array');

    const nonArraySchema: NonArraySchemaObject = {
        type: 'string',
    };
    expect(nonArraySchema.type).toBe('string');
});

it('ComponentsObject should allow schemas and responses', () => {
    const components: ComponentsObject = {
        schemas: {
            User: { type: 'object' },
        },
        responses: {
            NotFound: { description: 'Not found' },
        },
    };
    expect(components.schemas?.User).toBeDefined();
    expect((components.responses?.NotFound as ResponseObject).description).toBe('Not found');
});
});