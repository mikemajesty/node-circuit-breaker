# Node Circuit Breaker

[![node version][node-image]][node-url]

[node-image]: https://img.shields.io/badge/node.js-%3E=_18.0-green.svg?style=flat-square
[node-url]: http://nodejs.org/download/

### Install

```
$ npm i -S node-circuit-breaker-js
```

### Usage

- Import

```ts
import { Types, CircuitBreaker, onEvent } from "node-circuit-breaker-js";
```

- Annotate the method within the class that needs to use the circuit breaker. In this case, it is used in an API that should return comments based on the post ID.

```ts
// If you need to use multiple circuit breakers within the same class, use @CircuitBreaker({ circuitGroup: "anotherName" })

@CircuitBreaker()
async getComments<T>(id: { id: string }): Promise<T | null> {
  const response = await axios.get<CommentEntity[]>(`http://localhost:4000/comments/${id.id}`)
  return response.data as T;
}
```

- Consuming circuit breaker events. These events should be consumed within the same class where the decorator was implemented.

```ts
  /**
   * Handles the fallback event when the circuit breaker is triggered due to the service being closed or an error occurring.
  * This method provides a default set of comments as a fallback response.
  *
  * @param {Object} param - The event input.
  * @param {Error} param.err - The error that occurred during the endpoint call.
  * @param {any} param.input - The input received by the method (post ID).
  * @returns {Promise<CommentEntity[]>} A default list of comments.
  */
  @onEvent({ eventName: 'fallback' })
  async fallback({ err, input }: Types.OnFallbackInput): Promise<CommentEntity[]> {
  console.log("Error that occurred during the endpoint call", err);
  console.log("Input received by the method, in this case, the post ID", input);
  return [
      new CommentEntity({ author: "1", text: "2" }),
      new CommentEntity({ author: "2", text: "3" }),
      new CommentEntity({ author: "3", text: "4" }),
  ];
  }

  /**
  * Handles the half-open event when the circuit breaker is transitioning back to a closed state.
  */
  @onEvent({ eventName: "halfOpen" })
  halfOpenEvent() {
      console.log("halfOpen event");
  }

  /**
  * Handles the close event when the circuit breaker transitions back to a closed state.
  */
  @onEvent({ eventName: "close" })
  closeEvent() {
      console.log("close event");
  }

  /**
  * Handles the open event when the circuit breaker opens due to repeated failures.
  */
  @onEvent({ eventName: "open" })
  openEvent() {
      console.log("open event");
  }
```

---

### Documentation

- Events

```ts
type EventType =
  /** The Circuit Breaker is half-open, testing whether it can close again. */
  | "halfOpen"
  /**
   * Parameters:
   * - `params`: an object containing the `resetTimeout` (in ms), representing the time to wait before attempting to re-close the breaker.
   */
  | "close"
  /** The Circuit Breaker has closed and is accepting requests normally. */
  | "open"
  /** The Circuit Breaker has opened due to failures, blocking requests. */
  | "shutdown"
  /**
   * Parameters:
   * - `params`: an object containing `args`, which are the arguments passed to the original method.
   */
  | "fire"
  /** A value has been found in the cache, and no request was made. */
  | "cacheHit"
  /** A value was not found in the cache, triggering the request to be made. */
  | "cacheMiss"
  /**
   * Parameters:
   * - `params`: an object containing `err`, which is the error that caused the rejection.
   */
  | "reject"
  /**
   * Parameters:
   * - `params`: an object containing `err`, which is the error causing the timeout.
   */
  | "timeout"
  /**
   * Parameters:
   * - `params`: an object containing the original `input` data and `latencyMs` (in ms), representing the time it took for the request to execute.
   */
  | "success"
  /**
   * Parameters:
   * - `params`: an object containing `err`, representing the error causing the semaphore to be locked.
   */
  | "semaphoreLocked"
  /**
   * Parameters:
   * - `params`: an object containing `err`, representing the error that triggered the health check failure.
   */
  | "healthCheckFailed"
  /**
   * Parameters:
   * - `params`: an object containing `input` data (any type), and `err` representing the error causing the fallback.
   * - This handler returns any value or a Promise of any value.
   */
  | "fallback"
  /**
   * Parameters:
   * - `params`: an object containing the original `args` and `latencyMs` (in ms), representing the time it took for the request to fail.
   * - `err`: the error that caused the failure.
   */
  | "failure";
