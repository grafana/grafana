// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package errors defines shared types for handling CUE errors.
//
// The pivotal error type in CUE packages is the interface type Error.
// The information available in such errors can be most easily retrieved using
// the Path, Positions, and Print functions.
package errors // import "cuelang.org/go/cue/errors"

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mpvl/unique"

	"cuelang.org/go/cue/token"
)

// New is a convenience wrapper for errors.New in the core library.
// It does not return a CUE error.
func New(msg string) error {
	return errors.New(msg)
}

// Unwrap returns the result of calling the Unwrap method on err, if err
// implements Unwrap. Otherwise, Unwrap returns nil.
func Unwrap(err error) error {
	return errors.Unwrap(err)
}

// Is reports whether any error in err's chain matches target.
//
// An error is considered to match a target if it is equal to that target or if
// it implements a method Is(error) bool such that Is(target) returns true.
func Is(err, target error) bool {
	return errors.Is(err, target)
}

// As finds the first error in err's chain that matches the type to which target
// points, and if so, sets the target to its value and returns true. An error
// matches a type if it is assignable to the target type, or if it has a method
// As(interface{}) bool such that As(target) returns true. As will panic if
// target is not a non-nil pointer to a type which implements error or is of
// interface type.
//
// The As method should set the target to its value and return true if err
// matches the type to which target points.
func As(err error, target interface{}) bool {
	return errors.As(err, target)
}

// A Message implements the error interface as well as Message to allow
// internationalized messages. A Message is typically used as an embedding
// in a CUE message.
type Message struct {
	format string
	args   []interface{}
}

// NewMessage creates an error message for human consumption. The arguments
// are for later consumption, allowing the message to be localized at a later
// time. The passed argument list should not be modified.
func NewMessage(format string, args []interface{}) Message {
	return Message{format: format, args: args}
}

// Msg returns a printf-style format string and its arguments for human
// consumption.
func (m *Message) Msg() (format string, args []interface{}) {
	return m.format, m.args
}

func (m *Message) Error() string {
	return fmt.Sprintf(m.format, m.args...)
}

// Error is the common error message.
type Error interface {
	// Position returns the primary position of an error. If multiple positions
	// contribute equally, this reflects one of them.
	Position() token.Pos

	// InputPositions reports positions that contributed to an error, including
	// the expressions resulting in the conflict, as well as values that were
	// the input to this expression.
	InputPositions() []token.Pos

	// Error reports the error message without position information.
	Error() string

	// Path returns the path into the data tree where the error occurred.
	// This path may be nil if the error is not associated with such a location.
	Path() []string

	// Msg returns the unformatted error message and its arguments for human
	// consumption.
	Msg() (format string, args []interface{})
}

// Positions returns all positions returned by an error, sorted
// by relevance when possible and with duplicates removed.
func Positions(err error) []token.Pos {
	e := Error(nil)
	if !errors.As(err, &e) {
		return nil
	}

	a := make([]token.Pos, 0, 3)

	sortOffset := 0
	pos := e.Position()
	if pos.IsValid() {
		a = append(a, pos)
		sortOffset = 1
	}

	for _, p := range e.InputPositions() {
		if p.IsValid() && p != pos {
			a = append(a, p)
		}
	}

	byPos := byPos(a[sortOffset:])
	sort.Sort(byPos)
	k := unique.ToFront(byPos)
	return a[:k+sortOffset]
}

type byPos []token.Pos

func (s *byPos) Truncate(n int)    { (*s) = (*s)[:n] }
func (s byPos) Len() int           { return len(s) }
func (s byPos) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s byPos) Less(i, j int) bool { return comparePos(s[i], s[j]) == -1 }

// Path returns the path of an Error if err is of that type.
func Path(err error) []string {
	if e := Error(nil); errors.As(err, &e) {
		return e.Path()
	}
	return nil
}

// Newf creates an Error with the associated position and message.
func Newf(p token.Pos, format string, args ...interface{}) Error {
	return &posError{
		pos:     p,
		Message: NewMessage(format, args),
	}
}

