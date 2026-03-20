/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import container from "../container";
import { SystemUseError } from "../exceptions/system-exception";

export function inject<T>(cls: new (...args: any[]) => T): T {
    try {
        return container.get(cls);
    } catch (error) {
        throw new SystemUseError(
            "Not a project class. Maybe you wanna register it first.",
        );
    }
}
