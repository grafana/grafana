package backend

import (
	"errors"
	"sort"
	"unsafe"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

func init() { //nolint:gochecknoinits
	jsoniter.RegisterTypeEncoder("backend.DataResponse", &dataResponseCodec{})
	jsoniter.RegisterTypeEncoder("backend.QueryDataResponse", &queryDataResponseCodec{})
}

type dataResponseCodec struct{}

func (codec *dataResponseCodec) IsEmpty(ptr unsafe.Pointer) bool {
	dr := (*DataResponse)(ptr)
	return dr.Error == nil && dr.Frames == nil
}

func (codec *dataResponseCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	dr := (*DataResponse)(ptr)
	writeDataResponseJSON(dr, stream)
}

type queryDataResponseCodec struct{}

func (codec *queryDataResponseCodec) IsEmpty(ptr unsafe.Pointer) bool {
	qdr := *((*QueryDataResponse)(ptr))
	return qdr.Responses == nil
}

func (codec *queryDataResponseCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	qdr := (*QueryDataResponse)(ptr)
	writeQueryDataResponseJSON(qdr, stream)
}

func (codec *queryDataResponseCodec) Decode(ptr unsafe.Pointer, iter *jsoniter.Iterator) {
	qdr := QueryDataResponse{}
	readQueryDataResultsJSON(&qdr, iter)
	*((*QueryDataResponse)(ptr)) = qdr
}

//-----------------------------------------------------------------
// Private stream readers
//-----------------------------------------------------------------

func writeDataResponseJSON(dr *DataResponse, stream *jsoniter.Stream) {
	stream.WriteObjectStart()
	started := false

	status := dr.Status

	if dr.Error != nil {
		stream.WriteObjectField("error")
		stream.WriteString(dr.Error.Error())
		started = true

		if !status.IsValid() {
			status = statusFromError(dr.Error)
		}

		stream.WriteMore()
		stream.WriteObjectField("errorSource")
		stream.WriteString(string(dr.ErrorSource))
	}

	if status.IsValid() || status == 0 {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("status")
		if status.IsValid() {
			stream.WriteInt32(int32(status)) // #nosec G115 -- Status values are HTTP status codes (100-599), always fit in int32
		} else if status == 0 {
			stream.WriteInt32(int32(StatusOK))
		}
		started = true
	}

	if dr.Frames != nil {
		if started {
			stream.WriteMore()
		}

		started = false
		stream.WriteObjectField("frames")
		stream.WriteArrayStart()
		for _, frame := range dr.Frames {
			if started {
				stream.WriteMore()
			}
			stream.WriteVal(frame)
			started = true
		}
		stream.WriteArrayEnd()
	}

	stream.WriteObjectEnd()
}

func writeQueryDataResponseJSON(qdr *QueryDataResponse, stream *jsoniter.Stream) {
	stream.WriteObjectStart()
	stream.WriteObjectField("results")
	stream.WriteObjectStart()
	started := false

	refIDs := []string{}
	for refID := range qdr.Responses {
		refIDs = append(refIDs, refID)
	}
	sort.Strings(refIDs)

	// Make sure all keys in the result are written
	for _, refID := range refIDs {
		res := qdr.Responses[refID]

		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField(refID)
		obj := res // avoid implicit memory
		writeDataResponseJSON(&obj, stream)
		started = true
	}
	stream.WriteObjectEnd()

	stream.WriteObjectEnd()
}

//-----------------------------------------------------------------
// Private stream readers
//-----------------------------------------------------------------

func readQueryDataResultsJSON(qdr *QueryDataResponse, iter *jsoniter.Iterator) {
	found := false

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case "results":
			if found {
				iter.ReportError("read results", "already found results")
				return
			}
			found = true

			qdr.Responses = make(Responses)

			l2Field := iter.ReadObject()
			// the response may have an empty-string refId. this is not allowed,
			// but it may happen, and we want to be able to handle the case.
			// jsonIter uses empty-string to signalize both of these cases:
			// - end of object
			// - key found with the value empty-string
			// to be able to differentiate between these two cases, we use the `WhatIsNext()`
			// function, that tells us what is coming next, but does not consume content.
			for l2Field != "" || iter.WhatIsNext() == jsoniter.ObjectValue {
				dr := DataResponse{}
				readDataResponseJSON(&dr, iter)
				qdr.Responses[l2Field] = dr

				l2Field = iter.ReadObject()
			}

		default:
			iter.ReportError("bind l1", "unexpected field: "+l1Field)
			return
		}
	}
}

func readDataResponseJSON(rsp *DataResponse, iter *jsoniter.Iterator) {
	for l2Field := iter.ReadObject(); l2Field != ""; l2Field = iter.ReadObject() {
		switch l2Field {
		case "error":
			rsp.Error = errors.New(iter.ReadString())

		case "status":
			rsp.Status = Status(iter.ReadInt32())

		case "errorSource":
			rsp.ErrorSource = ErrorSource(iter.ReadString())

		case "frames":
			for iter.ReadArray() {
				frame := &data.Frame{}
				iter.ReadVal(frame)
				if iter.Error != nil {
					return
				}
				rsp.Frames = append(rsp.Frames, frame)
			}

		default:
			iter.ReportError("bind l2", "unexpected field: "+l2Field)
			return
		}
	}
}
