/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import TypediContainer, { ContainerInstance, Token } from "typedi";
import { DataSource } from "typeorm";

export const FEATURE_KEY = Symbol.for("features");
export const ROUTE_META_KEY = Symbol("iroute:options");
export const CONTROLLER_META_KEY = Symbol("icontroller:options");
export const PARAM_META_KEY = Symbol("iparam:options");
export const QUERY_META_KEY = Symbol("iparam:options");
export const REQUEST_BODY_META_KEY = Symbol("iparam:options");
export const REQUEST_BODY_FILE_KEY = Symbol("iparam:options");
export const REQUEST_BODY_FILES_KEY = Symbol("iparam:options");
export const REQUEST_USER_META_KEY = Symbol("iparam:options");
export const REQUEST_HEADER_META_KEY = Symbol("iheader:options");
export const DATASOURCE_META_KEY = Symbol("idatasource:options");
export const AUTHORIZATION_META_KEY = Symbol("idatasource:authorization");

const controllerRegistry = new Set<Function>();
const serviceRegistry = new Set<Function>();
const optionsRegistry = new Map<string, any>();

const Container = TypediContainer;

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

export function registerDataSource(dataSource: any) {
  Container.set<DataSource>("idatasource", dataSource);
}
export default Container;
