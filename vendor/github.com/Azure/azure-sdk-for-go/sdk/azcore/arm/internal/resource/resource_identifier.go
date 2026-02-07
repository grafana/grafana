//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package resource

import (
	"fmt"
	"strings"
)

const (
	providersKey             = "providers"
	subscriptionsKey         = "subscriptions"
	resourceGroupsLowerKey   = "resourcegroups"
	locationsKey             = "locations"
	builtInResourceNamespace = "Microsoft.Resources"
)

// RootResourceID defines the tenant as the root parent of all other ResourceID.
var RootResourceID = &ResourceID{
	Parent:       nil,
	ResourceType: TenantResourceType,
	Name:         "",
}

// ResourceID represents a resource ID such as `/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/myRg`.
// Don't create this type directly, use [ParseResourceID] instead. Fields are considered immutable and shouldn't be
// modified after creation.
type ResourceID struct {
	// Parent is the parent ResourceID of this instance.
	// Can be nil if there is no parent.
	Parent *ResourceID

	// SubscriptionID is the subscription ID in this resource ID.
	// The value can be empty if the resource ID does not contain a subscription ID.
	SubscriptionID string

	// ResourceGroupName is the resource group name in this resource ID.
	// The value can be empty if the resource ID does not contain a resource group name.
	ResourceGroupName string

	// Provider represents the provider name in this resource ID.
	// This is only valid when the resource ID represents a resource provider.
	// Example: `/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Insights`
	Provider string

	// Location is the location in this resource ID.
	// The value can be empty if the resource ID does not contain a location name.
	Location string

	// ResourceType represents the type of this resource ID.
	ResourceType ResourceType

	// Name is the resource name of this resource ID.
	Name string

	isChild     bool
	stringValue string
}

// ParseResourceID parses a string to an instance of ResourceID
func ParseResourceID(id string) (*ResourceID, error) {
	if len(id) == 0 {
		return nil, fmt.Errorf("invalid resource ID: id cannot be empty")
	}

	if !strings.HasPrefix(id, "/") {
		return nil, fmt.Errorf("invalid resource ID: resource id '%s' must start with '/'", id)
	}

	parts := splitStringAndOmitEmpty(id, "/")

	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid resource ID: %s", id)
	}

	if !strings.EqualFold(parts[0], subscriptionsKey) && !strings.EqualFold(parts[0], providersKey) {
		return nil, fmt.Errorf("invalid resource ID: %s", id)
	}

	return appendNext(RootResourceID, parts, id)
}

// String returns the string of the ResourceID
func (id *ResourceID) String() string {
	return id.stringValue
}

// MarshalText returns a textual representation of the ResourceID
func (id *ResourceID) MarshalText() ([]byte, error) {
	return []byte(id.String()), nil
}

// UnmarshalText decodes the textual representation of a ResourceID
func (id *ResourceID) UnmarshalText(text []byte) error {
	newId, err := ParseResourceID(string(text))
	if err != nil {
		return err
	}
	*id = *newId
	return nil
}

func newResourceID(parent *ResourceID, resourceTypeName string, resourceName string) *ResourceID {
	id := &ResourceID{}
	id.init(parent, chooseResourceType(resourceTypeName, parent), resourceName, true)
	return id
}

func newResourceIDWithResourceType(parent *ResourceID, resourceType ResourceType, resourceName string) *ResourceID {
	id := &ResourceID{}
	id.init(parent, resourceType, resourceName, true)
	return id
}

func newResourceIDWithProvider(parent *ResourceID, providerNamespace, resourceTypeName, resourceName string) *ResourceID {
	id := &ResourceID{}
	id.init(parent, NewResourceType(providerNamespace, resourceTypeName), resourceName, false)
	return id
}

func chooseResourceType(resourceTypeName string, parent *ResourceID) ResourceType {
	if strings.EqualFold(resourceTypeName, resourceGroupsLowerKey) && isSubscriptionResource(parent) {
		return ResourceGroupResourceType
	} else if strings.EqualFold(resourceTypeName, subscriptionsKey) && isTenantResource(parent) {
		return SubscriptionResourceType
	}

	return parent.ResourceType.AppendChild(resourceTypeName)
}

