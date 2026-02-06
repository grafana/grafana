package azblob

import (
	"errors"
	"net"
	"net/url"
	"strings"
	"time"
)

// SASVersion indicates the SAS version.
const SASVersion = ServiceVersion

type SASProtocol string

const (
	// SASProtocolHTTPS can be specified for a SAS protocol
	SASProtocolHTTPS SASProtocol = "https"

	// SASProtocolHTTPSandHTTP can be specified for a SAS protocol
	SASProtocolHTTPSandHTTP SASProtocol = "https,http"
)

// FormatTimesForSASSigning converts a time.Time to a snapshotTimeFormat string suitable for a
// SASField's StartTime or ExpiryTime fields. Returns "" if value.IsZero().
func FormatTimesForSASSigning(startTime, expiryTime, snapshotTime time.Time) (string, string, string) {
	ss := ""
	if !startTime.IsZero() {
		ss = formatSASTimeWithDefaultFormat(&startTime)
	}
	se := ""
	if !expiryTime.IsZero() {
		se = formatSASTimeWithDefaultFormat(&expiryTime)
	}
	sh := ""
	if !snapshotTime.IsZero() {
		sh = snapshotTime.Format(SnapshotTimeFormat)
	}
	return ss, se, sh
}

// SASTimeFormat represents the format of a SAS start or expiry time. Use it when formatting/parsing a time.Time.
const SASTimeFormat = "2006-01-02T15:04:05Z"                                                                    //"2017-07-27T00:00:00Z" // ISO 8601
var SASTimeFormats = []string{"2006-01-02T15:04:05.0000000Z", SASTimeFormat, "2006-01-02T15:04Z", "2006-01-02"} // ISO 8601 formats, please refer to https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas for more details.

// formatSASTimeWithDefaultFormat format time with ISO 8601 in "yyyy-MM-ddTHH:mm:ssZ".
func formatSASTimeWithDefaultFormat(t *time.Time) string {
	return formatSASTime(t, SASTimeFormat) // By default, "yyyy-MM-ddTHH:mm:ssZ" is used
}

// formatSASTime format time with given format, use ISO 8601 in "yyyy-MM-ddTHH:mm:ssZ" by default.
func formatSASTime(t *time.Time, format string) string {
	if format != "" {
		return t.Format(format)
	}
	return t.Format(SASTimeFormat) // By default, "yyyy-MM-ddTHH:mm:ssZ" is used
}

// parseSASTimeString try to parse sas time string.
func parseSASTimeString(val string) (t time.Time, timeFormat string, err error) {
	for _, sasTimeFormat := range SASTimeFormats {
		t, err = time.Parse(sasTimeFormat, val)
		if err == nil {
			timeFormat = sasTimeFormat
			break
		}
	}

	if err != nil {
		err = errors.New("fail to parse time with IOS 8601 formats, please refer to https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas for more details")
	}

	return
}

// https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas

// A SASQueryParameters object represents the components that make up an Azure Storage SAS' query parameters.
// You parse a map of query parameters into its fields by calling NewSASQueryParameters(). You add the components
// to a query parameter map by calling AddToValues().
// NOTE: Changing any field requires computing a new SAS signature using a XxxSASSignatureValues type.
//
// This type defines the components used by all Azure Storage resources (Containers, Blobs, Files, & Queues).
type SASQueryParameters struct {
	// All members are immutable or values so copies of this struct are goroutine-safe.
	version                    string      `param:"sv"`
	services                   string      `param:"ss"`
	resourceTypes              string      `param:"srt"`
	protocol                   SASProtocol `param:"spr"`
	startTime                  time.Time   `param:"st"`
	expiryTime                 time.Time   `param:"se"`
	snapshotTime               time.Time   `param:"snapshot"`
	ipRange                    IPRange     `param:"sip"`
	identifier                 string      `param:"si"`
	resource                   string      `param:"sr"`
	permissions                string      `param:"sp"`
	signature                  string      `param:"sig"`
	cacheControl               string      `param:"rscc"`
	contentDisposition         string      `param:"rscd"`
	contentEncoding            string      `param:"rsce"`
	contentLanguage            string      `param:"rscl"`
	contentType                string      `param:"rsct"`
	signedOid                  string      `param:"skoid"`
	signedTid                  string      `param:"sktid"`
	signedStart                time.Time   `param:"skt"`
	signedService              string      `param:"sks"`
	signedExpiry               time.Time   `param:"ske"`
	signedVersion              string      `param:"skv"`
	signedDirectoryDepth       string      `param:"sdd"`
	preauthorizedAgentObjectId string      `param:"saoid"`
	agentObjectId              string      `param:"suoid"`
	correlationId              string      `param:"scid"`
	// private member used for startTime and expiryTime formatting.
	stTimeFormat string
	seTimeFormat string
}

