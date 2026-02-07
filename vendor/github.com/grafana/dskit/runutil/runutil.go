// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/runutil/runutil.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package runutil

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"

	"github.com/grafana/dskit/multierror"
)

// CloseWithErrCapture closes closer and wraps any error with the provided message and assigns it to err.
func CloseWithErrCapture(err *error, closer io.Closer, format string, a ...interface{}) {
	merr := multierror.MultiError{}

	merr.Add(*err)
	merr.Add(errors.Wrapf(closer.Close(), format, a...))

	*err = merr.Err()
}

// CloseWithLogOnErr closes an io.Closer and logs any relevant error from it wrapped with the provided format string and
// args.
func CloseWithLogOnErr(logger log.Logger, closer io.Closer, format string, args ...interface{}) {
	err := closer.Close()
	if err == nil || errors.Is(err, os.ErrClosed) {
		return
	}

	msg := fmt.Sprintf(format, args...)
	level.Warn(logger).Log("msg", "detected close error", "err", fmt.Sprintf("%s: %s", msg, err.Error()))
}

// ExhaustCloseWithErrCapture closes the io.ReadCloser with error capture but exhausts the reader before.
func ExhaustCloseWithErrCapture(err *error, r io.ReadCloser, format string, a ...interface{}) {
	_, copyErr := io.Copy(io.Discard, r)

	CloseWithErrCapture(err, r, format, a...)

	// Prepend the io.Copy error.
	merr := multierror.MultiError{}
	merr.Add(copyErr)
	merr.Add(*err)

	*err = merr.Err()
}

// DeleteAll deletes all files and directories inside the given
// dir except for the ignoreDirs directories.
// NOTE: DeleteAll is not idempotent.
func DeleteAll(dir string, ignoreDirs ...string) error {
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return errors.Wrap(err, "read dir")
	}
	var groupErrs multierror.MultiError

	var matchingIgnores []string
	for _, d := range entries {
		if !d.IsDir() {
			if err := os.RemoveAll(filepath.Join(dir, d.Name())); err != nil {
				groupErrs.Add(err)
			}
			continue
		}

		// ignoreDirs might be multi-directory paths.
		matchingIgnores = matchingIgnores[:0]
		ignore := false
		for _, ignoreDir := range ignoreDirs {
			id := strings.Split(ignoreDir, "/")
			if id[0] == d.Name() {
				if len(id) == 1 {
					ignore = true
					break
				}
				matchingIgnores = append(matchingIgnores, filepath.Join(id[1:]...))
			}
		}

		if ignore {
			continue
		}

		if len(matchingIgnores) == 0 {
			if err := os.RemoveAll(filepath.Join(dir, d.Name())); err != nil {
				groupErrs.Add(err)
			}
			continue
		}
		if err := DeleteAll(filepath.Join(dir, d.Name()), matchingIgnores...); err != nil {
			groupErrs.Add(err)
		}
	}

	if groupErrs.Err() != nil {
		return errors.Wrap(groupErrs.Err(), "delete file/dir")
	}
	return nil
}
