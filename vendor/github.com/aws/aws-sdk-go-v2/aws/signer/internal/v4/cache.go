package v4

import (
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
)

func lookupKey(service, region string) string {
	var s strings.Builder
	s.Grow(len(region) + len(service) + 3)
	s.WriteString(region)
	s.WriteRune('/')
	s.WriteString(service)
	return s.String()
}

type derivedKey struct {
	AccessKey  string
	Date       time.Time
	Credential []byte
}

type derivedKeyCache struct {
	values map[string]derivedKey
	mutex  sync.RWMutex
}

func newDerivedKeyCache() derivedKeyCache {
	return derivedKeyCache{
		values: make(map[string]derivedKey),
	}
}

func (s *derivedKeyCache) Get(credentials aws.Credentials, service, region string, signingTime SigningTime) []byte {
	key := lookupKey(service, region)
	s.mutex.RLock()
	if cred, ok := s.get(key, credentials, signingTime.Time); ok {
		s.mutex.RUnlock()
		return cred
	}
	s.mutex.RUnlock()

	s.mutex.Lock()
	if cred, ok := s.get(key, credentials, signingTime.Time); ok {
		s.mutex.Unlock()
		return cred
	}
	cred := deriveKey(credentials.SecretAccessKey, service, region, signingTime)
	entry := derivedKey{
		AccessKey:  credentials.AccessKeyID,
		Date:       signingTime.Time,
		Credential: cred,
	}
	s.values[key] = entry
	s.mutex.Unlock()

	return cred
}

func (s *derivedKeyCache) get(key string, credentials aws.Credentials, signingTime time.Time) ([]byte, bool) {
	cacheEntry, ok := s.retrieveFromCache(key)
	if ok && cacheEntry.AccessKey == credentials.AccessKeyID && isSameDay(signingTime, cacheEntry.Date) {
		return cacheEntry.Credential, true
	}
	return nil, false
}

func (s *derivedKeyCache) retrieveFromCache(key string) (derivedKey, bool) {
	if v, ok := s.values[key]; ok {
		return v, true
	}
	return derivedKey{}, false
}

// SigningKeyDeriver derives a signing key from a set of credentials
type SigningKeyDeriver struct {
	cache derivedKeyCache
}

// NewSigningKeyDeriver returns a new SigningKeyDeriver
func NewSigningKeyDeriver() *SigningKeyDeriver {
	return &SigningKeyDeriver{
		cache: newDerivedKeyCache(),
	}
}

// DeriveKey returns a derived signing key from the given credentials to be used with SigV4 signing.
func (k *SigningKeyDeriver) DeriveKey(credential aws.Credentials, service, region string, signingTime SigningTime) []byte {
	return k.cache.Get(credential, service, region, signingTime)
}

func deriveKey(secret, service, region string, t SigningTime) []byte {
	hmacDate := HMACSHA256([]byte("AWS4"+secret), []byte(t.ShortTimeFormat()))
	hmacRegion := HMACSHA256(hmacDate, []byte(region))
	hmacService := HMACSHA256(hmacRegion, []byte(service))
	return HMACSHA256(hmacService, []byte("aws4_request"))
}

func isSameDay(x, y time.Time) bool {
	xYear, xMonth, xDay := x.Date()
	yYear, yMonth, yDay := y.Date()

	if xYear != yYear {
		return false
	}

	if xMonth != yMonth {
		return false
	}

	return xDay == yDay
}
