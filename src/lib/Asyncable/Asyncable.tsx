import * as debugFactory from "debug";
const debug: debugFactory.IDebugger = debugFactory( "Asyncable" );

import { Deferred, DeferredAsyncablePromise } from "./DeferredAsyncablePromise";

export type AsyncableResolver<T> = ( value:  T | PromiseLike<T>  ) => void;
export type AsyncableRejecter<T> = ( reason: any                 ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type AsyncablePreparer<T> = ( ac: AsyncableController<T>, ) => ( AsyncablePrepared<T> | undefined | void );
export type AsyncableStarter<T> = ( ac: AsyncableController<T>, ) => void;
export type AsyncablePrepared<T> = { starter?: AsyncableStarter<T> }; // TODO: class with fromRaw-style constructor
export type PromiseCallbackFulfilled<T,TResult1> = ( (  value: T   ) => TResult1 | PromiseLike<TResult1> ) | null | undefined;
export type PromiseCallbackRejected< T,TResult2> = ( ( reason: any ) => TResult2 | PromiseLike<TResult2> ) | null | undefined; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export enum AsyncableState { PENDING, FULFILLED, REJECTED }
export type AsyncableCallbackFulfilled<T,TResult1> = ( (  value: T   ) => TResult1 | PromiseLike<TResult1> ) | null | undefined;
export type AsyncableCallbackRejected< T,TResult2> = ( ( reason: any ) => TResult2 | PromiseLike<TResult2> ) | null | undefined; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
type AsyncableThen = <T, TResult1, TResult2>( onfulfilled?: AsyncableCallbackFulfilled<T,TResult1>, onrejected?:  AsyncableCallbackRejected< T,TResult2>, ) => Asyncable<TResult1 | TResult2>; // tslint:disable-line:no-any // any for compatibility
type AsyncableChainFulfilled<T> = (  value: T   ) => void;
type AsyncableChainRejected< T> = ( reason: any ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency

/** An asynchronous-execution construct intended to be more general than Promises */
export class Asyncable<T> {

	/** Suffix for the ID of the next new [[Asyncable]] (incremented when an ID is allocated) */
	private static _nextSuffix: number = 0;

	/** Returns an [[Asyncable]] which immediately fulfills to [[value]] */
	public static resolve<T>( value: T | PromiseLike<T> ) {
		const label = `${this.name}.resolve`;
		debug( `${label}: Invoked` );
		const exec: AsyncablePreparer<T> = ( ac ) => { // tslint:disable-line:no-unused-variable // keep parameters from type
			debug( `${label}/exec: Invoked` );
			ac.resolve( value );
			debug( `${label}/exec: Finished` );
			return {};
		};
		const r = new Asyncable<T>( exec );
		debug( `${label}: Returning ${r}` );
		return r;
	}

	/** Returns an [[Asyncable]] which immediately rejects to [[reason]] */
	public static reject<T>( reason: any ) { // tslint:disable-line:no-any // any for compatibility
		const label = `${this.name}.reject`;
		debug( `${label}: Invoked` );
		const exec: AsyncablePreparer<T> = ( ac ) => { // tslint:disable-line:no-unused-variable // keep parameters from type
			debug( `${label}/exec: Invoked` );
			ac.reject( reason );
			debug( `${label}/exec: Finished` );
			return {};
		};
		const r = new Asyncable<T>( exec );
		debug( `${label}: Returning ${r}` );
		return r;
	}

	/** Factory needed by the [Promise test suite](https://github.com/promises-aplus/promises-tests) */
	public static deferred<T>(): Deferred<T> { return new DeferredAsyncablePromise<T>(); }

	/** Generate an ID for a new [[Asyncable]] */
	private static _newID() {
		const r: string = `${( Date.now() / 1000 ).toFixed(3)}-${this._nextSuffix.toString().padStart(4,"0")}`; // tslint:disable-line:no-magic-numbers // conversion factor, significant digits
		this._nextSuffix += 1;
		if( this._nextSuffix >= 10000 ) { this._nextSuffix = 0; } // tslint:disable-line:no-magic-numbers // confine to 4 digits
		return r;
	}

	/** Returns the then method, if and only if p is thenable */ // TODO: use Helper
	private static _thenIfThenable( p: any ): AsyncableThen | undefined { // tslint:disable-line:no-any // any for overloading
		if( !!p && (typeof p === "object" || typeof p === "function") ) {
			const then: AsyncableThen | undefined = p.then; // tslint:disable-line:no-unsafe-any // any for overloading
			return typeof then === "function" ? then.bind( p ) as AsyncableThen : undefined; // tslint:disable-line:no-unsafe-any // any for overloading
		} else {
			return undefined;
		}
	}

	/** Not compatibile with Promises */
	public readonly [Symbol.toStringTag]: "Asyncable";

	/** An ID for this particular [[Asyncable]] (for logging and debugging) */
	private readonly _id: string = Asyncable._newID();
	/** The current state of this [[Asyncable]] */
	private _state: AsyncableState = AsyncableState.PENDING;
	/** Result if and when this [[Asyncable]] is fulfilled */
	private _value: T | undefined;
	/** Reason if and when this [[Asyncable]] is rejected */
	private _reason: any | undefined; // tslint:disable-line:no-any // any for compatibility
	/** Number of thenables passed to [[_resolve]] */
	private _thenCount = 0;
	/** Callbacks to be invoked of and when this [[Asyncable]] settles to fulfilled. */
	private readonly _onFulfilled: AsyncableChainFulfilled<T>[] = [];
	/** Callbacks to be invoked of and when this [[Asyncable]] settles to rejected. */
	private readonly _onRejected: AsyncableChainRejected<T>[] = [];

	/** Not compatible with ES6 Promise constructor */
	public constructor( preparer: AsyncablePreparer<T> ) {
		const _fn = `constructor`;
		debug( `${this.label(_fn)}: Invoked` );
		const ac: AsyncableController<T> = new AsyncableController<T>(
			( value ) => { this._resolve( value  ); },
			( reason: any ): void => { this._reject(  reason ); }, // tslint:disable-line:no-any // TODO: reason type parameter (default string)
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
	 * @returns An [[Asyncable]] representing this [[Asyncable]]'s fulfillment followed by [[onfulfilled]] OR this [[Asyncable]]'s failure followed by [[onrejected]],
	 */
	public then<TResult1 = T, TResult2 = never>(
		onfulfilled?: AsyncableCallbackFulfilled<T,TResult1>,
		onrejected?: AsyncableCallbackRejected<T,TResult2>,
	): Asyncable< TResult1 | TResult2 > {
		const _fn = `then`;
		debug( `${this.label(_fn)}: Invoked in state ${AsyncableState[this._state]}` );
		let r: Asyncable< TResult1 | TResult2 >;
		switch( this._state ) {
			case AsyncableState.PENDING:
				debug( `${this.label(_fn)}: deferred settling` );
				const execp: AsyncablePreparer< TResult1 | TResult2 > = (ac) => {
					debug( `${this.label(_fn)}/exec: Invoked` );
					const onf: AsyncableChainFulfilled<T> = typeof onfulfilled === "function"
						? (val) => {
							debug( `${this.label(_fn)}/exec/onf: Invoked (invoking onfulfilled)` );
							try {
								const v: TResult1 | PromiseLike<TResult1> = onfulfilled( val );
								ac.resolve( v );
							} catch(e) {
								debug( `${this.label(_fn)}/exec/onf: onfulfilled threw -- %O`, e );
								ac.reject( e );
							}
							debug( `${this.label(_fn)}/exec/onf: Finished` );
						}
						: (val) => {
							debug( `${this.label(_fn)}/exec/onf: Invoked (no onfulfilled)` );
							ac.resolve( val as {} as TResult1 ); // without onfulfilled this is a reinterpret cast
							debug( `${this.label(_fn)}/exec/onf: Finished` );
						};
					this._onFulfilled.push( onf );
					const onr: AsyncableChainRejected<T> = typeof onrejected === "function"
						? (reason) => {
							debug( `${this.label(_fn)}/exec/onr: Invoked (invoking onrejected)` );
							try {
								const v: TResult2 | PromiseLike<TResult2> = onrejected( reason );
								ac.resolve( v );
							} catch(e) {
								debug( `${this.label(_fn)}/exec/onr: onrejected threw -- %O`, e );
								ac.reject( e );
							}
							debug( `${this.label(_fn)}/exec/onr: Finished` );
						}
						: (reason) => {
							debug( `${this.label(_fn)}/exec/onr: Invoked (no onrejected)` );
							ac.reject( reason );
							debug( `${this.label(_fn)}/exec/onr: Finished` );
						};
					this._onRejected.push( onr );
					debug( `${this.label(_fn)}/exec: Finished` );
				};
				r = new Asyncable< TResult1 | TResult2 >( execp );
				break;
			case AsyncableState.FULFILLED:
				debug( `${this.label(_fn)}: immediate fulfillment` );
				const execf: AsyncablePreparer<TResult1> = typeof onfulfilled === "function"
					? (ac) => {
						debug( `${this.label(_fn)}/exec: Invoked (invoking onfulfilled) (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}/exec: Invoked (invoking onfulfilled) (NEW SYNC)` );
							try {
								const value = onfulfilled( this._value as T ); // state FULFILLED means _value is set
								ac.resolve( value );
							} catch(e) {
								debug( `${this.label(_fn)}: onfulfilled threw -- %O`, e );
								ac.reject( e );
							}
							debug( `${this.label(_fn)}/exec: Invoked (invoked onfulfilled) (END SYNC)` );
						}, 0 );
						debug( `${this.label(_fn)}/exec: Finished` );
					}
					: (ac) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (no onfulfilled)` );
						ac.resolve( this._value as {} as TResult1 ); // without onfulfilled this is a reinterpret cast
						debug( `${this.label(_fn)}/exec: Finished` );
					};
				r = new Asyncable< TResult1 | TResult2 >( execf ); // TODO: why can't this just be TResult1?
				break;
			case AsyncableState.REJECTED:
				debug( `${this.label(_fn)}: immediate rejection` );
				const execr: AsyncablePreparer< TResult1 | TResult2 > = typeof onrejected === "function"
					? (ac) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (invoking onrejected) (BRANCH SYNC)` );
						setTimeout( () => {
							debug( `${this.label(_fn)}/exec: Invoked (invoking onrejected) (NEW SYNC)` );
							try {
								const value: TResult2 | PromiseLike<TResult2> = onrejected( this._reason );
								debug( `${this.label(_fn)}: onrejected returned -- %O`, value );
								ac.resolve( value );
							} catch(e) {
								debug( `${this.label(_fn)}: onrejected threw -- %O`, e );
								ac.reject( e );
							}
							debug( `${this.label(_fn)}/exec: Invoked (invoked onrejected) (END SYNC)` );
						}, 0 );
						debug( `${this.label(_fn)}/exec: Finished` );
					}
					: (ac) => { // tslint:disable-line:no-unused-variable // keep parameters from type
						debug( `${this.label(_fn)}/exec: Invoked (no onrejected)` );
						ac.reject( this._reason );
						debug( `${this.label(_fn)}/exec: Finished` );
					};
				r = new Asyncable< TResult1 | TResult2 >( execr ); // TODO: why can't this just be TResult1?
				break;
			default:
				debug( `${this.label(_fn)}: invalid state` );
				throw new Error( `${this.label(_fn)}: BUG! invalid state` );
		}
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/**
	 * Attaches a callback to be invoked if this [[Asyncable]] settles to failure.
	 * @returns An [[Asyncable]] representing this [[Asyncable]]'s fulfillment OR this [[Asyncable]]'s failure followed by [[onrejected]],
	 */
	public catch< TResult2 = never >(
		onrejected?: AsyncableCallbackRejected< T, TResult2 >,
	): Asyncable< T | TResult2 > {
		return this.then< T, TResult2 >( undefined, onrejected );
	}

	/**
	 * Attaches a callback to be invoked when this [[Asyncable]] is settled.
	 * @returns An [[Asyncable]] representing this [[Asyncable]] followed by [[onfinally]],
	 */
	public finally(
		onfinally?: ( () => void ) | null | undefined,
	): Asyncable<T> {
		throw new Error( `UNIMPLEMENTED ${this}${onfinally}` );
	}

	/** Gets the label of this [[Asyncable]] (for logging and debugging) */
	public label( fn?: string ) {
		return `${this.constructor.name}<${this._id}:${AsyncableState[this._state].padEnd(9)}>${fn?"."+fn:""}`; // tslint:disable-line:no-magic-numbers // padding makes logs more readable
	}

	/** Attempt to fulfill this [[Asyncable]] */
	private _resolve( value: T | PromiseLike<T> ): void {
		const _fn = `_resolve`;
		debug( `${this.label(_fn)}: Invoked` );
		switch( this._state ) {
			case AsyncableState.PENDING:
				debug( `${this.label(_fn)}: still pending` );
				if( value === this ) {
					debug( `${this.label(_fn)}: resolve to self -- TypeError` );
					this._reject( new TypeError( "Asyncable cannot be resolved to itself" ) );
				} else {
					let then: AsyncableThen | undefined;
					try {
						then = Asyncable._thenIfThenable( value ); // only retrieve the then function once
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
							const onfulfilled: AsyncableCallbackFulfilled<T,void> = ( val: T ) => {
								debug( `${this.label(_fn)}/onfulfilled: Invoked for Thenable #${thenNum}` );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} is current, resolving` );
									this._resolve( val );
								} else {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring value %O`, val );
								}
								debug( `${this.label(_fn)}/onfulfilled: Returning for Thenable #${thenNum} -- ${undefined}` );
							};
							const onrejected: AsyncableCallbackRejected<T,void> = ( rsn: any ) => { // tslint:disable-line:no-any // any for compatibility
								debug( `${this.label(_fn)}/onrejected: Invoked for Thenable #${thenNum}` );
								if( thenNum === this._thenCount ) {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} is current, rejecting` );
									this._reject( rsn );
								} else {
									debug( `${this.label(_fn)}/onfulfilled: Thenable #${thenNum} has been replaced (on #${this._thenCount}), ignoring reason %O`, rsn );
								}
								debug( `${this.label(_fn)}/onrejected: Returning for Thenable #${thenNum} -- ${undefined}` );
							};
							try {
								(then as AsyncableThen)( onfulfilled, onrejected ); // if this sync was started, then is an AsyncableThen
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
						this._state = AsyncableState.FULFILLED;
						this._value = value as T; // if value isn't thenable, it's a T
						debug( `${this.label(_fn)}: ${this._onFulfilled.length} fulfilled callbacks to invoke` );
						let h = 0;
						while( this._onFulfilled.length > 0 ) {
							h += 1;
							const i = h; // preserve value in closure
							const onFulfilled = this._onFulfilled.shift() as AsyncableChainFulfilled<T>;
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
			case AsyncableState.FULFILLED:
				debug( `${this.label(_fn)}: already fulfilled` );
				break;
			case AsyncableState.REJECTED:
				debug( `${this.label(_fn)}: already rejected` );
				break;
			default:
				debug( `${this.label(_fn)}: invalid state ${this._state}` );
				throw new Error( `UNIMPLEMENTED` );
		}
		debug( `${this.label(_fn)}: Finished` );
	}

	/** Attempt to reject this [[Asyncable]] */
	private _reject( reason: any ): void { // tslint:disable-line:no-any // any for compatibility
		const _fn = `_reject`;
		debug( `${this.label(_fn)}: Invoked` );
		switch( this._state ) {
			case AsyncableState.PENDING:
				debug( `${this.label(_fn)}: settling to rejected -- `, reason );
				this._state = AsyncableState.REJECTED;
				this._reason = reason;
				debug( `${this.label(_fn)}: ${this._onRejected.length} rejected callbacks to invoke` );
				let h = 0;
				while( this._onRejected.length > 0 ) {
					h += 1;
					const i = h; // preserve value in closure
					const onRejected = this._onRejected.shift() as AsyncableChainRejected<T>;
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
			case AsyncableState.FULFILLED:
				debug( `${this.label(_fn)}: already fulfilled` );
				break;
			case AsyncableState.REJECTED:
				debug( `${this.label(_fn)}: already rejected` );
				break;
			default:
				debug( `${this.label(_fn)}: invalid state ${this._state}` );
				throw new Error( `UNIMPLEMENTED` );
		}
		debug( `${this.label(_fn)}: Finished` );
	}

}

/** Controller used within the asynchronous task represented by an Asyncable */
export class AsyncableController<T> {
	public constructor(
		public readonly resolve: AsyncableResolver<T>,
		public readonly reject:  AsyncableRejecter<T>,
	) {
	}
}
