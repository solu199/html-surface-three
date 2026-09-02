# Contributing

Thanks for helping improve HTML Surface Three.

## Before opening an issue

- Search existing issues first.
- Use the bug form for reproducible defects.
- Use the feature form for changes to the HTML Surface abstraction.
- Report security vulnerabilities through [GitHub private vulnerability reporting](https://github.com/solu199/html-surface-three/security/advisories/new), not a public issue.

## Development setup

Requirements:

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- stable Chrome and Edge for the Tier 1 browser suite

```bash
git clone https://github.com/YOUR_ACCOUNT/html-surface-three.git
cd html-surface-three
npm install
npm run dev
```

The stable public API is exported from `html-surface-three`. Backend SPI and other replaceable boundaries are exported from `html-surface-three/experimental` and may change between releases.

## Verification

Run the checks that match your change:

```bash
npm run typecheck
npm test
npm run build
npm run verify:package
```

Changes to input routing, rendering, browser integration, or the demo should also run:

```bash
npm run test:e2e:tier1
npm run test:e2e:smoke
npm run test:visual
```

Include a screenshot or Playwright evidence for visible UI changes. Safari-specific fixes should include the Safari version, OS, input device, GPU when relevant, and selected Backend.

## Pull requests

1. Fork the repository and create a focused branch.
2. Keep unrelated refactors out of the change.
3. Add tests for shared behavior, bug fixes, and regression-prone changes.
4. Update public documentation when behavior or compatibility changes.
5. Complete the pull request template and wait for CI.

By submitting a contribution, you confirm that you have the right to contribute it under this repository's [MIT License](../LICENSE).
