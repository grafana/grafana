package cty

import (
	"fmt"
)

// PathError is a specialization of error that represents where in a
// potentially-deep data structure an error occured, using a Path.
type PathError struct {
	error
	Path Path
}

func errorf(path Path, f string, args ...interface{}) error {
	// We need to copy the Path because often our caller builds it by
	// continually mutating the same underlying buffer.
	sPath := make(Path, len(path))
	copy(sPath, path)
	return PathError{
		error: fmt.Errorf(f, args...),
		Path:  sPath,
	}
}

// NewErrorf creates a new PathError for the current path by passing the
// given format and arguments to fmt.Errorf and then wrapping the result
// similarly to NewError.
func (p Path) NewErrorf(f string, args ...interface{}) error {
	return errorf(p, f, args...)
}

// NewError creates a new PathError for the current path, wrapping the given
// error.
func (p Path) NewError(err error) error {
	// if we're being asked to wrap an existing PathError then our new
	// PathError will be the concatenation of the two paths, ensuring
	// that we still get a single flat PathError that's thus easier for
	// callers to deal with.
	perr, wrappingPath := err.(PathError)
	pathLen := len(p)
	if wrappingPath {
		pathLen = pathLen + len(perr.Path)
	}

	sPath := make(Path, pathLen)
	copy(sPath, p)
	if wrappingPath {
		copy(sPath[len(p):], perr.Path)
	}

	return PathError{
		error: err,
		Path:  sPath,
	}
}
