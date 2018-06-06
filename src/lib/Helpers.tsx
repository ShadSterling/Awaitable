import { ChildProcess, fork as forkProcess, ForkOptions, spawn as spawnProcess, SpawnOptions } from "child_process";
import { hostname } from "os";

import { caller } from "caller";
import { readFile, remove as removeFile, rmdir as removeDir, writeFile } from "fs-extra";
import { Moment, unix as unixMoment } from "moment";
import { lock as properLock, ReleaseFn } from "proper-lockfile";

import { Abortable } from "./Abortable";

/** Common name apparently removed from stdlib */
export interface Thenable<T=any> { // tslint:disable-line:interface-name no-any // any for compatibility
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ( ( value: T  ) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?:  ( (reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null, // tslint:disable-line: no-any // any is necessary for compatibility
	): Promise<TResult1 | TResult2>;
}

/** My personal "personal quirks" idiomatic miscellanious helper collection */
export class Helpers { // tslint:disable-line:no-unnecessary-class
	/** Insert the elements of one array into another array */
	public static arrayInsertArray<T=any>( into:T[], elms:ReadonlyArray<T>, start:number ): T[] { // tslint:disable-line:no-any // TODO: option to put result in new array
		let i: number;
		let j: number;
		for( i = into.length-1; i >= start; i-- ) {
			j = i + elms.length;
			into[j] = into[i];
		}
		for( i = 0; i < elms.length; i++ ) {
			j = start + i;
			into[j] = elms[i];
		}
		return into;
	}
	/** Generic asynchronous construction */
	public static async asyncNew<T=any>( asyncClass:any, ...args:any[] ): Promise<T> { // tslint:disable-line:no-any // TODO: get rid of any when typescript supports typed rest parameters // TODO: replace this with an implementable interface
		return (new asyncClass(...args)).asyncContructor.then( (v:any)=>v ); // tslint:disable-line:no-any no-unsafe-any // TODO: check that asyncClass is newable // TODO: constant for identity function?
	}
	/** Convert dates to unixtimes */
	public static unixTime( d?:Date|string ): number { return ( d ? ( (d instanceof Date) ? d.getTime() : Date.parse(d) ) : Date.now() ) / 1000; } // tslint:disable-line:no-magic-numbers // TODO: unixtime as a type?
	/** As close as javascript gets to the common `sleep` function, but with the option to sleep until a given time, and th option to cancel */
	public static async idle( d: number|Date|string = 0, c?: Function ): Promise<boolean> { // TODO: types for c and canceller? // TODO: return an Abortable
		let timer: NodeJS.Timer | undefined;
		let _resolve: Function;
		// let _reject: Function;
		const r: Promise<boolean> = new Promise<boolean>( (resolve,/*reject*/) => { _resolve = resolve; /*_reject = reject;*/ } );
		let timeout: number;
		const finished: ()=>void = () => {
			// console.log( "Idle Time Finished" );
			 _resolve(true);
		};
		if( typeof d === "number" ) {
			if( d <= this.unixTime() ) { // it's a duration // TODO: compare to TIMEOUT_MAX, which should be defined as (2^32)-1
				timeout = d*1000; // tslint:disable-line:no-magic-numbers // TODO: move magic number to a readonly property?
			} else { // it's a time // TODO: refuse to idle into the past
				timeout = d*1000 - Date.now(); // tslint:disable-line:no-magic-numbers // TODO: move magic number to a readonly property?
			}
		} else if( d instanceof Date ) {
			timeout = d.getTime() - Date.now();
		} else {
			timeout = Date.parse(d) - Date.now();
		}
		timer = setTimeout( finished, timeout );
		if( c ) {
			const canceler: ()=>void = () => {
				_resolve(false);
				if( timer ) { clearTimeout( timer ); timer = undefined; }
			};
			c( canceler );
		}
		return r;
	}
	/** As close as javascript gets to the common `sleep` function (this one can't be cancelled) */
	public static async idleFor( s: number = 0 ): Promise<void> { return new Promise<void>( (resolve) => setTimeout( resolve, s*1000 ) ); } // tslint:disable-line:no-magic-numbers // TODO: move magic number to a readonly property?
	/** As close as javascript gets to a `sleep_until` function (this one can't be cancelled) */
	public static async idleUntil( u: number|Date|string ): Promise<void> { // TODO: return an Abortable // TODO: unixtime type?
		let v: number;
		if( typeof u === "number" ) {
			v = u*1000; // tslint:disable-line:no-magic-numbers // TODO: move magic number to a readonly property?
		} else if( u instanceof Date ) {
			v = u.getTime();
		} else {
			v = Date.parse(u);
		}
		await this.idleFor( v - this.unixTime() );
		return;
	}
	/** repeat a test at some time interval until timeout or test passes */
	public static async poll( timeout: number, interval: number, test:()=>Promise<boolean> ): Promise<boolean> {
		// let fn: string = "Helpers.poll";
		const start = this.unixTime();
		const stop = start + timeout;
		// console.log( "Polling every "+interval+" from "+this.humanTime(start)+" to "+this.humanTime(stop) );
		while( true ) { // TODO: use setInterval?
			if( await test() ) { return true; }
			// console.log( "POLL test failed" );
			if( this.unixTime() > stop ) { break; }
			// console.log( "POLL timeout not reached" );
			await this.idle( interval ); // TODO: ensure idle will take this as an interval; make a function for that?
		}
		if( await test() ) { return true; }
		// console.log( "POLL timed out" );
		return false;
	}
	/** Convert an object to multiline JSON, optionally excluding specified keys */
	public static JSONify( obj: any, options: any = {}, console?: Console ) { // tslint:disable-line:no-any no-unsafe-any // TODO: type for options & options.exclude
		const fn: string = "Helpers.JSONify"; // tslint:disable-line:no-unused-variable
		if( console ) { console.log( fn + ": options = ", options ); }
		return JSON.stringify(
			obj,
			options ? options.exclude ? (key,value) => { // tslint:disable-line:no-unsafe-any // TODO: type for options & options.exclude
				const exclude = (
					options
					&& options.exclude // tslint:disable-line:no-unsafe-any // TODO: type for options & options.exclude
					&& (
						( (typeof options.exclude) === "string" && options.exclude === key ) // tslint:disable-line:no-unsafe-any // TODO: type for options & options.exclude
						|| ( obj.exclude instanceof Array && options.exclude.includes(key) ) // tslint:disable-line:no-unsafe-any // TODO: type for options & options.exclude
						|| options.exclude.key                                               // tslint:disable-line:no-unsafe-any // TODO: type for options & options.exclude
					)
				);
				if( exclude ) {
					if( console ) { console.log( fn +"/replacer: EXCLUDING key ("+(typeof key)+") "+key ); }
					return undefined;
				}
				if( console ) { console.log( fn +"/replacer: including key ("+(typeof key)+") "+key ); }
				return value;
			} : undefined : undefined,
			"\t",
		);
	}
	/** Get a unixTime, Date or parsable time string in a human-readable format */
	public static humanTime( time?: number | Date | string ): string {
		const u: number = time === undefined
			? this.unixTime()
			: typeof time === "number"
				? time
				: time instanceof Date
					? time.getTime()/1000 // tslint:disable-line:no-magic-numbers // TODO: unixtime as a type? // use unixtime conversion method here?
					: Date.parse(time);
		const m: Moment = unixMoment( u ); // tslint:disable-line:no-unsafe-any // TODO: tslint bug, false positive for no-unsafe-any
		const r: string = m.format( "YYYY-MMM-DD HH:mm:ss.SSSSSS Z" ); // tslint:disable-line:no-unsafe-any // TODO: tslint bug, false positive for no-unsafe-any
		return r;
	}
	/** Ensures an Error object and adds a prefix to the error message; useful for tracing errors through promise chains */
	public static errorChain( error: any, messagePrefix?: string ): Error { // tslint:disable-line:no-any // this function does conversion to error
		const err: Error = error instanceof Error ? error : typeof error === "object" ? new Error( this.JSONify( error ) ) : new Error( error as string ); // all primitives are reasonably convertable to string // TODO: include class name from tostring as well as JSONify?
		if( err.message === "" ) { err.message = "(Empty message)"; } else if( !err.message ) { err.message = "(No message)"; }
		if( messagePrefix ) { err.message = messagePrefix + " -- " + err.message; }
		return err;
	}
	/** Fork a daemon process to run in the background, with no direct communication to this process */
	public static forkDaemon( env: typeof process.env, cwd: string, args: string[] ): ChildProcess {
		const opts: ForkOptions = {
			cwd: cwd,
			detached: true, // types exclude detatched, but fork call honors it; see https://github.com/nodejs/node/issues/17592
			env: env,
			stdio: "ignore", // types exclude string (and errs with array of ignore), but fork call honors it
		} as {}; // tslint:disable-line:no-object-literal-type-assertion // TODO: extended ForkOptions type with peoperties unofficially supported?
		const moduleName = caller();
		// console.log( "Forking with ", { moduleName: moduleName, args: args, opts: opts } );
		const daemon = forkProcess( moduleName, args, opts );
		daemon.unref();
		return daemon;
	}
	/** Get output from external command (what backticks do in many languages) */
	public static async backtick( command: string, args: string[] = [], options: any = {} ): Promise<CommandResult> { // tslint:disable-line:no-any // TODO: type for options; superset of SpawnOptions?
		const fn: string = "Helpers.backtick";
		return new Promise<CommandResult>( (resolve,reject) => {
			(async () => {
				try {
					let opts: any = {}; // tslint:disable-line:no-any // TODO: type for options; copy constructor here
					if( args && !options ) {
						if( args.length > 1 && typeof args[args.length-1] as any === "object" ) { // tslint:disable-line:no-any // TODO: if args isn't a rest parameter, why allow the last arg to be the options?
							opts = args.pop() as SpawnOptions;
						}
					}
					if( options.env ) { opts.env = options.env; } // tslint:disable-line:no-unsafe-any // TODO: type for options
					if( options.cwd ) { opts.cwd = options.cwd; } // tslint:disable-line:no-unsafe-any // TODO: type for options
					if( !args || args.length === 0 ) {
						if( /\s/.test( command ) ) {
							opts.shell = true; // tslint:disable-line:no-unsafe-any // TODO: type for options
						}
					}
					// console.log( fn+": command = ", command );
					// console.log( fn+": args = ", args );
					// console.log( fn+": opts = ", opts );

					let out: string = "";
					let err: string = "";
					const log: {time:number,fd:"OUT"|"ERR"|"EXIT",data:string}[] = [];

					const start: number = Helpers.unixTime();
					const cmd = spawnProcess( command, args, opts ); // tslint:disable-line:no-unsafe-any // TODO: type for options
					cmd.stdout.on( "data", (data) => { out += data; log.push( { time: Helpers.unixTime(), fd: "OUT", data: typeof data === "string" ? data : data.toString() } ); } );
					cmd.stderr.on( "data", (data) => { err += data; log.push( { time: Helpers.unixTime(), fd: "ERR", data: typeof data === "string" ? data : data.toString() } ); } );
					cmd.on( "close", (code:number) => {
						const stop = Helpers.unixTime();
						log.push( { time: stop, fd: "EXIT", data: `${code}` } );
						resolve( {
							code: code,
							command: [command].concat(args||[]).join(" "),
							err: err,
							errors: err.length > 0 || code !== 0,
							input: options.input, // tslint:disable-line:no-unsafe-any // TODO: type for options
							out: out,
							start: start,
							stop: stop,
						} );
					} );
					if( options.input ) { cmd.stdin.write( options.input ); } // tslint:disable-line:no-unsafe-any // TODO: type for options
					cmd.stdin.end();
				} catch(e) { reject( this.errorChain( e, fn ) ); }
			})().catch( async (e) => Promise.reject( this.errorChain(e,fn) ) );
		} );
	}
	/** Create a lock file both the proper way and containing our PID, starttime, and hostname */
	public static async PIDlock( filename: string, compromised?: (err:Error)=>boolean ): Promise<()=>Promise<void>> { const fn: string = "Helpers.PIDlock"; try {
		let releaseDir: ReleaseFn;
		const release: ()=>Promise<void> = async ():Promise<void> => {
			console.log( fn+"/release: releasing "+filename );
			await removeFile( filename );
			await releaseDir();
			console.log( fn+"/release: released "+filename );
		};
		const onCompromised: (err:Error)=>void = (err):void => {
			// TODO: default recovery attempts
			if( compromised ) {
				const recovered: boolean = compromised(err);
				if( !recovered ) { release(); }
			} else {
				throw this.errorChain( err, fn+"/compromised" );
			}
		};
		const pid: number = process.pid;
		const getStart = await this.backtick( `ps -p ${pid} -o lstart=` ); // TODO: command is os dependent
		const start: number = this.unixTime( getStart.out );
		const content: string = this.JSONify( {
			HOST:  hostname(),
			PID:   pid,
			START: start,
			startStr: this.humanTime( start ),
		} );
		releaseDir = await properLock( filename, { realpath: false, onCompromised: onCompromised } );
		await writeFile( filename, content, "utf8" );
		return release;
	} catch(e) { throw this.errorChain( e, fn ); } }
	/** Check weather a lock created by [[PIDlock]] is still valid */
	public static async PIDcheck( filename: string ): Promise<{HOST:string,PID:number,START:number,startStr:string}|undefined> {
		const fn = "Helpers.PIDcheck";
		// console.log( "Checking PIDfile "+filename );
		try {
			// console.log( "Checking PIDfile "+filename );
			// let info = JSON.parse( await fse.readFile( filename, { encoding: "utf8" } ) );
			const raw = await readFile( filename, { encoding: "utf8" } );
			// console.log( "PIDfile "+filename+" contains ", raw );
			const info = JSON.parse( raw ); // tslint:disable-line:no-unsafe-any // TODO: types for PID*
			// console.log( "PIDfile "+filename+" contains ", info );
			const getStart = await this.backtick( `ps -p ${info.PID} -o lstart=` ); // tslint:disable-line:no-unsafe-any // TODO: types for PID*
			if( !getStart.errors ) {
				const start = this.unixTime( getStart.out );
				if( info.START !== start ) { // tslint:disable-line:no-unsafe-any // TODO: types for PID*
					// console.log( "PID "+info.PID+" start time mismatch with ", this.humanTime(start) );
					return undefined; // process ID has been recycled, return falsy
				}
				// console.log( "PID "+info.PID+" start time match with ", this.humanTime(start) );
				return info; // tslint:disable-line:no-unsafe-any // TODO: types for PID*
			} else if( getStart.code === 1 ) {
				return undefined; // process dead, return falsy
			} else {
				throw new Error( fn + " >> Error checking start time of "+filename+"\nCONTENTS:\n"+raw+"\nBACKTICK\n"+this.JSONify(getStart) );
			}
		} catch(e) {
			if( e.code && e.code === "ENOENT" ) { // tslint:disable-line:no-unsafe-any // ... this actually is safe
				return undefined; // file missing or malformed, return falsy
			} else {
				throw this.errorChain(e,fn);
			}
		}
	}
	/** End the process that owns a lock created by [[PIDlock]] */
	public static async PIDkill( filename:string, timeout:number=10 ) {
		const fn = "Helpers.PIDkill";
		try {
			let info = await this.PIDcheck( filename );
			// console.log( "PIDfile "+filename+" contains ", info );
			if( info ) {
				// console.log( "PIDfile "+filename+" running as "+info.PID+" since "+info.startStr );
				process.kill( info.PID, "SIGTERM" );
				if( !await this.poll( timeout, 1, async () => !(info = await this.PIDcheck(filename)) ) ) {
					console.log( `PIDfile ${filename} still running as ${info.PID} after SIGTERM, sending SIGKILL` );
					while( info ) {
						process.kill( info.PID, "SIGKILL" );
						info = await this.PIDcheck(filename);
						console.log( "after SIGKILL: ", info );
						try { await removeFile( filename ); }
						catch(e) { console.log( `${fn}: Error removing PID file after SIGKILL -- ${e}` ); }
						try { await removeDir( filename+".lock" ); }
						catch(e) { console.log( `${fn}: Error removing PID lock after SIGKILL -- ${e}` ); }
					}
				// } else {
				// 	console.log( "PIDfile "+filename+" removed after SIGTERM" );
				}
			}
		} catch(e) {
			throw this.errorChain( e, fn );
		}
	}
	/** Turn a function that takes a callback into a function that returns a Promise */
	public static async asyncify<T,E=any>( oldf:(...args:any[])=>void, ...args: any[] ): Promise<T> { // tslint:disable-line:no-any // Can't be generic without using any
		const fn = "Helpers.asyncify";
		return new Promise<T>( (resolve,reject): void => {
			let check:boolean = false;
			const callback = ( err:E, res:T ) => {
				check = true;
				if(err) { reject(err); } else { resolve(res); }
			};
			args.push(callback);
			try {
				oldf( args );
				if( !check ) { console.warn( fn + ": function returned before callback invoked; either it started something asynchronous, or this chain is doomed" ); }
			} catch( e ) { reject(e); return; }
		} );
	}
	/** Each call returns the next entry in the given cycle; defaults to English capital letters */
	public static cycler<T=string>( ...args:(T|T[])[] ): ()=>T { // tslint:disable-line:no-any // any for overloading
		const list: T[] = args.length > 0
			? args.length === 1 && args[0] instanceof Array
				? args[0] as T[]
				: args as T[]
			: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"] as {} as T[]; // tslint:disable-line:no-any // any for overloading
		let i = list.length-1;
		if( i <= 0 ) { throw new Error( "Helpers.cycler: cycle must contain at least one entry" ); }
		return () => { i = i >= list.length-1 ? 0 : i+1; return list[i]; };
	}
	/** Tests whether a given value is Thenable */
	public static isThenable( p: any ): p is Thenable<any> { // tslint:disable-line:no-any // any for overloading
		return !!p && (typeof p === "object" || typeof p === "function") && typeof p.then === "function"; // tslint:disable-line:no-unsafe-any // Can't be generic without using any
	}
	/** Tests whether a given value is "PromiseLike" in that it's Thenable */
	public static isPromiseLike( p: any ): p is PromiseLike<any> { // tslint:disable-line:no-any // any for overloading
		return this.isThenable( p );
	}
	/** Returns the then method, if and only if p is thenable */
	public static thenIfThenable( p: any ): typeof Promise.prototype.then | undefined { // tslint:disable-line:no-any // any for overloading
		if( !!p && (typeof p === "object" || typeof p === "function") ) {
			const then: typeof Promise.prototype.then | undefined = p.then; // tslint:disable-line:no-unsafe-any // any for overloading
			return typeof then === "function" ? then.bind( p ) as typeof Promise.prototype.then : undefined; // tslint:disable-line:no-unsafe-any // any for overloading
		} else {
			return undefined;
		}
	}
	/** Returns the catch method, if and only if p is catchable */
	public static catchIfCatchable( p: any ): typeof Promise.prototype.catch | undefined { // tslint:disable-line:no-any // any for overloading
		if( !!p && (typeof p === "object" || typeof p === "function") ) {
			const _catch: typeof Promise.prototype.catch | undefined = p.catch; // tslint:disable-line:no-unsafe-any // any for overloading
			return typeof _catch === "function" ? _catch.bind( p ) as typeof Promise.prototype.catch : undefined; // tslint:disable-line:no-unsafe-any // any for overloading
		} else {
			return undefined;
		}
	}
	/** Returns the aborted method, if and only if p is abortedable */
	public static abortedIfAbortedable( p: any ): typeof Abortable.prototype.aborted | undefined { // tslint:disable-line:no-any // any for overloading
		if( !!p && (typeof p === "object" || typeof p === "function") ) {
			const aborted: typeof Abortable.prototype.aborted | undefined = p.aborted; // tslint:disable-line:no-unsafe-any // any for overloading
			return typeof aborted === "function" ? aborted.bind( p ) as typeof Abortable.prototype.aborted : undefined; // tslint:disable-line:no-unsafe-any // any for overloading
		} else {
			return undefined;
		}
	}
	/** Tests whether a given value looks like it will quack like a Promise */
	public static isPromise( p: any ): p is Promise<any> { // tslint:disable-line:no-any // Can't be generic without using any
		return this.isThenable(p) && typeof (p as any).catch === "function"; // tslint:disable-line:no-any no-unsafe-any // any for overloading
	}
	/** try-catch with else before finally */
	public static tryCatchElseFinally( tryBlk: ()=>void, catchBlk: (e:any)=>void, elseBlk: ()=>void, finallyBlk?: ()=>void ) { // tslint:disable-line:no-any // any for compatibility
		try {
			let success = false;
			try { tryBlk(); success = true; }
			catch(e) { catchBlk(e); }
			if(success) { elseBlk(); }
		} finally {
		  if( finallyBlk ) { finallyBlk(); }
		}
	}
	/**
	 * Enable original source locations in Node stack traces involving code compiled to javascript;
	 * requires presence of module [`source-map-support`](https://www.npmjs.com/package/source-map-support)
	 */
	public static enableSourceMaps() {
		try {
			require("source-map-support").install(); // tslint:disable-line:no-require-imports no-implicit-dependencies no-unsafe-any
			return true;
		} catch(e) {
			return false;
		}
	}
}

export interface IAsyncNew {
	asyncConstructor: Promise<void>; // resolves when asynchronous portion of constructor completes
	// static async new(...args:any[]): Promise<typeof this> { let r = new this(...args); await r.asyncConstructor; return r}
}

export type CommandResult = {
	start: number,
	command: string | string[],
	input: string,
	out: string,
	err: string,
	code: number,
	stop: number,
	errors: boolean,
};
