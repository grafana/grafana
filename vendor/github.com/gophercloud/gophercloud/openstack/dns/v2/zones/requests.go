package zones

import (
	"github.com/gophercloud/gophercloud"
	"github.com/gophercloud/gophercloud/pagination"
)

type ListOptsBuilder interface {
	ToZoneListQuery() (string, error)
}

// ListOpts allows the filtering and sorting of paginated collections through
// the API. Filtering is achieved by passing in struct field values that map to
// the server attributes you want to see returned. Marker and Limit are used
// for pagination.
// https://developer.openstack.org/api-ref/dns/
type ListOpts struct {
	// Integer value for the limit of values to return.
	Limit int `q:"limit"`

	// UUID of the zone at which you want to set a marker.
	Marker string `q:"marker"`

	Description string `q:"description"`
	Email       string `q:"email"`
	Name        string `q:"name"`
	SortDir     string `q:"sort_dir"`
	SortKey     string `q:"sort_key"`
	Status      string `q:"status"`
	TTL         int    `q:"ttl"`
	Type        string `q:"type"`
}

func (opts ListOpts) ToZoneListQuery() (string, error) {
	q, err := gophercloud.BuildQueryString(opts)
	return q.String(), err
}

func List(client *gophercloud.ServiceClient, opts ListOptsBuilder) pagination.Pager {
	url := listURL(client)
	if opts != nil {
		query, err := opts.ToZoneListQuery()
		if err != nil {
			return pagination.Pager{Err: err}
		}
		url += query
	}
	return pagination.NewPager(client, url, func(r pagination.PageResult) pagination.Page {
		return ZonePage{pagination.LinkedPageBase{PageResult: r}}
	})
}

// Get returns additional information about a zone, given its ID.
func Get(client *gophercloud.ServiceClient, zoneID string) (r GetResult) {
	_, r.Err = client.Get(zoneURL(client, zoneID), &r.Body, nil)
	return
}
