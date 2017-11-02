// +build genhostinfo

package main

import (
	"fmt"
	"reflect"
	"sync"

	"github.com/gocql/gocql"
)

func gen(clause, field string) {
	fmt.Printf("if h.%s == %s {\n", field, clause)
	fmt.Printf("\th.%s = from.%s\n", field, field)
	fmt.Println("}")
}

func main() {
	t := reflect.ValueOf(&gocql.HostInfo{}).Elem().Type()
	mu := reflect.TypeOf(sync.RWMutex{})

	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Type == mu {
			continue
		}

		switch f.Type.Kind() {
		case reflect.Slice:
			gen("nil", f.Name)
		case reflect.String:
			gen(`""`, f.Name)
		case reflect.Int:
			gen("0", f.Name)
		case reflect.Struct:
			gen("("+f.Type.Name()+"{})", f.Name)
		case reflect.Bool, reflect.Int32:
			continue
		default:
			panic(fmt.Sprintf("unknown field: %s", f))
		}
	}

}
