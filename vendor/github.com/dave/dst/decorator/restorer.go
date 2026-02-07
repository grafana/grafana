package decorator

import (
	"fmt"
	"go/ast"
	"go/format"
	"go/token"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/dave/dst"
	"github.com/dave/dst/decorator/resolver"
)

// NewRestorer returns a restorer.
func NewRestorer() *Restorer {
	return &Restorer{
		Map:  newMap(),
		Fset: token.NewFileSet(),
	}
}

// NewRestorerWithImports returns a restorer with import management attributes set.
func NewRestorerWithImports(path string, resolver resolver.RestorerResolver) *Restorer {
	res := NewRestorer()
	res.Path = path
	res.Resolver = resolver
	return res
}

// Restorer restores dst.Node to ast.Node
type Restorer struct {
	Map
	Fset   *token.FileSet // Fset is the *token.FileSet in use. Set this to use a pre-existing FileSet.
	Extras bool           // Resore Objects, Scopes etc. Not needed for printing the resultant AST. If set to true, Objects and Scopes must be carefully managed to avoid duplicate nodes.

	// If a Resolver is provided, the names of all imported packages are resolved, and the imports
	// block is updated. All remote identifiers are updated (sometimes this involves changing
	// SelectorExpr.X.Name, or even swapping between Ident and SelectorExpr). To force specific
	// import alias names, use the FileRestorer.Alias map.
	Resolver resolver.RestorerResolver
	// Local package path - required if Resolver is set.
	Path string
}

// Print uses format.Node to print a *dst.File to stdout
func (pr *Restorer) Print(f *dst.File) error {
	return pr.Fprint(os.Stdout, f)
}

// Fprint uses format.Node to print a *dst.File to a writer
func (pr *Restorer) Fprint(w io.Writer, f *dst.File) error {
	af, err := pr.RestoreFile(f)
	if err != nil {
		return err
	}
	return format.Node(w, pr.Fset, af)
}

// RestoreFile restores a *dst.File to an *ast.File
func (pr *Restorer) RestoreFile(file *dst.File) (*ast.File, error) {
	return pr.FileRestorer().RestoreFile(file)
}

// FileRestorer restores a specific file with extra options
func (pr *Restorer) FileRestorer() *FileRestorer {
	return &FileRestorer{
		Restorer: pr,
		Alias:    map[string]string{},
	}
}

// FileRestorer restores a specific file with extra options
type FileRestorer struct {
	*Restorer
	Alias           map[string]string // Map of package path -> package alias for imports
	Name            string            // The name of the restored file in the FileSet. Can usually be left empty.
	file            *dst.File
	lines           []int
	comments        []*ast.CommentGroup
	base            int
	cursor          token.Pos
	nodeDecl        map[*ast.Object]dst.Node // Objects that have a ast.Node Decl (look up after file has been rendered)
	nodeData        map[*ast.Object]dst.Node // Objects that have a ast.Node Data (look up after file has been rendered)
	cursorAtNewLine token.Pos                // The cursor position directly after adding a newline decoration (or a line comment which ends in a "\n"). If we're still at this cursor position when we add a line space, reduce the "\n" by one.
	packageNames    map[string]string        // names in the code of all imported packages ("." for dot-imports)
}

// Print uses format.Node to print a *dst.File to stdout
func (r *FileRestorer) Print(f *dst.File) error {
	return r.Fprint(os.Stdout, f)
}

// Fprint uses format.Node to print a *dst.File to a writer
func (r *FileRestorer) Fprint(w io.Writer, f *dst.File) error {
	af, err := r.RestoreFile(f)
	if err != nil {
		return err
	}
	return format.Node(w, r.Fset, af)
}

