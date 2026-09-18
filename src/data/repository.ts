import { BaseEntity, DataSource, Entity, EntityManager, EntityTarget, getCustomRepository, ObjectLiteral, Repository as TypeOrmRepository } from "typeorm";






@Entity({name: "User"})
export class User{}

import Container, { Service } from "typedi";

type Constructor<T = any> = new (...args: any[]) => T;

export interface RepositoryConfig {
  name: string;
  adapter: any;
  handler?: Function;
}

export function Repository<TEntity>(
  entity: EntityTarget<TEntity>
) {
  return function <TBase extends Constructor<any>>(Base: TBase) {
    
    @Service()
    class RepositoryClass extends Base {
      constructor(...args: any[]) {
        // Resolve DataSource from DI
        const dataSource = Container.get(DataSource);

        // Get manager
        const manager: EntityManager = dataSource.manager;

        // Call parent constructor with enforced args
        super(entity, manager, ...args);
      }
    }

    // Preserve class name (helps debugging + DI)
    Object.defineProperty(RepositoryClass, "name", {
      value: Base.name,
      writable: false,
    });

    return RepositoryClass as TBase;
  };
}

@Repository(User)
export class UserRepository extends TypeOrmRepository<User>{}


const dataSoruce = new DataSource({
    type:'sqlite',
    database: './users.db'
})

Container.set(DataSource,dataSoruce);


const userRepo = Container.get(UserRepository);


// db intregation 
// 






