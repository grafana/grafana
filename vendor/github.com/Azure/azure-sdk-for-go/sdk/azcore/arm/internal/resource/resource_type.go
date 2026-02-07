//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package resource

import (
	"fmt"
	"strings"
)

// SubscriptionResourceType is the ResourceType of a subscription
var SubscriptionResourceType = NewResourceType(builtInResourceNamespace, "subscriptions")

// ResourceGroupResourceType is the ResourceType of a resource group
var ResourceGroupResourceType = NewResourceType(builtInResourceNamespace, "resourceGroups")

// TenantResourceType is the ResourceType of a tenant
var TenantResourceType = NewResourceType(builtInResourceNamespace, "tenants")

// ProviderResourceType is the ResourceType of a provider
var ProviderResourceType = NewResourceType(builtInResourceNamespace, "providers")

// ResourceType represents an Azure resource type, e.g. "Microsoft.Network/virtualNetworks/subnets".
// Don't create this type directly, use ParseResourceType or NewResourceType instead.
type ResourceType struct {
	// Namespace is the namespace of the resource type.
	// e.g. "Microsoft.Network" in resource type "Microsoft.Network/virtualNetworks/subnets"
	Namespace string

	// Type is the full type name of the resource type.
	// e.g. "virtualNetworks/subnets" in resource type "Microsoft.Network/virtualNetworks/subnets"
	Type string

	// Types is the slice of all the sub-types of this resource type.
	// e.g. ["virtualNetworks", "subnets"] in resource type "Microsoft.Network/virtualNetworks/subnets"
	Types []string

	stringValue string
}

// String returns the string of the ResourceType
func (t ResourceType) String() string {
	return t.stringValue
}

// IsParentOf returns true when the receiver is the parent resource type of the child.
func (t ResourceType) IsParentOf(child ResourceType) bool {
	if !strings.EqualFold(t.Namespace, child.Namespace) {
		return false
	}
	if len(t.Types) >= len(child.Types) {
		return false
	}
	for i := range t.Types {
		if !strings.EqualFold(t.Types[i], child.Types[i]) {
			return false
		}
	}

	return true
}

// AppendChild creates an instance of ResourceType using the receiver as the parent with childType appended to it.
func (t ResourceType) AppendChild(childType string) ResourceType {
	return NewResourceType(t.Namespace, fmt.Sprintf("%s/%s", t.Type, childType))
}

// NewResourceType creates an instance of ResourceType using a provider namespace
// such as "Microsoft.Network" and type such as "virtualNetworks/subnets".
func NewResourceType(providerNamespace, typeName string) ResourceType {
	return ResourceType{
		Namespace:   providerNamespace,
		Type:        typeName,
		Types:       splitStringAndOmitEmpty(typeName, "/"),
		stringValue: fmt.Sprintf("%s/%s", providerNamespace, typeName),
	}
}

// ParseResourceType parses the ResourceType from a resource type string (e.g. Microsoft.Network/virtualNetworks/subsets)
// or a resource identifier string.
// e.g. /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/myRg/providers/Microsoft.Network/virtualNetworks/vnet/subnets/mySubnet)
func ParseResourceType(resourceIDOrType string) (ResourceType, error) {
	// split the path into segments
	parts := splitStringAndOmitEmpty(resourceIDOrType, "/")

	// There must be at least a namespace and type name
	if len(parts) < 1 {
		return ResourceType{}, fmt.Errorf("invalid resource ID or type: %s", resourceIDOrType)
	}

	// if the type is just subscriptions, it is a built-in type in the Microsoft.Resources namespace
	if len(parts) == 1 {
		// Simple resource type
		return NewResourceType(builtInResourceNamespace, parts[0]), nil
	} else if strings.Contains(parts[0], ".") {
		// Handle resource types (Microsoft.Compute/virtualMachines, Microsoft.Network/virtualNetworks/subnets)
		// it is a full type name
		return NewResourceType(parts[0], strings.Join(parts[1:], "/")), nil
	} else {
		// Check if ResourceID
		id, err := ParseResourceID(resourceIDOrType)
		if err != nil {
			return ResourceType{}, err
		}
		return NewResourceType(id.ResourceType.Namespace, id.ResourceType.Type), nil
	}
}

func (t ResourceType) lastType() string {
	return t.Types[len(t.Types)-1]
}
