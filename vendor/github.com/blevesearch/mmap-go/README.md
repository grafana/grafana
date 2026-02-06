mmap-go
=======

mmap-go is a portable mmap package for the [Go programming language](http://golang.org).
It has been tested on Linux (386, amd64), OS X, and Windows (386). It should also
work on other Unix-like platforms, but hasn't been tested with them. I'm interested
to hear about the results.

I haven't been able to add more features without adding significant complexity,
so mmap-go doesn't support mprotect, mincore, and maybe a few other things.
If you're running on a Unix-like platform and need some of these features,
I suggest Gustavo Niemeyer's [gommap](http://labix.org/gommap).
