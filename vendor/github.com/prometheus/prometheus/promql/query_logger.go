// Copyright 2019 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package promql

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/edsrzf/mmap-go"
)

type ActiveQueryTracker struct {
	mmappedFile   []byte
	getNextIndex  chan int
	logger        *slog.Logger
	closer        io.Closer
	maxConcurrent int
}

var _ io.Closer = &ActiveQueryTracker{}

type Entry struct {
	Query     string `json:"query"`
	Timestamp int64  `json:"timestamp_sec"`
}

const (
	entrySize int = 1000
)

func parseBrokenJSON(brokenJSON []byte) (string, bool) {
	queries := strings.ReplaceAll(string(brokenJSON), "\x00", "")
	if len(queries) > 0 {
		queries = queries[:len(queries)-1] + "]"
	}

	// Conditional because of implementation detail: len() = 1 implies file consisted of a single char: '['.
	if len(queries) <= 1 {
		return "[]", false
	}

	return queries, true
}

func logUnfinishedQueries(filename string, filesize int, logger *slog.Logger) {
	if _, err := os.Stat(filename); err == nil {
		fd, err := os.Open(filename)
		if err != nil {
			logger.Error("Failed to open query log file", "err", err)
			return
		}
		defer fd.Close()

		brokenJSON := make([]byte, filesize)
		_, err = fd.Read(brokenJSON)
		if err != nil {
			logger.Error("Failed to read query log file", "err", err)
			return
		}

		queries, queriesExist := parseBrokenJSON(brokenJSON)
		if !queriesExist {
			return
		}
		logger.Info("These queries didn't finish in prometheus' last run:", "queries", queries)
	}
}

type mmappedFile struct {
	f io.Closer
	m mmap.MMap
}

func (f *mmappedFile) Close() error {
	err := f.m.Unmap()
	if err != nil {
		err = fmt.Errorf("mmappedFile: unmapping: %w", err)
	}
	if fErr := f.f.Close(); fErr != nil {
		return errors.Join(fmt.Errorf("close mmappedFile.f: %w", fErr), err)
	}

	return err
}

func getMMappedFile(filename string, filesize int, logger *slog.Logger) ([]byte, io.Closer, error) {
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0o666)
	if err != nil {
		absPath, pathErr := filepath.Abs(filename)
		if pathErr != nil {
			absPath = filename
		}
		logger.Error("Error opening query log file", "file", absPath, "err", err)
		return nil, nil, err
	}

	err = file.Truncate(int64(filesize))
	if err != nil {
		file.Close()
		logger.Error("Error setting filesize.", "filesize", filesize, "err", err)
		return nil, nil, err
	}

	fileAsBytes, err := mmap.Map(file, mmap.RDWR, 0)
	if err != nil {
		file.Close()
		logger.Error("Failed to mmap", "file", filename, "Attempted size", filesize, "err", err)
		return nil, nil, err
	}

	return fileAsBytes, &mmappedFile{f: file, m: fileAsBytes}, err
}

func NewActiveQueryTracker(localStoragePath string, maxConcurrent int, logger *slog.Logger) *ActiveQueryTracker {
	err := os.MkdirAll(localStoragePath, 0o777)
	if err != nil {
		logger.Error("Failed to create directory for logging active queries")
	}

	filename, filesize := filepath.Join(localStoragePath, "queries.active"), 1+maxConcurrent*entrySize
	logUnfinishedQueries(filename, filesize, logger)

	fileAsBytes, closer, err := getMMappedFile(filename, filesize, logger)
	if err != nil {
		panic("Unable to create mmap-ed active query log")
	}

	copy(fileAsBytes, "[")
	activeQueryTracker := ActiveQueryTracker{
		mmappedFile:   fileAsBytes,
		closer:        closer,
		getNextIndex:  make(chan int, maxConcurrent),
		logger:        logger,
		maxConcurrent: maxConcurrent,
	}

	activeQueryTracker.generateIndices(maxConcurrent)

	return &activeQueryTracker
}

func trimStringByBytes(str string, size int) string {
	bytesStr := []byte(str)

	trimIndex := len(bytesStr)
	if size < len(bytesStr) {
		for !utf8.RuneStart(bytesStr[size]) {
			size--
		}
		trimIndex = size
	}

	return string(bytesStr[:trimIndex])
}

func _newJSONEntry(query string, timestamp int64, logger *slog.Logger) []byte {
	entry := Entry{query, timestamp}
	jsonEntry, err := json.Marshal(entry)
	if err != nil {
		logger.Error("Cannot create json of query", "query", query)
		return []byte{}
	}

	return jsonEntry
}

func newJSONEntry(query string, logger *slog.Logger) []byte {
	timestamp := time.Now().Unix()
	minEntryJSON := _newJSONEntry("", timestamp, logger)

	query = trimStringByBytes(query, entrySize-(len(minEntryJSON)+1))
	jsonEntry := _newJSONEntry(query, timestamp, logger)

	return jsonEntry
}

func (tracker ActiveQueryTracker) generateIndices(maxConcurrent int) {
	for i := 0; i < maxConcurrent; i++ {
		tracker.getNextIndex <- 1 + (i * entrySize)
	}
}

func (tracker ActiveQueryTracker) GetMaxConcurrent() int {
	return tracker.maxConcurrent
}

func (tracker ActiveQueryTracker) Delete(insertIndex int) {
	copy(tracker.mmappedFile[insertIndex:], strings.Repeat("\x00", entrySize))
	tracker.getNextIndex <- insertIndex
}

func (tracker ActiveQueryTracker) Insert(ctx context.Context, query string) (int, error) {
	select {
	case i := <-tracker.getNextIndex:
		fileBytes := tracker.mmappedFile
		entry := newJSONEntry(query, tracker.logger)
		start, end := i, i+entrySize

		copy(fileBytes[start:], entry)
		copy(fileBytes[end-1:], ",")
		return i, nil
	case <-ctx.Done():
		return 0, ctx.Err()
	}
}

// Close closes tracker.
func (tracker *ActiveQueryTracker) Close() error {
	if tracker == nil || tracker.closer == nil {
		return nil
	}
	if err := tracker.closer.Close(); err != nil {
		return fmt.Errorf("close ActiveQueryTracker.closer: %w", err)
	}
	return nil
}
