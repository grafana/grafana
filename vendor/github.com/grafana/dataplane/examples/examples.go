// Package examples provides example data dataplane contract
// data for testing
package examples

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// The files are embedded so paths are consistent and so there
// are not issues with relative paths when using this in other's
// libraries tests.
//
//go:embed data/numeric/* data/timeseries/*
var content embed.FS

// ExampleInfo is additional info about the example.
// It is a mix of info that is populated from the directories
// that contain the json files and from the Meta.Custom["exampleInfo"] of the
// first frame in each file.
// The Path and Summary properties should not be considered stable.
type ExampleInfo struct {
	// Summary is a text description of data example.
	Summary string `json:"summary"`

	// ItemCount is the number of unique items in the data.
	// For example, the number of time series in a time series response.
	ItemCount int `json:"itemCount"`

	// Valid means that the example is valid according to the dataplane contract
	// and is not something that should error or warn.
	Valid bool `json:"valid"`

	// NoData means the example is a NoData example as defined in the contract.
	NoData bool `json:"noData"`

	// CollectionVersion is a unique sequence number within a collection. This allows
	// examples to be added to a collection, but consumers to be able to select not
	// to get all examples until they are ready.
	CollectionVersion int `json:"collectionVersion"`

	// Note: Consider adding Remainder count after seeing if remainder frame/field is separate or not.

	// This following fields are populated from areas outside the Meta.Custom["exampleInfo"] (either the frame, or containing directories)
	Type    data.FrameType        `json:"-"`
	Version data.FrameTypeVersion `json:"-"`

	// Path may change without a version change but will remain unique
	Path string `json:"-"`

	// Filename without the kind
	Name string `json:"-"`

	// Name of the collection
	CollectionName string `json:"-"`

	// ID is Type/Version/Collection/Name
	ID string
}

// Example has info about the example, and data.Frames of an example.
type Example struct {
	info   ExampleInfo
	frames data.Frames
}

// Info returns the ExampleInfo from an example.
func (e *Example) Info() ExampleInfo {
	return e.info
}

// Frames returns the example's data.Frames ([]*data.Frames) with each
// frame's RefID property set to refID.
// The frames returned may be modified without changing the example frames.
func (e *Example) Frames(refID string) data.Frames {
	// Reread to avoid mutation issues.
	b, err := fs.ReadFile(content, e.info.Path)
	if err != nil {
		// panic since repeat of GetExamples() which is against embed
		// so should not fail
		panic(err)
	}

	var frames data.Frames
	err = json.Unmarshal(b, &frames)
	if err != nil {
		panic(err)
	}
	if refID != "" { // all examples having default refID in frames of "" is tested for
		for _, frame := range frames {
			frame.RefID = refID
		}
	}
	return frames
}

