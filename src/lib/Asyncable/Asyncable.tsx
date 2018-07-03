import * as debugFactory from "debug";
const debug: debugFactory.IDebugger = debugFactory( "Asyncable" );

import { AsyncablePromise, PromiseExecutor } from "./AsyncablePromise";
import { Deferred, DeferredAsyncablePromise } from "./DeferredAsyncablePromise";

export type AsyncablePreparer<T> = ( ac: AsyncableController<T>, ) => ( AsyncablePrepared<T> | undefined | void );
export type AsyncableStarter<T> = ( ac: AsyncableController<T>, ) => void;
export type AsyncablePrepared<T> = { starter?: AsyncableStarter<T> }; // TODO: class with fromRaw-style constructor
export enum AsyncableState { PREPARING, READY, RUNNING, SUCCEDED, FAILED, INVALID }
export type AsyncableCallbackSuccess<T,TResult1> = ( ( result: T  ) => TResult1 | PromiseLike<TResult1> ) | null | undefined;
export type AsyncableCallbackFailure<T,TResult2> = ( ( error: any ) => TResult2 | PromiseLike<TResult2> ) | null | undefined; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type AsyncableCallbackFinally<T         > = ( (        ) => T | PromiseLike<T> | undefined | void ) | null | undefined;
type AsyncableThen<T, TResult1=T, TResult2=never> = ( onSuccess?: AsyncableCallbackSuccess<T,TResult1>, onFailure?:  AsyncableCallbackFailure< T,TResult2>, ) => Asyncable<TResult1 | TResult2>; // tslint:disable-line:no-any // any for compatibility
type AsyncableChainSuccess<T> = ( result: T  ) => void;
type AsyncableChainFailure<T> = ( error: any ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency

/** An asynchronous-execution construct intended to be more general than Promises */
export class Asyncable<T> {

	/** Suffix for the ID of the next new [[Asyncable]] (incremented when an ID is allocated) */
	private static _nextSuffix: number = 0;

	/** Returns an [[Asyncable]] which immediately succedes with [[result]] */
	public static succeded<T>( result: T | PromiseLike<T> ) {
		const label = `${this.name}.succeded`;
		debug( `${label}: Invoked` );
		const exec: AsyncablePreparer<T> = ( ac ) => { // tslint:disable-line:no-unused-variable // keep parameters from type
			debug( `${label}/exec: Invoked` );
			ac.success( result );
			debug( `${label}/exec: Finished` );
			return {};
		};
		const r = new Asyncable<T>( exec );
		debug( `${label}: Returning ${r}` );
		return r;
	}

	/** Returns an [[Asyncable]] which immediately fails to [[error]] */
	public static failed<T>( error: any ) { // tslint:disable-line:no-any // any for compatibility
		const label = `${this.name}.failed`;
		debug( `${label}: Invoked` );
		const exec: AsyncablePreparer<T> = ( ac ) => { // tslint:disable-line:no-unused-variable // keep parameters from type
			debug( `${label}/exec: Invoked` );
			ac.failure( error );
			debug( `${label}/exec: Finished` );
			return {};
		};
		const r = new Asyncable<T>( exec );
		debug( `${label}: Returning ${r}` );
		return r;
	}

	/** Factory needed by the [Promise test suite](https://github.com/promises-aplus/promises-tests) */
	public static deferred<T>(): Deferred<T> { return new DeferredAsyncablePromise<T>(); }

	/** Factory needed by the Promise Finally tests */
	public static fromexec<T=any>( exec: PromiseExecutor<T> ): AsyncablePromise<T> { return new AsyncablePromise( exec ); } // tslint:disable-line:no-any // any for compatibility

	/** Generate an ID for a new [[Asyncable]] */
	private static _newID() {
		const r: string = `${( Date.now() / 1000 ).toFixed(3)}-${this._nextSuffix.toString().padStart(4,"0")}`; // tslint:disable-line:no-magic-numbers // conversion factor, significant digits
		this._nextSuffix += 1;
		if( this._nextSuffix >= 10000 ) { this._nextSuffix = 0; } // tslint:disable-line:no-magic-numbers // confine to 4 digits
		return r;
	}

	/** Returns the then method, if and only if p is thenable */ // TODO: use Helper
	private static _thenIfThenable<T,TResult1,TResult2>( p: any ): AsyncableThen<T,TResult1,TResult2> | undefined { // tslint:disable-line:no-any // any for overloading
		if( !!p && (typeof p === "object" || typeof p === "function") ) {
			const then: AsyncableThen<T,TResult1,TResult2> | undefined = p.then; // tslint:disable-line:no-unsafe-any // any for overloading
			return typeof then === "function" ? then.bind( p ) as AsyncableThen<T,TResult1,TResult2> : undefined; // tslint:disable-line:no-unsafe-any // any for overloading
		} else {
			return undefined;
		}
	}

	/** Not compatibile with Promises */
	public readonly [Symbol.toStringTag]: "Asyncable";

	/** An ID for this particular [[Asyncable]] (for logging and debugging) */
	private readonly _id: string = Asyncable._newID();
	/** The current state of this [[Asyncable]] */
	private _state: AsyncableState = AsyncableState.PREPARING;
	/** Result if and when this [[Asyncable]] succedes */
	private _result: T | undefined;
	/** Error if and when this [[Asyncable]] fails */
	private _error: any | undefined; // tslint:disable-line:no-any // any for compatibility
	/** Number of thenables passed to [[_success]] */
	private _thenCount = 0;
	/** Callbacks to be invoked if and when this [[Asyncable]] succedes. */
	private readonly _onSuccess: AsyncableChainSuccess<T>[] = [];
	/** Callbacks to be invoked of and when this [[Asyncable]] fails. */
	private readonly _onFailure: AsyncableChainFailure<T>[] = [];

	/** Not compatible with ES6 Promise constructor */
	public constructor( preparer: AsyncablePreparer<T> ) {
		const _fn = `constructor`;
		debug( `${this.label(_fn)}: Invoked` );
		const ac: AsyncableController<T> = new AsyncableController<T>(
			( result ) => { this._success( result  ); },
			( error: any ): void => { this._failure( error ); }, // tslint:disable-line:no-any // TODO: error type parameter (default string)
		);
		debug( `${this.label(_fn)}: Invoking preparer` );
		const prepared: AsyncablePrepared<T> = preparer( ac ) || {}; // TODO: run through constructor to ensure validity and warn of extra properties
		if( prepared.starter ) { throw new Error( this.label(_fn) + ": UNIMPLEMENTED - Asyncable that needs a separate start step" ); }
		debug( `${this.label(_fn)}: Finished` );
	}

	/** [object Asyncable<${ID}:${STATE}>] */
	public toString() { return `[object ${this.label()}]`; }

	/**
	 * Attaches callbacks to be invoked when this [[Asyncable]] settles.
	 * @returns An [[Asyncable]] representing this [[Asyncable]]'s success followed by [[onSuccess]] OR this [[Asyncable]]'s failure followed by [[onFailure]],
	 */
	public then<TResult1 = T, TResult2 = never>(
		onSuccess?: AsyncableCallbackSuccess<T,TResult1>,
		onFailure?: AsyncableCallbackFailure<T,TResult2>,
		// onprogress?: // TODO: progress indicators to go with yeildyness
	): Asyncable< TResult1 | TResult2 > {
		const _fn = `then`;
		debug( `${this.label(_fn)}: Invoked in state ${AsyncableState[this._state]}` );
		let r: Asyncable< TResult1 | TResult2 >;
		switch( this._state ) {
			case AsyncableState.READY:
				throw new Error("UNIMPLEMENTED");
			case AsyncableState.PREPARING:
			case AsyncableState.RUNNING:
				debug( `${this.label(_fn)}: deferred settling` );
				const execp: AsyncablePreparer< TResult1 | TResult2 > = (ac) => {
					debug( `${this.label(_fn)}/exec: Invoked` );
					const onf: AsyncableChainSuccess<T> = typeof onSuccess === "function"
						? (val) => {
							debug( `${this.label(_fn)}/exec/onf: Invoked (invoking onSuccess)` );
							try {
								const v: TResult1 | PromiseLike<TResult1> = onSuccess( val );
								ac.success( v );
							} catch(e) {
								debug( `${this.label(_fn)}/exec/onf: onSuccess threw -- %O`, e );
								ac.failure( e );
							}
							debug( `${this.label(_fn)}/exec/onf: Finished` );
						}
						: (val) => {
							debug( `${this.label(_fn)}/exec/onf: Invoked (no onSuccess)` );
							ac.success( val as {} as TResult1 ); // without onSuccess this is a reinterpret cast
							debug( `${this.label(_fn)}/exec/onf: Finished` );
						};
					this._onSuccess.push( onf );
					const onr: AsyncableChainFailure<T> = typeof onFailure === "function"
						? (error) => {
							debug( `${this.label(_fn)}/exec/onr: Invoked (invoking onFailure)` );
							try {
								const v: TResult2 | PromiseLike<TResult2> = onFailure( error );
								ac.success( v );
							} catch(e) {
								debug( `${this.label(_fn)}/exec/onr: onFailure threw -- %O`, e );
								ac.failure( e );
							}
							debug( `${this.label(_fn)}/exec/onr: Finished` );
						}
						: (error) => {
							debug( `${this.label(_fn)}/exec/onr: Invoked (no onFailure)` );
							ac.failure( error );
							debug( `${this.label(_fn)}/exec/onr: Finished` );
						};
					this._onFailure.push( onr );
					debug( `${this.label(_fn)}/exec: Finished` );
				};
				r = new Asyncable< TResult1 | TResult2 >( execp );
				break;
			case AsyncableState.SUCCEDED:
				debug( `${this.label(_fn)}: immediate success` );
				const execf: AsyncablePreparer<TResult1> = typeof onSuccess === "function"
					? (ac) => {
						debug( `${this.label(_fn)}/exec: Invoked (invoking onSuccess) (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}/exec: Invoked (invoking onSuccess) (NEW SYNC)` );
							try {
								const result = onSuccess( this._result as T ); // state SUCCEDED means _result is set
								ac.success( result );
							} catch(e) {
								debug( `${this.label(_fn)}: onSuccess threw -- %O`, e );
								ac.failure( e );
							}
							debug( `${this.label(_fn)}/exec: Invoked (invoked onSuccess) (END SYNC)` );
						}, 0 );
						debug( `${this.label(_fn)}/exec: Finished` );
					}
					: (ac) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (no onSuccess)` );
						ac.success( this._result as {} as TResult1 ); // without onSuccess this is a reinterpret cast
						debug( `${this.label(_fn)}/exec: Finished` );
					};
				r = new Asyncable< TResult1 | TResult2 >( execf ); // TODO: why can't this just be TResult1?
				break;
			case AsyncableState.FAILED:
				debug( `${this.label(_fn)}: immediate failure` );
				const execr: AsyncablePreparer< TResult1 | TResult2 > = typeof onFailure === "function"
					? (ac) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (invoking onFailure) (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}/exec: Invoked (invoking onFailure) (NEW SYNC)` );
							try {
								const result: TResult2 | PromiseLike<TResult2> = onFailure( this._error );
								debug( `${this.label(_fn)}: onFailure returned -- %O`, result );
								ac.success( result );
							} catch(e) {
								debug( `${this.label(_fn)}: onFailure threw -- %O`, e );
								ac.failure( e );
							}
							debug( `${this.label(_fn)}/exec: Invoked (invoked onFailure) (END SYNC)` );
						}, 0 );
						debug( `${this.label(_fn)}/exec: Finished` );
					}
					: (ac) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (no onFailure)` );
						ac.failure( this._error );
						debug( `${this.label(_fn)}/exec: Finished` );
					};
				r = new Asyncable< TResult1 | TResult2 >( execr ); // TODO: why can't this just be TResult1?
				break;
			default:
				const err: string = `${this.label(_fn)}: invalid state (${typeof this._state}) ${this._state} => ${AsyncableState[this._state]}`;
				debug( err );
				this._state = AsyncableState.INVALID; // reset to good state before rejecting with state error
				this._failure( new Error( err ) );
				r = this.then( onSuccess, onFailure );
				break;
		}
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/**
	 * Attaches a callback to be invoked if this [[Asyncable]] settles to failure.
	 * @returns An [[Asyncable]] representing this [[Asyncable]]'s success OR this [[Asyncable]]'s failure followed by [[onFailure]],
	 */
	public catch< TResult2 = never >(
		onFailure?: AsyncableCallbackFailure< T, TResult2 >,
	): Asyncable< T | TResult2 > {
		return this.then< T, TResult2 >( undefined, onFailure );
	}

	/**
	 * Attaches a callback to be invoked when this [[Asyncable]] is settled.
	 * @returns An [[Asyncable]] representing this [[Asyncable]] followed by [[onfinally]],
	 */
	public finally(
		onfinally?: AsyncableCallbackFinally<T>,
	): Asyncable<T> {
		const _fn = `finally`;
		debug( `${this.label(_fn)}: Invoked in state ${AsyncableState[this._state]}` );
		let r: Asyncable<T>;
		if( typeof onfinally === "function" ) {
			r = this.then<T>(
				(result ) => {
					const f = onfinally();
					const then: AsyncableThen<T> | undefined = Asyncable._thenIfThenable( f );
					return then ? then( ()=>result ) : result;
				},
				(error) => {
					const f = onfinally();
					const then: AsyncableThen<T,never> | undefined = Asyncable._thenIfThenable( f );
					if( then ) { return then( ()=>{ throw error; } ); } else { throw error; }
				},
			);
		} else {
			r = this.then( onfinally, onfinally );
		}
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/** Gets the label of this [[Asyncable]] (for logging and debugging) */
	public label( fn?: string ) {
		return `${this.constructor.name}<${this._id}:${AsyncableState[this._state].padEnd(9)}>${fn?"."+fn:""}`; // tslint:disable-line:no-magic-numbers // padding makes logs more readable
	}

	/** Attempt to set success for this [[Asyncable]] */
	private _success( result: T | PromiseLike<T> ): void {
		const _fn = `_success`;
		debug( `${this.label(_fn)}: Invoked` );
		switch( this._state ) {
			case AsyncableState.READY:
				throw new Error("UNIMPLEMENTED");
			case AsyncableState.PREPARING:
			case AsyncableState.RUNNING:
				debug( `${this.label(_fn)}: state = ${AsyncableState[this._state]}` );
				if( result === this ) {
					debug( `${this.label(_fn)}: success with self -- TypeError` );
					this._failure( new TypeError( "Asyncable cannot succeed with itself as its result" ) );
				} else {
					let then: AsyncableThen<T,void,void> | undefined;
					try {
						then = Asyncable._thenIfThenable( result ); // only retrieve the then function once
					} catch(e) {
						debug( `${this.label(_fn)}: error thrown from checking for thenability of result -- %O`, e );
						this._failure( e );
					}
					if( then !== undefined ) {
						this._thenCount += 1;
						const thenNum = this._thenCount;
						debug( `${this.label(_fn)}: result is Thenable #${thenNum} -- (${typeof result})`, result, "--", then ); // tslint:disable-line:no-unbound-method // unbound for debugging
						debug( `${this.label(_fn)}: chain settling to Thenable #${thenNum} (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}: chain settling to Thenable #${thenNum} (NEW SYNC)` );
							const onSuccess: AsyncableCallbackSuccess<T,void> = ( val: T ) => {
								debug( `${this.label(_fn)}/onSuccess: Invoked for Thenable #${thenNum}` );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onSuccess: Thenable #${thenNum} is current, resolving` );
									this._success( val );
								} else {
									debug( `${this.label(_fn)}/onSuccess: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring result %O`, val );
								}
								debug( `${this.label(_fn)}/onSuccess: Returning for Thenable #${thenNum} -- ${undefined}` );
							};
							const onFailure: AsyncableCallbackFailure<T,void> = ( error: any ) => { // tslint:disable-line:no-any // any for compatibility
								debug( `${this.label(_fn)}/onFailure: Invoked for Thenable #${thenNum}` );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onFailure: Thenable #${thenNum} is current, failing` );
									this._failure( error );
								} else {
									debug( `${this.label(_fn)}/onFailure: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring error %O`, error );
								}
								debug( `${this.label(_fn)}/onFailure: Returning for Thenable #${thenNum} -- ${undefined}` );
							};
							try {
								then!( onSuccess, onFailure ); // if this sync was started, then is an AsyncableThen
							} catch(e) {
								debug( `${this.label(_fn)}: Thenable #${thenNum} threw -- %O`, e );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onSuccess: Thenable #${thenNum} is current, failing` );
									this._failure( e );
								} else {
									debug( `${this.label(_fn)}/onSuccess: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring error %O`, e );
								}
							}
							debug( `${this.label(_fn)}: chained settling to Thenable #${thenNum} (END SYNC)` );
						}, 0 );
					} else {
						debug( `${this.label(_fn)}: succeded -- `, result );
						this._state = AsyncableState.SUCCEDED;
						this._result = result as T; // if result isn't thenable, it's a T
						debug( `${this.label(_fn)}: ${this._onSuccess.length} onSuccess callbacks to invoke` );
						let h = 0;
						while( this._onSuccess.length > 0 ) {
							h += 1;
							const i = h; // preserve value in closure
							const onSuccess = this._onSuccess.shift() as AsyncableChainSuccess<T>;
							debug( `${this.label(_fn)}: invoking onSuccess callback #${i} (BRANCH SYNC)` );
							setTimeout( () => {
								debug( `${this.label(_fn)}: invoking onSuccess callback #${i} (NEW SYNC)` );
								try {
									onSuccess( this._result as T );
								} catch(e) {
									debug( `${this.label(_fn)}: onSuccess callback #${i} threw -- %O`, e );
								}
								debug( `${this.label(_fn)}: done with onSuccess callback #${i} (END SYNC)` );
							}, 0 );
						}
						debug( `${this.label(_fn)}: ${this._onSuccess.length} onSuccess callbacks remaining` );
					}
				}
				break;
			case AsyncableState.SUCCEDED:
				debug( `${this.label(_fn)}: already succeded` );
				break;
			case AsyncableState.FAILED:
				debug( `${this.label(_fn)}: already failed` );
				break;
			default:
				const err: string = `${this.label(_fn)}: invalid state (${typeof this._state}) ${this._state} => ${AsyncableState[this._state]}`;
				debug( err );
				this._state = AsyncableState.INVALID; // set to recognized invalid state before failing with state error
				this._failure( new Error( err ) );
				break;
		}
		debug( `${this.label(_fn)}: Finished` );
	}

	/** Attempt to set failure for this [[Asyncable]] */
	private _failure( error: any ): void { // tslint:disable-line:no-any // any for compatibility
		const _fn = `_failure`;
		debug( `${this.label(_fn)}: Invoked` );
		switch( this._state ) {
			case AsyncableState.READY:
				throw new Error("UNIMPLEMENTED");
			case AsyncableState.PREPARING:
			case AsyncableState.RUNNING:
				debug( `${this.label(_fn)}: failure with error -- `, error );
				this._state = AsyncableState.FAILED;
				this._error = error;
				debug( `${this.label(_fn)}: ${this._onFailure.length} onFailure callbacks to invoke` );
				let h = 0;
				while( this._onFailure.length > 0 ) {
					h += 1;
					const i = h; // preserve value in closure
					const onFailure = this._onFailure.shift() as AsyncableChainFailure<T>;
					debug( `${this.label(_fn)}: invoking onFailure callback #${i} (BRANCH SYNC)` );
					setTimeout( () => {
						debug( `${this.label(_fn)}: invoking onFailure callback #${i} (NEW SYNC)` );
						try {
							onFailure( this._error );
						} catch(e) {
							debug( `${this.label(_fn)}: onFailure callback #${i} threw -- %O`, e );
						}
						debug( `${this.label(_fn)}: done with onFailure callback #${i} (END SYNC)` );
					}, 0 );
					debug( `${this.label(_fn)}: ${this._onFailure.length} onFailure callbacks remaining` );
				}
				break;
			case AsyncableState.SUCCEDED:
				debug( `${this.label(_fn)}: already succeded` );
				break;
			case AsyncableState.FAILED:
				debug( `${this.label(_fn)}: already failed` );
				break;
			default:
				const err: string = `${this.label(_fn)}: invalid state (${typeof this._state}) ${this._state} => ${AsyncableState[this._state]}`;
				debug( err );
				this._state = AsyncableState.INVALID; // set to recognized invalid state before failing with state error
				this._failure( new Error( err ) );
				break;
		}
		debug( `${this.label(_fn)}: Finished` );
	}

}

/** Controller used within the asynchronous task represented by an Asyncable */
export class AsyncableController<T> {
	public constructor(
		public readonly success: ( result:  T | PromiseLike<T> ) => void,
		public readonly failure:  ( error: any                 ) => void, // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
	) {
	}
}
