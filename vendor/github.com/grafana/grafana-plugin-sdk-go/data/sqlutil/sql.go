package sqlutil

import (
	"database/sql"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// FrameFromRows returns a new Frame populated with the data from rows. The field types
// will be nullable ([]*T) if the SQL column is nullable or if the nullable property is unknown.
// Otherwise, the field types will be non-nullable ([]T) types.
//
// The number of rows scanned is limited to rowLimit. If maxRows is reached, then a data.Notice with a warning severity
// will be attached to the frame. If rowLimit is less than 0, there is no limit.
//
// Fields will be named to match name of the SQL columns.
//
// A converter must be supplied in order to support data types that are scanned from sql.Rows, but not supported in data.Frame.
// The converter defines what type to use for scanning, what type to place in the data frame, and a function for converting from one to the other.
// If you find yourself here after upgrading, you can continue to your StringConverters here by using the `ToConverters` function.
func FrameFromRows(rows *sql.Rows, rowLimit int64, converters ...Converter) (*data.Frame, error) {
	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	// If there is a dynamic converter, we need to use the dynamic framer
	// and remove the dynamic converter from the list of converters ( it is not valid, just a flag )
	if isDynamic, converters := removeDynamicConverter(converters); isDynamic {
		rows := Rows{itr: rows}
		return frameDynamic(rows, rowLimit, types, converters)
	}

	names, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	scanRow, err := MakeScanRow(types, names, converters...)
	if err != nil {
		return nil, err
	}

	frame := NewFrame(names, scanRow.Converters...)

	var i int64

outer:
	for i < rowLimit {
		// first iterate over rows may be nop if not switched result set to next
		for rows.Next() {
			r := scanRow.NewScannableRow()
			if err := rows.Scan(r...); err != nil {
				return nil, err
			}

			if err := Append(frame, r, scanRow.Converters...); err != nil {
				return nil, err
			}

			i++
			if i == rowLimit {
				frame.AppendNotices(data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     fmt.Sprintf("Results have been limited to %v because the SQL row limit was reached", rowLimit),
				})
				break outer
			}
		}

		if !rows.NextResultSet() {
			break
		}
	}

	if err := rows.Err(); err != nil {
		return frame, backend.DownstreamError(err)
	}

	return frame, nil
}
