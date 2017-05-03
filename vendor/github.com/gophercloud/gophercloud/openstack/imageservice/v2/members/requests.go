package members

import (
	"github.com/gophercloud/gophercloud"
	"github.com/gophercloud/gophercloud/pagination"
)

// Create member for specific image
//
// Preconditions
//    The specified images must exist.
//    You can only add a new member to an image which 'visibility' attribute is private.
//    You must be the owner of the specified image.
// Synchronous Postconditions
//    With correct permissions, you can see the member status of the image as pending through API calls.
//
// More details here: http://developer.openstack.org/api-ref-image-v2.html#createImageMember-v2
func Create(client *gophercloud.ServiceClient, id string, member string) (r CreateResult) {
	b := map[string]interface{}{"member": member}
	_, r.Err = client.Post(createMemberURL(client, id), b, &r.Body, &gophercloud.RequestOpts{
		OkCodes: []int{200, 409, 403},
	})
	return
}

// List members returns list of members for specifed image id
// More details: http://developer.openstack.org/api-ref-image-v2.html#listImageMembers-v2
func List(client *gophercloud.ServiceClient, id string) pagination.Pager {
	return pagination.NewPager(client, listMembersURL(client, id), func(r pagination.PageResult) pagination.Page {
		return MemberPage{pagination.SinglePageBase(r)}
	})
}

// Get image member details.
// More details: http://developer.openstack.org/api-ref-image-v2.html#getImageMember-v2
func Get(client *gophercloud.ServiceClient, imageID string, memberID string) (r DetailsResult) {
	_, r.Err = client.Get(getMemberURL(client, imageID, memberID), &r.Body, &gophercloud.RequestOpts{OkCodes: []int{200}})
	return
}

// Delete membership for given image.
// Callee should be image owner
// More details: http://developer.openstack.org/api-ref-image-v2.html#deleteImageMember-v2
func Delete(client *gophercloud.ServiceClient, imageID string, memberID string) (r DeleteResult) {
	_, r.Err = client.Delete(deleteMemberURL(client, imageID, memberID), &gophercloud.RequestOpts{OkCodes: []int{204, 403}})
	return
}

// UpdateOptsBuilder allows extensions to add additional attributes to the Update request.
type UpdateOptsBuilder interface {
	ToImageMemberUpdateMap() (map[string]interface{}, error)
}

// UpdateOpts implements UpdateOptsBuilder
type UpdateOpts struct {
	Status string
}

// ToMemberUpdateMap formats an UpdateOpts structure into a request body.
func (opts UpdateOpts) ToImageMemberUpdateMap() (map[string]interface{}, error) {
	return map[string]interface{}{
		"status": opts.Status,
	}, nil
}

// Update function updates member
// More details: http://developer.openstack.org/api-ref-image-v2.html#updateImageMember-v2
func Update(client *gophercloud.ServiceClient, imageID string, memberID string, opts UpdateOptsBuilder) (r UpdateResult) {
	b, err := opts.ToImageMemberUpdateMap()
	if err != nil {
		r.Err = err
		return
	}
	_, r.Err = client.Put(updateMemberURL(client, imageID, memberID), b, &r.Body,
		&gophercloud.RequestOpts{OkCodes: []int{200}})
	return
}
