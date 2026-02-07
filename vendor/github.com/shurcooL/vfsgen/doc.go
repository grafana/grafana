/*
Package vfsgen takes an http.FileSystem (likely at `go generate` time) and
generates Go code that statically implements the provided http.FileSystem.

Features:

-	Efficient generated code without unneccessary overhead.

-	Uses gzip compression internally (selectively, only for files that compress well).

-	Enables direct access to internal gzip compressed bytes via an optional interface.

-	Outputs `gofmt`ed Go code.
*/
package vfsgen
