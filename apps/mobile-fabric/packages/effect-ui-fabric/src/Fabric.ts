import { Component, Renderer, View } from "@effect/ui"
import type { EngineNode } from "@ng-native/fabric"
import * as Context from "effect/Context"

export const name = "fabric" as const

export type FabricStyle = Readonly<Record<string, unknown>>

export class Host extends Context.Service<Host, {
  readonly platform: string
}>()("@folio/effect-ui-fabric/Fabric/Host") {}

declare module "@effect/ui/Command" {
  interface FrameworkServices {
    readonly FabricHost: Host
  }
}

export interface LayoutPayload {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ChangeTextPayload {
  readonly text: string
}

export interface ViewEvents {
  readonly layout: LayoutPayload
  readonly scroll: { readonly x: number; readonly y: number }
}

export interface PressableEvents extends ViewEvents {
  readonly press: {}
}

export interface TextInputEvents extends ViewEvents {
  readonly changeText: ChangeTextPayload
}

export type AutoCapitalize = "none" | "sentences" | "words" | "characters"

export interface FabricContainer<
  out Msg,
  out R = never,
  in out E = ViewEvents,
  out Tag extends string = string
> {
  readonly "~With"?: FabricContainer<Msg, R | this["~Add"], E, Tag>
}

export class FabricContainer<
  out Msg,
  out R = never,
  in out E = ViewEvents,
  out Tag extends string = string
> extends View.ContainerBuilder<Msg, R, E, EngineNode, Tag> {
  style(style: FabricStyle): this {
    return this.prop("style", style)
  }

  class(...names: ReadonlyArray<string | false | null | undefined>): this {
    const joined = names.filter((n): n is string => typeof n === "string" && n.length > 0).join(" ")
    return joined.length > 0 ? this.attr("class", joined) : this
  }

  testID(id: string): this {
    return this.prop("testID", id)
  }

  accessibilityLabel(label: string): this {
    return this.prop("accessibilityLabel", label)
  }

  horizontal(flag = true): this {
    return this.prop("horizontal", flag)
  }

  collapsable(flag: boolean): this {
    return this.prop("collapsable", flag)
  }
}

export interface FabricPressable<
  out Msg,
  out R = never,
  out Tag extends string = "pressable"
> {
  readonly "~With"?: FabricPressable<Msg, R | this["~Add"], Tag>
}

export class FabricPressable<
  out Msg,
  out R = never,
  out Tag extends string = "pressable"
> extends View.ContainerBuilder<Msg, R, PressableEvents, EngineNode, Tag> {
  style(style: FabricStyle): this {
    return this.prop("style", style)
  }

  class(...names: ReadonlyArray<string | false | null | undefined>): this {
    const joined = names.filter((n): n is string => typeof n === "string" && n.length > 0).join(" ")
    return joined.length > 0 ? this.attr("class", joined) : this
  }

  testID(id: string): this {
    return this.prop("testID", id)
  }

  accessibilityLabel(label: string): this {
    return this.prop("accessibilityLabel", label)
  }

  disabled(flag = true): this {
    return this.prop("disabled", flag)
  }
}

export interface FabricText<
  out Msg,
  out R = never,
  out Tag extends string = "text"
> {
  readonly "~With"?: FabricText<Msg, R | this["~Add"], Tag>
}

export class FabricText<
  out Msg,
  out R = never,
  out Tag extends string = "text"
> extends View.ContainerBuilder<Msg, R, ViewEvents, EngineNode, Tag> {
  style(style: FabricStyle): this {
    return this.prop("style", style)
  }

  class(...names: ReadonlyArray<string | false | null | undefined>): this {
    const joined = names.filter((n): n is string => typeof n === "string" && n.length > 0).join(" ")
    return joined.length > 0 ? this.attr("class", joined) : this
  }

  testID(id: string): this {
    return this.prop("testID", id)
  }

  numberOfLines(lines: number): this {
    return this.prop("numberOfLines", lines)
  }
}

export interface FabricTextInput<
  out Msg,
  out R = never,
  out Tag extends string = "text-input"
> {
  readonly "~With"?: FabricTextInput<Msg, R | this["~Add"], Tag>
}

export class FabricTextInput<
  out Msg,
  out R = never,
  out Tag extends string = "text-input"
> extends View.ElementBuilder<Msg, R, TextInputEvents, EngineNode, Tag> {

  style(style: FabricStyle): this {
    return this.prop("style", style)
  }

  class(...names: ReadonlyArray<string | false | null | undefined>): this {
    const joined = names.filter((n): n is string => typeof n === "string" && n.length > 0).join(" ")
    return joined.length > 0 ? this.attr("class", joined) : this
  }

  testID(id: string): this {
    return this.prop("testID", id)
  }

  accessibilityLabel(label: string): this {
    return this.prop("accessibilityLabel", label)
  }

  value(value: string): this {
    return this.prop("value", value)
  }

  placeholder(text: string): this {
    return this.prop("placeholder", text)
  }

  autoCorrect(flag: boolean): this {
    return this.prop("autoCorrect", flag)
  }

  autoCapitalize(mode: AutoCapitalize): this {
    return this.prop("autoCapitalize", mode)
  }

  multiline(flag = true): this {
    return this.prop("multiline", flag)
  }
}

export interface TagMap<Msg> {
  readonly view: View.Shorthand<FabricContainer<Msg, never, ViewEvents, "view">>
  readonly scrollView: View.Shorthand<FabricContainer<Msg, never, ViewEvents, "scroll-view">>
  readonly pressable: View.Shorthand<FabricPressable<Msg, never, "pressable">>
  readonly text: View.Shorthand<FabricText<Msg, never, "text">>
  readonly textInput: FabricTextInput<Msg, never, "text-input">
}

export interface Elements extends View.Elements {
  readonly Tags: TagMap<this["Msg"]>
  readonly Host: Host
}

export type H<Msg, Props = {}> = View.WithTags<Msg, Props, Elements>

const tags: Readonly<Record<string, View.ElementBuilder<any, any, any, any>>> = {
  view: View.shorthand(new FabricContainer("view")),
  scrollView: View.shorthand(new FabricContainer("scroll-view")),
  pressable: View.shorthand(new FabricPressable("pressable")),
  text: View.shorthand(new FabricText("text")),
  textInput: new FabricTextInput("text-input")
}

export const vocabulary: View.Vocabulary<Elements> = {
  name,
  tags,
  textParents: ["text"]
}

export const component: Component.Define<Elements> = Component.withElements(vocabulary)

export const ref = (refName: string): Renderer.Ref<EngineNode> =>
  Renderer.ref<EngineNode>(refName)
