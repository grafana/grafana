package data

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"time"
)

// TimeSeriesType represents the type of time series the schema can be treated as (if any).
//
// Deprecated: this type will be replaced with FrameType and FrameType#IsTimeSeries()
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

// FillMode is an integer type denoting how missing values should be filled.
type FillMode int

const (
	// FillModePrevious fills with the last seen value unless that does not exist, in which case it fills with null.
	FillModePrevious FillMode = iota
	// FillModeNull fills with null
	FillModeNull
	// FillModeValue fills with a specific value
	FillModeValue
)

// FillMissing is a struct containing the fill mode and the fill value if fill mode is FillModeValue
type FillMissing struct {
	Mode  FillMode
	Value float64
}

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
// Deprecated
func (f *Frame) TimeSeriesSchema() TimeSeriesSchema {
	var tsSchema TimeSeriesSchema
	tsSchema.Type = TimeSeriesTypeNot
	if len(f.Fields) == 0 {
		return tsSchema
	}

	nonValueIndices := make(map[int]struct{})
	timeIndices := f.TypeIndices(FieldTypeTime, FieldTypeNullableTime)
	if len(timeIndices) == 0 {
		return tsSchema
	}
	tsSchema.TimeIndex = timeIndices[0]
	nonValueIndices[tsSchema.TimeIndex] = struct{}{}

	tsSchema.TimeIsNullable = f.Fields[tsSchema.TimeIndex].Nullable()

	tsSchema.FactorIndices = f.TypeIndices(FieldTypeString, FieldTypeNullableString, FieldTypeBool, FieldTypeNullableBool)
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
		return tsSchema
	}

	if len(tsSchema.FactorIndices) == 0 {
		tsSchema.Type = TimeSeriesTypeWide
		return tsSchema
	}
	tsSchema.Type = TimeSeriesTypeLong
	return tsSchema
}

// float64ToType converts a float64 value to the specified field type.
// This is useful if fill missing is enabled and fill missing mode is FillMissingValue,
// for converting the fill missing value (float64) to the field type.
func float64ToType(val float64, ftype FieldType) (interface{}, error) {
	switch ftype {
	case FieldTypeInt8:
		return int8(val), nil
	case FieldTypeNullableInt8:
		c := int8(val)
		return &c, nil
	case FieldTypeInt16:
		return int16(val), nil
	case FieldTypeNullableInt16:
		c := int16(val)
		return &c, nil
	case FieldTypeInt32:
		return int32(val), nil
	case FieldTypeNullableInt32:
		c := int32(val)
		return &c, nil
	case FieldTypeInt64:
		return int64(val), nil
	case FieldTypeNullableInt64:
		c := int64(val)
		return &c, nil
	case FieldTypeUint8:
		return uint8(val), nil
	case FieldTypeNullableUint8:
		c := uint8(val)
		return &c, nil
	case FieldTypeUint16:
		return uint16(val), nil
	case FieldTypeNullableUint16:
		c := uint16(val)
		return &c, nil
	case FieldTypeUint32:
		return uint32(val), nil
	case FieldTypeNullableUint32:
		c := uint32(val)
		return &c, nil
	case FieldTypeUint64:
		return uint64(val), nil
	case FieldTypeNullableUint64:
		c := uint64(val)
		return &c, nil
	case FieldTypeFloat32:
		return float32(val), nil
	case FieldTypeNullableFloat32:
		c := float32(val)
		return &c, nil
	case FieldTypeFloat64:
		return val, nil
	case FieldTypeNullableFloat64:
		return &val, nil
	}
	// if field type is FieldTypeString, FieldTypeNullableString, FieldTypeBool, FieldTypeNullableBool, FieldTypeTime, FieldTypeNullableTime
	return val, fmt.Errorf("no numeric value")
}

// GetMissing returns the value to be filled for a missing row field.
func GetMissing(fillMissing *FillMissing, field *Field, previousRowIdx int) (interface{}, error) {
	if fillMissing == nil {
		return nil, fmt.Errorf("fill missing is disabled")
	}
	var fillVal interface{}
	switch fillMissing.Mode {
	case FillModeNull:
	//	fillVal = nil
	case FillModeValue:
		convertedVal, err := float64ToType(fillMissing.Value, field.Type())
		if err != nil {
			return nil, err
		}
		fillVal = convertedVal
	case FillModePrevious:
		// if there is no previous value
		// the value will be null
		if previousRowIdx >= 0 {
			fillVal = field.At(previousRowIdx)
		}
	}
	return fillVal, nil
}

