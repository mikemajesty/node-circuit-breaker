import { Types } from './circuit-breaker.decorator';

declare module "circuit-breaker" {

  /**
   * Decorator to bind an event listener to a circuit breaker event.
   * 
   * @param params - Object containing the event name and an optional circuit breaker group.
   * @param params.eventName - The name of the circuit breaker event to listen for.
   * @param params.circuitGroup - (Optional) The circuit breaker group to associate the event with.
   * @returns A method decorator that binds the event to the target method.
   *
   * @example
   * ```typescript
   * class MyService {
   *   @onEvent({ eventName: "open", circuitGroup: "database" })
   *   handleCircuitOpen() {
   *     console.log("Circuit breaker opened!");
   *   }
   * }
   * ```
   */
  export function onEvent({ eventName, circuitGroup }: Types.OnEventInput): MethodDecorator;

  /**
   * Decorator to wrap a method with a circuit breaker.
   * 
   * @param params - Configuration options for the circuit breaker.
   * @param params.options - (Optional) Circuit breaker options from the `opossum` library.
   * @param params.circuitGroup - (Optional) A group identifier for organizing circuit breakers.
   * @returns A method decorator that applies the circuit breaker logic to the target method.
   *
   * @example
   * ```typescript
   * class MyService {
   *   @CircuitBreaker({ options: { timeout: 5000 }, circuitGroup: "apiRequests" })
   *   async fetchData() {
   *     return await axios.get("https://api.example.com/data");
   *   }
   * }
   * ```
   */
  export function CircuitBreaker(params: Types.CircuitBreakerInput): MethodDecorator;
}
