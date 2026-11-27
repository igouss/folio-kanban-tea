/**
 * Explicit pointer interaction state machine for DOM elements:
 * Idle <-> Hovered <-> Pressed, plus Disabled (blocks hover/press transitions).
 */
export type PointerState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Hovered" }
  | { readonly _tag: "Pressed" }
  | { readonly _tag: "Disabled" }

export type PointerEvent =
  | "enter"
  | "leave"
  | "down"
  | "up"
  | "disable"
  | "enable"

export const initialPointerState: PointerState = { _tag: "Idle" }

const exhaustiveEvent = (event: never): PointerState => event

export const transitionPointer = (
  state: PointerState,
  event: PointerEvent
): PointerState => {
  switch (state._tag) {
    case "Idle":
      switch (event) {
        case "enter":
          return { _tag: "Hovered" }
        case "down":
          return { _tag: "Pressed" }
        case "disable":
          return { _tag: "Disabled" }
        case "leave":
        case "up":
        case "enable":
          return state
        default:
          return exhaustiveEvent(event)
      }

    case "Hovered":
      switch (event) {
        case "leave":
          return { _tag: "Idle" }
        case "down":
          return { _tag: "Pressed" }
        case "disable":
          return { _tag: "Disabled" }
        case "enter":
        case "up":
        case "enable":
          return state
        default:
          return exhaustiveEvent(event)
      }

    case "Pressed":
      switch (event) {
        case "up":
          return { _tag: "Hovered" }
        case "leave":
          return { _tag: "Idle" }
        case "disable":
          return { _tag: "Disabled" }
        case "enter":
        case "down":
        case "enable":
          return state
        default:
          return exhaustiveEvent(event)
      }

    case "Disabled":
      switch (event) {
        case "enable":
          return { _tag: "Idle" }
        case "enter":
        case "leave":
        case "down":
        case "up":
        case "disable":
          return state
        default:
          return exhaustiveEvent(event)
      }

    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}
