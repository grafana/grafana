// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

import (
	"encoding"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/go-openapi/errors"
	"github.com/go-viper/mapstructure/v2"
)

// Default is the default formats registry
var Default = NewSeededFormats(nil, nil)

// Validator represents a validator for a string format.
type Validator func(string) bool

// NewFormats creates a new formats registry seeded with the values from the default
func NewFormats() Registry {
	//nolint:forcetypeassert
	return NewSeededFormats(Default.(*defaultFormats).data, nil)
}

// NewSeededFormats creates a new formats registry
func NewSeededFormats(seeds []knownFormat, normalizer NameNormalizer) Registry {
	if normalizer == nil {
		normalizer = DefaultNameNormalizer
	}
	// copy here, don't modify the  original
	return &defaultFormats{
		data:          slices.Clone(seeds),
		normalizeName: normalizer,
	}
}

type knownFormat struct {
	Name      string
	OrigName  string
	Type      reflect.Type
	Validator Validator
}

// NameNormalizer is a function that normalizes a format name.
type NameNormalizer func(string) string

// DefaultNameNormalizer removes all dashes
func DefaultNameNormalizer(name string) string {
	return strings.ReplaceAll(name, "-", "")
}

type defaultFormats struct {
	sync.Mutex

	data          []knownFormat
	normalizeName NameNormalizer
}

// MapStructureHookFunc is a decode hook function for mapstructure
func (f *defaultFormats) MapStructureHookFunc() mapstructure.DecodeHookFunc {
	return func(from reflect.Type, to reflect.Type, obj any) (any, error) {
		if from.Kind() != reflect.String {
			return obj, nil
		}
		data, ok := obj.(string)
		if !ok {
			return nil, fmt.Errorf("failed to cast %+v to string: %w", obj, ErrFormat)
		}

		for _, v := range f.data {
			tpe, _ := f.GetType(v.Name)
			if to == tpe {
				switch v.Name {
				case "date":
					d, err := time.ParseInLocation(RFC3339FullDate, data, DefaultTimeLocation)
					if err != nil {
						return nil, err
					}
					return Date(d), nil
				case "datetime":
					input := data
					if len(input) == 0 {
						return nil, fmt.Errorf("empty string is an invalid datetime format: %w", ErrFormat)
					}
					return ParseDateTime(input)
				case "duration":
					dur, err := ParseDuration(data)
					if err != nil {
						return nil, err
					}
					return Duration(dur), nil
				case "uri":
					return URI(data), nil
				case "email":
					return Email(data), nil
				case "uuid":
					return UUID(data), nil
				case "uuid3":
					return UUID3(data), nil
				case "uuid4":
					return UUID4(data), nil
				case "uuid5":
					return UUID5(data), nil
				case "uuid7":
					return UUID7(data), nil
				case "hostname":
					return Hostname(data), nil
				case "ipv4":
					return IPv4(data), nil
				case "ipv6":
					return IPv6(data), nil
				case "cidr":
					return CIDR(data), nil
				case "mac":
					return MAC(data), nil
				case "isbn":
					return ISBN(data), nil
				case "isbn10":
					return ISBN10(data), nil
				case "isbn13":
					return ISBN13(data), nil
				case "creditcard":
					return CreditCard(data), nil
				case "ssn":
					return SSN(data), nil
				case "hexcolor":
					return HexColor(data), nil
				case "rgbcolor":
					return RGBColor(data), nil
				case "byte":
					return Base64(data), nil
				case "password":
					return Password(data), nil
				case "ulid":
					ulid, err := ParseULID(data)
					if err != nil {
						return nil, err
					}
					return ulid, nil
				default:
					return nil, errors.InvalidTypeName(v.Name)
				}
			}
		}
		return data, nil
	}
}

// Add adds a new format, return true if this was a new item instead of a replacement
func (f *defaultFormats) Add(name string, strfmt Format, validator Validator) bool {
	f.Lock()
	defer f.Unlock()

	nme := f.normalizeName(name)

	tpe := reflect.TypeOf(strfmt)
	if tpe.Kind() == reflect.Ptr {
		tpe = tpe.Elem()
	}

	for i := range f.data {
		v := &f.data[i]
		if v.Name == nme {
			v.Type = tpe
			v.Validator = validator
			return false
		}
	}

	// turns out it's new after all
	f.data = append(f.data, knownFormat{Name: nme, OrigName: name, Type: tpe, Validator: validator})
	return true
}

// GetType gets the type for the specified name
func (f *defaultFormats) GetType(name string) (reflect.Type, bool) {
	f.Lock()
	defer f.Unlock()
	nme := f.normalizeName(name)
	for _, v := range f.data {
		if v.Name == nme {
			return v.Type, true
		}
	}
	return nil, false
}

// DelByName removes the format by the specified name, returns true when an item was actually removed
func (f *defaultFormats) DelByName(name string) bool {
	f.Lock()
	defer f.Unlock()

	nme := f.normalizeName(name)

	for i, v := range f.data {
		if v.Name == nme {
			f.data[i] = knownFormat{} // release
			f.data = append(f.data[:i], f.data[i+1:]...)
			return true
		}
	}
	return false
}

// DelByFormat removes the specified format, returns true when an item was actually removed
func (f *defaultFormats) DelByFormat(strfmt Format) bool {
	f.Lock()
	defer f.Unlock()

	tpe := reflect.TypeOf(strfmt)
	if tpe.Kind() == reflect.Ptr {
		tpe = tpe.Elem()
	}

	for i, v := range f.data {
		if v.Type == tpe {
			f.data[i] = knownFormat{} // release
			f.data = append(f.data[:i], f.data[i+1:]...)
			return true
		}
	}
	return false
}

// ContainsName returns true if this registry contains the specified name
func (f *defaultFormats) ContainsName(name string) bool {
	f.Lock()
	defer f.Unlock()
	nme := f.normalizeName(name)
	for _, v := range f.data {
		if v.Name == nme {
			return true
		}
	}
	return false
}

// ContainsFormat returns true if this registry contains the specified format
func (f *defaultFormats) ContainsFormat(strfmt Format) bool {
	f.Lock()
	defer f.Unlock()
	tpe := reflect.TypeOf(strfmt)
	if tpe.Kind() == reflect.Ptr {
		tpe = tpe.Elem()
	}

	for _, v := range f.data {
		if v.Type == tpe {
			return true
		}
	}
	return false
}

// Validates passed data against format.
//
// Note that the format name is automatically normalized, e.g. one may
// use "date-time" to use the "datetime" format validator.
func (f *defaultFormats) Validates(name, data string) bool {
	f.Lock()
	defer f.Unlock()
	nme := f.normalizeName(name)
	for _, v := range f.data {
		if v.Name == nme {
			return v.Validator(data)
		}
	}
	return false
}

// Parse a string into the appropriate format representation type.
//
// E.g. parsing a string a "date" will return a Date type.
func (f *defaultFormats) Parse(name, data string) (any, error) {
	f.Lock()
	defer f.Unlock()
	nme := f.normalizeName(name)
	for _, v := range f.data {
		if v.Name == nme {
			nw := reflect.New(v.Type).Interface()
			if dec, ok := nw.(encoding.TextUnmarshaler); ok {
				if err := dec.UnmarshalText([]byte(data)); err != nil {
					return nil, err
				}
				return nw, nil
			}
			return nil, errors.InvalidTypeName(name)
		}
	}
	return nil, errors.InvalidTypeName(name)
}
