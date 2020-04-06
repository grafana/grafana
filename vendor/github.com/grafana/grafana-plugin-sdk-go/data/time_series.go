package data

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"time"
)

// TimeSeriesType represents the type of time series the schema can be treated as (if any).
type TimeSeriesType int

// TODO: Create and link to Grafana documentation on Long vs Wide
const (
	// TimeSeriesTypeNot means this Frame is not a valid time series. This means it lacks at least
	// one of a time Field and another (value) Field.
	TimeSeriesTypeNot TimeSeriesType = iota

	// TimeSeriesTypeLong means this Frame can be treated as a "Long" time series.
	//
	// A Long series has one or more string Fields, disregards Labels on Fields, and generally
	// repeated time values in the time index.
	TimeSeriesTypeLong

	// TimeSeriesTypeWide means this Frame can be treated as a "Wide" time series.
	//
	// A Wide series has no string fields, should not have repeated time values, and generally
	// uses labels.
	TimeSeriesTypeWide
)

func (t TimeSeriesType) String() string {
	switch t {
	case TimeSeriesTypeLong:
		return "long"
	case TimeSeriesTypeWide:
		return "wide"
	}
	return "not"
}

// TimeSeriesSchema returns the TimeSeriesSchema of the frame. The TimeSeriesSchema's Type
// value will be TimeSeriesNot if it is not a time series.
func (f *Frame) TimeSeriesSchema() (tsSchema TimeSeriesSchema) {
	tsSchema.Type = TimeSeriesTypeNot
	if f.Fields == nil || len(f.Fields) == 0 {
		return
	}

	nonValueIndices := make(map[int]struct{})
	timeIndices := f.TypeIndices(FieldTypeTime, FieldTypeNullableTime)
	if len(timeIndices) == 0 {
		return
	}
	tsSchema.TimeIndex = timeIndices[0]
	nonValueIndices[tsSchema.TimeIndex] = struct{}{}

	tsSchema.TimeIsNullable = f.Fields[tsSchema.TimeIndex].Nullable()

	tsSchema.FactorIndices = f.TypeIndices(FieldTypeString, FieldTypeNullableString)
	for _, factorIdx := range tsSchema.FactorIndices {
		nonValueIndices[factorIdx] = struct{}{}
	}

	for i := range f.Fields {
		if _, ok := nonValueIndices[i]; ok {
			continue
		}
		tsSchema.ValueIndices = append(tsSchema.ValueIndices, i)
	}

	if len(tsSchema.ValueIndices) == 0 {
		return
	}

	if len(tsSchema.FactorIndices) == 0 {
		tsSchema.Type = TimeSeriesTypeWide
		return
	}
	tsSchema.Type = TimeSeriesTypeLong
	return
}

