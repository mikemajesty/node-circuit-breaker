import { Types } from './circuit-breaker.decorator';

declare module "circuit-breaker" {
/**
   * @param {Types.OnEventInput} params.
   */
 export function onEvent({ eventName, circuitGroup }: Types.OnEventInput): MethodDecorator;

 /**
  * @param {Types.CircuitBreakerInput} params
  */
 export function CircuitBreaker(params: Types.CircuitBreakerInput): MethodDecorator;
}