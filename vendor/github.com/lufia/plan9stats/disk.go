package stats

import (
	"bufio"
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
)

// Storage represents /dev/sdXX/ctl.
type Storage struct {
	Name       string
	Model      string
	Capacity   int64
	Partitions []*Partition
}

// Partition represents a part of /dev/sdXX/ctl.
type Partition struct {
	Name  string
	Start uint64
	End   uint64
}

func ReadStorages(ctx context.Context, opts ...Option) ([]*Storage, error) {
	cfg := newConfig(opts...)
	sdctl := filepath.Join(cfg.rootdir, "/dev/sdctl")
	f, err := os.Open(sdctl)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var a []*Storage
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := bytes.Split(scanner.Bytes(), delim)
		if len(fields) == 0 {
			continue
		}
		exp := string(fields[0]) + "*"
		if !strings.HasPrefix(exp, "sd") {
			continue
		}
		dir := filepath.Join(cfg.rootdir, "/dev", exp)
		m, err := filepath.Glob(dir)
		if err != nil {
			return nil, err
		}
		for _, dir := range m {
			s, err := readStorage(dir)
			if err != nil {
				return nil, err
			}
			a = append(a, s)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return a, nil
}

func readStorage(dir string) (*Storage, error) {
	ctl := filepath.Join(dir, "ctl")
	f, err := os.Open(ctl)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var s Storage
	s.Name = filepath.Base(dir)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Bytes()
		switch {
		case bytes.HasPrefix(line, []byte("inquiry ")):
			s.Model = string(bytes.TrimSpace(line[7:]))
		case bytes.HasPrefix(line, []byte("geometry ")):
			fields := bytes.Split(line, delim)
			if len(fields) < 3 {
				continue
			}
			var p intParser
			sec := p.ParseInt64(string(fields[1]), 10)
			size := p.ParseInt64(string(fields[2]), 10)
			if err := p.Err(); err != nil {
				return nil, err
			}
			s.Capacity = sec * size
		case bytes.HasPrefix(line, []byte("part ")):
			fields := bytes.Split(line, delim)
			if len(fields) < 4 {
				continue
			}
			var p intParser
			start := p.ParseUint64(string(fields[2]), 10)
			end := p.ParseUint64(string(fields[3]), 10)
			if err := p.Err(); err != nil {
				return nil, err
			}
			s.Partitions = append(s.Partitions, &Partition{
				Name:  string(fields[1]),
				Start: start,
				End:   end,
			})
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return &s, nil
}
