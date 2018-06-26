// Adapted from https://github.com/tc39/proposal-promise-finally/blob/master/test/test.js

import { describe, } from "mocha"; // tslint:disable-line:no-implicit-dependencies
import * as assert from "assert";

export type PromiseResolver<T> = ( value:  T | PromiseLike<T>  ) => void;
export type PromiseRejecter<T> = ( reason: any                 ) => void; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type PromiseExecutor<T> = ( resolve: PromiseResolver<T>, reject: PromiseRejecter<T> ) => void | undefined;
export type PromiseCallbackFulfilled<T,TResult1> = ( (  value: T   ) => TResult1 | PromiseLike<TResult1> ) | null | undefined;
export type PromiseCallbackRejected< T,TResult2> = ( ( reason: any ) => TResult2 | PromiseLike<TResult2> ) | null | undefined; // tslint:disable-line:no-any no-unused-variable // any for compatibility // T for consistency
export type PromiseCallbackFinally<  T         > = ( (        ) => T | PromiseLike<T> | undefined | void ) | null | undefined;

export interface PromiseWithFinally<T> extends Promise<T> { // tslint:disable-line:interface-name // no I for consistency
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: PromiseCallbackFulfilled<T,TResult1>,
		onrejected?: PromiseCallbackRejected<T,TResult2>,
	): PromiseWithFinally< TResult1 | TResult2 >;
	catch< TResult2 = never >(
		onrejected?: PromiseCallbackRejected< T, TResult2 >,
	): PromiseWithFinally< T | TResult2 >;
	finally( onfinally?: PromiseCallbackFinally<T>, ): PromiseWithFinally<T>;
}

export type DeferredWithFinally<T=any> = { // tslint:disable-line:no-any // any for compatibility
	promise: PromiseWithFinally<T>,
	resolve: (  value: T   ) => void,
	reject:  ( reason: any ) => void, // tslint:disable-line:no-any // any for compatibility
};

export type AdapterWithFinally = {
	resolved?: <T=any>( value: T ) => PromiseWithFinally<T>, // tslint:disable-line:no-any // any for compatibility
	rejected?: ( reason: any ) => PromiseWithFinally<never>, // tslint:disable-line:no-any // any for compatibility
	deferred: <T=any>() => DeferredWithFinally<T>; // tslint:disable-line:no-any // any for compatibility
	fromexec: <T=any>( exec: PromiseExecutor<T> ) => PromiseWithFinally<T>; // tslint:disable-line:no-any // any for compatibility
};

export type NormalizedAdapterWithFinally = {
	resolved: <T=any>(  value: T   ) => PromiseWithFinally<T>, // tslint:disable-line:no-any // any for compatibility
	rejected: ( reason: any ) => PromiseWithFinally<never>, // tslint:disable-line:no-any // any for compatibility
	deferred: <T=any>() => DeferredWithFinally<T>; // tslint:disable-line:no-any // any for compatibility
	fromexec: <T=any>( exec: PromiseExecutor<T> ) => PromiseWithFinally<T>; // tslint:disable-line:no-any // any for compatibility
};

export namespace promisesFinallyTests { // tslint:disable-line:no-namespace // this really isn't a class

	/** Normalizes by adding default implementations of resolved and rejected */
	export function normalizeAdapter( adapter: AdapterWithFinally ): NormalizedAdapterWithFinally { // convert-in-place cast
		if( !adapter.resolved ) {
			adapter.resolved = function<T=any>( value: T ) { // tslint:disable-line:no-any // any for compatibility
				const d = adapter.deferred<T>();
				d.resolve( value );
				return d.promise;
			};
		}
		if( !adapter.rejected ) {
			adapter.rejected = function ( reason ) {
				const d = adapter.deferred<never>();
				d.reject(reason);
				return d.promise;
			};
		}
		return adapter as NormalizedAdapterWithFinally;
	}

