import { describe, } from "mocha"; // tslint:disable-line:no-implicit-dependencies
import { expect } from "chai"; // tslint:disable-line:no-implicit-dependencies ordered-imports

import { install } from "source-map-support"; // tslint:disable-line:no-implicit-dependencies // it's a dev dependency; testing is part of dev
install();

import { Helpers } from "../lib/Helpers";

describe( "Helpers", () => {
	describe( "Helpers.arrayInsertArray", () => {
		it( "should make the destination array longer", async ():Promise<void> => {
			const al = ["a","b"];
			const nu = [1,2]; // tslint:disable-line:no-magic-numbers // testcase
			Helpers.arrayInsertArray<string|number>( al, nu, 1 );
			expect( al.length ).to.equal( 4 ); // tslint:disable-line:no-magic-numbers // testcase
		} );
	} );
} );
