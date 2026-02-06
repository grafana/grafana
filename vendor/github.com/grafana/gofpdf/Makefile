all : documentation

documentation : doc/index.html doc.go README.md 

cov : all
	go test -v -coverprofile=coverage && go tool cover -html=coverage -o=coverage.html

check :
	golint .
	go vet -all .
	gofmt -s -l .
	goreportcard-cli -v | grep -v cyclomatic

README.md : doc/document.md
	pandoc --read=markdown --write=gfm < $< > $@

doc/index.html : doc/document.md doc/html.txt
	pandoc --read=markdown --write=html --template=doc/html.txt \
		--metadata pagetitle="GoFPDF Document Generator" < $< > $@

doc.go : doc/document.md doc/go.awk
	pandoc --read=markdown --write=plain $< | awk --assign=package_name=gofpdf --file=doc/go.awk > $@
	gofmt -s -w $@

build :
	go build -v

clean :
	rm -f coverage.html coverage doc/index.html doc.go README.md
