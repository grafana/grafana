package value

import (
	"sync"
)

var stringPool = &sync.Pool{
	New: func() interface{} {
		return &String{}
	},
}

var integerPool = &sync.Pool{
	New: func() interface{} {
		return &Integer{}
	},
}

var floatPool = &sync.Pool{
	New: func() interface{} {
		return &Float{}
	},
}

var datetimePool = &sync.Pool{
	New: func() interface{} {
		return &Datetime{}
	},
}

func getString() *String {
	return stringPool.Get().(*String)
}

func getInteger() *Integer {
	return integerPool.Get().(*Integer)
}

func getFloat() *Float {
	return floatPool.Get().(*Float)
}

func getDatetime() *Datetime {
	return datetimePool.Get().(*Datetime)
}

func Discard(p Primary) {
	if p != nil {
		switch p.(type) {
		case *String:
			stringPool.Put(p)
		case *Integer:
			integerPool.Put(p)
		case *Float:
			floatPool.Put(p)
		case *Datetime:
			datetimePool.Put(p)
		}
	}
}