func (id *ResourceID) init(parent *ResourceID, resourceType ResourceType, name string, isChild bool) {
	if parent != nil {
		id.Provider = parent.Provider
		id.SubscriptionID = parent.SubscriptionID
		id.ResourceGroupName = parent.ResourceGroupName
		id.Location = parent.Location
	}

	if resourceType.String() == SubscriptionResourceType.String() {
		id.SubscriptionID = name
	}

	if resourceType.lastType() == locationsKey {
		id.Location = name
	}

	if resourceType.String() == ResourceGroupResourceType.String() {
		id.ResourceGroupName = name
	}

	if resourceType.String() == ProviderResourceType.String() {
		id.Provider = name
	}

	if parent == nil {
		id.Parent = RootResourceID
	} else {
		id.Parent = parent
	}
	id.isChild = isChild
	id.ResourceType = resourceType
	id.Name = name
	id.stringValue = id.Parent.String()
	if id.isChild {
		id.stringValue += "/" + id.ResourceType.lastType()
		if id.Name != "" {
			id.stringValue += "/" + id.Name
		}
	} else {
		id.stringValue += fmt.Sprintf("/providers/%s/%s/%s", id.ResourceType.Namespace, id.ResourceType.Type, id.Name)
	}
}

func appendNext(parent *ResourceID, parts []string, id string) (*ResourceID, error) {
	if len(parts) == 0 {
		return parent, nil
	}

	if len(parts) == 1 {
		// subscriptions and resourceGroups are not valid ids without their names
		if strings.EqualFold(parts[0], subscriptionsKey) && isTenantResource(parent) || strings.EqualFold(parts[0], resourceGroupsLowerKey) && isSubscriptionResource(parent) {
			return nil, fmt.Errorf("invalid resource ID: %s", id)
		}

		// resourceGroup must contain either child or provider resource type
		if isResourceGroupResource(parent) {
			return nil, fmt.Errorf("invalid resource ID: %s", id)
		}

		return newResourceID(parent, parts[0], ""), nil
	}

	if strings.EqualFold(parts[0], providersKey) && (len(parts) == 2 || strings.EqualFold(parts[2], providersKey)) {
		// provider resource can only be on a tenant or a subscription parent
		if !isSubscriptionResource(parent) && !isTenantResource(parent) {
			return nil, fmt.Errorf("invalid resource ID: %s", id)
		}

		return appendNext(newResourceIDWithResourceType(parent, ProviderResourceType, parts[1]), parts[2:], id)
	}

	if len(parts) > 3 && strings.EqualFold(parts[0], providersKey) {
		return appendNext(newResourceIDWithProvider(parent, parts[1], parts[2], parts[3]), parts[4:], id)
	}

	if len(parts) > 1 && !strings.EqualFold(parts[0], providersKey) {
		return appendNext(newResourceID(parent, parts[0], parts[1]), parts[2:], id)
	}

	return nil, fmt.Errorf("invalid resource ID: %s", id)
}

func splitStringAndOmitEmpty(v, sep string) []string {
	r := make([]string, 0)
	for _, s := range strings.Split(v, sep) {
		if len(s) == 0 {
			continue
		}
		r = append(r, s)
	}

	return r
}

// isTenantResource returns true if the resourceID represents a tenant resource. The condition is resource ID matched with TenantResourceType and has no parent.
func isTenantResource(resourceID *ResourceID) bool {
	return resourceID != nil && strings.EqualFold(resourceID.ResourceType.String(), TenantResourceType.String()) && resourceID.Parent == nil
}

// isSubscriptionResource returns true if the resourceID represents a subscription resource. The condition is resource ID matched with SubscriptionResourceType and its parent is a tenant resource.
func isSubscriptionResource(resourceID *ResourceID) bool {
	return resourceID != nil && strings.EqualFold(resourceID.ResourceType.String(), SubscriptionResourceType.String()) && isTenantResource(resourceID.Parent)
}

// isResourceGroupResource returns true if the resourceID represents a resource group resource. The condition is resource ID matched with ResourceGroupResourceType and its parent is a subscription resource.
func isResourceGroupResource(resourceID *ResourceID) bool {
	return resourceID != nil && strings.EqualFold(resourceID.ResourceType.String(), ResourceGroupResourceType.String()) && isSubscriptionResource(resourceID.Parent)
}
