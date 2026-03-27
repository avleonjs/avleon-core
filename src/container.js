"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_CONTROLLER_METADATA_KEY = exports.AUTHORIZATION_META_KEY = exports.DATASOURCE_META_KEY = exports.REQUEST_HEADER_META_KEY = exports.REQUEST_USER_META_KEY = exports.REQUEST_BODY_FILES_KEY = exports.REQUEST_BODY_FILE_KEY = exports.REQUEST_BODY_META_KEY = exports.QUERY_META_KEY = exports.PARAM_META_KEY = exports.CONTROLLER_META_KEY = exports.ROUTE_META_KEY = exports.FEATURE_KEY = void 0;
exports.registerController = registerController;
exports.registerService = registerService;
exports.getRegisteredServices = getRegisteredServices;
exports.getRegisteredControllers = getRegisteredControllers;
exports.isApiController = isApiController;
exports.registerDataSource = registerDataSource;
exports.registerKnex = registerKnex;
const typedi_1 = require("typedi");
exports.FEATURE_KEY = Symbol.for("features");
exports.ROUTE_META_KEY = Symbol("iroute:options");
exports.CONTROLLER_META_KEY = Symbol("icontroller:options");
exports.PARAM_META_KEY = Symbol("iparam:options");
exports.QUERY_META_KEY = Symbol("iparam:options");
exports.REQUEST_BODY_META_KEY = Symbol("iparam:options");
exports.REQUEST_BODY_FILE_KEY = Symbol("iparam:options");
exports.REQUEST_BODY_FILES_KEY = Symbol("iparam:options");
exports.REQUEST_USER_META_KEY = Symbol("iparam:options");
exports.REQUEST_HEADER_META_KEY = Symbol("iheader:options");
exports.DATASOURCE_META_KEY = Symbol("idatasource:options");
exports.AUTHORIZATION_META_KEY = Symbol("idatasource:authorization");
const controllerRegistry = new Set();
const serviceRegistry = new Set();
const optionsRegistry = new Map();
function registerController(controller) {
    controllerRegistry.add(controller);
}
function registerService(service) {
    typedi_1.Container.set(service, service);
    serviceRegistry.add(service);
}
function getRegisteredServices() {
    return Array.from(serviceRegistry);
}
function getRegisteredControllers() {
    return Array.from(controllerRegistry);
}
exports.API_CONTROLLER_METADATA_KEY = Symbol("apiController");
function isApiController(target) {
    return Reflect.getMetadata(exports.API_CONTROLLER_METADATA_KEY, target) === true;
}
typedi_1.Container.set("appName", "Iqra");
function registerDataSource(dataSource) {
    typedi_1.Container.set("idatasource", dataSource);
}
function registerKnex(dataSource) {
    typedi_1.Container.set("KnexConnection", dataSource);
}
exports.default = typedi_1.Container;
