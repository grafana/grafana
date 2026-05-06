package sqlparser

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/mfridman/interpolate"
)

type Direction string

const (
	DirectionUp   Direction = "up"
	DirectionDown Direction = "down"
)

func FromBool(b bool) Direction {
	if b {
		return DirectionUp
	}
	return DirectionDown
}

func (d Direction) String() string {
	return string(d)
}

func (d Direction) ToBool() bool {
	return d == DirectionUp
}

type parserState int

const (
	start                   parserState = iota // 0
	gooseUp                                    // 1
	gooseStatementBeginUp                      // 2
	gooseStatementEndUp                        // 3
	gooseDown                                  // 4
	gooseStatementBeginDown                    // 5
	gooseStatementEndDown                      // 6
)

type stateMachine struct {
	state   parserState
	verbose bool
}

func newStateMachine(begin parserState, verbose bool) *stateMachine {
	return &stateMachine{
		state:   begin,
		verbose: verbose,
	}
}

func (s *stateMachine) get() parserState {
	return s.state
}

func (s *stateMachine) set(new parserState) {
	s.print("set %d => %d", s.state, new)
	s.state = new
}

const (
	grayColor  = "\033[90m"
	resetColor = "\033[00m"
)

func (s *stateMachine) print(msg string, args ...interface{}) {
	msg = "StateMachine: " + msg
	if s.verbose {
		log.Printf(grayColor+msg+resetColor, args...)
	}
}

const scanBufSize = 4 * 1024 * 1024

var bufferPool = sync.Pool{
	New: func() interface{} {
		buf := make([]byte, scanBufSize)
		return &buf
	},
}

