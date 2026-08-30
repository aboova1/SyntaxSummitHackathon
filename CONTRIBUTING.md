# Contributing

Use Node.js 22 or later.

Install packages with `npm install`.

Run these checks before a change:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Add a test for each language or runtime change.

Keep keys short, fixed, and unambiguous.

Do not add arbitrary natural-language parsing.

Do not add a predictive field without an availability time.

Do not place service addresses or secrets in `.seam` files.
