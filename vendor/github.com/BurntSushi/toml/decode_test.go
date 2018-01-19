package toml

import (
	"fmt"
	"log"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestDecodeSimple(t *testing.T) {
	var testSimple = `
age = 250
andrew = "gallant"
kait = "brady"
now = 1987-07-05T05:45:00Z
yesOrNo = true
pi = 3.14
colors = [
	["red", "green", "blue"],
	["cyan", "magenta", "yellow", "black"],
]

[My.Cats]
plato = "cat 1"
cauchy = "cat 2"
`

	type cats struct {
		Plato  string
		Cauchy string
	}
	type simple struct {
		Age     int
		Colors  [][]string
		Pi      float64
		YesOrNo bool
		Now     time.Time
		Andrew  string
		Kait    string
		My      map[string]cats
	}

	var val simple
	_, err := Decode(testSimple, &val)
	if err != nil {
		t.Fatal(err)
	}

	now, err := time.Parse("2006-01-02T15:04:05", "1987-07-05T05:45:00")
	if err != nil {
		panic(err)
	}
	var answer = simple{
		Age:     250,
		Andrew:  "gallant",
		Kait:    "brady",
		Now:     now,
		YesOrNo: true,
		Pi:      3.14,
		Colors: [][]string{
			{"red", "green", "blue"},
			{"cyan", "magenta", "yellow", "black"},
		},
		My: map[string]cats{
			"Cats": {Plato: "cat 1", Cauchy: "cat 2"},
		},
	}
	if !reflect.DeepEqual(val, answer) {
		t.Fatalf("Expected\n-----\n%#v\n-----\nbut got\n-----\n%#v\n",
			answer, val)
	}
}

func TestDecodeEmbedded(t *testing.T) {
	type Dog struct{ Name string }
	type Age int
	type cat struct{ Name string }

	for _, test := range []struct {
		label       string
		input       string
		decodeInto  interface{}
		wantDecoded interface{}
	}{
		{
			label:       "embedded struct",
			input:       `Name = "milton"`,
			decodeInto:  &struct{ Dog }{},
			wantDecoded: &struct{ Dog }{Dog{"milton"}},
		},
		{
			label:       "embedded non-nil pointer to struct",
			input:       `Name = "milton"`,
			decodeInto:  &struct{ *Dog }{},
			wantDecoded: &struct{ *Dog }{&Dog{"milton"}},
		},
		{
			label:       "embedded nil pointer to struct",
			input:       ``,
			decodeInto:  &struct{ *Dog }{},
			wantDecoded: &struct{ *Dog }{nil},
		},
		{
			label:       "unexported embedded struct",
			input:       `Name = "socks"`,
			decodeInto:  &struct{ cat }{},
			wantDecoded: &struct{ cat }{cat{"socks"}},
		},
		{
			label:       "embedded int",
			input:       `Age = -5`,
			decodeInto:  &struct{ Age }{},
			wantDecoded: &struct{ Age }{-5},
		},
	} {
		_, err := Decode(test.input, test.decodeInto)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(test.wantDecoded, test.decodeInto) {
			t.Errorf("%s: want decoded == %+v, got %+v",
				test.label, test.wantDecoded, test.decodeInto)
		}
	}
}

func TestDecodeIgnoredFields(t *testing.T) {
	type simple struct {
		Number int `toml:"-"`
	}
	const input = `
Number = 123
- = 234
`
	var s simple
	if _, err := Decode(input, &s); err != nil {
		t.Fatal(err)
	}
	if s.Number != 0 {
		t.Errorf("got: %d; want 0", s.Number)
	}
}

func TestTableArrays(t *testing.T) {
	var tomlTableArrays = `
[[albums]]
name = "Born to Run"

  [[albums.songs]]
  name = "Jungleland"

  [[albums.songs]]
  name = "Meeting Across the River"

[[albums]]
name = "Born in the USA"

  [[albums.songs]]
  name = "Glory Days"

  [[albums.songs]]
  name = "Dancing in the Dark"
`

	type Song struct {
		Name string
	}

	type Album struct {
		Name  string
		Songs []Song
	}

	type Music struct {
		Albums []Album
	}

	expected := Music{[]Album{
		{"Born to Run", []Song{{"Jungleland"}, {"Meeting Across the River"}}},
		{"Born in the USA", []Song{{"Glory Days"}, {"Dancing in the Dark"}}},
	}}
	var got Music
	if _, err := Decode(tomlTableArrays, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expected, got) {
		t.Fatalf("\n%#v\n!=\n%#v\n", expected, got)
	}
}

func TestTableNesting(t *testing.T) {
	for _, tt := range []struct {
		t    string
		want []string
	}{
		{"[a.b.c]", []string{"a", "b", "c"}},
		{`[a."b.c"]`, []string{"a", "b.c"}},
		{`[a.'b.c']`, []string{"a", "b.c"}},
		{`[a.' b ']`, []string{"a", " b "}},
		{"[ d.e.f ]", []string{"d", "e", "f"}},
		{"[ g . h . i ]", []string{"g", "h", "i"}},
		{`[ j . "ʞ" . 'l' ]`, []string{"j", "ʞ", "l"}},
	} {
		var m map[string]interface{}
		if _, err := Decode(tt.t, &m); err != nil {
			t.Errorf("Decode(%q): got error: %s", tt.t, err)
			continue
		}
		if keys := extractNestedKeys(m); !reflect.DeepEqual(keys, tt.want) {
			t.Errorf("Decode(%q): got nested keys %#v; want %#v",
				tt.t, keys, tt.want)
		}
	}
}

func extractNestedKeys(v map[string]interface{}) []string {
	var result []string
	for {
		if len(v) != 1 {
			return result
		}
		for k, m := range v {
			result = append(result, k)
			var ok bool
			v, ok = m.(map[string]interface{})
			if !ok {
				return result
			}
		}

	}
}

// Case insensitive matching tests.
// A bit more comprehensive than needed given the current implementation,
// but implementations change.
// Probably still missing demonstrations of some ugly corner cases regarding
// case insensitive matching and multiple fields.
func TestCase(t *testing.T) {
	var caseToml = `
tOpString = "string"
tOpInt = 1
tOpFloat = 1.1
tOpBool = true
tOpdate = 2006-01-02T15:04:05Z
tOparray = [ "array" ]
Match = "i should be in Match only"
MatcH = "i should be in MatcH only"
once = "just once"
[nEst.eD]
nEstedString = "another string"
`

	type InsensitiveEd struct {
		NestedString string
	}

	type InsensitiveNest struct {
		Ed InsensitiveEd
	}

	type Insensitive struct {
		TopString string
		TopInt    int
		TopFloat  float64
		TopBool   bool
		TopDate   time.Time
		TopArray  []string
		Match     string
		MatcH     string
		Once      string
		OncE      string
		Nest      InsensitiveNest
	}

	tme, err := time.Parse(time.RFC3339, time.RFC3339[:len(time.RFC3339)-5])
	if err != nil {
		panic(err)
	}
	expected := Insensitive{
		TopString: "string",
		TopInt:    1,
		TopFloat:  1.1,
		TopBool:   true,
		TopDate:   tme,
		TopArray:  []string{"array"},
		MatcH:     "i should be in MatcH only",
		Match:     "i should be in Match only",
		Once:      "just once",
		OncE:      "",
		Nest: InsensitiveNest{
			Ed: InsensitiveEd{NestedString: "another string"},
		},
	}
	var got Insensitive
	if _, err := Decode(caseToml, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expected, got) {
		t.Fatalf("\n%#v\n!=\n%#v\n", expected, got)
	}
}

func TestPointers(t *testing.T) {
	type Object struct {
		Type        string
		Description string
	}

	type Dict struct {
		NamedObject map[string]*Object
		BaseObject  *Object
		Strptr      *string
		Strptrs     []*string
	}
	s1, s2, s3 := "blah", "abc", "def"
	expected := &Dict{
		Strptr:  &s1,
		Strptrs: []*string{&s2, &s3},
		NamedObject: map[string]*Object{
			"foo": {"FOO", "fooooo!!!"},
			"bar": {"BAR", "ba-ba-ba-ba-barrrr!!!"},
		},
		BaseObject: &Object{"BASE", "da base"},
	}

	ex1 := `
Strptr = "blah"
Strptrs = ["abc", "def"]

[NamedObject.foo]
Type = "FOO"
Description = "fooooo!!!"

[NamedObject.bar]
Type = "BAR"
Description = "ba-ba-ba-ba-barrrr!!!"

[BaseObject]
Type = "BASE"
Description = "da base"
`
	dict := new(Dict)
	_, err := Decode(ex1, dict)
	if err != nil {
		t.Errorf("Decode error: %v", err)
	}
	if !reflect.DeepEqual(expected, dict) {
		t.Fatalf("\n%#v\n!=\n%#v\n", expected, dict)
	}
}

func TestDecodeDatetime(t *testing.T) {
	const noTimestamp = "2006-01-02T15:04:05"
	for _, tt := range []struct {
		s      string
		t      string
		format string
	}{
		{"1979-05-27T07:32:00Z", "1979-05-27T07:32:00Z", time.RFC3339},
		{"1979-05-27T00:32:00-07:00", "1979-05-27T00:32:00-07:00", time.RFC3339},
		{
			"1979-05-27T00:32:00.999999-07:00",
			"1979-05-27T00:32:00.999999-07:00",
			time.RFC3339,
		},
		{"1979-05-27T07:32:00", "1979-05-27T07:32:00", noTimestamp},
		{
			"1979-05-27T00:32:00.999999",
			"1979-05-27T00:32:00.999999",
			noTimestamp,
		},
		{"1979-05-27", "1979-05-27T00:00:00", noTimestamp},
	} {
		var x struct{ D time.Time }
		input := "d = " + tt.s
		if _, err := Decode(input, &x); err != nil {
			t.Errorf("Decode(%q): got error: %s", input, err)
			continue
		}
		want, err := time.ParseInLocation(tt.format, tt.t, time.Local)
		if err != nil {
			panic(err)
		}
		if !x.D.Equal(want) {
			t.Errorf("Decode(%q): got %s; want %s", input, x.D, want)
		}
	}
}

func TestDecodeBadDatetime(t *testing.T) {
	var x struct{ T time.Time }
	for _, s := range []string{
		"123",
		"2006-01-50T00:00:00Z",
		"2006-01-30T00:00",
		"2006-01-30T",
	} {
		input := "T = " + s
		if _, err := Decode(input, &x); err == nil {
			t.Errorf("Expected invalid DateTime error for %q", s)
		}
	}
}

func TestDecodeMultilineStrings(t *testing.T) {
	var x struct {
		S string
	}
	const s0 = `s = """
a b \n c
d e f
"""`
	if _, err := Decode(s0, &x); err != nil {
		t.Fatal(err)
	}
	if want := "a b \n c\nd e f\n"; x.S != want {
		t.Errorf("got: %q; want: %q", x.S, want)
	}
	const s1 = `s = """a b c\
"""`
	if _, err := Decode(s1, &x); err != nil {
		t.Fatal(err)
	}
	if want := "a b c"; x.S != want {
		t.Errorf("got: %q; want: %q", x.S, want)
	}
}

type sphere struct {
	Center [3]float64
	Radius float64
}

func TestDecodeSimpleArray(t *testing.T) {
	var s1 sphere
	if _, err := Decode(`center = [0.0, 1.5, 0.0]`, &s1); err != nil {
		t.Fatal(err)
	}
}

func TestDecodeArrayWrongSize(t *testing.T) {
	var s1 sphere
	if _, err := Decode(`center = [0.1, 2.3]`, &s1); err == nil {
		t.Fatal("Expected array type mismatch error")
	}
}

func TestDecodeLargeIntoSmallInt(t *testing.T) {
	type table struct {
		Value int8
	}
	var tab table
	if _, err := Decode(`value = 500`, &tab); err == nil {
		t.Fatal("Expected integer out-of-bounds error.")
	}
}

func TestDecodeSizedInts(t *testing.T) {
	type table struct {
		U8  uint8
		U16 uint16
		U32 uint32
		U64 uint64
		U   uint
		I8  int8
		I16 int16
		I32 int32
		I64 int64
		I   int
	}
	answer := table{1, 1, 1, 1, 1, -1, -1, -1, -1, -1}
	toml := `
	u8 = 1
	u16 = 1
	u32 = 1
	u64 = 1
	u = 1
	i8 = -1
	i16 = -1
	i32 = -1
	i64 = -1
	i = -1
	`
	var tab table
	if _, err := Decode(toml, &tab); err != nil {
		t.Fatal(err.Error())
	}
	if answer != tab {
		t.Fatalf("Expected %#v but got %#v", answer, tab)
	}
}

func TestDecodeInts(t *testing.T) {
	for _, tt := range []struct {
		s    string
		want int64
	}{
		{"0", 0},
		{"+99", 99},
		{"-10", -10},
		{"1_234_567", 1234567},
		{"1_2_3_4", 1234},
		{"-9_223_372_036_854_775_808", math.MinInt64},
		{"9_223_372_036_854_775_807", math.MaxInt64},
	} {
		var x struct{ N int64 }
		input := "n = " + tt.s
		if _, err := Decode(input, &x); err != nil {
			t.Errorf("Decode(%q): got error: %s", input, err)
			continue
		}
		if x.N != tt.want {
			t.Errorf("Decode(%q): got %d; want %d", input, x.N, tt.want)
		}
	}
}

func TestDecodeFloats(t *testing.T) {
	for _, tt := range []struct {
		s    string
		want float64
	}{
		{"+1.0", 1},
		{"3.1415", 3.1415},
		{"-0.01", -0.01},
		{"5e+22", 5e22},
		{"1e6", 1e6},
		{"-2E-2", -2e-2},
		{"6.626e-34", 6.626e-34},
		{"9_224_617.445_991_228_313", 9224617.445991228313},
		{"9_876.54_32e1_0", 9876.5432e10},
	} {
		var x struct{ N float64 }
		input := "n = " + tt.s
		if _, err := Decode(input, &x); err != nil {
			t.Errorf("Decode(%q): got error: %s", input, err)
			continue
		}
		if x.N != tt.want {
			t.Errorf("Decode(%q): got %f; want %f", input, x.N, tt.want)
		}
	}
}

func TestDecodeMalformedNumbers(t *testing.T) {
	for _, tt := range []struct {
		s    string
		want string
	}{
		{"++99", "expected a digit"},
		{"0..1", "must be followed by one or more digits"},
		{"0.1.2", "Invalid float value"},
		{"1e2.3", "Invalid float value"},
		{"1e2e3", "Invalid float value"},
		{"_123", "expected value"},
		{"123_", "surrounded by digits"},
		{"1._23", "surrounded by digits"},
		{"1e__23", "surrounded by digits"},
		{"123.", "must be followed by one or more digits"},
		{"1.e2", "must be followed by one or more digits"},
	} {
		var x struct{ N interface{} }
		input := "n = " + tt.s
		_, err := Decode(input, &x)
		if err == nil {
			t.Errorf("Decode(%q): got nil, want error containing %q",
				input, tt.want)
			continue
		}
		if !strings.Contains(err.Error(), tt.want) {
			t.Errorf("Decode(%q): got %q, want error containing %q",
				input, err, tt.want)
		}
	}
}

func TestDecodeBadValues(t *testing.T) {
	for _, tt := range []struct {
		v    interface{}
		want string
	}{
		{3, "non-pointer int"},
		{(*int)(nil), "nil"},
	} {
		_, err := Decode(`x = 3`, tt.v)
		if err == nil {
			t.Errorf("Decode(%v): got nil; want error containing %q",
				tt.v, tt.want)
			continue
		}
		if !strings.Contains(err.Error(), tt.want) {
			t.Errorf("Decode(%v): got %q; want error containing %q",
				tt.v, err, tt.want)
		}
	}
}

func TestUnmarshaler(t *testing.T) {

	var tomlBlob = `
[dishes.hamboogie]
name = "Hamboogie with fries"
price = 10.99

[[dishes.hamboogie.ingredients]]
name = "Bread Bun"

[[dishes.hamboogie.ingredients]]
name = "Lettuce"

[[dishes.hamboogie.ingredients]]
name = "Real Beef Patty"

[[dishes.hamboogie.ingredients]]
name = "Tomato"

[dishes.eggsalad]
name = "Egg Salad with rice"
price = 3.99

[[dishes.eggsalad.ingredients]]
name = "Egg"

[[dishes.eggsalad.ingredients]]
name = "Mayo"

[[dishes.eggsalad.ingredients]]
name = "Rice"
`
	m := &menu{}
	if _, err := Decode(tomlBlob, m); err != nil {
		t.Fatal(err)
	}

	if len(m.Dishes) != 2 {
		t.Log("two dishes should be loaded with UnmarshalTOML()")
		t.Errorf("expected %d but got %d", 2, len(m.Dishes))
	}

	eggSalad := m.Dishes["eggsalad"]
	if _, ok := interface{}(eggSalad).(dish); !ok {
		t.Errorf("expected a dish")
	}

	if eggSalad.Name != "Egg Salad with rice" {
		t.Errorf("expected the dish to be named 'Egg Salad with rice'")
	}

	if len(eggSalad.Ingredients) != 3 {
		t.Log("dish should be loaded with UnmarshalTOML()")
		t.Errorf("expected %d but got %d", 3, len(eggSalad.Ingredients))
	}

	found := false
	for _, i := range eggSalad.Ingredients {
		if i.Name == "Rice" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Rice was not loaded in UnmarshalTOML()")
	}

	// test on a value - must be passed as *
	o := menu{}
	if _, err := Decode(tomlBlob, &o); err != nil {
		t.Fatal(err)
	}

}

func TestDecodeInlineTable(t *testing.T) {
	input := `
[CookieJar]
Types = {Chocolate = "yummy", Oatmeal = "best ever"}

[Seasons]
Locations = {NY = {Temp = "not cold", Rating = 4}, MI = {Temp = "freezing", Rating = 9}}
`
	type cookieJar struct {
		Types map[string]string
	}
	type properties struct {
		Temp   string
		Rating int
	}
	type seasons struct {
		Locations map[string]properties
	}
	type wrapper struct {
		CookieJar cookieJar
		Seasons   seasons
	}
	var got wrapper

	meta, err := Decode(input, &got)
	if err != nil {
		t.Fatal(err)
	}
	want := wrapper{
		CookieJar: cookieJar{
			Types: map[string]string{
				"Chocolate": "yummy",
				"Oatmeal":   "best ever",
			},
		},
		Seasons: seasons{
			Locations: map[string]properties{
				"NY": {
					Temp:   "not cold",
					Rating: 4,
				},
				"MI": {
					Temp:   "freezing",
					Rating: 9,
				},
			},
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("after decode, got:\n\n%#v\n\nwant:\n\n%#v", got, want)
	}
	if len(meta.keys) != 12 {
		t.Errorf("after decode, got %d meta keys; want 12", len(meta.keys))
	}
	if len(meta.types) != 12 {
		t.Errorf("after decode, got %d meta types; want 12", len(meta.types))
	}
}

func TestDecodeInlineTableArray(t *testing.T) {
	type point struct {
		X, Y, Z int
	}
	var got struct {
		Points []point
	}
	// Example inline table array from the spec.
	const in = `
points = [ { x = 1, y = 2, z = 3 },
           { x = 7, y = 8, z = 9 },
           { x = 2, y = 4, z = 8 } ]

`
	if _, err := Decode(in, &got); err != nil {
		t.Fatal(err)
	}
	want := []point{
		{X: 1, Y: 2, Z: 3},
		{X: 7, Y: 8, Z: 9},
		{X: 2, Y: 4, Z: 8},
	}
	if !reflect.DeepEqual(got.Points, want) {
		t.Errorf("got %#v; want %#v", got.Points, want)
	}
}

func TestDecodeMalformedInlineTable(t *testing.T) {
	for _, tt := range []struct {
		s    string
		want string
	}{
		{"{,}", "unexpected comma"},
		{"{x = 3 y = 4}", "expected a comma or an inline table terminator"},
		{"{x=3,,y=4}", "unexpected comma"},
		{"{x=3,\ny=4}", "newlines not allowed"},
		{"{x=3\n,y=4}", "newlines not allowed"},
	} {
		var x struct{ A map[string]int }
		input := "a = " + tt.s
		_, err := Decode(input, &x)
		if err == nil {
			t.Errorf("Decode(%q): got nil, want error containing %q",
				input, tt.want)
			continue
		}
		if !strings.Contains(err.Error(), tt.want) {
			t.Errorf("Decode(%q): got %q, want error containing %q",
				input, err, tt.want)
		}
	}
}

type menu struct {
	Dishes map[string]dish
}

func (m *menu) UnmarshalTOML(p interface{}) error {
	m.Dishes = make(map[string]dish)
	data, _ := p.(map[string]interface{})
	dishes := data["dishes"].(map[string]interface{})
	for n, v := range dishes {
		if d, ok := v.(map[string]interface{}); ok {
			nd := dish{}
			nd.UnmarshalTOML(d)
			m.Dishes[n] = nd
		} else {
			return fmt.Errorf("not a dish")
		}
	}
	return nil
}

type dish struct {
	Name        string
	Price       float32
	Ingredients []ingredient
}

func (d *dish) UnmarshalTOML(p interface{}) error {
	data, _ := p.(map[string]interface{})
	d.Name, _ = data["name"].(string)
	d.Price, _ = data["price"].(float32)
	ingredients, _ := data["ingredients"].([]map[string]interface{})
	for _, e := range ingredients {
		n, _ := interface{}(e).(map[string]interface{})
		name, _ := n["name"].(string)
		i := ingredient{name}
		d.Ingredients = append(d.Ingredients, i)
	}
	return nil
}

type ingredient struct {
	Name string
}

func TestDecodeSlices(t *testing.T) {
	type T struct {
		S []string
	}
	for i, tt := range []struct {
		v     T
		input string
		want  T
	}{
		{T{}, "", T{}},
		{T{[]string{}}, "", T{[]string{}}},
		{T{[]string{"a", "b"}}, "", T{[]string{"a", "b"}}},
		{T{}, "S = []", T{[]string{}}},
		{T{[]string{}}, "S = []", T{[]string{}}},
		{T{[]string{"a", "b"}}, "S = []", T{[]string{}}},
		{T{}, `S = ["x"]`, T{[]string{"x"}}},
		{T{[]string{}}, `S = ["x"]`, T{[]string{"x"}}},
		{T{[]string{"a", "b"}}, `S = ["x"]`, T{[]string{"x"}}},
	} {
		if _, err := Decode(tt.input, &tt.v); err != nil {
			t.Errorf("[%d] %s", i, err)
			continue
		}
		if !reflect.DeepEqual(tt.v, tt.want) {
			t.Errorf("[%d] got %#v; want %#v", i, tt.v, tt.want)
		}
	}
}

func TestDecodePrimitive(t *testing.T) {
	type S struct {
		P Primitive
	}
	type T struct {
		S []int
	}
	slicep := func(s []int) *[]int { return &s }
	arrayp := func(a [2]int) *[2]int { return &a }
	mapp := func(m map[string]int) *map[string]int { return &m }
	for i, tt := range []struct {
		v     interface{}
		input string
		want  interface{}
	}{
		// slices
		{slicep(nil), "", slicep(nil)},
		{slicep([]int{}), "", slicep([]int{})},
		{slicep([]int{1, 2, 3}), "", slicep([]int{1, 2, 3})},
		{slicep(nil), "P = [1,2]", slicep([]int{1, 2})},
		{slicep([]int{}), "P = [1,2]", slicep([]int{1, 2})},
		{slicep([]int{1, 2, 3}), "P = [1,2]", slicep([]int{1, 2})},

		// arrays
		{arrayp([2]int{2, 3}), "", arrayp([2]int{2, 3})},
		{arrayp([2]int{2, 3}), "P = [3,4]", arrayp([2]int{3, 4})},

		// maps
		{mapp(nil), "", mapp(nil)},
		{mapp(map[string]int{}), "", mapp(map[string]int{})},
		{mapp(map[string]int{"a": 1}), "", mapp(map[string]int{"a": 1})},
		{mapp(nil), "[P]\na = 2", mapp(map[string]int{"a": 2})},
		{mapp(map[string]int{}), "[P]\na = 2", mapp(map[string]int{"a": 2})},
		{mapp(map[string]int{"a": 1, "b": 3}), "[P]\na = 2", mapp(map[string]int{"a": 2, "b": 3})},

		// structs
		{&T{nil}, "[P]", &T{nil}},
		{&T{[]int{}}, "[P]", &T{[]int{}}},
		{&T{[]int{1, 2, 3}}, "[P]", &T{[]int{1, 2, 3}}},
		{&T{nil}, "[P]\nS = [1,2]", &T{[]int{1, 2}}},
		{&T{[]int{}}, "[P]\nS = [1,2]", &T{[]int{1, 2}}},
		{&T{[]int{1, 2, 3}}, "[P]\nS = [1,2]", &T{[]int{1, 2}}},
	} {
		var s S
		md, err := Decode(tt.input, &s)
		if err != nil {
			t.Errorf("[%d] Decode error: %s", i, err)
			continue
		}
		if err := md.PrimitiveDecode(s.P, tt.v); err != nil {
			t.Errorf("[%d] PrimitiveDecode error: %s", i, err)
			continue
		}
		if !reflect.DeepEqual(tt.v, tt.want) {
			t.Errorf("[%d] got %#v; want %#v", i, tt.v, tt.want)
		}
	}
}

func TestDecodeErrors(t *testing.T) {
	for _, s := range []string{
		`x="`,
		`x='`,
		`x='''`,

		// Cases found by fuzzing in
		// https://github.com/BurntSushi/toml/issues/155.
		`""�`,   // used to panic with index out of range
		`e="""`, // used to hang
	} {
		var x struct{}
		_, err := Decode(s, &x)
		if err == nil {
			t.Errorf("Decode(%q): got nil error", s)
		}
	}
}

// Test for https://github.com/BurntSushi/toml/pull/166.
func TestDecodeBoolArray(t *testing.T) {
	for _, tt := range []struct {
		s    string
		got  interface{}
		want interface{}
	}{
		{
			"a = [true, false]",
			&struct{ A []bool }{},
			&struct{ A []bool }{[]bool{true, false}},
		},
		{
			"a = {a = true, b = false}",
			&struct{ A map[string]bool }{},
			&struct{ A map[string]bool }{map[string]bool{"a": true, "b": false}},
		},
	} {
		if _, err := Decode(tt.s, tt.got); err != nil {
			t.Errorf("Decode(%q): %s", tt.s, err)
			continue
		}
		if !reflect.DeepEqual(tt.got, tt.want) {
			t.Errorf("Decode(%q): got %#v; want %#v", tt.s, tt.got, tt.want)
		}
	}
}

func ExampleMetaData_PrimitiveDecode() {
	var md MetaData
	var err error

	var tomlBlob = `
ranking = ["Springsteen", "J Geils"]

[bands.Springsteen]
started = 1973
albums = ["Greetings", "WIESS", "Born to Run", "Darkness"]

[bands."J Geils"]
started = 1970
albums = ["The J. Geils Band", "Full House", "Blow Your Face Out"]
`

	type band struct {
		Started int
		Albums  []string
	}
	type classics struct {
		Ranking []string
		Bands   map[string]Primitive
	}

	// Do the initial decode. Reflection is delayed on Primitive values.
	var music classics
	if md, err = Decode(tomlBlob, &music); err != nil {
		log.Fatal(err)
	}

	// MetaData still includes information on Primitive values.
	fmt.Printf("Is `bands.Springsteen` defined? %v\n",
		md.IsDefined("bands", "Springsteen"))

	// Decode primitive data into Go values.
	for _, artist := range music.Ranking {
		// A band is a primitive value, so we need to decode it to get a
		// real `band` value.
		primValue := music.Bands[artist]

		var aBand band
		if err = md.PrimitiveDecode(primValue, &aBand); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s started in %d.\n", artist, aBand.Started)
	}
	// Check to see if there were any fields left undecoded.
	// Note that this won't be empty before decoding the Primitive value!
	fmt.Printf("Undecoded: %q\n", md.Undecoded())

	// Output:
	// Is `bands.Springsteen` defined? true
	// Springsteen started in 1973.
	// J Geils started in 1970.
	// Undecoded: []
}

func ExampleDecode() {
	var tomlBlob = `
# Some comments.
[alpha]
ip = "10.0.0.1"

	[alpha.config]
	Ports = [ 8001, 8002 ]
	Location = "Toronto"
	Created = 1987-07-05T05:45:00Z

[beta]
ip = "10.0.0.2"

	[beta.config]
	Ports = [ 9001, 9002 ]
	Location = "New Jersey"
	Created = 1887-01-05T05:55:00Z
`

	type serverConfig struct {
		Ports    []int
		Location string
		Created  time.Time
	}

	type server struct {
		IP     string       `toml:"ip,omitempty"`
		Config serverConfig `toml:"config"`
	}

	type servers map[string]server

	var config servers
	if _, err := Decode(tomlBlob, &config); err != nil {
		log.Fatal(err)
	}

	for _, name := range []string{"alpha", "beta"} {
		s := config[name]
		fmt.Printf("Server: %s (ip: %s) in %s created on %s\n",
			name, s.IP, s.Config.Location,
			s.Config.Created.Format("2006-01-02"))
		fmt.Printf("Ports: %v\n", s.Config.Ports)
	}

	// Output:
	// Server: alpha (ip: 10.0.0.1) in Toronto created on 1987-07-05
	// Ports: [8001 8002]
	// Server: beta (ip: 10.0.0.2) in New Jersey created on 1887-01-05
	// Ports: [9001 9002]
}

type duration struct {
	time.Duration
}

func (d *duration) UnmarshalText(text []byte) error {
	var err error
	d.Duration, err = time.ParseDuration(string(text))
	return err
}

// Example Unmarshaler shows how to decode TOML strings into your own
// custom data type.
func Example_unmarshaler() {
	blob := `
[[song]]
name = "Thunder Road"
duration = "4m49s"

[[song]]
name = "Stairway to Heaven"
duration = "8m03s"
`
	type song struct {
		Name     string
		Duration duration
	}
	type songs struct {
		Song []song
	}
	var favorites songs
	if _, err := Decode(blob, &favorites); err != nil {
		log.Fatal(err)
	}

	// Code to implement the TextUnmarshaler interface for `duration`:
	//
	// type duration struct {
	// 	time.Duration
	// }
	//
	// func (d *duration) UnmarshalText(text []byte) error {
	// 	var err error
	// 	d.Duration, err = time.ParseDuration(string(text))
	// 	return err
	// }

	for _, s := range favorites.Song {
		fmt.Printf("%s (%s)\n", s.Name, s.Duration)
	}
	// Output:
	// Thunder Road (4m49s)
	// Stairway to Heaven (8m3s)
}

// Example StrictDecoding shows how to detect whether there are keys in the
// TOML document that weren't decoded into the value given. This is useful
// for returning an error to the user if they've included extraneous fields
// in their configuration.
func Example_strictDecoding() {
	var blob = `
key1 = "value1"
key2 = "value2"
key3 = "value3"
`
	type config struct {
		Key1 string
		Key3 string
	}

	var conf config
	md, err := Decode(blob, &conf)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Undecoded keys: %q\n", md.Undecoded())
	// Output:
	// Undecoded keys: ["key2"]
}

// Example UnmarshalTOML shows how to implement a struct type that knows how to
// unmarshal itself. The struct must take full responsibility for mapping the
// values passed into the struct. The method may be used with interfaces in a
// struct in cases where the actual type is not known until the data is
// examined.
func Example_unmarshalTOML() {

	var blob = `
[[parts]]
type = "valve"
id = "valve-1"
size = 1.2
rating = 4

[[parts]]
type = "valve"
id = "valve-2"
size = 2.1
rating = 5

[[parts]]
type = "pipe"
id = "pipe-1"
length = 2.1
diameter = 12

[[parts]]
type = "cable"
id = "cable-1"
length = 12
rating = 3.1
`
	o := &order{}
	err := Unmarshal([]byte(blob), o)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(len(o.parts))

	for _, part := range o.parts {
		fmt.Println(part.Name())
	}

	// Code to implement UmarshalJSON.

	// type order struct {
	// 	// NOTE `order.parts` is a private slice of type `part` which is an
	// 	// interface and may only be loaded from toml using the
	// 	// UnmarshalTOML() method of the Umarshaler interface.
	// 	parts parts
	// }

	// func (o *order) UnmarshalTOML(data interface{}) error {

	// 	// NOTE the example below contains detailed type casting to show how
	// 	// the 'data' is retrieved. In operational use, a type cast wrapper
	// 	// may be preferred e.g.
	// 	//
	// 	// func AsMap(v interface{}) (map[string]interface{}, error) {
	// 	// 		return v.(map[string]interface{})
	// 	// }
	// 	//
	// 	// resulting in:
	// 	// d, _ := AsMap(data)
	// 	//

	// 	d, _ := data.(map[string]interface{})
	// 	parts, _ := d["parts"].([]map[string]interface{})

	// 	for _, p := range parts {

	// 		typ, _ := p["type"].(string)
	// 		id, _ := p["id"].(string)

	// 		// detect the type of part and handle each case
	// 		switch p["type"] {
	// 		case "valve":

	// 			size := float32(p["size"].(float64))
	// 			rating := int(p["rating"].(int64))

	// 			valve := &valve{
	// 				Type:   typ,
	// 				ID:     id,
	// 				Size:   size,
	// 				Rating: rating,
	// 			}

	// 			o.parts = append(o.parts, valve)

	// 		case "pipe":

	// 			length := float32(p["length"].(float64))
	// 			diameter := int(p["diameter"].(int64))

	// 			pipe := &pipe{
	// 				Type:     typ,
	// 				ID:       id,
	// 				Length:   length,
	// 				Diameter: diameter,
	// 			}

	// 			o.parts = append(o.parts, pipe)

	// 		case "cable":

	// 			length := int(p["length"].(int64))
	// 			rating := float32(p["rating"].(float64))

	// 			cable := &cable{
	// 				Type:   typ,
	// 				ID:     id,
	// 				Length: length,
	// 				Rating: rating,
	// 			}

	// 			o.parts = append(o.parts, cable)

	// 		}
	// 	}

	// 	return nil
	// }

	// type parts []part

	// type part interface {
	// 	Name() string
	// }

	// type valve struct {
	// 	Type   string
	// 	ID     string
	// 	Size   float32
	// 	Rating int
	// }

	// func (v *valve) Name() string {
	// 	return fmt.Sprintf("VALVE: %s", v.ID)
	// }

	// type pipe struct {
	// 	Type     string
	// 	ID       string
	// 	Length   float32
	// 	Diameter int
	// }

	// func (p *pipe) Name() string {
	// 	return fmt.Sprintf("PIPE: %s", p.ID)
	// }

	// type cable struct {
	// 	Type   string
	// 	ID     string
	// 	Length int
	// 	Rating float32
	// }

	// func (c *cable) Name() string {
	// 	return fmt.Sprintf("CABLE: %s", c.ID)
	// }

	// Output:
	// 4
	// VALVE: valve-1
	// VALVE: valve-2
	// PIPE: pipe-1
	// CABLE: cable-1

}

type order struct {
	// NOTE `order.parts` is a private slice of type `part` which is an
	// interface and may only be loaded from toml using the UnmarshalTOML()
	// method of the Umarshaler interface.
	parts parts
}

func (o *order) UnmarshalTOML(data interface{}) error {

	// NOTE the example below contains detailed type casting to show how
	// the 'data' is retrieved. In operational use, a type cast wrapper
	// may be preferred e.g.
	//
	// func AsMap(v interface{}) (map[string]interface{}, error) {
	// 		return v.(map[string]interface{})
	// }
	//
	// resulting in:
	// d, _ := AsMap(data)
	//

	d, _ := data.(map[string]interface{})
	parts, _ := d["parts"].([]map[string]interface{})

	for _, p := range parts {

		typ, _ := p["type"].(string)
		id, _ := p["id"].(string)

		// detect the type of part and handle each case
		switch p["type"] {
		case "valve":

			size := float32(p["size"].(float64))
			rating := int(p["rating"].(int64))

			valve := &valve{
				Type:   typ,
				ID:     id,
				Size:   size,
				Rating: rating,
			}

			o.parts = append(o.parts, valve)

		case "pipe":

			length := float32(p["length"].(float64))
			diameter := int(p["diameter"].(int64))

			pipe := &pipe{
				Type:     typ,
				ID:       id,
				Length:   length,
				Diameter: diameter,
			}

			o.parts = append(o.parts, pipe)

		case "cable":

			length := int(p["length"].(int64))
			rating := float32(p["rating"].(float64))

			cable := &cable{
				Type:   typ,
				ID:     id,
				Length: length,
				Rating: rating,
			}

			o.parts = append(o.parts, cable)

		}
	}

	return nil
}

type parts []part

type part interface {
	Name() string
}

type valve struct {
	Type   string
	ID     string
	Size   float32
	Rating int
}

func (v *valve) Name() string {
	return fmt.Sprintf("VALVE: %s", v.ID)
}

type pipe struct {
	Type     string
	ID       string
	Length   float32
	Diameter int
}

func (p *pipe) Name() string {
	return fmt.Sprintf("PIPE: %s", p.ID)
}

type cable struct {
	Type   string
	ID     string
	Length int
	Rating float32
}

func (c *cable) Name() string {
	return fmt.Sprintf("CABLE: %s", c.ID)
}
