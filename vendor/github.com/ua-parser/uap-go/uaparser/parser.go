package uaparser

import (
	"fmt"
	"io/ioutil"
	"regexp"
	"sync"
	"sync/atomic"
	"sort"
	"time"

	"gopkg.in/yaml.v2"
)

type RegexesDefinitions struct {
	UA     []*uaParser     `yaml:"user_agent_parsers"`
	OS     []*osParser     `yaml:"os_parsers"`
	Device []*deviceParser `yaml:"device_parsers"`
	sync.RWMutex
}

type UserAgentSorter []*uaParser
func (a UserAgentSorter) Len() int           { return len(a) }
func (a UserAgentSorter) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a UserAgentSorter) Less(i, j int) bool { return atomic.LoadUint64(&a[i].MatchesCount) > atomic.LoadUint64(&a[j].MatchesCount) }

type uaParser struct {
	Reg               *regexp.Regexp
	Expr              string `yaml:"regex"`
	Flags             string `yaml:"regex_flag"`
	FamilyReplacement string `yaml:"family_replacement"`
	V1Replacement     string `yaml:"v1_replacement"`
	V2Replacement     string `yaml:"v2_replacement"`
	V3Replacement     string `yaml:"v3_replacement"`
	MatchesCount      uint64
}

func (ua *uaParser) setDefaults() {
	if ua.FamilyReplacement == "" {
		ua.FamilyReplacement = "$1"
	}
	if ua.V1Replacement == "" {
		ua.V1Replacement = "$2"
	}
	if ua.V2Replacement == "" {
		ua.V2Replacement = "$3"
	}
	if ua.V3Replacement == "" {
		ua.V3Replacement = "$4"
	}
}

type OsSorter []*osParser
func (a OsSorter) Len() int           { return len(a) }
func (a OsSorter) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a OsSorter) Less(i, j int) bool { return atomic.LoadUint64(&a[i].MatchesCount) > atomic.LoadUint64(&a[j].MatchesCount) }

type osParser struct {
	Reg           *regexp.Regexp
	Expr          string `yaml:"regex"`
	Flags         string `yaml:"regex_flag"`
	OSReplacement string `yaml:"os_replacement"`
	V1Replacement string `yaml:"os_v1_replacement"`
	V2Replacement string `yaml:"os_v2_replacement"`
	V3Replacement string `yaml:"os_v3_replacement"`
	V4Replacement string `yaml:"os_v4_replacement"`
	MatchesCount  uint64
}

func (os *osParser) setDefaults() {
	if os.OSReplacement == "" {
		os.OSReplacement = "$1"
	}
	if os.V1Replacement == "" {
		os.V1Replacement = "$2"
	}
	if os.V2Replacement == "" {
		os.V2Replacement = "$3"
	}
	if os.V3Replacement == "" {
		os.V3Replacement = "$4"
	}
	if os.V4Replacement == "" {
		os.V4Replacement = "$5"
	}
}

type DeviceSorter []*deviceParser
func (a DeviceSorter) Len() int           { return len(a) }
func (a DeviceSorter) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a DeviceSorter) Less(i, j int) bool { return atomic.LoadUint64(&a[i].MatchesCount) > atomic.LoadUint64(&a[j].MatchesCount) }

type deviceParser struct {
	Reg               *regexp.Regexp
	Expr              string `yaml:"regex"`
	Flags             string `yaml:"regex_flag"`
	DeviceReplacement string `yaml:"device_replacement"`
	BrandReplacement  string `yaml:"brand_replacement"`
	ModelReplacement  string `yaml:"model_replacement"`
	MatchesCount      uint64
}

func (device *deviceParser) setDefaults() {
	if device.DeviceReplacement == "" {
		device.DeviceReplacement = "$1"
	}
	if device.ModelReplacement == "" {
		device.ModelReplacement = "$1"
	}
}

type Client struct {
	UserAgent *UserAgent
	Os        *Os
	Device    *Device
}

type Parser struct {
	RegexesDefinitions
	UserAgentMisses   uint64
	OsMisses          uint64
	DeviceMisses      uint64
	Mode              int
	UseSort           bool
	debugMode         bool
}


const (
	EOsLookUpMode		= 1	/* 00000001 */
	EUserAgentLookUpMode	= 2	/* 00000010 */
	EDeviceLookUpMode	= 4	/* 00000100 */
	cMinMissesTreshold	= 100000
	cDefaultMissesTreshold	= 500000
	cDefaultMatchIdxNotOk	= 20
	cDefaultSortOption	= false
)

var (
	missesTreshold		= uint64(500000)
	matchIdxNotOk		= 20
)

func (parser *Parser) mustCompile() { // until we can use yaml.UnmarshalYAML with embedded pointer struct
	for _, p := range parser.UA {
		p.Reg = compileRegex(p.Flags, p.Expr)
		p.setDefaults()
	}
	for _, p := range parser.OS {
		p.Reg = compileRegex(p.Flags, p.Expr)
		p.setDefaults()
	}
	for _, p := range parser.Device {
		p.Reg = compileRegex(p.Flags, p.Expr)
		p.setDefaults()
	}
}

func NewWithOptions(regexFile string, mode, treshold, topCnt int, useSort, debugMode bool) (*Parser, error) {
	data, err := ioutil.ReadFile(regexFile)
	if nil != err {
		return nil, err
	}
	if topCnt >= 0 {
		matchIdxNotOk = topCnt
	}
	if treshold > cMinMissesTreshold {
		missesTreshold = uint64(treshold)
	}
	parser, err := NewFromBytes(data)
	if err != nil {
		return nil, err
	}
	parser.Mode = mode
	parser.UseSort = useSort
	parser.debugMode = debugMode
	return parser, nil
}

