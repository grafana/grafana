package formatter

import (
	"encoding/json"
	"errors"
	"fmt"

	diff "github.com/yudai/gojsondiff"
)

const (
	DeltaDelete   = 0
	DeltaTextDiff = 2
	DeltaMove     = 3
)

func NewDeltaFormatter() *DeltaFormatter {
	return &DeltaFormatter{
		PrintIndent: true,
	}
}

type DeltaFormatter struct {
	PrintIndent bool
}

func (f *DeltaFormatter) Format(diff diff.Diff) (result string, err error) {
	jsonObject, err := f.formatObject(diff.Deltas())
	if err != nil {
		return "", err
	}
	var resultBytes []byte
	if f.PrintIndent {
		resultBytes, err = json.MarshalIndent(jsonObject, "", "  ")
	} else {
		resultBytes, err = json.Marshal(jsonObject)
	}
	if err != nil {
		return "", err
	}

	return string(resultBytes) + "\n", nil
}

func (f *DeltaFormatter) FormatAsJson(diff diff.Diff) (json map[string]interface{}, err error) {
	return f.formatObject(diff.Deltas())
}

func (f *DeltaFormatter) formatObject(deltas []diff.Delta) (deltaJson map[string]interface{}, err error) {
	deltaJson = map[string]interface{}{}
	for _, delta := range deltas {
		switch delta.(type) {
		case *diff.Object:
			d := delta.(*diff.Object)
			deltaJson[d.Position.String()], err = f.formatObject(d.Deltas)
			if err != nil {
				return nil, err
			}
		case *diff.Array:
			d := delta.(*diff.Array)
			deltaJson[d.Position.String()], err = f.formatArray(d.Deltas)
			if err != nil {
				return nil, err
			}
		case *diff.Added:
			d := delta.(*diff.Added)
			deltaJson[d.PostPosition().String()] = []interface{}{d.Value}
		case *diff.Modified:
			d := delta.(*diff.Modified)
			deltaJson[d.PostPosition().String()] = []interface{}{d.OldValue, d.NewValue}
		case *diff.TextDiff:
			d := delta.(*diff.TextDiff)
			deltaJson[d.PostPosition().String()] = []interface{}{d.DiffString(), 0, DeltaTextDiff}
		case *diff.Deleted:
			d := delta.(*diff.Deleted)
			deltaJson[d.PrePosition().String()] = []interface{}{d.Value, 0, DeltaDelete}
		case *diff.Moved:
			return nil, errors.New("Delta type 'Move' is not supported in objects")
		default:
			return nil, errors.New(fmt.Sprintf("Unknown Delta type detected: %#v", delta))
		}
	}
	return
}

func (f *DeltaFormatter) formatArray(deltas []diff.Delta) (deltaJson map[string]interface{}, err error) {
	deltaJson = map[string]interface{}{
		"_t": "a",
	}
	for _, delta := range deltas {
		switch delta.(type) {
		case *diff.Object:
			d := delta.(*diff.Object)
			deltaJson[d.Position.String()], err = f.formatObject(d.Deltas)
			if err != nil {
				return nil, err
			}
		case *diff.Array:
			d := delta.(*diff.Array)
			deltaJson[d.Position.String()], err = f.formatArray(d.Deltas)
			if err != nil {
				return nil, err
			}
		case *diff.Added:
			d := delta.(*diff.Added)
			deltaJson[d.PostPosition().String()] = []interface{}{d.Value}
		case *diff.Modified:
			d := delta.(*diff.Modified)
			deltaJson[d.PostPosition().String()] = []interface{}{d.OldValue, d.NewValue}
		case *diff.TextDiff:
			d := delta.(*diff.TextDiff)
			deltaJson[d.PostPosition().String()] = []interface{}{d.DiffString(), 0, DeltaTextDiff}
		case *diff.Deleted:
			d := delta.(*diff.Deleted)
			deltaJson["_"+d.PrePosition().String()] = []interface{}{d.Value, 0, DeltaDelete}
		case *diff.Moved:
			d := delta.(*diff.Moved)
			deltaJson["_"+d.PrePosition().String()] = []interface{}{"", d.PostPosition(), DeltaMove}
		default:
			return nil, errors.New(fmt.Sprintf("Unknown Delta type detected: %#v", delta))
		}
	}
	return
}
