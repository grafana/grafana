// Copyright 2020 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const (
	rapidVersion = "v0.4.8"

	persistDirMode     = 0775
	failfileTmpPattern = ".rapid-failfile-tmp-*"
)

var (
	// https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
	windowsReservedNames = []string{
		"CON", "PRN", "AUX", "NUL",
		"COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "COM¹", "COM²", "COM³",
		"LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9", "LPT¹", "LPT²", "LPT³",
	}
)

func kindaSafeFilename(f string) string {
	var s strings.Builder
	for _, r := range f {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' {
			s.WriteRune(r)
		} else {
			s.WriteRune('_')
		}
	}
	name := s.String()
	nameUpper := strings.ToUpper(name)
	for _, reserved := range windowsReservedNames {
		if nameUpper == reserved {
			return name + "_"
		}
	}
	return name
}

func failFileName(testName string) (string, string) {
	ts := time.Now().Format("20060102150405")
	fileName := fmt.Sprintf("%s-%s-%d.fail", kindaSafeFilename(testName), ts, os.Getpid())
	dirName := filepath.Join("testdata", "rapid", kindaSafeFilename(testName))
	return dirName, filepath.Join(dirName, fileName)
}

func failFilePattern(testName string) string {
	fileName := fmt.Sprintf("%s-*.fail", kindaSafeFilename(testName))
	dirName := filepath.Join("testdata", "rapid", kindaSafeFilename(testName))
	return filepath.Join(dirName, fileName)
}

func saveFailFile(filename string, version string, output []byte, seed uint64, buf []uint64) error {
	dir := filepath.Dir(filename)
	err := os.MkdirAll(dir, persistDirMode)
	if err != nil {
		return fmt.Errorf("failed to create directory for fail file %q: %w", filename, err)
	}

	f, err := os.CreateTemp(dir, failfileTmpPattern)
	if err != nil {
		return fmt.Errorf("failed to create temporary file for fail file %q: %w", filename, err)
	}
	defer func() { _ = os.Remove(f.Name()) }()
	defer func() { _ = f.Close() }()

	out := strings.Split(string(output), "\n")
	for _, s := range out {
		_, err := f.WriteString("# " + s + "\n")
		if err != nil {
			return fmt.Errorf("failed to write data to fail file %q: %w", filename, err)
		}
	}

	bs := []string{fmt.Sprintf("%v#%v", version, seed)}
	for _, u := range buf {
		bs = append(bs, fmt.Sprintf("0x%x", u))
	}

	_, err = f.WriteString(strings.Join(bs, "\n"))
	if err != nil {
		return fmt.Errorf("failed to write data to fail file %q: %w", filename, err)
	}

	_ = f.Close() // early close, otherwise os.Rename will fail on Windows
	err = os.Rename(f.Name(), filename)
	if err != nil {
		return fmt.Errorf("failed to save fail file %q: %w", filename, err)
	}

	return nil
}

func loadFailFile(filename string) (string, uint64, []uint64, error) {
	f, err := os.Open(filename)
	if err != nil {
		return "", 0, nil, fmt.Errorf("failed to open fail file: %w", err)
	}
	defer func() { _ = f.Close() }()

	var data []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		s := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(s, "#") || s == "" {
			continue
		}
		data = append(data, s)
	}
	if err := scanner.Err(); err != nil {
		return "", 0, nil, fmt.Errorf("failed to load fail file %q: %w", filename, err)
	}

	if len(data) == 0 {
		return "", 0, nil, fmt.Errorf("no data in fail file %q", filename)
	}

	split := strings.Split(data[0], "#")
	if len(split) != 2 {
		return "", 0, nil, fmt.Errorf("invalid version/seed field %q in %q", data[0], filename)
	}
	seed, err := strconv.ParseUint(split[1], 10, 64)
	if err != nil {
		return "", 0, nil, fmt.Errorf("invalid seed %q in %q", split[1], filename)
	}

	var buf []uint64
	for _, b := range data[1:] {
		u, err := strconv.ParseUint(b, 0, 64)
		if err != nil {
			return "", 0, nil, fmt.Errorf("failed to load fail file %q: %w", filename, err)
		}
		buf = append(buf, u)
	}

	return split[0], seed, buf, nil
}
