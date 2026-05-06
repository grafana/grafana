package pgx

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"github.com/jackc/pgx/v5/internal/pgio"
	"github.com/jackc/pgx/v5/pgconn"
)

// CopyFromRows returns a CopyFromSource interface over the provided rows slice
// making it usable by *Conn.CopyFrom.
func CopyFromRows(rows [][]any) CopyFromSource {
	return &copyFromRows{rows: rows, idx: -1}
}

type copyFromRows struct {
	rows [][]any
	idx  int
}

func (ctr *copyFromRows) Next() bool {
	ctr.idx++
	return ctr.idx < len(ctr.rows)
}

func (ctr *copyFromRows) Values() ([]any, error) {
	return ctr.rows[ctr.idx], nil
}

func (ctr *copyFromRows) Err() error {
	return nil
}

// CopyFromSlice returns a CopyFromSource interface over a dynamic func
// making it usable by *Conn.CopyFrom.
func CopyFromSlice(length int, next func(int) ([]any, error)) CopyFromSource {
	return &copyFromSlice{next: next, idx: -1, len: length}
}

type copyFromSlice struct {
	next func(int) ([]any, error)
	idx  int
	len  int
	err  error
}

func (cts *copyFromSlice) Next() bool {
	cts.idx++
	return cts.idx < cts.len
}

func (cts *copyFromSlice) Values() ([]any, error) {
	values, err := cts.next(cts.idx)
	if err != nil {
		cts.err = err
	}
	return values, err
}

func (cts *copyFromSlice) Err() error {
	return cts.err
}

// CopyFromFunc returns a CopyFromSource interface that relies on nxtf for values.
// nxtf returns rows until it either signals an 'end of data' by returning row=nil and err=nil,
// or it returns an error. If nxtf returns an error, the copy is aborted.
func CopyFromFunc(nxtf func() (row []any, err error)) CopyFromSource {
	return &copyFromFunc{next: nxtf}
}

type copyFromFunc struct {
	next     func() ([]any, error)
	valueRow []any
	err      error
}

func (g *copyFromFunc) Next() bool {
	g.valueRow, g.err = g.next()
	// only return true if valueRow exists and no error
	return g.valueRow != nil && g.err == nil
}

func (g *copyFromFunc) Values() ([]any, error) {
	return g.valueRow, g.err
}

func (g *copyFromFunc) Err() error {
	return g.err
}

// CopyFromSource is the interface used by *Conn.CopyFrom as the source for copy data.
type CopyFromSource interface {
	// Next returns true if there is another row and makes the next row data
	// available to Values(). When there are no more rows available or an error
	// has occurred it returns false.
	Next() bool

	// Values returns the values for the current row.
	Values() ([]any, error)

	// Err returns any error that has been encountered by the CopyFromSource. If
	// this is not nil *Conn.CopyFrom will abort the copy.
	Err() error
}

type copyFrom struct {
	conn          *Conn
	tableName     Identifier
	columnNames   []string
	rowSrc        CopyFromSource
	readerErrChan chan error
	mode          QueryExecMode
}

