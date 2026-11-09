# Contributing to Tesslane

Tesslane is an early open source project. Bug reports, documentation improvements, accessibility fixes and well-scoped pull requests are welcome. Development and public discussions use English; reports in French are also welcome.

## Get a development workspace

Fork the repository, clone your fork, and create a branch for your change. Install Node.js 24 or 26 and Git, then run:

```sh
npm ci
npm run dev -- --no-open
```

The CLI prints the local URL. For authored sample data without provider calls:

```sh
npm run preview -- --no-open
```

State lives outside the source checkout by default. Set `TESSLANE_DATA_DIR` to an isolated directory for experiments. Use a disposable Git repository for tests involving agents, setup commands or delivery. See [the development guide](docs/DEVELOPMENT.md).

## Make a focused change

- Open an issue before large interface, orchestration or storage changes so the approach can be discussed.
- Follow the existing TypeScript and React conventions. Run `npm run format` after code changes.
- Add behavioral coverage for fixes that affect execution, approvals, persistence or Git operations. Tests use real temporary Git repositories and SQLite with simulated providers.
- Keep the active workspace as the product reference. [Archived experiments](experiments/README.md) are historical material, outside the production build.
- Describe visible behavior, the reason for the change and relevant verification. Include a screenshot for interface changes and label any sample data.
- Preserve separate requested, configured and reported model identities. Report unknown provider information as unknown.

Before opening a pull request, run:

```sh
npm run verify
```

This checks types, formatting, deterministic behavior, the production build and compiled launch/restart. It makes no model inference requests. CI repeats it on macOS, Linux and Windows with Node.js 24 and 26. Native provider probes are opt-in and may consume the contributor's provider quota; they are not required for an ordinary contribution.

## Review and licensing

Small pull requests are easier to review and merge. Maintainers may request changes, ask for a narrower scope or defer a proposal. There is no guaranteed response time or compatibility promise during the 0.x series.

By submitting a contribution, you agree to license it under the repository's [MIT license](LICENSE). A separate contributor license agreement is not required. Follow the [Code of Conduct](CODE_OF_CONDUCT.md) and report security issues through the [private security channel](SECURITY.md).
