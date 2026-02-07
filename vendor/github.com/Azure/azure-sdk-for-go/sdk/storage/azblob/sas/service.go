//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package sas

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
)

// BlobSignatureValues is used to generate a Shared Access Signature (SAS) for an Azure Storage container or blob.
// For more information on creating service sas, see https://docs.microsoft.com/rest/api/storageservices/constructing-a-service-sas
// For more information on creating user delegation sas, see https://docs.microsoft.com/rest/api/storageservices/create-user-delegation-sas
type BlobSignatureValues struct {
	Version              string    `param:"sv"`  // If not specified, this defaults to Version
	Protocol             Protocol  `param:"spr"` // See the Protocol* constants
	StartTime            time.Time `param:"st"`  // Not specified if IsZero
	ExpiryTime           time.Time `param:"se"`  // Not specified if IsZero
	SnapshotTime         time.Time
	Permissions          string  `param:"sp"` // Create by initializing ContainerPermissions or BlobPermissions and then call String()
	IPRange              IPRange `param:"sip"`
	Identifier           string  `param:"si"`
	ContainerName        string
	BlobName             string // Use "" to create a Container SAS
	Directory            string // Not nil for a directory SAS (ie sr=d)
	CacheControl         string // rscc
	ContentDisposition   string // rscd
	ContentEncoding      string // rsce
	ContentLanguage      string // rscl
	ContentType          string // rsct
	BlobVersion          string // sr=bv
	AuthorizedObjectID   string // saoid
	UnauthorizedObjectID string // suoid
	CorrelationID        string // scid
	EncryptionScope      string `param:"ses"`
}

func getDirectoryDepth(path string) string {
	if path == "" {
		return ""
	}
	return fmt.Sprint(strings.Count(path, "/") + 1)
}

// SignWithSharedKey uses an account's SharedKeyCredential to sign this signature values to produce the proper SAS query parameters.
func (v BlobSignatureValues) SignWithSharedKey(sharedKeyCredential *SharedKeyCredential) (QueryParameters, error) {
	if v.Identifier == "" && (v.ExpiryTime.IsZero() || v.Permissions == "") {
		return QueryParameters{}, errors.New("service SAS is missing at least one of these: ExpiryTime or Permissions")
	}

	// Parse the resource
	resource := "c"
	if !v.SnapshotTime.IsZero() {
		resource = "bs"
	} else if v.BlobVersion != "" {
		resource = "bv"
	} else if v.Directory != "" {
		resource = "d"
		v.BlobName = ""
	} else if v.BlobName == "" {
		// do nothing
	} else {
		resource = "b"
	}

	// make sure the permission characters are in the correct order
	if resource == "c" {
		perms, err := parseContainerPermissions(v.Permissions)
		if err != nil {
			return QueryParameters{}, err
		}
		v.Permissions = perms.String()
	} else {
		perms, err := parseBlobPermissions(v.Permissions)
		if err != nil {
			return QueryParameters{}, err
		}
		v.Permissions = perms.String()
	}

	if v.Version == "" {
		v.Version = Version
	}
	startTime, expiryTime, snapshotTime := formatTimesForSigning(v.StartTime, v.ExpiryTime, v.SnapshotTime)

	signedIdentifier := v.Identifier

	// String to sign: http://msdn.microsoft.com/en-us/library/azure/dn140255.aspx
	stringToSign := strings.Join([]string{
		v.Permissions,
		startTime,
		expiryTime,
		getCanonicalName(sharedKeyCredential.AccountName(), v.ContainerName, v.BlobName, v.Directory),
		signedIdentifier,
		v.IPRange.String(),
		string(v.Protocol),
		v.Version,
		resource,
		snapshotTime, // signed timestamp
		v.EncryptionScope,
		v.CacheControl,       // rscc
		v.ContentDisposition, // rscd
		v.ContentEncoding,    // rsce
		v.ContentLanguage,    // rscl
		v.ContentType},       // rsct
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

		// Container/Blob-specific SAS parameters
		resource:             resource,
		identifier:           v.Identifier,
		cacheControl:         v.CacheControl,
		contentDisposition:   v.ContentDisposition,
		contentEncoding:      v.ContentEncoding,
		contentLanguage:      v.ContentLanguage,
		contentType:          v.ContentType,
		snapshotTime:         v.SnapshotTime,
		signedDirectoryDepth: getDirectoryDepth(v.Directory),
		authorizedObjectID:   v.AuthorizedObjectID,
		unauthorizedObjectID: v.UnauthorizedObjectID,
		correlationID:        v.CorrelationID,
		// Calculated SAS signature
		signature: signature,
	}

	return p, nil
}

