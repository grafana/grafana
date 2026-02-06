package azblob

import (
	"time"
)

// ModifiedAccessConditions identifies standard HTTP access conditions which you optionally set.
type ModifiedAccessConditions struct {
	IfModifiedSince   time.Time
	IfUnmodifiedSince time.Time
	IfMatch           ETag
	IfNoneMatch       ETag
}

// pointers is for internal infrastructure. It returns the fields as pointers.
func (ac ModifiedAccessConditions) pointers() (ims *time.Time, ius *time.Time, ime *ETag, inme *ETag) {
	if !ac.IfModifiedSince.IsZero() {
		ims = &ac.IfModifiedSince
	}
	if !ac.IfUnmodifiedSince.IsZero() {
		ius = &ac.IfUnmodifiedSince
	}
	if ac.IfMatch != ETagNone {
		ime = &ac.IfMatch
	}
	if ac.IfNoneMatch != ETagNone {
		inme = &ac.IfNoneMatch
	}
	return
}

// ContainerAccessConditions identifies container-specific access conditions which you optionally set.
type ContainerAccessConditions struct {
	ModifiedAccessConditions
	LeaseAccessConditions
}

// BlobAccessConditions identifies blob-specific access conditions which you optionally set.
type BlobAccessConditions struct {
	ModifiedAccessConditions
	LeaseAccessConditions
}

// LeaseAccessConditions identifies lease access conditions for a container or blob which you optionally set.
type LeaseAccessConditions struct {
	LeaseID string
}

// pointers is for internal infrastructure. It returns the fields as pointers.
func (ac LeaseAccessConditions) pointers() (leaseID *string) {
	if ac.LeaseID != "" {
		leaseID = &ac.LeaseID
	}
	return
}

/*
// getInt32 is for internal infrastructure. It is used with access condition values where
// 0 (the default setting) is meaningful. The library interprets 0 as do not send the header
// and the privately-storage field in the access condition object is stored as +1 higher than desired.
// THis method returns true, if the value is > 0 (explicitly set) and the stored value - 1 (the set desired value).
func getInt32(value int32) (bool, int32) {
	return value > 0, value - 1
}
*/