// Wrapf creates an Error with the associated position and message. The provided
// error is added for inspection context.
func Wrapf(err error, p token.Pos, format string, args ...interface{}) Error {
	pErr := &posError{
		pos:     p,
		Message: NewMessage(format, args),
	}
	return Wrap(pErr, err)
}

// Wrap creates a new error where child is a subordinate error of parent.
// If child is list of Errors, the result will itself be a list of errors
// where child is a subordinate error of each parent.
func Wrap(parent Error, child error) Error {
	if child == nil {
		return parent
	}
	a, ok := child.(list)
	if !ok {
		return &wrapped{parent, child}
	}
	b := make(list, len(a))
	for i, err := range a {
		b[i] = &wrapped{parent, err}
	}
	return b
}

type wrapped struct {
	main Error
	wrap error
}

// Error implements the error interface.
func (e *wrapped) Error() string {
	switch msg := e.main.Error(); {
	case e.wrap == nil:
		return msg
	case msg == "":
		return e.wrap.Error()
	default:
		return fmt.Sprintf("%s: %s", msg, e.wrap)
	}
}

func (e *wrapped) Is(target error) bool {
	return Is(e.main, target)
}

func (e *wrapped) As(target interface{}) bool {
	return As(e.main, target)
}

func (e *wrapped) Msg() (format string, args []interface{}) {
	return e.main.Msg()
}

func (e *wrapped) Path() []string {
	if p := Path(e.main); p != nil {
		return p
	}
	return Path(e.wrap)
}

func (e *wrapped) InputPositions() []token.Pos {
	return append(e.main.InputPositions(), Positions(e.wrap)...)
}

func (e *wrapped) Position() token.Pos {
	if p := e.main.Position(); p != token.NoPos {
		return p
	}
	if wrap, ok := e.wrap.(Error); ok {
		return wrap.Position()
	}
	return token.NoPos
}

func (e *wrapped) Unwrap() error { return e.wrap }

func (e *wrapped) Cause() error { return e.wrap }

// Promote converts a regular Go error to an Error if it isn't already one.
func Promote(err error, msg string) Error {
	switch x := err.(type) {
	case Error:
		return x
	default:
		return Wrapf(err, token.NoPos, "%s", msg)
	}
}

var _ Error = &posError{}

// In an List, an error is represented by an *posError.
// The position Pos, if valid, points to the beginning of
// the offending token, and the error condition is described
// by Msg.
type posError struct {
	pos    token.Pos
	inputs []token.Pos
	Message
}

func (e *posError) Path() []string              { return nil }
func (e *posError) InputPositions() []token.Pos { return e.inputs }
func (e *posError) Position() token.Pos         { return e.pos }

// Append combines two errors, flattening Lists as necessary.
func Append(a, b Error) Error {
	switch x := a.(type) {
	case nil:
		return b
	case list:
		return appendToList(x, b)
	}
	// Preserve order of errors.
	list := appendToList(nil, a)
	list = appendToList(list, b)
	return list
}

// Errors reports the individual errors associated with an error, which is
// the error itself if there is only one or, if the underlying type is List,
// its individual elements. If the given error is not an Error, it will be
// promoted to one.
func Errors(err error) []Error {
	if err == nil {
		return nil
	}
	var listErr list
	var errorErr Error
	switch {
	case As(err, &listErr):
		return listErr
	case As(err, &errorErr):
		return []Error{errorErr}
	default:
		return []Error{Promote(err, "")}
	}
}

func appendToList(a list, err Error) list {
	switch x := err.(type) {
	case nil:
		return a
	case list:
		if a == nil {
			return x
		}
		return append(a, x...)
	default:
		return append(a, err)
	}
}

// list is a list of Errors.
// The zero value for an list is an empty list ready to use.
type list []Error

func (p list) Is(target error) bool {
	for _, e := range p {
		if errors.Is(e, target) {
			return true
		}
	}
	return false
}

