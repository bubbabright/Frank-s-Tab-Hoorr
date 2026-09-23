# Install and update Tab Hoor

Tab Hoor supports Firefox 140 and newer. It stores counts and settings locally;
it does not upload URLs or browsing history.

## Development

```sh
npm ci
npm run build
```

The unpacked Firefox build is in `dist/firefox`. In Firefox, open
`about:debugging`, choose **This Firefox**, select **Load Temporary Add-on**,
and choose `dist/firefox/manifest.json`. Temporary add-ons are removed when
Firefox restarts.

## Release installation

Run `npm run build`, then verify the matching `SHA256SUMS` file. In Firefox,
open `about:addons`, select the gear menu, choose **Install Add-on From File**,
and select the `.xpi` file. To update, install the newer XPI using the same
workflow. No custom launcher, remote debugger, or profile modification is
required.
