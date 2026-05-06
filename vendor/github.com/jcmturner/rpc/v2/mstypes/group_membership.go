package mstypes

// GroupMembership implements https://msdn.microsoft.com/en-us/library/cc237945.aspx
// RelativeID : A 32-bit unsigned integer that contains the RID of a particular group.
// The possible values for the Attributes flags are identical to those specified in KERB_SID_AND_ATTRIBUTES
type GroupMembership struct {
	RelativeID uint32
	Attributes uint32
}

// DomainGroupMembership implements https://msdn.microsoft.com/en-us/library/hh536344.aspx
// DomainId: A SID structure that contains the SID for the domain.This member is used in conjunction with the GroupIds members to create group SIDs for the device.
// GroupCount: A 32-bit unsigned integer that contains the number of groups within the domain to which the account belongs.
// GroupIds: A pointer to a list of GROUP_MEMBERSHIP structures that contain the groups to which the account belongs in the domain. The number of groups in this list MUST be equal to GroupCount.
type DomainGroupMembership struct {
	DomainID   RPCSID `ndr:"pointer"`
	GroupCount uint32
	GroupIDs   []GroupMembership `ndr:"pointer,conformant"` // Size is value of GroupCount
}