func (p list) As(target interface{}) bool {
	for _, e := range p {
		if errors.As(e, target) {
			return true
		}
	}
	return false
}

// AddNewf adds an Error with given position and error message to an List.
func (p *list) AddNewf(pos token.Pos, msg string, args ...interface{}) {
	err := &posError{pos: pos, Message: Message{format: msg, args: args}}
	*p = append(*p, err)
}

// Add adds an Error with given position and error message to an List.
func (p *list) Add(err Error) {
	*p = appendToList(*p, err)
}

// Reset resets an List to no errors.
func (p *list) Reset() { *p = (*p)[:0] }

// List implements the sort Interface.
func (p list) Len() int      { return len(p) }
func (p list) Swap(i, j int) { p[i], p[j] = p[j], p[i] }

func (p list) Less(i, j int) bool {
	if c := comparePos(p[i].Position(), p[j].Position()); c != 0 {
		return c == -1
	}
	// Note that it is not sufficient to simply compare file offsets because
	// the offsets do not reflect modified line information (through //line
	// comments).

	if !equalPath(p[i].Path(), p[j].Path()) {
		return lessPath(p[i].Path(), p[j].Path())
	}
	return p[i].Error() < p[j].Error()
}

func lessOrMore(isLess bool) int {
	if isLess {
		return -1
	}
	return 1
}

func comparePos(a, b token.Pos) int {
	if a.Filename() != b.Filename() {
		return lessOrMore(a.Filename() < b.Filename())
	}
	if a.Line() != b.Line() {
		return lessOrMore(a.Line() < b.Line())
	}
	if a.Column() != b.Column() {
		return lessOrMore(a.Column() < b.Column())
	}
	return 0
}

func lessPath(a, b []string) bool {
	for i, x := range a {
		if i >= len(b) {
			return false
		}
		if x != b[i] {
			return x < b[i]
		}
	}
	return len(a) < len(b)
}

func equalPath(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i, x := range a {
		if x != b[i] {
			return false
		}
	}
	return true
}

// Sanitize sorts multiple errors and removes duplicates on a best effort basis.
// If err represents a single or no error, it returns the error as is.
func Sanitize(err Error) Error {
	if err == nil {
		return nil
	}
	if l, ok := err.(list); ok {
		a := l.sanitize()
		if len(a) == 1 {
			return a[0]
		}
		return a
	}
	return err
}

func (p list) sanitize() list {
	if p == nil {
		return p
	}
	a := make(list, len(p))
	copy(a, p)
	a.Sort()
	a.RemoveMultiples()
	return a
}

// Sort sorts an List. *posError entries are sorted by position,
// other errors are sorted by error message, and before any *posError
// entry.
func (p list) Sort() {
	sort.Sort(p)
}

// RemoveMultiples sorts an List and removes all but the first error per line.
func (p *list) RemoveMultiples() {
	p.Sort()
	var last Error
	i := 0
	for _, e := range *p {
		if last == nil || !approximateEqual(last, e) {
			last = e
			(*p)[i] = e
			i++
		}
	}
	(*p) = (*p)[0:i]
}

func approximateEqual(a, b Error) bool {
	aPos := a.Position()
	bPos := b.Position()
	if aPos == token.NoPos || bPos == token.NoPos {
		return a.Error() == b.Error()
	}
	return aPos.Filename() == bPos.Filename() &&
		aPos.Line() == bPos.Line() &&
		aPos.Column() == bPos.Column() &&
		equalPath(a.Path(), b.Path())
}

// An List implements the error interface.
func (p list) Error() string {
	format, args := p.Msg()
	return fmt.Sprintf(format, args...)
}

// Msg reports the unformatted error message for the first error, if any.
func (p list) Msg() (format string, args []interface{}) {
	switch len(p) {
	case 0:
		return "no errors", nil
	case 1:
		return p[0].Msg()
	}
	return "%s (and %d more errors)", []interface{}{p[0], len(p) - 1}
}

