package mssql

import (
	"log"
)

type Logger interface {
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

type optionalLogger struct {
	logger Logger
}

func (o optionalLogger) Printf(format string, v ...interface{}) {
	if o.logger != nil {
		o.logger.Printf(format, v...)
	} else {
		log.Printf(format, v...)
	}
}

func (o optionalLogger) Println(v ...interface{}) {
	if o.logger != nil {
		o.logger.Println(v...)
	} else {
		log.Println(v...)
	}
}
