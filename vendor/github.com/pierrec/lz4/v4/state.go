package lz4

import (
	"errors"
	"fmt"
	"io"

	"github.com/pierrec/lz4/v4/internal/lz4errors"
)

//go:generate go run golang.org/x/tools/cmd/stringer -type=aState -output state_gen.go

const (
	noState     aState = iota // uninitialized reader
	errorState                // unrecoverable error encountered
	newState                  // instantiated object
	readState                 // reading data
	writeState                // writing data
	closedState               // all done
)

type (
	aState uint8
	_State struct {
		states []aState
		state  aState
		err    error
	}
)

func (s *_State) init(states []aState) {
	s.states = states
	s.state = states[0]
}

func (s *_State) reset() {
	s.state = s.states[0]
	s.err = nil
}

// next sets the state to the next one unless it is passed a non nil error.
// It returns whether or not it is in error.
func (s *_State) next(err error) bool {
	if err != nil {
		s.err = fmt.Errorf("%s: %w", s.state, err)
		s.state = errorState
		return true
	}
	s.state = s.states[s.state]
	return false
}

// nextd is like next but for defers.
func (s *_State) nextd(errp *error) bool {
	return errp != nil && s.next(*errp)
}

// check sets s in error if not already in error and if the error is not nil or io.EOF,
func (s *_State) check(errp *error) {
	if s.state == errorState || errp == nil {
		return
	}
	if err := *errp; err != nil {
		s.err = fmt.Errorf("%w[%s]", err, s.state)
		if !errors.Is(err, io.EOF) {
			s.state = errorState
		}
	}
}

func (s *_State) fail() error {
	s.state = errorState
	s.err = fmt.Errorf("%w[%s]", lz4errors.ErrInternalUnhandledState, s.state)
	return s.err
}
