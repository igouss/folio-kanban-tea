import type { EventPayload } from "@gpuix/native"
import { createRendererState, type NativeRenderer } from "@gpuix/native/host"

export interface FakeGpuiElement {
  readonly id: number
  readonly type: string
  parentId: number | undefined
  children: Array<number>
  style: Record<string, unknown>
  text: string
  customProps: Record<string, unknown>
  listeners: Set<string>
}

export interface FakeGpuixRenderer extends NativeRenderer {
  readonly elements: Map<number, FakeGpuiElement>
  readonly getRootId: () => number | undefined
  readonly getBatchCount: () => number
  readonly getWindowTitle: () => string
  readonly getAllText: () => ReadonlyArray<string>
  readonly findByTestId: (testId: string) => FakeGpuiElement | undefined
  readonly dispatch: (event: EventPayload) => boolean
  readonly clickByTestId: (testId: string) => boolean
  readonly typeByTestId: (testId: string, value: string) => boolean
  readonly submitByTestId: (testId: string, value: string) => boolean
}

export const createFakeGpuixRenderer = (): FakeGpuixRenderer => {
  const elements = new Map<number, FakeGpuiElement>()
  let rootId: number | undefined
  let batchCount = 0
  let windowTitle = ""
  let focusedId: number | null = null

  const removeSubtree = (id: number, destroyed: Array<number>): void => {
    const el = elements.get(id)
    if (el === undefined) return
    if (el.parentId !== undefined) {
      const parent = elements.get(el.parentId)
      if (parent !== undefined) {
        parent.children = parent.children.filter((cid) => cid !== id)
      }
    }
    for (const childId of [...el.children]) {
      removeSubtree(childId, destroyed)
    }
    elements.delete(id)
    destroyed.push(id)
  }

  const renderer: FakeGpuixRenderer = {
    elements,
    applyBatch(json: string): Array<number> {
      batchCount += 1
      const ops = JSON.parse(json) as ReadonlyArray<ReadonlyArray<unknown>>
      const destroyed: Array<number> = []
      for (const op of ops) {
        const [kind, ...args] = op
        switch (kind) {
          case "createElement": {
            const [id, type] = args as [number, string]
            elements.set(id, {
              id,
              type,
              parentId: undefined,
              children: [],
              style: {},
              text: "",
              customProps: {},
              listeners: new Set()
            })
            break
          }
          case "destroyElement": {
            removeSubtree(args[0] as number, destroyed)
            break
          }
          case "appendChild": {
            const [parentId, childId] = args as [number, number]
            const parent = elements.get(parentId)
            const child = elements.get(childId)
            if (parent && child) {
              if (child.parentId !== undefined) {
                const oldParent = elements.get(child.parentId)
                if (oldParent) {
                  oldParent.children = oldParent.children.filter((c) => c !== childId)
                }
              }
              child.parentId = parentId
              parent.children.push(childId)
            }
            break
          }
          case "insertBefore": {
            const [parentId, childId, beforeId] = args as [number, number, number]
            const parent = elements.get(parentId)
            const child = elements.get(childId)
            if (parent && child) {
              if (child.parentId !== undefined) {
                const oldParent = elements.get(child.parentId)
                if (oldParent) {
                  oldParent.children = oldParent.children.filter((c) => c !== childId)
                }
              }
              child.parentId = parentId
              const idx = parent.children.indexOf(beforeId)
              if (idx >= 0) parent.children.splice(idx, 0, childId)
              else parent.children.push(childId)
            }
            break
          }
          case "setStyle": {
            const [id, style] = args as [number, Record<string, unknown>]
            const el = elements.get(id)
            if (el) el.style = { ...style }
            break
          }
          case "setText": {
            const [id, text] = args as [number, string]
            const el = elements.get(id)
            if (el) el.text = text
            break
          }
          case "setEventListener": {
            const [id, eventType, active] = args as [number, string, boolean]
            const el = elements.get(id)
            if (el) {
              if (active) el.listeners.add(eventType)
              else el.listeners.delete(eventType)
            }
            break
          }
          case "setRoot": {
            rootId = args[0] as number
            break
          }
          case "setCustomProp": {
            const [id, key, value] = args as [number, string, unknown]
            const el = elements.get(id)
            if (el) {
              if (value === null) delete el.customProps[key]
              else el.customProps[key] = value
            }
            break
          }
        }
      }
      return destroyed
    },
    setWindowTitle(title: string) {
      windowTitle = title
    },
    focusElement(id: number) {
      focusedId = id
    },
    blur() {
      focusedId = null
    },
    getFocusedElementId() {
      return focusedId
    },
    getRootId: () => rootId,
    getBatchCount: () => batchCount,
    getWindowTitle: () => windowTitle,
    getAllText() {
      const out: Array<string> = []
      const walk = (id: number): void => {
        const el = elements.get(id)
        if (!el) return
        if (el.type === "text" && el.text.length > 0) out.push(el.text)
        for (const childId of el.children) walk(childId)
      }
      if (rootId !== undefined) walk(rootId)
      return out
    },
    findByTestId(testId: string) {
      for (const el of elements.values()) {
        if (el.customProps["testId"] === testId) return el
      }
      return undefined
    },
    dispatch(event: EventPayload) {
      return createRendererState(renderer).dispatch(event)
    },
    clickByTestId(testId: string) {
      const el = renderer.findByTestId(testId)
      if (!el) throw new Error(`No GPUI element with testId "${testId}"`)
      return renderer.dispatch({ elementId: el.id, eventType: "click", button: 0, clickCount: 1 })
    },
    typeByTestId(testId: string, value: string) {
      const el = renderer.findByTestId(testId)
      if (!el) throw new Error(`No GPUI element with testId "${testId}"`)
      return renderer.dispatch({ elementId: el.id, eventType: "change", value })
    },
    submitByTestId(testId: string, value: string) {
      const el = renderer.findByTestId(testId)
      if (!el) throw new Error(`No GPUI element with testId "${testId}"`)
      return renderer.dispatch({ elementId: el.id, eventType: "submit", value })
    }
  }

  return renderer
}
