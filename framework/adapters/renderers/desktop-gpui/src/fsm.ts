export const NUDGE = "\u200b"

/**
 * Explicit controlled GPUI text-field value synchronization state machine:
 * Uninitialized -> Synced <-> Nudged -> Detached (terminal).
 */
export type InputValueState =
  | { readonly _tag: "Uninitialized" }
  | { readonly _tag: "Synced"; readonly native: string; readonly sent: string }
  | { readonly _tag: "Nudged"; readonly desired: string; readonly nudged: string }
  | { readonly _tag: "Detached" }

export const initialInputValueState: InputValueState = { _tag: "Uninitialized" }

export type InputSyncAction =
  | { readonly _tag: "Noop" }
  | { readonly _tag: "Set"; readonly value: string }
  | { readonly _tag: "NudgeThenReset"; readonly nudged: string; readonly desired: string }

export type InputValueEvent =
  | { readonly _tag: "SyncDesired"; readonly desired: string }
  | { readonly _tag: "CompleteNudge"; readonly expectedNudged: string }
  | { readonly _tag: "ReceiveNative"; readonly rawValue: string | undefined }
  | { readonly _tag: "Detach" }

export type InputValueEffect =
  | InputSyncAction
  | { readonly _tag: "ResetAfterNudge"; readonly value: string }
  | { readonly _tag: "EmitNativeChange"; readonly cleanValue: string }

export interface InputValueTransition {
  readonly next: InputValueState
  readonly effect: InputValueEffect
}

const NOOP: InputValueEffect = { _tag: "Noop" }
const DETACHED: InputValueState = { _tag: "Detached" }

const exhaustiveEvent = (event: never): InputValueTransition => event

/**
 * State-first finite state machine for controlled GPUI text inputs.
 * Switching on `state._tag` first and exhaustively matching `event._tag`
 * guarantees every `(state, event)` pair is handled explicitly.
 */
export const transitionInputValue = (
  state: InputValueState,
  event: InputValueEvent
): InputValueTransition => {
  switch (state._tag) {
    case "Uninitialized":
      switch (event._tag) {
        case "SyncDesired":
          return {
            next: { _tag: "Synced", native: event.desired, sent: event.desired },
            effect: { _tag: "Set", value: event.desired }
          }
        case "ReceiveNative": {
          const cleanValue = event.rawValue ?? ""
          return {
            next: { _tag: "Synced", native: cleanValue, sent: cleanValue },
            effect: { _tag: "EmitNativeChange", cleanValue }
          }
        }
        case "CompleteNudge":
          return { next: state, effect: NOOP }
        case "Detach":
          return { next: DETACHED, effect: NOOP }
        default:
          return exhaustiveEvent(event)
      }

    case "Synced":
      switch (event._tag) {
        case "SyncDesired": {
          if (state.native === event.desired && state.sent === event.desired) {
            return { next: state, effect: NOOP }
          }
          if (state.sent !== event.desired) {
            return {
              next: { _tag: "Synced", native: event.desired, sent: event.desired },
              effect: { _tag: "Set", value: event.desired }
            }
          }
          const nudged = event.desired + NUDGE
          return {
            next: { _tag: "Nudged", desired: event.desired, nudged },
            effect: { _tag: "NudgeThenReset", nudged, desired: event.desired }
          }
        }
        case "ReceiveNative": {
          const cleanValue = event.rawValue ?? ""
          return {
            next: { _tag: "Synced", native: cleanValue, sent: state.sent },
            effect: { _tag: "EmitNativeChange", cleanValue }
          }
        }
        case "CompleteNudge":
          return { next: state, effect: NOOP }
        case "Detach":
          return { next: DETACHED, effect: NOOP }
        default:
          return exhaustiveEvent(event)
      }

    case "Nudged":
      switch (event._tag) {
        case "SyncDesired":
          if (state.nudged === event.desired) {
            return { next: state, effect: NOOP }
          }
          return {
            next: { _tag: "Synced", native: event.desired, sent: event.desired },
            effect: { _tag: "Set", value: event.desired }
          }
        case "CompleteNudge":
          if (state.nudged !== event.expectedNudged) {
            return { next: state, effect: NOOP }
          }
          return {
            next: { _tag: "Synced", native: state.desired, sent: state.desired },
            effect: { _tag: "ResetAfterNudge", value: state.desired }
          }
        case "ReceiveNative": {
          const cleanValue =
            event.rawValue !== undefined
              ? event.rawValue.replace(NUDGE, "")
              : ""
          return {
            next: { _tag: "Synced", native: cleanValue, sent: state.nudged },
            effect: { _tag: "EmitNativeChange", cleanValue }
          }
        }
        case "Detach":
          return { next: DETACHED, effect: NOOP }
        default:
          return exhaustiveEvent(event)
      }

    case "Detached":
      switch (event._tag) {
        case "SyncDesired":
        case "CompleteNudge":
        case "Detach":
          return { next: state, effect: NOOP }
        case "ReceiveNative":
          return {
            next: state,
            effect: { _tag: "EmitNativeChange", cleanValue: event.rawValue ?? "" }
          }
        default:
          return exhaustiveEvent(event)
      }

    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}

export const syncDesiredInputValue = (
  state: InputValueState,
  desired: string
): { readonly next: InputValueState; readonly action: InputSyncAction } => {
  const { next, effect } = transitionInputValue(state, {
    _tag: "SyncDesired",
    desired
  })
  const action: InputSyncAction =
    effect._tag === "Set" || effect._tag === "NudgeThenReset"
      ? effect
      : { _tag: "Noop" }
  return { next, action }
}

export const completeInputNudge = (
  state: InputValueState,
  expectedNudged: string
): { readonly next: InputValueState; readonly resetValue: string | undefined } => {
  const { next, effect } = transitionInputValue(state, {
    _tag: "CompleteNudge",
    expectedNudged
  })
  return {
    next,
    resetValue: effect._tag === "ResetAfterNudge" ? effect.value : undefined
  }
}

export const receiveNativeInputValue = (
  state: InputValueState,
  rawValue: string | undefined
): { readonly next: InputValueState; readonly cleanValue: string } => {
  const { next, effect } = transitionInputValue(state, {
    _tag: "ReceiveNative",
    rawValue
  })
  return {
    next,
    cleanValue: effect._tag === "EmitNativeChange" ? effect.cleanValue : ""
  }
}

export const detachInputValue = (state: InputValueState): InputValueState =>
  transitionInputValue(state, { _tag: "Detach" }).next

export const readSubmittedInputValue = (
  state: InputValueState,
  rawValue: string | undefined
): string => {
  switch (state._tag) {
    case "Nudged":
      return rawValue !== undefined
        ? rawValue.replace(NUDGE, "")
        : state.desired
    case "Synced":
      return rawValue ?? state.native
    case "Uninitialized":
    case "Detached":
      return rawValue ?? ""
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}
