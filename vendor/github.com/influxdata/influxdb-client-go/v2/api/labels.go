// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import (
	"context"
	"fmt"

	"github.com/influxdata/influxdb-client-go/v2/domain"
)

// LabelsAPI provides methods for managing labels in a InfluxDB server.
type LabelsAPI interface {
	// GetLabels returns all labels.
	GetLabels(ctx context.Context) (*[]domain.Label, error)
	// FindLabelsByOrg returns labels belonging to organization org.
	FindLabelsByOrg(ctx context.Context, org *domain.Organization) (*[]domain.Label, error)
	// FindLabelsByOrgID returns labels belonging to organization with id orgID.
	FindLabelsByOrgID(ctx context.Context, orgID string) (*[]domain.Label, error)
	// FindLabelByID returns a label with labelID.
	FindLabelByID(ctx context.Context, labelID string) (*domain.Label, error)
	// FindLabelByName returns a label with name labelName under an organization orgID.
	FindLabelByName(ctx context.Context, orgID, labelName string) (*domain.Label, error)
	// CreateLabel creates a new label.
	CreateLabel(ctx context.Context, label *domain.LabelCreateRequest) (*domain.Label, error)
	// CreateLabelWithName creates a new label with label labelName and properties, under the organization org.
	// Properties example: {"color": "ffb3b3", "description": "this is a description"}.
	CreateLabelWithName(ctx context.Context, org *domain.Organization, labelName string, properties map[string]string) (*domain.Label, error)
	// CreateLabelWithNameWithID creates a new label with label labelName and properties, under the organization with id orgID.
	// Properties example: {"color": "ffb3b3", "description": "this is a description"}.
	CreateLabelWithNameWithID(ctx context.Context, orgID, labelName string, properties map[string]string) (*domain.Label, error)
	// UpdateLabel updates the label.
	// Properties can be removed by sending an update with an empty value.
	UpdateLabel(ctx context.Context, label *domain.Label) (*domain.Label, error)
	// DeleteLabelWithID deletes a label with labelID.
	DeleteLabelWithID(ctx context.Context, labelID string) error
	// DeleteLabel deletes a label.
	DeleteLabel(ctx context.Context, label *domain.Label) error
}

// labelsAPI implements LabelsAPI
type labelsAPI struct {
	apiClient *domain.Client
}

// NewLabelsAPI creates new instance of LabelsAPI
func NewLabelsAPI(apiClient *domain.Client) LabelsAPI {
	return &labelsAPI{
		apiClient: apiClient,
	}
}

func (u *labelsAPI) GetLabels(ctx context.Context) (*[]domain.Label, error) {
	params := &domain.GetLabelsParams{}
	return u.getLabels(ctx, params)
}

func (u *labelsAPI) getLabels(ctx context.Context, params *domain.GetLabelsParams) (*[]domain.Label, error) {
	response, err := u.apiClient.GetLabels(ctx, params)
	if err != nil {
		return nil, err
	}
	return (*[]domain.Label)(response.Labels), nil
}

func (u *labelsAPI) FindLabelsByOrg(ctx context.Context, org *domain.Organization) (*[]domain.Label, error) {
	return u.FindLabelsByOrgID(ctx, *org.Id)
}

func (u *labelsAPI) FindLabelsByOrgID(ctx context.Context, orgID string) (*[]domain.Label, error) {
	params := &domain.GetLabelsParams{OrgID: &orgID}
	return u.getLabels(ctx, params)
}

func (u *labelsAPI) FindLabelByID(ctx context.Context, labelID string) (*domain.Label, error) {
	params := &domain.GetLabelsIDAllParams{
		LabelID: labelID,
	}
	response, err := u.apiClient.GetLabelsID(ctx, params)
	if err != nil {
		return nil, err
	}
	return response.Label, nil
}

func (u *labelsAPI) FindLabelByName(ctx context.Context, orgID, labelName string) (*domain.Label, error) {
	labels, err := u.FindLabelsByOrgID(ctx, orgID)
	if err != nil {
		return nil, err
	}
	var label *domain.Label
	for _, u := range *labels {
		if *u.Name == labelName {
			label = &u
			break
		}
	}
	if label == nil {
		return nil, fmt.Errorf("label '%s' not found", labelName)
	}
	return label, nil
}

func (u *labelsAPI) CreateLabelWithName(ctx context.Context, org *domain.Organization, labelName string, properties map[string]string) (*domain.Label, error) {
	return u.CreateLabelWithNameWithID(ctx, *org.Id, labelName, properties)
}

func (u *labelsAPI) CreateLabelWithNameWithID(ctx context.Context, orgID, labelName string, properties map[string]string) (*domain.Label, error) {
	props := &domain.LabelCreateRequest_Properties{AdditionalProperties: properties}
	label := &domain.LabelCreateRequest{Name: labelName, OrgID: orgID, Properties: props}
	return u.CreateLabel(ctx, label)
}

func (u *labelsAPI) CreateLabel(ctx context.Context, label *domain.LabelCreateRequest) (*domain.Label, error) {
	params := &domain.PostLabelsAllParams{
		Body: domain.PostLabelsJSONRequestBody(*label),
	}
	response, err := u.apiClient.PostLabels(ctx, params)
	if err != nil {
		return nil, err
	}
	return response.Label, nil
}

func (u *labelsAPI) UpdateLabel(ctx context.Context, label *domain.Label) (*domain.Label, error) {
	var props *domain.LabelUpdate_Properties
	if label.Properties != nil {
		props = &domain.LabelUpdate_Properties{AdditionalProperties: label.Properties.AdditionalProperties}
	}
	params := &domain.PatchLabelsIDAllParams{
		Body: domain.PatchLabelsIDJSONRequestBody(domain.LabelUpdate{
			Name:       label.Name,
			Properties: props,
		}),
		LabelID: *label.Id,
	}
	response, err := u.apiClient.PatchLabelsID(ctx, params)
	if err != nil {
		return nil, err
	}
	return response.Label, nil
}

func (u *labelsAPI) DeleteLabel(ctx context.Context, label *domain.Label) error {
	return u.DeleteLabelWithID(ctx, *label.Id)
}

func (u *labelsAPI) DeleteLabelWithID(ctx context.Context, labelID string) error {
	params := &domain.DeleteLabelsIDAllParams{
		LabelID: labelID,
	}
	return u.apiClient.DeleteLabelsID(ctx, params)
}