// RestoreFile restores a *dst.File to *ast.File
func (r *FileRestorer) RestoreFile(file *dst.File) (*ast.File, error) {

	if r.Resolver == nil && r.Path != "" {
		panic("Restorer Path should be empty when Resolver is nil")
	}

	if r.Resolver != nil && r.Path == "" {
		panic("Restorer Path should be set when Resolver is set")
	}

	if r.Fset == nil {
		r.Fset = token.NewFileSet()
	}

	// reset the FileRestorer, but leave Name and the Alias map unchanged

	r.file = file
	r.lines = []int{0} // initialise with the first line at Pos 0
	r.nodeDecl = map[*ast.Object]dst.Node{}
	r.nodeData = map[*ast.Object]dst.Node{}
	r.packageNames = map[string]string{}
	r.comments = []*ast.CommentGroup{}
	r.cursorAtNewLine = 0
	r.packageNames = map[string]string{}

	r.base = r.Fset.Base() // base is the pos that the file will start at in the fset
	r.cursor = token.Pos(r.base)

	if err := r.updateImports(); err != nil {
		return nil, err
	}

	// restore the file, populate comments and lines
	f := r.restoreNode(r.file, "", "", "", false).(*ast.File)

	for _, cg := range r.comments {
		f.Comments = append(f.Comments, cg)
	}

	ff := r.Fset.AddFile(r.Name, r.base, r.fileSize())
	if !ff.SetLines(r.lines) {
		panic("ff.SetLines failed")
	}

	if r.Extras {
		// Sometimes new nodes are created here (e.g. in RangeStmt the "Object" is an AssignStmt
		// which never occurs in the actual code). These shouldn't have position information but
		// perhaps it doesn't matter?
		for o, dn := range r.nodeDecl {
			o.Decl = r.restoreNode(dn, "", "", "", true)
		}
		for o, dn := range r.nodeData {
			o.Data = r.restoreNode(dn, "", "", "", true)
		}
	}

	return f, nil
}

