import { describe, } from "mocha"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev
import { expect, should } from "chai"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev
should();

import * as promisesAPlusTests from "promises-aplus-tests"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev

import { install } from "source-map-support"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev
install();

import { promisesFinallyTests } from "../testlib/promises-finally-tests";

import { Awaitable, DeferredAwaitable, AwaitableCallbackFulfilled, AwaitableCallbackRejected } from "../lib/Awaitable";

describe( "Awaitable", () => {

	// the Promises/A+ test suite
	promisesAPlusTests.mocha( Awaitable );

	// tests for the finally method (not included in the test suite)
	promisesFinallyTests.mocha( Awaitable );

	//
	// complete coverage after standard test suites
	// TODO: separate into standalone testing library, call like awaitableTests( Awaitable )
	//

	describe( ".resolve", function () {
		it( "Returns an Awaitable in a fulfilled state", function () {
			Awaitable.resolve<undefined>(undefined).label().should.match( /Awaitable<\d{10}.\d{3}-\d{4}:FULFILLED>/ );
		} );
	} );

	describe( ".reject", function () {
		it( "Returns an Awaitable in a rejected state", function () {
			Awaitable.reject<undefined>(undefined).label().should.match( /Awaitable<\d{10}.\d{3}-\d{4}:REJECTED >/ );
		} );
	} );

	describe( "._newID", function () {
		it( "Increases 4-digit sequence number portion of ID", function () {
			const num1 = +Awaitable.resolve<undefined>(undefined).label().match( /Awaitable<\d+.\d+-(\d{4}):FULFILLED>/ )![1];
			const num2 = +Awaitable.resolve<undefined>(undefined).label().match( /Awaitable<\d+.\d+-(\d{4}):FULFILLED>/ )![1];
			expect(num2).to.be.above(num1);
		} );
		it( "Rolls over to zero when 4-digit sequence number portion of ID reaches 5 digits", function () {
			(Awaitable as any)._nextSuffix = 9999; // tslint:disable-line:no-any no-magic-numbers // use any to break encapsulation; magic number is rollover threshold
			const num1 = Awaitable.resolve<undefined>(undefined).label().match( /Awaitable<\d+.\d+-(\d{4}):FULFILLED>/ )![1];
			const num2 = Awaitable.resolve<undefined>(undefined).label().match( /Awaitable<\d+.\d+-(\d{4}):FULFILLED>/ )![1];
			expect(num1).to.equal("9999");
			expect(num2).to.equal("0000");
		} );
	} );

	describe( "#then", function () {
		it( "When called on an Awaitable in an invalid state, Rejects with Error", function () {
			const subject1 = new DeferredAwaitable<undefined>();
			subject1.fault_invalid_state();
			const subject2 = subject1.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => {
					expect( reason ).to.be.an( "Error" );
					(reason as Error).message.should.match( /Awaitable<\d{10}.\d{3}-\d{4}:undefined>.then: invalid state \(string\) INJECTED-FAULT--INVALID-STATE => undefined/ );
				},
			);
			subject1.resolve(undefined);
			return subject2;
		} );
	} );

	describe( "#finally", function () {
		it( "When called on an Awaitable which rejects, When given an onfinally which returns a non-thenable, Returns an Awaitable which rejects", function () {
			const originalReason = { reason: "ORIGINAL REASON" };
			const subject = Awaitable.reject<typeof originalReason>(originalReason).finally( ()=>undefined );
			return subject.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => { expect( reason ).to.equal( originalReason ); },
			);
		} );
	} );

	describe( "#_resolve", function () {

		it( "When called on a pending Awaitable, When given a non-thenable value, When an onFulfilled has been attached, Catches any internal error thrown when running onFulfilled", function () {
			const originalValue = { value: "ORIGINAL VALUE" }; // non-thenable value
			const subject1 = new DeferredAwaitable<typeof originalValue>(); // pending Awaitable
			let calledFulfill2 = 0;
			let calledReject2 = 0;
			const fulfill2: AwaitableCallbackFulfilled<typeof originalValue,void> = ( value  ) => { calledFulfill2++; throw new Error( `TEST FAILED - Fulfilled when it should remain pending - (${typeof value }) ${value }` ); };
			const reject2:  AwaitableCallbackRejected< typeof originalValue,void> = ( reason ) => { calledReject2++; throw new Error( `TEST FAILED - Rejected when it should remain pending - (${ typeof reason}) ${reason}` ); };
			const subject2 = subject1.then( fulfill2, reject2 ); // attach onFulfilled
			subject1.fault_throw_internal_onfulfilled(); // thrown internal error in place of onFulfilled
			const subject3 = subject1.then(
				( value ) => { throw new Error( "THROWN FROM OnFULFILLED" ); },
				( reason ) => { throw new Error( `TEST FAILED - Rejected when it should have fulfilled - (${typeof reason}) ${reason}` ); },
			);
			const subject4 = subject1.then(
				( value ) => { expect( value ).to.equal( originalValue ); expect( calledFulfill2 ).to.equal( 0 ); expect( calledReject2 ).to.equal( 0 ); },
				( reason ) => { throw new Error( `TEST FAILED - Rejected when it should have fulfilled - (${typeof reason}) ${reason}` ); },
			);
			subject1.resolve( originalValue );
			return subject4;
		} );

		it( "When called on an Awaitable in an invalid state, Rejects with Error", function () {
			const originalValue = { reason: "ORIGINAL VALUE" };
			const subject1 = new DeferredAwaitable<typeof originalValue>();
			const subject2 = subject1.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => {
					expect( reason ).to.be.an( "Error" );
					(reason as Error).message.should.match( /Awaitable<\d{10}.\d{3}-\d{4}:undefined>._resolve: invalid state \(string\) INJECTED-FAULT--INVALID-STATE => undefined/ );
				},
			);
			subject1.fault_invalid_state();
			subject1.resolve(originalValue);
			return subject2;
		} );

	} );

	describe( "#_reject", function () {

		it( "When called on a pending Awaitable, When an onRejected has been attached, Catches any internal error thrown when running onRejected", function () {
			const originalReason = new Error( "ORIGINAL REASON" );
			const subject1 = new DeferredAwaitable<void>(); // pending awaitable
			let calledFulfill2 = 0;
			let calledReject2 = 0;
			const fulfill2: AwaitableCallbackFulfilled<void,void> = ( value ) => { calledFulfill2++; throw new Error( `TEST FAILED - Fulfilled when it should remain pending - (${typeof value}) ${value}` ); };
			const reject2: AwaitableCallbackRejected<void,void> = ( reason ) => { calledReject2++; throw new Error( `TEST FAILED - Rejected when it should remain pending - (${typeof reason}) ${reason}` ); };
			const subject2 = subject1.then( fulfill2, reject2 ); // attach onRejected
			subject1.fault_throw_internal_onrejected(); // thrown internal error in place of onRejected
			const subject3 = subject1.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => { throw new Error( "THROWN FROM OnREJECTED" ); },
			);
			const subject4 = subject1.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => { expect( reason ).to.equal( originalReason ); expect( calledFulfill2 ).to.equal( 0 ); expect( calledReject2 ).to.equal( 0 ); },
			);
			subject1.reject( originalReason );
			return subject4;
		} );

		it( "When called on an Awaitable in an invalid state, Rejects with Error", function () {
			const originalReason = new Error( "ORIGINAL REASON" );
			const subject1 = new DeferredAwaitable<void>();
			const subject2 = subject1.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => {
					expect( reason ).to.be.an( "Error" );
					expect( reason ).not.to.equal( originalReason );
					(reason as Error).message.should.match( /Awaitable<\d{10}.\d{3}-\d{4}:undefined>._reject: invalid state \(string\) INJECTED-FAULT--INVALID-STATE => undefined/ );
				},
			);
			subject1.fault_invalid_state();
			subject1.reject(originalReason);
			return subject2;
		} );

	} );

} );

describe( "DeferredAwaitable", function () {
	describe( "#toString", function () {
		it( "Returns a correctly formatted identifying string", function () {
			const subject = new DeferredAwaitable<void>();
			subject.toString().should.match( /\[object DeferredAwaitable<\d{10}.\d{3}-\d{4}:.{9}>\]/ );
		} );
	} );
	describe( "#then", function () {
		const originalValue = { value: "ORIGINAL VALUE" };
		const subject1 = new DeferredAwaitable<typeof originalValue>();
		const subject2 = subject1.then( (value) => { expect(value).to.equal(originalValue); } );
		subject1.resolve(originalValue);
		return subject2;
	} );
	describe( "#catch", function () {
		const originalReason = { reason: "ORIGINAL REASON" };
		const subject1 = new DeferredAwaitable<void>();
		const subject2 = subject1.catch( (reason) => { expect(reason).to.equal(originalReason); } );
		subject1.reject(originalReason);
		return subject2;
	} );
	describe( "#finally", function () {
		const subject1 = new DeferredAwaitable<undefined>();
		const subject2 = subject1.finally( () => { return; } );
		subject1.resolve(undefined);
		return subject2;
	} );
} );
