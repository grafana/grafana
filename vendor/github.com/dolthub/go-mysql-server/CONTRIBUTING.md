# Dolthub Inc. Contributing Guidelines

Dolthub Inc. projects accept contributions via GitHub pull requests.

## Support Channel

The official support channel, for both users and contributors, is
GitHub issues. You can also talk to engineers on the [Dolt Discord
server](https://discord.com/invite/RFwfYpu).

## How to Contribute

Pull Requests (PRs) are the exclusive way to contribute code to
go-mysql-server. We also welcome new issues with steps to reproduce a
problem. We may transfer issues that also affect
[Dolt](https://github.com/dolthub/dolt) to that repo, since it is our
primary backlog.

- PRs should include tests.
- If the PR is a bug fix, it should include a new unit test that fails
  before the patch is merged.
- If the PR is a new feature, should have unit tests of the new
  functionality.
- All contributions should include at least one end-to-end test in the
  `enginetest` package. Typically this is just a new query with
  expected results added to one of the large files of such queries in
  the `queries` package.
  
If you're confused, look at merged PRs for examples.