func (r *FileRestorer) updateImports() error {

	if r.Resolver == nil {
		return nil
	}

	// list of the import block(s)
	var blocks []*dst.GenDecl

	// hasCgoBlock is only true if the "C" import is on it's own in a block at the start of the
	// file. If so, this is avoided. If there are no more imports in the file, and a new block is
	// added, it should be added below this block.
	var hasCgoBlock bool

	// map of package path -> alias for all packages currently in the imports block(s). Alias can
	// be an alias, an empty string, "_" or "."
	importsFound := map[string]string{}

	// a list of all packages that occur in the source (package path -> true)
	packagesInUse := map[string]bool{}

	// a list of all the imports that will be in the imports block after the update
	importsRequired := map[string]bool{}

	dst.Inspect(r.file, func(n dst.Node) bool {
		switch n := n.(type) {
		case *dst.Ident:
			if n.Path == "" {
				return true
			}
			if n.Path == r.Path {
				return true
			}
			packagesInUse[n.Path] = true
			importsRequired[n.Path] = true

		case *dst.GenDecl:
			if n.Tok != token.IMPORT {
				return true
			}
			// if this block has 1 spec and it's the "C" import, ignore it.
			if len(n.Specs) == 1 && mustUnquote(n.Specs[0].(*dst.ImportSpec).Path.Value) == "C" {
				hasCgoBlock = true
				return true
			}
			blocks = append(blocks, n)

		case *dst.ImportSpec:
			path := mustUnquote(n.Path.Value)
			if n.Name == nil {
				importsFound[path] = ""
			} else {
				importsFound[path] = n.Name.Name
			}
			if path == "C" {
				// never remove the "C" import
				importsRequired["C"] = true
			}
		}
		return true
	})

	// resolved names of all packages in use
	resolved := map[string]string{}

	// the effective alias requested - the manually supplied alias will override the alias from the
	// import block
	effectiveAlias := map[string]string{}
	for path, alias := range importsFound {
		if alias == "" {
			continue
		}
		if a, ok := r.Alias[path]; ok && a == "" {
			continue
		}
		if alias == "_" && packagesInUse[path] {
			continue
		}
		effectiveAlias[path] = alias
	}
	for path, alias := range r.Alias {
		if alias == "" {
			continue
		}
		if alias == "_" && packagesInUse[path] {
			continue
		}
		effectiveAlias[path] = alias
	}

	// any anonymous imports
	for path, alias := range effectiveAlias {
		if alias == "_" {
			importsRequired[path] = true
		}
	}

	for path := range packagesInUse {
		if _, ok := effectiveAlias[path]; ok {
			// no need to resolve the path of a package that has an alias
			continue
		}
		name, err := r.Resolver.ResolvePackage(path)
		if err != nil {
			return fmt.Errorf("could not resolve package %s: %w", path, err)
		}
		resolved[path] = name
	}

	// We sort the required imports so that the order going into the alias conflict detection
	// routine is determinate. Without this, in a conflict, the package that receives the automatic
	// renamed alias would be different every time.
	importsRequiredOrdered := make([]string, len(importsRequired))
	i := 0
	for path := range importsRequired {
		importsRequiredOrdered[i] = path
		i++
	}
	sort.Slice(importsRequiredOrdered, func(i, j int) bool { return packagePathOrderLess(importsRequiredOrdered[i], importsRequiredOrdered[j]) })

	// alias in the imports block (alias, empty string, "_" or "."
	aliases := map[string]string{}

	// name in the code (name or empty string for dot imports). This is consumed later by the
	// restoreIdent method, so is a field on FileRestorer.
	r.packageNames = map[string]string{}

	// conflict returns true if the provided name already exists in the packageNames list
	conflict := func(name string) bool {
		for _, n := range r.packageNames {
			if name == n {
				return true
			}
		}
		return false
	}

	// findAlias finds a unique alias given a path and a preferred alias
	findAlias := func(path, preferred string) (name, alias string) {

		// if we pass in a preferred alias we should always return an alias even when the alias
		// matches the package name. If for some reason the source file has aliased an import with
		// the package name, we shouldn't remove this.
		aliased := preferred != ""

		if !aliased {
			// if there is no preferred alias, we look up the name of the package in the resolved
			// names map.
			preferred = resolved[path]
		}

		// if the current name has a conflict, increment a modifier until a non-conflicting name is
		// found
		modifier := 1
		current := preferred
		for conflict(current) {
			current = fmt.Sprintf("%s%d", preferred, modifier)
			modifier++
		}

		if !aliased && current == resolved[path] {
			// if we didn't supply an alias and the resultant name matches the default package name,
			// return empty string for alias indicating that no alias is required.
			return current, ""
		}

		return current, current
	}

	for _, path := range importsRequiredOrdered {

		alias := effectiveAlias[path]

		if alias == "." || alias == "_" {
			// no conflict checking for dot-imports or anonymous imports
			r.packageNames[path], aliases[path] = "", alias
			continue
		}

		// regular imports have a unique name chosen.
		r.packageNames[path], aliases[path] = findAlias(path, alias)
	}

	// make any additions
	var added bool
	for _, path := range importsRequiredOrdered {

		if _, ok := importsFound[path]; ok {
			continue
		}

		added = true

		// if there's currently no import blocks, we must create one
		if len(blocks) == 0 {
			gd := &dst.GenDecl{
				Tok: token.IMPORT,
				// make sure it has an empty line before and after
				Decs: dst.GenDeclDecorations{
					NodeDecs: dst.NodeDecs{Before: dst.EmptyLine, After: dst.EmptyLine},
				},
			}
			if hasCgoBlock {
				// special case for if we have the "C" import
				r.file.Decls = append([]dst.Decl{r.file.Decls[0], gd}, r.file.Decls[1:]...)
			} else {
				r.file.Decls = append([]dst.Decl{gd}, r.file.Decls...)
			}
			blocks = append(blocks, gd)
		}

		is := &dst.ImportSpec{
			Path: &dst.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("%q", path)},
		}
		if aliases[path] != "" {
			is.Name = &dst.Ident{
				Name: aliases[path],
			}
		}
		blocks[0].Specs = append(blocks[0].Specs, is)
	}

	if added {
		// rearrange import block
		sort.Slice(blocks[0].Specs, func(i, j int) bool {
			return packagePathOrderLess(
				mustUnquote(blocks[0].Specs[i].(*dst.ImportSpec).Path.Value),
				mustUnquote(blocks[0].Specs[j].(*dst.ImportSpec).Path.Value),
			)
		})
	}

	// import blocks that are empty will be removed from the File Decls list later
	deleteBlocks := map[dst.Decl]bool{}

	// update / delete any import specs from all blocks
	for _, block := range blocks {
		specs := make([]dst.Spec, 0, len(block.Specs))
		for _, spec := range block.Specs {
			spec := spec.(*dst.ImportSpec)
			path := mustUnquote(spec.Path.Value)
			if importsRequired[path] {
				if spec.Name == nil && aliases[path] != "" {
					// missing alias
					spec.Name = &dst.Ident{Name: aliases[path]}
				} else if spec.Name != nil && aliases[path] == "" {
					// alias needs to be removed
					spec.Name = nil
				} else if spec.Name != nil && aliases[path] != spec.Name.Name {
					// alias wrong
					spec.Name.Name = aliases[path]
				}
				specs = append(specs, spec)
			}
		}

		count := len(specs)

		if count != len(block.Specs) {

			block.Specs = specs

			if count == 0 {
				deleteBlocks[block] = true
			} else if count == 1 {
				block.Lparen = false
				block.Rparen = false
			} else {
				block.Lparen = true
				block.Rparen = true
			}
		}
	}

	if added {
		// imports with a period in the path are assumed to not be standard library packages, so
		// get a newline separating them from standard library packages. We remove any other
		// newlines found in this block. We do this after the deletions because the first non-stdlib
		// import might be deleted.
		var foundDomainImport bool
		for _, spec := range blocks[0].Specs {
			path := mustUnquote(spec.(*dst.ImportSpec).Path.Value)
			if strings.Contains(path, ".") && !foundDomainImport {
				// first non-std-lib import -> empty line above
				spec.Decorations().Before = dst.EmptyLine
				spec.Decorations().After = dst.NewLine
				foundDomainImport = true
				continue
			}
			// all other specs, just newlines
			spec.Decorations().Before = dst.NewLine
			spec.Decorations().After = dst.NewLine
		}

		if len(blocks[0].Specs) == 1 {
			blocks[0].Lparen = false
			blocks[0].Rparen = false
		} else {
			blocks[0].Lparen = true
			blocks[0].Rparen = true
		}
	}

	// finally remove any deleted blocks from the File Decls list
	if len(deleteBlocks) > 0 {
		decls := make([]dst.Decl, 0, len(r.file.Decls))
		for _, decl := range r.file.Decls {
			if deleteBlocks[decl] {
				continue
			}
			decls = append(decls, decl)
		}
		r.file.Decls = decls
	}

	return nil
}

