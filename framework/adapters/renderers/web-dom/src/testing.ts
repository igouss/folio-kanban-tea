export interface FakeDomEvent {
  readonly preventDefault: () => void
  readonly key?: string | undefined
  readonly shiftKey?: boolean | undefined
  readonly ctrlKey?: boolean | undefined
  readonly altKey?: boolean | undefined
  readonly metaKey?: boolean | undefined
  readonly [extra: string]: unknown
}

export type FakeDomListener = (event: FakeDomEvent) => void

export interface FakeDomStyle {
  readonly properties: Map<string, string>
  setProperty(name: string, value: string): void
  removeProperty(name: string): string
  getPropertyValue(name: string): string
}

export interface FakeDomNode {
  readonly nodeType: number
  readonly tagName: string
  readonly ownerDocument: FakeDomDocument
  parentNode: FakeDomNode | null
  readonly childNodes: Array<FakeDomNode>
  nodeValue: string | null
  value: string
  disabled: boolean
  isConnected: boolean
  readonly style: FakeDomStyle
  readonly attrs: Map<string, string>
  readonly listeners: Map<string, Set<FakeDomListener>>
  readonly nextSibling: FakeDomNode | null
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
  removeAttribute(name: string): void
  insertBefore(child: FakeDomNode, ref: FakeDomNode | null): FakeDomNode
  removeChild(child: FakeDomNode): FakeDomNode
  addEventListener(type: string, listener: FakeDomListener): void
  removeEventListener(type: string, listener: FakeDomListener): void
  dispatch(type: string, event?: Record<string, unknown>): void
  focus(): void
}

export interface FakeDomDocument {
  title: string
  createElement(tag: string): FakeDomNode
  createTextNode(text: string): FakeDomNode
  createDocumentFragment(): FakeDomNode
}

export interface FakeDomHarness {
  readonly doc: FakeDomDocument
  readonly container: FakeDomNode
  readonly findByTestId: (id: string) => FakeDomNode | undefined
  readonly findByRole: (role: string, name?: string) => FakeDomNode | undefined
  readonly textContent: (node?: FakeDomNode) => string
}

export const createFakeDom = (): FakeDomHarness => {
  const makeStyle = (): FakeDomStyle => {
    const properties = new Map<string, string>()
    return {
      properties,
      setProperty(name, value) {
        properties.set(name, value)
      },
      removeProperty(name) {
        const prev = properties.get(name) ?? ""
        properties.delete(name)
        return prev
      },
      getPropertyValue(name) {
        return properties.get(name) ?? ""
      }
    }
  }

  const makeNode = (nodeType: number, tagName: string, text = ""): FakeDomNode => {
    const node: FakeDomNode = {
      nodeType,
      tagName,
      ownerDocument: doc,
      parentNode: null,
      childNodes: [],
      nodeValue: nodeType === 3 ? text : null,
      value: "",
      disabled: false,
      isConnected: true,
      style: makeStyle(),
      attrs: new Map(),
      listeners: new Map(),
      get nextSibling(): FakeDomNode | null {
        if (node.parentNode === null) return null
        const idx = node.parentNode.childNodes.indexOf(node)
        return idx >= 0 ? (node.parentNode.childNodes[idx + 1] ?? null) : null
      },
      setAttribute(name, value) {
        node.attrs.set(name, value)
      },
      getAttribute(name) {
        return node.attrs.get(name) ?? null
      },
      removeAttribute(name) {
        node.attrs.delete(name)
      },
      insertBefore(child, ref) {
        if (child.parentNode !== null) {
          const prev = child.parentNode.childNodes.indexOf(child)
          if (prev >= 0) child.parentNode.childNodes.splice(prev, 1)
        }
        child.parentNode = node
        if (ref === null) {
          node.childNodes.push(child)
        } else {
          const idx = node.childNodes.indexOf(ref)
          if (idx >= 0) node.childNodes.splice(idx, 0, child)
          else node.childNodes.push(child)
        }
        return child
      },
      removeChild(child) {
        const idx = node.childNodes.indexOf(child)
        if (idx >= 0) node.childNodes.splice(idx, 1)
        child.parentNode = null
        return child
      },
      addEventListener(type, listener) {
        let set = node.listeners.get(type)
        if (set === undefined) {
          set = new Set()
          node.listeners.set(type, set)
        }
        set.add(listener)
      },
      removeEventListener(type, listener) {
        node.listeners.get(type)?.delete(listener)
      },
      dispatch(type, event = {}) {
        const set = node.listeners.get(type)
        if (set === undefined) return
        for (const fn of [...set]) {
          fn({ preventDefault: () => {}, ...event })
        }
      },
      focus() {}
    }
    return node
  }

  const doc: FakeDomDocument = {
    title: "",
    createElement: (tag) => makeNode(1, tag.toUpperCase()),
    createTextNode: (text) => makeNode(3, "#text", text),
    createDocumentFragment: () => makeNode(11, "#fragment")
  }

  const container = doc.createElement("div")

  const walk = (
    node: FakeDomNode,
    predicate: (candidate: FakeDomNode) => boolean
  ): FakeDomNode | undefined => {
    if (predicate(node)) return node
    for (const child of node.childNodes) {
      const hit = walk(child, predicate)
      if (hit !== undefined) return hit
    }
    return undefined
  }

  const textContent = (node: FakeDomNode = container): string => {
    if (node.nodeType === 3) return node.nodeValue ?? ""
    return node.childNodes.map((child) => textContent(child)).join("")
  }

  return {
    doc,
    container,
    findByTestId: (id) =>
      walk(container, (n) => n.getAttribute("data-testid") === id),
    findByRole: (role, name) =>
      walk(
        container,
        (n) =>
          n.getAttribute("role") === role &&
          (name === undefined || n.getAttribute("aria-label") === name)
      ),
    textContent
  }
}
