# Rebuild the README.md file at repo root by inserting code samples
# from compilable go files.

SHELL=/bin/bash

GOCLOUD_HOME=$(GOPATH)/src/cloud.google.com/go
README=$(GOCLOUD_HOME)/README.md

.PHONY: readme test test-good test-bad-go test-bad-md

readme:
	@tmp=$$(mktemp); \
	awk -f snipmd.awk snippets.go $(README) > $$tmp; \
	mv $$tmp $(README)

diff:
	diff $(README) <(awk -f snipmd.awk snippets.go $(README))

test: test-good test-bad-go test-bad-md
	@echo PASS

test-good:
	@echo testdata/good.md
	@cd testdata >& /dev/null; \
	diff -u want.md <(awk -f ../snipmd.awk snips.go good.md)
	@echo "testdata/want.md (round trip)"
	@cd testdata >& /dev/null; \
	diff -u want.md <(awk -f ../snipmd.awk snips.go want.md)

test-bad-go:
	@for f in testdata/bad-*.go; do \
	    echo $$f; \
	    if awk -f snipmd.awk $$f >& /dev/null; then \
		echo "$f succeeded, want failure"; \
		exit 1; \
	    fi; \
	done

test-bad-md:
	@for f in testdata/bad-*.md; do \
	    echo $$f; \
	    if awk -f snipmd.awk testdata/snips.go $$f >& /dev/null; then \
		echo "$f succeeded, want failure"; \
		exit 1; \
	    fi; \
	done


