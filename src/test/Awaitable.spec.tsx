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
			const subject = Awaitable.resolve<undefined>(undefined);
			(subject as any)._state = "TESTING-INVALID-STATE"; // tslint:disable-line:no-any // use any to break encapsulation
			return subject.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => {
					expect( reason ).to.be.an( "Error" );
					(reason as Error).message.should.match( /Awaitable<\d{10}.\d{3}-\d{4}:undefined>.then: invalid state \(string\) TESTING-INVALID-STATE => undefined/ );
				},
			);
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

		it( "When called on a pending Awaitable, When given a non-thenable value, When an onFulfilled has been attached, Catches any error thrown by an onFulfilled", function () {
			const originalValue = { reason: "ORIGINAL VALUE" };
			const fromReject = new Error( "THROWN FROM REJECT" );
			const fromOnFulfilled = new Error( "THROWN FROM OnFULFILLED" );
			const subject1 = new DeferredAwaitable<typeof originalValue>();
			const subject2 = subject1.promise.then(
				( value ) => { throw fromOnFulfilled; },
				( reason ) => { throw new Error( `TEST FAILED - Rejected when it should have fulfilled - (${typeof reason}) ${reason}` ); },
			);
			(subject2 as any)._reject = () => { throw fromReject; }; // tslint:disable-line:no-any // use any to break encapsulation
			let f3Called = 0;
			let r3Called = 0;
			const fulfill3: AwaitableCallbackFulfilled<typeof originalValue,void> = ( value ) => { f3Called++; throw new Error( `TEST FAILED - Fulfilled when it should remain pending - (${typeof value}) ${value}` ); };
			const reject3: AwaitableCallbackRejected<typeof originalValue,void> = ( reason ) => { r3Called++; throw new Error( `TEST FAILED - Rejected when it should remain pending - (${typeof reason}) ${reason}` ); };
			const subject3 = subject2.then( fulfill3, reject3 );
			const subject4 = subject1.promise.then(
				( value ) => { expect( value ).to.equal( originalValue ); expect( f3Called ).to.equal( 0 ); expect( r3Called ).to.equal( 0 ); },
				( reason ) => { throw new Error( `TEST FAILED - Rejected when it should have fulfilled - (${typeof reason}) ${reason}` ); },
			);
			subject1.resolve( originalValue );
			return subject4;
		} );

		it( "When called on an Awaitable in an invalid state, Rejects with Error", function () {
			const originalValue = { reason: "ORIGINAL VALUE" };
			const subject1 = new DeferredAwaitable<typeof originalValue>();
			const subject2 = subject1.promise.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => {
					expect( reason ).to.be.an( "Error" );
					(reason as Error).message.should.match( /Awaitable<\d{10}.\d{3}-\d{4}:undefined>._resolve: invalid state \(string\) TESTING-INVALID-STATE => undefined/ );
				},
			);
			(subject1.promise as any)._state = "TESTING-INVALID-STATE"; // tslint:disable-line:no-any // use any to break encapsulation
			subject1.resolve(originalValue);
			return subject2;
		} );

	} );

	describe( "#_reject", function () {

		it( "When called on a pending Awaitable, When given a non-thenable value, When an onRejected has been attached, Catches any error thrown by an onRejected", function () {
			const originalReason = new Error( "ORIGINAL REASON" );
			const fromReject = new Error( "THROWN FROM REJECT" );
			const fromOnRejected = new Error( "THROWN FROM OnREJECTED" );
			const subject1 = new DeferredAwaitable<void>();
			const subject2 = subject1.promise.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => { throw fromOnRejected; },
			);
			(subject2 as any)._reject = () => { throw fromReject; }; // tslint:disable-line:no-any // use any to break encapsulation
			let f3Called = 0;
			let r3Called = 0;
			const fulfill3: AwaitableCallbackFulfilled<void,void> = ( value ) => { f3Called++; throw new Error( `TEST FAILED - Fulfilled when it should remain pending - (${typeof value}) ${value}` ); };
			const reject3: AwaitableCallbackRejected<void,void> = ( reason ) => { r3Called++; throw new Error( `TEST FAILED - Rejected when it should remain pending - (${typeof reason}) ${reason}` ); };
			const subject3 = subject2.then( fulfill3, reject3 );
			const subject4 = subject1.promise.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => { expect( reason ).to.equal( originalReason ); expect( f3Called ).to.equal( 0 ); expect( r3Called ).to.equal( 0 ); },
			);
			subject1.reject( originalReason );
			return subject4;
		} );

		it( "When called on an Awaitable in an invalid state, Rejects with Error", function () {
			const originalReason = new Error( "ORIGINAL REASON" );
			const subject1 = new DeferredAwaitable<void>();
			const subject2 = subject1.promise.then(
				( value ) => { throw new Error( `TEST FAILED - Fulfilled when it should have rejected - (${typeof value}) ${value}` ); },
				( reason ) => {
					expect( reason ).to.be.an( "Error" );
					expect( reason ).not.to.equal( originalReason );
					(reason as Error).message.should.match( /Awaitable<\d{10}.\d{3}-\d{4}:undefined>._reject: invalid state \(string\) TESTING-INVALID-STATE => undefined/ );
				},
			);
			(subject1.promise as any)._state = "TESTING-INVALID-STATE"; // tslint:disable-line:no-any // use any to break encapsulation
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
} );
