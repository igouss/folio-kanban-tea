import type { Conditions } from "@ng-native/fabric"
import { Appearance, Dimensions, PixelRatio } from "react-native"
import type { StyleConditions } from "./index.ts"

export const currentConditions = (): Conditions => {
  const { width, height } = Dimensions.get("window")
  return {
    width,
    height,
    colorScheme: Appearance.getColorScheme() === "dark" ? "dark" : "light",
    fontScale: PixelRatio.getFontScale()
  }
}

export const watchConditions = (styles: StyleConditions): (() => void) => {
  const onChange = (): void => styles.update(currentConditions())
  const dimensions = Dimensions.addEventListener("change", onChange)
  const appearance = Appearance.addChangeListener(onChange)
  return () => {
    dimensions.remove()
    appearance.remove()
  }
}
