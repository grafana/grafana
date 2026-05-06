all : parser.go

parser.go : parser.go.y
	goyacc -o $@ parser.go.y; [ -f y.output ] && ( rm -f y.output )

clean:
	rm -f parser.go
