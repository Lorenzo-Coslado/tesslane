---
name: "Tesslane"
description: "A calm local workspace for understandable, verifiable coding-agent execution."
colors:
  bg: "#1b1b1d"
  rail: "#222224"
  sidebar: "#242426"
  surface: "#272729"
  surface-raised: "#2e2e31"
  surface-hover: "#343437"
  selection: "#3b3b3e"
  text: "#ecebed"
  muted: "#a4a3aa"
  faint: "#96939c"
  line: "#343437"
  line-strong: "#62616a"
  graph-dot: "#3b3b3f"
  green: "#91b9a1"
  amber: "#d8bb89"
  violet: "#b6a4d5"
  blue: "#9bb7d4"
  red: "#e0a6a6"
  light-bg: "#f7f6f5"
  light-rail: "#eae9e7"
  light-sidebar: "#efeeed"
  light-surface: "#fff"
  light-surface-raised: "#f4f3f2"
  light-surface-hover: "#e7e5e4"
  light-selection: "#dddbda"
  light-text: "#29282c"
  light-muted: "#65616b"
  light-faint: "#77727c"
  light-line: "#dfdddc"
  light-line-strong: "#a6a0ac"
  light-graph-dot: "#dbd8dd"
  light-green: "#46775c"
  light-amber: "#856a37"
  light-violet: "#7a609d"
  light-blue: "#536f93"
  light-red: "#a84747"
  silver-button: "#dedde0"
  silver-button-text: "#28272b"
  silver-button-border: "#ecebef"
  silver-button-hover: "#f0eff1"
  nav-violet: "#8974a7"
  nav-amber: "#b89056"
  nav-green: "#6e9a82"
  nav-blue: "#7090ac"
typography:
  page-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "25px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.7px"
  section-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.4px"
  panel-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "-0.1px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    lineHeight: 1.65
  description:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "11px"
  status:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "10px"
  code:
    fontFamily: "'SFMono-Regular', Consolas, monospace"
    fontSize: "11px"
    lineHeight: 1.6
rounded:
  field: "5px"
  control: "6px"
  symbol: "7px"
  navigation: "8px"
  node: "9px"
  summary: "10px"
  dialog: "14px"
  round: "50%"
spacing:
  icon-gap: "7px"
  compact: "8px"
  control-gap: "10px"
  inset: "14px"
  panel-inset: "18px"
  card-inset: "22px"
  laptop-gutter: "24px"
  section-gap: "30px"
  desktop-gutter: "32px"
components:
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-primary:
    backgroundColor: "{colors.silver-button}"
    textColor: "{colors.silver-button-text}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-primary-hover:
    backgroundColor: "{colors.silver-button-hover}"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.field}"
    padding: "6px"
  input-search:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "7px 8px"
  navigation-feature-selected:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 9px"
  status-running:
    textColor: "{colors.green}"
    typography: "{typography.status}"
  card-summary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.summary}"
    padding: "22px"
  graph-node:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.node}"
    padding: "14px"
    width: "205px"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "9px 10px"
  dialog:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    width: "510px"
---

# Design System: Tesslane

## Overview

**Creative North Star: "The Calm Local Workspace"**

Tesslane takes its material cues from Superwhisper’s actual macOS application: professional, reassuring, effective and clean. Charcoal tonal panes, compact controls, quiet gray selection and restrained color make execution easy to inspect. The native system type stack follows the developer’s operating system.

The approved icon is the visual signature: satin silver sculptural relief on a dark rounded tile. Preserve `docs/design/tesslane-icon-variant-a.png`, used unmodified at `public/tesslane.png`. Small navigation symbols and silver primary buttons echo its modest relief; the work surfaces remain calm.

**Key Characteristics:**

- Neutral tonal panes in dark and light themes.
- Compact native-feeling controls and system typography.
- Text-labeled execution states with restrained semantic color.
- Desktop panes that adapt to narrower laptop widths.

This is a record of the implemented system, not a redesign proposal. `src/web/styles.css` remains the implementation authority; `src/web/main.tsx` supplies the actual component structure and adaptive graph behavior. Token names preserve the CSS vocabulary; `light-` identifies an override from `:root[data-theme='light']`. The frontmatter is the normative token record for documentation consumers.