// Split given SQL script into individual statements and return
// SQL statements for given direction (up=true, down=false).
//
// The base case is to simply split on semicolons, as these
// naturally terminate a statement.
//
// However, more complex cases like pl/pgsql can have semicolons
// within a statement. For these cases, we provide the explicit annotations
// 'StatementBegin' and 'StatementEnd' to allow the script to
// tell us to ignore semicolons.
func ParseSQLMigration(r io.Reader, direction Direction, debug bool) (stmts []string, useTx bool, err error) {
	scanBufPtr := bufferPool.Get().(*[]byte)
	scanBuf := *scanBufPtr
	defer bufferPool.Put(scanBufPtr)

	scanner := bufio.NewScanner(r)
	scanner.Buffer(scanBuf, scanBufSize)

	stateMachine := newStateMachine(start, debug)
	useTx = true
	useEnvsub := false

	var buf bytes.Buffer
	for scanner.Scan() {
		line := scanner.Text()
		if debug {
			log.Println(line)
		}
		if stateMachine.get() == start && strings.TrimSpace(line) == "" {
			continue
		}

		// Check for annotations.
		// All annotations must be in format: "-- +goose [annotation]"
		if strings.HasPrefix(strings.TrimSpace(line), "--") && strings.Contains(line, "+goose") {
			var cmd annotation

			cmd, err = extractAnnotation(line)
			if err != nil {
				return nil, false, fmt.Errorf("failed to parse annotation line %q: %w", line, err)
			}

			switch cmd {
			case annotationUp:
				switch stateMachine.get() {
				case start:
					stateMachine.set(gooseUp)
				default:
					return nil, false, fmt.Errorf("duplicate '-- +goose Up' annotations; stateMachine=%d, see https://github.com/pressly/goose#sql-migrations", stateMachine.state)
				}
				continue

			case annotationDown:
				switch stateMachine.get() {
				case gooseUp, gooseStatementEndUp:
					// If we hit a down annotation, but the buffer is not empty, we have an unfinished SQL query from a
					// previous up annotation. This is an error, because we expect the SQL query to be terminated by a semicolon
					// and the buffer to have been reset.
					if bufferRemaining := strings.TrimSpace(buf.String()); len(bufferRemaining) > 0 {
						return nil, false, missingSemicolonError(stateMachine.state, direction, bufferRemaining)
					}
					stateMachine.set(gooseDown)
				default:
					return nil, false, fmt.Errorf("must start with '-- +goose Up' annotation, stateMachine=%d, see https://github.com/pressly/goose#sql-migrations", stateMachine.state)
				}
				continue

			case annotationStatementBegin:
				switch stateMachine.get() {
				case gooseUp, gooseStatementEndUp:
					stateMachine.set(gooseStatementBeginUp)
				case gooseDown, gooseStatementEndDown:
					stateMachine.set(gooseStatementBeginDown)
				default:
					return nil, false, fmt.Errorf("'-- +goose StatementBegin' must be defined after '-- +goose Up' or '-- +goose Down' annotation, stateMachine=%d, see https://github.com/pressly/goose#sql-migrations", stateMachine.state)
				}
				continue

			case annotationStatementEnd:
				switch stateMachine.get() {
				case gooseStatementBeginUp:
					stateMachine.set(gooseStatementEndUp)
				case gooseStatementBeginDown:
					stateMachine.set(gooseStatementEndDown)
				default:
					return nil, false, errors.New("'-- +goose StatementEnd' must be defined after '-- +goose StatementBegin', see https://github.com/pressly/goose#sql-migrations")
				}

			case annotationNoTransaction:
				useTx = false
				continue

			case annotationEnvsubOn:
				useEnvsub = true
				continue

			case annotationEnvsubOff:
				useEnvsub = false
				continue

			default:
				return nil, false, fmt.Errorf("unknown annotation: %q", cmd)
			}
		}
		// Once we've started parsing a statement the buffer is no longer empty,
		// we keep all comments up until the end of the statement (the buffer will be reset).
		// All other comments in the file are ignored.
		if buf.Len() == 0 {
			// This check ensures leading comments and empty lines prior to a statement are ignored.
			if strings.HasPrefix(strings.TrimSpace(line), "--") || line == "" {
				stateMachine.print("ignore comment")
				continue
			}
		}
		switch stateMachine.get() {
		case gooseStatementEndDown, gooseStatementEndUp:
			// Do not include the "+goose StatementEnd" annotation in the final statement.
		default:
			if useEnvsub {
				expanded, err := interpolate.Interpolate(&envWrapper{}, line)
				if err != nil {
					return nil, false, fmt.Errorf("variable substitution failed: %w:\n%s", err, line)
				}
				line = expanded
			}
			// Write SQL line to a buffer.
			if _, err := buf.WriteString(line + "\n"); err != nil {
				return nil, false, fmt.Errorf("failed to write to buf: %w", err)
			}
		}
		// Read SQL body one by line, if we're in the right direction.
		//
		// 1) basic query with semicolon; 2) psql statement
		//
		// Export statement once we hit end of statement.
		switch stateMachine.get() {
		case gooseUp, gooseStatementBeginUp, gooseStatementEndUp:
			if direction == DirectionDown {
				buf.Reset()
				stateMachine.print("ignore down")
				continue
			}
		case gooseDown, gooseStatementBeginDown, gooseStatementEndDown:
			if direction == DirectionUp {
				buf.Reset()
				stateMachine.print("ignore up")
				continue
			}
		default:
			return nil, false, fmt.Errorf("failed to parse migration: unexpected state %d on line %q, see https://github.com/pressly/goose#sql-migrations", stateMachine.state, line)
		}

		switch stateMachine.get() {
		case gooseUp:
			if endsWithSemicolon(line) {
				stmts = append(stmts, cleanupStatement(buf.String()))
				buf.Reset()
				stateMachine.print("store simple Up query")
			}
		case gooseDown:
			if endsWithSemicolon(line) {
				stmts = append(stmts, cleanupStatement(buf.String()))
				buf.Reset()
				stateMachine.print("store simple Down query")
			}
		case gooseStatementEndUp:
			stmts = append(stmts, cleanupStatement(buf.String()))
			buf.Reset()
			stateMachine.print("store Up statement")
			stateMachine.set(gooseUp)
		case gooseStatementEndDown:
			stmts = append(stmts, cleanupStatement(buf.String()))
			buf.Reset()
			stateMachine.print("store Down statement")
			stateMachine.set(gooseDown)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, false, fmt.Errorf("failed to scan migration: %w", err)
	}
	// EOF

	switch stateMachine.get() {
	case start:
		return nil, false, errors.New("failed to parse migration: must start with '-- +goose Up' annotation, see https://github.com/pressly/goose#sql-migrations")
	case gooseStatementBeginUp, gooseStatementBeginDown:
		return nil, false, errors.New("failed to parse migration: missing '-- +goose StatementEnd' annotation")
	}

	if bufferRemaining := strings.TrimSpace(buf.String()); len(bufferRemaining) > 0 {
		return nil, false, missingSemicolonError(stateMachine.state, direction, bufferRemaining)
	}

	return stmts, useTx, nil
}

type annotation string

const (
	annotationUp             annotation = "Up"
	annotationDown           annotation = "Down"
	annotationStatementBegin annotation = "StatementBegin"
	annotationStatementEnd   annotation = "StatementEnd"
	annotationNoTransaction  annotation = "NO TRANSACTION"
	annotationEnvsubOn       annotation = "ENVSUB ON"
	annotationEnvsubOff      annotation = "ENVSUB OFF"
)

var supportedAnnotations = map[annotation]struct{}{
	annotationUp:             {},
	annotationDown:           {},
	annotationStatementBegin: {},
	annotationStatementEnd:   {},
	annotationNoTransaction:  {},
	annotationEnvsubOn:       {},
	annotationEnvsubOff:      {},
}

var (
	errEmptyAnnotation   = errors.New("empty annotation")
	errInvalidAnnotation = errors.New("invalid annotation")
)

// extractAnnotation extracts the annotation from the line.
// All annotations must be in format: "-- +goose [annotation]"
// Allowed annotations: Up, Down, StatementBegin, StatementEnd, NO TRANSACTION, ENVSUB ON, ENVSUB OFF
func extractAnnotation(line string) (annotation, error) {
	// If line contains leading whitespace - return error.
	if strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t") {
		return "", fmt.Errorf("%q contains leading whitespace: %w", line, errInvalidAnnotation)
	}

	// Extract the annotation from the line, by removing the leading "--"
	cmd := strings.ReplaceAll(line, "--", "")

	// Extract the annotation from the line, by removing the leading "+goose"
	cmd = strings.Replace(cmd, "+goose", "", 1)

	if strings.Contains(cmd, "+goose") {
		return "", fmt.Errorf("%q contains multiple '+goose' annotations: %w", cmd, errInvalidAnnotation)
	}

	// Remove leading and trailing whitespace from the annotation command.
	cmd = strings.TrimSpace(cmd)

	if cmd == "" {
		return "", errEmptyAnnotation
	}

	a := annotation(cmd)

	for s := range supportedAnnotations {
		if strings.EqualFold(string(s), string(a)) {
			return s, nil
		}
	}

	return "", fmt.Errorf("%q not supported: %w", cmd, errInvalidAnnotation)
}

func missingSemicolonError(state parserState, direction Direction, s string) error {
	return fmt.Errorf("failed to parse migration: state %d, direction: %v: unexpected unfinished SQL query: %q: missing semicolon?",
		state,
		direction,
		s,
	)
}

type envWrapper struct{}

var _ interpolate.Env = (*envWrapper)(nil)

func (e *envWrapper) Get(key string) (string, bool) {
	return os.LookupEnv(key)
}

func cleanupStatement(input string) string {
	return strings.TrimSpace(input)
}

// Checks the line to see if the line has a statement-ending semicolon
// or if the line contains a double-dash comment.
func endsWithSemicolon(line string) bool {
	scanBufPtr := bufferPool.Get().(*[]byte)
	scanBuf := *scanBufPtr
	defer bufferPool.Put(scanBufPtr)

	prev := ""
	scanner := bufio.NewScanner(strings.NewReader(line))
	scanner.Buffer(scanBuf, scanBufSize)
	scanner.Split(bufio.ScanWords)

	for scanner.Scan() {
		word := scanner.Text()
		if strings.HasPrefix(word, "--") {
			break
		}
		prev = word
	}

	return strings.HasSuffix(prev, ";")
}
