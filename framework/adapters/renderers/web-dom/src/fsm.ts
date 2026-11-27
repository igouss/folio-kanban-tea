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

export const transitionPointer = (
  state: PointerState,
  event: PointerEvent
): PointerState => {
  switch (event) {
    case "disable":
      return { _tag: "Disabled" }
    case "enable":
      return state._tag === "Disabled" ? { _tag: "Idle" } : state
    case "enter":
      return state._tag === "Idle" ? { _tag: "Hovered" } : state
    case "leave":
      return state._tag === "Disabled" ? state : { _tag: "Idle" }
    case "down":
      return state._tag === "Disabled" ? state : { _tag: "Pressed" }
    case "up":
      return state._tag === "Pressed" ? { _tag: "Hovered" } : state
  }
}
