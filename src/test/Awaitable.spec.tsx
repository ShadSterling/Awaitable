import { describe, } from "mocha"; // tslint:disable-line:no-implicit-dependencies

import * as promisesAPlusTests from "promises-aplus-tests"; // tslint:disable-line:no-implicit-dependencies

import { install } from "source-map-support"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev
install();

import { Awaitable } from "../lib/Awaitable";

describe( "Awaitable", () => {
	promisesAPlusTests.mocha( Awaitable );
} );
