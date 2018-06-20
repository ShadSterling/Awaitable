import * as debugFactory from "debug";
const debug: debugFactory.IDebugger = debugFactory( "DeferredAsyncablePromise" );

import { Deferred } from "promises-aplus-tests"; // tslint:disable-line:no-implicit-dependencies // type-only dependency doesn't exist at runtime
export { Deferred };

import { AsyncablePromise, PromiseFulfiller, PromiseRejecter } from "./AsyncablePromise";

/** Rearranged construction interface needed by the [Promise test suite](https://github.com/promises-aplus/promises-tests) */
export class DeferredAsyncablePromise<T> implements Deferred<T> {

	/** Constructed [[Asyncable]] */
	public readonly promise: AsyncablePromise<T>;
	/** Resolver for [[promise]] */
	private readonly _resolver: PromiseFulfiller<T>; // assigned in executor for [[promise]]
	/** Rejecter for [[promise]] */
	private readonly _rejecter: PromiseRejecter<T>; // assigned in executor for [[promise]]

	/** Instead of passing functions to an executor callback, return them */
	public constructor() {
		const _fn = `constructor`;
		debug( `${this.label(_fn)}: Invoked` );
		let __resolver: PromiseFulfiller<T> | undefined; // tslint:disable-line:variable-name // TODO: fix tslint rule to allow multiple leading underscores
		let __rejecter: PromiseRejecter<T> | undefined; // tslint:disable-line:variable-name // TODO: fix tslint rule to allow multiple leading underscores
		this.promise = new AsyncablePromise<T>( (resolve,reject) => {
			debug( `${this.label()}/executor: Invoked` );
			__resolver = resolve;
			__rejecter = reject;
			debug( `${this.label()}/executor: Finished` );
		} );
		if( ! __resolver ) { throw new Error( `${this.label(_fn)}: Missing resolver after constructing AsyncablePromise` ); }
		if( ! __rejecter ) { throw new Error( `${this.label(_fn)}: Missing rejecter after constructing AsyncablePromise` ); }
		this._resolver = __resolver;
		this._rejecter = __rejecter;
		debug( `${this.label(_fn)}: Finished` );
	}

	/** Settles [[promise]] to fulfilled */
	public resolve( value: T | PromiseLike<T> ): void {
		debug( `${this.label()}/resolvePromise: Invoked` );
		this._resolver( value );
		debug( `${this.label()}/resolvePromise: Finished` );
	}

	/** Settles [[promise]] to rejected */
	public reject( reason: any ): void { // tslint:disable-line:no-any // any for compatibility
		debug( `${this.label()}/rejectPromise: Invoked` );
		this._rejecter( reason );
		debug( `${this.label()}/rejectPromise: Finished` );
	}

	/** [object DeferredAsyncablePromise<${ID}:${STATE}>] */
	public toString(): string { return `[object ${this.label()}]`; }

	/** Gets the label of this [[DeferredAsyncablePromise]] (for logging and debugging) */
	public label( fn?: string ) {
		return this.promise
			? this.promise.label( fn ).replace( /^AsyncablePromise</, "DeferredAsyncablePromise<" )
			: `DeferredAsyncablePromise<  construction in progress   >${fn?"."+fn:""}`
			;
	}

}
