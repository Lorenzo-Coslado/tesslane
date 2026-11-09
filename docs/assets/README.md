# README media

These captures show the current Tesslane application, not the archived prototype. They were made on 9 November 2026 in the app's explicitly labeled sample workspace. Features, agent states and messages are authored sample data; no model requests were made.

| File                | Contents                                                      |
| ------------------- | ------------------------------------------------------------- |
| `feature.png`       | Current feature workspace with criteria and delivery tickets. |
| `agents.png`        | Current agent hierarchy.                                      |
| `inspector.png`     | Agent hierarchy and scoped Inspector.                         |
| `tesslane-tour.gif` | Short sequence of those three still captures.                 |

The GIF is an explanatory slideshow of real UI captures. It does not depict a real feature moving through provider execution. Use the PNGs as a static alternative.

## Reproduce

Run `npm ci`, then `npm run preview -- --no-open`, and open the printed local URL. Use the seeded **Add project-wide search** feature, then the **Agents** view and **Command interface** inspector. Capture the application content only, keeping the sample label visible. Exclude browser chrome, personal tabs, private project data and credentials.

To rebuild the animation from the committed captures, install FFmpeg and run from the repository root:

```sh
bash scripts/readme-media.sh
```

Temporary files stay in a temporary directory. FFmpeg is a documentation tool, not an application dependency.
