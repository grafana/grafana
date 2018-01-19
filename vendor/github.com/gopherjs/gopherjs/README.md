GopherJS - A compiler from Go to JavaScript
-------------------------------------------

[![Sourcegraph](https://sourcegraph.com/github.com/gopherjs/gopherjs/-/badge.svg)](https://sourcegraph.com/github.com/gopherjs/gopherjs?badge)
[![Circle CI](https://circleci.com/gh/gopherjs/gopherjs.svg?style=svg)](https://circleci.com/gh/gopherjs/gopherjs)

GopherJS compiles Go code ([golang.org](https://golang.org/)) to pure JavaScript code. Its main purpose is to give you the opportunity to write front-end code in Go which will still run in all browsers.

### Playground
Give GopherJS a try on the [GopherJS Playground](http://gopherjs.github.io/playground/).

### What is supported?
Nearly everything, including Goroutines ([compatibility table](https://github.com/gopherjs/gopherjs/blob/master/doc/packages.md)). Performance is quite good in most cases, see [HTML5 game engine benchmark](https://ajhager.github.io/engi/demos/botmark.html). Cgo is not supported. Using a vendored copy of GopherJS is currently not supported, see [#415](https://github.com/gopherjs/gopherjs/issues/415).

### Installation and Usage
Get or update GopherJS and dependencies with:

```
go get -u github.com/gopherjs/gopherjs
```

Now you can use `gopherjs build [package]`, `gopherjs build [files]` or `gopherjs install [package]` which behave similar to the `go` tool. For `main` packages, these commands create a `.js` file and `.js.map` source map in the current directory or in `$GOPATH/bin`. The generated JavaScript file can be used as usual in a website. Use `gopherjs help [command]` to get a list of possible command line flags, e.g. for minification and automatically watching for changes.

*Note: GopherJS will try to write compiled object files of the core packages to your $GOROOT/pkg directory. If that fails, it will fall back to $GOPATH/pkg.*

#### gopherjs run, gopherjs test

If you want to use `gopherjs run` or `gopherjs test` to run the generated code locally, install Node.js 4.x (or newer), and the `source-map-support` module:

```
npm install --global source-map-support
```

For system calls (file system access, etc.), see [this page](https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md).

#### gopherjs serve

`gopherjs serve` is a useful command you can use during development. It will start an HTTP server serving on ":8080" by default, then dynamically compile your Go packages with GopherJS and serve them.

For example, navigating to `http://localhost:8080/example.com/user/project/` should compile and run the Go package `example.com/user/project`. The generated JavaScript output will be served at `http://localhost:8080/example.com/user/project/project.js` (the .js file name will be equal to the base directory name). If the directory contains `index.html` it will be served, otherwise a minimal `index.html` that includes `<script src="project.js"></script>` will be provided, causing the JavaScript to be executed. All other static files will be served too.

Refreshing in the browser will rebuild the served files if needed. Compilation errors will be displayed in terminal, and in browser console. Additionally, it will serve $GOROOT and $GOPATH for sourcemaps.

If you include an argument, it will be the root from which everything is served. For example, if you run `gopherjs serve github.com/user/project` then the generated JavaScript for the package github.com/user/project/mypkg will be served at http://localhost:8080/mypkg/mypkg.js.

### Performance Tips

- Use the `-m` command line flag to generate minified code.
- Apply gzip compression (https://en.wikipedia.org/wiki/HTTP_compression).
- Use `int` instead of `(u)int8/16/32/64`.
- Use `float64` instead of `float32`.

### Community
- [#gopherjs Channel on Gophers Slack](https://gophers.slack.com/messages/gopherjs/) (invites to Gophers Slack are available [here](http://blog.gopheracademy.com/gophers-slack-community/#how-can-i-be-invited-to-join:2facdc921b2310f18cb851c36fa92369))
- [Bindings to JavaScript APIs and libraries](https://github.com/gopherjs/gopherjs/wiki/bindings)
- [GopherJS Blog](https://medium.com/gopherjs)
- [GopherJS on Twitter](https://twitter.com/GopherJS)

### Getting started

#### Interacting with the DOM
The package `github.com/gopherjs/gopherjs/js` (see [documentation](https://godoc.org/github.com/gopherjs/gopherjs/js)) provides functions for interacting with native JavaScript APIs. For example the line

```js
document.write("Hello world!");
```

would look like this in Go:

```go
js.Global.Get("document").Call("write", "Hello world!")
```

You may also want use the [DOM bindings](http://dominik.honnef.co/go/js/dom), the [jQuery bindings](https://github.com/gopherjs/jquery) (see [TodoMVC Example](https://github.com/gopherjs/todomvc)) or the [AngularJS bindings](https://github.com/wvell/go-angularjs). Those are some of the [bindings to JavaScript APIs and libraries](https://github.com/gopherjs/gopherjs/wiki/bindings) by community members.

#### Providing library functions for use in other JavaScript code
Set a global variable to a map that contains the functions:

```go
package main

import "github.com/gopherjs/gopherjs/js"

func main() {
	js.Global.Set("pet", map[string]interface{}{
		"New": New,
	})
}

type Pet struct {
	name string
}

func New(name string) *js.Object {
	return js.MakeWrapper(&Pet{name})
}

func (p *Pet) Name() string {
	return p.name
}

func (p *Pet) SetName(name string) {
	p.name = name
}
```

For more details see [Jason Stone's blog post](http://legacytotheedge.blogspot.de/2014/03/gopherjs-go-to-javascript-transpiler.html) about GopherJS.

### Architecture

#### General
GopherJS emulates a 32-bit environment. This means that `int`, `uint` and `uintptr` have a precision of 32 bits. However, the explicit 64-bit integer types `int64` and `uint64` are supported. The `GOARCH` value of GopherJS is "js". You may use it as a build constraint: `// +build js`.

#### Application Lifecycle

The `main` function is executed as usual after all `init` functions have run. JavaScript callbacks can also invoke Go functions, even after the `main` function has exited. Therefore the end of the `main` function should not be regarded as the end of the application and does not end the execution of other goroutines.

In the browser, calling `os.Exit` (e.g. indirectly by `log.Fatal`) also does not terminate the execution of the program. For convenience, it calls `runtime.Goexit` to immediately terminate the calling goroutine.

#### Goroutines
Goroutines are fully supported by GopherJS. The only restriction is that you need to start a new goroutine if you want to use blocking code called from external JavaScript:

```go
js.Global.Get("myButton").Call("addEventListener", "click", func() {
  go func() {
    [...]
    someBlockingFunction()
    [...]
  }()
})
```

How it works:

JavaScript has no concept of concurrency (except web workers, but those are too strictly separated to be used for goroutines). Because of that, instructions in JavaScript are never blocking. A blocking call would effectively freeze the responsiveness of your web page, so calls with callback arguments are used instead.

GopherJS does some heavy lifting to work around this restriction: Whenever an instruction is blocking (e.g. communicating with a channel that isn't ready), the whole stack will unwind (= all functions return) and the goroutine will be put to sleep. Then another goroutine which is ready to resume gets picked and its stack with all local variables will be restored.

### GopherJS Development
If you're looking to make changes to the GopherJS compiler, see [Developer Guidelines](https://github.com/gopherjs/gopherjs/wiki/Developer-Guidelines) for additional developer information.
