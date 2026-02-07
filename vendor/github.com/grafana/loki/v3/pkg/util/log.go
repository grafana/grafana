package util

import (
	"fmt"
	"os"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

type LogAdapter struct {
	log.Logger
}

func NewLogAdapter(l log.Logger) LogAdapter {
	return LogAdapter{
		Logger: l,
	}
}

// Fatal implements tail.logger
func (l LogAdapter) Fatal(v ...interface{}) {
	level.Error(l).Log("msg", fmt.Sprint(v...))
	os.Exit(1)
}

// Fatalf implements tail.logger
func (l LogAdapter) Fatalf(format string, v ...interface{}) {
	level.Error(l).Log("msg", fmt.Sprintf(strings.TrimSuffix(format, "\n"), v...))
	os.Exit(1)
}

// Fatalln implements tail.logger
func (l LogAdapter) Fatalln(v ...interface{}) {
	level.Error(l).Log("msg", fmt.Sprint(v...))
	os.Exit(1)
}

// Panic implements tail.logger
func (l LogAdapter) Panic(v ...interface{}) {
	s := fmt.Sprint(v...)
	level.Error(l).Log("msg", s)
	panic(s)
}

// Panicf implements tail.logger
func (l LogAdapter) Panicf(format string, v ...interface{}) {
	s := fmt.Sprintf(strings.TrimSuffix(format, "\n"), v...)
	level.Error(l).Log("msg", s)
	panic(s)
}

// Panicln implements tail.logger
func (l LogAdapter) Panicln(v ...interface{}) {
	s := fmt.Sprint(v...)
	level.Error(l).Log("msg", s)
	panic(s)
}

// Print implements tail.logger
func (l LogAdapter) Print(v ...interface{}) {
	level.Info(l).Log("msg", fmt.Sprint(v...))
}

// Printf implements tail.logger
func (l LogAdapter) Printf(format string, v ...interface{}) {
	level.Info(l).Log("msg", fmt.Sprintf(strings.TrimSuffix(format, "\n"), v...))
}

// Println implements tail.logger
func (l LogAdapter) Println(v ...interface{}) {
	level.Info(l).Log("msg", fmt.Sprint(v...))
}
