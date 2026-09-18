import Container from "typedi";
import { loadPackageFromClient } from "../common/helpers";



export function AvleonWorker(options?:any): ClassDecorator{

    return function (target: Function){

        const {
            Worker: BullWorker
        }  = loadPackageFromClient<typeof import("bullmq")>("bullmq");
        
        Container.set(target, target);
        
    };
    
}