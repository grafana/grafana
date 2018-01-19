GoConvey is awesome Go testing
==============================

[![Build Status](https://travis-ci.org/smartystreets/goconvey.png)](https://travis-ci.org/smartystreets/goconvey)
[![GoDoc](https://godoc.org/github.com/smartystreets/goconvey?status.svg)](http://godoc.org/github.com/smartystreets/goconvey)


Welcome to GoConvey, a yummy Go testing tool for gophers. Works with `go test`. Use it in the terminal or browser according to your viewing pleasure. **[View full feature tour.](http://goconvey.co)**

**Features:**

- Directly integrates with `go test`
- Fully-automatic web UI (works with native Go tests, too)
- Huge suite of regression tests
- Shows test coverage (Go 1.2+)
- Readable, colorized console output (understandable by any manager, IT or not)
- Test code generator
- Desktop notifications (optional)
- Immediately open problem lines in [Sublime Text](http://www.sublimetext.com) ([some assembly required](https://github.com/asuth/subl-handler))


You can ask questions about how to use GoConvey on [StackOverflow](http://stackoverflow.com/questions/ask?tags=goconvey,go&title=GoConvey%3A%20). Use the tags `go` and `goconvey`.

**Menu:**

- [Installation](#installation)
- [Quick start](#quick-start)
- [Documentation](#documentation)
- [Screenshots](#screenshots)
- [Contributors](#contributors)




Installation
------------

	$ go get github.com/smartystreets/goconvey

[Quick start](https://github.com/smartystreets/goconvey/wiki#get-going-in-25-seconds)
-----------

Make a test, for example:

```go
package package_name

import (
    "testing"
    . "github.com/smartystreets/goconvey/convey"
)

func TestSpec(t *testing.T) {

	// Only pass t into top-level Convey calls
	Convey("Given some integer with a starting value", t, func() {
		x := 1

		Convey("When the integer is incremented", func() {
			x++

			Convey("The value should be greater by one", func() {
				So(x, ShouldEqual, 2)
			})
		})
	})
}
```


#### [In the browser](https://github.com/smartystreets/goconvey/wiki/Web-UI)

Start up the GoConvey web server at your project's path:

	$ $GOPATH/bin/goconvey

Then watch the test results display in your browser at:

	http://localhost:8080


If the browser doesn't open automatically, please click [http://localhost:8080](http://localhost:8080) to open manually.

There you have it.
![](http://d79i1fxsrar4t.cloudfront.net/goconvey.co/gc-1-dark.png)
As long as GoConvey is running, test results will automatically update in your browser window.

![](http://d79i1fxsrar4t.cloudfront.net/goconvey.co/gc-5-dark.png)
The design is responsive, so you can squish the browser real tight if you need to put it beside your code.


The [web UI](https://github.com/smartystreets/goconvey/wiki/Web-UI) supports traditional Go tests, so use it even if you're not using GoConvey tests.



#### [In the terminal](https://github.com/smartystreets/goconvey/wiki/Execution)

Just do what you do best:

    $ go test

Or if you want the output to include the story:

    $ go test -v


[Documentation](https://github.com/smartystreets/goconvey/wiki)
-----------

Check out the

- [GoConvey wiki](https://github.com/smartystreets/goconvey/wiki),
- [![GoDoc](https://godoc.org/github.com/smartystreets/goconvey?status.png)](http://godoc.org/github.com/smartystreets/goconvey)
- and the *_test.go files scattered throughout this project.

[Screenshots](http://goconvey.co)
-----------

For web UI and terminal screenshots, check out [the full feature tour](http://goconvey.co).

Contributors
----------------------

GoConvey is brought to you by [SmartyStreets](https://github.com/smartystreets) and [several contributors](https://github.com/smartystreets/goconvey/graphs/contributors) (Thanks!).
