# Folio Kanban — Native `@effect/ui` Across Web, Desktop GPU & Mobile

**One framework (`@effect/ui` + Effect v4). Three completely different native & web rendering engines. Zero React reconcilers. Zero WebViews.**

Folio Kanban is a proof-of-concept monorepo demonstrating how **one unified [`@effect/ui`](https://ui.effect.website) + Effect v4 architecture** and a shared functional core ([`@folio/kanban-core`](./packages/kanban-core)) can drive three distinct native & web rendering engines directly through `@effect/ui`'s host-agnostic `Renderer.Host<Node>` and `View.Vocabulary` seam:

1. **Web DOM** (`apps/web`) — `@effect/ui` + `@effect/ui/html` (`BrowserHost`) + Vite
2. **Desktop Native GPU** (`apps/desktop-gpui`) — `@effect/ui` + custom **`@folio/effect-ui-gpui`** `Renderer.Host` driving **Zed's GPUI** directly in-process via `@gpuix/native` (Wayland / Metal — no Electron, no WebView, no DOM shim)
3. **Mobile Native iOS & Android** (`apps/mobile-fabric`) — `@effect/ui` + custom **`@folio/effect-ui-fabric`** `Renderer.Host` driving **React Native's C++ Fabric UIManager** directly via `@ng-native/fabric` + Expo SDK 57 (Hermes — no React reconciler)

---

## Screenshots Across Every Platform

### 1. Web DOM (`@effect/ui/html` `BrowserHost` + Vite — No React)
![Folio Kanban Web — @effect/ui](./docs/screenshots/web-effect-ui.png)

### 2. Desktop Native GPU (`@effect/ui` → `@folio/effect-ui-gpui` → Zed GPUI on Wayland — No Electron / No WebView)
![Folio Kanban Desktop GPU — @effect/ui on Zed GPUI](./docs/screenshots/desktop-gpui.png)

### 3. Mobile Native Android (`@effect/ui` → `@folio/effect-ui-fabric` → `@ng-native/fabric` — No React Reconciler)
<p align="center">
  <img src="./docs/screenshots/mobile-android-fabric.png" alt="Folio Kanban Mobile — @effect/ui on Android Fabric without React reconciler" width="360" />
</p>

---

## Why This Approach Is Novel

Cross-platform TypeScript apps almost universally converge on one of two compromises:
- **React everywhere** (React DOM + Electron/Chromium + React Native's JS React reconciler), carrying heavy runtime layers, hook lifecycle pitfalls, and browser-engine memory overhead on desktop.
- **WebViews everywhere** (Capacitor / Tauri / Electron), sacrificing native GPU rendering, native text editors, and native OS view hierarchies.

This project demonstrates a radically different architectural path built entirely on **`@effect/ui`**'s `Renderer.Host<Node>` abstraction:

### 1. One `@effect/ui` Runtime, Three Custom Native/Web Hosts
```text
                         ┌───────────────────────────────────────┐
                         │        @folio/kanban-core             │
                         │  Zero-dependency pure TypeScript:     │
                         │  lanes, WIP limits, velocity, filter, │
                         │  seed cards & immutable transitions   │
                         └───────────────────┬───────────────────┘
                                             │
                       ┌─────────────────────▼─────────────────────┐
                       │         @effect/ui + Effect 4.1.6         │
                       │   Component · UiSchema · Command.Service  │
                       │   Subscription · View.Vocabulary · Layer  │
                       │          Renderer.Host<Node> seam         │
                       └─┬───────────────────┬───────────────────┬─┘
                         │                   │                   │
             ┌───────────▼───────────┐ ┌─────▼─────────────────┐ ┌▼────────────────────────┐
             │       apps/web        │ │   apps/desktop-gpui   │ │    apps/mobile-fabric   │
             │   @effect/ui/html     │ │ @folio/effect-ui-gpui │ │ @folio/effect-ui-fabric │
             │  BrowserHost + Router │ │  GpuiHost ──▶ gpuix   │ │ FabricHost ──▶ Engine   │
             │   Queries + MsgLog    │ │       ──▶ Zed GPUI    │ │         ──▶ RN Fabric   │
             │  ───────────────────  │ │  ───────────────────  │ │  ─────────────────────  │
             │  Browser DOM          │ │  Native GPU Window    │ │  Native iOS / Android   │
             │  (No React)           │ │  (Wayland / Metal)    │ │  Views (No React recon.)│
             └───────────────────────┘ └───────────────────────┘ └─────────────────────────┘
```

### 2. Custom `@effect/ui` Native Vocabularies & Hosts
`@effect/ui` separates its MVU runtime (`Component`, `UiSchema`, `Command`, `Subscription`, `Query`, `Head`, `Renderer`) from any specific UI target through `View.Vocabulary` and `Renderer.Host<Node>`:
- **`@folio/effect-ui-gpui`** (`packages/effect-ui-gpui`):
  - Defines a typed **`Gpui`** vocabulary (`Gpui.component`, `h.box`, `h.button`, `h.text`, `h.input`, `h.textarea`) with GPU-native `StyleDesc`, `.hover(...)`, `.active(...)`, controlled `.value(...)`, and typed events (`click`, `change`, `submit`, `keyDown`).
  - Implements `Renderer.Host<GpuiNode>` directly on `@gpuix/native`'s `createMutationQueue` — flushing every `@effect/ui` render into **a single batched NAPI-RS `applyBatch` FFI call per frame**, syncing `Head.title` directly to the native window titlebar, propagating inherited text styles to GPUI text nodes, and handling GPUI controlled-input reconciliation without any DOM or CSS shim.
- **`@folio/effect-ui-fabric`** (`packages/effect-ui-fabric`):
  - Defines a typed **`Fabric`** vocabulary (`Fabric.component`, `h.view`, `h.text`, `h.pressable`, `h.scrollView`, `h.textInput`) with `textParents: ["text"]` enforced by `@effect/ui`, React Native styles, Tailwind `@ng-native/tailwind` classes, and typed native events (`press`, `changeText`, `layout`, `scroll`).
  - Implements `Renderer.Host<EngineNode>` directly on `@ng-native/fabric`'s `Engine` — wiring Pressability touch responders (`engine.setResponder`), controlled `TextInput` `eventCount`/`setTextAndSelection` reconciliation, Android `ScrollView` `collapsable: false` safety, single-commit `engine.commit()` per flush, and an `@effect/ui` `Subscription.make` for native `AppState` lifecycle transitions.
- **`@folio/kanban-core`** (`packages/kanban-core`):
  - Exposes pure domain logic (`@folio/kanban-core`), shared Effect v4 Schemas (`@folio/kanban-core/schema`), and shared **Paper & Graphite** editorial design palettes (`@folio/kanban-core/theme`) consumed across all three delivery targets.

### 3. The Elm Architecture + Effect v4 End-to-End
Every platform shares the exact same mental model and library (`@effect/ui` + `effect@^4.1.6`):
- **Explicit State Schemas**: Models, props, messages, and persisted payloads are validated with Effect `Schema` and `UiSchema.TaggedEnum`.
- **Past-Tense Facts, Pure Updates**: Every interaction dispatches a tagged message into an exhaustive, pure `update` handler using `$.evolve(...)` — no `useEffect`, no implicit mutation, no stale closures.
- **Effects as Values**: Side effects (`TaskStore`, `BoardStorage` disk persistence, query invalidation, debounced autosave timers, native `AppState` streams) are typed `Command.Service`, `Query.Service`, `Subscription.make`, and `Layer` values.

### 4. Deterministic Testing Across All Three Targets in Node
All 14 test suites run in ~2 seconds in Node with **no browser, no GPU window, and no mobile simulator required**:
- **Core (`packages/kanban-core`)**: Pure unit tests for WIP limits, velocity, filtering, and CRUD transitions.
- **Web (`apps/web`)**: `@effect/ui/testing` `Story.make`, `HtmlScene.make`, and `TestHost.mount`.
- **Desktop GPU (`apps/desktop-gpui`)**: Mounts `KanbanDesktop` directly via `GpuiHost.mount` onto `createFakeGpuixRenderer()` — verifying real `applyBatch` JSON mutations, `Head.title` window updates, native click/change/submit events, Paper ↔ Graphite theme switching, editor modal, and `BoardStorage` persistence.
- **Mobile Fabric (`apps/mobile-fabric`)**: Mounts `KanbanMobile` directly via `FabricHost.mountApp` onto `@ng-native/fabric`'s `Engine` + `createFakeFabric()` + compiled `@ng-native/tailwind` stylesheet — firing real Fabric responder touches (`topTouchStart`/`topTouchEnd`), native `TextInput` `topChange` events, and `AppState` `Subscription` transitions, asserting directly on the committed Fabric shadow tree and single-commit counts.

---

## What Was Accomplished

| Delivery Target | Directory | `@effect/ui` Host & Capabilities | Verification |
| --- | --- | --- | --- |
| **Shared Core** | `packages/kanban-core` | Canonical 4-lane model (`Backlog`, `In Progress` [WIP 3], `In Review` [WIP 2], `Done`), seed cards, pure move/create/update/delete, search & priority filters, WIP & velocity math | 3/3 `node:test` passing |
| **Web DOM** | `apps/web` | `@effect/ui/html` `BrowserHost`: 4-column drag-and-drop board with View Transitions, `Query.Service` + `TasksTag` invalidation, `Validation.make` form (`/new`), card editor (`/cards/:id`) with 2s debounced autosave `Subscription` & native `<dialog>`, live **MVU Runtime Trace** drawer (`I` shortcut) | 6/6 tests (`Story`, `HtmlScene`, `TestHost`), `tsc --noEmit`, Vite build |
| **Desktop GPU** | `apps/desktop-gpui` | `@folio/effect-ui-gpui` `GpuiHost`: Native Wayland/Metal Zed GPUI window (`@gpuix/native`), `Head.title` live window-title sync, live **Paper ↔ Graphite** theme toggle, inline Quick Add, in-window card editor modal, `SaveBoard` `Command.Service` + `BoardStorage` file persistence | `GpuiHost` + `FakeGpuixRenderer` e2e test, `tsc --noEmit`, verified live in native Wayland GPUI window |
| **Mobile Fabric** | `apps/mobile-fabric` | `@folio/effect-ui-fabric` `FabricHost`: Native iOS/Android Expo SDK 57 dev client driving Fabric directly (`registerApp` + `@ng-native/fabric`), mobile lane tabs, native `ScrollView` cards, controlled `TextInput` search & Quick Add, card detail screen, `@effect/ui` `Subscription` for native `AppState`, `@ng-native/tailwind`, **Paper / Graphite** toggle | 4/4 `fakeFabric` view-tree tests, `tsc --noEmit`, verified live on **Android 16 `x86_64` desktop emulator** |

---

## Project Layout

```text
.
├── .npmrc                        # Single workspace remote-package config
├── package.json                  # npm workspaces (packages/*, apps/*) & root scripts
├── tsconfig.base.json            # Shared strict + exactOptionalPropertyTypes config
├── packages/
│   ├── kanban-core/              # @folio/kanban-core (pure domain, ./schema, ./theme)
│   ├── effect-ui-gpui/           # @folio/effect-ui-gpui (@effect/ui Renderer.Host for Zed GPUI)
│   └── effect-ui-fabric/         # @folio/effect-ui-fabric (@effect/ui Renderer.Host for RN Fabric)
└── apps/
    ├── web/                      # @folio/web (@effect/ui/html BrowserHost + Vite)
    │   ├── src/                  # main.ts, App.ts, routes.ts, domain/, services/, queries/, components/, pages/
    │   └── tests/kanban.test.ts
    ├── desktop-gpui/             # @folio/desktop-gpui (@effect/ui + Zed GPUI)
    │   ├── src/                  # main.ts, domain/, services/, components/, views/
    │   └── tests/kanban.test.ts
    └── mobile-fabric/            # @folio/mobile-fabric (@effect/ui + RN Fabric + Expo SDK 57)
        ├── src/                  # main.ts, domain/, components/, views/
        └── tests/kanban.test.ts
```

---

## Quick Start

### 1. Install all workspace dependencies once at the root

```bash
npm install
```

### 2. Run all tests and type-checks across every workspace

```bash
npm test          # Runs core (3) + web (6) + desktop-gpui (1 e2e) + mobile-fabric (4)
npm run typecheck # Strict + exactOptionalPropertyTypes check across core, web, desktop-gpui, and mobile-fabric
```

### 3. Launch each delivery platform

#### Web (`@effect/ui/html`)
```bash
npm run dev:web
```

#### Desktop Native GPU (`@effect/ui` + `@folio/effect-ui-gpui` + Zed GPUI)
Requires Linux (Wayland + `libxkbcommon`, `libwayland-client`, Vulkan/EGL) or macOS (Apple Silicon / Metal):
```bash
npm run start:desktop
```

#### Mobile Native iOS / Android (`@effect/ui` + `@folio/effect-ui-fabric` + React Native Fabric)
Requires an Expo SDK 57 dev client build (Expo Go is not supported because `@effect/ui` renders directly through Fabric without React):
```bash
cd apps/mobile-fabric
npm run prebuild
npm run android   # Requires Android SDK (API 36, NDK 27) + JDK 21 + connected device or emulator
# or on macOS with Xcode:
npm run ios
```

> **Note for Linux pure-Wayland desktops (e.g. Hyprland with `xwayland:enabled = false`)**: Android Emulator's bundled Qt ships `xcb` rather than Wayland. You can run it cleanly inside a nested `labwc` Wayland window without enabling XWayland globally:
> ```bash
> WLR_WL_OUTPUTS=1 labwc -s "env QT_QPA_PLATFORM=xcb $ANDROID_HOME/emulator/emulator -avd <your_avd> -gpu auto"
> ```

---

## Credits & Upstream Projects

- **[@effect/ui](https://ui.effect.website)** & **[Effect](https://effect.website)** — Effect-TS team
- **[gpuix](https://github.com/remorses/gpuix)** & **[GPUI](https://github.com/zed-industries/zed/tree/main/crates/gpui)** — Zed GPU UI framework & Node/Bun bindings
- **[@ng-native/fabric](https://github.com/ng-native/ng-native)** — Direct React Native Fabric engine without React
- Inspired by the pioneering native TEA host explorations in **[Manzanita-Research/foldkit-native](https://github.com/Manzanita-Research/foldkit-native)** and **[giovannilondero/foldkit-native](https://github.com/giovannilondero/foldkit-native)**
