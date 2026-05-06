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

```go
code := `package a

func main(){
	var a int    // foo
	var b string // bar
}
`
fset := token.NewFileSet()
f, err := parser.ParseFile(fset, "", code, parser.ParseComments)
if err != nil {
	panic(err)
}

list := f.Decls[0].(*ast.FuncDecl).Body.List
list[0], list[1] = list[1], list[0]

if err := format.Node(os.Stdout, fset, f); err != nil {
	panic(err)
}

//Output:
//package a
//
//func main() {
//	// foo
//	var b string
//	var a int
//	// bar
//}
```

Here's the same example using `dst`:

```go
code := `package a

func main(){
	var a int    // foo
	var b string // bar
}
`
f, err := decorator.Parse(code)
if err != nil {
	panic(err)
}

list := f.Decls[0].(*dst.FuncDecl).Body.List
list[0], list[1] = list[1], list[0]

if err := decorator.Print(f); err != nil {
	panic(err)
}

//Output:
//package a
//
//func main() {
//	var b string // bar
//	var a int    // foo
//}
```

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

```go
code := `package main

func main() {
	println("Hello World!")
}`
f, err := decorator.Parse(code)
if err != nil {
	panic(err)
}

call := f.Decls[0].(*dst.FuncDecl).Body.List[0].(*dst.ExprStmt).X.(*dst.CallExpr)

call.Decs.Start.Append("// you can add comments at the start...")
call.Decs.Fun.Append("/* ...in the middle... */")
call.Decs.End.Append("// or at the end.")

if err := decorator.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//func main() {
//	// you can add comments at the start...
//	println /* ...in the middle... */ ("Hello World!") // or at the end.
//}
```

### Spacing

The `Before` property marks the node as having a line space (new line or empty line) before the node. 
These spaces are rendered before any decorations attached to the `Start` decoration point. The `After`
property is similar but rendered after the node (and after any `End` decorations).

```go
code := `package main

func main() {
	println(a, b, c)
}`
f, err := decorator.Parse(code)
if err != nil {
	panic(err)
}

call := f.Decls[0].(*dst.FuncDecl).Body.List[0].(*dst.ExprStmt).X.(*dst.CallExpr)

call.Decs.Before = dst.EmptyLine
call.Decs.After = dst.EmptyLine

for _, v := range call.Args {
	v := v.(*dst.Ident)
	v.Decs.Before = dst.NewLine
	v.Decs.After = dst.NewLine
}

if err := decorator.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//func main() {
//
//	println(
//		a,
//		b,
//		c,
//	)
//
//}
```

### Decorations

The common decoration properties (`Start`, `End`, `Before` and `After`) occur on all nodes, and can be 
accessed with the `Decorations()` method on the `Node` interface:

```go
code := `package main

func main() {
	var i int
	i++
	println(i)
}`
f, err := decorator.Parse(code)
if err != nil {
	panic(err)
}

list := f.Decls[0].(*dst.FuncDecl).Body.List

list[0].Decorations().Before = dst.EmptyLine
list[0].Decorations().End.Append("// the Decorations method allows access to the common")
list[1].Decorations().End.Append("// decoration properties (Before, Start, End and After)")
list[2].Decorations().End.Append("// for all nodes.")
list[2].Decorations().After = dst.EmptyLine

if err := decorator.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//func main() {
//
//	var i int  // the Decorations method allows access to the common
//	i++        // decoration properties (Before, Start, End and After)
//	println(i) // for all nodes.
//
//}
```

#### dstutil.Decorations

