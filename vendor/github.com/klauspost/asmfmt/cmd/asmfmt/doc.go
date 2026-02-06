// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Asmfmt formats Go Assembler files.
It uses tabs for indentation and blanks for alignment.

Without an explicit path, it processes the standard input.  Given a file,
it operates on that file; given a directory, it operates on all .go files in
that directory, recursively.  (Files starting with a period are ignored.)
By default, asmfmt prints the reformatted sources to standard output.

Usage:
	asmfmt [flags] [path ...]

The flags are:
	-d
		Do not print reformatted sources to standard output.
		If a file's formatting is different than asmfmt's, print diffs
		to standard output.
	-e
		Print all (including spurious) errors.
	-l
		Do not print reformatted sources to standard output.
		If a file's formatting is different from asmfmt's, print its name
		to standard output.
	-w
		Do not print reformatted sources to standard output.
		If a file's formatting is different from asmfmt's, overwrite it
		with asmfmt's version.

Debugging support:
	-cpuprofile filename
		Write cpu profile to the specified file.


When asmfmt reads from standard input, it accepts either a full Assembler file
or a program fragment.  A program fragment must be a syntactically
valid declaration list, statement list, or expression.

*/
package main
