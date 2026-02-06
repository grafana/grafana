# Contributing to sqlds

## Releasing

If you want to create a new version of the sqlds for release, follow these steps:

- Checkout the commit you want to tag (`git checkout <COMMIT_SHA>`)
- Run `git tag <VERSION>` (For example **v3.3.0**)
  - NOTE: We're using Lightweight Tags, so no other options are required
- Run `git push origin <VERSION>`
- Verify that the tag was create successfully [here](https://github.com/grafana/sqlds/tags)
- Create a release from the tag on GitHub.
  - Use the tag name as title.
  - Click on the _Generate release notes_ button.
