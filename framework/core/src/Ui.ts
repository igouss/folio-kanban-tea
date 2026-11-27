import { Component, Renderer, View } from "@effect/ui"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"

export const name = "universal-ui" as const

export type UiPlatform = "web" | "desktop" | "mobile" | "test"

export type UiDimension = number | `${number}%`

export type UiFontWeight =
  | 400
  | 500
  | 600
  | 700
  | "400"
  | "500"
  | "600"
  | "700"

export interface UiStyle {
  readonly display?: "flex" | "none" | undefined
  readonly flexDirection?: "row" | "column" | undefined
  readonly flexWrap?: "wrap" | "nowrap" | undefined
  readonly flex?: number | undefined
  readonly flexGrow?: number | undefined
  readonly flexShrink?: number | undefined
  readonly alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline" | undefined
  readonly justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | undefined
  readonly alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | undefined
  readonly gap?: number | undefined
  readonly rowGap?: number | undefined
  readonly columnGap?: number | undefined
  readonly position?: "relative" | "absolute" | undefined
  readonly top?: number | undefined
  readonly right?: number | undefined
  readonly bottom?: number | undefined
  readonly left?: number | undefined
  readonly zIndex?: number | undefined
  readonly width?: UiDimension | undefined
  readonly height?: UiDimension | undefined
  readonly minWidth?: UiDimension | undefined
  readonly maxWidth?: UiDimension | undefined
  readonly minHeight?: UiDimension | undefined
  readonly maxHeight?: UiDimension | undefined
  readonly padding?: number | undefined
  readonly paddingTop?: number | undefined
  readonly paddingRight?: number | undefined
  readonly paddingBottom?: number | undefined
  readonly paddingLeft?: number | undefined
  readonly paddingHorizontal?: number | undefined
  readonly paddingVertical?: number | undefined
  readonly margin?: number | undefined
  readonly marginTop?: number | undefined
  readonly marginRight?: number | undefined
  readonly marginBottom?: number | undefined
  readonly marginLeft?: number | undefined
  readonly marginHorizontal?: number | undefined
  readonly marginVertical?: number | undefined
  readonly borderWidth?: number | undefined
  readonly borderTopWidth?: number | undefined
  readonly borderRightWidth?: number | undefined
  readonly borderBottomWidth?: number | undefined
  readonly borderLeftWidth?: number | undefined
  readonly borderColor?: string | undefined
  readonly borderTopColor?: string | undefined
  readonly borderBottomColor?: string | undefined
  readonly borderRadius?: number | undefined
  readonly backgroundColor?: string | undefined
  readonly opacity?: number | undefined
  readonly overflow?: "visible" | "hidden" | "scroll" | "auto" | undefined
  readonly overflowX?: "visible" | "hidden" | "scroll" | "auto" | undefined
  readonly overflowY?: "visible" | "hidden" | "scroll" | "auto" | undefined
  readonly cursor?: "pointer" | "default" | undefined
  readonly color?: string | undefined
  readonly fontSize?: number | undefined
  readonly fontWeight?: UiFontWeight | undefined
  readonly fontFamily?: string | undefined
  readonly lineHeight?: number | undefined
  readonly textAlign?: "left" | "center" | "right" | undefined
  readonly letterSpacing?: number | undefined
}

export class Host extends Context.Service<Host, {
  readonly platform: UiPlatform
}>()("@universal-ui/core/Ui/Host") {}

export const hostLayer = (platform: UiPlatform): Layer.Layer<Host> =>
  Layer.succeed(Host, { platform })

declare module "@effect/ui/Command" {
  interface FrameworkServices {
    readonly UniversalUiHost: Host
  }
}

export interface KeyPayload {
  readonly key: string
  readonly shift: boolean
  readonly ctrl: boolean
  readonly alt: boolean
  readonly meta: boolean
}

export interface ChangeTextPayload {
  readonly text: string
}

export interface ContainerEvents {
  readonly keyDown: KeyPayload
}

export interface ButtonEvents extends ContainerEvents {
  readonly press: {}
}

export interface InputEvents extends ContainerEvents {
  readonly changeText: ChangeTextPayload
  readonly submit: ChangeTextPayload
}

export type AutoCapitalize = "none" | "sentences" | "words" | "characters"

export interface UiContainer<
  out Msg,
  out R = never,
  in out E = ContainerEvents,
  out Tag extends string = string
> {
  readonly "~With"?: UiContainer<Msg, R | this["~Add"], E, Tag>
}

export class UiContainer<
  out Msg,
  out R = never,
  in out E = ContainerEvents,
  out Tag extends string = string
