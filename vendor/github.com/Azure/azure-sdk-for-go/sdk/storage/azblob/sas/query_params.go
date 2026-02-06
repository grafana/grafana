//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package sas

import (
	"errors"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
)

// TimeFormat represents the format of a SAS start or expiry time. Use it when formatting/parsing a time.Time.
const (
	TimeFormat = "2006-01-02T15:04:05Z" // "2017-07-27T00:00:00Z" // ISO 8601
)

var (
	// Version is the default version encoded in the SAS token.
	Version = generated.ServiceVersion
)

// TimeFormats ISO 8601 format.
// Please refer to https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas for more details.
var timeFormats = []string{"2006-01-02T15:04:05.0000000Z", TimeFormat, "2006-01-02T15:04Z", "2006-01-02"}

// Protocol indicates the http/https.
type Protocol string

const (
	// ProtocolHTTPS can be specified for a SAS protocol.
	ProtocolHTTPS Protocol = "https"

	// ProtocolHTTPSandHTTP can be specified for a SAS protocol.
	ProtocolHTTPSandHTTP Protocol = "https,http"
)

// FormatTimesForSigning converts a time.Time to a snapshotTimeFormat string suitable for a
// Field's StartTime or ExpiryTime fields. Returns "" if value.IsZero().
func formatTimesForSigning(startTime, expiryTime, snapshotTime time.Time) (string, string, string) {
	ss := ""
	if !startTime.IsZero() {
		ss = formatTimeWithDefaultFormat(&startTime)
	}
	se := ""
	if !expiryTime.IsZero() {
		se = formatTimeWithDefaultFormat(&expiryTime)
	}
	sh := ""
	if !snapshotTime.IsZero() {
		sh = snapshotTime.Format(exported.SnapshotTimeFormat)
	}
	return ss, se, sh
}

// formatTimeWithDefaultFormat format time with ISO 8601 in "yyyy-MM-ddTHH:mm:ssZ".
func formatTimeWithDefaultFormat(t *time.Time) string {
	return formatTime(t, TimeFormat) // By default, "yyyy-MM-ddTHH:mm:ssZ" is used
}

// formatTime format time with given format, use ISO 8601 in "yyyy-MM-ddTHH:mm:ssZ" by default.
func formatTime(t *time.Time, format string) string {
	if format != "" {
		return t.Format(format)
	}
	return t.Format(TimeFormat) // By default, "yyyy-MM-ddTHH:mm:ssZ" is used
}

