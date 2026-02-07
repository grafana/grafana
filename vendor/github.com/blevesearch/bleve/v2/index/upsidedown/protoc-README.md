## Instructions for generating new go stubs using upsidedown.proto

1. Download latest of protoc-gen-go
```
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
```

2. To generate `upsidedown.pb.go` using upsdidedown.proto:
```
protoc --go_out=. --go_opt=Mindex/upsidedown/upsidedown.proto=index/upsidedown/ index/upsidedown/upsidedown.proto
```

3. Manually add back Size and MarshalTo methods for BackIndexRowValue, BackIndexTermsEntry, BackIndexStoreEntry to support upside_down.
