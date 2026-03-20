/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import {
    FastifyRequest,
    FastifyReply,
    InjectOptions,
    LightMyRequestResponse,
} from "fastify";
import { MultipartFile } from "../multipart";
import { OpenApiUiOptions } from "../openapi";
import { Constructor } from "../helpers";
import {
    IAvleonApplication,
    AvleonApplicationOptions,
    CorsOptions,
    GlobalOptions,
    AutoControllerOptions,
    TestApplication,
    TestResponse
} from "../interfaces/avleon-application";

// Re-export types imported from interfaces
export {
    IAvleonApplication,
    AvleonApplicationOptions,
    CorsOptions,
    GlobalOptions,
    AutoControllerOptions,
    TestApplication,
    TestResponse
};

// IRequest
// We Omit properties that might conflict with FastifyRequest augmentation
// specifically files and formData from @fastify/multipart
export interface IRequest extends Omit<FastifyRequest, "files" | "formData" | "file" | "saveRequestFiles"> {
    params: any;
    query: any;
    body: any;
    headers: any;
    user?: any;

    // Multipart extensions overriding default fastify-multipart types
    // We treat them as optional properties for our framework logic
    formData?: any;
    file?: MultipartFile;
    files?: MultipartFile[];

    // saveRequestFiles comes from @fastify/multipart augmentation.
    // We declare it here to ensure it's available.
    // It returns Promise<SavedMultipartFile[]> usually.
    // We use 'any' or strict type if known.
    saveRequestFiles?: (options?: any) => Promise<MultipartFile[]>;

    // Add _argsCache definition to avoid casting to any in code
    _argsCache?: Map<string, any[]>;
}

// IResponse
export interface IResponse extends FastifyReply { }

// ParamMetaOptions
export interface ParamMetaOptions {
    index: number;
    key: string;
    name: string;
    required: boolean;
    validate: boolean;
    dataType: any;
    validatorClass: boolean;
    schema?: any;
    type:
    | "route:param"
    | "route:query"
    | "route:body"
    | "route:header"
    | "route:user"
    | "route:file"
    | "route:files";
}

export interface ParamMetaFilesOptions {
    index: number;
    type: "route:files";
    files: MultipartFile[];
    fieldName: string;
}

// Method Param Meta options
export interface MethodParamMeta {
    request: any[];
    params: ParamMetaOptions[];
    query: ParamMetaOptions[];
    body: ParamMetaOptions[];
    headers: ParamMetaOptions[];
    currentUser: ParamMetaOptions[];
    swagger?: OpenApiUiOptions;
    file?: any[];
    files?: ParamMetaFilesOptions[];
}

export interface IRoute {
    url: string;
    method: string;
    controller: string;
}

export type FuncRoute = {
    handler: Function;
    middlewares: any[];
    schema: any;
};

export type StaticFileOptions = {
    path?: string;
    prefix?: string;
};
