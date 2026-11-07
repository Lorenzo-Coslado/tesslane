# Tesslane visual concepts

Status: version 1 was rejected by the user. See [version 2](./GENERATION-v2.md) for the revised proposal. The observations below describe the archived first attempt, not an approved implementation direction.

Created on 7 November 2026 using the built-in image_gen tool. No CLI fallback was used.

These are raster design concepts for review and later implementation. The dashboard contains illustrative data and does not represent a running application.

## Deliverables

- [Logo concept](./tesslane-logo-concept-v1.png)
- [Dashboard concept](./tesslane-dashboard-concept-v1.png)

The dashboard generation used the saved logo image as its identity reference. The original generated files were retained, and the project copies were saved without image processing.

## Visual observations

The logo combines three rounded blue lanes into a T-shaped mark beside a lowercase off-white wordmark. Its reference image has a dark graphite background and generous surrounding space.

The dashboard uses three columns: project navigation, the Swarm hierarchy and recent activity, and a conversation panel. Neutral dark surfaces, thin separators, softly rounded controls, restrained blue selection accents, and readable sans-serif typography establish the desktop-tool direction. Five agent nodes demonstrate delegation and status; two are running. The interface exposes the four agreed navigation spaces and keeps the chat recipient visible.

The logo, visual palette, proportions, and component language of this version were rejected as the implementation direction. Provider names, execution statuses, timestamps, and content are sample data; implementation must follow the specification's actual state and capability contracts. The decorative window controls in the concept are presentation framing, not a requirement to reproduce operating-system chrome inside the web application.

## Logo prompt

~~~text
Use case: logo-brand.
Generate one finished logo concept image for the developer tool "tesslane". A single logo lockup, NOT a brand board or contact sheet.
Brand strategy: a local desktop tool that coordinates coding agents, makes parallel development understandable, and brings independent contributions into one verified result. Personality: quiet precision, trust, clarity, approachable technical competence. Visual direction strongly inspired by the refined restraint and desktop-app sensibility of Superwhisper: Apple-quality typography, calm dark neutrals, carefully balanced geometry, understated cool-blue accent. Create an original identity, not the Superwhisper logo.
Composition: generous empty space on a perfectly flat very dark graphite background (#141416), one centered horizontal lockup occupying about 55% of the image width. Original geometric symbol on the left, lowercase wordmark "tesslane" on the right. No other text.
Logo symbol: an exceptionally simple, beautifully proportioned monoline-to-solid geometric T conceived as three orderly execution lanes joining a common stem. Use just a few solid precisely fitted strokes with softly finished corners and a distinct negative-space channel; legible at a tiny app-icon size. Avoid a generic three-stacked-layers icon. The symbol must have a clear silhouette and optical balance, appropriate for an enduring professional developer-tool brand. Flat muted cornflower blue (#8AAAF2), without lighting or material effects.
Wordmark: exact spelling "tesslane", lowercase t e s s l a n e, warm off-white (#F3F3F5), refined modern sans serif with natural letterspacing and confident medium weight, similar in calmness to a polished macOS application. Optical alignment with the symbol; elegant ratio of symbol to wordmark.
Output a pristine, sharp, vector-like raster image at high resolution, landscape 3:2. Flat fills, crisp boundaries. No gradients, no shadows, no 3D, no mockup object, no watermark, no tagline, no construction diagram, no surrounding icon tile.
~~~

## Dashboard prompt

Reference image: tesslane-logo-concept-v1.png.

~~~text
Use case: ui-mockup.
Generate ONE high-resolution desktop application interface concept for "tesslane", an open-source LOCAL coding-agent orchestration dashboard. A single readable working screen, not a landing page, brand board, marketing website, collage, laptop photo, or multiple screen montage. Landscape composition approximately 1920x1200, flat straight-on edge-to-edge screenshot of the application. The user intends to implement this exact visual direction later.
INPUT REFERENCE: the supplied image is the original Tesslane logo. Use the same blue three-lane T symbol and lowercase wordmark in the top-left identity area, scaled down tastefully; do not turn the supplied logo image into the interface background. Everything else is a new original application mockup.
ART DIRECTION: strong inspiration from the refined Superwhisper desktop app visual language. Native-feeling macOS-quality professional software: calm, precise, reassuring, extremely clean; dark graphite neutral surfaces, restrained cornflower blue accents, optical alignment, excellent small typography, restrained roundings, very subtle borders and depth. A clean system sans serif, white and secondary gray text, airy but operational density. Black and charcoal, no purple gradients, no sci-fi, no glowing network, no decorative grids. Sparse line icons. Think meticulously finished desktop utility, not generic analytics SaaS. No giant KPI tiles or decorative statistics.
LAYOUT: three clear columns inside one desktop browser application, with a very slim top application bar.
LEFT NAVIGATION about 190 px wide: small blue Tesslane symbol + "tesslane"; a discreet repository selector "tesslane" with small folder icon. Four navigation rows: "Overview", "Features", "Swarm" selected with a muted blue fill, "Git". Below a thin separator, "FEATURES" label and two concise rows: "Project settings" selected and "Engine connections". Bottom aligned "Settings" and small green-dot "Local engine connected".
CENTER MAIN WORKSPACE is the largest area, about 60 percent of width: header "Swarm" with smaller subtitle "Project settings"; top-right small "Assisted" selector and an understated "Pause" button. Below header a simple sub-navigation "Agents" selected and "Activity", plus a small honest status "2 running". Main area is a clean agent hierarchy canvas WITHOUT visible grid, using five modest refined nodes and thin deliberate curved connectors, ample readable spacing.
GRAPH: upper central node "Coordinator" with small blue mark, status "Planning", secondary line "Codex · Deep". Three subordinate mission nodes spaced below, connected as a hierarchy:
left "Inspect settings" with status "Completed", secondary "Codex · Fast", small subdued green check;
middle "Implement settings" with status "Running", secondary "Claude Code · Balanced", one subtle blue active dot;
right "Review changes" with status "Waiting", secondary "Codex · Deep".
A fifth node "Acceptance checks" sits below "Implement settings", attached with one thin connector, status "Running", secondary "Codex · Balanced". Each node is a simple flat charcoal rectangle with roughly 10px corners, delicate neutral border; the Coordinator has a subtle blue selected outline. Use small simple role icons. No luminous orbs, giant avatars, agent portraits, badges inside badges, or excessive pills.
BOTTOM OF CENTER: a restrained horizontal divider and compact "Recent activity" list with THREE legible timestamped rows: "11:42  Settings analysis completed", "11:43  Implementation started", "11:44  Acceptance checks started". At lower canvas corner small unobtrusive zoom controls.
RIGHT PANEL about 340-390px wide, divided by one vertical hairline, dedicated to usable conversational control: tabs "Conversation" selected, "Details", "Logs". Below clear recipient label "Coordinator" and context "Project settings". Two or three clean conversational entries, generous readable text, no nested chat bubbles:
User: "Keep the existing settings format."
Coordinator: "I'll preserve it. Implementation and checks are running in parallel."
Coordinator: "Review will follow once the changes are ready."
A subtle activity line "Waiting for implementation".
At bottom an elegant multiline composer with exact placeholder "Message the coordinator..." and small attach icon and circular blue send arrow. The chat must feel like a real polished agent workspace, not a squeezed sidebar full of tiny unreadable text.
COPY: English interface. Exact lowercase brand spelling "tesslane". Prioritize larger readable text over adding extra labels. All layout content is illustrative mockup data. No watermark, no credits or legends outside the application, no big slogan, no install command, no mobile device, no fake desktop wallpaper. Pixel-sharp, composed, credible software UI.
~~~