func New(regexFile string) (*Parser, error) {
	data, err := ioutil.ReadFile(regexFile)
	if nil != err {
		return nil, err
	}
	matchIdxNotOk = cDefaultMatchIdxNotOk
	missesTreshold = cDefaultMissesTreshold
	parser, err := NewFromBytes(data)
	if err != nil {
		return nil, err
	}
	return parser, nil
}

func NewFromSaved() *Parser {
	parser, err := NewFromBytes(definitionYaml)
	if err != nil {
		// if the YAML is malformed, it's a programmatic error inside what
		// we've statically-compiled in our binary. Panic!
		panic(err.Error())
	}
	return parser
}

func NewFromBytes(data []byte) (*Parser, error) {
	var definitions RegexesDefinitions
	if err := yaml.Unmarshal(data, &definitions); err != nil {
		return nil, err
	}

	parser := &Parser{definitions, 0, 0, 0, (EOsLookUpMode|EUserAgentLookUpMode|EDeviceLookUpMode), false, false}
	parser.mustCompile()

	return parser, nil
}

func (parser *Parser) Parse(line string) *Client {
	cli := new(Client)
	var wg sync.WaitGroup
	if EUserAgentLookUpMode & parser.Mode == EUserAgentLookUpMode {
		wg.Add(1)
		go func() {
			defer wg.Done()
			parser.RLock()
			cli.UserAgent = parser.ParseUserAgent(line)
			parser.RUnlock()
		}()
	}
	if EOsLookUpMode & parser.Mode == EOsLookUpMode {
		wg.Add(1)
		go func() {
			defer wg.Done()
			parser.RLock()
			cli.Os = parser.ParseOs(line)
			parser.RUnlock()
		}()
	}
	if EDeviceLookUpMode & parser.Mode == EDeviceLookUpMode {
		wg.Add(1)
		go func() {
			defer wg.Done()
			parser.RLock()
			cli.Device = parser.ParseDevice(line)
			parser.RUnlock()
		}()
	}
	wg.Wait()
	if parser.UseSort == true {
		checkAndSort(parser)
	}
	return cli
}

func (parser *Parser) ParseUserAgent(line string) *UserAgent {
	ua := new(UserAgent)
	foundIdx := -1
	found := false
	for i, uaPattern := range parser.UA {
		uaPattern.Match(line, ua)
		if len(ua.Family) > 0 {
			found = true
			foundIdx = i
			atomic.AddUint64(&uaPattern.MatchesCount, 1)
			break
		}
	}
	if !found {
		ua.Family = "Other"
	}
	if(foundIdx > matchIdxNotOk) {
		atomic.AddUint64(&parser.UserAgentMisses, 1)
	}
	return ua
}

func (parser *Parser) ParseOs(line string) *Os {
	os := new(Os)
	foundIdx := -1
	found := false
	for i, osPattern := range parser.OS {
		osPattern.Match(line, os)
		if len(os.Family) > 0 {
			found = true
			foundIdx = i
			atomic.AddUint64(&osPattern.MatchesCount, 1)
			break
		}
	}
	if !found {
		os.Family = "Other"
	}
	if(foundIdx > matchIdxNotOk) {
		atomic.AddUint64(&parser.OsMisses, 1)
	}
	return os
}

func (parser *Parser) ParseDevice(line string) *Device {
	dvc := new(Device)
	foundIdx := -1
	found := false
	for i, dvcPattern := range parser.Device {
		dvcPattern.Match(line, dvc)
		if len(dvc.Family) > 0 {
			found = true
			foundIdx = i
			atomic.AddUint64(&dvcPattern.MatchesCount, 1)
			break
		}
	}
	if !found {
		dvc.Family = "Other"
	}
	if(foundIdx > matchIdxNotOk) {
		atomic.AddUint64(&parser.DeviceMisses, 1)
	}
	return dvc
}

func checkAndSort(parser *Parser) {
	parser.Lock()
	if(atomic.LoadUint64(&parser.UserAgentMisses) >= missesTreshold) {
		if parser.debugMode {
			fmt.Printf("%s\tSorting UserAgents slice\n", time.Now());
		}
		parser.UserAgentMisses = 0
		sort.Sort(UserAgentSorter(parser.UA));
	}
	parser.Unlock()
	parser.Lock()
	if(atomic.LoadUint64(&parser.OsMisses) >= missesTreshold) {
		if parser.debugMode {
			fmt.Printf("%s\tSorting OS slice\n", time.Now());
		}
		parser.OsMisses = 0
		sort.Sort(OsSorter(parser.OS));
	}
	parser.Unlock()
	parser.Lock()
	if(atomic.LoadUint64(&parser.DeviceMisses) >= missesTreshold) {
		if parser.debugMode {
			fmt.Printf("%s\tSorting Device slice\n", time.Now());
		}
		parser.DeviceMisses = 0
		sort.Sort(DeviceSorter(parser.Device));
	}
	parser.Unlock()
}

func compileRegex(flags, expr string) *regexp.Regexp {
	if flags == "" {
		return regexp.MustCompile(expr)
	} else {
		return regexp.MustCompile(fmt.Sprintf("(?%s)%s", flags, expr))
	}
}