// SignWithUserDelegation uses an account's UserDelegationCredential to sign this signature values to produce the proper SAS query parameters.
func (v BlobSignatureValues) SignWithUserDelegation(userDelegationCredential *UserDelegationCredential) (QueryParameters, error) {
	if userDelegationCredential == nil {
		return QueryParameters{}, fmt.Errorf("cannot sign SAS query without User Delegation Key")
	}

	if v.ExpiryTime.IsZero() || v.Permissions == "" {
		return QueryParameters{}, errors.New("user delegation SAS is missing at least one of these: ExpiryTime or Permissions")
	}

	// Parse the resource
	resource := "c"
	if !v.SnapshotTime.IsZero() {
		resource = "bs"
	} else if v.BlobVersion != "" {
		resource = "bv"
	} else if v.Directory != "" {
		resource = "d"
		v.BlobName = ""
	} else if v.BlobName == "" {
		// do nothing
	} else {
		resource = "b"
	}
	// make sure the permission characters are in the correct order
	if resource == "c" {
		perms, err := parseContainerPermissions(v.Permissions)
		if err != nil {
			return QueryParameters{}, err
		}
		v.Permissions = perms.String()
	} else {
		perms, err := parseBlobPermissions(v.Permissions)
		if err != nil {
			return QueryParameters{}, err
		}
		v.Permissions = perms.String()
	}

	if v.Version == "" {
		v.Version = Version
	}
	startTime, expiryTime, snapshotTime := formatTimesForSigning(v.StartTime, v.ExpiryTime, v.SnapshotTime)

	udk := exported.GetUDKParams(userDelegationCredential)

	udkStart, udkExpiry, _ := formatTimesForSigning(*udk.SignedStart, *udk.SignedExpiry, time.Time{})

	stringToSign := strings.Join([]string{
		v.Permissions,
		startTime,
		expiryTime,
		getCanonicalName(exported.GetAccountName(userDelegationCredential), v.ContainerName, v.BlobName, v.Directory),
		*udk.SignedOID,
		*udk.SignedTID,
		udkStart,
		udkExpiry,
		*udk.SignedService,
		*udk.SignedVersion,
		v.AuthorizedObjectID,
		v.UnauthorizedObjectID,
		v.CorrelationID,
		v.IPRange.String(),
		string(v.Protocol),
		v.Version,
		resource,
		snapshotTime, // signed timestamp
		v.EncryptionScope,
		v.CacheControl,       // rscc
		v.ContentDisposition, // rscd
		v.ContentEncoding,    // rsce
		v.ContentLanguage,    // rscl
		v.ContentType},       // rsct
		"\n")

	signature, err := exported.ComputeUDCHMACSHA256(userDelegationCredential, stringToSign)
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

		// Container/Blob-specific SAS parameters
		resource:             resource,
		identifier:           v.Identifier,
		cacheControl:         v.CacheControl,
		contentDisposition:   v.ContentDisposition,
		contentEncoding:      v.ContentEncoding,
		contentLanguage:      v.ContentLanguage,
		contentType:          v.ContentType,
		snapshotTime:         v.SnapshotTime,
		signedDirectoryDepth: getDirectoryDepth(v.Directory),
		authorizedObjectID:   v.AuthorizedObjectID,
		unauthorizedObjectID: v.UnauthorizedObjectID,
		correlationID:        v.CorrelationID,
		// Calculated SAS signature
		signature: signature,
	}

	// User delegation SAS specific parameters
	p.signedOID = *udk.SignedOID
	p.signedTID = *udk.SignedTID
	p.signedStart = *udk.SignedStart
	p.signedExpiry = *udk.SignedExpiry
	p.signedService = *udk.SignedService
	p.signedVersion = *udk.SignedVersion

	return p, nil
}

// getCanonicalName computes the canonical name for a container or blob resource for SAS signing.
func getCanonicalName(account string, containerName string, blobName string, directoryName string) string {
	// Container: "/blob/account/containername"
	// Blob:      "/blob/account/containername/blobname"
	elements := []string{"/blob/", account, "/", containerName}
	if blobName != "" {
		elements = append(elements, "/", strings.ReplaceAll(blobName, "\\", "/"))
	} else if directoryName != "" {
		elements = append(elements, "/", directoryName)
	}
	return strings.Join(elements, "")
}

// ContainerPermissions type simplifies creating the permissions string for an Azure Storage container SAS.
// Initialize an instance of this type and then call its String method to set BlobSignatureValues' Permissions field.
// All permissions descriptions can be found here: https://docs.microsoft.com/en-us/rest/api/storageservices/create-service-sas#permissions-for-a-directory-container-or-blob
type ContainerPermissions struct {
	Read, Add, Create, Write, Delete, DeletePreviousVersion, List, Tag, FilterByTags, Move, SetImmutabilityPolicy bool
	Execute, ModifyOwnership, ModifyPermissions                                                                   bool // Meant for hierarchical namespace accounts
}

