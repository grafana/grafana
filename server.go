package main

import "github.com/go-martini/martini"

func main() {
	server := CreateServer()

	server.Run()
}

type GrafanaServer struct {
	*martini.Martini
	martini.Router
}

func CreateServer() *GrafanaServer {
	r := martini.NewRouter()
	m := martini.New()
	m.Use(martini.Logger())
	m.Use(martini.Recovery())
	m.Use(martini.Static("public"))
	m.MapTo(r, (*martini.Routes)(nil))
	m.Action(r.Handle)
	return &GrafanaServer{m, r}
}
