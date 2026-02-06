# Welcome to urfave/cli

[![Go Reference][goreference_badge]][goreference_link]
[![Go Report Card][goreportcard_badge]][goreportcard_link]
[![codecov][codecov_badge]][codecov_link]
[![Tests status][test_badge]][test_link]

urfave/cli is a **declarative**, simple, fast, and fun package for building
command line tools in Go featuring:

- commands and subcommands with alias and prefix match support
- flexible and permissive help system
- dynamic shell completion for `bash`, `zsh`, `fish`, and `powershell`
- no dependencies except Go standard library
- input flags for simple types, slices of simple types, time, duration, and
  others
- compound short flag support (`-a` `-b` `-c` can be shortened to `-abc`)
- documentation generation in `man` and Markdown (supported via the
  [`urfave/cli-docs`][urfave/cli-docs] module)
- input lookup from:
  - environment variables
  - plain text files
  - structured file formats (supported via the
    [`urfave/cli-altsrc`][urfave/cli-altsrc] module)

## Documentation

See the hosted documentation website at <https://cli.urfave.org>. Contents of
this website are built from the [`./docs`](./docs) directory.

## Support

Check the [Q&A discussions]. If you don't find answer to your question, [create
a new discussion].

If you found a bug or have a feature request, [create a new issue].

Please keep in mind that this project is run by unpaid volunteers.

### License

See [`LICENSE`](./LICENSE).

[test_badge]: https://github.com/urfave/cli/actions/workflows/test.yml/badge.svg
[test_link]: https://github.com/urfave/cli/actions/workflows/test.yml
[goreference_badge]: https://pkg.go.dev/badge/github.com/urfave/cli/v3.svg
[goreference_link]: https://pkg.go.dev/github.com/urfave/cli/v3
[goreportcard_badge]: https://goreportcard.com/badge/github.com/urfave/cli/v3
[goreportcard_link]: https://goreportcard.com/report/github.com/urfave/cli/v3
[codecov_badge]: https://codecov.io/gh/urfave/cli/branch/main/graph/badge.svg?token=t9YGWLh05g
[codecov_link]: https://codecov.io/gh/urfave/cli
[Q&A discussions]: https://github.com/urfave/cli/discussions/categories/q-a
[create a new discussion]: https://github.com/urfave/cli/discussions/new?category=q-a
[urfave/cli-docs]: https://github.com/urfave/cli-docs
[urfave/cli-altsrc]: https://github.com/urfave/cli-altsrc
[create a new issue]: https://github.com/urfave/cli/issues/new/choose
