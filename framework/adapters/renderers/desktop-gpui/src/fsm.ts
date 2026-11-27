export const NUDGE = "\u200b"

/**
 * Controlled GPUI text-field value synchronization state machine:
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

const synced = (native: string, sent = native): InputValueState => ({
  _tag: "Synced",
  native,
  sent
})

export const transitionInputValue = (
  state: InputValueState,
  event: InputValueEvent
): InputValueTransition => {
  if (event._tag === "Detach") {
    return { next: DETACHED, effect: NOOP }
  }

  switch (state._tag) {
    case "Uninitialized":
      if (event._tag === "SyncDesired") {
        return { next: synced(event.desired), effect: { _tag: "Set", value: event.desired } }
      }
      if (event._tag === "ReceiveNative") {
        const cleanValue = event.rawValue ?? ""
        return { next: synced(cleanValue), effect: { _tag: "EmitNativeChange", cleanValue } }
      }
      return { next: state, effect: NOOP }

    case "Synced":
      if (event._tag === "SyncDesired") {
        if (state.native === event.desired && state.sent === event.desired) {
          return { next: state, effect: NOOP }
        }
        if (state.sent !== event.desired) {
          return { next: synced(event.desired), effect: { _tag: "Set", value: event.desired } }
        }
        const nudged = event.desired + NUDGE
        return {
          next: { _tag: "Nudged", desired: event.desired, nudged },
          effect: { _tag: "NudgeThenReset", nudged, desired: event.desired }
        }
      }
      if (event._tag === "ReceiveNative") {
        const cleanValue = event.rawValue ?? ""
        return {
          next: synced(cleanValue, state.sent),
          effect: { _tag: "EmitNativeChange", cleanValue }
        }
      }
      return { next: state, effect: NOOP }

    case "Nudged":
      if (event._tag === "SyncDesired") {
        return state.nudged === event.desired
          ? { next: state, effect: NOOP }
          : { next: synced(event.desired), effect: { _tag: "Set", value: event.desired } }
      }
      if (event._tag === "CompleteNudge") {
        return state.nudged === event.expectedNudged
          ? { next: synced(state.desired), effect: { _tag: "ResetAfterNudge", value: state.desired } }
          : { next: state, effect: NOOP }
      }
      if (event._tag === "ReceiveNative") {
        const cleanValue = event.rawValue?.replace(NUDGE, "") ?? ""
        return {
          next: synced(cleanValue, state.nudged),
          effect: { _tag: "EmitNativeChange", cleanValue }
        }
      }
      return { next: state, effect: NOOP }

    case "Detached":
      return event._tag === "ReceiveNative"
        ? { next: state, effect: { _tag: "EmitNativeChange", cleanValue: event.rawValue ?? "" } }
        : { next: state, effect: NOOP }

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
  const { next, effect } = transitionInputValue(state, { _tag: "SyncDesired", desired })
  return {
    next,
    action:
      effect._tag === "Set" || effect._tag === "NudgeThenReset"
        ? effect
        : { _tag: "Noop" }
  }
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
      return rawValue !== undefined ? rawValue.replace(NUDGE, "") : state.desired
    case "Synced":
      return rawValue ?? state.native
    case "Uninitialized":
    case "Detached":
      return rawValue ?? ""
  }
}
