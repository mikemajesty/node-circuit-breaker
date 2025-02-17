import OpossumCircuitBreaker, { Options } from "opossum";

const events = new Map<string, Map<string, Map<string, string>>>();

/**
 * Decorator to map events to methods. This allows event-specific methods to be invoked automatically when the circuit breaker state changes.
 * It also accepts a circuitId to differentiate events for multiple circuit breakers.
 */

export function onEvent({ eventName, circuitGroup = "default" }: Types.OnEventInput) {
  return function (target: Object, propertyKey: string | symbol): void {
    const className = target.constructor.name;

    if (!events.has(className)) {
      events.set(className, new Map());
    }

    const classEvents = events.get(className)!;
    if (!classEvents.has(circuitGroup ?? "default")) {
      classEvents.set(circuitGroup ?? "default", new Map());
    }

    const circuitEvents = classEvents.get(circuitGroup ?? "default")!;
    circuitEvents.set(eventName, propertyKey.toString());
  };
}

const MAX_EXECUTION_TIME_MS = 1000;
const ERROR_THRESHOLD_PERCENTAGE = 20;
const CIRCUIT_RESET_TIMEOUT_MS = 5000;
const MIN_REQUEST_COUNT = 5;

/**
 * Main Circuit Breaker decorator. It initializes a circuit breaker for each method it decorates and handles its events.
 */
export function CircuitBreaker(params: Types.CircuitBreakerInput = { options: {}, circuitGroup: 'default' }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const opt
    : Options = {
      ...params?.options ?? {},
      timeout: params?.options?.timeout ?? MAX_EXECUTION_TIME_MS,
      errorThresholdPercentage: params?.options?.errorThresholdPercentage ?? ERROR_THRESHOLD_PERCENTAGE,
      resetTimeout: params?.options?.resetTimeout ?? CIRCUIT_RESET_TIMEOUT_MS,
      volumeThreshold: params?.options?.volumeThreshold ?? MIN_REQUEST_COUNT,
      group: params?.circuitGroup ?? 'default'
    };

    const originalMethod = descriptor.value;
    const breaker = new OpossumCircuitBreaker(originalMethod, opt);

    const className = target.constructor.name;
    const classEvents = events.get(className) || new Map();
    const circuitEvents = classEvents.get(opt.group) || new Map();
    const registeredEvents = new Set<string>();

    const fallbackMethod = circuitEvents.get("fallback");

    for (const [eventName, methodName] of circuitEvents) {
      if (eventName === "fallback" && fallbackMethod) {
        continue;
      }

      const eventHandler = target[methodName];
      if (typeof eventHandler === "function" && !registeredEvents.has(methodName)) {
        registeredEvents.add(methodName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        breaker.on(eventName as any, async (...args: unknown[]) => {
          return eventHandler.call(target, ...args);
        });
      }
    }

    if (fallbackMethod && typeof target[fallbackMethod] === "function") {
      breaker.fallback(async (args: unknown, error: Error) => {
        return await target[fallbackMethod].call(target, { input: args, err: error });
      });
    }

    descriptor.value = function (...args: unknown[]) {
      return breaker.fire(...args);
    };
  };
}


export namespace Types {

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

/**
 * Supported events for the Circuit Breaker (Opossum).
 * When used with `@withEvent`, annotated methods will be triggered automatically
 * when the Circuit Breaker enters any of these states.
 */
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

}