// LongToWide converts a Long formated time series Frame to a Wide format (see TimeSeriesType for descriptions).
// The first Field of type time.Time or *time.Time will be the time index for the series,
// and will be the first field of the outputted longFrame.
//
// During conversion: String Fields in the longFrame become Labels on the Fields of wideFrame. The name of each string Field becomes a label key, and the values of that Field become label values.
// Each unique combination of value Fields and set of Label key/values become a Field of longFrame.
//
// Additionally, if the time index is a *time.Time field, it will become time.Time Field. If a *string Field has nil values, they are equivalent to "" when converted into labels.
//
// An error is returned if any of the following are true:
// The input frame is not a long formated time series frame.
// The input frame's Fields are of length 0.
// The time index is not sorted ascending by time.
// The time index has null values.
//
// With a conversion of Long to Wide, and then back to Long via WideToLong(), the outputted Long Frame
// may not match the original inputted Long frame.
func LongToWide(longFrame *Frame) (*Frame, error) {
	tsSchema := longFrame.TimeSeriesSchema()
	if tsSchema.Type != TimeSeriesTypeLong {
		return nil, fmt.Errorf("can not convert to wide series, expected long format series input but got %s series", tsSchema.Type)
	}

	longLen, err := longFrame.RowLen()
	if err != nil {
		return nil, err
	} else if longLen == 0 {
		return nil, fmt.Errorf("can not convert to wide series, input fields have no rows")
	}

	wideFrame := NewFrame(longFrame.Name, NewField(longFrame.Fields[tsSchema.TimeIndex].Name, nil, []time.Time{}))
	wideFrameRowCounter := 0

	seenFactors := map[string]struct{}{}                      // seen factor combinations
	valueFactorToWideFieldIdx := make(map[int]map[string]int) // value field idx and factors key -> fieldIdx of longFrame (for insertion)
	for _, i := range tsSchema.ValueIndices {                 // initialize nested maps
		valueFactorToWideFieldIdx[i] = make(map[string]int)
	}

	timeAt := func(idx int) (time.Time, error) { // get time.Time regardless if pointer
		val, ok := longFrame.ConcreteAt(tsSchema.TimeIndex, idx)
		if !ok {
			return time.Time{}, fmt.Errorf("can not convert to wide series, input has null time values")
		}
		return val.(time.Time), nil
	}
	lastTime, err := timeAt(0) // set initial time value
	if err != nil {
		return nil, err
	}
	wideFrame.Fields[0].Append(lastTime)

	for longRowIdx := 0; longRowIdx < longLen; longRowIdx++ { // loop over each row of longFrame
		currentTime, err := timeAt(longRowIdx)
		if err != nil {
			return nil, err
		}

		if currentTime.After(lastTime) { // time advance means new row in wideFrame
			wideFrameRowCounter++
			lastTime = currentTime
			for _, field := range wideFrame.Fields {
				// extend all wideFrame Field Vectors for new row. If no value found, it will have zero value
				field.Extend(1)
			}
			wideFrame.Set(0, wideFrameRowCounter, currentTime)
		}

		if currentTime.Before(lastTime) {
			return nil, fmt.Errorf("long series must be sorted ascending by time to be converted")
		}

		sliceKey := make(tupleLabels, len(tsSchema.FactorIndices)) // factor columns idx:value tuples (used for lookup)
		namedKey := make(tupleLabels, len(tsSchema.FactorIndices)) // factor columns name:value tuples (used for labels)

		// build labels
		for i, factorLongFieldIdx := range tsSchema.FactorIndices {
			val, _ := longFrame.ConcreteAt(factorLongFieldIdx, longRowIdx)
			sliceKey[i] = tupleLabel{strconv.FormatInt(int64(factorLongFieldIdx), 10), val.(string)}
			namedKey[i] = tupleLabel{longFrame.Fields[factorLongFieldIdx].Name, val.(string)}
		}
		factorKey, err := sliceKey.MapKey()
		if err != nil {
			return nil, err
		}

		// make new Fields as new factor combinations are found
		if _, ok := seenFactors[factorKey]; !ok {
			currentFieldLen := len(wideFrame.Fields) // first index for the set of factors.
			seenFactors[factorKey] = struct{}{}
			for offset, longFieldIdx := range tsSchema.ValueIndices {
				// a new Field is created for each value Field from inFrame
				labels, err := tupleLablesToLabels(namedKey)
				if err != nil {
					return nil, err
				}
				longField := longFrame.Fields[tsSchema.ValueIndices[offset]]

				newWideField := NewFieldFromFieldType(longField.Type(), wideFrameRowCounter+1)
				newWideField.Name, newWideField.Labels = longField.Name, labels
				wideFrame.Fields = append(wideFrame.Fields, newWideField)

				valueFactorToWideFieldIdx[longFieldIdx][factorKey] = currentFieldLen + offset
			}
		}
		for _, longFieldIdx := range tsSchema.ValueIndices {
			wideFieldIdx := valueFactorToWideFieldIdx[longFieldIdx][factorKey]
			wideFrame.Set(wideFieldIdx, wideFrameRowCounter, longFrame.CopyAt(longFieldIdx, longRowIdx))
		}
	}

	return wideFrame, nil
}

