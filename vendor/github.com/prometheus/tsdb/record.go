// Copyright 2018 The Prometheus Authors

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
	"math"
	"sort"

	"github.com/pkg/errors"
	"github.com/prometheus/tsdb/labels"
)

// RecordType represents the data type of a record.
type RecordType uint8

const (
	RecordInvalid    RecordType = 255
	RecordSeries     RecordType = 1
	RecordSamples    RecordType = 2
	RecordTombstones RecordType = 3
)

type RecordLogger interface {
	Log(recs ...[]byte) error
}

type RecordReader interface {
	Next() bool
	Err() error
	Record() []byte
}

// RecordDecoder decodes series, sample, and tombstone records.
// The zero value is ready to use.
type RecordDecoder struct {
}

// Type returns the type of the record.
// Return RecordInvalid if no valid record type is found.
func (d *RecordDecoder) Type(rec []byte) RecordType {
	if len(rec) < 1 {
		return RecordInvalid
	}
	switch t := RecordType(rec[0]); t {
	case RecordSeries, RecordSamples, RecordTombstones:
		return t
	}
	return RecordInvalid
}

// Series appends series in rec to the given slice.
func (d *RecordDecoder) Series(rec []byte, series []RefSeries) ([]RefSeries, error) {
	dec := decbuf{b: rec}

	if RecordType(dec.byte()) != RecordSeries {
		return nil, errors.New("invalid record type")
	}
	for len(dec.b) > 0 && dec.err() == nil {
		ref := dec.be64()

		lset := make(labels.Labels, dec.uvarint())

		for i := range lset {
			lset[i].Name = dec.uvarintStr()
			lset[i].Value = dec.uvarintStr()
		}
		sort.Sort(lset)

		series = append(series, RefSeries{
			Ref:    ref,
			Labels: lset,
		})
	}
	if dec.err() != nil {
		return nil, dec.err()
	}
	if len(dec.b) > 0 {
		return nil, errors.Errorf("unexpected %d bytes left in entry", len(dec.b))
	}
	return series, nil
}

// Samples appends samples in rec to the given slice.
func (d *RecordDecoder) Samples(rec []byte, samples []RefSample) ([]RefSample, error) {
	dec := decbuf{b: rec}

	if RecordType(dec.byte()) != RecordSamples {
		return nil, errors.New("invalid record type")
	}
	if dec.len() == 0 {
		return samples, nil
	}
	var (
		baseRef  = dec.be64()
		baseTime = dec.be64int64()
	)
	for len(dec.b) > 0 && dec.err() == nil {
		dref := dec.varint64()
		dtime := dec.varint64()
		val := dec.be64()

		samples = append(samples, RefSample{
			Ref: uint64(int64(baseRef) + dref),
			T:   baseTime + dtime,
			V:   math.Float64frombits(val),
		})
	}

	if dec.err() != nil {
		return nil, errors.Wrapf(dec.err(), "decode error after %d samples", len(samples))
	}
	if len(dec.b) > 0 {
		return nil, errors.Errorf("unexpected %d bytes left in entry", len(dec.b))
	}
	return samples, nil
}

// Tombstones appends tombstones in rec to the given slice.
func (d *RecordDecoder) Tombstones(rec []byte, tstones []Stone) ([]Stone, error) {
	dec := decbuf{b: rec}

	if RecordType(dec.byte()) != RecordTombstones {
		return nil, errors.New("invalid record type")
	}
	for dec.len() > 0 && dec.err() == nil {
		tstones = append(tstones, Stone{
			ref: dec.be64(),
			intervals: Intervals{
				{Mint: dec.varint64(), Maxt: dec.varint64()},
			},
		})
	}
	if dec.err() != nil {
		return nil, dec.err()
	}
	if len(dec.b) > 0 {
		return nil, errors.Errorf("unexpected %d bytes left in entry", len(dec.b))
	}
	return tstones, nil
}

// RecordEncoder encodes series, sample, and tombstones records.
// The zero value is ready to use.
type RecordEncoder struct {
}

// Series appends the encoded series to b and returns the resulting slice.
func (e *RecordEncoder) Series(series []RefSeries, b []byte) []byte {
	buf := encbuf{b: b}
	buf.putByte(byte(RecordSeries))

	for _, s := range series {
		buf.putBE64(s.Ref)
		buf.putUvarint(len(s.Labels))

		for _, l := range s.Labels {
			buf.putUvarintStr(l.Name)
			buf.putUvarintStr(l.Value)
		}
	}
	return buf.get()
}

// Samples appends the encoded samples to b and returns the resulting slice.
func (e *RecordEncoder) Samples(samples []RefSample, b []byte) []byte {
	buf := encbuf{b: b}
	buf.putByte(byte(RecordSamples))

	if len(samples) == 0 {
		return buf.get()
	}

	// Store base timestamp and base reference number of first sample.
	// All samples encode their timestamp and ref as delta to those.
	first := samples[0]

	buf.putBE64(first.Ref)
	buf.putBE64int64(first.T)

	for _, s := range samples {
		buf.putVarint64(int64(s.Ref) - int64(first.Ref))
		buf.putVarint64(s.T - first.T)
		buf.putBE64(math.Float64bits(s.V))
	}
	return buf.get()
}

// Tombstones appends the encoded tombstones to b and returns the resulting slice.
func (e *RecordEncoder) Tombstones(tstones []Stone, b []byte) []byte {
	buf := encbuf{b: b}
	buf.putByte(byte(RecordTombstones))

	for _, s := range tstones {
		for _, iv := range s.intervals {
			buf.putBE64(s.ref)
			buf.putVarint64(iv.Mint)
			buf.putVarint64(iv.Maxt)
		}
	}
	return buf.get()
}