func (p *SASQueryParameters) PreauthorizedAgentObjectId() string {
	return p.preauthorizedAgentObjectId
}

func (p *SASQueryParameters) AgentObjectId() string {
	return p.agentObjectId
}

func (p *SASQueryParameters) SignedCorrelationId() string {
	return p.correlationId
}

func (p *SASQueryParameters) SignedTid() string {
	return p.signedTid
}

func (p *SASQueryParameters) SignedStart() time.Time {
	return p.signedStart
}

func (p *SASQueryParameters) SignedExpiry() time.Time {
	return p.signedExpiry
}

func (p *SASQueryParameters) SignedService() string {
	return p.signedService
}

func (p *SASQueryParameters) SignedVersion() string {
	return p.signedVersion
}

func (p *SASQueryParameters) SnapshotTime() time.Time {
	return p.snapshotTime
}

func (p *SASQueryParameters) Version() string {
	return p.version
}

func (p *SASQueryParameters) Services() string {
	return p.services
}
func (p *SASQueryParameters) ResourceTypes() string {
	return p.resourceTypes
}
func (p *SASQueryParameters) Protocol() SASProtocol {
	return p.protocol
}
func (p *SASQueryParameters) StartTime() time.Time {
	return p.startTime
}
func (p *SASQueryParameters) ExpiryTime() time.Time {
	return p.expiryTime
}

func (p *SASQueryParameters) IPRange() IPRange {
	return p.ipRange
}

func (p *SASQueryParameters) Identifier() string {
	return p.identifier
}

func (p *SASQueryParameters) Resource() string {
	return p.resource
}
func (p *SASQueryParameters) Permissions() string {
	return p.permissions
}

func (p *SASQueryParameters) Signature() string {
	return p.signature
}

func (p *SASQueryParameters) CacheControl() string {
	return p.cacheControl
}

func (p *SASQueryParameters) ContentDisposition() string {
	return p.contentDisposition
}

func (p *SASQueryParameters) ContentEncoding() string {
	return p.contentEncoding
}

func (p *SASQueryParameters) ContentLanguage() string {
	return p.contentLanguage
}

func (p *SASQueryParameters) ContentType() string {
	return p.contentType
}

func (p *SASQueryParameters) SignedDirectoryDepth() string {
	return p.signedDirectoryDepth
}

// IPRange represents a SAS IP range's start IP and (optionally) end IP.
type IPRange struct {
	Start net.IP // Not specified if length = 0
	End   net.IP // Not specified if length = 0
}

// String returns a string representation of an IPRange.
func (ipr *IPRange) String() string {
	if len(ipr.Start) == 0 {
		return ""
	}
	start := ipr.Start.String()
	if len(ipr.End) == 0 {
		return start
	}
	return start + "-" + ipr.End.String()
}

