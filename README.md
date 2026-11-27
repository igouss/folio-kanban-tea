# Universal UI Framework (`@universal-ui/*`) + Folio Kanban (`@folio/kanban-*`)

**A reusable, app-agnostic cross-platform `@effect/ui` framework (`framework/`) built on Hexagonal Architecture (Ports & Adapters) — consumed by one unified Kanban application (`apps/kanban/`) running natively across Web DOM, Desktop Zed GPUI, and Mobile React Native Fabric. Zero React reconcilers. Zero WebViews.**

---

## Screenshots Across Every Platform

### 1. Web DOM (`@folio/kanban-app` → `@universal-ui/host-web` + Vite — No React)
![Folio Kanban Web — @effect/ui](./docs/screenshots/web-effect-ui.png)

### 2. Desktop Native GPU (`@folio/kanban-app` → `@universal-ui/host-gpui` → Zed GPUI on Wayland)
![Folio Kanban Desktop GPU — @effect/ui on Zed GPUI](./docs/screenshots/desktop-gpui.png)

### 3. Mobile Native Android (`@folio/kanban-app` → `@universal-ui/host-fabric` → `@ng-native/fabric`)
<p align="center">
  <img src="./docs/screenshots/mobile-android-fabric.png" alt="Folio Kanban Mobile — @effect/ui on Android Fabric without React reconciler" width="360" />
</p>

---

## Hexagonal Architecture

The repository is strictly split into two independent zones with **one-way dependencies** — `framework/` has **zero knowledge** of Folio or Kanban:

