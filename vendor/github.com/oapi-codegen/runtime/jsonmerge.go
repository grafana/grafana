package runtime

import (
	"encoding/json"

	"github.com/apapsch/go-jsonmerge/v2"
)

// JsonMerge merges two JSON representation into a single object. `data` is the
// existing representation and `patch` is the new data to be merged in
func JsonMerge(data, patch json.RawMessage) (json.RawMessage, error) {
	merger := jsonmerge.Merger{
		CopyNonexistent: true,
	}
	if data == nil {
		data = []byte(`{}`)
	}
	if patch == nil {
		patch = []byte(`{}`)
	}
	merged, err := merger.MergeBytes(data, patch)
	if err != nil {
		return nil, err
	}
	return merged, nil
}