// restoreIdent is a special case for restoring an ident. If the ident has a path and the imported
// package is not a dot-import, we restore the Ident to a *ast.SelectorExpr with the correct name
// in the X field.
func (r *FileRestorer) restoreIdent(n *dst.Ident, parentName, parentField, parentFieldType string, allowDuplicate bool) ast.Node {

	if r.Resolver == nil && n.Path != "" {
		panic("This syntax has been decorated with import management enabled, but the restorer does not have import management enabled. Use NewRestorerWithImports to create a restorer with import management. See the Imports section of the readme for more information.")
	}

	var name string
	if r.Resolver != nil && n.Path != "" {

		if avoid[parentName+"."+parentField] {
			panic(fmt.Sprintf("Path %s set on illegal Ident %s: parentName %s, parentField %s, parentFieldType %s", n.Path, n.Name, parentName, parentField, parentFieldType))
		}

		if n.Path != r.Path {
			name = r.packageNames[n.Path]
		}

		if name == "." {
			name = ""
		}
	}

	if name == "" {
		// continue to run standard Ident restore
		return nil
	}

	// restore to a SelectorExpr
	out := &ast.SelectorExpr{}
	r.Ast.Nodes[n] = out
	r.Dst.Nodes[out] = n
	r.Dst.Nodes[out.Sel] = n
	r.Dst.Nodes[out.X] = n
	r.applySpace(n, "Before", n.Decs.Before)

	// Decoration: Start
	r.applyDecorations(out, "Start", n.Decs.Start, false)

	// Node: X
	out.X = r.restoreNode(dst.NewIdent(name), "SelectorExpr", "X", "Expr", allowDuplicate).(ast.Expr)

	// Token: Period
	r.cursor += token.Pos(len(token.PERIOD.String()))

	// Decoration: X
	r.applyDecorations(out, "X", n.Decs.X, false)

	// Node: Sel
	out.Sel = r.restoreNode(dst.NewIdent(n.Name), "SelectorExpr", "Sel", "Ident", allowDuplicate).(*ast.Ident)

	// Decoration: End
	r.applyDecorations(out, "End", n.Decs.End, true)
	r.applySpace(n, "After", n.Decs.After)

	return out

}