// ParseTime try to parse a SAS time string.
func parseTime(val string) (t time.Time, timeFormat string, err error) {
	for _, sasTimeFormat := range timeFormats {
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

// https://docs.microsoft.com/en-us/rest/api/storageservices/constructing-a-service-sas

// QueryParameters object represents the components that make up an Azure Storage SAS' query parameters.
// You parse a map of query parameters into its fields by calling NewQueryParameters(). You add the components
// to a query parameter map by calling AddToValues().
// NOTE: Changing any field requires computing a new SAS signature using a XxxSASSignatureValues type.
// This type defines the components used by all Azure Storage resources (Containers, Blobs, Files, & Queues).
type QueryParameters struct {
	// All members are immutable or values so copies of this struct are goroutine-safe.
	version              string    `param:"sv"`
	services             string    `param:"ss"`
	resourceTypes        string    `param:"srt"`
	protocol             Protocol  `param:"spr"`
	startTime            time.Time `param:"st"`
	expiryTime           time.Time `param:"se"`
	snapshotTime         time.Time `param:"snapshot"`
	ipRange              IPRange   `param:"sip"`
	identifier           string    `param:"si"`
	resource             string    `param:"sr"`
	permissions          string    `param:"sp"`
	signature            string    `param:"sig"`
	cacheControl         string    `param:"rscc"`
	contentDisposition   string    `param:"rscd"`
	contentEncoding      string    `param:"rsce"`
	contentLanguage      string    `param:"rscl"`
	contentType          string    `param:"rsct"`
	signedOID            string    `param:"skoid"`
	signedTID            string    `param:"sktid"`
	signedStart          time.Time `param:"skt"`
	signedService        string    `param:"sks"`
	signedExpiry         time.Time `param:"ske"`
	signedVersion        string    `param:"skv"`
	signedDirectoryDepth string    `param:"sdd"`
	authorizedObjectID   string    `param:"saoid"`
	unauthorizedObjectID string    `param:"suoid"`
	correlationID        string    `param:"scid"`
	encryptionScope      string    `param:"ses"`
	// private member used for startTime and expiryTime formatting.
	stTimeFormat string
	seTimeFormat string
}

// AuthorizedObjectID returns authorizedObjectID.
func (p *QueryParameters) AuthorizedObjectID() string {
	return p.authorizedObjectID
}

// UnauthorizedObjectID returns unauthorizedObjectID.
func (p *QueryParameters) UnauthorizedObjectID() string {
	return p.unauthorizedObjectID
}

// SignedCorrelationID returns signedCorrelationID.
func (p *QueryParameters) SignedCorrelationID() string {
	return p.correlationID
}

// EncryptionScope returns encryptionScope
func (p *QueryParameters) EncryptionScope() string {
	return p.encryptionScope
}

// SignedOID returns signedOID.
func (p *QueryParameters) SignedOID() string {
	return p.signedOID
}

// SignedTID returns signedTID.
func (p *QueryParameters) SignedTID() string {
	return p.signedTID
}

// SignedStart returns signedStart.
func (p *QueryParameters) SignedStart() time.Time {
	return p.signedStart
}

// SignedExpiry returns signedExpiry.
func (p *QueryParameters) SignedExpiry() time.Time {
	return p.signedExpiry
}

// SignedService returns signedService.
func (p *QueryParameters) SignedService() string {
	return p.signedService
}

// SignedVersion returns signedVersion.
func (p *QueryParameters) SignedVersion() string {
	return p.signedVersion
}

// SnapshotTime returns snapshotTime.
func (p *QueryParameters) SnapshotTime() time.Time {
	return p.snapshotTime
}

// Version returns version.
func (p *QueryParameters) Version() string {
	return p.version
}

// Services returns services.
func (p *QueryParameters) Services() string {
	return p.services
}

// ResourceTypes returns resourceTypes.
func (p *QueryParameters) ResourceTypes() string {
	return p.resourceTypes
}

// Protocol returns protocol.
func (p *QueryParameters) Protocol() Protocol {
	return p.protocol
}

// StartTime returns startTime.
func (p *QueryParameters) StartTime() time.Time {
	return p.startTime
}

// ExpiryTime returns expiryTime.
func (p *QueryParameters) ExpiryTime() time.Time {
	return p.expiryTime
}

// IPRange returns ipRange.
func (p *QueryParameters) IPRange() IPRange {
	return p.ipRange
}

// Identifier returns identifier.
func (p *QueryParameters) Identifier() string {
	return p.identifier
}

// Resource returns resource.
func (p *QueryParameters) Resource() string {
	return p.resource
}

// Permissions returns permissions.
func (p *QueryParameters) Permissions() string {
	return p.permissions
}

// Signature returns signature.
func (p *QueryParameters) Signature() string {
	return p.signature
}

// CacheControl returns cacheControl.
func (p *QueryParameters) CacheControl() string {
	return p.cacheControl
}

// ContentDisposition returns contentDisposition.
func (p *QueryParameters) ContentDisposition() string {
	return p.contentDisposition
}

// ContentEncoding returns contentEncoding.
func (p *QueryParameters) ContentEncoding() string {
	return p.contentEncoding
}

// ContentLanguage returns contentLanguage.
func (p *QueryParameters) ContentLanguage() string {
	return p.contentLanguage
}

// ContentType returns contentType.
func (p *QueryParameters) ContentType() string {
	return p.contentType
}

// SignedDirectoryDepth returns signedDirectoryDepth.
func (p *QueryParameters) SignedDirectoryDepth() string {
	return p.signedDirectoryDepth
}

// Encode encodes the SAS query parameters into URL encoded form sorted by key.
func (p *QueryParameters) Encode() string {
	v := url.Values{}

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
		v.Add("st", formatTime(&(p.startTime), p.stTimeFormat))
	}
	if !p.expiryTime.IsZero() {
		v.Add("se", formatTime(&(p.expiryTime), p.seTimeFormat))
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
	if p.signedOID != "" {
		v.Add("skoid", p.signedOID)
		v.Add("sktid", p.signedTID)
		v.Add("skt", p.signedStart.Format(TimeFormat))
		v.Add("ske", p.signedExpiry.Format(TimeFormat))
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
	if p.authorizedObjectID != "" {
		v.Add("saoid", p.authorizedObjectID)
	}
	if p.unauthorizedObjectID != "" {
		v.Add("suoid", p.unauthorizedObjectID)
	}
	if p.correlationID != "" {
		v.Add("scid", p.correlationID)
	}
	if p.encryptionScope != "" {
		v.Add("ses", p.encryptionScope)
	}

	return v.Encode()
}

// NewQueryParameters creates and initializes a QueryParameters object based on the
// query parameter map's passed-in values. If deleteSASParametersFromValues is true,
// all SAS-related query parameters are removed from the passed-in map. If
// deleteSASParametersFromValues is false, the map passed-in map is unaltered.
func NewQueryParameters(values url.Values, deleteSASParametersFromValues bool) QueryParameters {
	p := QueryParameters{}
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
			p.protocol = Protocol(val)
		case "snapshot":
			p.snapshotTime, _ = time.Parse(exported.SnapshotTimeFormat, val)
		case "st":
			p.startTime, p.stTimeFormat, _ = parseTime(val)
		case "se":
			p.expiryTime, p.seTimeFormat, _ = parseTime(val)
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
			p.signedOID = val
		case "sktid":
			p.signedTID = val
		case "skt":
			p.signedStart, _ = time.Parse(TimeFormat, val)
		case "ske":
			p.signedExpiry, _ = time.Parse(TimeFormat, val)
		case "sks":
			p.signedService = val
		case "skv":
			p.signedVersion = val
		case "sdd":
			p.signedDirectoryDepth = val
		case "saoid":
			p.authorizedObjectID = val
		case "suoid":
			p.unauthorizedObjectID = val
		case "scid":
			p.correlationID = val
		case "ses":
			p.encryptionScope = val
		default:
			isSASKey = false // We didn't recognize the query parameter
		}
		if isSASKey && deleteSASParametersFromValues {
			delete(values, k)
		}
	}
	return p
}
