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
 * Touch pressability gesture state machine:
 * Idle -> Pressed { origin } -> (Cancelled | Idle [emit press])
 */
export type PressGestureState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Pressed"; readonly origin: Point }
  | { readonly _tag: "Cancelled" }

export type PressGestureEvent =
  | { readonly _tag: "Grant"; readonly origin: Point }
  | { readonly _tag: "Move"; readonly point: Point; readonly size: Size | undefined }
  | { readonly _tag: "Release" }
  | { readonly _tag: "Terminate" }

export interface PressGestureTransition {
  readonly next: PressGestureState
  readonly shouldEmitPress: boolean
}

export const initialPressGesture: PressGestureState = { _tag: "Idle" }

export const transitionPressGesture = (
  state: PressGestureState,
  event: PressGestureEvent
): PressGestureTransition => {
  switch (event._tag) {
    case "Grant":
      return { next: { _tag: "Pressed", origin: event.origin }, shouldEmitPress: false }
    case "Move":
      if (state._tag !== "Pressed") return { next: state, shouldEmitPress: false }
      return {
        next: isStillOnControl(
          event.size,
          event.point.x - state.origin.x,
          event.point.y - state.origin.y
        )
          ? state
          : { _tag: "Cancelled" },
        shouldEmitPress: false
      }
    case "Release":
      return { next: initialPressGesture, shouldEmitPress: state._tag === "Pressed" }
    case "Terminate":
      return { next: initialPressGesture, shouldEmitPress: false }
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}

export const pressGrant = (origin: Point): PressGestureState =>
  transitionPressGesture(initialPressGesture, { _tag: "Grant", origin }).next

export const pressMove = (
  state: PressGestureState,
  point: Point,
  size: Size | undefined
): PressGestureState =>
  transitionPressGesture(state, { _tag: "Move", point, size }).next

export const pressRelease = (state: PressGestureState): PressGestureTransition =>
  transitionPressGesture(state, { _tag: "Release" })

export const pressTerminate = (
  state: PressGestureState = initialPressGesture
): PressGestureState =>
  transitionPressGesture(state, { _tag: "Terminate" }).next

/**
 * Controlled TextInput lifecycle state machine:
 * Active -> Disposed (terminal; guards deferred animation-frame reconciliation).
 */
export type TextFieldLifecycle =
  | {
      readonly _tag: "Active"
      readonly desiredValue: string | undefined
      readonly lastNativeText: string | undefined
      readonly eventCount: number
      readonly writtenEventCount: number | undefined
    }
  | { readonly _tag: "Disposed" }

export type TextFieldEvent =
  | { readonly _tag: "SetDesired"; readonly desired: string | undefined }
  | { readonly _tag: "ReceiveNative"; readonly text: string; readonly eventCount: number | undefined }
  | { readonly _tag: "Reconcile" }
  | { readonly _tag: "Dispose" }

export type TextFieldEffect =
  | { readonly _tag: "SetTextProp"; readonly text: string | null }
  | { readonly _tag: "SetMostRecentEventCount"; readonly eventCount: number }
  | { readonly _tag: "SchedulePostCommitReconcile" }
  | { readonly _tag: "EmitChangeText"; readonly text: string }
  | { readonly _tag: "ScheduleFrameReconcile" }
  | { readonly _tag: "DispatchSetTextAndSelection"; readonly eventCount: number; readonly text: string }

export interface TextFieldTransition {
  readonly next: TextFieldLifecycle
  readonly effects: ReadonlyArray<TextFieldEffect>
}

const NO_TEXT_FIELD_EFFECTS: ReadonlyArray<TextFieldEffect> = []
const DISPOSED_TEXT_FIELD: TextFieldLifecycle = { _tag: "Disposed" }

export const createActiveTextField = (): Extract<TextFieldLifecycle, { _tag: "Active" }> => ({
  _tag: "Active",
  desiredValue: undefined,
  lastNativeText: undefined,
  eventCount: 0,
  writtenEventCount: undefined
})

export const transitionTextField = (
  state: TextFieldLifecycle,
  event: TextFieldEvent
): TextFieldTransition => {
  if (state._tag === "Disposed") {
    return { next: state, effects: NO_TEXT_FIELD_EFFECTS }
  }

  switch (event._tag) {
    case "SetDesired": {
      const effects: Array<TextFieldEffect> = []
      if (state.desiredValue !== event.desired) {
        effects.push({ _tag: "SetTextProp", text: event.desired ?? null })
      }
      const needsEventCount = state.writtenEventCount !== state.eventCount
      if (needsEventCount) {
        effects.push({ _tag: "SetMostRecentEventCount", eventCount: state.eventCount })
      }
      effects.push({ _tag: "SchedulePostCommitReconcile" })
      return {
        next: {
          ...state,
          desiredValue: event.desired,
          lastNativeText: state.lastNativeText === undefined ? event.desired : state.lastNativeText,
          writtenEventCount: needsEventCount ? state.eventCount : state.writtenEventCount
        },
        effects
      }
    }
    case "ReceiveNative":
      return {
        next: {
          ...state,
          lastNativeText: event.text,
          eventCount: event.eventCount ?? state.eventCount + 1
        },
        effects: [
          { _tag: "EmitChangeText", text: event.text },
          { _tag: "ScheduleFrameReconcile" }
        ]
      }
    case "Reconcile": {
      const desired = state.desiredValue
      if (desired === undefined || state.lastNativeText === desired) {
        return { next: state, effects: NO_TEXT_FIELD_EFFECTS }
      }
      return {
        next: { ...state, lastNativeText: desired },
        effects: [{ _tag: "DispatchSetTextAndSelection", eventCount: state.eventCount, text: desired }]
      }
    }
    case "Dispose":
      return { next: DISPOSED_TEXT_FIELD, effects: NO_TEXT_FIELD_EFFECTS }
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}

export const readTextFieldFallback = (state: TextFieldLifecycle): string =>
  state._tag === "Active" ? (state.lastNativeText ?? state.desiredValue ?? "") : ""

/**
 * Fabric surface registration lifecycle state machine:
 * Stopped <-> Running { surfaceId, dispose }.
 */
export type RegistrationState =
  | { readonly _tag: "Stopped" }
  | { readonly _tag: "Running"; readonly surfaceId: number; readonly dispose: () => void }

export type RegistrationEvent =
  | { readonly _tag: "Start"; readonly surfaceId: number; readonly dispose: () => void }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "StopSurface"; readonly surfaceId: number }

export interface RegistrationTransition {
  readonly next: RegistrationState
  readonly disposeToRun: (() => void) | undefined
}

export const initialRegistrationState: RegistrationState = { _tag: "Stopped" }

export const transitionRegistration = (
  state: RegistrationState,
  event: RegistrationEvent
): RegistrationTransition => {
  switch (event._tag) {
    case "Start":
      return {
        next: { _tag: "Running", surfaceId: event.surfaceId, dispose: event.dispose },
        disposeToRun: state._tag === "Running" ? state.dispose : undefined
      }
    case "Stop":
      return {
        next: initialRegistrationState,
        disposeToRun: state._tag === "Running" ? state.dispose : undefined
      }
    case "StopSurface":
      return state._tag === "Running" && state.surfaceId === event.surfaceId
        ? { next: initialRegistrationState, disposeToRun: state.dispose }
        : { next: state, disposeToRun: undefined }
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}