	/** Run tests as Mocha tests */
	export function mocha( _adapter: AdapterWithFinally ): void {
		const adapter = normalizeAdapter( _adapter );

		describe("onFinally", () => {

			const someRejectionReason = { message: "some rejection reason" };
			const anotherReason = { message: "another rejection reason" };
			const three: number = 3; // don't use magic numbers, use constants
			const four:  number = 4; // don't use magic numbers, use constants
			const time100:  number =  100; // don't use magic numbers, use constants
			const time1000: number = 1000; // don't use magic numbers, use constants
			const time1500: number = 1500; // don't use magic numbers, use constants

			describe( "no callback", () => {
				specify( "from resolved", (done) => {
					adapter.resolved( three ).then( (x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally().then(
						function onFulfilled(x) {
							assert.strictEqual(x, three);
							done();
						},
						function onRejected() {
							done(new Error("should not be called"));
						},
					);
				} );

				specify( "from rejected", (done) => {
					adapter.rejected(someRejectionReason).catch( (e) => {
						assert.strictEqual(e, someRejectionReason);
						throw e;
					} ).finally().then(
						function onFulfilled() {
							done(new Error("should not be called"));
						},
						function onRejected(reason) {
							assert.strictEqual(reason, someRejectionReason);
							done();
						},
					);
				} );
			} );

			describe( "throws an exception", () => {
				specify( "from resolved", (done) => {
					adapter.resolved(three).then( (x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						throw someRejectionReason;
					} ).then(
						function onFulfilled() { done( new Error("should not be called") ); },
						function onRejected(reason) { assert.strictEqual(reason, someRejectionReason); done(); },
					);
				} );

				specify( "from rejected", (done) => {
					adapter.rejected(anotherReason).finally( function onFinally() {
						assert(arguments.length === 0);
						throw someRejectionReason;
					} ).then(
						function onFulfilled() { done( new Error("should not be called") ); },
						function onRejected(reason) { assert.strictEqual(reason, someRejectionReason); done(); },
					);
				} );
			} );

			describe( "returns a non-promise", () => {
				specify( "from resolved", (done) => {
					// const p =
					adapter.resolved(three).then( (x) => {
						assert.strictEqual(x, three);
						// if( x !== three ) { done( new Error( `resolved to wrong value ${x} ≠ ${three}` ) ); }
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						// if( arguments.length !== 0 ) { done( new Error( `onFinally received ${arguments.length} > 0 arguments` ) ); }
						return four;
					} ).then(
						function onFulfilled(x) {
							assert.strictEqual(x, three);
							// if( x !== three ) { done( new Error( `finally did not pass value through` ) ); }
							done();
						},
						function onRejected() {
							done( new Error("should not be called") );
						},
					);
					// console.log( `"returns a non-promise" / "from resolved" ⇒ ${p}` );
				} );

				specify( "from rejected", (done) => {
					adapter.rejected(anotherReason).catch( (e) => {
						assert.strictEqual(e, anotherReason);
						throw e;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						throw someRejectionReason;
					} ).then(
						function onFulfilled() { done( new Error("should not be called") ); },
						function onRejected(e) { assert.strictEqual(e, someRejectionReason); done(); },
					);
				} );
			} );

			describe( "returns a pending-forever promise", () => {
				specify( "from resolved", (done) => {
					let timeout: NodeJS.Timer;
					adapter.resolved(three).then( (x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						timeout = setTimeout(done, time100);
						return adapter.fromexec<never>(() => undefined); // forever pending
					} ).then( function onFulfilled(/*x*/) {
						clearTimeout(timeout);
						done(new Error("should not be called"));
					}, function onRejected() {
						clearTimeout(timeout);
						done(new Error("should not be called"));
					} );
				} );

				specify( "from rejected", (done) => {
					let timeout: NodeJS.Timer;
					adapter.rejected(someRejectionReason).catch( (e) => {
						assert.strictEqual(e, someRejectionReason);
						throw e;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						timeout = setTimeout(done, time100);
						return adapter.fromexec<never>(() => undefined); // forever pending
					} ).then(
						function onFulfilled(/*x*/) {
							clearTimeout(timeout);
							done(new Error("should not be called"));
						},
						function onRejected() {
							clearTimeout(timeout);
							done(new Error("should not be called"));
						},
					);
				} );
			} );

			describe( "returns an immediately-fulfilled promise", () => {
				specify( "from resolved", (done) => {
					adapter.resolved(three).then( (x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						return adapter.resolved(four);
					} ).then(
							function onFulfilled(x) { assert.strictEqual(x, three); done(); },
							function onRejected() { done( new Error("should not be called") ); },
						);
					} );

				specify( "from rejected", (done) => {
					adapter.rejected(someRejectionReason).catch( (e) => {
						assert.strictEqual(e, someRejectionReason);
						throw e;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						return adapter.resolved(four) as PromiseWithFinally<never>; // adapter.rejected returns a PromiseWithFinally<never>, so onFinally is a PromiseCallbackFinally<never>
					} ).then(
						function onFulfilled() { done( new Error("should not be called") ); },
						function onRejected(e) { assert.strictEqual(e, someRejectionReason); done(); },
					);
				} );
			} );

			describe( "returns an immediately-rejected promise", () => {
				specify( "from resolved", (done) => {
					adapter.resolved(three).then( (x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						return adapter.rejected(four);
					} ).then(
						function onFulfilled(/*x*/) { done(new Error("should not be called")); },
						function onRejected(e) { assert.strictEqual(e, four); done(); },
					);
				} );

				specify( "from rejected", (done) => {
					const newReason = {};
					adapter.rejected(someRejectionReason).catch((e) => {
						assert.strictEqual(e, someRejectionReason);
						throw e;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						return adapter.rejected(newReason);
					} ).then(
						function onFulfilled(/*x*/) { done(new Error("should not be called")); },
						function onRejected(e) { assert.strictEqual(e, newReason); done(); },
					);
				} );
			} );

			describe( "returns a fulfilled-after-a-second promise", () => {
				specify( "from resolved", (done) => {
					let timeout: NodeJS.Timer;
					adapter.resolved(three).then((x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						timeout = setTimeout(done, time1500);
						return adapter.fromexec<number>( (resolve) => {
							setTimeout( () => resolve(four), time1000 );
						} );
					} ).then(
						function onFulfilled(x) {
							clearTimeout(timeout);
							assert.strictEqual(x, three);
							done();
						},
						function onRejected() {
							clearTimeout(timeout);
							done(new Error("should not be called"));
						},
					);
				} );

				specify( "from rejected", (done) => {
					let timeout: NodeJS.Timer;
					adapter.rejected(three).catch((e) => {
						assert.strictEqual(e, three);
						throw e;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						timeout = setTimeout(done, time1500);
						return adapter.fromexec<number>( (resolve) => { setTimeout(() => resolve(four), time1000); } ) as PromiseWithFinally<never>; // adapter.rejected returns a PromiseWithFinally<never>, so onFinally is a PromiseCallbackFinally<never>
					} ).then(
						function onFulfilled() { clearTimeout(timeout); done( new Error("should not be called") ); },
						function onRejected(e) { clearTimeout(timeout); assert.strictEqual(e, three); done(); },
					);
				} );
			} );

			describe( "returns a rejected-after-a-second promise", () => {
				specify( "from resolved", (done) => {
					let timeout: NodeJS.Timer;
					adapter.resolved(three).then( (x) => {
						assert.strictEqual(x, three);
						return x;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						timeout = setTimeout(done, time1500);
						return adapter.fromexec<number>((_resolve, reject) => { setTimeout(() => reject(four), time1000); } );
					} ).then(
						function onFulfilled() { clearTimeout(timeout); done( new Error("should not be called") ); },
						function onRejected(e) { clearTimeout(timeout); assert.strictEqual(e, four); done(); },
					);
				} );

				specify( "from rejected", (done) => {
					let timeout: NodeJS.Timer;
					adapter.rejected(someRejectionReason).catch((e) => {
						assert.strictEqual(e, someRejectionReason);
						throw e;
					} ).finally( function onFinally() {
						assert(arguments.length === 0);
						timeout = setTimeout(done, time1500);
						return adapter.fromexec<never>((_resolve, reject) => { setTimeout(() => reject(anotherReason), time1000); } );
					} ).then(
						function onFulfilled() { clearTimeout(timeout); done(new Error("should not be called")); },
						function onRejected(e) { clearTimeout(timeout); assert.strictEqual(e, anotherReason); done(); },
					);
				} );
			} );

			specify( "has the correct property descriptor", () => {
				const descriptor = Object.getOwnPropertyDescriptor( adapter.deferred().constructor.prototype, "finally");
				specify( "writable",     () => { assert.strictEqual(descriptor!.writable, true); } );
				specify( "configurable", () => { assert.strictEqual(descriptor!.configurable, true); } );
				specify( "enumerable",   () => { assert.strictEqual(descriptor!.enumerable, false); } );
			} );

		} );

	}

}
