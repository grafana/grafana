# Status

This is a convenience package for users of `gogo/protobuf` to be able to use
their `gogo/protobuf` generated message easily and transparently with the
gRPC status error structure.

It requires [Go gRPC version 1.11](https://github.com/grpc/grpc-go/releases/tag/v1.11.0)
or above to successfully transmit statuses over the gRPC transport.

## Use

Use as you would the normal `grpc/status` package:

```go
return status.Error(codes.NotFound, "no such user")
```

```go
st := status.New(codes.FailedPrecondition, "wrong user role")
detSt, err := st.WithDetails(&rpc.BadRequest{
    FieldViolations: []*rpc.BadRequest_FieldViolation{
        {
            Field:       "role",
            Description: "The first user created must have the role of an ADMIN",
        },
    },
})
if err == nil {
    return detSt.Err()
}
return st.Err()
```

## License

The code is 95% copied from the official gRPC status package, so the gRPC
License applies.

### Changes

The changes applied include changing the use of the
`golang/protobuf` packages to `gogo/protobuf`, and changing the
generated files from `google.golang.org/genproto/googleapis` to
`github.com/gogo/googleapis/`.

We've also created an implicit interface fulfilled by all `gogo/status`
errors, for use with `grpc/status` and the gRPC runtime libraries.
