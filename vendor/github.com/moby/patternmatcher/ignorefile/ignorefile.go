package ignorefile

import (
	"bufio"
	"bytes"
	"io"
	"path/filepath"
	"strings"
)

// ReadAll reads an ignore file from a reader and returns the list of file
// patterns to ignore, applying the following rules:
//
//   - An UTF8 BOM header (if present) is stripped.
//   - Lines starting with "#" are considered comments and are skipped.
//
// For remaining lines:
//
//   - Leading and trailing whitespace is removed from each ignore pattern.
//   - It uses [filepath.Clean] to get the shortest/cleanest path for
//     ignore patterns.
//   - Leading forward-slashes ("/") are removed from ignore patterns,
//     so "/some/path" and "some/path" are considered equivalent.
func ReadAll(reader io.Reader) ([]string, error) {
	if reader == nil {
		return nil, nil
	}

	var excludes []string
	currentLine := 0
	utf8bom := []byte{0xEF, 0xBB, 0xBF}

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		scannedBytes := scanner.Bytes()
		// We trim UTF8 BOM
		if currentLine == 0 {
			scannedBytes = bytes.TrimPrefix(scannedBytes, utf8bom)
		}
		pattern := string(scannedBytes)
		currentLine++
		// Lines starting with # (comments) are ignored before processing
		if strings.HasPrefix(pattern, "#") {
			continue
		}
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		// normalize absolute paths to paths relative to the context
		// (taking care of '!' prefix)
		invert := pattern[0] == '!'
		if invert {
			pattern = strings.TrimSpace(pattern[1:])
		}
		if len(pattern) > 0 {
			pattern = filepath.Clean(pattern)
			pattern = filepath.ToSlash(pattern)
			if len(pattern) > 1 && pattern[0] == '/' {
				pattern = pattern[1:]
			}
		}
		if invert {
			pattern = "!" + pattern
		}

		excludes = append(excludes, pattern)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return excludes, nil
}
