//go:build codegen
// +build codegen

package ptr

import "strings"

func GetScalars() Scalars {
	return Scalars{
		{Type: "bool"},
		{Type: "byte"},
		{Type: "string"},
		{Type: "int"},
		{Type: "int8"},
		{Type: "int16"},
		{Type: "int32"},
		{Type: "int64"},
		{Type: "uint"},
		{Type: "uint8"},
		{Type: "uint16"},
		{Type: "uint32"},
		{Type: "uint64"},
		{Type: "float32"},
		{Type: "float64"},
		{Type: "Time", Import: &Import{Path: "time"}},
		{Type: "Duration", Import: &Import{Path: "time"}},
	}
}

// Import provides the import path and optional alias
type Import struct {
	Path  string
	Alias string
}

// Package returns the Go package name for the import. Returns alias if set.
func (i Import) Package() string {
	if v := i.Alias; len(v) != 0 {
		return v
	}

	if v := i.Path; len(v) != 0 {
		parts := strings.Split(v, "/")
		pkg := parts[len(parts)-1]
		return pkg
	}

	return ""
}

// Scalar provides the definition of a type to generate pointer utilities for.
type Scalar struct {
	Type   string
	Import *Import
}

// Name returns the exported function name for the type.
func (t Scalar) Name() string {
	return strings.Title(t.Type)
}

// Symbol returns the scalar's Go symbol with path if needed.
func (t Scalar) Symbol() string {
	if t.Import != nil {
		return t.Import.Package() + "." + t.Type
	}
	return t.Type
}

// Scalars is a list of scalars.
type Scalars []Scalar

// Imports returns all imports for the scalars.
func (ts Scalars) Imports() []*Import {
	imports := []*Import{}
	for _, t := range ts {
		if v := t.Import; v != nil {
			imports = append(imports, v)
		}
	}

	return imports
}