// LongToWide converts a Long formatted time series Frame to a Wide format (see TimeSeriesType for descriptions).
// The first Field of type time.Time or *time.Time will be the time index for the series,
// and will be the first field of the outputted longFrame.
//
// During conversion: String and bool Fields in the longFrame become Labels on the Fields of wideFrame. The name of each string or bool Field becomes a label key, and the values of that Field become label values.
// Each unique combination of value Fields and set of Label key/values become a Field of longFrame.
//
// Additionally, if the time index is a *time.Time field, it will become time.Time Field. If a *string Field has nil values, they are equivalent to "" when converted into labels.
//
// Finally, the Meta field of the result Wide Frame is pointing to the reference of the Meta field of the input Long Frame.
//
// An error is returned if any of the following are true:
// The input frame is not a long formatted time series frame.
// The input frame's Fields are of length 0.
// The time index is not sorted ascending by time.
// The time index has null values.
//
// With a conversion of Long to Wide, and then back to Long via WideToLong(), the outputted Long Frame
// may not match the original inputted Long frame.
func LongToWide(longFrame *Frame, fillMissing *FillMissing) (*Frame, error) {
	tsSchema := longFrame.TimeSeriesSchema()
	if tsSchema.Type != TimeSeriesTypeLong {
		return nil, fmt.Errorf("can not convert to wide series, expected long format series input but got %s series", tsSchema.Type)
	}

	longLen, err := longFrame.RowLen()
	if err != nil {
		return nil, err
	}
	if longLen == 0 {
		return nil, ErrorInputFieldsWithoutRowsWideSeries
	}

	wideFrame := NewFrame(longFrame.Name, NewField(longFrame.Fields[tsSchema.TimeIndex].Name, nil, []time.Time{}))
	wideFrame.Meta = longFrame.Meta

	sortKeys := make([]string, len(tsSchema.FactorIndices))
	for i, v := range tsSchema.FactorIndices { // set dimension key order for final sort
		sortKeys[i] = longFrame.Fields[v].Name
	}

	lastTime, err := timeAt(0, longFrame, tsSchema) // set initial time value
	if err != nil {
		return nil, err
	}
	wideFrame.Fields[0].Append(lastTime)

	valueFactorToWideFieldIdx := make(map[int]map[string]int) // value field idx and factors key -> fieldIdx of longFrame (for insertion)
	for _, i := range tsSchema.ValueIndices {                 // initialize nested maps
		valueFactorToWideFieldIdx[i] = make(map[string]int)
	}
	proc := longRowProcessor{
		lastTime:                  lastTime,
		wideFrame:                 wideFrame,
		longFrame:                 longFrame,
		tsSchema:                  tsSchema,
		fillMissing:               fillMissing,
		seenFactors:               map[string]struct{}{},
		valueFactorToWideFieldIdx: valueFactorToWideFieldIdx,
	}
	for longRowIdx := 0; longRowIdx < longLen; longRowIdx++ { // loop over each row of longFrame
		if err := proc.process(longRowIdx); err != nil {
			return nil, err
		}
	}

	err = SortWideFrameFields(wideFrame, sortKeys...)
	if err != nil {
		return nil, err
	}

	if wideFrame.Meta == nil {
		wideFrame.Meta = &FrameMeta{}
	}
	wideFrame.Meta.Type = FrameTypeTimeSeriesWide

	// Setting the TypeVersion to greater than [0, 0] (along with Meta.Type being set) indicates that the produced
	// frame follows the dataplane contract (see https://grafana.com/developers/dataplane/ and https://github.com/grafana/dataplane).
	// https://grafana.com/developers/dataplane/timeseries#time-series-wide-format-timeserieswide defines TimeSeriesWide in dataplane.
	wideFrame.Meta.TypeVersion = FrameTypeVersion{0, 1}
	return wideFrame, nil
}

type longRowProcessor struct {
	lastTime            time.Time
	wideFrameRowCounter int
	wideFrame           *Frame
	longFrame           *Frame
	tsSchema            TimeSeriesSchema
	fillMissing         *FillMissing
	// seen factor combinations
	seenFactors map[string]struct{}
	// value field idx and factors key -> fieldIdx of longFrame (for insertion)
	valueFactorToWideFieldIdx map[int]map[string]int
}

