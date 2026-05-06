package analysis

import "reflect"

var sizeOfMap int
var sizeOfPtr int
var sizeOfString int

func init() {
	var m map[int]int
	sizeOfMap = int(reflect.TypeOf(m).Size())
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var str string
	sizeOfString = int(reflect.TypeOf(str).Size())
}
