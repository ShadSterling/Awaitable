import { DeferredWithFinally } from "../testlib/promises-finally-tests"; // tslint:disable-line:no-implicit-dependencies // type-only dependency doesn't exist at runtime

import * as debugFactory from "debug";
const debug: debugFactory.IDebugger = debugFactory( "Awaitable" );

export type AwaitableResolver<T> = ( value:  T | PromiseLike<T>  ) => void;
export type AwaitableRejecter<T> = ( reason: any                 ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type AwaitableExecutor<T> = ( resolve: AwaitableResolver<T>, reject: AwaitableRejecter<T> ) => void | undefined;
export enum AwaitableState { PENDING, FULFILLED, REJECTED }
export type AwaitableCallbackFulfilled<T,TResult1> = ( (  value: T   ) => TResult1 | PromiseLike<TResult1> ) | null | undefined;
export type AwaitableCallbackRejected< T,TResult2> = ( ( reason: any ) => TResult2 | PromiseLike<TResult2> ) | null | undefined; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type AwaitableCallbackFinally<  T         > = ( (        ) => T | PromiseLike<T> | undefined | void ) | null | undefined;
type AwaitableThen<T, TResult1=T, TResult2=never> = ( onfulfilled?: AwaitableCallbackFulfilled<T,TResult1>, onrejected?:  AwaitableCallbackRejected< T,TResult2>, ) => Awaitable<TResult1 | TResult2>; // tslint:disable-line:no-any // any for compatibility
// type AwaitableThen = <T, TResult1, TResult2>( onfulfilled?: AwaitableCallbackFulfilled<T,TResult1>, onrejected?:  AwaitableCallbackRejected< T,TResult2>, ) => Awaitable<TResult1 | TResult2>; // tslint:disable-line:no-any // any for compatibility
type AwaitableChainFulfilled<T> = (  value: T   ) => void;
type AwaitableChainRejected< T> = ( reason: any ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency

/** Rearranged construction interface needed by the [Promise test suite](https://github.com/promises-aplus/promises-tests) */
export class DeferredAwaitable<T> implements DeferredWithFinally<T> {

	/** Constructed [[Awaitable]] */
	public promise: Awaitable<T>;
	/** Resolver for [[promise]] */
	private _resolver: AwaitableResolver<T> | undefined; // assigned in executor for [[promise]]
	/** Rejecter for [[promise]] */
	private _rejecter:  AwaitableRejecter<T> | undefined; // assigned in executor for [[promise]]

	/** Instead of passing functions to an executor callback, return them */
	public constructor() {
		const _fn = `constructor`;
		debug( `${this.label(_fn)}: Invoked` );
		const exec: AwaitableExecutor<T> = (resolve,reject) => {
			debug( `${this.label()}/exec: Invoked` );
			this._resolver = resolve;
			this._rejecter = reject;
			debug( `${this.label()}/exec: Returning -- ${undefined}` );
		};
		this.promise = new Awaitable<T>( exec );
		debug( `${this.label(_fn)}: Returning` );
	}

	/** Settles [[promise]] to fulfilled */
	public resolve( value: T | PromiseLike<T> ): void {
		debug( `${this.label()}/resolvePromise: Invoked` );
		(this._resolver as AwaitableResolver<T>)( value );
		debug( `${this.label()}/resolvePromise: Returning -- ${undefined}` );
	}

	/** Settles [[promise]] to rejected */
	public reject( reason: any ): void { // tslint:disable-line:no-any // any for compatibility
		debug( `${this.label()}/rejectPromise: Invoked` );
		(this._rejecter as AwaitableRejecter<T>)( reason );
		debug( `${this.label()}/rejectPromise: Returning -- ${undefined}` );
	}

	/** [object DeferredAwaitable<${ID}:${STATE}>] */
	public toString(): string { return `[object ${this.label()}]`; }

	/** Gets the label of this [[DeferredAwaitable]] (for logging and debugging) */
	public label( fn?: string ) { return ( this.promise ? `Deferred${this.promise.label()}` : `DeferredAbortable<uninitialized                >` ) + ( fn ? "." + fn : "" ); }

}

/** An approximately minimal Promise implementation in TypeScript with copious debug output */
export class Awaitable<T> implements Promise<T> {

	/** Suffix for the ID of the next new [[Awaitable]] (incremented when an ID is allocated) */
	private static _nextSuffix: number = 0;

	/** Returns an [[Awaitable]] which immediately fulfills to [[value]] */
	public static resolve<T>( value: T | PromiseLike<T> ) {
		const label = `${this.name}.resolve`;
		debug( `${label}: Invoked` );
		const exec: AwaitableExecutor<T> = ( resolve, reject ) => { // tslint:disable-line:no-unused-variable // keep parameters from type
			debug( `${label}/exec: Invoked` );
			resolve( value );
			debug( `${label}/exec: Returning ${undefined}` );
		};
		const r = new Awaitable<T>( exec );
		debug( `${label}: Returning ${r}` );
		return r;
	}

	/** Returns an [[Awaitable]] which immediately rejects to [[reason]] */
	public static reject<T>( reason: any ) { // tslint:disable-line:no-any // any for compatibility
		const label = `${this.name}.reject`;
		debug( `${label}: Invoked` );
		const exec: AwaitableExecutor<T> = ( resolve, reject ) => { // tslint:disable-line:no-unused-variable // keep parameters from type
			debug( `${label}/exec: Invoked` );
			reject( reason );
			debug( `${label}/exec: Returning ${undefined}` );
		};
		const r = new Awaitable<T>( exec );
		debug( `${label}: Returning ${r}` );
		return r;
	}

	/** Factory needed by the [Promise test suite](https://github.com/promises-aplus/promises-tests) */
	public static deferred<T=any>(): DeferredWithFinally<T> { return new DeferredAwaitable<T>(); } // tslint:disable-line:no-any // any for compatibility

	/** Factory needed by the Promise Finally tests */
	public static fromexec<T=any>( exec: AwaitableExecutor<T> ): Awaitable<T> { return new Awaitable( exec ); } // tslint:disable-line:no-any // any for compatibility

	/** Generate an ID for a new [[Awaitable]] */
	private static _newID() {
		const r: string = `${( Date.now() / 1000 ).toFixed(3)}-${this._nextSuffix.toString().padStart(4,"0")}`; // tslint:disable-line:no-magic-numbers // conversion factor, significant digits
		this._nextSuffix += 1;
		if( this._nextSuffix >= 10000 ) { this._nextSuffix = 0; } // tslint:disable-line:no-magic-numbers // confine to 4 digits
		return r;
	}

	/** Returns the then method, if and only if p is thenable */
	private static _thenIfThenable<T,TResult1,TResult2>( p: any ): AwaitableThen<T,TResult1,TResult2> | undefined { // tslint:disable-line:no-any // any for overloading
		if( !!p && (typeof p === "object" || typeof p === "function") ) {
			const then: AwaitableThen<T,TResult1,TResult2> | undefined = p.then; // tslint:disable-line:no-unsafe-any // any for overloading
			return typeof then === "function" ? then.bind( p ) as AwaitableThen<T,TResult1,TResult2> : undefined; // tslint:disable-line:no-unsafe-any // any for overloading
		} else {
			return undefined;
		}
	}

	/** For compatibility with Promises */
	public readonly [Symbol.toStringTag]: "Promise";

	/** An ID for this particular [[Awaitable]] (for logging and debugging) */
	private readonly _id: string = Awaitable._newID();
	/** The current state of this [[Awaitable]] */
	private _state: AwaitableState = AwaitableState.PENDING;
	/** Result if and when this [[Awaitable]] is fulfilled */
	private _value: T | undefined;
	/** Reason if and when this [[Awaitable]] is rejected */
	private _reason: any | undefined; // tslint:disable-line:no-any // any for compatibility
	/** Number of thenables passed to [[_resolve]] */
	private _thenCount = 0;
	/** Callbacks to be invoked if and when this [[Awaitable]] settles to fulfilled. */
	private readonly _onFulfilled: AwaitableChainFulfilled<T>[] = [];
	/** Callbacks to be invoked if and when this [[Awaitable]] settles to rejected. */
	private readonly _onRejected: AwaitableChainRejected<T>[] = [];

	/** Compatible with ES6 Promise constructor */
	public constructor( executor: AwaitableExecutor<T> ) {
		const _fn = `constructor`;
		debug( `${this.label(_fn)}: Invoked` );
		const resolve: AwaitableResolver<T> = ( value ) => { this._resolve( value  ); };
		const reject:  AwaitableRejecter<T> = ( reason: any ): void => { this._reject(  reason ); }; // tslint:disable-line:no-any // any for compatibility
		debug( `${this.label(_fn)}: Invoking executor` );
		executor( resolve, reject );
		debug( `${this.label(_fn)}: Returning` );
	}

	/** [object Awaitable<${ID}:${STATE}>] */
	public toString() { return `[object ${this.label()}]`; }

	/**
	 * Attaches callbacks to be invoked when this [[Awaitable]] settles.
	 * @returns An [[Awaitable]] representing this [[Awaitable]]'s fulfillment followed by [[onfulfilled]] OR this [[Awaitable]]'s failure followed by [[onrejected]],
	 */
	public then<TResult1 = T, TResult2 = never>(
		onfulfilled?: AwaitableCallbackFulfilled<T,TResult1>,
		onrejected?: AwaitableCallbackRejected<T,TResult2>,
	): Awaitable< TResult1 | TResult2 > {
		const _fn = `then`;
		debug( `${this.label(_fn)}: Invoked in state ${AwaitableState[this._state]}` );
		let r: Awaitable< TResult1 | TResult2 >;
		switch( this._state ) {
			case AwaitableState.PENDING:
				debug( `${this.label(_fn)}: deferred settling` );
				const execp: AwaitableExecutor< TResult1 | TResult2 > = (resolve,reject) => {
					debug( `${this.label(_fn)}/exec: Invoked` );
					const onf: AwaitableChainFulfilled<T> = typeof onfulfilled === "function"
						? (val) => {
							debug( `${this.label(_fn)}/exec/onf: Invoked (invoking onfulfilled)` );
							try {
								const v: TResult1 | PromiseLike<TResult1> = onfulfilled( val );
								resolve( v );
							} catch(e) {
								debug( `${this.label(_fn)}/exec/onf: onfulfilled threw -- %O`, e );
								reject( e );
							}
							debug( `${this.label(_fn)}/exec/onf: Returning ${undefined}` );
						}
						: (val) => {
							debug( `${this.label(_fn)}/exec/onf: Invoked (no onfulfilled)` );
							resolve( val as {} as TResult1 ); // without onfulfilled this is a reinterpret cast
							debug( `${this.label(_fn)}/exec/onf: Returning ${undefined}` );
						};
					this._onFulfilled.push( onf );
					const onr: AwaitableChainRejected<T> = typeof onrejected === "function"
						? (reason) => {
							debug( `${this.label(_fn)}/exec/onr: Invoked (invoking onrejected)` );
							try {
								const v: TResult2 | PromiseLike<TResult2> = onrejected( reason );
								resolve( v );
							} catch(e) {
								debug( `${this.label(_fn)}/exec/onr: onrejected threw -- %O`, e );
								reject( e );
							}
							debug( `${this.label(_fn)}/exec/onr: Returning ${undefined}` );
						}
						: (reason) => {
							debug( `${this.label(_fn)}/exec/onr: Invoked (no onrejected)` );
							reject( reason );
							debug( `${this.label(_fn)}/exec/onr: Returning ${undefined}` );
						};
					this._onRejected.push( onr );
					debug( `${this.label(_fn)}/exec: Returning -- ${undefined}` );
				};
				r = new Awaitable< TResult1 | TResult2 >( execp );
				break;
			case AwaitableState.FULFILLED:
				debug( `${this.label(_fn)}: immediate fulfillment` );
				const execf: AwaitableExecutor<TResult1> = typeof onfulfilled === "function"
					? (resolve,reject) => {
						debug( `${this.label(_fn)}/exec: Invoked (invoking onfulfilled) (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}/exec: Invoked (invoking onfulfilled) (NEW SYNC)` );
							try {
								const value = onfulfilled( this._value! ); // state FULFILLED means _value is set
								resolve( value );
							} catch(e) {
								debug( `${this.label(_fn)}: onfulfilled threw -- %O`, e );
								reject( e );
							}
							debug( `${this.label(_fn)}/exec: Invoked (invoked onfulfilled) (END SYNC)` );
						}, 0 );
						debug( `${this.label(_fn)}/exec: Returning ${undefined}` );
					}
					: (resolve,reject) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (no onfulfilled)` );
						resolve( this._value as {} as TResult1 ); // without onfulfilled this is a reinterpret cast
						debug( `${this.label(_fn)}/exec: Returning ${undefined}` );
					};
				r = new Awaitable< TResult1 | TResult2 >( execf ); // TODO: why can't this just be TResult1?
				break;
			case AwaitableState.REJECTED:
				debug( `${this.label(_fn)}: immediate rejection` );
				const execr: AwaitableExecutor< TResult1 | TResult2 > = typeof onrejected === "function"
					? (resolve,reject) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (invoking onrejected) (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}/exec: Invoked (invoking onrejected) (NEW SYNC)` );
							try {
								const value: TResult2 | PromiseLike<TResult2> = onrejected( this._reason );
								resolve( value );
							} catch(e) {
								debug( `${this.label(_fn)}: onrejected threw -- %O`, e );
								reject( e );
							}
							debug( `${this.label(_fn)}/exec: Invoked (invoked onrejected) (END SYNC)` );
						}, 0 );
						debug( `${this.label(_fn)}/exec: Returning ${undefined}` );
					}
					: (resolve,reject) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (no onrejected)` );
						reject( this._reason );
						debug( `${this.label(_fn)}/exec: Returning ${undefined}` );
					};
				r = new Awaitable< TResult1 | TResult2 >( execr ); // TODO: why can't this just be TResult1?
				break;
			default:
				const err: string = `${this.label(_fn)}: invalid state (${typeof this._state}) ${this._state} => ${AwaitableState[this._state]}`;
				debug( err );
				this._state = AwaitableState.PENDING; // reset to good state before rejecting with state error
				this._reject( new Error( err ) );
				r = this.then( onfulfilled, onrejected );
				break;
		}
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/**
	 * Attaches a callback to be invoked if this [[Awaitable]] settles to failure.
	 * @returns An [[Awaitable]] representing this [[Awaitable]]'s fulfillment OR this [[Awaitable]]'s failure followed by [[onrejected]],
	 */
	public catch< TResult2 = never >(
		onrejected?: AwaitableCallbackRejected< T, TResult2 >,
	): Awaitable< T | TResult2 > {
		const _fn = `catch`;
		debug( `${this.label(_fn)}: Invoked in state ${AwaitableState[this._state]}` );
		const r = this.then< T, TResult2 >( undefined, onrejected );
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/**
	 * Attaches a callback to be invoked when this [[Awaitable]] is settled.
	 * @returns An [[Awaitable]] representing this [[Awaitable]] followed by [[onfinally]],
	 */
	public finally(
		onfinally?: AwaitableCallbackFinally<T>,
	): Awaitable<T> {
		const _fn = `finally`;
		debug( `${this.label(_fn)}: Invoked in state ${AwaitableState[this._state]}` );
		let r: Awaitable<T>;
		if( typeof onfinally === "function" ) {
			r = this.then<T>(
				(value ) => {
					const f = onfinally();
					const then: AwaitableThen<T> | undefined = Awaitable._thenIfThenable( f );
					return then ? then( ()=>value ) : value;
				},
				(reason) => {
					const f = onfinally();
					const then: AwaitableThen<T,never> | undefined = Awaitable._thenIfThenable( f );
					if( then ) { return then( ()=>{ throw reason; } ); } else { throw reason; }
				},
			);
		} else {
			r = this.then( onfinally, onfinally );
		}
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/** Gets the label of this [[Awaitable]] (for logging and debugging) */
	public label( fn?: string ) {
		return `${this.constructor.name}<${this._id}:${AwaitableState[this._state].padEnd(9)}>${fn?"."+fn:""}`; // tslint:disable-line:no-magic-numbers // padding makes logs more readable
	}

	/** Attempt to fulfill this [[Awaitable]] */
	private _resolve( value: T | PromiseLike<T> ): void {
		const _fn = `_resolve`;
		debug( `${this.label(_fn)}: Invoked` );
		switch( this._state ) {
			case AwaitableState.PENDING:
				debug( `${this.label(_fn)}: still pending` );
				if( value === this ) {
					debug( `${this.label(_fn)}: resolve to self -- TypeError` );
					this._reject( new TypeError( "Awaitable cannot be resolved to itself" ) );
				} else {
					let then: AwaitableThen<T,void,void> | undefined;
					try {
						then = Awaitable._thenIfThenable( value ); // only retrieve the then function once
					} catch(e) {
						debug( `${this.label(_fn)}: error thrown from checking for thenability of value -- %O`, e );
						this._reject( e );
					}
					if( then !== undefined ) {
						this._thenCount += 1;
						const thenNum = this._thenCount;
						debug( `${this.label(_fn)}: value is Thenable #${thenNum} -- (${typeof value})`, value, "--", then ); // tslint:disable-line:no-unbound-method // unbound for debugging
						debug( `${this.label(_fn)}: chain settling to Thenable #${thenNum} (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}: chain settling to Thenable #${thenNum} (NEW SYNC)` );
							const onfulfilled: AwaitableCallbackFulfilled<T,void> = ( val: T ) => {
								debug( `${this.label(_fn)}/onfulfilled: Invoked for Thenable #${thenNum}` );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} is current, resolving` );
									this._resolve( val );
								} else {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring value %O`, val );
								}
								debug( `${this.label(_fn)}/onfulfilled: Returning for Thenable #${thenNum} -- ${undefined}` );
							};
							const onrejected: AwaitableCallbackRejected<T,void> = ( rsn: any ) => { // tslint:disable-line:no-any // any for compatibility
								debug( `${this.label(_fn)}/onrejected: Invoked for Thenable #${thenNum}` );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onrejected: Thenable #${thenNum} is current, rejecting` );
									this._reject( rsn );
								} else {
									debug( `${this.label(_fn)}/onrejected: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring reason %O`, rsn );
								}
								debug( `${this.label(_fn)}/onrejected: Returning for Thenable #${thenNum} -- ${undefined}` );
							};
							try {
								then!( onfulfilled, onrejected ); // if this sync was started, then is an AwaitableThen
							} catch(e) {
								debug( `${this.label(_fn)}: Thenable #${thenNum} threw -- %O`, e );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} is current, rejecting` );
									this._reject( e );
								} else {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring reason %O`, e );
								}
							}
							debug( `${this.label(_fn)}: chained settling to Thenable #${thenNum} (END SYNC)` );
						}, 0 );
					} else {
						debug( `${this.label(_fn)}: settling to fulfilled -- `, value );
						this._state = AwaitableState.FULFILLED;
						this._value = value as T; // if value isn't thenable, it's a T
						debug( `${this.label(_fn)}: ${this._onFulfilled.length} fulfilled callbacks to invoke` );
						let h = 0;
						while( this._onFulfilled.length > 0 ) {
							h += 1;
							const i = h; // preserve value in closure
							const onFulfilled = this._onFulfilled.shift() as AwaitableChainFulfilled<T>;
							debug( `${this.label(_fn)}: invoking fulfilled callback #${i} (BRANCH SYNC)` );
							setTimeout( () => {
								debug( `${this.label(_fn)}: invoking fulfilled callback #${i} (NEW SYNC)` );
								try {
									onFulfilled( this._value as T );
								} catch(e) {
									debug( `${this.label(_fn)}: fulfilled callback #${i} threw -- %O`, e );
								}
								debug( `${this.label(_fn)}: done with fulfilled callback #${i} (END SYNC)` );
							}, 0 );
						}
						debug( `${this.label(_fn)}: ${this._onFulfilled.length} fulfilled callbacks remaining` );
					}
				}
				break;
			case AwaitableState.FULFILLED:
				debug( `${this.label(_fn)}: already fulfilled` );
				break;
			case AwaitableState.REJECTED:
				debug( `${this.label(_fn)}: already rejected` );
				break;
			default:
				const err: string = `${this.label(_fn)}: invalid state (${typeof this._state}) ${this._state} => ${AwaitableState[this._state]}`;
				debug( err );
				this._state = AwaitableState.PENDING; // reset to good state before rejecting with state error
				this._reject( new Error( err ) );
				break;
		}
		debug( `${this.label(_fn)}: Returning ${undefined}` );
	}

	/** Attempt to reject this [[Awaitable]] */
	private _reject( reason: any ): void { // tslint:disable-line:no-any // any for compatibility
		const _fn = `_reject`;
		debug( `${this.label(_fn)}: Invoked` );
		switch( this._state ) {
			case AwaitableState.PENDING:
				debug( `${this.label(_fn)}: settling to rejected -- `, reason );
				this._state = AwaitableState.REJECTED;
				this._reason = reason;
				debug( `${this.label(_fn)}: ${this._onRejected.length} rejected callbacks to invoke` );
				let h = 0;
				while( this._onRejected.length > 0 ) {
					h += 1;
					const i = h; // preserve value in closure
					const onRejected = this._onRejected.shift() as AwaitableChainRejected<T>;
					debug( `${this.label(_fn)}: invoking rejected callback #${i} (BRANCH SYNC)` );
					setTimeout( () => {
						debug( `${this.label(_fn)}: invoking rejected callback #${i} (NEW SYNC)` );
						try {
							onRejected( this._reason );
						} catch(e) {
							debug( `${this.label(_fn)}: rejected callback #${i} threw -- %O`, e );
						}
						debug( `${this.label(_fn)}: done with rejected callback #${i} (END SYNC)` );
					}, 0 );
					debug( `${this.label(_fn)}: ${this._onRejected.length} rejected callbacks remaining` );
				}
				break;
			case AwaitableState.FULFILLED:
				debug( `${this.label(_fn)}: already fulfilled` );
				break;
			case AwaitableState.REJECTED:
				debug( `${this.label(_fn)}: already rejected` );
				break;
			default:
				const err: string = `${this.label(_fn)}: invalid state (${typeof this._state}) ${this._state} => ${AwaitableState[this._state]}`;
				debug( err );
				this._state = AwaitableState.PENDING; // reset to good state before rejecting with state error
				this._reject( new Error( err ) );
				break;
		}
		debug( `${this.label(_fn)}: Returning ${undefined}` );
	}

}
