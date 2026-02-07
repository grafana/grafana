package data

import "errors"

var (
	ErrorNullTimeValues                   = errors.New("unable to process the data to wide series because input has null time values, make sure all time values are not null")
	ErrorSeriesUnsorted                   = errors.New("unable to process the data because it is not sorted in ascending order by time, please updated your query to sort the data by time if possible")
	ErrorInputFieldsWithoutRows           = errors.New("can not convert to long series, input fields have no rows")
	ErrorInputFieldsWithoutRowsWideSeries = errors.New("can not convert to wide series, input fields have no rows")
)
