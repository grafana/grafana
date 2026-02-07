fmtcheck:
	"$(CURDIR)/scripts/gofmtcheck.sh"

fmtfix:
	gofmt -w ./

vetcheck:
	go vet ./...

copyrightcheck:
	go run github.com/hashicorp/copywrite@latest headers --plan

copyrightfix:
	go run github.com/hashicorp/copywrite@latest headers

check: copyrightcheck vetcheck fmtcheck

fix: copyrightfix fmtfix