// NewSASQueryParameters creates and initializes a SASQueryParameters object based on the
// query parameter map's passed-in values. If deleteSASParametersFromValues is true,
// all SAS-related query parameters are removed from the passed-in map. If
// deleteSASParametersFromValues is false, the map passed-in map is unaltered.
func newSASQueryParameters(values url.Values, deleteSASParametersFromValues bool) SASQueryParameters {
	p := SASQueryParameters{}
	for k, v := range values {
		val := v[0]
		isSASKey := true
		switch strings.ToLower(k) {
		case "sv":
			p.version = val
		case "ss":
			p.services = val
		case "srt":
			p.resourceTypes = val
		case "spr":
			p.protocol = SASProtocol(val)
		case "snapshot":
			p.snapshotTime, _ = time.Parse(SnapshotTimeFormat, val)
		case "st":
			p.startTime, p.stTimeFormat, _ = parseSASTimeString(val)
		case "se":
			p.expiryTime, p.seTimeFormat, _ = parseSASTimeString(val)
		case "sip":
			dashIndex := strings.Index(val, "-")
			if dashIndex == -1 {
				p.ipRange.Start = net.ParseIP(val)
			} else {
				p.ipRange.Start = net.ParseIP(val[:dashIndex])
				p.ipRange.End = net.ParseIP(val[dashIndex+1:])
			}
		case "si":
			p.identifier = val
		case "sr":
			p.resource = val
		case "sp":
			p.permissions = val
		case "sig":
			p.signature = val
		case "rscc":
			p.cacheControl = val
		case "rscd":
			p.contentDisposition = val
		case "rsce":
			p.contentEncoding = val
		case "rscl":
			p.contentLanguage = val
		case "rsct":
			p.contentType = val
		case "skoid":
			p.signedOid = val
		case "sktid":
			p.signedTid = val
		case "skt":
			p.signedStart, _ = time.Parse(SASTimeFormat, val)
		case "ske":
			p.signedExpiry, _ = time.Parse(SASTimeFormat, val)
		case "sks":
			p.signedService = val
		case "skv":
			p.signedVersion = val
		case "sdd":
			p.signedDirectoryDepth = val
		case "saoid":
			p.preauthorizedAgentObjectId = val
		case "suoid":
			p.agentObjectId = val
		case "scid":
			p.correlationId = val
		default:
			isSASKey = false // We didn't recognize the query parameter
		}
		if isSASKey && deleteSASParametersFromValues {
			delete(values, k)
		}
	}
	return p
}

// AddToValues adds the SAS components to the specified query parameters map.
func (p *SASQueryParameters) addToValues(v url.Values) url.Values {
	if p.version != "" {
		v.Add("sv", p.version)
	}
	if p.services != "" {
		v.Add("ss", p.services)
	}
	if p.resourceTypes != "" {
		v.Add("srt", p.resourceTypes)
	}
	if p.protocol != "" {
		v.Add("spr", string(p.protocol))
	}
	if !p.startTime.IsZero() {
		v.Add("st", formatSASTime(&(p.startTime), p.stTimeFormat))
	}
	if !p.expiryTime.IsZero() {
		v.Add("se", formatSASTime(&(p.expiryTime), p.seTimeFormat))
	}
	if len(p.ipRange.Start) > 0 {
		v.Add("sip", p.ipRange.String())
	}
	if p.identifier != "" {
		v.Add("si", p.identifier)
	}
	if p.resource != "" {
		v.Add("sr", p.resource)
	}
	if p.permissions != "" {
		v.Add("sp", p.permissions)
	}
	if p.signedOid != "" {
		v.Add("skoid", p.signedOid)
		v.Add("sktid", p.signedTid)
		v.Add("skt", p.signedStart.Format(SASTimeFormat))
		v.Add("ske", p.signedExpiry.Format(SASTimeFormat))
		v.Add("sks", p.signedService)
		v.Add("skv", p.signedVersion)
	}
	if p.signature != "" {
		v.Add("sig", p.signature)
	}
	if p.cacheControl != "" {
		v.Add("rscc", p.cacheControl)
	}
	if p.contentDisposition != "" {
		v.Add("rscd", p.contentDisposition)
	}
	if p.contentEncoding != "" {
		v.Add("rsce", p.contentEncoding)
	}
	if p.contentLanguage != "" {
		v.Add("rscl", p.contentLanguage)
	}
	if p.contentType != "" {
		v.Add("rsct", p.contentType)
	}
	if p.signedDirectoryDepth != "" {
		v.Add("sdd", p.signedDirectoryDepth)
	}
	if p.preauthorizedAgentObjectId != "" {
		v.Add("saoid", p.preauthorizedAgentObjectId)
	}
	if p.agentObjectId != "" {
		v.Add("suoid", p.agentObjectId)
	}
	if p.correlationId != "" {
		v.Add("scid", p.correlationId)
	}
	return v
}

// Encode encodes the SAS query parameters into URL encoded form sorted by key.
func (p *SASQueryParameters) Encode() string {
	v := url.Values{}
	p.addToValues(v)
	return v.Encode()
}
