package tempopb

import (
	"strings"

	"github.com/gogo/protobuf/jsonpb"
)

// It marshal a Trace to an OTEL compatible JSON.
// Historically, our Trace proto message used `batches` to define the array of resourses spans.
// To be OTEL compatible we renamed it to `resourcesSpans`.
// To be backward compatible, this function use jsonpb to marshal the Trace to an OTEL compatible JSON
// and then replace the first occurrence of `resourceSpan` by `batches`.
func MarshalToJSONV1(t *Trace) ([]byte, error) {
	marshaler := &jsonpb.Marshaler{}
	jsonStr, err := marshaler.MarshalToString(t)
	if err != nil {
		return nil, err
	}
	jsonStr = strings.Replace(jsonStr, `"resourceSpans":`, `"batches":`, 1)
	return []byte(jsonStr), nil
}

// It unmarshal an OTEL compatible JSON to a Trace.
// Historically, our Trace proto message used `batches` to define the array of resourses spans.
// To be OTEL compatible we renamed it to `resourcesSpan`.
// To be backward compatible, this function replaces the first occurrence of `batches` by `resourcesSpan`
// and then use jsonpb to unmarshal JSON into a Trace.
func UnmarshalFromJSONV1(data []byte, t *Trace) error {
	marshaler := &jsonpb.Unmarshaler{}
	jsonStr := strings.Replace(string(data), `"batches":`, `"resourceSpans":`, 1)
	err := marshaler.Unmarshal(strings.NewReader(jsonStr), t)
	return err
}
