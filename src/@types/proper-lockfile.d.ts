declare module "proper-lockfile" {
	export type LockOptions = {}; // TODO
	export type UnlockOptions = {}; // TODO
	export type CheckOptions = {}; // TODO
	export type ReleaseFn = ()=>Promise<void>;
	export function lock( file: string, options?: LockOptions ): Promise<ReleaseFn>;
	export function unlock( file: string, options?: UnlockOptions ): Promise<void>;
	export function check( file: string, options?: CheckOptions ): Promise<boolean>;
	export function lockSync( file: string, options?: LockOptions ): ReleaseFn;
	export function unlockSync( file: string, options?: UnlockOptions ): void;
	export function checkSync( file: string, options?: CheckOptions ): boolean;
	export default lock;
}

// TODO: finish a template from https://www.typescriptlang.org/docs/handbook/declaration-files/templates.html
// TODO: submit to https://github.com/moxystudio/node-proper-lockfile
