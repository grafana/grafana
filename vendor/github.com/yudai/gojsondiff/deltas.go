package gojsondiff

import (
	"errors"
	dmp "github.com/sergi/go-diff/diffmatchpatch"
	"reflect"
	"strconv"
)

// A Delta represents an atomic difference between two JSON objects.
type Delta interface {
	// Similarity calculates the similarity of the Delta values.
	// The return value is normalized from 0 to 1,
	// 0 is completely different and 1 is they are same
	Similarity() (similarity float64)
}

// To cache the calculated similarity,
// concrete Deltas can use similariter and similarityCache
type similariter interface {
	similarity() (similarity float64)
}

type similarityCache struct {
	similariter
	value float64
}

func newSimilarityCache(sim similariter) similarityCache {
	cache := similarityCache{similariter: sim, value: -1}
	return cache
}

func (cache similarityCache) Similarity() (similarity float64) {
	if cache.value < 0 {
		cache.value = cache.similariter.similarity()
	}
	return cache.value
}

// A Position represents the position of a Delta in an object or an array.
type Position interface {
	// String returns the position as a string
	String() (name string)

	// CompareTo returns a true if the Position is smaller than another Position.
	// This function is used to sort Positions by the sort package.
	CompareTo(another Position) bool
}

// A Name is a Postition with a string, which means the delta is in an object.
type Name string

func (n Name) String() (name string) {
	return string(n)
}

func (n Name) CompareTo(another Position) bool {
	return n < another.(Name)
}

// A Index is a Position with an int value, which means the Delta is in an Array.
type Index int

func (i Index) String() (name string) {
	return strconv.Itoa(int(i))
}

func (i Index) CompareTo(another Position) bool {
	return i < another.(Index)
}

// A PreDelta is a Delta that has a position of the left side JSON object.
// Deltas implements this interface should be applies before PostDeltas.
type PreDelta interface {
	// PrePosition returns the Position.
	PrePosition() Position

	// PreApply applies the delta to object.
	PreApply(object interface{}) interface{}
}

type preDelta struct{ Position }

func (i preDelta) PrePosition() Position {
	return Position(i.Position)
}

type preDeltas []PreDelta

// for sorting
func (s preDeltas) Len() int {
	return len(s)
}

// for sorting
func (s preDeltas) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

// for sorting
func (s preDeltas) Less(i, j int) bool {
	return !s[i].PrePosition().CompareTo(s[j].PrePosition())
}

// A PreDelta is a Delta that has a position of the right side JSON object.
// Deltas implements this interface should be applies after PreDeltas.
type PostDelta interface {
	// PostPosition returns the Position.
	PostPosition() Position

	// PostApply applies the delta to object.
	PostApply(object interface{}) interface{}
}

type postDelta struct{ Position }

func (i postDelta) PostPosition() Position {
	return Position(i.Position)
}

type postDeltas []PostDelta

// for sorting
func (s postDeltas) Len() int {
	return len(s)
}

// for sorting
func (s postDeltas) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

// for sorting
func (s postDeltas) Less(i, j int) bool {
	return s[i].PostPosition().CompareTo(s[j].PostPosition())
}

// An Object is a Delta that represents an object of JSON
type Object struct {
	postDelta
	similarityCache

	// Deltas holds internal Deltas
	Deltas []Delta
}

// NewObject returns an Object
func NewObject(position Position, deltas []Delta) *Object {
	d := Object{postDelta: postDelta{position}, Deltas: deltas}
	d.similarityCache = newSimilarityCache(&d)
	return &d
}

func (d *Object) PostApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		o := object.(map[string]interface{})
		n := string(d.PostPosition().(Name))
		o[n] = applyDeltas(d.Deltas, o[n])
	case []interface{}:
		o := object.([]interface{})
		n := int(d.PostPosition().(Index))
		o[n] = applyDeltas(d.Deltas, o[n])
	}
	return object
}

func (d *Object) similarity() (similarity float64) {
	similarity = deltasSimilarity(d.Deltas)
	return
}

// An Array is a Delta that represents an array of JSON
type Array struct {
	postDelta
	similarityCache

	// Deltas holds internal Deltas
	Deltas []Delta
}

// NewArray returns an Array
func NewArray(position Position, deltas []Delta) *Array {
	d := Array{postDelta: postDelta{position}, Deltas: deltas}
	d.similarityCache = newSimilarityCache(&d)
	return &d
}

func (d *Array) PostApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		o := object.(map[string]interface{})
		n := string(d.PostPosition().(Name))
		o[n] = applyDeltas(d.Deltas, o[n])
	case []interface{}:
		o := object.([]interface{})
		n := int(d.PostPosition().(Index))
		o[n] = applyDeltas(d.Deltas, o[n])
	}
	return object
}

func (d *Array) similarity() (similarity float64) {
	similarity = deltasSimilarity(d.Deltas)
	return
}

// An Added represents a new added field of an object or an array
type Added struct {
	postDelta
	similarityCache

	// Values holds the added value
	Value interface{}
}

// NewAdded returns a new Added
func NewAdded(position Position, value interface{}) *Added {
	d := Added{postDelta: postDelta{position}, Value: value}
	return &d
}

func (d *Added) PostApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		object.(map[string]interface{})[string(d.PostPosition().(Name))] = d.Value
	case []interface{}:
		i := int(d.PostPosition().(Index))
		o := object.([]interface{})
		if i < len(o) {
			o = append(o, 0) //dummy
			copy(o[i+1:], o[i:])
			o[i] = d.Value
			object = o
		} else {
			object = append(o, d.Value)
		}
	}

	return object
}