## Colors

The palette is neutral charcoal by default, with a warm off-white counterpart and muted semantic accents. Values are recorded once in the frontmatter.

### Primary

Silver controls (`silver-button`, `silver-button-text`, `silver-button-border`, `silver-button-hover`) carry primary actions. Their light material stays silver in both themes; the primary action is not a saturated brand-color button.

### Secondary

Muted green (`green`) marks working, verification and completed states; amber (`amber`) marks blocked, paused and approval states; red (`red`) marks failed or interrupted work. Violet (`violet`) identifies coordinator roles and Git references, while blue (`blue`) supplies links and keyboard focus. Every status retains a text label. The `light-` counterparts carry the same roles in light mode.

Small colored navigation tiles use the fixed `nav-violet`, `nav-amber`, `nav-green` and `nav-blue` fills. These tiles are a navigation device, not a palette for filling work surfaces.

### Neutral

`bg` is the main canvas; `rail` and `sidebar` separate persistent navigation and conversation; `surface` holds grouped content; `surface-raised` and `surface-hover` support controls. `selection` identifies the current navigation item. `text`, `muted` and `faint` establish hierarchy. `line` and `line-strong` handle dividers, control emphasis and graph edges; `graph-dot` supplies the sparse graph grid.

**The Theme Pairing Rule.** Resolve each semantic color through its CSS custom property; the light-prefixed documentation tokens describe the matching light-theme override, not a second accent palette.

## Typography

**Body and interface font:** the platform system stack recorded in the frontmatter. **Code font:** SFMono-Regular with Consolas and monospace fallbacks. There is no separate marketing display face in the application.

The type is compact and functional. Weight, a small size ramp and muted supporting text supply hierarchy; avoid turning routine workspace content into a display composition.

### Hierarchy

- **Page title:** `page-title`; narrows to 23px at the first laptop breakpoint and 22px at the next.
- **Summary title:** `section-title`; narrows to 17px in the compact laptop layout.
- **Panel title:** `panel-title`; used for section and dialog headings.
- **Body:** `body` is the inherited interface base; `description` is the smaller explanatory paragraph role. Summary copy is bounded to 65ch and feature descriptions to 70ch.
- **Label:** `label` for navigation, tab labels and compact interface text; `status` for supporting execution state. Graph-node status is enlarged to 11px.
- **Code:** `code` for paths, diffs and technical evidence; preformatted evidence wraps long content and can scroll within its container.

**The Work-Surface Legibility Rule.** Keep graph titles readable at the initial unit zoom; wrap the layout and route assignment edges outside parent nodes rather than shrinking the graph to fit.

## Layout

The viewport is a full-height, fixed shell with independently scrolling content. From left to right: a narrow primary rail, feature sidebar, flexible main pane and optional conversation/inspector pane. A top bar spans the workspace; hairlines define boundaries. Main content uses desktop gutters, with a single summary surface followed by flatter rows and sections rather than deeply nested cards.

At the default desktop size, the rail is 72px, the feature sidebar is 214px, the conversation is 330px, and the top bar is 57px. Main content gutters are 32px. The app shell has a 500px minimum height. The conversation can close, and a 3px separator supports pointer resizing or 20px keyboard steps. A user-set width overrides the CSS default; the range is 260–560px, with pointer resizing additionally capped at 45% of the viewport.

At widths up to 1270px the sidebar becomes 185px, conversation 290px and content gutters 24px. Up to 1050px these become 165px and 280px; the page header stacks, actions wrap, summary padding reduces from 22px to 17px, and the graph toolbar stacks. Lower-priority footer details yield space. At 1700px and above the sidebar becomes 234px and conversation 370px, with principal content capped at 1100px.

The existing CSS additionally hides the sidebar at 850px and below and overlays the conversation below 650px. These are implementation fallbacks; the supported design target is desktop PCs and narrower laptops. Mobile is outside the product scope.

The graph begins at unit zoom with a 20px inset, 205px-wide nodes and a 20px dot grid. Its layout changes column count with available pane width; wrapped child nodes receive left-side targets, while assignment connectors route outside parent cards. Preserve pan/zoom controls and the readable initial scale. Explicit zoom controls permit 0.75–1.4, rather than automatically shrinking every node into view.

