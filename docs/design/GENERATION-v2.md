# Tesslane visual concepts version 2

Created on 7 November 2026 with the built-in image_gen tool. No CLI fallback or image processing was used.

Status: the user approves the icon's material, relief, and lighting; the T-like central shape still needs improvement. The dashboard is an improvement but remains a design study. See [the abstract icon explorations](./ICON-EXPLORATIONS.md) for the subsequent shape proposals. Version 1 was rejected for resembling infrastructure software rather than the requested Superwhisper and macOS direction. These images are not a final approved design contract.

## Deliverables

- [Revised app icon](./tesslane-logo-concept-v2.png)
- [Revised dashboard](./tesslane-dashboard-concept-v2.png)

## Official style references

The official screenshots and icon were visually inspected before generation and supplied as style references. They were not edit targets or Tesslane assets.

- [Superwhisper press kit](https://superwhisper.com/assets)
- [Official app icon](https://superwhisper.com/app-icon/1024.png)
- [Official macOS screenshots archive](https://superwhisper.com/downloads/presskit/superwhisper-macos-screens.zip)

The dashboard generation used macOS screenshots 1 and 2 from this archive plus the new Tesslane icon. Temporary reference copies are not included in this repository.

## Revised direction

The new icon is a dimensional satin-silver woven mark in a softly beveled dark app tile. It replaces the flat blue lane glyph.

The application uses a narrow colorful icon rail, neutral-gray selection surfaces, restrained system-style typography, softly rounded grouped controls, a calmer agent graph, and a more integrated conversation pane. The exterior rounded window and operating-system controls are presentation framing; the product remains a local browser dashboard.

All project names, statuses, counters, timestamps, and messages are illustrative image-generation content. Their exact wording and state semantics remain governed by SPECIFICATION.md. These generated examples are not evidence of a running application.

## Icon prompt

~~~text
Create one exceptional macOS application icon for Tesslane, a local coding-agent orchestration app.
The supplied image is the OFFICIAL SUPERWHISPER ICON and is a STYLE AND MATERIAL REFERENCE ONLY, not an edit target. Study its actual character: a soft dark continuous-curvature app tile, very controlled dimensional satin-silver material, quiet broad illumination, tactile precision. The previous Tesslane idea was rejected for looking like Docker Desktop / a blue infrastructure brand. This is a complete new design direction.
Create an ORIGINAL Tesslane symbol that is unmistakably different from the reference's triangular loop. Concept: two gently folded satin-aluminum ribbons interlock at a carefully balanced crossing, implying separate strands of work being woven into a common path. A subtle T may emerge in the negative space, but prioritize a beautiful coherent sculptural silhouette. Broad rounded folds, a small number of exact shapes, a clear negative-space opening. It should feel like an elegant Apple-era desktop utility icon designed by a specialist, compact, calm, familiar, sophisticated.
Composition: one large square icon tile centered, filling about 84 percent of a square image, with a little breathing room. The tile has continuous curved corners and an extremely subtle smooth bevel, charcoal-black at its lower edge, soft graphite at its upper edge. A gently dimensional, softly lit brushed-silver or satin-aluminum woven mark floats just slightly above the tile. Medium silver highlights, soft internal shadows, nuanced transitions, not a polished chrome mirror and not a flat vector glyph. Monochrome charcoal and silver only. Low-contrast elegance with clearly readable silhouette. Quiet near-black background outside the icon.
NO wordmark, NO lettering, NO blue, NO cyan, NO neon, NO strong gradients outside natural material illumination, NO industrial forked T, NO three vertical lane glyph, NO Docker/cloud/container imagery, NO triangle-shaped Superwhisper loop, NO border frame, NO logo board, NO mockup desk, NO watermark. One memorable app icon, 1024x1024 square, high-resolution, careful optical balance.
~~~

## Dashboard prompt

~~~text
Generate a NEW version of one Tesslane application interface concept. The previous version was rejected as looking like Docker Desktop: a blue technical dashboard with large outlined boxes, heavy bold type, rigid navigation and a graph that felt like infrastructure software. This must be a substantial visual redesign, not recoloring the previous UI.
REFERENCE IMAGES:
1 and 2 are actual official Superwhisper macOS screenshots. They are the authoritative source for the application's visual language: softly dimensional dark native surfaces, thin quiet boundaries, soft 20-28px corners on grouped surfaces, normal-weight precise system typography, restrained contrast, small colorful native navigation icons and gray selections. Follow their material, typography, spacing rhythm and genuine macOS composition closely, while replacing their contents with our product.
3 is the NEW Tesslane app icon. Use this original silver woven icon in a small identity position. Do not use the previous blue T logo.
Produce ONE front-on high-resolution landscape image, approximately 1900x1200, of an elegant native-feeling desktop application window on a quiet dark neutral backdrop with only a modest margin. Flat camera, no perspective, no desk, no hardware. Its refined rounded silhouette and broad soft shadow should feel like the two supplied application screenshots. The functional product remains a local browser dashboard; the window framing is presentation only.
OVERALL STYLE: make this recognizably part of the same refined design family as the supplied Superwhisper screenshots. Soft charcoal (#202020), slightly warmer dark gray groups (#282828), very fine low contrast separators, matte/satin surfaces, tiny specular edge highlights only on the outer window. Quiet white and gray typography, system sans SF Pro-like regular weights; headings modest and compact, not large web dashboard titles. Tactile and comfortable, restrained native controls. Mostly monochrome, small purposeful green statuses and small colored rail icons. Gray selected states, NOT wide blue selection bands. No blue brand color, no blue card outlines, no navy, no glowing graph.
COMPOSITION:
- Far-left narrow native sidebar rail, about 64px wide, like the reference: top window control dots, then four small softly rounded app-style icons vertically: orange home for Overview, sky-blue stacked sheet for Features, muted lilac branching symbol for Swarm (selected within a soft gray rounded background), gray branch symbol for Git. Small gear near the bottom and our new silver Tesslane icon at the very bottom. These are restrained icons, not neon blocks or emojis.
- Secondary narrow sidebar about 185px wide, in slightly translucent graphite, titled "Tesslane" at 17px medium weight with small project selector below. A small "Features" group with rows "Project settings", "Engine connections", "Run history". The first row has a soft neutral-gray rounded selection. Under it, three indented task rows "Update settings", "Acceptance checks", "Review changes", with tiny status marks. Flat native list, no boxed navigation sections, no bright blue backgrounds, no massive product wordmark.
- Main pane about 58% of remaining width. A fine top toolbar with modest title "Project settings", subtitle "2 agents working", a small native "Assisted" control and a compact pause icon. Below it a small native segmented control "Agents | Activity". The central area is a calm free-space Swarm graph on the plain charcoal surface: four soft compact pill-like nodes. Top "Coordinator", middle-left "Update settings" and middle-right "Acceptance checks" (both working), bottom "Review changes" (waiting). Use thin soft-gray curved connectors with careful spacing; subtle dashed dependencies to the waiting review can be distinguished. Each node uses a gently rounded 20px gray surface without a visible outline, a small native role icon, concise title in normal/medium weight and a quiet secondary line "Codex" or "Claude Code". A tiny green or gray dot conveys state with the word "Working" or "Waiting". The selected node uses a slightly lighter gray surface, never a blue stroke. Make the graph airy, optical, accessible and clearly designed, not a diagram made from large rectangular infrastructure cards.
- A very restrained bottom activity section in main pane: title "Recent activity" 14px medium; two short rows "11:43  Settings implementation started" and "11:44  Acceptance checks started". Tiny icon controls for zoom in the canvas corner. No metric cards, no graphs of money, no generic analytics.
- Right contextual conversation pane about 330px wide, with a very subtle inset and native surface distinction, not a rigid black outlined panel. Small native segmented control "Chat | Details | Logs", then compact recipient label "Coordinator" and a secondary "Project settings". Calm conversational typography, modest labels, no giant bold names, no avatars dominating the content. User entry "Keep the existing settings format." Coordinator entry "I'll preserve it. Implementation and checks are running in parallel." A quiet next line "Review will follow when both are ready." Bottom composer: a generously rounded soft-gray native text area, placeholder "Message the coordinator...", tiny paperclip and a small circular neutral send arrow. No saturated blue button.
The whole app should feel like a beautifully crafted Mac utility, warmer and softer than a developer infrastructure dashboard. Crisp legible English, exact brand spelling "Tesslane". Balanced density and sufficient breathing room for a small laptop. All data is illustrative. Do NOT put explanatory notes, slogans, color palettes, reference images, logos of Superwhisper, or a watermark outside or inside the application. One credible application screen only.
~~~

