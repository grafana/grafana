Note: this code is still in alpha stage. It *works* but it may change subtley in
the near future, depending on what comes out of
https://github.com/golang/go/issues/52607.

# wrap

Wrap contains a single method for wrapping one Go error with another.

```go
// With returns an error that represents top wrapped over bottom.
// Unwrap will unwrap the top error first, until it runs out of wrapped
// errors, and then return the bottom error. This is also the order that
// Is and As will read the wrapped errors.
// The returned error's message will read as
// fmt.Sprintf("%s: %s", top.Error(), bottom.Error()).
func With(bottom, top error) error {
```

Both the top and bottom errors will be visible to errors.Is and errors.As. this
makes it easy to add and retrieve metadata on an existing error without
squashing the rest of the data in the error. This is especially useful for
adding sentinel errors. For example, you can add a categorization like NotFound
or PermissionDenied to a lower level error. Or you can use it as an upward
context to send side channel data back up the chain to be used in logging or
metrics.

## Use Cases

The main use case for this function is incredibly common, and I've seen it in
basically every go application I've ever written. You have a package that
returns a domain-specific error, like a postgres driver returning pq.ErrNoRows.
You want to pass that error up the stack to maintain the context of the original
error, but you don't want your callers to have to know about postgres errors in
order to know how to deal with this error from your storage layer. With the
proposed `With` function, you can add metadata via a well-known error type so
that the error your function returns can be checked consistently, regardless of
the underlying implementation.

```go
// SetUserName sets the name of the user with the given id. This method returns 
// flags.NotFound if the user isn't found or flags.Conflict if a user with that
// name already exists. 
func (st *Storage) SetUserName(id uuid.UUID, name string) error {
    err := st.db.SetUser(id, "name="+name)
    if errors.Is(err, pq.ErrNoRows) {
       return nil, errors.With(err, flags.NotFound)
    }
    var pqErr *pq.Error
    if errors.As(err, &pqErr) && pqErr.Constraint == "unique_user_name" {
        return errors.With(err, flags.Conflict)
    }
    if err != nil {
       // some other unknown error
       return fmt.Errorf("error setting name on user with id %v: %w", err) 
    }
    return nil
}
```

This keeps the error categorization very near to the code that produces the
error. Nobody outside of SetUserName needs to know anything about postgres
driver errors. 

Now in the API layer, you can translate this error to an HTTP error code
trivially:

```go 
func (h *Handlers) HandleSetName(w http.ResponseWriter, r *http.Request) {
    name, id := getNameAndID(r)
    err := h.storage.SetUserName(id, name)
    if err != nil {
        handleError(err, w)
        return
    }
    // other stuff
}

func handleError(err error, w http.ResponseWriter) {
    switch {
    case errors.Is(err, flags.NotFound):
        http.Error(w, 404, "not found")
    case errors.Is(err, flags.Conflict):
        http.Error(w, 409, "conflict")
    default:
        // other, uncategorized error
        http.Error(w, 500, "internal server error")
        // probably log it, too
    }
}
```

This code doesn't know anything about postgres. It uses the standard errors.Is
to check for errors it knows about. But if it then decides to log that error, it
has full access to the original error's full context if it wants to dig into it
or just log it.

This code is very insulated from any implementation changes to the storage
layer, so long as it maintains its API contract by continuing to categorize the
errors with the same error flags using errors.With. 