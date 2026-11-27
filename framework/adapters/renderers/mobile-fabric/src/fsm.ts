import type { ResponderEvent } from "@ng-native/fabric"

export const PRESS_RETENTION = { top: 20, left: 20, right: 20, bottom: 30 } as const
export const PRESS_CANCEL_DISTANCE = 15

export type Point = Readonly<{ x: number; y: number }>
export type Size = Readonly<{ width: number; height: number }>

export const touchPoint = (event: ResponderEvent): Point => {
  const native = (event.nativeEvent ?? {}) as {
    pageX?: number
    pageY?: number
    touches?: ReadonlyArray<{ pageX?: number; pageY?: number }>
  }
  const touch = native.touches?.[0]
  return {
    x: native.pageX ?? touch?.pageX ?? 0,
    y: native.pageY ?? touch?.pageY ?? 0
  }
}

const isStillOnControl = (size: Size | undefined, dx: number, dy: number): boolean => {
  if (size === undefined) return Math.hypot(dx, dy) <= PRESS_CANCEL_DISTANCE
  const horizontal = dx < 0 ? PRESS_RETENTION.left : PRESS_RETENTION.right
  const vertical = dy < 0 ? PRESS_RETENTION.top : PRESS_RETENTION.bottom
  return Math.abs(dx) <= size.width + horizontal && Math.abs(dy) <= size.height + vertical
}

/**
 * Explicit touch pressability gesture state machine:
 * Idle -> Pressed { origin } -> (Cancelled | Idle [emit press])
 */
export type PressGestureState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Pressed"; readonly origin: Point }
  | { readonly _tag: "Cancelled" }

export const initialPressGesture: PressGestureState = { _tag: "Idle" }

export const pressGrant = (origin: Point): PressGestureState => ({
  _tag: "Pressed",
  origin
})

export const pressMove = (
  state: PressGestureState,
  point: Point,
  size: Size | undefined
): PressGestureState => {
  if (state._tag !== "Pressed") return state
  return isStillOnControl(size, point.x - state.origin.x, point.y - state.origin.y)
    ? state
    : { _tag: "Cancelled" }
}

export const pressRelease = (
  state: PressGestureState
): { readonly next: PressGestureState; readonly shouldEmitPress: boolean } => ({
  next: initialPressGesture,
  shouldEmitPress: state._tag === "Pressed"
})

export const pressTerminate = (): PressGestureState => initialPressGesture

/**
 * Explicit controlled TextInput lifecycle state machine:
 * Active -> Disposed (terminal; guards deferred animation-frame reconciliation).
 */
export type TextFieldLifecycle =
  | {
      readonly _tag: "Active"
      desiredValue: string | undefined
      lastNativeText: string | undefined
      eventCount: number
      writtenEventCount: number | undefined
    }
  | { readonly _tag: "Disposed" }

export const createActiveTextField = (): Extract<TextFieldLifecycle, { _tag: "Active" }> => ({
  _tag: "Active",
  desiredValue: undefined,
  lastNativeText: undefined,
  eventCount: 0,
  writtenEventCount: undefined
})
