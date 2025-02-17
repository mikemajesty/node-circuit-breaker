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

```

```