// GetExamples returns all Examples provided by this library.
func GetExamples() (Examples, error) {
	e := Examples{}
	err := fs.WalkDir(content, "data", func(path string, info fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(path, ".json") {
			var frames data.Frames
			b, err := fs.ReadFile(content, path)
			if err != nil {
				return err
			}

			err = json.Unmarshal(b, &frames)
			if err != nil {
				return err
			}

			parts := strings.Split(path, "/") // embed is linux sy
			if len(parts) < 5 {
				return fmt.Errorf("unexpected test/example file path length, want at least 4 but got %v for %q", len(parts), path)
			}
			collection := parts[len(parts)-2]
			nameParts := strings.SplitN(parts[len(parts)-1], "_", 2)
			name := strings.TrimSuffix(nameParts[1], ".json")

			err = e.addExample(frames, collection, path, name)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return e, err
	}

	if len(e.e) == 0 {
		return e, fmt.Errorf("no examples found")
	}

	e.Sort(SortPathAsc)

	return e, nil
}

func newExample(frames data.Frames, collection, path, name string) (Example, error) {
	e := Example{
		frames: frames,
	}
	ei, err := exampleInfoFromFrames(frames, collection, path, name)
	if err != nil {
		return e, err
	}
	e.info = ei
	return e, nil
}

func exampleInfoFromFrames(frames data.Frames, collection, path, name string) (ExampleInfo, error) {
	info := ExampleInfo{}
	if len(frames) == 0 {
		return info, fmt.Errorf("Example (frames) is nil or zero length and must have at least one frame for path %s", path)
	}

	firstFrame := frames[0]
	if firstFrame == nil {
		return info, fmt.Errorf("nil frame should not exist for path %s", path)
	}
	if firstFrame.Meta == nil {
		return info, fmt.Errorf("first first meta is nil so missing example info for path %s", path)
	}

	if firstFrame.Meta.Custom == nil {
		return info, fmt.Errorf("custom meta data is missing so missing example info for path %s", path)
	}

	custom, ok := firstFrame.Meta.Custom.(map[string]interface{})
	if !ok {
		return info, fmt.Errorf(`custom meta data is not an object ({"string": value}) so missing example info for path %s`, path)
	}

	infoRaw, found := custom["exampleInfo"]
	if !found {
		return info, fmt.Errorf(`exampleInfo property not found is custom metadata so missing example info for path %s`, path)
	}

	b, err := json.Marshal(infoRaw)
	if err != nil {
		return info, err
	}

	err = json.Unmarshal(b, &info)
	info.Type = firstFrame.Meta.Type
	info.Version = firstFrame.Meta.TypeVersion
	info.Name = name
	info.CollectionName = collection
	info.Path = path
	info.ID = strings.Join([]string{string(info.Type), "v" + info.Version.String(), info.CollectionName, info.Name}, "/")

	return info, err
}

// Examples contains Examples.
type Examples struct {
	e []Example
}

// AsSlice returns all examples as a slice of Example ([]Example).
func (e *Examples) AsSlice() []Example {
	return e.e
}

func (e *Examples) addExample(frames data.Frames, collection, path, name string) error {
	if e.e == nil {
		e.e = make([]Example, 0)
	}
	example, err := newExample(frames, collection, path, name)
	if err != nil {
		return err
	}
	e.e = append(e.e, example)
	return nil
}

type Collection Examples

func (c Collection) ExampleSlice() []Example {
	return c.e
}

// ID is the unique identifier string of the collection.
func (c Collection) ID() string {
	info := c.e[0].info
	return strings.Join([]string{string(info.Type), "v" + info.Version.String(), info.CollectionName}, "/")
}

func (c Collection) Name() string {
	return c.e[0].info.CollectionName
}

func (c Collection) FrameType() data.FrameType {
	return c.e[0].info.Type
}

func (c Collection) FrameTypeVersion() data.FrameTypeVersion {
	return c.e[0].info.Version
}

func (c Collection) MaxCollectionVersion() int {
	max := 0
	for _, e := range c.e {
		if e.info.CollectionVersion > max {
			max = e.info.CollectionVersion
		}
	}
	return max
}

func (c Collection) ExamplesEqualOrLessThan(collectionVersion int) Examples {
	newExamples := Examples{
		e: make([]Example, 0),
	}
	for _, e := range c.e {
		if e.info.CollectionVersion <= collectionVersion {
			newExamples.e = append(newExamples.e, e)
		}
	}
	return newExamples
}

func (e *Examples) Collections() []Collection {
	m := make(map[data.FrameType]map[data.FrameTypeVersion]map[string]Collection)
	cap := 0
	for _, example := range e.e {
		info := example.info

		tToVersion, ok := m[info.Type]
		if !ok {
			m[info.Type] = make(map[data.FrameTypeVersion]map[string]Collection)
		}

		_, ok = tToVersion[info.Version]
		if !ok {
			m[info.Type][info.Version] = make(map[string]Collection)
			cap++
		}

		c := m[info.Type][info.Version][info.CollectionName]
		c.e = append(c.e, example)
		m[info.Type][info.Version][info.CollectionName] = c
	}

	c := make([]Collection, 0, cap)
	for _, tv := range m {
		for _, nc := range tv {
			for _, col := range nc {
				c = append(c, col)
			}
		}
	}
	return c
}

// FilterOptions is the argument to the Examples Filter method.
type FilterOptions struct {
	Kind              data.FrameTypeKind
	Type              data.FrameType
	Version           data.FrameTypeVersion
	Collection        string
	CollectionVersion int
	Valid             *bool
	NoData            *bool
}

// Filter will return a new slice of Examples filtered to
// the Examples that match any non-zero fields in FilterOptions.
func (e *Examples) Filter(f FilterOptions) (Examples, error) {
	var fExamples Examples

	if f.Kind != "" && f.Type != "" && f.Type.Kind() != f.Kind {
		return fExamples, fmt.Errorf("FrameTypeKind %q does match the FrameType %q Kind %q", f.Kind, f.Type, f.Type.Kind())
	}

	for _, example := range e.e {
		info := example.info
		if f.Kind != "" && f.Kind != info.Type.Kind() {
			continue
		}

		if f.Type != "" && f.Type != info.Type {
			continue
		}

		if !f.Version.IsZero() && f.Version != info.Version {
			continue
		}

		if f.Collection != "" && f.Collection != info.CollectionName {
			continue
		}

		if f.CollectionVersion > 0 && info.CollectionVersion <= f.CollectionVersion {
			continue
		}

		if f.NoData != nil && *f.NoData != info.NoData {
			continue
		}

		if f.Valid != nil && *f.Valid != info.Valid {
			continue
		}

		fExamples.e = append(fExamples.e, example)
	}

	if len(fExamples.e) == 0 {
		return fExamples, fmt.Errorf("no examples after filtering")
	}

	return fExamples, nil
}
