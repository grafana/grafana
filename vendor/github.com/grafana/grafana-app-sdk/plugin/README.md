# plugin

This package is meant for usage by a Grafana backend plugin. It contains functionality for working with Kubernetes client configs, routing and error handling.

- [`plugin`](#plugin)
- [`plugin/kubeconfig`](#pluginkubeconfig)
- [`plugin/router`](#pluginrouter)
  - [`router.Router`](#routerrouter)
  - [`router.JSONRouter`](#routerjsonrouter)
  - [`router.ResourceGroupRouter`](#routerresourcegrouprouter)
  - [Middlewares](#middlewares)

## `plugin`

The root package has a custom extended error type that can be used to incorporate and pass around errors paired with status codes, e.g.:
```go
package main

import (
  "errors"
  "fmt"

  "github.com/grafana/grafana-app-sdk/plugin"
)

func main() {
  var err1 error
  err1 := plugin.NewError(http.StatusBadRequest, "bad request!") // Create a new error with a code & message

  generr := errors.New("something went wrong")
  err2 := plugin.WrapError(http.StatusInternalServerError, generr) // Wrap an existing error

  parsed := plugin.FromError(err1) // Parse an existing `error` into a rich error.
  fmt.Println(parsed.Code, parsed.Error)
  fmt.Println(parsed.CleanMessage()) // Will print the error message for non-5xx errors and a generic one for 5xx errors.

  var e plugin.Error
  if errors.As(err1, &e); {
    // You can use stdlib way of dealing with error parsing.
  }

  var knownErr = plugin.NewError(http.StatusBadRequest, "bad request!")
  if errors.Is(someErr, knownErr) {
    // Another way of dispatching errors using stdlib.
  }
}
```

## `plugin/kubeconfig`

`kubeconfig` package contains logic that helps you parse, fetch and use client configs for Kubernetes API, which are used by e.g. Stores.

There's middleware for automatic parsing & loading of configs, functions to write & read them from `context.Context` and a helper function for creating memoizing initializers for code that depends on kubeconfigs.

Note that `kubeconfig` works with a slightly custom type that wraps together the `rest.Config` and the Namespace, for convenience.

By default the middleware expects that both the config and the namespace are present in your plugin's `secureJsonSettings` with keys `kubeconfig` and `kubenamespace` respectively, e.g.:
```json
{
  "kubenamespace": "my-namespace",
  "kubeconfig": "{\"kind\":\"Config\",\"apiVersion\":\"v1\",\"preferences\":{},\"clusters\":[{\"name\":\"cluster\",\"cluster\":{\"server\":\"https://some-url.com\",\"certificate-authority-data\":\"DATA+OMITTED\"}}],\"users\":[{\"name\":\"authn\",\"user\":{\"client-certificate-data\":\"DATA+OMITTED\",\"client-key-data\":\"DATA+OMITTED\"}}],\"contexts\":[{\"name\":\"default\",\"context\":{\"cluster\":\"cluster\",\"user\":\"authn\",\"namespace\":\"default\"}}],\"current-context\":\"default\"}",
}
```

Here's example usage of the package:
```go
package main

import (
  "context"
  "fmt"
  "net/http"
  "os"

  "github.com/grafana/grafana-plugin-sdk-go/backend"
  "github.com/grafana/grafana-app-sdk/crd"
  "github.com/grafana/grafana-app-sdk/plugin"
  "github.com/grafana/grafana-app-sdk/plugin/kubeconfig"
  "github.com/grafana/grafana-app-sdk/plugin/router"
)

var rg = crd.NewResourceGroup("my.resourcegroup.com", "v1")

func main() {
  route :=  router.NewRouter()

  // Set up kubeconfig middleware.
  //
  // It will extract, parse, validate and load kubeconfig and namespace from secureJsonSettings,
  // using default secureJsonSettings keys - "kubeconfig" for config and "kubenamespace" for namespace.
  //
  // Loaded config will be available in the context passed to the handler.
  route.Use(kubeconfig.NewMiddleware())

  route.Handle("/hello", helloHandler, http.MethodGet)
  if err := route.ListenAndServe(); err != nil {
    fmt.Fprintf(os.Stderr, "error serving: %s", err)
    os.Exit(1)
  }

  os.Exit(0)
}

func helloHandler(
  ctx context.Context, req *backend.CallResourceRequest, s backend.CallResourceResponseSender,
) {
  // Grab kubeconfig from the context.
  // If the config isn't there (e.g. you forgot to use the middleware) you'll get an error.
  cfg, err := kubeconfig.FromContext(ctx)
  if err != nil {
    s.Send(plugin.InternalError(err))
    return
  }

  // You can now pass the config to CRD store.
  store, err := crd.NewStore(&cfg.RestConfig, rg)
  if err != nil {
    s.Send(plugin.InternalError(err))
    return
  }

  // And you can use the namespace is store requests.
  obj, err := store.Get(ctx, cfg.Namespace, "hello", "HelloWorld")
  if err != nil {
    s.Send(plugin.InternalError(err))
    return
  }

  res, err := json.Marshal(obj)
  if err != nil {
    s.Send(plugin.InternalError(err))
    return
  }

  s.Send(res)
}

// You can also use a caching initializer to wrap your regular initializer which need kubeconfig.
// CachingInitializer will re-use returned values when the config doesn't change,
// making sure that e.g. stores don't get re-initialised if the config stays the same.
var newStore = kubeconfig.CachingInitializer(func(cfg kubeconfig.NamespacedConfig) (*crd.Store, error) {
  return crd.NewStore(&cfg.RestConfig, rg)
})
func otherHelloHandler(
  ctx context.Context, req *backend.CallResourceRequest, s backend.CallResourceResponseSender,
) {
  cfg, err := kubeconfig.FromContext(ctx)
  if err != nil {
    s.Send(plugin.InternalError(err))
    return
  }

  // You can now pass the config to CRD store.
  store, err := newStore(cfg)
  if err != nil {
    s.Send(plugin.InternalError(err))
    return
  }

  // some code here
}
```

## `plugin/router`

This package contains code for routing requests. It contains routers and middlewares.

### `router.Router`

It can be instantiated by `router.NewRouter()`, is a path-based request router that can interface with grafana's backend plugin SDK to emulate being an HTTP request router.

### `router.JSONRouter`

A JSON router lets you write handlers like regular Go functions, which return a (result, error) pair. It aims to simplify the toil of writing code for handling & marshaling errors and uses `plugin.Error` error type for passing around and inferring response codes.

```go
package main

import (
	"context"
  "errors"
  "fmt"
  "net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-app-sdk/plugin/router"
)

func main() {
  // A JSON router lets you write handlers like regular Go functions, which return a (result, error) pair.
  // In case of JSON router a result is any type that can be serialised into JSON using `json.Marshal`.
  route := router.NewJSONRouter(log.DefaultLogger)

  // You can create subrouters, e.g. for v1 of the API in this case.
  v1Router := p.router.Subroute("v1")

  // Assuming this is our simple response type.
  type Response struct {
    Message string `json:"message"`
  }

  // `HandleResources` is a useful way to set up RESTful route handlers.
  // In this example it will set up CRUDL routes for "todos" resource, like so:
  // GET    /v1/todos      - List
  // POST   /v1/todos      - Create
  // GET    /v1/todos/{id} - Read
  // PUT    /v1/todos/{id} - Update
  // DELETE /v1/todos/{id} - Delete
  v1Router.HandleResource("todos", router.JSONResourceHandler{
    Create: func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
      fmt.Println(r.Method)  // "POST"
      fmt.Println(r.URL)     // This is a url.URL with request URL
      fmt.Println(r.Vars)    // Vars captured from the route. In this case will be empty
      fmt.Println(r.Headers) // Headers from the client
      fmt.Println(r.Body)    // an io.Reader interface with request's body
      fmt.Println(r.Context) // PluginContext struct

      return &Response{
        Message: "Hello!",
      }, nil
    },
    Read: func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
      // This will be returned as a 500
      // and the default error handler will log & obscure the error from the client
      // to prevent error messages from leaking.
      return nil, errors.New("whoops")
    },
    Update: func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
      // This will be returned as a 400
      // and the default error handler will log & forward the message to the client.
      return nil, plugin.NewError(http.StatusBadRequest, "invalid request")
    },
    Delete: func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
      if err := doSomething(r); err != nil {
        // This will be returned as a 404
        // and the default error handler will log & forward the message to the client.
        return nil, plugin.WrapError(http.StatusNotFound, err)
      }

      // This is a valid return value and will be sent to the client as 204 with empty body.
      return nil, nil
    },
    List: func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
      return nil, nil
    },
  })

  // You can use `Handle` to add arbitrary routes with JSON handlers.
  v1Router.Handle("/todos/archive", func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
    return nil, nil
  }, http.MethodPost)

  // Or `HandleWithCode` if you want to specify custom HTTP code for successful responses.
  v1Router.HandleWithCode("/todos/status", func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
    return nil, nil
  }, http.StatusAccepted, http.MethodPut)

  // If you have a regular router that you need to use,
  // you can use `WrapHandlerFunc` to turn your JSON handler into a regular one:
  oldRouter := router.NewRouter()
  oldRouter.Handle(
    "/some/route",
    route.WrapHandlerFunc(func(ctx context.Context, r router.JSONRequest) (router.JSONResponse, error) {
      return nil, nil
    }, http.StatusAccepted),
    http.MethodGet,
  )

  // Custom error response.
  type CustomError struct {
    Message string `json:"message"`
  }

  // You can use `NewJSONRouterWithErrorHandler` if you want to customize error handling.
  // It allows you to pass a custom error handler function,
  // that transforms the parsed error into response code and response body.
  customErr := router.NewJSONRouterWithErrorHandler(log.DefaultLogger, func(err plugin.Error) (int, router.JSONResponse) {
    return err.Code, &CustomError{
      Message: err.CleanMessage(),
    }
  })
}
```

### `router.ResourceGroupRouter`

`ResourceGroupRouter` is a `Router` which already exposes CRUD operations for every resource contained in the given group

It can be instantiated with the following:
- `router.NewResourceGroupRouter(resourceGroup, namespace, restConfig)` with the input parameters being:
  - `resourceGroup` of `crd.ResourceGroup` type, representing the resource group for which we want to have the described operations;
  - `namespace`, string containing the k8s namespace where the resources are saved/retrieved;
  - `restConfig` is the configuration needed in order to initialise a REST client for the resources.
- `router.NewResourceGroupRouterWithStore(resourceGroup, namespace, store)`, if you want to pre-define the store used by this router. The input parameters are:
  - `resourceGroup` of `crd.ResourceGroup` type, as described above;
  - `namespace`, string containing the k8s namespace where the resources are saved/retrieved;
  - `store`, implementing the `plugin.Store` interface, defines the logic of storing the custom resources in k8s. 

The exposed API is structured as follows, for each resource in group:

- `POST {resourceGroup.name}/{resourceGroup.Version}/{resource.plural}` to create a resource;
- `GET {resourceGroup.name}/{resourceGroup.Version}/{resource.plural}` to list all resources;
- `GET {resourceGroup.name}/{resourceGroup.Version}/{resource.plural}/{resource.name}` to get a specific resource given its unique name;
- `PUT {resourceGroup.name}/{resourceGroup.Version}/{resource.plural}/{resource.name}` to update a specific resource given its name. This is a proper PUT operation, so the resource will be completely overwritten;
- `DELETE {resourceGroup.name}/{resourceGroup.Version}/{resource.plural}/{resource.name}` to delete a resource given its name.

### Middlewares

Middlewares allow intercepting requests execution in a `Router`. One can modify or take action upon the incoming request,
or inject information inside the running context.

For example, once an intercept incoming request for logging or emitting metrics related to the request's path, method, etc.
```go
loggingMiddleware := router.MiddlewareFunc(func(next router.HandlerFunc) router.HandlerFunc {
  return func(ctx context.Context, req *backend.CallResourceRequest, res backend.CallResourceResponseSender) {
	log.Printf("Request - %s - %s\n", req.Path, req.Method)
    next(ctx, req, res)
  }
})

// Register the middleware inside the router
route := router.NewRouter()
route.Use(loggingMiddleware)
```

There's another flavour of middleware called `CapturingMiddleware`, which allows one to intercept the response as well,
taking necessary action. Using the same logging example, let's now log the response status code.

```go
loggingMiddleware := router.NewCapturingMiddleware(func(ctx context.Context, req *backend.CallResourceRequest, next router.NextFunc) {
  log.Printf("Incoming Request - %s - %s\n", req.Path, req.Method)
  // Call the downstream middleware chain, returning the resulting backend.CallResourceResponse
  res := next(context.WithValue(ctx, ctxKey{}, "1"))
  log.Printf("Outgoing Request - %s - %s - %d\n", req.Path, req.Method, res.Status)
})

// Register the middleware inside the router
router.Use(loggingMiddleware)
```

A middleware is nothing other that a function with the following signature:
```go
func someMiddleware(router.HandlerFunc) router.HandlerFunc
```
