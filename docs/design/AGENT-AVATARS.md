# Agent avatar directions

The user asked for customizable, original robot SVGs instead of generic icon-library bot glyphs, then rejected the first working robot style as insufficiently aligned with the dashboard. They requested three distinct alternatives to choose from. This is a local comparison, not an automatic replacement of the approved Tesslane identity.

The initial comparison showed:

- **A — sculpted metal:** a silver shell, restrained relief and a tinted visor. The material relates to the approved application icon.
- **B — geometric:** a chamfered matte shell and simpler, more abstract eyes. Flat construction and small-size legibility distinguish it.
- **C — expressive:** a rounded colored shell and a softer facial expression. Color remains within the muted application palette.

Each proposal is an original inline SVG, with no remote avatar service, copied mascot or raster dependency. The comparison uses the same accent color and a realistic small Swarm row for each option. Changing the comparison swatch affects all three. Choice buttons record only the review selection in the browser; they do not apply a direction to the dashboard.

The customization plumbing is implemented independently: shell/eye colors, face and antenna; a deterministic default per agent; persistent local appearance overrides; reset and self-contained SVG download. Appearance edits use a separate local metadata record, not an agent run/model/permission mutation. A server-side hex-color/enum contract validates input, and state archives preserve appearance.

PRODUCT.md and DESIGN.md remain authoritative for the incumbent application. This comparison does not rewrite them. The user selected the direction of A, then requested the rounded refinement below. Its final silhouette remains under review.

## Round refinement of A

The user preferred direction A and requested a rounder construction like Grok Bot. The comparison now focuses on the original A and its A2 refinement: a silver pebble-like head, direct capsule eyes, soft metallic highlights, with mechanical ears, antenna and visor housing removed from A2. It is an original SVG, not a reused mascot asset. The reference is [Grok Bot’s design article](https://x.ai/news/designing-grok-bot). Metallic material remains Tesslane’s own approved direction. The rounded refinement is presented for visual review; it has not automatically replaced the runtime avatar.

## Animated round avatar

The user accepted the rounded construction and requested an animatable mouth/eyes with color on the whole ball. The round SVG is now the shared runtime avatar in the Swarm, activity rows, ticket agent links and inspector. The preview route is an interactive playground: sphere palette/custom color, idle/working/waiting/completed states and a local animation toggle. Demo states are explicitly simulated; real runtime avatars use the actual agent state.

The focal motion is facial activity, not a moving dashboard: occasional blinking, bounded gaze translation and small mouth deformation while working; calm neutral waiting and a relaxed completed face. A single shared IntersectionObserver and page-visibility listener pause loops outside the viewport or hidden page. CSS honors prefers-reduced-motion, retaining a static state expression. No per-frame JavaScript, network avatar service, audio or additional animation dependency is used. Appearance remains separate from engine/model/permission policy. SVG downloads are self-contained and static by default.

Sphere color is the editable shell color; eyes and mouth default to dark graphite for contrast. Optional existing eye/antenna appearance fields remain compatible. The page at `/avatar-proposals.html` uses the same SVG component as the actual dashboard so the approved prototype cannot drift from the runtime drawing.

## User validation

On 7 November 2026, the user explicitly approved the round, colored, animated avatar version (mouth, eyes, sphere tint). This is the accepted avatar baseline for Tesslane. Earlier comparisons remain design history; no further avatar direction selection is pending.
