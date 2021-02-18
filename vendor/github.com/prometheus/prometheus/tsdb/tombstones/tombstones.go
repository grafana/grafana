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

package tombstones

import (
	"encoding/binary"
	"fmt"
	"hash"
	"hash/crc32"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/prometheus/tsdb/encoding"
	tsdb_errors "github.com/prometheus/prometheus/tsdb/errors"
	"github.com/prometheus/prometheus/tsdb/fileutil"
)

const TombstonesFilename = "tombstones"

const (
	// MagicTombstone is 4 bytes at the head of a tombstone file.
	MagicTombstone = 0x0130BA30

	tombstoneFormatV1    = 1
	tombstonesHeaderSize = 5
)

// The table gets initialized with sync.Once but may still cause a race
// with any other use of the crc32 package anywhere. Thus we initialize it
// before.
var castagnoliTable *crc32.Table

func init() {
	castagnoliTable = crc32.MakeTable(crc32.Castagnoli)
}

// newCRC32 initializes a CRC32 hash with a preconfigured polynomial, so the
// polynomial may be easily changed in one location at a later time, if necessary.
func newCRC32() hash.Hash32 {
	return crc32.New(castagnoliTable)
}

// Reader gives access to tombstone intervals by series reference.
type Reader interface {
	// Get returns deletion intervals for the series with the given reference.
	Get(ref uint64) (Intervals, error)

	// Iter calls the given function for each encountered interval.
	Iter(func(uint64, Intervals) error) error

	// Total returns the total count of tombstones.
	Total() uint64

	// Close any underlying resources
	Close() error
}

func WriteFile(logger log.Logger, dir string, tr Reader) (int64, error) {
	path := filepath.Join(dir, TombstonesFilename)
	tmp := path + ".tmp"
	hash := newCRC32()
	var size int

	f, err := os.Create(tmp)
	if err != nil {
		return 0, err
	}
	defer func() {
		if f != nil {
			if err := f.Close(); err != nil {
				level.Error(logger).Log("msg", "close tmp file", "err", err.Error())
			}
		}
		if err := os.RemoveAll(tmp); err != nil {
			level.Error(logger).Log("msg", "remove tmp file", "err", err.Error())
		}
	}()

	buf := encoding.Encbuf{B: make([]byte, 3*binary.MaxVarintLen64)}
	buf.Reset()
	// Write the meta.
	buf.PutBE32(MagicTombstone)
	n, err := f.Write(buf.Get())
	if err != nil {
		return 0, err
	}
	size += n

	bytes, err := Encode(tr)
	if err != nil {
		return 0, errors.Wrap(err, "encoding tombstones")
	}

	// Ignore first byte which is the format type. We do this for compatibility.
	if _, err := hash.Write(bytes[1:]); err != nil {
		return 0, errors.Wrap(err, "calculating hash for tombstones")
	}

	n, err = f.Write(bytes)
	if err != nil {
		return 0, errors.Wrap(err, "writing tombstones")
	}
	size += n

	n, err = f.Write(hash.Sum(nil))
	if err != nil {
		return 0, err
	}
	size += n

	var merr tsdb_errors.MultiError
	if merr.Add(f.Sync()); merr.Err() != nil {
		merr.Add(f.Close())
		return 0, merr.Err()
	}

	if err = f.Close(); err != nil {
		return 0, err
	}
	f = nil
	return int64(size), fileutil.Replace(tmp, path)
}

// Encode encodes the tombstones from the reader.
// It does not attach any magic number or checksum.
func Encode(tr Reader) ([]byte, error) {
	buf := encoding.Encbuf{}
	buf.PutByte(tombstoneFormatV1)
	err := tr.Iter(func(ref uint64, ivs Intervals) error {
		for _, iv := range ivs {
			buf.PutUvarint64(ref)
			buf.PutVarint64(iv.Mint)
			buf.PutVarint64(iv.Maxt)
		}
		return nil
	})
	return buf.Get(), err
}

// Decode decodes the tombstones from the bytes
// which was encoded using the Encode method.
func Decode(b []byte) (Reader, error) {
	d := &encoding.Decbuf{B: b}
	if flag := d.Byte(); flag != tombstoneFormatV1 {
		return nil, errors.Errorf("invalid tombstone format %x", flag)
	}

	if d.Err() != nil {
		return nil, d.Err()
	}

	stonesMap := NewMemTombstones()
	for d.Len() > 0 {
		k := d.Uvarint64()
		mint := d.Varint64()
		maxt := d.Varint64()
		if d.Err() != nil {
			return nil, d.Err()
		}

		stonesMap.AddInterval(k, Interval{mint, maxt})
	}
	return stonesMap, nil
}

// Stone holds the information on the posting and time-range
// that is deleted.
type Stone struct {
	Ref       uint64
	Intervals Intervals
}

