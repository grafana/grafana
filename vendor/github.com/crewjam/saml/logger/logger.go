package logger

import (
	"log"
	"os"
)

// Interface provides the minimal logging interface
type Interface interface {
	// Printf prints to the logger using the format.
	Printf(format string, v ...interface{})
	// Print prints to the logger.
	Print(v ...interface{})
	// Println prints new line.
	Println(v ...interface{})
	// Fatal is equivalent to Print() followed by a call to os.Exit(1).
	Fatal(v ...interface{})
	// Fatalf is equivalent to Printf() followed by a call to os.Exit(1).
	Fatalf(format string, v ...interface{})
	// Fatalln is equivalent to Println() followed by a call to os.Exit(1).
	Fatalln(v ...interface{})
	// Panic is equivalent to Print() followed by a call to panic().
	Panic(v ...interface{})
	// Panicf is equivalent to Printf() followed by a call to panic().
	Panicf(format string, v ...interface{})
	// Panicln is equivalent to Println() followed by a call to panic().
	Panicln(v ...interface{})
}

// DefaultLogger logs messages to os.Stdout
var DefaultLogger = log.New(os.Stdout, "", log.LstdFlags)
