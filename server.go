package main

import (
	"github.com/gorilla/mux"
	"html/template"
	"log"
	"net/http"
	"os"
)

type App struct {
}

type IndexViewModel struct {
	Title string
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3838"
	}

	log.Println("Starting Grafana-Pro v.1-alpha, listening on port " + port)

	router := mux.NewRouter()
	router.HandleFunc("/", handler)
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./public/")))

	http.Handle("/", router)
	http.ListenAndServe(":"+port, nil)
}

func handler(w http.ResponseWriter, r *http.Request) {
	log.Println("GET /")

	view := template.New("viewTemplate")
	view.Delims("[[", "]]")

	t, err := view.ParseFiles("./views/index.html")
	if err != nil {
		log.Fatal(err)
	}

	t.ExecuteTemplate(w, "index.html", &IndexViewModel{Title: "hello from go"})
}
