/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { IApplication } from './application.interface';

export interface IAppBuilder {
  createBuilder(): IAppBuilder;

  /**
   * @description will create a application instace
   * @returns IApplication
   */
  builder: () => IApplication;
}
