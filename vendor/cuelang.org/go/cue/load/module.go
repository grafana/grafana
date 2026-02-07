package load

import (
	_ "embed"
	"io"

	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/runtime"
)

//go:embed moduleschema.cue
var moduleSchema []byte

type modFile struct {
	Module string `json:"module"`
}

// loadModule loads the module file, resolves and downloads module
// dependencies. It sets c.Module if it's empty or checks it for
// consistency with the module file otherwise.
func (c *Config) loadModule() error {
	// TODO: also make this work if run from outside the module?
	mod := filepath.Join(c.ModuleRoot, modDir)
	info, cerr := c.fileSystem.stat(mod)
	if cerr != nil {
		return nil
	}
	// TODO remove support for legacy non-directory module.cue file
	// by returning an error if info.IsDir is false.
	if info.IsDir() {
		mod = filepath.Join(mod, moduleFile)
	}
	f, cerr := c.fileSystem.openFile(mod)
	if cerr != nil {
		return nil
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return err
	}

	// TODO: move to full build again
	file, err := parser.ParseFile(mod, data)
	if err != nil {
		return errors.Wrapf(err, token.NoPos, "invalid module.cue file")
	}
	// TODO disallow non-data-mode CUE.

	ctx := (*cue.Context)(runtime.New())
	schemav := ctx.CompileBytes(moduleSchema, cue.Filename("$cueroot/cue/load/moduleschema.cue"))
	if err := schemav.Validate(); err != nil {
		return errors.Wrapf(err, token.NoPos, "internal error: invalid CUE module.cue schema")
	}
	v := ctx.BuildFile(file)
	if err := v.Validate(cue.Concrete(true)); err != nil {
		return errors.Wrapf(err, token.NoPos, "invalid module.cue file")
	}
	v = v.Unify(schemav)
	if err := v.Validate(); err != nil {
		return errors.Wrapf(err, token.NoPos, "invalid module.cue file")
	}
	var mf modFile
	if err := v.Decode(&mf); err != nil {
		return errors.Wrapf(err, token.NoPos, "internal error: cannot decode into modFile struct (\nfile %q\ncontents %q\nvalue %#v\n)", mod, data, v)
	}
	if mf.Module == "" {
		// Backward compatibility: allow empty module.cue file.
		// TODO maybe check that the rest of the fields are empty too?
		return nil
	}
	if c.Module != "" && c.Module != mf.Module {
		return errors.Newf(token.NoPos, "inconsistent modules: got %q, want %q", mf.Module, c.Module)
	}
	c.Module = mf.Module
	c.modFile = &mf
	return nil
}
