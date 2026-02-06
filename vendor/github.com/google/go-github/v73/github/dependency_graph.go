// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

type DependencyGraphService service

// SBOM represents a software bill of materials, which describes the
// packages/libraries that a repository depends on.
type SBOM struct {
	SBOM *SBOMInfo `json:"sbom,omitempty"`
}

// CreationInfo represents when the SBOM was created and who created it.
type CreationInfo struct {
	Created  *Timestamp `json:"created,omitempty"`
	Creators []string   `json:"creators,omitempty"`
}

// RepoDependencies represents the dependencies of a repo.
type RepoDependencies struct {
	SPDXID *string `json:"SPDXID,omitempty"`
	// Package name
	Name             *string               `json:"name,omitempty"`
	VersionInfo      *string               `json:"versionInfo,omitempty"`
	DownloadLocation *string               `json:"downloadLocation,omitempty"`
	FilesAnalyzed    *bool                 `json:"filesAnalyzed,omitempty"`
	LicenseConcluded *string               `json:"licenseConcluded,omitempty"`
	LicenseDeclared  *string               `json:"licenseDeclared,omitempty"`
	ExternalRefs     []*PackageExternalRef `json:"externalRefs,omitempty"`
}

// PackageExternalRef allows an Package to reference an external sources of additional information,
// like asset identifiers, or downloadable content that are relevant to the package,
// Example for identifiers (e.g., PURL/SWID/CPE) for a package in the SBOM.
// https://spdx.github.io/spdx-spec/v2.3/package-information/#721-external-reference-field
type PackageExternalRef struct {
	// ReferenceCategory specifies the external reference categories such
	// SECURITY", "PACKAGE-MANAGER", "PERSISTENT-ID", or "OTHER"
	// Example: "PACKAGE-MANAGER"
	ReferenceCategory string `json:"referenceCategory"`

	// ReferenceType specifies the type of external reference.
	// For PACKAGE-MANAGER, it could be "purl"; other types include "cpe22Type", "swid", etc.
	ReferenceType string `json:"referenceType"`

	// ReferenceLocator is the actual unique identifier or URI for the external reference.
	// Example: "pkg:golang/github.com/spf13/cobra@1.8.1"
	ReferenceLocator string `json:"referenceLocator"`
}

// SBOMRelationship provides information about the relationship between two SPDX elements.
// Element could be packages or files in the SBOM.
// For example, to represent a relationship between two different Files, between a Package and a File,
// between two Packages, or between one SPDXDocument and another SPDXDocument.
// https://spdx.github.io/spdx-spec/v2.3/relationships-between-SPDX-elements/
type SBOMRelationship struct {
	// SPDXElementID is the identifier of the SPDX element that has a relationship.
	// Example: "SPDXRef-github-interlynk-io-sbomqs-main-f43c98"
	SPDXElementID string `json:"spdxElementId"`

	// RelatedSpdxElement is the identifier of the related SPDX element.
	// Example: "SPDXRef-golang-github.comspf13-cobra-1.8.1-75c946"
	RelatedSPDXElement string `json:"relatedSpdxElement"`

	// RelationshipType describes the type of relationship between the two elements.
	// Such as "DEPENDS_ON", "DESCRIBES", "CONTAINS", etc., as defined by SPDX 2.3.
	// Example: "DEPENDS_ON", "CONTAINS", "DESCRIBES", etc.
	RelationshipType string `json:"relationshipType"`
}

// SBOMInfo represents a software bill of materials (SBOM) using SPDX.
// SPDX is an open standard for SBOMs that
// identifies and catalogs components, licenses, copyrights, security
// references, and other metadata relating to software.
type SBOMInfo struct {
	SPDXID       *string       `json:"SPDXID,omitempty"`
	SPDXVersion  *string       `json:"spdxVersion,omitempty"`
	CreationInfo *CreationInfo `json:"creationInfo,omitempty"`

	// Repo name
	Name              *string  `json:"name,omitempty"`
	DataLicense       *string  `json:"dataLicense,omitempty"`
	DocumentDescribes []string `json:"documentDescribes,omitempty"`
	DocumentNamespace *string  `json:"documentNamespace,omitempty"`

	// List of packages dependencies
	Packages []*RepoDependencies `json:"packages,omitempty"`

	// List of relationships between packages
	Relationships []*SBOMRelationship `json:"relationships,omitempty"`
}

func (s SBOM) String() string {
	return Stringify(s)
}

// GetSBOM fetches the software bill of materials for a repository.
//
// GitHub API docs: https://docs.github.com/rest/dependency-graph/sboms#export-a-software-bill-of-materials-sbom-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/dependency-graph/sbom
func (s *DependencyGraphService) GetSBOM(ctx context.Context, owner, repo string) (*SBOM, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/dependency-graph/sbom", owner, repo)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var sbom *SBOM
	resp, err := s.client.Do(ctx, req, &sbom)
	if err != nil {
		return nil, resp, err
	}

	return sbom, resp, nil
}
