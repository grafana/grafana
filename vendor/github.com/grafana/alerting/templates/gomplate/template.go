/*
 * This file evolved from the MIT licensed: https://github.com/hairyhenderson/gomplate
 */

/*
The MIT License (MIT)

# Copyright (c) 2016-2023 Dave Henderson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
package gomplate

import (
	"bytes"
	"fmt"
	tmpltext "text/template"
)

func CreateTemplateFuncs(root *tmpltext.Template) Namespace {
	return Namespace{"tmpl", &TmplFuncs{root}}
}

// Template Functions.
type TmplFuncs struct {
	root *tmpltext.Template
}

// Inline - a template function to do inline template processing.
// A simplified copy of the same function in the gomplate.
//
// Can be called 2 ways:
// {{ tmpl.Inline "name" "inline template" }} - named template with default context
// {{ tmpl.Inline "inline template" $foo }} - unnamed (single-use) template with given context
func (t *TmplFuncs) Inline(args ...any) (string, error) {
	name, in, ctx, err := parseArgs(args...)
	if err != nil {
		return "", err
	}
	return t.inline(name, in, ctx)
}

func (t *TmplFuncs) inline(name, in string, ctx interface{}) (string, error) {
	tmpl, err := t.root.New(name).Parse(in)
	if err != nil {
		return "", err
	}
	return render(tmpl, ctx)
}

func (t *TmplFuncs) Exec(name string, tmplcontext ...any) (string, error) {
	var ctx any
	if len(tmplcontext) == 1 {
		ctx = tmplcontext[0]
	}
	tmpl := t.root.Lookup(name)
	if tmpl == nil {
		return "", fmt.Errorf(`template "%s" not defined`, name)
	}
	return render(tmpl, ctx)
}

func render(tmpl *tmpltext.Template, ctx interface{}) (string, error) {
	out := &bytes.Buffer{}
	err := tmpl.Execute(out, ctx)
	if err != nil {
		return "", err
	}
	return out.String(), nil
}

// parseArgs is a simplified copy of the same function in the gomplate.
func parseArgs(args ...interface{}) (name, in string, ctx interface{}, err error) {
	name = "<inline>"

	if len(args) != 2 {
		return "", "", nil, fmt.Errorf("wrong number of args for tpl: want 2 - got %d", len(args))
	}
	first, ok := args[0].(string)
	if !ok {
		return "", "", nil, fmt.Errorf("wrong input: first arg must be string, got %T", args[0])
	}

	// this can either be (name string, in string) or (in string, ctx interface{})
	switch second := args[1].(type) {
	case string:
		name = first
		in = second
	default:
		in = first
		ctx = second
	}

	return name, in, ctx, nil
}
