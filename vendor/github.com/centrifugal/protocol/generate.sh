#!/bin/bash

# go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
# go install github.com/planetscale/vtprotobuf/cmd/protoc-gen-go-vtproto@latest
# go install github.com/fatih/gomodifytags@v1.13.0
# go install github.com/FZambia/gomodifytype@latest
# go install github.com/mailru/easyjson/easyjson@latest

which protoc
which gomodifytype
which gomodifytags
protoc-gen-go --version
which protoc-gen-go-vtproto
which easyjson

protoc --go_out=. --plugin protoc-gen-go=${GOBIN}/protoc-gen-go --go-vtproto_out=. \
  --plugin protoc-gen-go-vtproto=${GOBIN}/protoc-gen-go-vtproto \
  --go-vtproto_opt=features=marshal+unmarshal+size \
  client.proto

cp github.com/centrifugal/protocol/client.pb.go client.pb.go
cp github.com/centrifugal/protocol/client_vtproto.pb.go client_vtproto.pb.go
rm -rf github.com

gomodifytype -file client.pb.go -all -w -from "[]byte" -to "Raw"

echo "replacing tags of structs for JSON backwards compatibility..."
gomodifytags -file client.pb.go -field User -struct ClientInfo -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field Client -struct ClientInfo -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field Presence -struct PresenceResult -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field NumClients -struct PresenceStatsResult -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field NumUsers -struct PresenceStatsResult -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field Offset -struct HistoryResult -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field Epoch -struct HistoryResult -all -w -remove-options json=omitempty >/dev/null
gomodifytags -file client.pb.go -field Publications -struct HistoryResult -all -w -remove-options json=omitempty >/dev/null

# compile easy json in separate dir since we are using custom writer here.
mkdir build
cp client.pb.go build/client.pb.go
cp raw.go build/raw.go
cd build
easyjson -all -no_std_marshalers client.pb.go
cd ..
# move compiled to current dir.
cp build/client.pb_easyjson.go ./client.pb_easyjson.go
rm -rf build

# need to replace usage of jwriter.Writer to custom writer.
find . -name 'client.pb_easyjson.go' -print0 | xargs -0 sed -i "" "s/jwriter\.W/w/g"
# need to replace usage of jwriter package constants to local writer constants.
find . -name 'client.pb_easyjson.go' -print0 | xargs -0 sed -i "" "s/jwriter\.N/n/g"
# cleanup formatting.
goimports -w client.pb_easyjson.go

# Copy to definitions folder for docs link backwards compatibility.
cp client.proto definitions/client.proto
