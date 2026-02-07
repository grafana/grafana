package textseg

//go:generate go run make_tables.go -output tables.go
//go:generate go run make_test_tables.go -output tables_test.go
//go:generate ruby unicode2ragel.rb --url=https://www.unicode.org/Public/15.0.0/ucd/auxiliary/GraphemeBreakProperty.txt -m GraphemeCluster -p "Prepend,CR,LF,Control,Extend,Regional_Indicator,SpacingMark,L,V,T,LV,LVT,ZWJ" -o grapheme_clusters_table.rl
//go:generate ruby unicode2ragel.rb --url=https://www.unicode.org/Public/15.0.0/ucd/emoji/emoji-data.txt -m Emoji -p "Extended_Pictographic" -o emoji_table.rl
//go:generate ragel -Z grapheme_clusters.rl
//go:generate gofmt -w grapheme_clusters.go