> extends View.ContainerBuilder<Msg, R, E, unknown, Tag> {

  style(style: UiStyle): this {
    return this.prop("style", style)
  }

  hover(style: UiStyle): this {
    return this.prop("hoverStyle", style)
  }

  active(style: UiStyle): this {
    return this.prop("activeStyle", style)
  }

  testId(id: string): this {
    return this.prop("testId", id)
  }

  role(role: string): this {
    return this.prop("role", role)
  }

  ariaLabel(label: string): this {
    return this.prop("aria-label", label)
  }

  ariaChecked(checked: boolean): this {
    return this.prop("aria-checked", checked)
  }

  ariaSelected(selected: boolean): this {
    return this.prop("aria-selected", selected)
  }

  ariaValueNow(value: number): this {
    return this.prop("aria-valuenow", value)
  }

  ariaValueMin(value: number): this {
    return this.prop("aria-valuemin", value)
  }

  ariaValueMax(value: number): this {
    return this.prop("aria-valuemax", value)
  }

  ariaValueText(value: string): this {
    return this.prop("aria-valuetext", value)
  }

  tabIndex(index: number): this {
    return this.prop("tabIndex", index)
  }

  disabled(flag = true): this {
    return this.prop("disabled", flag)
  }

  horizontal(flag = true): this {
    return this.prop("horizontal", flag)
  }

  collapsable(flag: boolean): this {
    return this.prop("collapsable", flag)
  }
}

export interface UiText<
  out Msg,
  out R = never,
  out Tag extends string = "text"
> {
  readonly "~With"?: UiText<Msg, R | this["~Add"], Tag>
}

export class UiText<
  out Msg,
  out R = never,
  out Tag extends string = "text"
> extends View.ContainerBuilder<Msg, R, ContainerEvents, unknown, Tag> {

  style(style: UiStyle): this {
    return this.prop("style", style)
  }

  testId(id: string): this {
    return this.prop("testId", id)
  }

  numberOfLines(lines: number): this {
    return this.prop("numberOfLines", lines)
  }
}

export interface UiField<
  out Msg,
  out R = never,
  out Tag extends string = string
> {
  readonly "~With"?: UiField<Msg, R | this["~Add"], Tag>
}

export class UiField<
  out Msg,
  out R = never,
  out Tag extends string = string
> extends View.ElementBuilder<Msg, R, InputEvents, unknown, Tag> {

  style(style: UiStyle): this {
    return this.prop("style", style)
  }

  testId(id: string): this {
    return this.prop("testId", id)
  }

  ariaLabel(label: string): this {
    return this.prop("aria-label", label)
  }

  value(value: string): this {
    return this.prop("value", value)
  }

  placeholder(text: string): this {
    return this.prop("placeholder", text)
  }

  placeholderColor(color: string): this {
    return this.prop("placeholderTextColor", color)
  }

  autoFocus(enabled = true): this {
    return this.prop("autoFocus", enabled)
  }

  autoCorrect(flag: boolean): this {
    return this.prop("autoCorrect", flag)
  }

  autoCapitalize(mode: AutoCapitalize): this {
    return this.prop("autoCapitalize", mode)
  }

  minRows(rows: number): this {
    return this.prop("minRows", rows)
  }

  maxRows(rows: number): this {
    return this.prop("maxRows", rows)
  }
}

export interface TagMap<Msg> {
  readonly box: View.Shorthand<UiContainer<Msg, never, ContainerEvents, "box">>
  readonly scroll: View.Shorthand<UiContainer<Msg, never, ContainerEvents, "scroll">>
  readonly button: View.Shorthand<UiContainer<Msg, never, ButtonEvents, "button">>
  readonly text: View.Shorthand<UiText<Msg, never, "text">>
  readonly input: UiField<Msg, never, "input">
  readonly textarea: UiField<Msg, never, "textarea">
}

export interface Elements extends View.Elements {
  readonly Tags: TagMap<this["Msg"]>
  readonly Host: Host
}

export type H<Msg, Props = {}> = View.WithTags<Msg, Props, Elements>

const tags: Readonly<Record<string, View.ElementBuilder<any, any, any, any>>> = {
  box: View.shorthand(new UiContainer("box")),
  scroll: View.shorthand(new UiContainer("scroll")),
  button: View.shorthand(new UiContainer("button")),
  text: View.shorthand(new UiText("text")),
  input: new UiField("input"),
  textarea: new UiField("textarea")
}

export const vocabulary: View.Vocabulary<Elements> = {
  name,
  tags,
  textParents: ["text"]
}

export const component: Component.Define<Elements> = Component.withElements(vocabulary)

export const ref = (refName: string): Renderer.Ref<unknown> =>
  Renderer.ref<unknown>(refName)

/**
 * Shared typed bridge for host packages mounting a Component onto a host container
 * with a pre-built Context (e.g. Renderer.Renderer + Ui.Host + platform host service).
 */
export const mountWithHost = <
  Name extends string,
  Props,
  Model,
  Msg,
  Events,
  R,
  V extends View.Elements,
  RP = never,
  Provided = never,
  Node = unknown
>(
  component: Component.Members<Name, Props, Model, Msg, Events, R, V, any>,
  props: Props | Effect.Effect<Props, never, RP>,
  container: Node,
  context: Context.Context<Provided>
): Effect.Effect<
  Renderer.Root<Model, Msg>,
  never,
  Exclude<R | RP, Provided> | Scope.Scope
> =>
  (Renderer.mount(
    component as any,
    props as any,
    container
  ) as Effect.Effect<Renderer.Root<Model, Msg>, never, any>).pipe(
    Effect.provideContext(context)
  ) as any
