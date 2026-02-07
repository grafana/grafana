package util

type Queue interface {
	Append(entry interface{})
	Entries() []interface{}
	Length() int
	Clear()
}