func (p *longRowProcessor) process(longRowIdx int) error {
	currentTime, err := timeAt(longRowIdx, p.longFrame, p.tsSchema)
	if err != nil {
		return err
	}

	if currentTime.After(p.lastTime) { // time advance means new row in wideFrame
		p.wideFrameRowCounter++
		p.lastTime = currentTime
		for wideFrameIdx, field := range p.wideFrame.Fields {
			// extend all wideFrame Field Vectors for new row. If no value found, it will have zero value
			field.Extend(1)
			if wideFrameIdx == 0 {
				p.wideFrame.Set(wideFrameIdx, p.wideFrameRowCounter, currentTime)
				continue
			}
			fillVal, err := GetMissing(p.fillMissing, field, p.wideFrameRowCounter-1)
			if err == nil {
				p.wideFrame.Set(wideFrameIdx, p.wideFrameRowCounter, fillVal)
			}
		}
	}

	if currentTime.Before(p.lastTime) {
		return ErrorSeriesUnsorted
	}

	sliceKey := make(tupleLabels, len(p.tsSchema.FactorIndices)) // factor columns idx:value tuples (used for lookup)
	namedKey := make(tupleLabels, len(p.tsSchema.FactorIndices)) // factor columns name:value tuples (used for labels)

	// build labels
	for i, factorLongFieldIdx := range p.tsSchema.FactorIndices {
		val, _ := p.longFrame.ConcreteAt(factorLongFieldIdx, longRowIdx)
		var strVal string
		switch v := val.(type) {
		case string:
			strVal = v
		case bool:
			if v {
				strVal = "true"
			} else {
				strVal = "false"
			}
		default:
			return fmt.Errorf(
				"unexpected type, want a string or bool but got type %T for '%v'", val, val)
		}
		sliceKey[i] = tupleLabel{strconv.FormatInt(int64(factorLongFieldIdx), 10), strVal}
		namedKey[i] = tupleLabel{p.longFrame.Fields[factorLongFieldIdx].Name, strVal}
	}
	factorKey, err := sliceKey.MapKey()
	if err != nil {
		return err
	}

	// make new Fields as new factor combinations are found
	if _, ok := p.seenFactors[factorKey]; !ok {
		currentFieldLen := len(p.wideFrame.Fields) // first index for the set of factors.
		p.seenFactors[factorKey] = struct{}{}
		for offset, longFieldIdx := range p.tsSchema.ValueIndices {
			// a new Field is created for each value Field from inFrame
			labels, err := tupleLablesToLabels(namedKey)
			if err != nil {
				return err
			}
			longField := p.longFrame.Fields[p.tsSchema.ValueIndices[offset]]

			newWideField := NewFieldFromFieldType(longField.Type(), p.wideFrameRowCounter+1)
			if p.fillMissing != nil && p.fillMissing.Mode != FillModeValue {
				// if fillMissing mode is null or previous
				// the new wide field should be nullable
				// because some cells can be null
				newWideField = NewFieldFromFieldType(longField.Type().NullableType(), p.wideFrameRowCounter+1)
			}
			newWideField.Name, newWideField.Labels = longField.Name, labels
			p.wideFrame.Fields = append(p.wideFrame.Fields, newWideField)

			fillVal, err := GetMissing(p.fillMissing, newWideField, p.wideFrameRowCounter-1)
			if err == nil {
				for i := 0; i < p.wideFrameRowCounter; i++ {
					p.wideFrame.Set(currentFieldLen+offset, i, fillVal)
				}
			}

			p.valueFactorToWideFieldIdx[longFieldIdx][factorKey] = currentFieldLen + offset
		}
	}
	for _, longFieldIdx := range p.tsSchema.ValueIndices {
		wideFieldIdx := p.valueFactorToWideFieldIdx[longFieldIdx][factorKey]
		if p.wideFrame.Fields[wideFieldIdx].Nullable() && !p.longFrame.Fields[longFieldIdx].Nullable() {
			p.wideFrame.SetConcrete(wideFieldIdx, p.wideFrameRowCounter, p.longFrame.CopyAt(longFieldIdx, longRowIdx))
			continue
		}
		p.wideFrame.Set(wideFieldIdx, p.wideFrameRowCounter, p.longFrame.CopyAt(longFieldIdx, longRowIdx))
	}

	return nil
}

func timeAt(idx int, longFrame *Frame, tsSchema TimeSeriesSchema) (time.Time, error) { // get time.Time regardless if pointer
	val, ok := longFrame.ConcreteAt(tsSchema.TimeIndex, idx)
	if !ok {
		return time.Time{}, ErrorNullTimeValues
	}
	return val.(time.Time), nil
}