## Elevation & Depth

Depth comes primarily from tonal pane separation and hairlines. Small inset highlights make silver actions and navigation symbols feel tactile. Summary cards, graph nodes and the composer have restrained local shadows; dialogs use the theme-specific `--shadow` and a blurred backdrop. The exact shadow and transition vocabulary lives in `.impeccable/design.json`, since it is outside the frontmatter schema.

**The Quiet Relief Rule.** Use tonal separation and hairlines for panes; reserve noticeable relief for the approved icon, small controls and modal elevation.

State transitions are short: button background and border changes take 0.16s, disclosure rotation 0.15s and progress width 0.2s. Honor the implemented reduced-motion media query, which disables transitions and animation.

## Shapes

The form language is compact and gently rounded. Fields use `field`, standard controls use `control`, colored symbols use `symbol`, selected rail items use `navigation`, graph cards and the composer use `node`, summary surfaces use `summary`, and dialogs use `dialog`. Execution dots and step counters use the round shape. Hairline borders define controls and rows without making every section a box. The approved app tile keeps its own rounded silhouette and silver relief.

## Components

### Buttons

Native-feeling compact actions use a one-pixel border, short background/border transition and the `button-secondary` token recipe. Primary actions apply the silver recipe, a small inset highlight and a heavier label. Hover brightens the fill or strengthens the neutral border; active reduces brightness; disabled actions reduce opacity. Icon actions use a transparent fill with muted foreground and a small hover surface, retaining a meaningful accessible label.

### Chips and status

Execution status is an unboxed text label with a small colored dot, not a pill. Working states add only a faint halo. Sample-workspace provenance uses a small amber outlined badge and an explanatory note; it does not claim live execution.

### Cards / Containers

The summary uses a quiet surface, a faint border, a small shadow and the `card-summary` inset. Delivery, activity, ticket and Git content primarily use divider rows. Dialogs use the sidebar tone, a larger corner and distinct modal shadow; regular width is 510px and wide settings use 790px, constrained to the viewport.

### Inputs / Fields

Standard fields use `input-field`, muted labels and faint placeholders. Search is a shared rounded container with an inline search symbol, borderless input and shortcut hint; its visible focus belongs to the container. Keyboard focus uses a two-pixel blue outline offset by three pixels. The composer uses a surface-toned container, a short multiline textarea, explicit recipient and a silver send action. Preserve the separate recipient selector when an agent is inspected.

### Navigation

The rail combines small colored SVG symbols with text labels; the current item gains a gray selection surface. Feature navigation uses multiline compact labels, state dots and the same gray selection. Conversation tabs remain flat, using text contrast and a narrow underline for the active tab. Graph map selection uses a small segmented control. All actionable items keep keyboard focus; icon-only actions keep accessible names.

### Agent graph

Graph nodes are quiet surface cards with role avatars, two-line titles, supporting subtitles and labeled status. Chosen nodes use a stronger border and faint outer ring. Enter and Space trigger inspection. Selection is separate from the conversation recipient. Preserve connector contrast, visible handles and outside-parent assignment routing; the graph is an inspectable work surface.

The sidecar includes self-contained HTML/CSS samples translated from these implemented components. They use semantic CSS variables with literal fallbacks so they render independently; application theme variables remain authoritative when inherited.

## Do's and Don'ts

### Do:

- **Do** use the semantic CSS variables for both required themes.
- **Do** keep visible blue keyboard focus, including the search container’s focus-within outline.
- **Do** keep execution status text beside its colored dot.
- **Do** preserve the approved icon without recoloring, redrawing or cropping its relief.
- **Do** test normal desktop and narrower laptop layouts with the conversation panel open.
- **Do** keep graph labels at their readable initial size and allow wrapped layouts.

### Don't:

- **Don’t** turn the workspace into an infrastructure-dashboard aesthetic.
- **Don’t** use saturated color as the main pane background or primary action fill.
- **Don’t** add decorative captions above page titles.
- **Don’t** imply connected engines or completed checks through ornamental status indicators.
- **Don’t** promote the existing small-width CSS fallbacks into a mobile product commitment.
