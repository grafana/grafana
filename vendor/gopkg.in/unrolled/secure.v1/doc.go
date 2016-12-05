/*Package secure is an HTTP middleware for Go that facilitates some quick security wins.

  package main

  import (
      "net/http"

      "github.com/unrolled/secure"  // or "gopkg.in/unrolled/secure.v1"
  )

  var myHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      w.Write([]byte("hello world"))
  })

  func main() {
      secureMiddleware := secure.New(secure.Options{
          AllowedHosts: []string{"www.example.com", "sub.example.com"},
          SSLRedirect:  true,
      })

      app := secureMiddleware.Handler(myHandler)
      http.ListenAndServe("127.0.0.1:3000", app)
  }
*/
package secure
