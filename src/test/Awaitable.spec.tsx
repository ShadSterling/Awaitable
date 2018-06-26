import { describe, } from "mocha"; // tslint:disable-line:no-implicit-dependencies

import * as promisesAPlusTests from "promises-aplus-tests"; // tslint:disable-line:no-implicit-dependencies

import { install } from "source-map-support"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev
install();

import { promisesFinallyTests } from "../testlib/promises-finally-tests";

import { Awaitable } from "../lib/Awaitable";

describe( "Awaitable", () => {

	// the Promises/A+ test suite
	promisesAPlusTests.mocha( Awaitable );

	// tests for the finally method (not included in the test suite)
	promisesFinallyTests.mocha( Awaitable );

} );
