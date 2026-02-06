package azblob

// StorageAccountCredential is a wrapper interface for SharedKeyCredential and UserDelegationCredential
type StorageAccountCredential interface {
	AccountName() string
	ComputeHMACSHA256(message string) (base64String string)
	getUDKParams() *UserDelegationKey
}
