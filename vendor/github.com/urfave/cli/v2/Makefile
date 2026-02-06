# NOTE: this Makefile is meant to provide a simplified entry point for humans to
# run all of the critical steps to verify one's changes are harmonious in
# nature. Keeping target bodies to one line each and abstaining from make magic
# are very important so that maintainers and contributors can focus their
# attention on files that are primarily Go.

GO_RUN_BUILD := go run internal/build/build.go

.PHONY: all
all: generate vet test check-binary-size gfmrun yamlfmt v2diff

# NOTE: this is a special catch-all rule to run any of the commands
# defined in internal/build/build.go with optional arguments passed
# via GFLAGS (global flags) and FLAGS (command-specific flags), e.g.:
#
#   $ make test GFLAGS='--packages cli'
%:
	$(GO_RUN_BUILD) $(GFLAGS) $* $(FLAGS)

.PHONY: docs
docs:
	mkdocs build

.PHONY: serve-docs
serve-docs:
	mkdocs serve
