package internal

import (
	"context"
	"fmt"
	"log"
	"os"
)

type Logging interface {
	Printf(ctx context.Context, format string, v ...interface{})
}

type logger struct {
	log *log.Logger
}

func (l *logger) Printf(ctx context.Context, format string, v ...interface{}) {
	_ = l.log.Output(2, fmt.Sprintf(format, v...))
}

var Logger Logging = &logger{
	log: log.New(os.Stderr, "redis: ", log.LstdFlags|log.Lshortfile),
}
