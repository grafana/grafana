package goose

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
)

// fileSources represents a collection of migration files on the filesystem.
type fileSources struct {
	sqlSources []Source
	goSources  []Source
}

// collectFilesystemSources scans the file system for migration files that have a numeric prefix
// (greater than one) followed by an underscore and a file extension of either .go or .sql. fsys may
// be nil, in which case an empty fileSources is returned.
//
// If strict is true, then any error parsing the numeric component of the filename will result in an
// error. The file is skipped otherwise.
//
// This function DOES NOT parse SQL migrations or merge registered Go migrations. It only collects
// migration sources from the filesystem.
func collectFilesystemSources(
	fsys fs.FS,
	strict bool,
	excludePaths map[string]bool,
	excludeVersions map[int64]bool,
) (*fileSources, error) {
	if fsys == nil {
		return new(fileSources), nil
	}
	sources := new(fileSources)
	versionToBaseLookup := make(map[int64]string) // map[version]filepath.Base(fullpath)
	for _, pattern := range []string{
		"*.sql",
		"*.go",
	} {
		files, err := fs.Glob(fsys, pattern)
		if err != nil {
			return nil, fmt.Errorf("failed to glob pattern %q: %w", pattern, err)
		}
		for _, fullpath := range files {
			base := filepath.Base(fullpath)
			if strings.HasSuffix(base, "_test.go") {
				continue
			}
			if excludePaths[base] {
				// TODO(mf): log this?
				continue
			}
			// If the filename has a valid looking version of the form: NUMBER_.{sql,go}, then use
			// that as the version. Otherwise, ignore it. This allows users to have arbitrary
			// filenames, but still have versioned migrations within the same directory. For
			// example, a user could have a helpers.go file which contains unexported helper
			// functions for migrations.
			version, err := NumericComponent(base)
			if err != nil {
				if strict {
					return nil, fmt.Errorf("failed to parse numeric component from %q: %w", base, err)
				}
				continue
			}
			if excludeVersions[version] {
				// TODO: log this?
				continue
			}
			// Ensure there are no duplicate versions.
			if existing, ok := versionToBaseLookup[version]; ok {
				return nil, fmt.Errorf("found duplicate migration version %d:\n\texisting:%v\n\tcurrent:%v",
					version,
					existing,
					base,
				)
			}
			switch filepath.Ext(base) {
			case ".sql":
				sources.sqlSources = append(sources.sqlSources, Source{
					Type:    TypeSQL,
					Path:    fullpath,
					Version: version,
				})
			case ".go":
				sources.goSources = append(sources.goSources, Source{
					Type:    TypeGo,
					Path:    fullpath,
					Version: version,
				})
			default:
				// Should never happen since we already filtered out all other file types.
				return nil, fmt.Errorf("invalid file extension: %q", base)
			}
			// Add the version to the lookup map.
			versionToBaseLookup[version] = base
		}
	}
	return sources, nil
}

func newSQLMigration(source Source) *Migration {
	return &Migration{
		Type:      source.Type,
		Version:   source.Version,
		Source:    source.Path,
		construct: true,
		Next:      -1, Previous: -1,
		sql: sqlMigration{
			Parsed: false, // SQL migrations are parsed lazily.
		},
	}
}

func merge(sources *fileSources, registered map[int64]*Migration) ([]*Migration, error) {
	var migrations []*Migration
	migrationLookup := make(map[int64]*Migration)
	// Add all SQL migrations to the list of migrations.
	for _, source := range sources.sqlSources {
		m := newSQLMigration(source)
		migrations = append(migrations, m)
		migrationLookup[source.Version] = m
	}
	// If there are no Go files in the filesystem and no registered Go migrations, return early.
	if len(sources.goSources) == 0 && len(registered) == 0 {
		return migrations, nil
	}
	// Return an error if the given sources contain a versioned Go migration that has not been
	// registered. This is a sanity check to ensure users didn't accidentally create a valid looking
	// Go migration file on disk and forget to register it.
	//
	// This is almost always a user error.
	var unregistered []string
	for _, s := range sources.goSources {
		m, ok := registered[s.Version]
		if !ok {
			unregistered = append(unregistered, s.Path)
		} else {
			// Populate the source path for registered Go migrations that have a corresponding file
			// on disk.
			m.Source = s.Path
		}
	}
	if len(unregistered) > 0 {
		return nil, unregisteredError(unregistered)
	}
	// Add all registered Go migrations to the list of migrations, checking for duplicate versions.
	//
	// Important, users can register Go migrations manually via goose.Add_ functions. These
	// migrations may not have a corresponding file on disk. Which is fine! We include them
	// wholesale as part of migrations. This allows users to build a custom binary that only embeds
	// the SQL migration files.
	for version, r := range registered {
		// Ensure there are no duplicate versions.
		if existing, ok := migrationLookup[version]; ok {
			fullpath := r.Source
			if fullpath == "" {
				fullpath = "no source path"
			}
			return nil, fmt.Errorf("found duplicate migration version %d:\n\texisting:%v\n\tcurrent:%v",
				version,
				existing.Source,
				fullpath,
			)
		}
		migrations = append(migrations, r)
		migrationLookup[version] = r
	}
	// Sort migrations by version in ascending order.
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})
	return migrations, nil
}

func unregisteredError(unregistered []string) error {
	const (
		hintURL = "https://github.com/pressly/goose/tree/master/examples/go-migrations"
	)
	f := "file"
	if len(unregistered) > 1 {
		f += "s"
	}
	var b strings.Builder

	b.WriteString(fmt.Sprintf("error: detected %d unregistered Go %s:\n", len(unregistered), f))
	for _, name := range unregistered {
		b.WriteString("\t" + name + "\n")
	}
	hint := fmt.Sprintf("hint: go functions must be registered and built into a custom binary see:\n%s", hintURL)
	b.WriteString(hint)
	b.WriteString("\n")

	return errors.New(b.String())
}
