all: test

clean:
	rm -rf bin
	rm -rf tests/*_easyjson.go
	rm -rf benchmark/*_easyjson.go

build:
	go build -o ./bin/easyjson ./easyjson

generate: build
	bin/easyjson -stubs \
		./tests/snake.go \
		./tests/data.go \
		./tests/omitempty.go \
		./tests/nothing.go \
		./tests/named_type.go \
		./tests/custom_map_key_type.go \
		./tests/embedded_type.go \
		./tests/reference_to_pointer.go \
		./tests/html.go \
		./tests/unknown_fields.go \
		./tests/type_declaration.go \
		./tests/type_declaration_skip.go \
		./tests/members_escaped.go \
		./tests/members_unescaped.go \
		./tests/intern.go \
		./tests/nocopy.go \
		./tests/escaping.go
	bin/easyjson -all \
		./tests/data.go \
 		./tests/nothing.go \
 		./tests/errors.go \
 		./tests/html.go \
 		./tests/type_declaration_skip.go
	bin/easyjson \
		./tests/nested_easy.go \
		./tests/named_type.go \
		./tests/custom_map_key_type.go \
		./tests/embedded_type.go \
		./tests/reference_to_pointer.go \
		./tests/key_marshaler_map.go \
		./tests/unknown_fields.go \
		./tests/type_declaration.go \
		./tests/members_escaped.go \
		./tests/intern.go \
		./tests/nocopy.go \
		./tests/escaping.go \
		./tests/nested_marshaler.go
	bin/easyjson -snake_case ./tests/snake.go
	bin/easyjson -omit_empty ./tests/omitempty.go
	bin/easyjson -build_tags=use_easyjson -disable_members_unescape ./benchmark/data.go
	bin/easyjson -disallow_unknown_fields ./tests/disallow_unknown.go
	bin/easyjson -disable_members_unescape ./tests/members_unescaped.go

test: generate
	go test \
		./tests \
		./jlexer \
		./gen \
		./buffer
	cd benchmark && go test -benchmem -tags use_easyjson -bench .
	golint -set_exit_status ./tests/*_easyjson.go

bench-other: generate
	cd benchmark && make

bench-python:
	benchmark/ujson.sh


.PHONY: clean generate test build
