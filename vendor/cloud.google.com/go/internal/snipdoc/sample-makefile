# Build doc.go from template and snippets.

SHELL=/bin/bash

../doc.go: build doc-snippets.go doc.template snipdoc.awk
	@tmp=$$(mktemp) && \
	awk -f snipdoc.awk doc-snippets.go doc.template > $$tmp && \
	chmod +w $@ && \
	mv $$tmp $@ && \
	chmod -w $@
	@echo "wrote $@"

.PHONY: build

build:
	go build doc-snippets.go