```

- Circuit breaker options
```ts
      interface Options {
        /**
         * A {@link Status} object that might have pre-prime stats
         */
        status?: string | undefined;

        /**
         * The time in milliseconds that action should be allowed to execute before timing out.
         * Timeout can be disabled by setting this to `false`.
         * @default 10000 (10 seconds)
         */
        timeout?: number | false | undefined;

        /**
         * The number of times the circuit can fail before opening.
         * @default 10
         * @deprecated
         * @see {@link Options.errorThresholdPercentage}
         */
        maxFailures?: number | undefined;

        /**
         * The time in milliseconds to wait before setting the breaker to `halfOpen` state, and trying the action again.
         * @default 30000 (30 seconds)
         */
        resetTimeout?: number | undefined;

        /**
         * Sets the duration of the statistical rolling window, in milliseconds.
         * This is how long Opossum keeps metrics for the circuit breaker to use and for publishing.
         * @default 10000
         */
        rollingCountTimeout?: number | undefined;

        /**
         * Sets the number of buckets the rolling statistical window is divided into.
         * So, if `options.rollingCountTimeout` is 10,000, and `options.rollingCountBuckets` is 10, then the
         * statistical window will be 1,000 per 1 second snapshots in the statistical window.
         * @default 10
         */
        rollingCountBuckets?: number | undefined;

        /**
         * The circuit name to use when reporting stats.
         * Defaults to the name of the function this circuit controls then falls back to a UUID
         */
        name?: string | undefined;

        /**
         * (Undocumented)
         * A grouping key for reporting.
         * Defaults to the computed value of `name`
         */
        group?: string | undefined;

        /**
         * This property indicates whether execution latencies should be tracked and calculated as percentiles.
         * If they are disabled, all summary statistics (mean, percentiles) are returned as -1.
         * @default false
         */
        rollingPercentilesEnabled?: boolean | undefined;

        /**
         * The number of concurrent requests allowed.
         * If the number currently executing function calls is equal to `options.capacity`, further calls
         * to `fire()` are rejected until at least one of the current requests completes.
         * @default Number.MAX_SAFE_INTEGER
         */
        capacity?: number | undefined;

        /**
         * The error percentage at which to open the circuit and start short-circuiting requests to fallback.
         * @default 50
         */
        errorThresholdPercentage?: number | undefined;

        /**
         * Whether this circuit is enabled upon construction.
         * @default true
         */
        enabled?: boolean | undefined;

        /**
         * Determines whether to allow failures without opening the circuit during a brief warmup period (`rollingCountTimeout`)
         * This can help in situations where no matter what your `errorThresholdPercentage` is, if the
         * first execution times out or fails, the circuit immediately opens.
         * @default false
         */
        allowWarmUp?: boolean | undefined;

        /**
         * The minimum number of requests within the rolling statistical window that must exist before
         * the circuit breaker can open. This is similar to `allowWarmUp` in that no matter how many
         * failures there are, if the number of requests within the statistical window does not exceed
         * this threshold, the circuit will remain closed.
         * @default 0
         */
        volumeThreshold?: number | undefined;

        /**
         * An optional function that will be called when the circuit's function fails (returns a rejected Promise).
         * If this function returns truthy, the circuit's `failPure` statistics will not be incremented.
         * This is useful, for example, when you don't want HTTP 404 to trip the circuit, but still want to handle it as a failure case.
         */
        errorFilter?: ((err: any) => boolean) | undefined;

        /**
         * Whether the return value of the first successful execution of the circuit's function will be cached.
         * Once a value has been cached that value will be returned for every subsequent execution: the cache can be cleared using `clearCache`.
         * (The metrics cacheHit and cacheMiss reflect cache activity.)
         * @default false
         */
        cache?: boolean | undefined;

        /**
         * The cache time to live (TTL) in milliseconds.
         * The default value is 0, which means the cache will never be cleared.
         * @default 0 (no TTL)
         */
        cacheTTL?: number;

        /**
         * An optional function that will be called to generate a cache key for the circuit's function.
         * The function is passed the original `fire` arguments. If no `cacheKey` function is supplied, a `JSON.stringify` of the arguments will be used as the key.
         * @default (...args) => JSON.stringify(args)
         */
        cacheGetKey?: ((...args: TI) => string) | undefined;

    
        /**
         * Whether to enable the periodic snapshots that are emitted by the Status class.
         * Passing false will result in snapshots not being emitted
         * @default true
         */
        enableSnapshots?: boolean | undefined;
    }
