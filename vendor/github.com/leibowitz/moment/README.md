moment
======

[![Build Status](https://travis-ci.org/leibowitz/moment.svg?branch=master)](https://travis-ci.org/leibowitz/moment)

Port of moment.js to Go (Golang) with some additional features for working with dates and times. Also some major inspiration from Carbon as well as some custom functions.

Supports custom formats (i.e. YYYY-MM-DD instead of Go's 2006-01-02) - currently the moment format and strftime formats are supported.

Note this is still a work in progress and not anywhere near production ready. Please feel free to fork and contribute missing methods, timezones, strtotime(), locale/languages functionality, or just provide more idiomatic Go if you see potential for improvement. I'm currently working on unit tests and eventually documentation.

Links:
 * http://momentjs.com/
 * https://github.com/briannesbitt/Carbon
 * http://golang.org/pkg/time/
 * https://github.com/fightbulc/moment.php (Credits for replacement keys and regex in moment_parser.go)
