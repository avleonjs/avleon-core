import Container from "typedi";
import { CreateConfig, GetConfig } from "./config"


describe('Config', () => {

     type MyConfig = {name:string, os:string};
     const MyConfigToken = Symbol();
    describe('CreateConfig', ()=> {

        beforeAll(()=>{
            CreateConfig<MyConfig>(MyConfigToken, (env) => ({name: 'tareq', tareq:'h', os: env.get('LOGO')}));
        })

        afterAll(()=>{
            Container.reset();
        })

        it('should be call by get config', () => {
         
            const mConfig = GetConfig<MyConfig>(MyConfigToken);
            expect(mConfig).toHaveProperty('name');
            expect(mConfig.name).toBe('tareq');
            expect(mConfig.os).toBeUndefined
           //expect(mConfig['name']).toBe('tareq');
        })
    })
})