package query

import (
	"context"
)

type VirtualTerminal interface {
	ReadLine() (string, error)
	Write(string) error
	WriteError(string) error
	SetPrompt(ctx context.Context)
	SetContinuousPrompt(ctx context.Context)
	SaveHistory(string) error
	Teardown() error
	GetSize() (int, int, error)
	ReloadConfig() error
	UpdateCompleter()
}
