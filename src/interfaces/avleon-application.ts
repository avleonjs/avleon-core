

interface AvleonApplication {

  // all use
  useCors: () => void;
  /**
   * function for register database 
   * @param options datasource options. options can be plain object or avleon config class 
   * */
  useDatasource: () => void;
  useMultipart: () => void;
  useOpenApi: () => void;
  useMiddlewares: () => void;
  useAuthorization: () => void;
  useSerialization: () => void;
  useControllers: () => void;
  useStaticFiles: () => void;
  /**
   * @experimental
   * use https as defalut http protocol
   * */
  useHttps: () => void;


  // all map 
  mapGet: () => void;
  mapPost: () => void;
  mapPut: () => void;
  mapPatch: () => void;
  mapOptions: () => void;
  mapGroup: () => void;
  // all others 
  // run 
  run: () => void;
}




