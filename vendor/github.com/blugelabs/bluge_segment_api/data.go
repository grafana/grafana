//  Copyright (c) 2020 The Bluge Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package segment

import (
	"io"
	"os"
)

// Data is an opaque representation of some data.
// This data could have been read onto the heap,
// it could be a live memory-mapped region,
// or it could be loaded on demand using traditional
// file I/O.
//
// Micro-benchmarking supported using this concrete structure
// with simple conditional over an interface with multiple
// implementations.
type Data struct {
	mem []byte
	r   io.ReaderAt
	sz  int
}

func NewDataBytes(b []byte) *Data {
	return &Data{
		mem: b,
	}
}

func NewDataFile(f *os.File) (*Data, error) {
	fInfo, err := f.Stat()
	if err != nil {
		return nil, err
	}
	return &Data{
		r:  f,
		sz: int(fInfo.Size()),
	}, nil
}

func (d *Data) Read(start, end int) ([]byte, error) {
	if d.mem != nil {
		return d.mem[start:end], nil
	}
	rv := make([]byte, end-start)
	_, err := d.r.ReadAt(rv, int64(start))
	if err != nil {
		return nil, err
	}
	return rv, nil
}

func (d *Data) Len() int {
	if d.mem != nil {
		return len(d.mem)
	}
	return d.sz
}

func (d *Data) Slice(start, end int) *Data {
	if d.mem != nil {
		return &Data{
			mem: d.mem[start:end],
		}
	}
	return &Data{
		r:  io.NewSectionReader(d.r, int64(start), int64(end-start)),
		sz: end - start,
	}
}

func (d *Data) Reader() *DataReader {
	return &DataReader{
		d: d,
	}
}

func (d *Data) WriteTo(w io.Writer) (int64, error) {
	if d.mem != nil {
		n, err := w.Write(d.mem)
		return int64(n), err
	}
	dataReader := d.Reader()
	return io.Copy(w, dataReader)
}

func (d *Data) Size() int {
	if d.mem != nil {
		return cap(d.mem)
	}
	// FIXME not really 0 need size stuff
	return 0
}

type DataReader struct {
	d *Data
	n int
}

func (r *DataReader) Read(p []byte) (n int, err error) {
	if r.n >= r.d.Len() {
		return 0, io.EOF
	}
	start := r.n
	end := r.n + len(p)
	if end > r.d.Len() {
		end = r.d.Len()
	}
	data, err := r.d.Read(start, end)
	if err != nil {
		return 0, err
	}
	copy(p, data)
	r.n = end
	return end - start, nil
}
