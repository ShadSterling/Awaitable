# Awaitable

An approximately minimal [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) implementation in [Typescript](https://www.typescriptlang.org/) with copious [debug](https://www.npmjs.com/package/debug) output

I wrote this as an aside to creating a way to manage long-running tasks, which I thought might as well conform to the [Promise Spec](https://promisesaplus.com/).  After attempting to modify that code to pass the [test suite](https://github.com/promises-aplus/promises-tests) I decided it would be better to work the other way around: create a confirmant promise implementation from scratch, then add the other features to it.  This is that promise implementation, made available as a separate library prior to adding any additional features.

`npm run dopen` (in a bash shell) will install dependencies, build, test, and open the test results, coverage report, and generated documentation.  (If it doesn't work for you, please open an issue.)
