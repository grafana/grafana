# data

## Testing

This package uses [golden files](https://medium.com/soon-london/testing-with-golden-files-in-go-7fccc71c43d3) to verify Arrow serialization.

Add the `update` flag to `go test` to update the golden files:

```
go test -update
```

Make sure you check in any updated golden files.
