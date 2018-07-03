import * as debugFactory from "debug";
const debug: debugFactory.IDebugger = debugFactory( "AsyncablePromise" ); // tslint:disable-line:no-unused-variable // include in all files for consistency

// import { Asyncable, AsyncableResolver, AsyncableRejecter } from "./Asyncable";
import { Asyncable, } from "./Asyncable";
import { Helpers } from "../Helpers";

export type PromiseFulfiller<T> = ( value:  T | PromiseLike<T>  ) => void;
export type PromiseRejecter<T>  = ( reason: any                 ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type PromiseExecutor<T> = ( resolve: PromiseFulfiller<T>, reject: PromiseRejecter<T> ) => void | undefined;
export type PromiseCallbackFulfilled<T,TResult1> = ( (  value: T   ) => TResult1 | PromiseLike<TResult1> ) | null | undefined;
export type PromiseCallbackRejected< T,TResult2> = ( ( reason: any ) => TResult2 | PromiseLike<TResult2> ) | null | undefined; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency

/** A Promise-compatible wrapper/adapter of the general Asyncable class */
export class AsyncablePromise<T> implements Promise<T> {
	/** For compatibility with Promises */
	public readonly [Symbol.toStringTag]: "Promise";

	/** The Adaptee */
	private readonly _asyncable: Asyncable<T>;

	// /** Fulfillment passthrough */
	// private readonly _resolver: AsyncableResolver<T> | undefined;

	// /** Rejection passthrough */
	// private readonly _rejecter: AsyncableRejecter<T> | undefined;

	/** Compatible with ES6 Promise constructor */
	public constructor( init: PromiseExecutor<T> | Asyncable<T> ) {
		const _fn = `constructor`;
		debug( `${this.label(_fn)}: Invoked` );
		if( init instanceof Asyncable ) {
			debug( `${this.label(_fn)}: Adapting ${init}` );
			this._asyncable = init;
		} else {
			debug( `${this.label(_fn)}: Invoking executor` );
			this._asyncable = new Asyncable<T>( (ac) => {
				debug( `${this.label(_fn)}/executor: Invoked` );
				const fulfill: PromiseFulfiller<T> = ( value ) => {
					debug( `${this.label()}/fulfiller: Invoked` );
					if( value === this ) { ac.failure( new TypeError( "AsyncablePromise cannot be resolved to itself" ) ); }
					else { ac.success( value ); }
					debug( `${this.label()}/fulfiller: Finished` );
				};
				const reject:  PromiseRejecter<T> = ( reason ) => {
					debug( `${this.label()}/rejecter: Invoked` );
					ac.failure( reason );
					debug( `${this.label()}/rejecter: Finished` );
				};
				init( fulfill, reject );
				debug( `${this.label(_fn)}/executor: Finished` );
			} );
		}
		debug( `${this.label(_fn)}: Finished` );
	}

	/** [object AsyncablePromise<${ID}:${STATE}>] */
	public toString() { return `[object ${this.label()}]`; }

	/** Passthrough to [[Asyncable#then]] */
	public then<TResult1 = T, TResult2 = never>(
		onfulfilled?: PromiseCallbackFulfilled<T,TResult1>,
		onrejected?:  PromiseCallbackRejected< T,TResult2>,
	): AsyncablePromise< TResult1 | TResult2 > {
		const _fn = `then`;
		debug( `${this.label(_fn)}: Invoked` );
		const r:AsyncablePromise< TResult1 | TResult2 > = new AsyncablePromise< TResult1 | TResult2 >( this._asyncable.then< TResult1, TResult2 >(
			onfulfilled ? (value) => {
				debug( `${this.label(_fn)}/${r}/onf: Invoked` );
				let v: TResult1 | PromiseLike<TResult1>;
				if( typeof onfulfilled === "function" ) { // tslint:disable-line:strict-type-predicates // callers may be unchecked
					debug( `${this.label(_fn)}/${r}/onf: Invoking onfulfilled` );
					v = onfulfilled( value );
				} else {
					v = value as {} as TResult1; // if onfulfilled is not a function, do a reinterpret cast
					debug( `${this.label(_fn)}/${r}/onf: onfulfilled is not a function, it's a ${Helpers.whatIs(onfulfilled)}` );
				}
				if( v === r ) {
					const e = new TypeError( "AsyncablePromise cannot be resolved to itself" );
					debug( `${this.label(_fn)}/${r}/onf: Throwing ${e}` );
					throw e;
				} else {
					debug( `${this.label(_fn)}/${r}/onf: Returning ${Helpers.stringify(v)}` );
					return v;
				}
			} : undefined,
			onrejected ? (reason) => {
				debug( `${this.label(_fn)}/onr: Invoked` );
				let s: TResult2 | PromiseLike<TResult2>;
				if( typeof onrejected === "function" ) { // tslint:disable-line:strict-type-predicates // callers may be unchecked
					debug( `${this.label(_fn)}/${r}/onr: Invoking onrejected` );
					Helpers.tryCatchElseFinally(
						() => {
							s = onrejected( reason );
							const t: string = typeof s;
							debug( `${this.label(_fn)}/${r}/onr: onrejected returned (${t}) ${Helpers.stringify(s)}` );
						}, (e) => {
							debug( `${this.label(_fn)}/${r}/onr: onrejected threw (${typeof e}) ${e}` );
							throw e;
						}, () => {
							if( s === r ) {
								const e = new TypeError( "AsyncablePromise cannot be resolved to itself" );
								debug( `${this.label(_fn)}/${r}/onr: Throwing ${e}` );
								throw e;
							}
						},
					);
					debug( `${this.label(_fn)}/${r}/onr: Returning ${Helpers.stringify(s!)}` );
					return s!; // (! tells ts to assume s has been assigned; hopefully a future version will allow an annotation that callbacks are invoked before fn returns )
				} else {
					debug( `${this.label(_fn)}/${r}/onr: onrejected is not a function, it's a ${Helpers.whatIs(onrejected)}` );
					debug( `${this.label(_fn)}/${r}/onr: Throwing ${reason}` );
					throw reason;
				}
			} : undefined,
		) );
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/** Passthrough to [[Asyncable#catch]] */
	public catch< TResult2 = never >(
		onrejected?: PromiseCallbackRejected< T, TResult2 >,
	): AsyncablePromise< T | TResult2 > {
		const _fn = `catch`;
		debug( `${this.label(_fn)}: Invoked` );
		const r = this.then( undefined, onrejected );
		debug( `${this.label(_fn)}: Returning ${r}` );
		return r;
	}

	/** Passthrough to [[Asyncable#finally]] */
	public finally(
		onfinally?: ( () => void ) | null | undefined,
	): AsyncablePromise<T> {
		return new AsyncablePromise( this._asyncable.finally( onfinally ) );
	}

	/** Gets the label of this [[AsyncablePromise]] (for logging and debugging) */
	public label( fn?: string ) {
		return this._asyncable
			? this._asyncable.label( fn ).replace( /^Asyncable</, "AsyncablePromise<" )
			: `AsyncablePromise<  construction in progress   >${fn?"."+fn:""}`
			;
	}

}
