package aws

// RequestChecksumCalculation controls request checksum calculation workflow
type RequestChecksumCalculation int

const (
	// RequestChecksumCalculationUnset is the unset value for RequestChecksumCalculation
	RequestChecksumCalculationUnset RequestChecksumCalculation = iota

	// RequestChecksumCalculationWhenSupported indicates request checksum will be calculated
	// if the operation supports input checksums
	RequestChecksumCalculationWhenSupported

	// RequestChecksumCalculationWhenRequired indicates request checksum will be calculated
	// if required by the operation or if user elects to set a checksum algorithm in request
	RequestChecksumCalculationWhenRequired
)

// ResponseChecksumValidation controls response checksum validation workflow
type ResponseChecksumValidation int

const (
	// ResponseChecksumValidationUnset is the unset value for ResponseChecksumValidation
	ResponseChecksumValidationUnset ResponseChecksumValidation = iota

	// ResponseChecksumValidationWhenSupported indicates response checksum will be validated
	// if the operation supports output checksums
	ResponseChecksumValidationWhenSupported

	// ResponseChecksumValidationWhenRequired indicates response checksum will only
	// be validated if the operation requires output checksum validation
	ResponseChecksumValidationWhenRequired
)
