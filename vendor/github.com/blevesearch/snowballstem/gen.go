package snowballstem

// to regenerate these commands, run
// go run gengen.go /path/to/snowball/algorithms/directory

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/arabic/stem_Unicode.sbl -go -o arabic/arabic_stemmer -gop arabic -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w arabic/arabic_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/danish/stem_ISO_8859_1.sbl -go -o danish/danish_stemmer -gop danish -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w danish/danish_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/dutch/stem_ISO_8859_1.sbl -go -o dutch/dutch_stemmer -gop dutch -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w dutch/dutch_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/english/stem_ISO_8859_1.sbl -go -o english/english_stemmer -gop english -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w english/english_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/finnish/stem_ISO_8859_1.sbl -go -o finnish/finnish_stemmer -gop finnish -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w finnish/finnish_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/french/stem_ISO_8859_1.sbl -go -o french/french_stemmer -gop french -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w french/french_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/german/stem_ISO_8859_1.sbl -go -o german/german_stemmer -gop german -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w german/german_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/hungarian/stem_Unicode.sbl -go -o hungarian/hungarian_stemmer -gop hungarian -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w hungarian/hungarian_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/irish/stem_ISO_8859_1.sbl -go -o irish/irish_stemmer -gop irish -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w irish/irish_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/italian/stem_ISO_8859_1.sbl -go -o italian/italian_stemmer -gop italian -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w italian/italian_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/norwegian/stem_ISO_8859_1.sbl -go -o norwegian/norwegian_stemmer -gop norwegian -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w norwegian/norwegian_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/porter/stem_ISO_8859_1.sbl -go -o porter/porter_stemmer -gop porter -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w porter/porter_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/portuguese/stem_ISO_8859_1.sbl -go -o portuguese/portuguese_stemmer -gop portuguese -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w portuguese/portuguese_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/romanian/stem_Unicode.sbl -go -o romanian/romanian_stemmer -gop romanian -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w romanian/romanian_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/russian/stem_Unicode.sbl -go -o russian/russian_stemmer -gop russian -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w russian/russian_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/spanish/stem_ISO_8859_1.sbl -go -o spanish/spanish_stemmer -gop spanish -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w spanish/spanish_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/swedish/stem_ISO_8859_1.sbl -go -o swedish/swedish_stemmer -gop swedish -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w swedish/swedish_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/tamil/stem_Unicode.sbl -go -o tamil/tamil_stemmer -gop tamil -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w tamil/tamil_stemmer.go

//go:generate $SNOWBALL/snowball $SNOWBALL/algorithms/turkish/stem_Unicode.sbl -go -o turkish/turkish_stemmer -gop turkish -gor github.com/blevesearch/snowballstem
//go:generate gofmt -s -w turkish/turkish_stemmer.go
