/*
Package fake is the fake data generatror for go (Golang), heavily inspired by forgery and ffaker Ruby gems

Most data and methods are ported from forgery/ffaker Ruby gems.

Currently english and russian languages are available.

For the list of available methods please look at https://godoc.org/github.com/icrowley/fake.

Fake embeds samples data files unless you call UseExternalData(true) in order to be able to work without external files dependencies when compiled, so, if you add new data files or make changes to existing ones don't forget to regenerate data.go file using github.com/mjibson/esc tool and esc -o data.go -pkg fake data command (or you can just use go generate command if you are using Go 1.4 or later).

Examples:
	name := fake.FirstName()
	fullname = := fake.FullName()
	product := fake.Product()

Changing language:
	err := fake.SetLang("ru")
	if err != nil {
		panic(err)
	}
	password := fake.SimplePassword()

Using english fallback:
	err := fake.SetLang("ru")
	if err != nil {
		panic(err)
	}
	fake.EnFallback(true)
	password := fake.Paragraph()

Using external data:
	fake.UseExternalData(true)
	password := fake.Paragraph()
*/
package fake

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:generate go get github.com/mjibson/esc
//go:generate esc -o data.go -pkg fake data

// cat/subcat/lang/samples
type samplesTree map[string]map[string][]string

var samplesLock sync.Mutex
var samplesCache = make(samplesTree)
var r = rand.New(&rndSrc{src: rand.NewSource(time.Now().UnixNano())})
var lang = "en"
var useExternalData = false
var enFallback = true
var availLangs = GetLangs()

var (
	// ErrNoLanguageFn is the error that indicates that given language is not available
	ErrNoLanguageFn = func(lang string) error { return fmt.Errorf("The language passed (%s) is not available", lang) }
	// ErrNoSamplesFn is the error that indicates that there are no samples for the given language
	ErrNoSamplesFn = func(lang string) error { return fmt.Errorf("No samples found for language: %s", lang) }
)

// Seed uses the provided seed value to initialize the internal PRNG to a
// deterministic state.
func Seed(seed int64) {
	r.Seed(seed)
}

type rndSrc struct {
	mtx sync.Mutex
	src rand.Source
}

func (s *rndSrc) Int63() int64 {
	s.mtx.Lock()
	n := s.src.Int63()
	s.mtx.Unlock()
	return n
}

func (s *rndSrc) Seed(n int64) {
	s.mtx.Lock()
	s.src.Seed(n)
	s.mtx.Unlock()
}

// GetLangs returns a slice of available languages
func GetLangs() []string {
	var langs []string
	for k, v := range data {
		if v.isDir && k != "/" && k != "/data" {
			langs = append(langs, strings.Replace(k, "/data/", "", 1))
		}
	}
	return langs
}

// SetLang sets the language in which the data should be generated
// returns error if passed language is not available
func SetLang(newLang string) error {
	found := false
	for _, l := range availLangs {
		if newLang == l {
			found = true
			break
		}
	}
	if !found {
		return ErrNoLanguageFn(newLang)
	}
	lang = newLang
	return nil
}

// UseExternalData sets the flag that allows using of external files as data providers (fake uses embedded ones by default)
func UseExternalData(flag bool) {
	useExternalData = flag
}

// EnFallback sets the flag that allows fake to fallback to englsh samples if the ones for the used languaged are not available
func EnFallback(flag bool) {
	enFallback = flag
}

func (st samplesTree) hasKeyPath(lang, cat string) bool {
	if _, ok := st[lang]; ok {
		if _, ok = st[lang][cat]; ok {
			return true
		}
	}
	return false
}

func join(parts ...string) string {
	var filtered []string
	for _, part := range parts {
		if part != "" {
			filtered = append(filtered, part)
		}
	}
	return strings.Join(filtered, " ")
}

func generate(lang, cat string, fallback bool) string {
	format := lookup(lang, cat+"_format", fallback)
	var result string
	for _, ru := range format {
		if ru != '#' {
			result += string(ru)
		} else {
			result += strconv.Itoa(r.Intn(10))
		}
	}
	return result
}

func lookup(lang, cat string, fallback bool) string {
	samplesLock.Lock()
	s := _lookup(lang, cat, fallback)
	samplesLock.Unlock()
	return s
}

func _lookup(lang, cat string, fallback bool) string {
	var samples []string

	if samplesCache.hasKeyPath(lang, cat) {
		samples = samplesCache[lang][cat]
	} else {
		var err error
		samples, err = populateSamples(lang, cat)
		if err != nil {
			if lang != "en" && fallback && enFallback && err.Error() == ErrNoSamplesFn(lang).Error() {
				return _lookup("en", cat, false)
			}
			return ""
		}
	}

	return samples[r.Intn(len(samples))]
}

func populateSamples(lang, cat string) ([]string, error) {
	data, err := readFile(lang, cat)
	if err != nil {
		return nil, err
	}

	if _, ok := samplesCache[lang]; !ok {
		samplesCache[lang] = make(map[string][]string)
	}

	samples := strings.Split(strings.TrimSpace(string(data)), "\n")

	samplesCache[lang][cat] = samples
	return samples, nil
}

func readFile(lang, cat string) ([]byte, error) {
	fullpath := fmt.Sprintf("/data/%s/%s", lang, cat)
	file, err := FS(useExternalData).Open(fullpath)
	if err != nil {
		return nil, ErrNoSamplesFn(lang)
	}
	defer file.Close()

	return ioutil.ReadAll(file)
}
