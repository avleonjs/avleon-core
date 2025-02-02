import { IApplication } from "./application.interface";

export interface IAppBuilder{

    createBuilder(): IAppBuilder;

    /**
     * @description will create a application instace
     * @returns IApplication
    */
    builder : () => IApplication
}