// +build gofuzz

package securecookie

var hashKey = []byte("very-secret12345")
var blockKey = []byte("a-lot-secret1234")
var s = New(hashKey, blockKey)

type Cookie struct {
	B bool
	I int
	S string
}

func Fuzz(data []byte) int {
	datas := string(data)
	var c Cookie
	if err := s.Decode("fuzz", datas, &c); err != nil {
		return 0
	}
	if _, err := s.Encode("fuzz", c); err != nil {
		panic(err)
	}
	return 1
}
