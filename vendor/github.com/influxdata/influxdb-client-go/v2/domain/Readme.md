# Generated types and API client

`oss.yml`must be periodically synced with latest changes and types and client must be re-generated 
to maintain full compatibility with the latest InfluxDB release


## Install oapi generator
`git clone git@github.com:bonitoo-io/oapi-codegen.git`
`cd oapi-codegen`
`git checkout feat/template_helpers`
`go install ./cmd/oapi-codegen/oapi-codegen.go`

## Download latest swagger
`wget https://raw.githubusercontent.com/influxdata/openapi/master/contracts/oss.yml`
`cd domain`

## Generate
### Generate types
`oapi-codegen -generate types -o types.gen.go -package domain -templates .\templates oss.yml`

### Generate client
`oapi-codegen -generate client -o client.gen.go -package domain -templates .\templates oss.yml`

