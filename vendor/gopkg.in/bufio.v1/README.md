bufio
=====

This is a fork of the http://golang.org/pkg/bufio/ package. It adds `ReadN` method that allows reading next `n` bytes from the internal buffer without allocating intermediate buffer. This method works just like the [Buffer.Next](http://golang.org/pkg/bytes/#Buffer.Next) method, but has slightly different signature.
