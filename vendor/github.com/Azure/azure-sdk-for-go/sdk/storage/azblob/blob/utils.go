//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blob

import (
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
)

// ObjectReplicationRules struct
type ObjectReplicationRules struct {
	RuleID string
	Status string
}

// ObjectReplicationPolicy are deserialized attributes.
type ObjectReplicationPolicy struct {
	PolicyID *string
	Rules    *[]ObjectReplicationRules
}

// deserializeORSPolicies is utility function to deserialize ORS Policies.
func deserializeORSPolicies(policies map[string]*string) (objectReplicationPolicies []ObjectReplicationPolicy) {
	if policies == nil {
		return nil
	}
	// For source blobs (blobs that have policy ids and rule ids applied to them),
	// the header will be formatted as "x-ms-or-<policy_id>_<rule_id>: {Complete, Failed}".
	// The value of this header is the status of the replication.
	orPolicyStatusHeader := make(map[string]*string)
	for key, value := range policies {
		if strings.Contains(key, "or-") && key != "x-ms-or-policy-id" {
			orPolicyStatusHeader[key] = value
		}
	}

	parsedResult := make(map[string][]ObjectReplicationRules)
	for key, value := range orPolicyStatusHeader {
		policyAndRuleIDs := strings.Split(strings.Split(key, "or-")[1], "_")
		policyId, ruleId := policyAndRuleIDs[0], policyAndRuleIDs[1]

		parsedResult[policyId] = append(parsedResult[policyId], ObjectReplicationRules{RuleID: ruleId, Status: *value})
	}

	for policyId, rules := range parsedResult {
		objectReplicationPolicies = append(objectReplicationPolicies, ObjectReplicationPolicy{
			PolicyID: &policyId,
			Rules:    &rules,
		})
	}
	return
}

// ParseHTTPHeaders parses GetPropertiesResponse and returns HTTPHeaders.
func ParseHTTPHeaders(resp GetPropertiesResponse) HTTPHeaders {
	return HTTPHeaders{
		BlobContentType:        resp.ContentType,
		BlobContentEncoding:    resp.ContentEncoding,
		BlobContentLanguage:    resp.ContentLanguage,
		BlobContentDisposition: resp.ContentDisposition,
		BlobCacheControl:       resp.CacheControl,
		BlobContentMD5:         resp.ContentMD5,
	}
}

// URLParts object represents the components that make up an Azure Storage Container/Blob URL.
// NOTE: Changing any SAS-related field requires computing a new SAS signature.
type URLParts = sas.URLParts

// ParseURL parses a URL initializing URLParts' fields including any SAS-related & snapshot query parameters. Any other
// query parameters remain in the UnparsedParams field. This method overwrites all fields in the URLParts object.
func ParseURL(u string) (URLParts, error) {
	return sas.ParseURL(u)
}