func (d *Added) similarity() (similarity float64) {
	return 0
}

// A Modified represents a field whose value is changed.
type Modified struct {
	postDelta
	similarityCache

	// The value before modification
	OldValue interface{}

	// The value after modification
	NewValue interface{}
}

// NewModified returns a Modified
func NewModified(position Position, oldValue, newValue interface{}) *Modified {
	d := Modified{
		postDelta: postDelta{position},
		OldValue:  oldValue,
		NewValue:  newValue,
	}
	d.similarityCache = newSimilarityCache(&d)
	return &d

}

func (d *Modified) PostApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		// TODO check old value
		object.(map[string]interface{})[string(d.PostPosition().(Name))] = d.NewValue
	case []interface{}:
		object.([]interface{})[int(d.PostPosition().(Index))] = d.NewValue
	}
	return object
}

func (d *Modified) similarity() (similarity float64) {
	similarity += 0.3 // at least, they are at the same position
	if reflect.TypeOf(d.OldValue) == reflect.TypeOf(d.NewValue) {
		similarity += 0.3 // types are same

		switch d.OldValue.(type) {
		case string:
			similarity += 0.4 * stringSimilarity(d.OldValue.(string), d.NewValue.(string))
		case float64:
			ratio := d.OldValue.(float64) / d.NewValue.(float64)
			if ratio > 1 {
				ratio = 1 / ratio
			}
			similarity += 0.4 * ratio
		}
	}
	return
}

// A TextDiff represents a Modified with TextDiff between the old and the new values.
type TextDiff struct {
	Modified

	// Diff string
	Diff []dmp.Patch
}

// NewTextDiff returns
func NewTextDiff(position Position, diff []dmp.Patch, oldValue, newValue interface{}) *TextDiff {
	d := TextDiff{
		Modified: *NewModified(position, oldValue, newValue),
		Diff:     diff,
	}
	return &d
}

func (d *TextDiff) PostApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		o := object.(map[string]interface{})
		i := string(d.PostPosition().(Name))
		// TODO error
		d.OldValue = o[i]
		// TODO error
		d.patch()
		o[i] = d.NewValue
	case []interface{}:
		o := object.([]interface{})
		i := d.PostPosition().(Index)
		d.OldValue = o[i]
		// TODO error
		d.patch()
		o[i] = d.NewValue
	}
	return object
}

func (d *TextDiff) patch() error {
	if d.OldValue == nil {
		return errors.New("Old Value is not set")
	}
	patcher := dmp.New()
	patched, successes := patcher.PatchApply(d.Diff, d.OldValue.(string))
	for _, success := range successes {
		if !success {
			return errors.New("Failed to apply a patch")
		}
	}
	d.NewValue = patched
	return nil
}

func (d *TextDiff) DiffString() string {
	dmp := dmp.New()
	return dmp.PatchToText(d.Diff)
}

// A Delted represents deleted field or index of an Object or an Array.
type Deleted struct {
	preDelta

	// The value deleted
	Value interface{}
}

// NewDeleted returns a Deleted
func NewDeleted(position Position, value interface{}) *Deleted {
	d := Deleted{
		preDelta: preDelta{position},
		Value:    value,
	}
	return &d

}

func (d *Deleted) PreApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		// TODO check old value
		delete(object.(map[string]interface{}), string(d.PrePosition().(Name)))
	case []interface{}:
		i := int(d.PrePosition().(Index))
		o := object.([]interface{})
		object = append(o[:i], o[i+1:]...)
	}
	return object
}

func (d Deleted) Similarity() (similarity float64) {
	return 0
}

// A Moved represents field that is moved, which means the index or name is
// changed. Note that, in this library, assigning a Moved and a Modified to
// a single position is not allowed. For the compatibility with jsondiffpatch,
// the Moved in this library can hold the old and new value in it.
type Moved struct {
	preDelta
	postDelta
	similarityCache
	// The value before moving
	Value interface{}
	// The delta applied after moving (for compatibility)
	Delta interface{}
}

func NewMoved(oldPosition Position, newPosition Position, value interface{}, delta Delta) *Moved {
	d := Moved{
		preDelta:  preDelta{oldPosition},
		postDelta: postDelta{newPosition},
		Value:     value,
		Delta:     delta,
	}
	d.similarityCache = newSimilarityCache(&d)
	return &d
}

func (d *Moved) PreApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		//not supported
	case []interface{}:
		i := int(d.PrePosition().(Index))
		o := object.([]interface{})
		d.Value = o[i]
		object = append(o[:i], o[i+1:]...)
	}
	return object
}

func (d *Moved) PostApply(object interface{}) interface{} {
	switch object.(type) {
	case map[string]interface{}:
		//not supported
	case []interface{}:
		i := int(d.PostPosition().(Index))
		o := object.([]interface{})
		o = append(o, 0) //dummy
		copy(o[i+1:], o[i:])
		o[i] = d.Value
		object = o
	}

	if d.Delta != nil {
		d.Delta.(PostDelta).PostApply(object)
	}

	return object
}

func (d *Moved) similarity() (similarity float64) {
	similarity = 0.6 // as type and contens are same
	ratio := float64(d.PrePosition().(Index)) / float64(d.PostPosition().(Index))
	if ratio > 1 {
		ratio = 1 / ratio
	}
	similarity += 0.4 * ratio
	return
}
