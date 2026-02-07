package azblob

// https://docs.microsoft.com/en-us/rest/api/storageservices/blob-service-error-codes

// ServiceCode values indicate a service failure.
const (
	// ServiceCodeAppendPositionConditionNotMet means the append position condition specified was not met.
	ServiceCodeAppendPositionConditionNotMet ServiceCodeType = "AppendPositionConditionNotMet"

	// ServiceCodeBlobAlreadyExists means the specified blob already exists.
	ServiceCodeBlobAlreadyExists ServiceCodeType = "BlobAlreadyExists"

	// ServiceCodeBlobNotFound means the specified blob does not exist.
	ServiceCodeBlobNotFound ServiceCodeType = "BlobNotFound"

	// ServiceCodeBlobOverwritten means the blob has been recreated since the previous snapshot was taken.
	ServiceCodeBlobOverwritten ServiceCodeType = "BlobOverwritten"

	// ServiceCodeBlobTierInadequateForContentLength means the specified blob tier size limit cannot be less than content length.
	ServiceCodeBlobTierInadequateForContentLength ServiceCodeType = "BlobTierInadequateForContentLength"

	// ServiceCodeBlockCountExceedsLimit means the committed block count cannot exceed the maximum limit of 50,000 blocks
	// or that the uncommitted block count cannot exceed the maximum limit of 100,000 blocks.
	ServiceCodeBlockCountExceedsLimit ServiceCodeType = "BlockCountExceedsLimit"

	// ServiceCodeBlockListTooLong means the block list may not contain more than 50,000 blocks.
	ServiceCodeBlockListTooLong ServiceCodeType = "BlockListTooLong"

	// ServiceCodeCannotChangeToLowerTier means that a higher blob tier has already been explicitly set.
	ServiceCodeCannotChangeToLowerTier ServiceCodeType = "CannotChangeToLowerTier"

	// ServiceCodeCannotVerifyCopySource means that the service could not verify the copy source within the specified time.
	// Examine the HTTP status code and message for more information about the failure.
	ServiceCodeCannotVerifyCopySource ServiceCodeType = "CannotVerifyCopySource"

	// ServiceCodeContainerAlreadyExists means the specified container already exists.
	ServiceCodeContainerAlreadyExists ServiceCodeType = "ContainerAlreadyExists"

	// ServiceCodeContainerBeingDeleted means the specified container is being deleted.
	ServiceCodeContainerBeingDeleted ServiceCodeType = "ContainerBeingDeleted"

	// ServiceCodeContainerDisabled means the specified container has been disabled by the administrator.
	ServiceCodeContainerDisabled ServiceCodeType = "ContainerDisabled"

	// ServiceCodeContainerNotFound means the specified container does not exist.
	ServiceCodeContainerNotFound ServiceCodeType = "ContainerNotFound"

	// ServiceCodeContentLengthLargerThanTierLimit means the blob's content length cannot exceed its tier limit.
	ServiceCodeContentLengthLargerThanTierLimit ServiceCodeType = "ContentLengthLargerThanTierLimit"

	// ServiceCodeCopyAcrossAccountsNotSupported means the copy source account and destination account must be the same.
	ServiceCodeCopyAcrossAccountsNotSupported ServiceCodeType = "CopyAcrossAccountsNotSupported"

	// ServiceCodeCopyIDMismatch means the specified copy ID did not match the copy ID for the pending copy operation.
	ServiceCodeCopyIDMismatch ServiceCodeType = "CopyIdMismatch"

	// ServiceCodeFeatureVersionMismatch means the type of blob in the container is unrecognized by this version or
	// that the operation for AppendBlob requires at least version 2015-02-21.
	ServiceCodeFeatureVersionMismatch ServiceCodeType = "FeatureVersionMismatch"

	// ServiceCodeIncrementalCopyBlobMismatch means the specified source blob is different than the copy source of the existing incremental copy blob.
	ServiceCodeIncrementalCopyBlobMismatch ServiceCodeType = "IncrementalCopyBlobMismatch"

	// ServiceCodeFeatureEncryptionMismatch means the given customer specified encryption does not match the encryption used to encrypt the blob.
	ServiceCodeFeatureEncryptionMismatch ServiceCodeType = "BlobCustomerSpecifiedEncryptionMismatch"

	// ServiceCodeIncrementalCopyOfEarlierVersionSnapshotNotAllowed means the specified snapshot is earlier than the last snapshot copied into the incremental copy blob.
	ServiceCodeIncrementalCopyOfEarlierVersionSnapshotNotAllowed ServiceCodeType = "IncrementalCopyOfEarlierVersionSnapshotNotAllowed"

	// ServiceCodeIncrementalCopySourceMustBeSnapshot means the source for incremental copy request must be a snapshot.
	ServiceCodeIncrementalCopySourceMustBeSnapshot ServiceCodeType = "IncrementalCopySourceMustBeSnapshot"

	// ServiceCodeInfiniteLeaseDurationRequired means the lease ID matched, but the specified lease must be an infinite-duration lease.
	ServiceCodeInfiniteLeaseDurationRequired ServiceCodeType = "InfiniteLeaseDurationRequired"

	// ServiceCodeInvalidBlobOrBlock means the specified blob or block content is invalid.
	ServiceCodeInvalidBlobOrBlock ServiceCodeType = "InvalidBlobOrBlock"

	// ServiceCodeInvalidBlobType means the blob type is invalid for this operation.
	ServiceCodeInvalidBlobType ServiceCodeType = "InvalidBlobType"

	// ServiceCodeInvalidBlockID means the specified block ID is invalid. The block ID must be Base64-encoded.
	ServiceCodeInvalidBlockID ServiceCodeType = "InvalidBlockId"

	// ServiceCodeInvalidBlockList means the specified block list is invalid.
	ServiceCodeInvalidBlockList ServiceCodeType = "InvalidBlockList"

	// ServiceCodeInvalidOperation means an invalid operation against a blob snapshot.
	ServiceCodeInvalidOperation ServiceCodeType = "InvalidOperation"

	// ServiceCodeInvalidPageRange means the page range specified is invalid.
	ServiceCodeInvalidPageRange ServiceCodeType = "InvalidPageRange"

	// ServiceCodeInvalidSourceBlobType means the copy source blob type is invalid for this operation.
	ServiceCodeInvalidSourceBlobType ServiceCodeType = "InvalidSourceBlobType"

	// ServiceCodeInvalidSourceBlobURL means the source URL for incremental copy request must be valid Azure Storage blob URL.
	ServiceCodeInvalidSourceBlobURL ServiceCodeType = "InvalidSourceBlobUrl"

	// ServiceCodeInvalidVersionForPageBlobOperation means that all operations on page blobs require at least version 2009-09-19.
	ServiceCodeInvalidVersionForPageBlobOperation ServiceCodeType = "InvalidVersionForPageBlobOperation"

	// ServiceCodeLeaseAlreadyPresent means there is already a lease present.
	ServiceCodeLeaseAlreadyPresent ServiceCodeType = "LeaseAlreadyPresent"

	// ServiceCodeLeaseAlreadyBroken means the lease has already been broken and cannot be broken again.
	ServiceCodeLeaseAlreadyBroken ServiceCodeType = "LeaseAlreadyBroken"

	// ServiceCodeLeaseIDMismatchWithBlobOperation means the lease ID specified did not match the lease ID for the blob.
	ServiceCodeLeaseIDMismatchWithBlobOperation ServiceCodeType = "LeaseIdMismatchWithBlobOperation"

	// ServiceCodeLeaseIDMismatchWithContainerOperation means the lease ID specified did not match the lease ID for the container.
	ServiceCodeLeaseIDMismatchWithContainerOperation ServiceCodeType = "LeaseIdMismatchWithContainerOperation"

	// ServiceCodeLeaseIDMismatchWithLeaseOperation means the lease ID specified did not match the lease ID for the blob/container.
	ServiceCodeLeaseIDMismatchWithLeaseOperation ServiceCodeType = "LeaseIdMismatchWithLeaseOperation"

	// ServiceCodeLeaseIDMissing means there is currently a lease on the blob/container and no lease ID was specified in the request.
	ServiceCodeLeaseIDMissing ServiceCodeType = "LeaseIdMissing"

	// ServiceCodeLeaseIsBreakingAndCannotBeAcquired means the lease ID matched, but the lease is currently in breaking state and cannot be acquired until it is broken.
	ServiceCodeLeaseIsBreakingAndCannotBeAcquired ServiceCodeType = "LeaseIsBreakingAndCannotBeAcquired"

	// ServiceCodeLeaseIsBreakingAndCannotBeChanged means the lease ID matched, but the lease is currently in breaking state and cannot be changed.
	ServiceCodeLeaseIsBreakingAndCannotBeChanged ServiceCodeType = "LeaseIsBreakingAndCannotBeChanged"

	// ServiceCodeLeaseIsBrokenAndCannotBeRenewed means the lease ID matched, but the lease has been broken explicitly and cannot be renewed.
	ServiceCodeLeaseIsBrokenAndCannotBeRenewed ServiceCodeType = "LeaseIsBrokenAndCannotBeRenewed"

	// ServiceCodeLeaseLost means a lease ID was specified, but the lease for the blob/container has expired.
	ServiceCodeLeaseLost ServiceCodeType = "LeaseLost"

	// ServiceCodeLeaseNotPresentWithBlobOperation means there is currently no lease on the blob.
	ServiceCodeLeaseNotPresentWithBlobOperation ServiceCodeType = "LeaseNotPresentWithBlobOperation"

	// ServiceCodeLeaseNotPresentWithContainerOperation means there is currently no lease on the container.
	ServiceCodeLeaseNotPresentWithContainerOperation ServiceCodeType = "LeaseNotPresentWithContainerOperation"

	// ServiceCodeLeaseNotPresentWithLeaseOperation means there is currently no lease on the blob/container.
	ServiceCodeLeaseNotPresentWithLeaseOperation ServiceCodeType = "LeaseNotPresentWithLeaseOperation"

	// ServiceCodeMaxBlobSizeConditionNotMet means the max blob size condition specified was not met.
	ServiceCodeMaxBlobSizeConditionNotMet ServiceCodeType = "MaxBlobSizeConditionNotMet"

	// ServiceCodeNoPendingCopyOperation means there is currently no pending copy operation.
	ServiceCodeNoPendingCopyOperation ServiceCodeType = "NoPendingCopyOperation"

	// ServiceCodeOperationNotAllowedOnIncrementalCopyBlob means the specified operation is not allowed on an incremental copy blob.
	ServiceCodeOperationNotAllowedOnIncrementalCopyBlob ServiceCodeType = "OperationNotAllowedOnIncrementalCopyBlob"

	// ServiceCodePendingCopyOperation means there is currently a pending copy operation.
	ServiceCodePendingCopyOperation ServiceCodeType = "PendingCopyOperation"

	// ServiceCodePreviousSnapshotCannotBeNewer means the prevsnapshot query parameter value cannot be newer than snapshot query parameter value.
	ServiceCodePreviousSnapshotCannotBeNewer ServiceCodeType = "PreviousSnapshotCannotBeNewer"

	// ServiceCodePreviousSnapshotNotFound means the previous snapshot is not found.
	ServiceCodePreviousSnapshotNotFound ServiceCodeType = "PreviousSnapshotNotFound"

	// ServiceCodePreviousSnapshotOperationNotSupported means that differential Get Page Ranges is not supported on the previous snapshot.
	ServiceCodePreviousSnapshotOperationNotSupported ServiceCodeType = "PreviousSnapshotOperationNotSupported"

	// ServiceCodeSequenceNumberConditionNotMet means the sequence number condition specified was not met.
	ServiceCodeSequenceNumberConditionNotMet ServiceCodeType = "SequenceNumberConditionNotMet"

	// ServiceCodeSequenceNumberIncrementTooLarge means the sequence number increment cannot be performed because it would result in overflow of the sequence number.
	ServiceCodeSequenceNumberIncrementTooLarge ServiceCodeType = "SequenceNumberIncrementTooLarge"

	// ServiceCodeSnapshotCountExceeded means the snapshot count against this blob has been exceeded.
	ServiceCodeSnapshotCountExceeded ServiceCodeType = "SnapshotCountExceeded"

	// ServiceCodeSnaphotOperationRateExceeded means the rate of snapshot operations against this blob has been exceeded.
	ServiceCodeSnaphotOperationRateExceeded ServiceCodeType = "SnaphotOperationRateExceeded"

	// ServiceCodeSnapshotsPresent means this operation is not permitted while the blob has snapshots.
	ServiceCodeSnapshotsPresent ServiceCodeType = "SnapshotsPresent"

	// ServiceCodeSourceConditionNotMet means the source condition specified using HTTP conditional header(s) is not met.
	ServiceCodeSourceConditionNotMet ServiceCodeType = "SourceConditionNotMet"

	// ServiceCodeSystemInUse means this blob is in use by the system.
	ServiceCodeSystemInUse ServiceCodeType = "SystemInUse"

	// ServiceCodeTargetConditionNotMet means the target condition specified using HTTP conditional header(s) is not met.
	ServiceCodeTargetConditionNotMet ServiceCodeType = "TargetConditionNotMet"

	// ServiceCodeUnauthorizedBlobOverwrite means this request is not authorized to perform blob overwrites.
	ServiceCodeUnauthorizedBlobOverwrite ServiceCodeType = "UnauthorizedBlobOverwrite"

	// ServiceCodeBlobBeingRehydrated means this operation is not permitted because the blob is being rehydrated.
	ServiceCodeBlobBeingRehydrated ServiceCodeType = "BlobBeingRehydrated"

	// ServiceCodeBlobArchived means this operation is not permitted on an archived blob.
	ServiceCodeBlobArchived ServiceCodeType = "BlobArchived"

	// ServiceCodeBlobNotArchived means this blob is currently not in the archived state.
	ServiceCodeBlobNotArchived ServiceCodeType = "BlobNotArchived"
)