```


- Input

```ts
/**
 * Input data for configuring a Circuit Breaker.
 */
export type CircuitBreakerInput = {
  /**
   * Optional configuration options for the Circuit Breaker.
   */
  options?: Options;

  /**
   * An optional identifier for grouping multiple Circuit Breakers.
   * This allows differentiation between different Circuit Breakers within the same class.
   */
  circuitGroup?: string;
};

/**
 * Input data for an event triggered by the Circuit Breaker.
 */
export type OnEventInput = {
  /**
   * The name of the event being triggered.
   */
  eventName: EventType;

  /**
   * An optional identifier for grouping multiple Circuit Breakers.
   * This ensures that the event is associated with the correct Circuit Breaker instance.
   */
  circuitGroup?: string;
};

/**
 * Input data for the `onHalfOpen` event.
 * Triggered when the Circuit Breaker is in a half-open state, attempting to test whether it can safely close.
 */
export type OnHalfOpenInput = {
  /**
   * The time (in milliseconds) to wait before attempting to re-close the circuit breaker.
   */
  resetTimeout: number;
};

/**
 * Input data for the `onFire` event.
 * Triggered when the circuit breaker fires a request, i.e., the original method is invoked.
 */
export type OnFireInput = {
  /**
   * The arguments passed to the original method when the request is fired.
   */
  args: unknown[];
};

/**
 * Input data for the `onSuccess` event.
 * Triggered when the request has successfully executed without errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OnSuccessInput<T = any> = {
  /**
   * The input data that was passed to the original method.
   */
  input: T;

  /**
   * The time (in milliseconds) it took for the request to execute.
   */
  latencyMs: number;
};

/**
 * Input data for the `onFallback` event.
 * Triggered when a fallback occurs after a failure in the original request.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OnFallbackInput<T = any> = {
  /**
   * The input data that was passed to the original method.
   */
  input: T;

  /**
   * The error that caused the fallback to trigger.
   */
  err: Error;
};

/**
 * Input data for the `onFailure` event.
 * Triggered when a request fails and the circuit breaker records the failure.
 */
export type OnFailureInput = {
  /**
   * The error that caused the failure of the request.
   */
  err: Error;

  /**
   * The time (in milliseconds) it took before the request failed.
   */
  latencyMs: number;

  /**
   * The arguments passed to the original method when the request failed.
   */
  args: unknown[];
};
```

---

The following is a list of all the people that have contributed Node Circuit Breaker. Thanks for your contributions!

[<img alt="mikemajesty" src="https://avatars1.githubusercontent.com/u/11630212?s=460&v=4&s=117" width="117">](https://github.com/mikemajesty)

## License

It is available under the MIT license.
[License](https://opensource.org/licenses/mit-license.php)