// WideToLong converts a Wide formated time series Frame to a Long formated time series Frame (see TimeSeriesType for descriptions). The first Field of type time.Time or *time.Time in wideFrame will be the time index for the series, and will be the first field of the outputted wideFrame.
//
// During conversion: All the unique keys in all of the Labels across the Fields of wideFrame become string
// Fields with the corresponding name in longFrame. The corresponding Labels values become values in those Fields of longFrame.
// For each unique non-timeIndex Field across the Fields of wideFrame (value fields), a Field of the same type is created in longFrame.
// For each unique set of Labels across the Fields of wideFrame, a row is added to longFrame, and then
// for each unique value Field, the corresponding value Field of longFrame is set.
//
// An error is returned if any of the following are true:
// The input frame is not a wide formated time series frame.
// The input row has no rows.
// The time index not sorted ascending by time.
// The time index has null values.
// Two numeric Fields have the same name but different types.
//
// With a conversion of Wide to Long, and then back to Wide via LongToWide(), the outputted Wide Frame
// may not match the original inputted Wide frame.
func WideToLong(wideFrame *Frame) (*Frame, error) {
	tsSchema := wideFrame.TimeSeriesSchema()
	if tsSchema.Type != TimeSeriesTypeWide {
		return nil, fmt.Errorf("can not convert to long series, expected wide format series input but got %s series", tsSchema.Type)
	}

	wideLen, err := wideFrame.RowLen()
	if err != nil {
		return nil, err
	} else if wideLen == 0 {
		return nil, fmt.Errorf("can not convert to long series, input fields have no rows")
	}

	uniqueValueNames := []string{}                       // unique names of Fields that are value types
	uniqueValueNamesToType := make(map[string]FieldType) // unique value Field names to Field type
	uniqueLabelKeys := make(map[string]struct{})         // unique Label keys, used to build schema
	labelKeyToWideIndices := make(map[string][]int)      // unique label sets to corresponding Field indices of wideFrame

	// Gather schema information from wideFrame required to build longFrame
	for _, vIdx := range tsSchema.ValueIndices {
		wideField := wideFrame.Fields[vIdx]
		if pType, ok := uniqueValueNamesToType[wideField.Name]; ok {
			if wideField.Type() != pType {
				return nil, fmt.Errorf("two fields in input frame may not have the same name but different types, field name %s has type %s but also type %s and field idx %v", wideField.Name, pType, wideField.Type(), vIdx)
			}
		} else {
			uniqueValueNamesToType[wideField.Name] = wideField.Type()
			uniqueValueNames = append(uniqueValueNames, wideField.Name)
		}

		tKey, err := labelsTupleKey(wideField.Labels) // labels to a string, so it can be a map key
		if err != nil {
			return nil, err
		}
		labelKeyToWideIndices[tKey] = append(labelKeyToWideIndices[tKey], vIdx)

		for k := range wideField.Labels {
			uniqueLabelKeys[k] = struct{}{}
		}
	}

	// Sort things for more deterministic output
	sort.Strings(uniqueValueNames)
	sortedUniqueLabelKeys := []string{}
	for k := range labelKeyToWideIndices {
		sortedUniqueLabelKeys = append(sortedUniqueLabelKeys, k)
	}
	sort.Strings(sortedUniqueLabelKeys)
	uniqueFactorNames := make([]string, 0, len(uniqueLabelKeys))
	for k := range uniqueLabelKeys {
		uniqueFactorNames = append(uniqueFactorNames, k)
	}
	sort.Strings(uniqueFactorNames)

	// build new Frame with new schema
	longFrame := NewFrame(wideFrame.Name, // time, value fields..., factor fields (strings)...
		NewField(wideFrame.Fields[tsSchema.TimeIndex].Name, nil, []time.Time{})) // time field is first field

	i := 1
	valueNameToLongFieldIdx := map[string]int{} // valueName -> field index of longFrame
	for _, name := range uniqueValueNames {
		newWideField := NewFieldFromFieldType(uniqueValueNamesToType[name], 0) // create value Fields
		newWideField.Name = name
		longFrame.Fields = append(longFrame.Fields, newWideField)
		valueNameToLongFieldIdx[name] = i
		i++
	}

	factorNameToLongFieldIdx := map[string]int{} // label Key -> field index for label value of longFrame
	for _, name := range uniqueFactorNames {
		longFrame.Fields = append(longFrame.Fields, NewField(name, nil, []string{})) // create factor fields
		factorNameToLongFieldIdx[name] = i
		i++
	}

	// Populate data of longFrame from wideframe
	longFrameCounter := 0
	for wideRowIdx := 0; wideRowIdx < wideLen; wideRowIdx++ { // loop over each row of wideFrame
		time, ok := wideFrame.ConcreteAt(tsSchema.TimeIndex, wideRowIdx)
		if !ok {
			return nil, fmt.Errorf("time may not have nil values")
		}
		for _, labelKey := range sortedUniqueLabelKeys {
			longFrame.Extend(1) // grow each Fields's vector by 1
			longFrame.Set(0, longFrameCounter, time)

			for i, wideFieldIdx := range labelKeyToWideIndices[labelKey] {
				wideField := wideFrame.Fields[wideFieldIdx]
				if i == 0 {
					for k, v := range wideField.Labels {
						longFrame.Set(factorNameToLongFieldIdx[k], longFrameCounter, v)
					}
				}
				longValueFieldIdx := valueNameToLongFieldIdx[wideField.Name]
				longFrame.Set(longValueFieldIdx, longFrameCounter, wideFrame.CopyAt(wideFieldIdx, wideRowIdx))

			}

			longFrameCounter++
		}
	}

	return longFrame, nil
}

