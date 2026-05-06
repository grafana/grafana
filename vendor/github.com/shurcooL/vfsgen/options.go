package vfsgen

import (
	"fmt"
	"strings"
)

// Options for vfsgen code generation.
type Options struct {
	// Filename of the generated Go code output (including extension).
	// If left empty, it defaults to "{{toLower .VariableName}}_vfsdata.go".
	Filename string

	// PackageName is the name of the package in the generated code.
	// If left empty, it defaults to "main".
	PackageName string

	// BuildTags are the optional build tags in the generated code.
	// The build tags syntax is specified by the go tool.
	BuildTags string

	// VariableName is the name of the http.FileSystem variable in the generated code.
	// If left empty, it defaults to "assets".
	VariableName string

	// VariableComment is the comment of the http.FileSystem variable in the generated code.
	// If left empty, it defaults to "{{.VariableName}} statically implements the virtual filesystem provided to vfsgen.".
	VariableComment string
}

// fillMissing sets default values for mandatory options that are left empty.
func (opt *Options) fillMissing() {
	if opt.PackageName == "" {
		opt.PackageName = "main"
	}
	if opt.VariableName == "" {
		opt.VariableName = "assets"
	}
	if opt.Filename == "" {
		opt.Filename = fmt.Sprintf("%s_vfsdata.go", strings.ToLower(opt.VariableName))
	}
	if opt.VariableComment == "" {
		opt.VariableComment = fmt.Sprintf("%s statically implements the virtual filesystem provided to vfsgen.", opt.VariableName)
	}
}
