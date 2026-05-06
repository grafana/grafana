package timeseries

// LongToMulti converts a LongFrame into a MultiFrame and returns an error if it fails to parse the LongFrame.
func LongToMulti(longFrame *LongFrame) (*MultiFrame, error) {
	collection, err := longFrame.GetCollection(false)
	if err != nil {
		return nil, err
	}

	multiFrame, err := NewMultiFrame(collection.RefID, MultiFrameVersionLatest)
	if err != nil {
		return nil, err
	}

	for _, ref := range collection.Refs {
		multiFrame.addSeriesFields(ref.TimeField, ref.ValueField)
	}
	return multiFrame, nil
}
