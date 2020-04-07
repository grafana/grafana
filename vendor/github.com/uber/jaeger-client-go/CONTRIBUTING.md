# How to Contribute to Jaeger

We'd love your help!

Jaeger is [Apache 2.0 licensed](LICENSE) and accepts contributions via GitHub
pull requests. This document outlines some of the conventions on development
workflow, commit message formatting, contact points and other resources to make
it easier to get your contribution accepted.

We gratefully welcome improvements to documentation as well as to code.

# Certificate of Origin

By contributing to this project you agree to the [Developer Certificate of
Origin](https://developercertificate.org/) (DCO). This document was created
by the Linux Kernel community and is a simple statement that you, as a
contributor, have the legal right to make the contribution. See the [DCO](DCO)
file for details.

## Getting Started

This library uses [dep](https://golang.github.io/dep/) to manage dependencies.

To get started, make sure you clone the Git repository into the correct location
`github.com/uber/jaeger-client-go` relative to `$GOPATH`:

```
mkdir -p $GOPATH/src/github.com/uber
cd $GOPATH/src/github.com/uber
git clone git@github.com:jaegertracing/jaeger-client-go.git jaeger-client-go
cd jaeger-client-go
git submodule update --init --recursive
```

Then install dependencies and run the tests:

```
make install
make test
```

## Imports grouping

This projects follows the following pattern for grouping imports in Go files:
  * imports from standard library
  * imports from other projects
  * imports from `jaeger-client-go` project

For example:

```go
import (
	"fmt"

	"github.com/uber/jaeger-lib/metrics"
	"go.uber.org/zap"

	"github.com/uber/jaeger-client-go/config"
)
```

## Making A Change

*Before making any significant changes, please [open an
issue](https://github.com/jaegertracing/jaeger-client-go/issues).* Discussing your proposed
changes ahead of time will make the contribution process smooth for everyone.

Once we've discussed your changes and you've got your code ready, make sure
that tests are passing (`make test` or `make cover`) and open your PR. Your
pull request is most likely to be accepted if it:

* Includes tests for new functionality.
* Follows the guidelines in [Effective
  Go](https://golang.org/doc/effective_go.html) and the [Go team's common code
  review comments](https://github.com/golang/go/wiki/CodeReviewComments).
* Has a [good commit message](https://chris.beams.io/posts/git-commit/):
   * Separate subject from body with a blank line
   * Limit the subject line to 50 characters
   * Capitalize the subject line
   * Do not end the subject line with a period
   * Use the imperative mood in the subject line
   * Wrap the body at 72 characters
   * Use the body to explain _what_ and _why_ instead of _how_
* Each commit must be signed by the author ([see below](#sign-your-work)).

## License

By contributing your code, you agree to license your contribution under the terms
of the [Apache License](LICENSE).

If you are adding a new file it should have a header like below.  The easiest
way to add such header is to run `make fmt`.

```
// Copyright (c) 2017 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
```

## Sign your work

The sign-off is a simple line at the end of the explanation for the
patch, which certifies that you wrote it or otherwise have the right to
pass it on as an open-source patch.  The rules are pretty simple: if you
can certify the below (from
[developercertificate.org](http://developercertificate.org/)):

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

then you just add a line to every git commit message:

    Signed-off-by: Joe Smith <joe@gmail.com>

using your real name (sorry, no pseudonyms or anonymous contributions.)

You can add the sign off when creating the git commit via `git commit -s`.

If you want this to be automatic you can set up some aliases:

```
git config --add alias.amend "commit -s --amend"
git config --add alias.c "commit -s"
```
