package csvq

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/query"
)

type CompositeError struct {
	Errors []error
}

func NewCompositeError(errs []error) error {
	return &CompositeError{
		Errors: errs,
	}
}

func (e CompositeError) Error() string {
	list := make([]string, 0, len(e.Errors))
	for _, err := range e.Errors {
		list = append(list, err.Error())
	}
	return strings.Join(list, "\n")
}

type Conn struct {
	dsn                string
	defaultWaitTimeout time.Duration
	retryDelay         time.Duration
	proc               *query.Processor
	id                 int
}

type DSN struct {
	repository     string
	timezone       string
	datetimeFormat string
	ansiQuotes     bool
}

var DSNParseErr = errors.New("incorrect data source name")

func NewConn(ctx context.Context, dsnStr string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Conn, error) {
	dsn, err := ParseDSN(dsnStr)
	if err != nil {
		return nil, driver.ErrBadConn
	}

	sess := getSession()

	tx, err := query.NewTransaction(ctx, defaultWaitTimeout, retryDelay, sess)
	if err != nil {
		return nil, driver.ErrBadConn
	}

	if err := tx.Flags.SetRepository(dsn.repository); err != nil {
		return nil, driver.ErrBadConn
	}
	if err := tx.Flags.SetLocation(dsn.timezone); err != nil {
		return nil, driver.ErrBadConn
	}
	tx.Flags.SetDatetimeFormat(dsn.datetimeFormat)
	tx.Flags.SetAnsiQuotes(dsn.ansiQuotes)

	proc := query.NewProcessor(tx)
	proc.Tx.AutoCommit = true

	return &Conn{
		dsn:  dsnStr,
		proc: proc,
	}, nil
}

func (c *Conn) Close() error {
	var errs []error

	if err := c.proc.AutoRollback(); err != nil {
		errs = append(errs, err)
	}
	if err := c.proc.ReleaseResourcesWithErrors(); err != nil {
		errs = append(errs, err)
	}

	var err error
	switch len(errs) {
	case 0:
		//Do nothing
	case 1:
		err = errs[0]
	default:
		err = NewCompositeError(errs)
	}
	return err
}

func (c *Conn) Prepare(queryString string) (driver.Stmt, error) {
	return c.PrepareContext(context.Background(), queryString)
}

func (c *Conn) PrepareContext(ctx context.Context, queryString string) (driver.Stmt, error) {
	return NewStmt(ctx, c.proc, queryString)
}

func (c *Conn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *Conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	if opts.Isolation != driver.IsolationLevel(sql.LevelDefault) {
		return nil, errors.New("csvq does not support non-default isolation level")
	}
	if opts.ReadOnly {
		return nil, errors.New("csvq does not support read-only transactions")
	}

	return NewTx(c.proc)
}

func (c *Conn) QueryContext(ctx context.Context, queryString string, args []driver.NamedValue) (driver.Rows, error) {
	if err := c.exec(ctx, queryString, args); err != nil {
		return nil, err
	}
	return NewRows(c.proc.Tx.SelectedViews), nil
}

func (c *Conn) ExecContext(ctx context.Context, queryString string, args []driver.NamedValue) (driver.Result, error) {
	if err := c.exec(ctx, queryString, args); err != nil {
		return nil, err
	}
	return NewResult(int64(c.proc.Tx.AffectedRows)), nil
}

func (c *Conn) exec(ctx context.Context, queryString string, args []driver.NamedValue) error {
	if 0 < len(args) {
		var selectedViews []*query.View
		var affectedRows int

		stmt, err := c.PrepareContext(ctx, queryString)
		if err != nil {
			return err
		}
		defer func() {
			_ = stmt.Close()
			c.proc.Tx.SelectedViews = selectedViews
			c.proc.Tx.AffectedRows = affectedRows
		}()

		err = stmt.(*Stmt).exec(ctx, args)
		if err == nil {
			selectedViews = stmt.(*Stmt).proc.Tx.SelectedViews
			affectedRows = stmt.(*Stmt).proc.Tx.AffectedRows
		}
		return err
	}

	statements, _, err := parser.Parse(queryString, "", false, c.proc.Tx.Flags.AnsiQuotes)
	if err != nil {
		return query.NewSyntaxError(err.(*parser.SyntaxError))
	}

	_, err = c.proc.Execute(query.ContextForStoringResults(ctx), statements)
	return err
}

func ParseDSN(dsnStr string) (DSN, error) {
	type parameter struct {
		key   []rune
		value []rune
	}

	readParam := func(r []rune) (parameter, []rune) {
		p := parameter{
			key:   []rune{},
			value: []rune{},
		}

		inKeyStr := true
		inStr := false
		spIdx := 0

		appendChar := func(c rune) {
			if inKeyStr {
				p.key = append(p.key, c)
			} else {
				p.value = append(p.value, c)
			}
		}

		for i := 0; i < len(r); i++ {
			c := r[i]

			if inStr {
				if c == '\\' {
					appendChar(c)
					if i+1 < len(r) {
						appendChar(r[i+1])
						i++
					}
					continue
				}

				if c == '"' {
					inStr = false
				}

				appendChar(c)
				continue
			}

			if c == '&' {
				spIdx = i
				break
			}

			if c == '=' {
				inKeyStr = false
				continue
			}

			if c == '"' {
				inStr = true
			}

			appendChar(c)
		}

		if spIdx < 1 || len(r) <= spIdx+1 {
			return p, nil
		}

		return p, r[spIdx+1:]
	}

	dsn := DSN{
		repository:     "",
		timezone:       "Local",
		datetimeFormat: "",
		ansiQuotes:     false,
	}

	spIdx := strings.Index(dsnStr, "?")
	if spIdx < 0 {
		dsn.repository = dsnStr
		return dsn, nil
	}

	dsnRunes := []rune(dsnStr)

	dsn.repository = string(dsnRunes[0:spIdx])

	var params []parameter
	if spIdx+1 < len(dsnRunes) {
		r := dsnRunes[spIdx+1:]
		for r != nil {
			p, rest := readParam(r)
			params = append(params, p)
			r = rest
		}
	}

	for _, p := range params {
		k := string(p.key)
		v := string(p.value)

		switch strings.ToUpper(k) {
		case "TIMEZONE":
			if 0 < len(v) {
				dsn.timezone = v
			}
		case "DATETIMEFORMAT":
			if 0 < len(v) {
				dsn.datetimeFormat = v
			}
		case "ANSIQUOTES":
			if 0 < len(v) {
				b, err := strconv.ParseBool(v)
				if err != nil {
					return dsn, DSNParseErr
				}
				dsn.ansiQuotes = b
			}
		default:
			return dsn, DSNParseErr
		}
	}

	return dsn, nil
}
