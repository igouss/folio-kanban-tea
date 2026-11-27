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

export const syncDesiredInputValue = (
  state: InputValueState,
  desired: string
): { readonly next: InputValueState; readonly action: InputSyncAction } => {
  switch (state._tag) {
    case "Detached":
      return { next: state, action: { _tag: "Noop" } }
    case "Uninitialized":
      return {
        next: { _tag: "Synced", native: desired, sent: desired },
        action: { _tag: "Set", value: desired }
      }
    case "Synced": {
      if (state.native === desired && state.sent === desired) {
        return { next: state, action: { _tag: "Noop" } }
      }
      if (state.sent !== desired) {
        return {
          next: { _tag: "Synced", native: desired, sent: desired },
          action: { _tag: "Set", value: desired }
        }
      }
      const nudged = desired + NUDGE
      return {
        next: { _tag: "Nudged", desired, nudged },
        action: { _tag: "NudgeThenReset", nudged, desired }
      }
    }
    case "Nudged": {
      if (state.nudged === desired) {
        return { next: state, action: { _tag: "Noop" } }
      }
      return {
        next: { _tag: "Synced", native: desired, sent: desired },
        action: { _tag: "Set", value: desired }
      }
    }
  }
}

export const completeInputNudge = (
  state: InputValueState,
  expectedNudged: string
): { readonly next: InputValueState; readonly resetValue: string | undefined } => {
  if (state._tag !== "Nudged" || state.nudged !== expectedNudged) {
    return { next: state, resetValue: undefined }
  }
  return {
    next: { _tag: "Synced", native: state.desired, sent: state.desired },
    resetValue: state.desired
  }
}

export const receiveNativeInputValue = (
  state: InputValueState,
  rawValue: string | undefined
): { readonly next: InputValueState; readonly cleanValue: string } => {
  const cleanValue =
    state._tag === "Nudged" && rawValue !== undefined
      ? rawValue.replace(NUDGE, "")
      : (rawValue ?? "")
  if (state._tag === "Detached") {
    return { next: state, cleanValue }
  }
  const sent =
    state._tag === "Synced"
      ? state.sent
      : state._tag === "Nudged"
        ? state.nudged
        : cleanValue
  return {
    next: { _tag: "Synced", native: cleanValue, sent },
    cleanValue
  }
}

export const readSubmittedInputValue = (
  state: InputValueState,
  rawValue: string | undefined
): string => {
  if (state._tag === "Nudged" && rawValue !== undefined) {
    return rawValue.replace(NUDGE, "")
  }
  if (rawValue !== undefined) return rawValue
  if (state._tag === "Synced") return state.native
  if (state._tag === "Nudged") return state.desired
  return ""
}
