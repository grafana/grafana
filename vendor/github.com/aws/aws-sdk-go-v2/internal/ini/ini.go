// Package ini implements parsing of the AWS shared config file.
//
//	Example:
//	sections, err := ini.OpenFile("/path/to/file")
//	if err != nil {
//		panic(err)
//	}
//
//	profile := "foo"
//	section, ok := sections.GetSection(profile)
//	if !ok {
//		fmt.Printf("section %q could not be found", profile)
//	}
package ini

import (
	"fmt"
	"io"
	"os"
	"strings"
)

// OpenFile parses shared config from the given file path.
func OpenFile(path string) (sections Sections, err error) {
	f, oerr := os.Open(path)
	if oerr != nil {
		return Sections{}, &UnableToReadFile{Err: oerr}
	}

	defer func() {
		closeErr := f.Close()
		if err == nil {
			err = closeErr
		} else if closeErr != nil {
			err = fmt.Errorf("close error: %v, original error: %w", closeErr, err)
		}
	}()

	return Parse(f, path)
}

// Parse parses shared config from the given reader.
func Parse(r io.Reader, path string) (Sections, error) {
	contents, err := io.ReadAll(r)
	if err != nil {
		return Sections{}, fmt.Errorf("read all: %v", err)
	}

	lines := strings.Split(string(contents), "\n")
	tokens, err := tokenize(lines)
	if err != nil {
		return Sections{}, fmt.Errorf("tokenize: %v", err)
	}

	return parse(tokens, path), nil
}
