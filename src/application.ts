import Container from "typedi";
import { Constructor } from "./helpers";
import fastify, { FastifyInstance, RouteShorthandMethod } from "fastify";




export interface InlineRoutes{
    get: RouteShorthandMethod;
    post: RouteShorthandMethod;
    put: RouteShorthandMethod;
    patch: RouteShorthandMethod;
    delete: RouteShorthandMethod;
}


export interface Application{

    inlineRoutes:() => InlineRoutes;
    mapGroup:(path?: string | RegExp) => InlineRoutes;

    /**
     * Start the application
     * @param port 
     * @returns void
     */
    start:(port?: number)=> void
}

export interface TestApplication{
    getController: <T>(controller: Constructor<T>)=>T;
}


class IqraTestApplication implements TestApplication{

    getController<T>(controller: Constructor<T>){
        const con = Container.get(controller);
        return con;
    }
}
class IqraApplication implements Application{

    private app!: FastifyInstance;

   constructor(){
        if(!this.app){
            this.app = fastify.prototype;
        }
      
    }

    
    inlineRoutes() {
        return {
            get: this.app.get,
            post: this.app.post,
            put: this.app.put,
            patch: this.app.patch,
            delete: this.app.delete
        }
    }


    mapGroup(path?:string|RegExp){
        return this.inlineRoutes();
    }


    start(port?:number){
        const p = port ? port : 4000
        this.app.listen({port:p});
    }
}



export class Builder{

    static createApplication(): Application{
        const app = new IqraApplication();
        return app;
    }

    static createTestApplication(app?: Application): TestApplication {
        const testApp = new IqraTestApplication();
        return testApp;
    }
}


const app = Builder.createApplication();
const route = app.inlineRoutes();



