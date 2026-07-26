# Contributing

Issues and pull requests are welcome.

## Development

Requirements:

- Node.js 20 or newer
- npm
- Logseq desktop with developer mode enabled

Install and verify:

```sh
npm ci
npm run check
```

For development, run `npm run dev`, then load this repository with Logseq's
**Load unpacked plugin** action.

Please keep the plugin local-first, avoid network access, and preserve the
native-block data model.
