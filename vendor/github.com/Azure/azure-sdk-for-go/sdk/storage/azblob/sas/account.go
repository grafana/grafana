//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package sas

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
)

// SharedKeyCredential contains an account's name and its primary or secondary key.
type SharedKeyCredential = exported.SharedKeyCredential

// UserDelegationCredential contains an account's name and its user delegation key.
type UserDelegationCredential = exported.UserDelegationCredential

// AccountSignatureValues is used to generate a Shared Access Signature (SAS) for an Azure Storage account.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/constructing-an-account-sas
type AccountSignatureValues struct {
	Version         string    `param:"sv"`  // If not specified, this format to SASVersion
	Protocol        Protocol  `param:"spr"` // See the SASProtocol* constants
	StartTime       time.Time `param:"st"`  // Not specified if IsZero
	ExpiryTime      time.Time `param:"se"`  // Not specified if IsZero
	Permissions     string    `param:"sp"`  // Create by initializing AccountPermissions and then call String()
	IPRange         IPRange   `param:"sip"`
	ResourceTypes   string    `param:"srt"` // Create by initializing AccountResourceTypes and then call String()
	EncryptionScope string    `param:"ses"`
}

// SignWithSharedKey uses an account's shared key credential to sign this signature values to produce
// the proper SAS query parameters.
func (v AccountSignatureValues) SignWithSharedKey(sharedKeyCredential *SharedKeyCredential) (QueryParameters, error) {
	// https://docs.microsoft.com/en-us/rest/api/storageservices/Constructing-an-Account-SAS
	if v.ExpiryTime.IsZero() || v.Permissions == "" || v.ResourceTypes == "" {
		return QueryParameters{}, errors.New("account SAS is missing at least one of these: ExpiryTime, Permissions, Service, or ResourceType")
	}
	if v.Version == "" {
		v.Version = Version
	}
	perms, err := parseAccountPermissions(v.Permissions)
	if err != nil {
		return QueryParameters{}, err
	}
	v.Permissions = perms.String()

	resources, err := parseAccountResourceTypes(v.ResourceTypes)
	if err != nil {
		return QueryParameters{}, err
	}
	v.ResourceTypes = resources.String()

	startTime, expiryTime, _ := formatTimesForSigning(v.StartTime, v.ExpiryTime, time.Time{})

	stringToSign := strings.Join([]string{
		sharedKeyCredential.AccountName(),
		v.Permissions,
		"b", // blob service
		v.ResourceTypes,
		startTime,
		expiryTime,
		v.IPRange.String(),
		string(v.Protocol),
		v.Version,
		v.EncryptionScope,
		""}, // That is right, the account SAS requires a terminating extra newline
		"\n")

	signature, err := exported.ComputeHMACSHA256(sharedKeyCredential, stringToSign)
	if err != nil {
		return QueryParameters{}, err
	}
	p := QueryParameters{
		// Common SAS parameters
		version:         v.Version,
		protocol:        v.Protocol,
		startTime:       v.StartTime,
		expiryTime:      v.ExpiryTime,
		permissions:     v.Permissions,
		ipRange:         v.IPRange,
		encryptionScope: v.EncryptionScope,

		// Account-specific SAS parameters
		services:      "b", // will always be "b"
		resourceTypes: v.ResourceTypes,

		// Calculated SAS signature
		signature: signature,
	}

	return p, nil
}

// AccountPermissions type simplifies creating the permissions string for an Azure Storage Account SAS.
// Initialize an instance of this type and then call its String method to set AccountSignatureValues' Permissions field.
type AccountPermissions struct {
	Read, Write, Delete, DeletePreviousVersion, PermanentDelete, List, Add, Create, Update, Process, FilterByTags, Tag, SetImmutabilityPolicy bool
}

// String produces the SAS permissions string for an Azure Storage account.
// Call this method to set AccountSignatureValues' Permissions field.
func (p *AccountPermissions) String() string {
	var buffer bytes.Buffer
	if p.Read {
		buffer.WriteRune('r')
	}
	if p.Write {
		buffer.WriteRune('w')
	}
	if p.Delete {
		buffer.WriteRune('d')
	}
	if p.DeletePreviousVersion {
		buffer.WriteRune('x')
	}
	if p.PermanentDelete {
		buffer.WriteRune('y')
	}
	if p.List {
		buffer.WriteRune('l')
	}
	if p.Add {
		buffer.WriteRune('a')
	}
	if p.Create {
		buffer.WriteRune('c')
	}
	if p.Update {
		buffer.WriteRune('u')
	}
	if p.Process {
		buffer.WriteRune('p')
	}
	if p.FilterByTags {
		buffer.WriteRune('f')
	}
	if p.Tag {
		buffer.WriteRune('t')
	}
	if p.SetImmutabilityPolicy {
		buffer.WriteRune('i')
	}
	return buffer.String()
}

// Parse initializes the AccountPermissions' fields from a string.
func parseAccountPermissions(s string) (AccountPermissions, error) {
	p := AccountPermissions{} // Clear out the flags
	for _, r := range s {
		switch r {
		case 'r':
			p.Read = true
		case 'w':
			p.Write = true
		case 'd':
			p.Delete = true
		case 'x':
			p.DeletePreviousVersion = true
		case 'y':
			p.PermanentDelete = true
		case 'l':
			p.List = true
		case 'a':
			p.Add = true
		case 'c':
			p.Create = true
		case 'u':
			p.Update = true
		case 'p':
			p.Process = true
		case 't':
			p.Tag = true
		case 'f':
			p.FilterByTags = true
		case 'i':
			p.SetImmutabilityPolicy = true
		default:
			return AccountPermissions{}, fmt.Errorf("invalid permission character: '%v'", r)
		}
	}
	return p, nil
}

// AccountResourceTypes type simplifies creating the resource types string for an Azure Storage Account SAS.
// Initialize an instance of this type and then call its String method to set AccountSignatureValues' ResourceTypes field.
type AccountResourceTypes struct {
	Service, Container, Object bool
}

// String produces the SAS resource types string for an Azure Storage account.
// Call this method to set AccountSignatureValues' ResourceTypes field.
func (rt *AccountResourceTypes) String() string {
	var buffer bytes.Buffer
	if rt.Service {
		buffer.WriteRune('s')
	}
	if rt.Container {
		buffer.WriteRune('c')
	}
	if rt.Object {
		buffer.WriteRune('o')
	}
	return buffer.String()
}

// parseAccountResourceTypes initializes the AccountResourceTypes' fields from a string.
func parseAccountResourceTypes(s string) (AccountResourceTypes, error) {
	rt := AccountResourceTypes{}
	for _, r := range s {
		switch r {
		case 's':
			rt.Service = true
		case 'c':
			rt.Container = true
		case 'o':
			rt.Object = true
		default:
			return AccountResourceTypes{}, fmt.Errorf("invalid resource type character: '%v'", r)
		}
	}
	return rt, nil
}