func (ct *copyFrom) run(ctx context.Context) (int64, error) {
	if ct.conn.copyFromTracer != nil {
		ctx = ct.conn.copyFromTracer.TraceCopyFromStart(ctx, ct.conn, TraceCopyFromStartData{
			TableName:   ct.tableName,
			ColumnNames: ct.columnNames,
		})
	}

	quotedTableName := ct.tableName.Sanitize()
	cbuf := &bytes.Buffer{}
	for i, cn := range ct.columnNames {
		if i != 0 {
			cbuf.WriteString(", ")
		}
		cbuf.WriteString(quoteIdentifier(cn))
	}
	quotedColumnNames := cbuf.String()

	var sd *pgconn.StatementDescription
	switch ct.mode {
	case QueryExecModeExec, QueryExecModeSimpleProtocol:
		// These modes don't support the binary format. Before the inclusion of the
		// QueryExecModes, Conn.Prepare was called on every COPY operation to get
		// the OIDs. These prepared statements were not cached.
		//
		// Since that's the same behavior provided by QueryExecModeDescribeExec,
		// we'll default to that mode.
		ct.mode = QueryExecModeDescribeExec
		fallthrough
	case QueryExecModeCacheStatement, QueryExecModeCacheDescribe, QueryExecModeDescribeExec:
		var err error
		sd, err = ct.conn.getStatementDescription(
			ctx,
			ct.mode,
			fmt.Sprintf("select %s from %s", quotedColumnNames, quotedTableName),
		)
		if err != nil {
			return 0, fmt.Errorf("statement description failed: %w", err)
		}
	default:
		return 0, fmt.Errorf("unknown QueryExecMode: %v", ct.mode)
	}

	r, w := io.Pipe()
	doneChan := make(chan struct{})

	go func() {
		defer close(doneChan)

		// Purposely NOT using defer w.Close(). See https://github.com/golang/go/issues/24283.
		buf := ct.conn.wbuf

		buf = append(buf, "PGCOPY\n\377\r\n\000"...)
		buf = pgio.AppendInt32(buf, 0)
		buf = pgio.AppendInt32(buf, 0)

		moreRows := true
		for moreRows {
			var err error
			moreRows, buf, err = ct.buildCopyBuf(buf, sd)
			if err != nil {
				w.CloseWithError(err)
				return
			}

			if ct.rowSrc.Err() != nil {
				w.CloseWithError(ct.rowSrc.Err())
				return
			}

			if len(buf) > 0 {
				_, err = w.Write(buf)
				if err != nil {
					w.Close()
					return
				}
			}

			buf = buf[:0]
		}

		w.Close()
	}()

	commandTag, err := ct.conn.pgConn.CopyFrom(ctx, r, fmt.Sprintf("copy %s ( %s ) from stdin binary;", quotedTableName, quotedColumnNames))

	r.Close()
	<-doneChan

	if ct.conn.copyFromTracer != nil {
		ct.conn.copyFromTracer.TraceCopyFromEnd(ctx, ct.conn, TraceCopyFromEndData{
			CommandTag: commandTag,
			Err:        err,
		})
	}

	return commandTag.RowsAffected(), err
}

func (ct *copyFrom) buildCopyBuf(buf []byte, sd *pgconn.StatementDescription) (bool, []byte, error) {
	const sendBufSize = 65536 - 5 // The packet has a 5-byte header
	lastBufLen := 0
	largestRowLen := 0

	for ct.rowSrc.Next() {
		lastBufLen = len(buf)

		values, err := ct.rowSrc.Values()
		if err != nil {
			return false, nil, err
		}
		if len(values) != len(ct.columnNames) {
			return false, nil, fmt.Errorf("expected %d values, got %d values", len(ct.columnNames), len(values))
		}

		buf = pgio.AppendInt16(buf, int16(len(ct.columnNames)))
		for i, val := range values {
			buf, err = encodeCopyValue(ct.conn.typeMap, buf, sd.Fields[i].DataTypeOID, val)
			if err != nil {
				return false, nil, err
			}
		}

		rowLen := len(buf) - lastBufLen
		if rowLen > largestRowLen {
			largestRowLen = rowLen
		}

		// Try not to overflow size of the buffer PgConn.CopyFrom will be reading into. If that happens then the nature of
		// io.Pipe means that the next Read will be short. This can lead to pathological send sizes such as 65531, 13, 65531
		// 13, 65531, 13, 65531, 13.
		if len(buf) > sendBufSize-largestRowLen {
			return true, buf, nil
		}
	}

	return false, buf, nil
}

// CopyFrom uses the PostgreSQL copy protocol to perform bulk data insertion. It returns the number of rows copied and
// an error.
//
// CopyFrom requires all values use the binary format. A pgtype.Type that supports the binary format must be registered
// for the type of each column. Almost all types implemented by pgx support the binary format.
//
// Even though enum types appear to be strings they still must be registered to use with CopyFrom. This can be done with
// Conn.LoadType and pgtype.Map.RegisterType.
func (c *Conn) CopyFrom(ctx context.Context, tableName Identifier, columnNames []string, rowSrc CopyFromSource) (int64, error) {
	ct := &copyFrom{
		conn:          c,
		tableName:     tableName,
		columnNames:   columnNames,
		rowSrc:        rowSrc,
		readerErrChan: make(chan error),
		mode:          c.config.DefaultQueryExecMode,
	}

	return ct.run(ctx)
}
