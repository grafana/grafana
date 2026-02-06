package sqlmock

type statement struct {
	conn  *sqlmock
	ex    *ExpectedPrepare
	query string
}

func (stmt *statement) Close() error {
	stmt.ex.wasClosed = true
	return stmt.ex.closeErr
}

func (stmt *statement) NumInput() int {
	return -1
}
