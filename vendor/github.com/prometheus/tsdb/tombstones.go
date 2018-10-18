// Copyright 2017 The Prometheus Authors
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

package tsdb

import (
	"encoding/binary"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/pkg/errors"
)

const tombstoneFilename = "tombstones"

const (
	// MagicTombstone is 4 bytes at the head of a tombstone file.
	MagicTombstone = 0x130BA30

	tombstoneFormatV1 = 1
)

// TombstoneReader gives access to tombstone intervals by series reference.
type TombstoneReader interface {
	// Get returns deletion intervals for the series with the given reference.
	Get(ref uint64) (Intervals, error)

	// Iter calls the given function for each encountered interval.
	Iter(func(uint64, Intervals) error) error

	// Total returns the total count of tombstones.
	Total() uint64

	// Close any underlying resources
	Close() error
}

func writeTombstoneFile(dir string, tr TombstoneReader) error {
	path := filepath.Join(dir, tombstoneFilename)
	tmp := path + ".tmp"
	hash := newCRC32()

	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	defer func() {
		if f != nil {
			f.Close()
		}
	}()

	buf := encbuf{b: make([]byte, 3*binary.MaxVarintLen64)}
	buf.reset()
	// Write the meta.
	buf.putBE32(MagicTombstone)
	buf.putByte(tombstoneFormatV1)
	_, err = f.Write(buf.get())
	if err != nil {
		return err
	}

	mw := io.MultiWriter(f, hash)

	if err := tr.Iter(func(ref uint64, ivs Intervals) error {
		for _, iv := range ivs {
			buf.reset()

			buf.putUvarint64(ref)
			buf.putVarint64(iv.Mint)
			buf.putVarint64(iv.Maxt)

			_, err = mw.Write(buf.get())
			if err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return fmt.Errorf("error writing tombstones: %v", err)
	}

	_, err = f.Write(hash.Sum(nil))
	if err != nil {
		return err
	}

	if err = f.Close(); err != nil {
		return err
	}
	f = nil
	return renameFile(tmp, path)
}

// Stone holds the information on the posting and time-range
// that is deleted.
type Stone struct {
	ref       uint64
	intervals Intervals
}

func readTombstones(dir string) (*memTombstones, error) {
	b, err := ioutil.ReadFile(filepath.Join(dir, tombstoneFilename))
	if os.IsNotExist(err) {
		return NewMemTombstones(), nil
	} else if err != nil {
		return nil, err
	}

	if len(b) < 5 {
		return nil, errors.Wrap(errInvalidSize, "tombstones header")
	}

	d := &decbuf{b: b[:len(b)-4]} // 4 for the checksum.
	if mg := d.be32(); mg != MagicTombstone {
		return nil, fmt.Errorf("invalid magic number %x", mg)
	}
	if flag := d.byte(); flag != tombstoneFormatV1 {
		return nil, fmt.Errorf("invalid tombstone format %x", flag)
	}

	if d.err() != nil {
		return nil, d.err()
	}

	// Verify checksum.
	hash := newCRC32()
	if _, err := hash.Write(d.get()); err != nil {
		return nil, errors.Wrap(err, "write to hash")
	}
	if binary.BigEndian.Uint32(b[len(b)-4:]) != hash.Sum32() {
		return nil, errors.New("checksum did not match")
	}

	stonesMap := NewMemTombstones()

	for d.len() > 0 {
		k := d.uvarint64()
		mint := d.varint64()
		maxt := d.varint64()
		if d.err() != nil {
			return nil, d.err()
		}

		stonesMap.addInterval(k, Interval{mint, maxt})
	}

	return stonesMap, nil
}

type memTombstones struct {
	intvlGroups map[uint64]Intervals
	mtx         sync.RWMutex
}

func NewMemTombstones() *memTombstones {
	return &memTombstones{intvlGroups: make(map[uint64]Intervals)}
}

func (t *memTombstones) Get(ref uint64) (Intervals, error) {
	t.mtx.RLock()
	defer t.mtx.RUnlock()
	return t.intvlGroups[ref], nil
}

func (t *memTombstones) Iter(f func(uint64, Intervals) error) error {
	t.mtx.RLock()
	defer t.mtx.RUnlock()
	for ref, ivs := range t.intvlGroups {
		if err := f(ref, ivs); err != nil {
			return err
		}
	}
	return nil
}

func (t *memTombstones) Total() uint64 {
	t.mtx.RLock()
	defer t.mtx.RUnlock()

	total := uint64(0)
	for _, ivs := range t.intvlGroups {
		total += uint64(len(ivs))
	}
	return total
}

// addInterval to an existing memTombstones
func (t *memTombstones) addInterval(ref uint64, itvs ...Interval) {
	t.mtx.Lock()
	defer t.mtx.Unlock()
	for _, itv := range itvs {
		t.intvlGroups[ref] = t.intvlGroups[ref].add(itv)
	}
}

func (memTombstones) Close() error {
	return nil
}

// Interval represents a single time-interval.
type Interval struct {
	Mint, Maxt int64
}

func (tr Interval) inBounds(t int64) bool {
	return t >= tr.Mint && t <= tr.Maxt
}

func (tr Interval) isSubrange(dranges Intervals) bool {
	for _, r := range dranges {
		if r.inBounds(tr.Mint) && r.inBounds(tr.Maxt) {
			return true
		}
	}

	return false
}

// Intervals represents	a set of increasing and non-overlapping time-intervals.
type Intervals []Interval

// add the new time-range to the existing ones.
// The existing ones must be sorted.
func (itvs Intervals) add(n Interval) Intervals {
	for i, r := range itvs {
		// TODO(gouthamve): Make this codepath easier to digest.
		if r.inBounds(n.Mint-1) || r.inBounds(n.Mint) {
			if n.Maxt > r.Maxt {
				itvs[i].Maxt = n.Maxt
			}

			j := 0
			for _, r2 := range itvs[i+1:] {
				if n.Maxt < r2.Mint {
					break
				}
				j++
			}
			if j != 0 {
				if itvs[i+j].Maxt > n.Maxt {
					itvs[i].Maxt = itvs[i+j].Maxt
				}
				itvs = append(itvs[:i+1], itvs[i+j+1:]...)
			}
			return itvs
		}

		if r.inBounds(n.Maxt+1) || r.inBounds(n.Maxt) {
			if n.Mint < r.Maxt {
				itvs[i].Mint = n.Mint
			}
			return itvs
		}

		if n.Mint < r.Mint {
			newRange := make(Intervals, i, len(itvs[:i])+1)
			copy(newRange, itvs[:i])
			newRange = append(newRange, n)
			newRange = append(newRange, itvs[i:]...)

			return newRange
		}
	}

	itvs = append(itvs, n)
	return itvs
}