// String produces the SAS permissions string for an Azure Storage container.
// Call this method to set BlobSignatureValues' Permissions field.
func (p *ContainerPermissions) String() string {
	var b bytes.Buffer
	if p.Read {
		b.WriteRune('r')
	}
	if p.Add {
		b.WriteRune('a')
	}
	if p.Create {
		b.WriteRune('c')
	}
	if p.Write {
		b.WriteRune('w')
	}
	if p.Delete {
		b.WriteRune('d')
	}
	if p.DeletePreviousVersion {
		b.WriteRune('x')
	}
	if p.List {
		b.WriteRune('l')
	}
	if p.Tag {
		b.WriteRune('t')
	}
	if p.FilterByTags {
		b.WriteRune('f')
	}
	if p.Move {
		b.WriteRune('m')
	}
	if p.Execute {
		b.WriteRune('e')
	}
	if p.ModifyOwnership {
		b.WriteRune('o')
	}
	if p.ModifyPermissions {
		b.WriteRune('p')
	}
	if p.SetImmutabilityPolicy {
		b.WriteRune('i')
	}
	return b.String()
}

// Parse initializes ContainerPermissions' fields from a string.
func parseContainerPermissions(s string) (ContainerPermissions, error) {
	p := ContainerPermissions{} // Clear the flags
	for _, r := range s {
		switch r {
		case 'r':
			p.Read = true
		case 'a':
			p.Add = true
		case 'c':
			p.Create = true
		case 'w':
			p.Write = true
		case 'd':
			p.Delete = true
		case 'x':
			p.DeletePreviousVersion = true
		case 'l':
			p.List = true
		case 't':
			p.Tag = true
		case 'f':
			p.FilterByTags = true
		case 'm':
			p.Move = true
		case 'e':
			p.Execute = true
		case 'o':
			p.ModifyOwnership = true
		case 'p':
			p.ModifyPermissions = true
		case 'i':
			p.SetImmutabilityPolicy = true
		default:
			return ContainerPermissions{}, fmt.Errorf("invalid permission: '%v'", r)
		}
	}
	return p, nil
}

// BlobPermissions type simplifies creating the permissions string for an Azure Storage blob SAS.
// Initialize an instance of this type and then call its String method to set BlobSignatureValues' Permissions field.
type BlobPermissions struct {
	Read, Add, Create, Write, Delete, DeletePreviousVersion, PermanentDelete, List, Tag, Move, Execute, Ownership, Permissions, SetImmutabilityPolicy bool
}

// String produces the SAS permissions string for an Azure Storage blob.
// Call this method to set BlobSignatureValues' Permissions field.
func (p *BlobPermissions) String() string {
	var b bytes.Buffer
	if p.Read {
		b.WriteRune('r')
	}
	if p.Add {
		b.WriteRune('a')
	}
	if p.Create {
		b.WriteRune('c')
	}
	if p.Write {
		b.WriteRune('w')
	}
	if p.Delete {
		b.WriteRune('d')
	}
	if p.DeletePreviousVersion {
		b.WriteRune('x')
	}
	if p.PermanentDelete {
		b.WriteRune('y')
	}
	if p.List {
		b.WriteRune('l')
	}
	if p.Tag {
		b.WriteRune('t')
	}
	if p.Move {
		b.WriteRune('m')
	}
	if p.Execute {
		b.WriteRune('e')
	}
	if p.Ownership {
		b.WriteRune('o')
	}
	if p.Permissions {
		b.WriteRune('p')
	}
	if p.SetImmutabilityPolicy {
		b.WriteRune('i')
	}
	return b.String()
}

// Parse initializes BlobPermissions' fields from a string.
func parseBlobPermissions(s string) (BlobPermissions, error) {
	p := BlobPermissions{} // Clear the flags
	for _, r := range s {
		switch r {
		case 'r':
			p.Read = true
		case 'a':
			p.Add = true
		case 'c':
			p.Create = true
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
		case 't':
			p.Tag = true
		case 'm':
			p.Move = true
		case 'e':
			p.Execute = true
		case 'o':
			p.Ownership = true
		case 'p':
			p.Permissions = true
		case 'i':
			p.SetImmutabilityPolicy = true
		default:
			return BlobPermissions{}, fmt.Errorf("invalid permission: '%v'", r)
		}
	}
	return p, nil
}