func packagePathOrderLess(pi, pj string) bool {
	// package paths with a . should be ordered after those without
	idot := strings.Contains(pi, ".")
	jdot := strings.Contains(pj, ".")
	if idot != jdot {
		return jdot
	}
	return pi < pj
}

func (r *FileRestorer) fileSize() int {

	// If a comment is at the end of a file, it will extend past the current cursor position...

	// end pos of file
	end := int(r.cursor)

	// check that none of the comments or newlines extend past the file end position. If so, increment.
	for _, cg := range r.comments {
		if int(cg.End()) >= end {
			end = int(cg.End()) + 1
		}
	}
	for _, lineOffset := range r.lines {
		pos := lineOffset + r.base // remember lines are relative to the file base
		if pos >= end {
			end = pos + 1
		}
	}

	return end - r.base
}

func (r *FileRestorer) applyLiteral(text string) {
	isMultiLine := strings.HasPrefix(text, "`") && strings.Contains(text, "\n")
	if !isMultiLine {
		return
	}
	for charIndex, char := range text {
		if char == '\n' {
			lineOffset := int(r.cursor) - r.base + charIndex // remember lines are relative to the file base
			r.lines = append(r.lines, lineOffset)
		}
	}
}

func (r *FileRestorer) hasCommentField(n ast.Node) bool {
	switch n.(type) {
	case *ast.Field, *ast.ValueSpec, *ast.TypeSpec, *ast.ImportSpec:
		return true
	}
	return false
}

func (r *FileRestorer) addCommentField(n ast.Node, slash token.Pos, text string) {
	c := &ast.Comment{Slash: slash, Text: text}
	switch n := n.(type) {
	case *ast.Field:
		if n.Comment == nil {
			n.Comment = &ast.CommentGroup{}
			r.comments = append(r.comments, n.Comment)
		}
		n.Comment.List = append(n.Comment.List, c)
	case *ast.ImportSpec:
		if n.Comment == nil {
			n.Comment = &ast.CommentGroup{}
			r.comments = append(r.comments, n.Comment)
		}
		n.Comment.List = append(n.Comment.List, c)
	case *ast.ValueSpec:
		if n.Comment == nil {
			n.Comment = &ast.CommentGroup{}
			r.comments = append(r.comments, n.Comment)
		}
		n.Comment.List = append(n.Comment.List, c)
	case *ast.TypeSpec:
		if n.Comment == nil {
			n.Comment = &ast.CommentGroup{}
			r.comments = append(r.comments, n.Comment)
		}
		n.Comment.List = append(n.Comment.List, c)
	}
}

func (r *FileRestorer) applyDecorations(node ast.Node, name string, decorations dst.Decorations, end bool) {
	firstLine := true
	_, isNodeFile := node.(*ast.File)
	isPackageComment := isNodeFile && name == "Start"

	for _, d := range decorations {

		isNewline := d == "\n"
		isLineComment := strings.HasPrefix(d, "//")
		isInlineComment := strings.HasPrefix(d, "/*")
		isComment := isLineComment || isInlineComment
		isMultiLineComment := isInlineComment && strings.Contains(d, "\n")

		if end && r.cursorAtNewLine == r.cursor {
			r.cursor++ // indent all comments in "End" decorations
		}

		// for multi-line comments, add a newline for each \n
		if isMultiLineComment {
			for charIndex, char := range d {
				if char == '\n' {
					lineOffset := int(r.cursor) - r.base + charIndex // remember lines are relative to the file base
					r.lines = append(r.lines, lineOffset)
				}
			}
		}

		// if the decoration is a comment, add it and advance the cursor
		if isComment {
			if firstLine && end && r.hasCommentField(node) {
				// for comments on the same line as the end of a node that has a Comment field, we
				// add the comment to the node instead of the file.
				r.addCommentField(node, r.cursor, d)
			} else {
				r.comments = append(r.comments, &ast.CommentGroup{List: []*ast.Comment{{Slash: r.cursor, Text: d}}})
			}
			r.cursor += token.Pos(len(d))
		}

		// for newline decorations and also line-comments, add a newline
		if isLineComment || isNewline {
			lineOffset := int(r.cursor) - r.base // remember lines are relative to the file base
			r.lines = append(r.lines, lineOffset)
			r.cursor++

			r.cursorAtNewLine = r.cursor
		}

		if isNewline || isLineComment {
			firstLine = false
		}
	}
	if isPackageComment {
		// This fixes https://github.com/dave/dst/issues/69
		r.cursor++
	}
}

