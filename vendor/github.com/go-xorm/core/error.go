package core

import "errors"

var (
	ErrNoMapPointer    = errors.New("mp should be a map's pointer")
	ErrNoStructPointer = errors.New("mp should be a struct's pointer")
)
