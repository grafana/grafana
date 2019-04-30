# About chromedp [![Build Status][1]][2] [![Coverage Status][3]][4]

Package chromedp is a faster, simpler way to drive browsers supporting the
[Chrome DevTools Protocol][5] in Go using the without external dependencies
(ie, Selenium, PhantomJS, etc).

## Installing

Install in the usual Go way:

```sh
go get -u github.com/chromedp/chromedp
```

## Examples

Please see the [examples][6] project for more examples. Please refer to the
[GoDoc API listing][7] for a summary of the API and Actions, which also contains
a few simple and runnable examples.

## Resources

* [chromedp: A New Way to Drive the Web][8] - GopherCon SG 2017 talk
* [Chrome DevTools Protocol][5] - Chrome DevTools Protocol Domain documentation
* [chromedp examples][6] - various `chromedp` examples
* [`github.com/chromedp/cdproto`][9] - GoDoc listing for the CDP domains used by `chromedp`
* [`github.com/chromedp/cdproto-gen`][10] - tool used to generate `cdproto`
* [`github.com/chromedp/chromedp-proxy`][11] - a simple CDP proxy for logging CDP clients and browsers

## TODO

* Implement more query selector options (allow over riding context timeouts)
* Contextual actions for "dry run" (or via an accumulator?)
* Network loader / manager
* Profiler

[1]: https://travis-ci.org/chromedp/chromedp.svg
[2]: https://travis-ci.org/chromedp/chromedp
[3]: https://coveralls.io/repos/chromedp/chromedp/badge.svg?branch=master&service=github
[4]: https://coveralls.io/github/chromedp/chromedp?branch=master
[5]: https://chromedevtools.github.io/devtools-protocol/
[6]: https://github.com/chromedp/examples
[7]: https://godoc.org/github.com/chromedp/chromedp
[8]: https://www.youtube.com/watch?v=_7pWCg94sKw
[9]: https://godoc.org/github.com/chromedp/cdproto
[10]: https://github.com/chromedp/cdproto-gen
[11]: https://github.com/chromedp/chromedp-proxy