// Position reports the primary position for the first error, if any.
func (p list) Position() token.Pos {
	if len(p) == 0 {
		return token.NoPos
	}
	return p[0].Position()
}

// InputPositions reports the input positions for the first error, if any.
func (p list) InputPositions() []token.Pos {
	if len(p) == 0 {
		return nil
	}
	return p[0].InputPositions()
}

// Path reports the path location of the first error, if any.
func (p list) Path() []string {
	if len(p) == 0 {
		return nil
	}
	return p[0].Path()
}

// Err returns an error equivalent to this error list.
// If the list is empty, Err returns nil.
func (p list) Err() error {
	if len(p) == 0 {
		return nil
	}
	return p
}

// A Config defines parameters for printing.
type Config struct {
	// Format formats the given string and arguments and writes it to w.
	// It is used for all printing.
	Format func(w io.Writer, format string, args ...interface{})

	// Cwd is the current working directory. Filename positions are taken
	// relative to this path.
	Cwd string

	// ToSlash sets whether to use Unix paths. Mostly used for testing.
	ToSlash bool
}

// Print is a utility function that prints a list of errors to w,
// one error per line, if the err parameter is an List. Otherwise
// it prints the err string.
func Print(w io.Writer, err error, cfg *Config) {
	if cfg == nil {
		cfg = &Config{}
	}
	for _, e := range list(Errors(err)).sanitize() {
		printError(w, e, cfg)
	}
}

// Details is a convenience wrapper for Print to return the error text as a
// string.
func Details(err error, cfg *Config) string {
	w := &bytes.Buffer{}
	Print(w, err, cfg)
	return w.String()
}

// String generates a short message from a given Error.
func String(err Error) string {
	w := &strings.Builder{}
	writeErr(w, err)
	return w.String()
}

func writeErr(w io.Writer, err Error) {
	if path := strings.Join(err.Path(), "."); path != "" {
		_, _ = io.WriteString(w, path)
		_, _ = io.WriteString(w, ": ")
	}

	for {
		u := errors.Unwrap(err)

		printed := false
		msg, args := err.Msg()
		s := fmt.Sprintf(msg, args...)
		if s != "" || u == nil { // print at least something
			_, _ = io.WriteString(w, s)
			printed = true
		}

		if u == nil {
			break
		}

		if printed {
			_, _ = io.WriteString(w, ": ")
		}
		err, _ = u.(Error)
		if err == nil {
			fmt.Fprint(w, u)
			break
		}
	}
}

func defaultFprintf(w io.Writer, format string, args ...interface{}) {
	fmt.Fprintf(w, format, args...)
}

func printError(w io.Writer, err error, cfg *Config) {
	if err == nil {
		return
	}
	fprintf := cfg.Format
	if fprintf == nil {
		fprintf = defaultFprintf
	}

	positions := []string{}
	for _, p := range Positions(err) {
		pos := p.Position()
		s := pos.Filename
		if cfg.Cwd != "" {
			if p, err := filepath.Rel(cfg.Cwd, s); err == nil {
				s = p
				// Some IDEs (e.g. VSCode) only recognize a path if it start
				// with a dot. This also helps to distinguish between local
				// files and builtin packages.
				if !strings.HasPrefix(s, ".") {
					s = fmt.Sprintf(".%s%s", string(filepath.Separator), s)
				}
			}
		}
		if cfg.ToSlash {
			s = filepath.ToSlash(s)
		}
		if pos.IsValid() {
			if s != "" {
				s += ":"
			}
			s += fmt.Sprintf("%d:%d", pos.Line, pos.Column)
		}
		if s == "" {
			s = "-"
		}
		positions = append(positions, s)
	}

	if e, ok := err.(Error); ok {
		writeErr(w, e)
	} else {
		fprintf(w, "%v", err)
	}

	if len(positions) == 0 {
		fprintf(w, "\n")
		return
	}

	fprintf(w, ":\n")
	for _, pos := range positions {
		fprintf(w, "    %s\n", pos)
	}
}
