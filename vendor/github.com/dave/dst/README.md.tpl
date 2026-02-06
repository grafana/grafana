[![Build Status](https://travis-ci.org/dave/dst.svg?branch=master)](https://travis-ci.org/dave/dst)
[![Documentation](https://img.shields.io/badge/godoc-documentation-brightgreen.svg)](https://godoc.org/github.com/dave/dst/decorator)
[![codecov](https://img.shields.io/badge/codecov-92%25-brightgreen.svg)](https://codecov.io/gh/dave/dst)
![stability-stable](https://img.shields.io/badge/stability-stable-brightgreen.svg)
[![Sourcegraph](https://sourcegraph.com/github.com/dave/dst/-/badge.svg)](https://sourcegraph.com/github.com/dave/dst?badge)

# Decorated Syntax Tree

The `dst` package enables manipulation of a Go syntax tree with high fidelity. Decorations (e.g. 
comments and line spacing) remain attached to the correct nodes as the tree is modified.

## Where does `go/ast` break?

The `go/ast` package wasn't created with source manipulation as an intended use-case. Comments are 
stored by their byte offset instead of attached to nodes, so re-arranging nodes breaks the output. 
See [this Go issue](https://github.com/golang/go/issues/20744) for more information.

Consider this example where we want to reverse the order of the two statements. As you can see the 
comments don't remain attached to the correct nodes:

{{ "ExampleAstBroken" | example }}

Here's the same example using `dst`:

{{ "ExampleDstFixed" | example }}

## Usage

Parsing a source file to `dst` and printing the results after modification can be accomplished with 
several `Parse` and `Print` convenience functions in the [decorator](https://godoc.org/github.com/dave/dst/decorator) 
package. 

For more fine-grained control you can use [Decorator](https://godoc.org/github.com/dave/dst/decorator#Decorator) 
to convert from `ast` to `dst`, and [Restorer](https://godoc.org/github.com/dave/dst/decorator#Restorer) 
to convert back again. 

### Comments

Comments are added at decoration attachment points. [See here](https://github.com/dave/dst/blob/master/decorations-types-generated.go) 
for a full list of these points, along with demonstration code of where they are rendered in the 
output.

The decoration attachment points have convenience functions `Append`, `Prepend`, `Replace`, `Clear` 
and `All` to accomplish common tasks. Use the full text of your comment including the `//` or `/**/` 
markers. When adding a line comment, a newline is automatically rendered.

{{ "ExampleComment" | example }}

### Spacing

The `Before` property marks the node as having a line space (new line or empty line) before the node. 
These spaces are rendered before any decorations attached to the `Start` decoration point. The `After`
property is similar but rendered after the node (and after any `End` decorations).

{{ "ExampleSpace" | example }}

### Decorations

The common decoration properties (`Start`, `End`, `Before` and `After`) occur on all nodes, and can be 
accessed with the `Decorations()` method on the `Node` interface:

{{ "ExampleDecorated" | example }}

#### dstutil.Decorations

While debugging, it is often useful to have a list of all decorations attached to a node. The
[dstutil](https://github.com/dave/dst/tree/master/dstutil) package provides a helper function `Decorations` which
returns a list of the attachment points and all decorations for any node:

{{ "ExampleDecorationPoints" | example }}

### Newlines

The `Before` and `After` properties cover the majority of cases, but occasionally a newline needs to 
be rendered inside a node. Simply add a `\n` decoration to accomplish this. 

### Clone

Re-using an existing node elsewhere in the tree will panic when the tree is restored to `ast`. Instead,
use the `Clone` function to make a deep copy of the node before re-use:

{{ "ExampleClone" | example }}

### Apply

The [dstutil](https://github.com/dave/dst/tree/master/dstutil) package is a fork of `golang.org/x/tools/go/ast/astutil`, 
and provides the `Apply` function with similar semantics.     

### Imports

The decorator can automatically manage the `import` block, which is a non-trivial task.

Use [NewDecoratorWithImports](https://godoc.org/github.com/dave/dst/decorator#NewDecoratorWithImports) 
and [NewRestorerWithImports](https://godoc.org/github.com/dave/dst/decorator#NewRestorerWithImports) 
to create an import aware decorator / restorer. 

During decoration, remote identifiers are normalised - `*ast.SelectorExpr` nodes that represent 
qualified identifiers are replaced with `*dst.Ident` nodes with the `Path` field set to the path of 
the imported package. 

When adding a qualified identifier node, there is no need to use `*dst.SelectorExpr` - just add a 
`*dst.Ident` and set `Path` to the imported package path. The restorer will wrap it in a 
`*ast.SelectorExpr` where appropriate when converting back to ast, and also update the import 
block.

To enable import management, the decorator must be able to resolve the imported package for 
selector expressions and identifiers, and the restorer must be able to resolve the name of a 
package given it's path. Several implementations for these resolvers are provided, and the best 
method will depend on the environment. [See below](#resolvers) for more details.

### Load

The [Load](https://godoc.org/github.com/dave/dst/decorator#Load) convenience function uses 
`go/packages` to load packages and decorate all loaded ast files, with import management enabled:

{{ "ExampleImports" | example }}

### Mappings

The decorator exposes `Dst.Nodes` and `Ast.Nodes` which map between `ast.Node` and `dst.Node`. This 
enables systems that refer to `ast` nodes (such as `go/types`) to be used:

{{ "ExampleTypes" | example }}

## Resolvers

There are two separate interfaces defined by the [resolver package](https://github.com/dave/dst/tree/master/decorator/resolver) 
which allow the decorator and restorer to automatically manage the imports block.

The decorator uses a `DecoratorResolver` which resolves the package path of any `*ast.Ident`. This is 
complicated by dot-import syntax ([see below](#dot-imports)).

The restorer uses a `RestorerResolver` which resolves the name of any package given the path. This 
is complicated by vendoring and Go modules.

When `Resolver` is set on `Decorator` or `Restorer`, the `Path` property must be set to the local 
package path.

Several implementations of both interfaces that are suitable for different environments are 
provided:

### DecoratorResolver

#### gotypes

The [gotypes](https://github.com/dave/dst/blob/master/decorator/resolver/gotypes/resolver.go) 
package provides a `DecoratorResolver` with full dot-import compatibility. However it requires full 
export data for all imported packages, so the `Uses` map from `go/types.Info` is required. There 
are several methods of generating `go/types.Info`. Using `golang.org/x/tools/go/packages.Load` is 
recommended for full Go modules compatibility. See the [decorator.Load](https://godoc.org/github.com/dave/dst/decorator#Load)
convenience function to automate this.

#### goast

The [goast](https://github.com/dave/dst/blob/master/decorator/resolver/goast/resolver.go) package 
provides a simplified `DecoratorResolver` that only needs to scan a single ast file. This is unable 
to resolve identifiers from dot-imported packages, so will panic if a dot-import is encountered in 
the import block. It uses the provided `RestorerResolver` to resolve the names of all imported 
packages. If no `RestorerResolver` is provided, the [guess](#guess-and-simple) implementation is used. 

### RestorerResolver

#### gopackages

The [gopackages](https://github.com/dave/dst/blob/master/decorator/resolver/gopackages/resolver.go) 
package provides a `RestorerResolver` with full compatibility with Go modules. It uses 
`golang.org/x/tools/go/packages` to load the package data. This may be very slow, and uses the `go` 
command line tool to query package data, so may not be compatible with some environments. 

#### gobuild

The [gobuild](https://github.com/dave/dst/blob/master/decorator/resolver/gobuild/resolver.go) 
package provides an alternative `RestorerResolver` that uses the legacy `go/build` system to load 
the imported package data. This may be needed in some circumstances and provides better performance 
than `go/packages`. However, this is not Go modules aware.

#### guess and simple

The [guess](https://github.com/dave/dst/blob/master/decorator/resolver/guess/resolver.go) and 
[simple](https://github.com/dave/dst/blob/master/decorator/resolver/simple/resolver.go) packages
provide simple `RestorerResolver` implementations that may be useful in certain circumstances, or 
where performance is critical. `simple` resolves paths only if they occur in a provided map. 
`guess` guesses the package name based on the last part of the path.

### Example

Here's an example of supplying resolvers for the decorator and restorer:

{{ "ExampleManualImports" | example }}

### Alias

To control the alias of imports, use a `FileRestorer`:

{{ "ExampleAlias" | example }} 

### Details

For more information on exactly how the imports block is managed, read through the [test 
cases](https://github.com/dave/dst/blob/master/decorator/restorer_resolver_test.go).

### Dot-imports

Consider this file...

```go
package main

import (
	. "a"
)

func main() {
	B()
	C()
}
```

`B` and `C` could be local identifiers from a different file in this package,
or from the imported package `a`. If only one is from `a` and it is removed, we should remove the
import when we restore to `ast`. Thus the resolver needs to be able to resolve the package using 
the full info from `go/types`.

## Status

This package is well tested and used in many projects. The API should be considered stable going forward.

## Chat?

Feel free to create an [issue](https://github.com/dave/dst/issues) or chat in the 
[#dst](https://gophers.slack.com/messages/CCVL24MTQ) Gophers Slack channel.

## Contributing

For further developing or contributing to `dst`, check out [these notes](https://github.com/dave/dst/blob/master/contributing.md).

## Special thanks

Thanks very much to [hawkinsw](https://github.com/hawkinsw) for taking on the task of adding generics compatibility to `dst`.