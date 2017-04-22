package projects

import (
	"github.com/gophercloud/gophercloud"
	"github.com/gophercloud/gophercloud/pagination"
)

type projectResult struct {
	gophercloud.Result
}

// GetResult temporarily contains the response from the Get call.
type GetResult struct {
	projectResult
}

// CreateResult temporarily contains the reponse from the Create call.
type CreateResult struct {
	projectResult
}

// DeleteResult temporarily contains the response from the Delete call.
type DeleteResult struct {
	gophercloud.ErrResult
}

// UpdateResult temporarily contains the response from the Update call.
type UpdateResult struct {
	projectResult
}

// Project is a base unit of ownership.
type Project struct {
	// IsDomain indicates whether the project is a domain.
	IsDomain bool `json:"is_domain"`

	// Description is the description of the project.
	Description string `json:"description"`

	// DomainID is the domain ID the project belongs to.
	DomainID string `json:"domain_id"`

	// Enabled is whether or not the project is enabled.
	Enabled bool `json:"enabled"`

	// ID is the unique ID of the project.
	ID string `json:"id"`

	// Name is the name of the project.
	Name string `json:"name"`

	// ParentID is the parent_id of the project.
	ParentID string `json:"parent_id"`
}

// ProjectPage is a single page of Project results.
type ProjectPage struct {
	pagination.LinkedPageBase
}

// IsEmpty determines whether or not a page of Projects contains any results.
func (r ProjectPage) IsEmpty() (bool, error) {
	projects, err := ExtractProjects(r)
	return len(projects) == 0, err
}

// NextPageURL extracts the "next" link from the links section of the result.
func (r ProjectPage) NextPageURL() (string, error) {
	var s struct {
		Links struct {
			Next     string `json:"next"`
			Previous string `json:"previous"`
		} `json:"links"`
	}
	err := r.ExtractInto(&s)
	if err != nil {
		return "", err
	}
	return s.Links.Next, err
}

// ExtractProjects returns a slice of Projects contained in a single page of results.
func ExtractProjects(r pagination.Page) ([]Project, error) {
	var s struct {
		Projects []Project `json:"projects"`
	}
	err := (r.(ProjectPage)).ExtractInto(&s)
	return s.Projects, err
}

// Extract interprets any projectResults as a Project.
func (r projectResult) Extract() (*Project, error) {
	var s struct {
		Project *Project `json:"project"`
	}
	err := r.ExtractInto(&s)
	return s.Project, err
}