// TimeSeriesSchema is information about a Frame's schema. It is populated from
// the Frame's TimeSeriesSchema() method.
type TimeSeriesSchema struct {
	Type           TimeSeriesType // the type of series, as determinted by frame.TimeSeriesSchema()
	TimeIndex      int            // Field index of the time series index
	TimeIsNullable bool           // true if the time index is nullable (of *time.Time)
	ValueIndices   []int          // Field indices of value columns (All fields excluding string fields and the time index)
	FactorIndices  []int          // Field indices of string or *string Fields
}

// tupleLables is an alternative representation of Labels (map[string]string) that can be sorted
// and then marshalled into a consistent string that can be used a map key. All tupleLabel objects
// in tupleLabels should have unique first elements (keys).
type tupleLabels []tupleLabel

// tupleLabel is an element of tupleLabels and should be in the form of [2]{"key", "value"}.
type tupleLabel [2]string

// tupleLabelsToLabels converts tupleLabels to Labels (map[string]string), erroring if there are duplicate keys.
func tupleLablesToLabels(tuples tupleLabels) (Labels, error) {
	labels := make(map[string]string)
	for _, tuple := range tuples {
		if key, ok := labels[tuple[0]]; ok {
			return nil, fmt.Errorf("duplicate key '%v' in lables: %v", key, tuples)
		}
		labels[tuple[0]] = tuple[1]
	}
	return labels, nil
}

// MapKey gets a string key that can be used as a map key.
func (t *tupleLabels) MapKey() (string, error) {
	t.SortBtKey()
	b, err := json.Marshal(t)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Sort tupleLabels by each elements first property (key).
func (t *tupleLabels) SortBtKey() {
	if t == nil {
		return
	}
	sort.Slice((*t)[:], func(i, j int) bool {
		return (*t)[i][0] < (*t)[j][0]
	})
}

// labelsToTupleLabels converts Labels (map[string]string) to tupleLabels.
func labelsToTupleLabels(l Labels) tupleLabels {
	t := make(tupleLabels, 0, len(l))
	for k, v := range l {
		t = append(t, tupleLabel{k, v})
	}
	t.SortBtKey()
	return t
}

// labelsTupleKey gets a string key from Labels.
func labelsTupleKey(l Labels) (string, error) {
	// sorts twice, meh.
	t := labelsToTupleLabels(l)
	return t.MapKey()
}
