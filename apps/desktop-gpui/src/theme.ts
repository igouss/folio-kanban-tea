import type { Tokens } from 'foldkit-gpuix'
import type { ThemeMode } from './domain.ts'

export const paperTokens: Tokens = {
  'color.canvas': '#f4efe6',
  'color.topbar': '#fbf8f2',
  'color.lane': '#eae2d3',
  'color.lane-drop': '#f7e4de',
  'color.card': '#fcfaf5',
  'color.card-hover': '#ffffff',
  'color.input': '#ffffff',
  'color.ink': '#1a1714',
  'color.ink-soft': '#4e473f',
  'color.ink-muted': '#7b7164',
  'color.rule': '#d8cebe',
  'color.rule-strong': '#bfb29d',
  'color.accent': '#d43c1e',
  'color.accent-hover': '#b83116',
  'color.accent-soft': '#fae5df',
  'color.accent-ink': '#fffaf7',
  'color.pine': '#1e6b4b',
  'color.pine-soft': '#dff0e8',
  'color.amber': '#a8640b',
  'color.amber-soft': '#f8ecd7',
  'color.cobalt': '#2251a6',
  'color.cobalt-soft': '#e3ecfa',
  'color.chip': '#e6ddd0',
  'color.avatar-bg': '#1a1714',
  'color.avatar-ink': '#fcfaf5',
  'color.modal-backdrop': '#1a171488',
  'shadow.card': '0px 2px 6px 0px #1a171414',
  'shadow.ghost': '0px 10px 26px 0px #1a171438',
}

export const graphiteTokens: Tokens = {
  'color.canvas': '#141311',
  'color.topbar': '#1b1916',
  'color.lane': '#1e1b18',
  'color.lane-drop': '#311f1b',
  'color.card': '#26231f',
  'color.card-hover': '#2e2a25',
  'color.input': '#191714',
  'color.ink': '#f3ede3',
  'color.ink-soft': '#c9bfb0',
  'color.ink-muted': '#8f8577',
  'color.rule': '#35302a',
  'color.rule-strong': '#4d463e',
  'color.accent': '#ea583a',
  'color.accent-hover': '#ff6f52',
  'color.accent-soft': '#42231c',
  'color.accent-ink': '#141311',
  'color.pine': '#4fc590',
  'color.pine-soft': '#1b382b',
  'color.amber': '#ebb054',
  'color.amber-soft': '#3a2d18',
  'color.cobalt': '#7aa7ff',
  'color.cobalt-soft': '#1c2a44',
  'color.chip': '#322d27',
  'color.avatar-bg': '#f3ede3',
  'color.avatar-ink': '#141311',
  'color.modal-backdrop': '#00000099',
  'shadow.card': '0px 2px 8px 0px #00000044',
  'shadow.ghost': '0px 12px 30px 0px #00000088',
}

export const tokensFor = (mode: ThemeMode): Tokens =>
  mode === 'paper' ? paperTokens : graphiteTokens

