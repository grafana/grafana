This package is a brotli compressor and decompressor implemented in Go.
It was translated from the reference implementation (https://github.com/google/brotli)
with the `c2go` tool at https://github.com/andybalholm/c2go.

I have been working on new compression algorithms (not translated from C)
in the matchfinder package.
You can use them with the NewWriterV2 function.
Currently they give better results than the old implementation
(at least for compressing my test file, Newton’s *Opticks*) 
on levels 2 to 6.

I am using it in production with https://github.com/andybalholm/redwood.

API documentation is found at https://pkg.go.dev/github.com/andybalholm/brotli?tab=doc.
