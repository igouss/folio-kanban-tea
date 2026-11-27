import { Component, Renderer, View } from "@effect/ui"
import type { StyleDesc } from "@gpuix/native/host"
import * as Context from "effect/Context"

export const name = "gpui" as const

export type GpuiStyle = StyleDesc
export type GpuiStateStyle = Omit<StyleDesc, "hover" | "active">

export interface GpuiNodeHandle {
  readonly id: number
  readonly tag: string
}

export class Host extends Context.Service<Host, {
  readonly focus: (node: GpuiNodeHandle) => void
  readonly blur: () => void
  readonly setWindowTitle: (title: string) => void
}>()("@folio/effect-ui-gpui/Gpui/Host") {}

declare module "@effect/ui/Command" {
  interface FrameworkServices {
    readonly GpuiHost: Host
  }
}

export interface PointerPayload {
  readonly x: number
  readonly y: number
  readonly button: number
  readonly clickCount: number
  readonly shift: boolean
  readonly ctrl: boolean
  readonly alt: boolean
  readonly meta: boolean
}

export interface KeyPayload {
  readonly key: string
  readonly keyChar: string
  readonly repeat: boolean
  readonly shift: boolean
  readonly ctrl: boolean
  readonly alt: boolean
  readonly meta: boolean
}

export interface ChangePayload {
  readonly value: string
}

export interface ScrollPayload {
  readonly deltaX: number
  readonly deltaY: number
}

export interface CommonEvents {
  readonly click: PointerPayload
  readonly mouseDown: PointerPayload
  readonly mouseUp: PointerPayload
  readonly mouseEnter: { readonly x: number; readonly y: number }
  readonly mouseLeave: { readonly x: number; readonly y: number }
  readonly keyDown: KeyPayload
  readonly keyUp: KeyPayload
  readonly focus: {}
  readonly blur: {}
  readonly scroll: ScrollPayload
}

export interface InputEvents extends CommonEvents {
  readonly change: ChangePayload
  readonly submit: ChangePayload
}

export class GpuiElement<
  out Msg,
  out R = never,
  in out E = CommonEvents,
  in out HostNode = GpuiNodeHandle,
  out Tag extends string = string
> extends View.ContainerBuilder<Msg, R, E, HostNode, Tag> {
  declare readonly "~With"?: GpuiElement<Msg, R | this["~Add"], E, HostNode, Tag>

  style(style: GpuiStyle): this {
    return this.prop("style", style)
  }

  hover(style: GpuiStateStyle): this {
    return this.prop("hoverStyle", style)
  }

  active(style: GpuiStateStyle): this {
    return this.prop("activeStyle", style)
  }

  role(role: string): this {
    return this.prop("role", role)
  }

  ariaLabel(label: string): this {
    return this.prop("aria-label", label)
  }

  testId(id: string): this {
    return this.prop("testId", id)
  }

  tabIndex(index: number): this {
    return this.prop("tabIndex", index)
  }

  autoFocus(enabled = true): this {
    return this.prop("autoFocus", enabled)
  }
}

export class GpuiFieldElement<
  out Msg,
  out R = never,
  in out E = InputEvents,
  in out HostNode = GpuiNodeHandle,
  out Tag extends string = string
> extends View.ElementBuilder<Msg, R, E, HostNode, Tag> {
  declare readonly "~With"?: GpuiFieldElement<Msg, R | this["~Add"], E, HostNode, Tag>

  style(style: GpuiStyle): this {
    return this.prop("style", style)
  }

  hover(style: GpuiStateStyle): this {
    return this.prop("hoverStyle", style)
  }

  active(style: GpuiStateStyle): this {
    return this.prop("activeStyle", style)
  }

  value(value: string): this {
    return this.prop("value", value)
  }

  placeholder(text: string): this {
    return this.prop("placeholder", text)
  }

  readOnly(flag = true): this {
    return this.prop("readOnly", flag)
  }

  autoFocus(enabled = true): this {
    return this.prop("autoFocus", enabled)
  }

  ariaLabel(label: string): this {
    return this.prop("aria-label", label)
  }

  testId(id: string): this {
    return this.prop("testId", id)
  }

  tabIndex(index: number): this {
    return this.prop("tabIndex", index)
  }

  minRows(rows: number): this {
    return this.prop("minRows", rows)
  }

  maxRows(rows: number): this {
    return this.prop("maxRows", rows)
  }
}

export interface TagMap<Msg> {
  readonly box: View.Shorthand<GpuiElement<Msg, never, CommonEvents, GpuiNodeHandle, "box">>
  readonly button: View.Shorthand<GpuiElement<Msg, never, CommonEvents, GpuiNodeHandle, "button">>
  readonly text: View.Shorthand<GpuiElement<Msg, never, CommonEvents, GpuiNodeHandle, "text">>
  readonly input: GpuiFieldElement<Msg, never, InputEvents, GpuiNodeHandle, "input">
  readonly textarea: GpuiFieldElement<Msg, never, InputEvents, GpuiNodeHandle, "textarea">
}

export interface Elements extends View.Elements {
  readonly Tags: TagMap<this["Msg"]>
  readonly Host: Host
}

export type H<Msg, Props = {}> = View.WithTags<Msg, Props, Elements>

const tags: Readonly<Record<string, View.ElementBuilder<any, any, any, any>>> = {
  box: View.shorthand(new GpuiElement("box")),
  button: View.shorthand(new GpuiElement("button")),
  text: View.shorthand(new GpuiElement("text")),
  input: new GpuiFieldElement("input"),
  textarea: new GpuiFieldElement("textarea")
}

export const vocabulary: View.Vocabulary<Elements> = {
  name,
  tags
}

export const component: Component.Define<Elements> = Component.withElements(vocabulary)

export const ref = (refName: string): Renderer.Ref<GpuiNodeHandle> =>
  Renderer.ref<GpuiNodeHandle>(refName)