// 100% GPUI-compatible CSS (zero sibling combinators, pseudo-elements, or unsupported selectors).
export const kanbanCss = `
  body {
    margin: 0;
    padding: 0;
    height: 100%;
    background-color: var(--fn-color-canvas);
    color: var(--fn-color-ink);
    font-family: system-ui, sans-serif;
    font-size: 13px;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--fn-color-canvas);
    color: var(--fn-color-ink);
  }

  /* Topbar */
  .topbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background-color: var(--fn-color-topbar);
    border-bottom: 1px solid var(--fn-color-rule);
    gap: 14px;
  }

  .topbar-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .brand-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background-color: var(--fn-color-accent);
  }

  .brand-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--fn-color-ink);
  }

  .brand-badge {
    padding: 3px 8px;
    border-radius: 999px;
    background-color: var(--fn-color-lane);
    border: 1px solid var(--fn-color-rule);
    font-size: 11px;
    font-weight: 600;
    color: var(--fn-color-ink-soft);
  }

  .gpu-badge {
    padding: 3px 8px;
    border-radius: 999px;
    background-color: var(--fn-color-pine-soft);
    font-size: 11px;
    font-weight: 600;
    color: var(--fn-color-pine);
  }

  .topbar-right {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  /* Telemetry + Toolbar */
  .subbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    gap: 12px;
    border-bottom: 1px solid var(--fn-color-rule);
    background-color: var(--fn-color-canvas);
  }

  .search-input {
    width: 270px;
    padding: 7px 11px;
    border-radius: 6px;
    border: 1px solid var(--fn-color-rule);
    background-color: var(--fn-color-input);
    color: var(--fn-color-ink);
    font-size: 13px;
  }

  .search-input:focus {
    border-color: var(--fn-color-accent);
  }

  .filter-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }

  .segmented {
    display: flex;
    flex-direction: row;
    padding: 3px;
    gap: 2px;
    border-radius: 7px;
    background-color: var(--fn-color-lane);
    border: 1px solid var(--fn-color-rule);
  }

  .seg-btn {
    padding: 5px 10px;
    border-radius: 5px;
    border: 0px solid transparent;
    background-color: transparent;
    color: var(--fn-color-ink-soft);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .seg-btn:hover {
    color: var(--fn-color-ink);
  }

  .seg-btn.is-active {
    background-color: var(--fn-color-card-hover);
    color: var(--fn-color-ink);
  }

  .stats-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }

  .stat-pill {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 6px;
    background-color: var(--fn-color-card);
    border: 1px solid var(--fn-color-rule);
    font-size: 12px;
  }

  .stat-label {
    color: var(--fn-color-ink-muted);
    font-weight: 600;
  }

  .stat-val {
    color: var(--fn-color-ink);
    font-weight: 700;
  }

  .progress-wrap {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .progress-track {
    width: 96px;
    height: 7px;
    border-radius: 999px;
    background-color: var(--fn-color-lane);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    background-color: var(--fn-color-pine);
  }

  /* Buttons */
  .btn {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--fn-color-rule);
    background-color: var(--fn-color-card);
    color: var(--fn-color-ink);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn:hover {
    background-color: var(--fn-color-card-hover);
    border-color: var(--fn-color-rule-strong);
  }

  .btn-primary {
    border: 1px solid var(--fn-color-accent);
    background-color: var(--fn-color-accent);
    color: var(--fn-color-accent-ink);
  }

  .btn-primary:hover {
    background-color: var(--fn-color-accent-hover);
  }

  .btn-danger {
    border: 1px solid var(--fn-color-accent);
    background-color: var(--fn-color-accent-soft);
    color: var(--fn-color-accent);
  }

  /* Notice Banner */
  .notice-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin: 10px 20px 0px 20px;
    padding: 8px 12px;
    border-radius: 6px;
    background-color: var(--fn-color-pine-soft);
    color: var(--fn-color-pine);
    font-size: 12px;
    font-weight: 600;
  }

  .notice-dismiss {
    border: 0px solid transparent;
    background-color: transparent;
    color: var(--fn-color-pine);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  /* Board Columns */
  .board {
    flex: 1;
    display: flex;
    flex-direction: row;
    gap: 12px;
    padding: 14px 18px;
    min-height: 0;
    min-width: 0;
  }

  .lane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--fn-color-lane);
    border: 1px solid var(--fn-color-rule);
    border-radius: 12px;
    padding: 11px;
    min-height: 0;
  }

  .lane-drop-target {
    background-color: var(--fn-color-lane-drop);
    border: 2px dashed var(--fn-color-accent);
  }

  .lane-over-wip {
    border-color: var(--fn-color-accent);
  }

  .lane-header {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--fn-color-rule);
  }

  .lane-title-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .lane-title-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 7px;
  }

  .lane-code {
    font-size: 11px;
    font-weight: 700;
    color: var(--fn-color-ink-muted);
  }

  .lane-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--fn-color-ink);
  }

  .lane-count {
    padding: 2px 8px;
    border-radius: 999px;
    background-color: var(--fn-color-card);
    border: 1px solid var(--fn-color-rule);
    font-size: 11px;
    font-weight: 700;
    color: var(--fn-color-ink-soft);
  }

  .lane-count-over {
    background-color: var(--fn-color-accent-soft);
    border-color: var(--fn-color-accent);
    color: var(--fn-color-accent);
  }

  .lane-meta {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .lane-pts {
    font-size: 11px;
    color: var(--fn-color-ink-muted);
    font-weight: 600;
  }

  .wip-alert {
    font-size: 10px;
    font-weight: 700;
    color: var(--fn-color-accent);
  }

  .lane-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin: 0;
    padding: 0;
    min-height: 80px;
    overflow-y: auto;
  }

  .lane-empty {
    padding: 20px 12px;
    border-radius: 8px;
    border: 1px dashed var(--fn-color-rule-strong);
    color: var(--fn-color-ink-muted);
    font-size: 12px;
    text-align: center;
  }

  .lane-footer {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--fn-color-rule);
  }

  .add-trigger {
    width: 100%;
    padding: 7px 10px;
    border-radius: 7px;
    border: 1px dashed var(--fn-color-rule-strong);
    background-color: transparent;
    color: var(--fn-color-ink-soft);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }

  .add-trigger:hover {
    background-color: var(--fn-color-card);
    color: var(--fn-color-ink);
  }

  /* Quick Add Form */
  .add-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 9px;
    border-radius: 8px;
    background-color: var(--fn-color-card-hover);
    border: 1px solid var(--fn-color-accent);
  }

  .add-input {
    width: 100%;
    padding: 7px 9px;
    border-radius: 5px;
    border: 1px solid var(--fn-color-rule);
    background-color: var(--fn-color-input);
    color: var(--fn-color-ink);
    font-size: 13px;
  }

  .add-actions {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    gap: 6px;
  }

  /* Kanban Card */
  .card {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 10px 11px;
    min-width: 0;
    border-radius: 9px;
    background-color: var(--fn-color-card);
    border: 1px solid var(--fn-color-rule);
    border-left: 3px solid var(--fn-color-rule-strong);
    box-shadow: var(--fn-shadow-card);
    cursor: grab;
  }

  .card:hover {
    background-color: var(--fn-color-card-hover);
    border-color: var(--fn-color-rule-strong);
  }

  .card:focus-visible {
    border-color: var(--fn-color-accent);
  }

  .card-high {
    border-left-color: var(--fn-color-accent);
  }

  .card-medium {
    border-left-color: var(--fn-color-amber);
  }

  .card-low {
    border-left-color: var(--fn-color-cobalt);
  }

  .card-dragging {
    opacity: 0.45;
    border: 2px dashed var(--fn-color-accent);
  }

  .card-kbd-dragging {
    border: 2px solid var(--fn-color-accent);
    background-color: var(--fn-color-card-hover);
  }

  .card-ghost {
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 11px 12px;
    border-radius: 9px;
    background-color: var(--fn-color-card-hover);
    border: 2px solid var(--fn-color-accent);
    box-shadow: var(--fn-shadow-ghost);
  }

  .drop-placeholder {
    height: 54px;
    border-radius: 9px;
    border: 2px dashed var(--fn-color-accent);
    background-color: var(--fn-color-accent-soft);
  }

  .card-top {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .card-id-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }

  .card-code {
    font-size: 11px;
    font-weight: 700;
    color: var(--fn-color-ink-muted);
  }

  .prio-pill {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }

  .prio-high {
    background-color: var(--fn-color-accent-soft);
    color: var(--fn-color-accent);
  }

  .prio-medium {
    background-color: var(--fn-color-amber-soft);
    color: var(--fn-color-amber);
  }

  .prio-low {
    background-color: var(--fn-color-cobalt-soft);
    color: var(--fn-color-cobalt);
  }

  .card-tools {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 3px;
  }

  .mini-btn {
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    background-color: transparent;
    color: var(--fn-color-ink-muted);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .mini-btn:hover {
    background-color: var(--fn-color-lane);
    border-color: var(--fn-color-rule);
    color: var(--fn-color-ink);
  }

  .mini-btn-danger:hover {
    background-color: var(--fn-color-accent-soft);
    color: var(--fn-color-accent);
  }

  .card-title-btn {
    padding: 0;
    border: 0px solid transparent;
    background-color: transparent;
    color: var(--fn-color-ink);
    font-size: 13.5px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  .card-title-btn:hover {
    color: var(--fn-color-accent);
  }

  .card-notes {
    margin: 0;
    font-size: 12px;
    color: var(--fn-color-ink-soft);
  }

  .card-footer {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 3px;
  }

  .card-tags {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag-chip {
    padding: 2px 6px;
    border-radius: 4px;
    background-color: var(--fn-color-chip);
    color: var(--fn-color-ink-soft);
    font-size: 10px;
    font-weight: 600;
  }

  .card-meta {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }

  .pts-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--fn-color-ink-muted);
  }

  .avatar {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background-color: var(--fn-color-avatar-bg);
    color: var(--fn-color-avatar-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
  }

  /* Bottom Status Bar */
  .statusbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 8px 20px;
    background-color: var(--fn-color-topbar);
    border-top: 1px solid var(--fn-color-rule);
    font-size: 11.5px;
    color: var(--fn-color-ink-muted);
  }

  .status-strong {
    color: var(--fn-color-ink-soft);
    font-weight: 600;
  }

  /* In-Window Card Editor Modal */
  .modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--fn-color-modal-backdrop);
    padding: 24px;
  }

  .modal-card {
    width: 520px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 22px;
    border-radius: 12px;
    background-color: var(--fn-color-card-hover);
    border: 1px solid var(--fn-color-rule-strong);
    box-shadow: var(--fn-shadow-ghost);
  }

  .modal-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--fn-color-rule);
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--fn-color-ink);
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .field-row {
    display: flex;
    flex-direction: row;
    gap: 10px;
  }

  .field-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--fn-color-ink-muted);
  }

  .field-input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--fn-color-rule);
    background-color: var(--fn-color-input);
    color: var(--fn-color-ink);
    font-size: 13px;
  }

  .field-textarea {
    width: 100%;
    height: 88px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--fn-color-rule);
    background-color: var(--fn-color-input);
    color: var(--fn-color-ink);
    font-size: 13px;
  }

  .modal-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid var(--fn-color-rule);
  }

  .modal-actions-right {
    display: flex;
    flex-direction: row;
    gap: 8px;
  }
`
