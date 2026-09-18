/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import Container from "typedi";
import { NotFoundException } from "../exceptions";
import {
  DataSource,
  EntityTarget,
  FindOneOptions,
  ObjectLiteral,
  Repository,
} from "typeorm";
import { Knex } from "knex";

type ObjKey<T> = keyof T;
type PaginationOptions = {
  take: number;
  skip?: number;
};

type Predicate<T> = (item: T) => boolean;
type ValueOperator<T> = {
  $in?: T[];
};

type FieldCondition<T> = T | ValueOperator<T>;

type WhereCondition<T> = {
  [K in keyof T]?: FieldCondition<T[K]>;
};

type LogicalOperators<T> =
  | { $and: Where<T>[] }
  | { $or: Where<T>[] }
  | { $not: Where<T> };

type Where<T> = WhereCondition<T> | LogicalOperators<T>;

export interface IFindOneOptions<T = any> {
  where: Where<T>;
}

export type PaginationResult<T> = {
  total: number;
  data: T[];
  next?: number | null;
  prev?: number | null;
  first?: number | null;
  last?: number | null;
  totalPage?: number;
}

export type ListResult<T> = T | T[] | Promise<T> | Promise<T[]> | undefined;

export interface IList<T>{
  // insert /update/ delete
  Find(predicate?: Predicate<T>): ListResult<T>;
  FindOne(predicate?: Predicate<T>):ListResult<T>;

  // access

  // deep 

  // clear
}

export class KnexAdapter{

  onConnected(){
    

  }
}

export class List<T> implements IList<T> {
  private locked = false;
  private _items:T[] = [];



  Count(){
    return this._items.length;
  }

  Where(){

  }


  Find(predicate?: Predicate<T> | undefined): ListResult<T> {
      const result = predicate ? this._items.filter(predicate) : this._items;
      return Promise.resolve(result);
  }


  FindOne(predicate?: Predicate<T> | undefined): ListResult<T> {
    
    throw new Error("Method not implemented.");
  }
  
}


class User {
    id: number;
    name: string;
}


const usersList =  new List<User>();

usersList.Find();