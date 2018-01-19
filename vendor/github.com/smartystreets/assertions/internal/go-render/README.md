go-render: A verbose recursive Go type-to-string conversion library.
====================================================================

[![GoDoc](https://godoc.org/github.com/luci/go-render?status.svg)](https://godoc.org/github.com/luci/go-render)
[![Build Status](https://travis-ci.org/luci/go-render.svg)](https://travis-ci.org/luci/go-render)

This is not an official Google product.

## Overview

The *render* package implements a more verbose form of the standard Go string
formatter, `fmt.Sprintf("%#v", value)`, adding:
  - Pointer recursion. Normally, Go stops at the first pointer and prints its
    address. The *render* package will recurse and continue to render pointer
    values.
  - Recursion loop detection. Recursion is nice, but if a recursion path detects
    a loop, *render* will note this and move on.
  - Custom type name rendering.
  - Deterministic key sorting for `string`- and `int`-keyed maps.
  - Testing!

Call `render.Render` and pass it an `interface{}`.

For example:

```Go
type customType int
type testStruct struct {
        S string
        V *map[string]int
        I interface{}
}

a := testStruct{
        S: "hello",
        V: &map[string]int{"foo": 0, "bar": 1},
        I: customType(42),
}

fmt.Println("Render test:")
fmt.Printf("fmt.Printf:    %#v\n", a)))
fmt.Printf("render.Render: %s\n", Render(a))
```

Yields:
```
fmt.Printf:    render.testStruct{S:"hello", V:(*map[string]int)(0x600dd065), I:42}
render.Render: render.testStruct{S:"hello", V:(*map[string]int){"bar":1, "foo":0}, I:render.customType(42)}
```

This is not intended to be a high-performance library, but it's not terrible
either.

Contributing
------------

  * Sign the [Google CLA](https://cla.developers.google.com/clas).
  * Make sure your `user.email` and `user.name` are configured in `git config`.
  * Install the [pcg](https://github.com/maruel/pre-commit-go) git hook:
    `go get -u github.com/maruel/pre-commit-go/cmd/... && pcg`

Run the following to setup the code review tool and create your first review:

    git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git $HOME/src/depot_tools
    export PATH="$PATH:$HOME/src/depot_tools"
    cd $GOROOT/github.com/luci/go-render
    git checkout -b work origin/master

    # hack hack

    git commit -a -m "This is awesome\nR=joe@example.com"
    # This will ask for your Google Account credentials.
    git cl upload -s
    # Wait for LGTM over email.
    # Check the commit queue box in codereview website.
    # Wait for the change to be tested and landed automatically.

Use `git cl help` and `git cl help <cmd>` for more details.
