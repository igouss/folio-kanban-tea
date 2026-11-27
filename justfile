set shell := ["bash", "-euo", "pipefail", "-c"]

android_home := env("ANDROID_HOME", env("HOME") / "Android/Sdk")
android_pkg := "dev.folio.kanban"
android_apk := "apps/kanban/targets/mobile-fabric/android/app/build/outputs/apk/debug/app-debug.apk"
default_avd := "folio_pixel"

alias native := desktop
alias phone := android
alias metro := mobile

# List available recipes
default:
    @just --list

# Start Web DOM app (Vite dev server)
web:
    npm run dev:web

# Start Native Desktop GPU app (Zed GPUI)
desktop:
    npm run start:desktop

# Start Expo Metro dev server for Mobile Fabric
mobile:
    npm run start:mobile

# Launch Android emulator (auto-wraps in labwc on pure Wayland)
emulator avd=default_avd:
    #!/usr/bin/env bash
    set -euo pipefail
    emu="{{android_home}}/emulator/emulator"
    if [ -z "${DISPLAY:-}" ] && [ -n "${WAYLAND_DISPLAY:-}" ] && command -v labwc >/dev/null 2>&1; then
      WLR_WL_OUTPUTS=1 labwc -s "env QT_QPA_PLATFORM=xcb \"$emu\" -avd {{avd}} -gpu auto"
    else
      "$emu" -avd "{{avd}}" -gpu auto
    fi

# Start Android emulator (if none attached), ensure Metro + app are running, and launch on phone
android avd=default_avd:
    #!/usr/bin/env bash
    set -euo pipefail
    pids=()
    cleanup() {
      for pid in "${pids[@]:-}"; do
        kill "$pid" 2>/dev/null || true
      done
    }
    trap cleanup INT TERM

    if ! adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
      echo "Starting Android emulator ({{avd}})..."
      just emulator "{{avd}}" &
      pids+=($!)
      adb wait-for-device
      until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
        sleep 1
      done
    fi

    if ! curl -sf http://localhost:8081/status >/dev/null 2>&1; then
      echo "Starting Expo Metro dev server on :8081..."
      npm run start:mobile &
      pids+=($!)
      until curl -sf http://localhost:8081/status >/dev/null 2>&1; do
        sleep 1
      done
    fi

    adb reverse tcp:8081 tcp:8081
    if ! adb shell pm list packages | grep -q "{{android_pkg}}"; then
      if [ -f "{{android_apk}}" ]; then
        adb install -r "{{android_apk}}"
      else
        npm run android:mobile
      fi
    fi

    adb shell am start -a android.intent.action.VIEW \
      -d "foliokanban://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
      "{{android_pkg}}"

    if [ "${#pids[@]}" -gt 0 ]; then
      wait
    fi

# Build and run Android native project from source
android-build:
    npm run android:mobile

# Build and run iOS native app (macOS)
ios:
    npm run ios:mobile

# Start Web, Desktop GPUI, and Android Phone simultaneously
all avd=default_avd:
    #!/usr/bin/env bash
    set -euo pipefail
    pids=()
    cleanup() {
      for pid in "${pids[@]:-}"; do
        kill "$pid" 2>/dev/null || true
      done
    }
    trap cleanup EXIT INT TERM

    npm run dev:web &
    pids+=($!)
    npm run start:desktop &
    pids+=($!)
    just android "{{avd}}" &
    pids+=($!)
    wait

# Run all workspace typechecks and test suites
check:
    npm run typecheck && npm test

# Build production Web bundle
build-web:
    npm run build:web
