package tsdb

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/tsdb/fileutil"
)

// repairBadIndexVersion repairs an issue in index and meta.json persistence introduced in
// commit 129773b41a565fde5156301e37f9a87158030443.
func repairBadIndexVersion(logger log.Logger, dir string) error {
	// All blocks written by Prometheus 2.1 with a meta.json version of 2 are affected.
	// We must actually set the index file version to 2 and revert the meta.json version back to 1.
	dirs, err := blockDirs(dir)
	if err != nil {
		return errors.Wrapf(err, "list block dirs in %q", dir)
	}

	wrapErr := func(err error, d string) error {
		return errors.Wrapf(err, "block dir: %q", d)
	}
	for _, d := range dirs {
		meta, err := readBogusMetaFile(d)
		if err != nil {
			return wrapErr(err, d)
		}
		if meta.Version == 1 {
			level.Info(logger).Log(
				"msg", "found healthy block",
				"mint", meta.MinTime,
				"maxt", meta.MaxTime,
				"ulid", meta.ULID,
			)
			continue
		}
		level.Info(logger).Log(
			"msg", "fixing broken block",
			"mint", meta.MinTime,
			"maxt", meta.MaxTime,
			"ulid", meta.ULID,
		)

		repl, err := os.Create(filepath.Join(d, "index.repaired"))
		if err != nil {
			return wrapErr(err, d)
		}
		broken, err := os.Open(filepath.Join(d, "index"))
		if err != nil {
			return wrapErr(err, d)
		}
		if _, err := io.Copy(repl, broken); err != nil {
			return wrapErr(err, d)
		}
		// Set the 5th byte to 2 to indiciate the correct file format version.
		if _, err := repl.WriteAt([]byte{2}, 4); err != nil {
			return wrapErr(err, d)
		}
		if err := fileutil.Fsync(repl); err != nil {
			return wrapErr(err, d)
		}
		if err := repl.Close(); err != nil {
			return wrapErr(err, d)
		}
		if err := broken.Close(); err != nil {
			return wrapErr(err, d)
		}
		if err := renameFile(repl.Name(), broken.Name()); err != nil {
			return wrapErr(err, d)
		}
		// Reset version of meta.json to 1.
		meta.Version = 1
		if err := writeMetaFile(d, meta); err != nil {
			return wrapErr(err, d)
		}
	}
	return nil
}

func readBogusMetaFile(dir string) (*BlockMeta, error) {
	b, err := ioutil.ReadFile(filepath.Join(dir, metaFilename))
	if err != nil {
		return nil, err
	}
	var m BlockMeta

	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	if m.Version != 1 && m.Version != 2 {
		return nil, errors.Errorf("unexpected meta file version %d", m.Version)
	}
	return &m, nil
}
