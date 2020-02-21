package xorm

import (
	"reflect"

	"xorm.io/core"
)

var (
	ptrPkType = reflect.TypeOf(&core.PK{})
	pkType    = reflect.TypeOf(core.PK{})
)
