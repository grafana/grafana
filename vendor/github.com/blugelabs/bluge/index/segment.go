//  Copyright (c) 2020 Couchbase, Inc.
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

package index

import (
	"github.com/RoaringBitmap/roaring"
	segment "github.com/blugelabs/bluge_segment_api"
)

type SegmentSnapshot interface {
	ID() uint64
	Deleted() *roaring.Bitmap
}

type segmentSnapshot struct {
	id             uint64
	segment        *segmentWrapper
	deleted        *roaring.Bitmap
	creator        string
	segmentType    string
	segmentVersion uint32
}

func (s *segmentSnapshot) Segment() segment.Segment {
	return s.segment
}

func (s *segmentSnapshot) Deleted() *roaring.Bitmap {
	return s.deleted
}

func (s *segmentSnapshot) ID() uint64 {
	return s.id
}

func (s *segmentSnapshot) FullSize() int64 {
	return int64(s.segment.Count())
}

func (s segmentSnapshot) LiveSize() int64 {
	return int64(s.Count())
}

func (s *segmentSnapshot) Close() error {
	return s.segment.Close()
}

func (s *segmentSnapshot) VisitDocument(num uint64, visitor segment.StoredFieldVisitor) error {
	return s.segment.VisitStoredFields(num, visitor)
}

func (s *segmentSnapshot) Count() uint64 {
	rv := s.segment.Count()
	if s.deleted != nil {
		rv -= s.deleted.GetCardinality()
	}
	return rv
}

// DocNumbersLive returns a bitmap containing doc numbers for all live docs
func (s *segmentSnapshot) DocNumbersLive() *roaring.Bitmap {
	rv := roaring.NewBitmap()
	rv.AddRange(0, s.segment.Count())
	if s.deleted != nil {
		rv.AndNot(s.deleted)
	}
	return rv
}

func (s *segmentSnapshot) Fields() []string {
	return s.segment.Fields()
}

func (s *segmentSnapshot) Size() (rv int) {
	rv = s.segment.Size()
	if s.deleted != nil {
		rv += int(s.deleted.GetSizeInBytes())
	}
	return
}
