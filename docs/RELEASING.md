# Release process

1. Update `CHANGELOG.md` and the version in `package.json`.
2. Run `npm ci` and `npm run check`.
3. Commit and push the release changes.
4. Create and push a matching tag, for example `v0.1.0`.
5. Publish a GitHub release from that tag.
6. Wait for the **Publish Logseq plugin** workflow to attach the installable
   ZIP to the release.
7. Confirm the release contains the generated ZIP in addition to GitHub's
   automatic source archives.
8. Copy `marketplace/manifest.json` into a new package directory in a fork of
   `logseq/marketplace`, then submit a pull request.

The release workflow rejects tags that do not exactly match the version in
`package.json`.
