# This Makefile pulls the latest oglematchers (with dependencies),
# rewrites the imports to match this location,
# and ensures that all the tests pass.
# BTW, things used from oglematchers: Contains, Equals, DeepEquals, GreaterThan, LessThan, GreaterOrEqual, LessOrEqual

test:
	go test github.com/smartystreets/assertions/...

update: clear clone rewrite trim

clear:
	rm -rf ogle*
	rm -rf reqtrace
	rm -rf go-render

clone:
	git clone https://github.com/jacobsa/oglematchers.git && rm -rf oglematchers/.git
	git clone https://github.com/luci/go-render.git && rm -rf go-render/.git

rewrite:
	grep -rl --exclude Makefile 'github.com/jacobsa' . | xargs sed -i '' 's#github.com/jacobsa#github.com/smartystreets/assertions/internal#g'

trim:
	git checkout oglematchers/contains.go # This file diverged at 6acd0337
	rm oglematchers/*_test.go
	rm oglematchers/any.go
	rm oglematchers/all_of.go
	rm oglematchers/elements_are.go
	rm oglematchers/error.go
	rm oglematchers/has_same_type_as.go
	rm oglematchers/has_substr.go
	rm oglematchers/identical_to.go
	rm oglematchers/matches_regexp.go
	rm oglematchers/new_matcher.go
	rm oglematchers/panics.go
	rm oglematchers/pointee.go
	rm go-render/render/*_test.go