While debugging, it is often useful to have a list of all decorations attached to a node. The
[dstutil](https://github.com/dave/dst/tree/master/dstutil) package provides a helper function `Decorations` which
returns a list of the attachment points and all decorations for any node:

```go
code := `package main

// main comment
// is multi line
func main() {

	if true {

		// foo
		println( /* foo inline */ "foo")
	} else if false {
		println /* bar inline */ ("bar")

		// bar after

	} else {
		// empty block
	}
}`

f, err := decorator.Parse(code)
if err != nil {
	panic(err)
}

dst.Inspect(f, func(node dst.Node) bool {
	if node == nil {
		return false
	}
	before, after, points := dstutil.Decorations(node)
	var info string
	if before != dst.None {
		info += fmt.Sprintf("- Before: %s\n", before)
	}
	for _, point := range points {
		if len(point.Decs) == 0 {
			continue
		}
		info += fmt.Sprintf("- %s: [", point.Name)
		for i, dec := range point.Decs {
			if i > 0 {
				info += ", "
			}
			info += fmt.Sprintf("%q", dec)
		}
		info += "]\n"
	}
	if after != dst.None {
		info += fmt.Sprintf("- After: %s\n", after)
	}
	if info != "" {
		fmt.Printf("%T\n%s\n", node, info)
	}
	return true
})

//Output:
//*dst.FuncDecl
//- Before: NewLine
//- Start: ["// main comment", "// is multi line"]
//
//*dst.IfStmt
//- Before: NewLine
//- After: NewLine
//
//*dst.ExprStmt
//- Before: NewLine
//- Start: ["// foo"]
//- After: NewLine
//
//*dst.CallExpr
//- Lparen: ["/* foo inline */"]
//
//*dst.ExprStmt
//- Before: NewLine
//- End: ["\n", "\n", "// bar after"]
//- After: NewLine
//
//*dst.CallExpr
//- Fun: ["/* bar inline */"]
//
//*dst.BlockStmt
//- Lbrace: ["\n", "// empty block"]
```

### Newlines

The `Before` and `After` properties cover the majority of cases, but occasionally a newline needs to 
be rendered inside a node. Simply add a `\n` decoration to accomplish this. 

### Clone

Re-using an existing node elsewhere in the tree will panic when the tree is restored to `ast`. Instead,
use the `Clone` function to make a deep copy of the node before re-use:

```go
code := `package main

var i /* a */ int`

f, err := decorator.Parse(code)
if err != nil {
	panic(err)
}

cloned := dst.Clone(f.Decls[0]).(*dst.GenDecl)

cloned.Decs.Before = dst.NewLine
cloned.Specs[0].(*dst.ValueSpec).Names[0].Name = "j"
cloned.Specs[0].(*dst.ValueSpec).Names[0].Decs.End.Replace("/* b */")

f.Decls = append(f.Decls, cloned)

if err := decorator.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//var i /* a */ int
//var j /* b */ int
```

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

```go
// Create a simple module in a temporary directory
dir, err := tempDir(map[string]string{
	"go.mod":	"module root",
	"main.go":	"package main \n\n func main() {}",
})
defer os.RemoveAll(dir)
if err != nil {
	panic(err)
}

// Use the Load convenience function that calls go/packages to load the package. All loaded
// ast files are decorated to dst.
pkgs, err := decorator.Load(&packages.Config{Dir: dir, Mode: packages.LoadSyntax}, "root")
if err != nil {
	panic(err)
}
p := pkgs[0]
f := p.Syntax[0]

// Add a call expression. Note we don't have to use a SelectorExpr - just adding an Ident with
// the imported package path will do. The restorer will add SelectorExpr where appropriate when
// converting back to ast. Note the new Path field on *dst.Ident. Set this to the package path
// of the imported package, and the restorer will automatically add the import to the import
// block.
b := f.Decls[0].(*dst.FuncDecl).Body
b.List = append(b.List, &dst.ExprStmt{
	X: &dst.CallExpr{
		Fun:	&dst.Ident{Path: "fmt", Name: "Println"},
		Args: []dst.Expr{
			&dst.BasicLit{Kind: token.STRING, Value: strconv.Quote("Hello, World!")},
		},
	},
})

// Create a restorer with the import manager enabled, and print the result. As you can see, the
// import block is automatically managed, and the Println ident is converted to a SelectorExpr:
r := decorator.NewRestorerWithImports("root", gopackages.New(dir))
if err := r.Print(p.Syntax[0]); err != nil {
	panic(err)
}

//Output:
//package main
//
//import "fmt"
//
//func main() { fmt.Println("Hello, World!") }
```

### Mappings

The decorator exposes `Dst.Nodes` and `Ast.Nodes` which map between `ast.Node` and `dst.Node`. This 
enables systems that refer to `ast` nodes (such as `go/types`) to be used:

```go
code := `package main

func main() {
	var i int
	i++
	println(i)
}`

// Parse the code to AST
fset := token.NewFileSet()
astFile, err := parser.ParseFile(fset, "", code, parser.ParseComments)
if err != nil {
	panic(err)
}

// Invoke the type checker using AST as input
typesInfo := types.Info{
	Defs:	make(map[*ast.Ident]types.Object),
	Uses:	make(map[*ast.Ident]types.Object),
}
conf := &types.Config{}
if _, err := conf.Check("", fset, []*ast.File{astFile}, &typesInfo); err != nil {
	panic(err)
}

// Create a new decorator, which will track the mapping between ast and dst nodes
dec := decorator.NewDecorator(fset)

// Decorate the *ast.File to give us a *dst.File
f, err := dec.DecorateFile(astFile)
if err != nil {
	panic(err)
}

// Find the *dst.Ident for the definition of "i"
dstDef := f.Decls[0].(*dst.FuncDecl).Body.List[0].(*dst.DeclStmt).Decl.(*dst.GenDecl).Specs[0].(*dst.ValueSpec).Names[0]

// Find the *ast.Ident using the Ast.Nodes mapping
astDef := dec.Ast.Nodes[dstDef].(*ast.Ident)

// Find the types.Object corresponding to "i"
obj := typesInfo.Defs[astDef]

// Find all the uses of that object
var astUses []*ast.Ident
for id, ob := range typesInfo.Uses {
	if ob != obj {
		continue
	}
	astUses = append(astUses, id)
}

// Find each *dst.Ident in the Dst.Nodes mapping
var dstUses []*dst.Ident
for _, id := range astUses {
	dstUses = append(dstUses, dec.Dst.Nodes[id].(*dst.Ident))
}

// Change the name of the original definition and all uses
dstDef.Name = "foo"
for _, id := range dstUses {
	id.Name = "foo"
}

// Print the DST
if err := decorator.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//func main() {
//	var foo int
//	foo++
//	println(foo)
//}
```

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

```go
code := `package main

	import "fmt"

	func main() {
		fmt.Println("a")
	}`

dec := decorator.NewDecoratorWithImports(token.NewFileSet(), "main", goast.New())

f, err := dec.Parse(code)
if err != nil {
	panic(err)
}

f.Decls[1].(*dst.FuncDecl).Body.List[0].(*dst.ExprStmt).X.(*dst.CallExpr).Args = []dst.Expr{
	&dst.CallExpr{
		Fun: &dst.Ident{Name: "A", Path: "foo.bar/baz"},
	},
}

res := decorator.NewRestorerWithImports("main", guess.New())
if err := res.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//import (
//	"fmt"
//
//	"foo.bar/baz"
//)
//
//func main() {
//	fmt.Println(baz.A())
//}
```

### Alias

To control the alias of imports, use a `FileRestorer`:

```go
code := `package main

	import "fmt"

	func main() {
		fmt.Println("a")
	}`

dec := decorator.NewDecoratorWithImports(token.NewFileSet(), "main", goast.New())

f, err := dec.Parse(code)
if err != nil {
	panic(err)
}

res := decorator.NewRestorerWithImports("main", guess.New())

fr := res.FileRestorer()
fr.Alias["fmt"] = "fmt1"

if err := fr.Print(f); err != nil {
	panic(err)
}

//Output:
//package main
//
//import fmt1 "fmt"
//
//func main() {
//	fmt1.Println("a")
//}
``` 

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