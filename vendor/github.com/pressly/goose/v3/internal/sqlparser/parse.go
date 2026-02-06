package sqlparser

import (
	"fmt"
	"io/fs"

	"go.uber.org/multierr"
	"golang.org/x/sync/errgroup"
)

type ParsedSQL struct {
	UseTx    bool
	Up, Down []string
}

func ParseAllFromFS(fsys fs.FS, filename string, debug bool) (*ParsedSQL, error) {
	parsedSQL := new(ParsedSQL)
	// TODO(mf): parse is called twice, once for up and once for down. This is inefficient. It
	// should be possible to parse both directions in one pass. Also, UseTx is set once (but
	// returned twice), which is unnecessary and potentially error-prone if the two calls to
	// parseSQL disagree based on direction.
	var g errgroup.Group
	g.Go(func() error {
		up, useTx, err := parse(fsys, filename, DirectionUp, debug)
		if err != nil {
			return err
		}
		parsedSQL.Up = up
		parsedSQL.UseTx = useTx
		return nil
	})
	g.Go(func() error {
		down, _, err := parse(fsys, filename, DirectionDown, debug)
		if err != nil {
			return err
		}
		parsedSQL.Down = down
		return nil
	})
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return parsedSQL, nil
}

func parse(fsys fs.FS, filename string, direction Direction, debug bool) (_ []string, _ bool, retErr error) {
	r, err := fsys.Open(filename)
	if err != nil {
		return nil, false, err
	}
	defer func() {
		retErr = multierr.Append(retErr, r.Close())
	}()
	stmts, useTx, err := ParseSQLMigration(r, direction, debug)
	if err != nil {
		return nil, false, fmt.Errorf("failed to parse %s: %w", filename, err)
	}
	return stmts, useTx, nil
}
