// Package locafero looks for files and directories in an {fs.Fs} filesystem.
package locafero

import (
	"errors"
	"io/fs"
	"path/filepath"
	"strings"

	"github.com/sourcegraph/conc/iter"
	"github.com/spf13/afero"
)

// Finder looks for files and directories in an [afero.Fs] filesystem.
type Finder struct {
	// Paths represents a list of locations that the [Finder] will search in.
	//
	// They are essentially the root directories or starting points for the search.
	//
	// Examples:
	//   - home/user
	//   - etc
	Paths []string

	// Names are specific entries that the [Finder] will look for within the given Paths.
	//
	// It provides the capability to search for entries with depth,
	// meaning it can target deeper locations within the directory structure.
	//
	// It also supports glob syntax (as defined by [filepath.Match]), offering greater flexibility in search patterns.
	//
	// Examples:
	//   - config.yaml
	//   - home/*/config.yaml
	//   - home/*/config.*
	Names []string

	// Type restricts the kind of entries returned by the [Finder].
	//
	// This parameter helps in differentiating and filtering out files from directories or vice versa.
	Type FileType
}

// Find looks for files and directories in an [afero.Fs] filesystem.
func (f Finder) Find(fsys afero.Fs) ([]string, error) {
	// Arbitrary go routine limit (TODO: make this a parameter)
	// pool := pool.NewWithResults[[]string]().WithMaxGoroutines(5).WithErrors().WithFirstError()

	type searchItem struct {
		path string
		name string
	}

	var searchItems []searchItem

	for _, searchPath := range f.Paths {
		searchPath := searchPath

		for _, searchName := range f.Names {
			searchName := searchName

			searchItems = append(searchItems, searchItem{searchPath, searchName})

			// pool.Go(func() ([]string, error) {
			// 	// If the name contains any glob character, perform a glob match
			// 	if strings.ContainsAny(searchName, globMatch) {
			// 		return globWalkSearch(fsys, searchPath, searchName, f.Type)
			// 	}
			//
			// 	return statSearch(fsys, searchPath, searchName, f.Type)
			// })
		}
	}

	// allResults, err := pool.Wait()
	// if err != nil {
	// 	return nil, err
	// }

	allResults, err := iter.MapErr(searchItems, func(item *searchItem) ([]string, error) {
		// If the name contains any glob character, perform a glob match
		if strings.ContainsAny(item.name, globMatch) {
			return globWalkSearch(fsys, item.path, item.name, f.Type)
		}

		return statSearch(fsys, item.path, item.name, f.Type)
	})
	if err != nil {
		return nil, err
	}

	var results []string

	for _, r := range allResults {
		results = append(results, r...)
	}

	// Sort results in alphabetical order for now
	// sort.Strings(results)

	return results, nil
}

func globWalkSearch(
	fsys afero.Fs,
	searchPath string,
	searchName string,
	searchType FileType,
) ([]string, error) {
	var results []string

	err := afero.Walk(fsys, searchPath, func(p string, fileInfo fs.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip the root path
		if p == searchPath {
			return nil
		}

		var result error

		// Stop reading subdirectories
		// TODO: add depth detection here
		if fileInfo.IsDir() && filepath.Dir(p) == searchPath {
			result = fs.SkipDir
		}

		// Skip unmatching type
		if !searchType.matchFileInfo(fileInfo) {
			return result
		}

		match, err := filepath.Match(searchName, fileInfo.Name())
		if err != nil {
			return err
		}

		if match {
			results = append(results, p)
		}

		return result
	})
	if err != nil {
		return results, err
	}

	return results, nil
}

func statSearch(
	fsys afero.Fs,
	searchPath string,
	searchName string,
	searchType FileType,
) ([]string, error) {
	filePath := filepath.Join(searchPath, searchName)

	fileInfo, err := fsys.Stat(filePath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Skip unmatching type
	if !searchType.matchFileInfo(fileInfo) {
		return nil, nil
	}

	return []string{filePath}, nil
}
