# Project Behavior Guide

## Release behavior

- When the user says `上版`, treat it as a request to publish the current project version to git/remote.
- Every `上版` must also update cache busting for browser-loaded static assets before commit/push.
- For this project, update the version query string on static asset references in `/Users/joshra-m4/Documents/實驗室/number-game/index.html` for at least:
  - `styles.css`
  - `game.js`
- Use a new value each time so browsers and CDNs fetch the latest files after deployment.