func (r *FileRestorer) applySpace(node dst.Node, position string, space dst.SpaceType) {
	switch node.(type) {
	case *dst.BadDecl, *dst.BadExpr, *dst.BadStmt:
		if position == "After" {
			// BadXXX are always followed by an empty line
			space = dst.EmptyLine
		}
	}
	var newlines int
	switch space {
	case dst.NewLine:
		newlines = 1
	case dst.EmptyLine:
		newlines = 2
	}
	if r.cursor == r.cursorAtNewLine {
		newlines--
	}
	for i := 0; i < newlines; i++ {

		// Advance the cursor one more byte for all newlines, so we step over any required
		// separator char - e.g. comma. See net-hook test
		r.cursor++

		lineOffset := int(r.cursor) - r.base // remember lines are relative to the file base
		r.lines = append(r.lines, lineOffset)
		r.cursor++
		r.cursorAtNewLine = r.cursor
	}
}

func (r *FileRestorer) restoreObject(o *dst.Object) *ast.Object {
	if !r.Extras {
		return nil
	}
	if o == nil {
		return nil
	}
	if ro, ok := r.Ast.Objects[o]; ok {
		return ro
	}
	/*
		// An Object describes a named language entity such as a package,
		// constant, type, variable, function (incl. methods), or label.
		//
		// The Data fields contains object-specific data:
		//
		//	Kind    Data type         Data value
		//	Pkg     *Scope            package scope
		//	Con     int               iota for the respective declaration
		//
		type Object struct {
			Kind ObjKind
			Name string      // declared name
			Decl interface{} // corresponding Field, XxxSpec, FuncDecl, LabeledStmt, AssignStmt, Scope; or nil
			Data interface{} // object-specific data; or nil
			Type interface{} // placeholder for type information; may be nil
		}
	*/
	out := &ast.Object{}

	r.Ast.Objects[o] = out
	r.Dst.Objects[out] = o

	out.Kind = ast.ObjKind(o.Kind)
	out.Name = o.Name

	switch decl := o.Decl.(type) {
	case *dst.Scope:
		out.Decl = r.restoreScope(decl)
	case dst.Node:
		// Can't use restoreNode here because we aren't at the right cursor position, so we store a link
		// to the Object and Node so we can look the Nodes up in the cache after the file is fully processed.
		r.nodeDecl[out] = decl
	case nil:
	default:
		panic(fmt.Sprintf("o.Decl is %T", o.Decl))
	}

	switch data := o.Data.(type) {
	case int:
		out.Data = data
	case *dst.Scope:
		out.Data = r.restoreScope(data)
	case dst.Node:
		// Can't use restoreNode here because we aren't at the right cursor position, so we store a link
		// to the Object and Node so we can look the Nodes up in the cache after the file is fully processed.
		r.nodeData[out] = data
	case nil:
	default:
		panic(fmt.Sprintf("o.Data is %T", o.Data))
	}

	return out
}

func (r *FileRestorer) restoreScope(s *dst.Scope) *ast.Scope {
	if !r.Extras {
		return nil
	}
	if s == nil {
		return nil
	}
	if rs, ok := r.Ast.Scopes[s]; ok {
		return rs
	}
	/*
		// A Scope maintains the set of named language entities declared
		// in the scope and a link to the immediately surrounding (outer)
		// scope.
		//
		type Scope struct {
			Outer   *Scope
			Objects map[string]*Object
		}
	*/
	out := &ast.Scope{}

	r.Ast.Scopes[s] = out
	r.Dst.Scopes[out] = s

	out.Outer = r.restoreScope(s.Outer)
	out.Objects = map[string]*ast.Object{}
	for k, v := range s.Objects {
		out.Objects[k] = r.restoreObject(v)
	}

	return out
}

func mustUnquote(s string) string {
	out, err := strconv.Unquote(s)
	if err != nil {
		panic(err)
	}
	return out
}