// WideToLong converts a Wide formatted time series Frame to a Long formatted time series Frame (see TimeSeriesType for descriptions). The first Field of type time.Time or *time.Time in wideFrame will be the time index for the series, and will be the first field of the outputted wideFrame.
//
// During conversion: All the unique keys in all of the Labels across the Fields of wideFrame become string
// Fields with the corresponding name in longFrame. The corresponding Labels values become values in those Fields of longFrame.
// For each unique non-timeIndex Field across the Fields of wideFrame (value fields), a Field of the same type is created in longFrame.
// For each unique set of Labels across the Fields of wideFrame, a row is added to longFrame, and then
// for each unique value Field, the corresponding value Field of longFrame is set.
//
// Finally, the Meta field of the result Long Frame is pointing to the reference of the Meta field of the input Wide Frame.
//
// An error is returned if any of the following are true:
// The input frame is not a wide formatted time series frame.
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
		return nil, ErrorInputFieldsWithoutRows
	}

	var uniqueValueNames []string                        // unique names of Fields that are value types
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
	var sortedUniqueLabelKeys []string
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
	longFrame.Meta = wideFrame.Meta

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
		tm, ok := wideFrame.ConcreteAt(tsSchema.TimeIndex, wideRowIdx)
		if !ok {
			return nil, fmt.Errorf("time may not have nil values")
		}
		for _, labelKey := range sortedUniqueLabelKeys {
			longFrame.Extend(1) // grow each Fields's vector by 1
			longFrame.Set(0, longFrameCounter, tm)

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

	if longFrame.Meta == nil {
		longFrame.SetMeta(&FrameMeta{})
	}
	longFrame.Meta.Type = FrameTypeTimeSeriesLong
	return longFrame, nil
}

// TimeSeriesSchema is information about a Frame's schema. It is populated from
// the Frame's TimeSeriesSchema() method.
type TimeSeriesSchema struct {
	Type           TimeSeriesType // the type of series, as determinted by frame.TimeSeriesSchema()
	TimeIndex      int            // Field index of the time series index
	TimeIsNullable bool           // true if the time index is nullable (of *time.Time)
	ValueIndices   []int          // Field indices of value columns (All fields excluding string fields and the time index)
	FactorIndices  []int          // Field indices of string, *string, bool, or *bool Fields
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

// SortWideFrameFields sorts the order of a wide time series Frame's Fields.
// If the frame is not a WideFrame, then an error is returned.
//
// The Time that is the time index (the first time field of the original frame) is sorted first.
// Then Fields are sorted by their name followed by the order of the label keys provided.
// If no keys are provided, they are sorted by the string representation of their labels.
func SortWideFrameFields(frame *Frame, keys ...string) error {
	tsSchema := frame.TimeSeriesSchema()
	if tsSchema.Type != TimeSeriesTypeWide {
		return fmt.Errorf("field sorting for a wide time series frame called on a series that is not a wide frame")
	}

	// Capture and remove the time index, will be prepended again after sort
	timeIndexField := frame.Fields[tsSchema.TimeIndex]
	frame.Fields[len(frame.Fields)-1], frame.Fields[tsSchema.TimeIndex] = frame.Fields[tsSchema.TimeIndex], (frame.Fields)[len(frame.Fields)-1]
	frame.Fields = frame.Fields[:len(frame.Fields)-1]

	sort.SliceStable(frame.Fields, func(i, j int) bool {
		iField := frame.Fields[i]
		jField := frame.Fields[j]

		if iField.Name < jField.Name {
			return true
		}
		if iField.Name > jField.Name {
			return false
		}

		// If here Names are equal, next sort based on if there are labels.

		if iField.Labels == nil && jField.Labels == nil {
			return true // no labels first
		}
		if iField.Labels == nil && jField.Labels != nil {
			return true
		}
		if iField.Labels != nil && jField.Labels == nil {
			return false
		}

		// String based sort of Fields if no keys specified (suboptimal).
		if len(keys) == 0 {
			return iField.Labels.String() < jField.Labels.String()
		}

		// Sort on specified
		for _, k := range keys {
			// If the specified key is missing, we sort as if it is was there with the default value of "".
			iV := iField.Labels[k]
			jV := jField.Labels[k]

			if iV < jV {
				return true
			}
			if iV > jV {
				return false
			}
		}

		return false
	})

	// restore the time index back as the first field
	frame.Fields = append(Fields{timeIndexField}, frame.Fields...)

	return nil
}
