package rueidis

import (
	"encoding/binary"
	"encoding/json"
	"math"
	"unsafe"
)

// BinaryString convert the provided []byte into a string without copy. It does what strings.Builder.String() does.
// Redis Strings are binary safe, this means that it is safe to store any []byte into Redis directly.
// Users can use this BinaryString helper to insert a []byte as the part of redis command. For example:
//
//	client.B().Set().Key(rueidis.BinaryString([]byte{0})).Value(rueidis.BinaryString([]byte{0})).Build()
//
// To read back the []byte of the string returned from the Redis, it is recommended to use the RedisMessage.AsReader.
func BinaryString(bs []byte) string {
	return unsafe.String(unsafe.SliceData(bs), len(bs))
}

// VectorString32 convert the provided []float32 into a string. Users can use this to build vector search queries:
//
//	client.B().FtSearch().Index("idx").Query("*=>[KNN 5 @vec $V]").
//	    Params().Nargs(2).NameValue().NameValue("V", rueidis.VectorString32([]float32{1})).
//	    Dialect(2).Build()
func VectorString32(v []float32) string {
	b := make([]byte, len(v)*4)
	for i, e := range v {
		i := i * 4
		binary.LittleEndian.PutUint32(b[i:i+4], math.Float32bits(e))
	}
	return BinaryString(b)
}

// ToVector32 reverts VectorString32. User can use this to convert redis response back to []float32.
func ToVector32(s string) []float32 {
	bs := unsafe.Slice(unsafe.StringData(s), len(s))
	vs := make([]float32, 0, len(bs)/4)
	for i := 0; i < len(bs); i += 4 {
		vs = append(vs, math.Float32frombits(binary.LittleEndian.Uint32(bs[i:i+4])))
	}
	return vs
}

// VectorString64 convert the provided []float64 into a string. Users can use this to build vector search queries:
//
//	client.B().FtSearch().Index("idx").Query("*=>[KNN 5 @vec $V]").
//	    Params().Nargs(2).NameValue().NameValue("V", rueidis.VectorString64([]float64{1})).
//	    Dialect(2).Build()
func VectorString64(v []float64) string {
	b := make([]byte, len(v)*8)
	for i, e := range v {
		i := i * 8
		binary.LittleEndian.PutUint64(b[i:i+8], math.Float64bits(e))
	}
	return BinaryString(b)
}

// ToVector64 reverts VectorString64. User can use this to convert redis response back to []float64.
func ToVector64(s string) []float64 {
	bs := unsafe.Slice(unsafe.StringData(s), len(s))
	vs := make([]float64, 0, len(bs)/8)
	for i := 0; i < len(bs); i += 8 {
		vs = append(vs, math.Float64frombits(binary.LittleEndian.Uint64(bs[i:i+8])))
	}
	return vs
}

// JSON convert the provided parameter into a JSON string. Users can use this JSON helper to work with RedisJSON commands.
// For example:
//
//	client.B().JsonSet().Key("a").Path("$.myField").Value(rueidis.JSON("str")).Build()
func JSON(in any) string {
	bs, err := json.Marshal(in)
	if err != nil {
		panic(err)
	}
	return BinaryString(bs)
}
