declare module "node:assert/strict" {
  const assert: {
    equal<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T
    deepEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T
    ok(value: unknown, message?: string | Error): asserts value
  }
  export default assert
}

declare module "node:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void
  export function it(name: string, fn: () => void | Promise<void>): void
}
