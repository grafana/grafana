package main

import (
	"time"

	"github.com/gopherjs/gopherjs/js"
)

var _ = time.Sleep // Force "time" package to be imported but let time.Time and time.Unix be DCEed since they're not used.

func main() {
	// Excercise externalization of Go struct (with its special handling of time.Time).
	js.Global.Get("console").Call("log", struct{ S string }{"externalization ok"})

	// Excercise internalization of JavaScript Date object (with its special handling of time.Time).
	date := js.Global.Get("Date").New("2015-08-29T20:56:00.869Z").Interface()
	js.Global.Set("myDate", date)
	js.Global.Get("console").Call("log", js.Global.Get("myDate").Call("toUTCString"))
}
