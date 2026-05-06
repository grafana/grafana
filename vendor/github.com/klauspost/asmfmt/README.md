# asmfmt
Go Assembler Formatter

This will format your assembler code in a similar way that `gofmt` formats your Go code.

Read Introduction: [asmfmt: Go Assembler Formatter](https://blog.klauspost.com/asmfmt-assembler-formatter/)

[![Go Reference](https://pkg.go.dev/badge/klauspost/asmfmt.svg)](https://pkg.go.dev/klauspost/asmfmt)
[![Go](https://github.com/klauspost/asmfmt/actions/workflows/go.yml/badge.svg)](https://github.com/klauspost/asmfmt/actions/workflows/go.yml)

See [Example 1](https://files.klauspost.com/diff.html), [Example 2](https://files.klauspost.com/diff2.html), [Example 3](https://files.klauspost.com/diff3.html), or compare files in the [testdata folder](https://github.com/klauspost/asmfmt/tree/master/testdata).

Status: STABLE. The format will only change if bugs are found. Please report any feedback in the issue section.

# install

Binaries can be downloaded from [Releases](https://github.com/klauspost/asmfmt/releases). Unpack the file into your executable path.

To install the standalone formatter from source using Go framework: `go install github.com/klauspost/asmfmt/cmd/asmfmt@latest`.

# updates

* Apr 8, 2021: Add modules info and remove other than main tools. 
* Jan 6, 2021: Fix C comments before line comments like `VPCMPEQB Y8/*(DI)*/, Y0, Y1 // comment...`
* Aug 8, 2016: Don't indent comments before non-indented instruction.
* Jun 10, 2016: Fixed crash with end-of-line comments that contained an end-of-block `/*` part.
* Apr 14, 2016: Fix end of multiline comments in macro definitions.
* Apr 14, 2016: Updated tools to Go 1.5+
* Dec 21, 2015: Space before semi-colons in macro definitions is now trimmed.
* Dec 21, 2015: Fix line comments in macro definitions (only valid with Go 1.5).
* Dec 17, 2015: Comments are better aligned to the following section.
* Dec 17, 2015: Clean semi-colons in multiple instruction per line.

# goland

To set up a custom File Watcher in Goland, 

* Go to Settings -> Tools -> File Watchers
* Press **+** and choose `<custom>` template.
* Name it `asmfmt`
* File Type, Select `x86 Plan 9 Assembly file` (it will apply to all platforms)
* Scope: `Project Files`
* Arguments: `$FilePath$`.
* Output Paths to Refresh: `$FilePath$`
* Working Directory: `$ProjectFileDir$`

Advanced options, Enable:

* [x] Trigger the watcher regardless of syntax errors (IMPORTANT) 
* [x] Create output file from stdout

Disable the rest.

![Goland Configuration](https://user-images.githubusercontent.com/5663952/114158973-96eebc80-9925-11eb-9aea-703ce474a7bb.png)


# emacs

To automatically format assembler, in `.emacs` add:

```
(defun asm-mode-setup ()
  (set (make-local-variable 'gofmt-command) "asmfmt")
  (add-hook 'before-save-hook 'gofmt nil t)
)

(add-hook 'asm-mode-hook 'asm-mode-setup)
```

# usage

`asmfmt [flags] [path ...]`

The flags are similar to `gofmt`, except it will only process `.s` files:
```
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
```
You should only run `asmfmt` on files that are assembler files. Assembler files cannot be positively identified, so it will mangle non-assembler files.

# formatting

* Automatic indentation.
* It uses tabs for indentation and blanks for alignment.
* It will remove trailing whitespace.
* It will align the first parameter.
* It will align all comments in a block.
* It will eliminate multiple blank lines.
* Removes `;` at end of line.
* Forced newline before comments, except when preceded by label or another comment.
* Forced newline before labels, except when preceded by comment.
* Labels are on a separate lines, except for comments.
* Retains block breaks (newline between blocks).
* It will convert single line block comments to line comments.
* Line comments have a space after `//`, except if comment starts with `+`.
* There is always a space between parameters.
* Macros in the same file are tracked, and not included in parameter indentation.
* `TEXT`, `DATA` and `GLOBL`, `FUNCDATA`, `PCDATA` and labels are level 0 indentation.
* Aligns `\` in multiline macros.
* Whitespace before separating `;` is removed. Space is inserted after, if followed by another instruction.

