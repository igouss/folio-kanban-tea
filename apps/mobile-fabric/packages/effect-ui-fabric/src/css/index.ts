import type { Conditions, Engine } from "@ng-native/fabric"

export type StyleConditions = Readonly<{
  update: (next: Conditions) => void
}>

export type AttachStylesOptions = Readonly<{
  platform: string
  conditions: Conditions
}>

export const attachStyles = (
  engine: Engine,
  options: AttachStylesOptions
): StyleConditions => {
  engine.addClass(engine.root, `platform-${options.platform}`)

  let current: Conditions | undefined
  const update = (next: Conditions): void => {
    const previous = current
    current = next
    if (next.colorScheme === "dark") {
      engine.addClass(engine.root, "dark")
    } else {
      engine.removeClass(engine.root, "dark")
    }
    if (previous === undefined) return
    engine.updateConditions(next)
    if ((next.fontScale ?? 1) !== (previous.fontScale ?? 1)) {
      engine.remeasureText()
    }
  }
  update(options.conditions)

  return { update }
}
