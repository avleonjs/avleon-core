import TypediContainer, { ContainerInstance, Token } from "typedi";

export const ROUTE_META_KEY = Symbol("iroute:options");
export const CONTROLLER_META_KEY = Symbol("icontroller:options");
export const PARAM_META_KEY = Symbol("iparam:options");
export const QUERY_META_KEY = Symbol("iparam:options");
export const REQUEST_BODY_META_KEY = Symbol("iparam:options");
export const REQUEST_HEADER_META_KEY = Symbol("iheader:options");
export const DATASOURCE_META_KEY = Symbol("idatasource:options");

const controllerRegistry = new Set<Function>();
const serviceRegistry = new Set<Function>();
const optionsRegistry = new Map<string, any>();

export interface IContainer extends ContainerInstance {
  registerHandler: IContainer;
}

const Container: IContainer = TypediContainer.of("avContriner") as IContainer;

export function registerController(controller: Function) {
  controllerRegistry.add(controller);
}
export function registerService(service: Function) {
  Container.set(service, service);
  serviceRegistry.add(service);
}

export function getRegisteredServices(): Function[] {
  return Array.from(serviceRegistry);
}
export function getRegisteredControllers(): Function[] {
  return Array.from(controllerRegistry);
}

export const API_CONTROLLER_METADATA_KEY = Symbol("apiController");

export function isApiController(target: Function): boolean {
  return Reflect.getMetadata(API_CONTROLLER_METADATA_KEY, target) === true;
}
Container.set<string>("appName", "Iqra");
export default Container;
