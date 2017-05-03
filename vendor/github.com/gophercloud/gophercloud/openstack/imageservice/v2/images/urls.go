package images

import (
	"strings"

	"github.com/gophercloud/gophercloud"
)

// `listURL` is a pure function. `listURL(c)` is a URL for which a GET
// request will respond with a list of images in the service `c`.
func listURL(c *gophercloud.ServiceClient) string {
	return c.ServiceURL("images")
}

func createURL(c *gophercloud.ServiceClient) string {
	return c.ServiceURL("images")
}

// `imageURL(c,i)` is the URL for the image identified by ID `i` in
// the service `c`.
func imageURL(c *gophercloud.ServiceClient, imageID string) string {
	return c.ServiceURL("images", imageID)
}

// `getURL(c,i)` is a URL for which a GET request will respond with
// information about the image identified by ID `i` in the service
// `c`.
func getURL(c *gophercloud.ServiceClient, imageID string) string {
	return imageURL(c, imageID)
}

func updateURL(c *gophercloud.ServiceClient, imageID string) string {
	return imageURL(c, imageID)
}

func deleteURL(c *gophercloud.ServiceClient, imageID string) string {
	return imageURL(c, imageID)
}

// builds next page full url based on current url
func nextPageURL(currentURL string, next string) string {
	base := currentURL[:strings.Index(currentURL, "/images")]
	return base + next
}