```text
╔═════════════════════════════════════════════════════════════════════════════╗
║                   FRAMEWORK (App-Agnostic · framework/)                     ║
║                                                                             ║
║   @universal-ui/core                   @universal-ui/behaviors              ║
║   • "universal-ui" View.Vocabulary     • @ui-sdk/core headless controls     ║
║     (box, scroll, button, text,          (segmentedControl, tabs, progress) ║
║      input, textarea + UiStyle)        • locale-aware text-match/highlight  ║
║   • Outbound Ports:                    • generic history & transfer notice  ║
║     - KeyValueStore (get/set/remove)                                        ║
║     - Lifecycle (active|inactive|bg)                                        ║
║   • Ui.Host service port                                                    ║
║                                                                             ║
║   Driven Platform Host Adapters (Renderer.Host + Platform Port Adapters):   ║
║   ┌─────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐  ║
║   │@universal-ui/       │ │@universal-ui/        │ │@universal-ui/       │  ║
║   │  host-web           │ │  host-gpui           │ │  host-fabric        │  ║
║   │• Pure DOM Host      │ │• Zed GPUI Host       │ │• RN C++ Fabric Host │  ║
║   │• BrowserStore       │ │  (@gpuix/native)     │ │  (@ng-native/fabric)│  ║
║   │• BrowserLifecycle   │ │• FileStore (node:fs) │ │• AppStateLifecycle  │  ║
║   │• FakeDom testing    │ │• FakeGpui testing    │ │• FakeFabric testing │  ║
║   └─────────────────────┘ └──────────────────────┘ └─────────────────────┘  ║
╚══════════════════════════════════════▲══════════════════════════════════════╝
                                       │ consumes (strictly one-way)
╔══════════════════════════════════════┴══════════════════════════════════════╗
║                CONSUMER APP (Folio Kanban · apps/kanban/)                   ║
║                                                                             ║
║   @folio/kanban-domain (Inner Hexagon — zero UI/IO dependencies)            ║
║   • Entities, WIP limits, velocity, pure immutable undo/redo, Schemas,      ║
║     and Paper/Graphite editorial theme palettes                             ║
║                                                                             ║
║   @folio/kanban-app (Application Core, Domain Ports & Driving UI)           ║
║   • Outbound Port: BoardRepository + SaveBoard Command                      ║
║   • Bridge Adapter: keyValueBoardRepositoryLayer (adapts KeyValueStore)     ║
║   • Presentation: kanbanBoard @ui-sdk/core primitive, card search, VM       ║
║   • Driving UI: ONE FolioApp component (columns + tabs responsive layouts)  ║
║                                                                             ║
║   Thin Delivery Composition Roots (pure wiring, 14–39 lines each):          ║
║   ┌─────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐  ║
║   │@folio/kanban-web    │ │@folio/kanban-desktop │ │@folio/kanban-mobile │  ║
║   │WebHost +            │ │GpuiHost +            │ │FabricHost +         │  ║
║   │BrowserStore +       │ │FileStore             │ │AppStateLifecycle    │  ║
║   │BrowserLifecycle     │ │                      │ │+ Expo SDK 57        │  ║
║   └─────────────────────┘ └──────────────────────┘ └─────────────────────┘  ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### Ports & Adapters Matrix

| Port | Layer | Web Adapter (`host-web`) | Desktop GPUI Adapter (`host-gpui`) | Mobile Fabric Adapter (`host-fabric`) | Test Double |
|---|---|---|---|---|---|
| **`Renderer.Host` + `Ui.Host`** | Framework (`@universal-ui/core`) | `WebHost` (pure DOM) | `GpuiHost` (Zed GPUI via `@gpuix/native`) | `FabricHost` (RN Fabric via `@ng-native/fabric`) | `TestHost`, `FakeDom`, `FakeGpuixRenderer`, `FakeFabric` |
| **`KeyValueStore`** | Framework (`@universal-ui/core`) | `browserStoreLayer` (`localStorage`) | `makeFileStoreLayer` (`node:fs` JSON files) | `noopKeyValueStoreLayer` / memory | `makeMemoryKeyValueStore` |
| **`Lifecycle`** | Framework (`@universal-ui/core`) | `browserLifecycleLayer` (`visibilitychange`) | `staticLifecycleLayer("active")` | `fabricLifecycleLayer` (RN `AppState`) | `staticLifecycleLayer`, `fakeAppState` |
| **`BoardRepository`** | App (`@folio/kanban-app`) | `keyValueBoardRepositoryLayer` → `BrowserStore` | `keyValueBoardRepositoryLayer` → `FileStore` | `noopBoardRepositoryLayer` | `makeMemoryBoardRepository` |

---

## Building Another App on `@universal-ui/*`

Any new application can live alongside `apps/kanban/` as a pure consumer without modifying `framework/`:

1. **Define your domain** in a pure TypeScript package (entities, rules, schemas) with zero UI or I/O imports.
2. **Define your app** using `Ui.component` from `@universal-ui/core` (`h.box`, `h.scroll`, `h.button`, `h.text`, `h.input`, `h.textarea`) and headless behaviors from `@universal-ui/behaviors`, depending only on typed Effect ports (`KeyValueStore`, `Lifecycle`, or your own domain ports).
3. **Wire thin platform composition roots** (`web`, `desktop-gpui`, `mobile-fabric`) that compose your component with `@universal-ui/host-web`, `@universal-ui/host-gpui`, or `@universal-ui/host-fabric` and their platform port adapters.

---

## Project Layout

```text
.
├── package.json                          # npm workspaces (framework/*, apps/kanban/*)
├── tsconfig.base.json                    # Shared strict + exactOptionalPropertyTypes config
├── framework/                            # Reusable @universal-ui/* framework (zero app coupling)
│   ├── core/                             # @universal-ui/core (Ui vocabulary + KeyValueStore & Lifecycle ports)
│   ├── behaviors/                        # @universal-ui/behaviors (generic @ui-sdk/core controls & text-match)
│   ├── host-web/                         # @universal-ui/host-web (DOM Renderer.Host + Browser adapters + FakeDom)
│   ├── host-gpui/                        # @universal-ui/host-gpui (Zed GPUI Renderer.Host + FileStore + FakeGpui)
│   └── host-fabric/                      # @universal-ui/host-fabric (RN Fabric Renderer.Host + AppState + FakeFabric)
└── apps/
    └── kanban/                           # Folio Kanban consumer app (@folio/kanban-*)
        ├── domain/                       # @folio/kanban-domain (pure functional domain, ./schema, ./theme)
        ├── app/                          # @folio/kanban-app (BoardRepository port, presentation, unified FolioApp)
        ├── web/                          # @folio/kanban-web (39-line Web composition root + Vite)
        ├── desktop-gpui/                 # @folio/kanban-desktop (31-line Desktop GPUI composition root)
        └── mobile-fabric/                # @folio/kanban-mobile (14-line Mobile Fabric composition root + Expo)
```

---

## Quick Start

### 1. Install dependencies once at the root

```bash
npm install
```

### 2. Run type-checks, tests, and builds

```bash
npm run typecheck       # Strict + exactOptionalPropertyTypes across all 10 workspaces
npm test                # Runs all 29 tests: framework (4 suites) + kanban consumer (5 suites)
npm run test:framework  # Runs framework tests only
npm run test:kanban     # Runs kanban app & delivery tests only
npm run build:web       # Production Vite build of @folio/kanban-web
```

### 3. Launch each delivery target

```bash
npm run dev:web         # Web DOM (@universal-ui/host-web + Vite)
npm run start:desktop   # Desktop Native GPU (@universal-ui/host-gpui -> Zed GPUI)
npm run start:mobile    # Mobile Native iOS/Android (@universal-ui/host-fabric -> Expo Dev Client)
```

For Android native builds (`cd apps/kanban/mobile-fabric && npm run prebuild && npm run android`), Android SDK (API 36, NDK 27) and JDK 21 are required.

> **Note for Linux pure-Wayland desktops (e.g. Hyprland with `xwayland:enabled = false`)**: Android Emulator's bundled Qt ships `xcb` rather than Wayland. Run it inside a nested `labwc` Wayland window:
> ```bash
> WLR_WL_OUTPUTS=1 labwc -s "env QT_QPA_PLATFORM=xcb $ANDROID_HOME/emulator/emulator -avd <your_avd> -gpu auto"
> ```

---

## Credits & Upstream Projects

- **[@effect/ui](https://ui.effect.website)** & **[Effect](https://effect.website)** — Effect-TS team
- **[UI SDK (`@ui-sdk/core`)](https://ui-sdk.dev)** — Vercel Labs framework-agnostic interaction behaviors
- **[gpuix](https://github.com/remorses/gpuix)** & **[GPUI](https://github.com/zed-industries/zed/tree/main/crates/gpui)** — Zed GPU UI framework & Node/Bun bindings
- **[@ng-native/fabric](https://github.com/ng-native/ng-native)** — Direct React Native Fabric engine without React
- Inspired by **[Manzanita-Research/foldkit-native](https://github.com/Manzanita-Research/foldkit-native)** and **[giovannilondero/foldkit-native](https://github.com/giovannilondero/foldkit-native)**