func ReadTombstones(dir string) (Reader, int64, error) {
	b, err := ioutil.ReadFile(filepath.Join(dir, TombstonesFilename))
	if os.IsNotExist(err) {
		return NewMemTombstones(), 0, nil
	} else if err != nil {
		return nil, 0, err
	}

	if len(b) < tombstonesHeaderSize {
		return nil, 0, errors.Wrap(encoding.ErrInvalidSize, "tombstones header")
	}

	d := &encoding.Decbuf{B: b[:len(b)-4]} // 4 for the checksum.
	if mg := d.Be32(); mg != MagicTombstone {
		return nil, 0, fmt.Errorf("invalid magic number %x", mg)
	}

	// Verify checksum.
	hash := newCRC32()
	// Ignore first byte which is the format type.
	if _, err := hash.Write(d.Get()[1:]); err != nil {
		return nil, 0, errors.Wrap(err, "write to hash")
	}
	if binary.BigEndian.Uint32(b[len(b)-4:]) != hash.Sum32() {
		return nil, 0, errors.New("checksum did not match")
	}

	if d.Err() != nil {
		return nil, 0, d.Err()
	}

	stonesMap, err := Decode(d.Get())
	if err != nil {
		return nil, 0, err
	}

	return stonesMap, int64(len(b)), nil
}

type MemTombstones struct {
	intvlGroups map[uint64]Intervals
	mtx         sync.RWMutex
}

// NewMemTombstones creates new in memory Tombstone Reader
// that allows adding new intervals.
func NewMemTombstones() *MemTombstones {
	return &MemTombstones{intvlGroups: make(map[uint64]Intervals)}
}

func NewTestMemTombstones(intervals []Intervals) *MemTombstones {
	ret := NewMemTombstones()
	for i, intervalsGroup := range intervals {
		for _, interval := range intervalsGroup {
			ret.AddInterval(uint64(i+1), interval)
		}
	}
	return ret
}

func (t *MemTombstones) Get(ref uint64) (Intervals, error) {
	t.mtx.RLock()
	defer t.mtx.RUnlock()
	return t.intvlGroups[ref], nil
}

func (t *MemTombstones) Iter(f func(uint64, Intervals) error) error {
	t.mtx.RLock()
	defer t.mtx.RUnlock()
	for ref, ivs := range t.intvlGroups {
		if err := f(ref, ivs); err != nil {
			return err
		}
	}
	return nil
}

func (t *MemTombstones) Total() uint64 {
	t.mtx.RLock()
	defer t.mtx.RUnlock()

	total := uint64(0)
	for _, ivs := range t.intvlGroups {
		total += uint64(len(ivs))
	}
	return total
}

// AddInterval to an existing memTombstones.
func (t *MemTombstones) AddInterval(ref uint64, itvs ...Interval) {
	t.mtx.Lock()
	defer t.mtx.Unlock()
	for _, itv := range itvs {
		t.intvlGroups[ref] = t.intvlGroups[ref].Add(itv)
	}
}

func (*MemTombstones) Close() error {
	return nil
}

// Interval represents a single time-interval.
type Interval struct {
	Mint, Maxt int64
}

func (tr Interval) InBounds(t int64) bool {
	return t >= tr.Mint && t <= tr.Maxt
}

func (tr Interval) IsSubrange(dranges Intervals) bool {
	for _, r := range dranges {
		if r.InBounds(tr.Mint) && r.InBounds(tr.Maxt) {
			return true
		}
	}

	return false
}

// Intervals represents	a set of increasing and non-overlapping time-intervals.
type Intervals []Interval

// Add the new time-range to the existing ones.
// The existing ones must be sorted.
func (in Intervals) Add(n Interval) Intervals {
	if len(in) == 0 {
		return append(in, n)
	}
	// Find min and max indexes of intervals that overlap with the new interval.
	// Intervals are closed [t1, t2] and t is discreet, so if neighbour intervals are 1 step difference
	// to the new one, we can merge those together.
	mini := sort.Search(len(in), func(i int) bool { return in[i].Maxt >= n.Mint-1 })
	if mini == len(in) {
		return append(in, n)
	}

	maxi := sort.Search(len(in)-mini, func(i int) bool { return in[mini+i].Mint > n.Maxt+1 })
	if maxi == 0 {
		if mini == 0 {
			return append(Intervals{n}, in...)
		}
		return append(in[:mini], append(Intervals{n}, in[mini:]...)...)
	}

	if n.Mint < in[mini].Mint {
		in[mini].Mint = n.Mint
	}
	in[mini].Maxt = in[maxi+mini-1].Maxt
	if n.Maxt > in[mini].Maxt {
		in[mini].Maxt = n.Maxt
	}
	return append(in[:mini+1], in[maxi+mini:]...)
}
