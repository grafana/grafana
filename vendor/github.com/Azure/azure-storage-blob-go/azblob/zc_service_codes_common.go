package azblob

// https://docs.microsoft.com/en-us/rest/api/storageservices/common-rest-api-error-codes

const (
	// ServiceCodeNone is the default value. It indicates that the error was related to the service or that the service didn't return a code.
	ServiceCodeNone ServiceCodeType = ""

	// ServiceCodeAccountAlreadyExists means the specified account already exists.
	ServiceCodeAccountAlreadyExists ServiceCodeType = "AccountAlreadyExists"

	// ServiceCodeAccountBeingCreated means the specified account is in the process of being created (403).
	ServiceCodeAccountBeingCreated ServiceCodeType = "AccountBeingCreated"

	// ServiceCodeAccountIsDisabled means the specified account is disabled (403).
	ServiceCodeAccountIsDisabled ServiceCodeType = "AccountIsDisabled"

	// ServiceCodeAuthenticationFailed means the server failed to authenticate the request. Make sure the value of the Authorization header is formed correctly including the signature (403).
	ServiceCodeAuthenticationFailed ServiceCodeType = "AuthenticationFailed"

	// ServiceCodeConditionHeadersNotSupported means the condition headers are not supported (400).
	ServiceCodeConditionHeadersNotSupported ServiceCodeType = "ConditionHeadersNotSupported"

	// ServiceCodeConditionNotMet means the condition specified in the conditional header(s) was not met for a read/write operation (304/412).
	ServiceCodeConditionNotMet ServiceCodeType = "ConditionNotMet"

	// ServiceCodeEmptyMetadataKey means the key for one of the metadata key-value pairs is empty (400).
	ServiceCodeEmptyMetadataKey ServiceCodeType = "EmptyMetadataKey"

	// ServiceCodeInsufficientAccountPermissions means read operations are currently disabled or Write operations are not allowed or The account being accessed does not have sufficient permissions to execute this operation (403).
	ServiceCodeInsufficientAccountPermissions ServiceCodeType = "InsufficientAccountPermissions"

	// ServiceCodeInternalError means the server encountered an internal error. Please retry the request (500).
	ServiceCodeInternalError ServiceCodeType = "InternalError"

	// ServiceCodeInvalidAuthenticationInfo means the authentication information was not provided in the correct format. Verify the value of Authorization header (400).
	ServiceCodeInvalidAuthenticationInfo ServiceCodeType = "InvalidAuthenticationInfo"

	// ServiceCodeInvalidHeaderValue means the value provided for one of the HTTP headers was not in the correct format (400).
	ServiceCodeInvalidHeaderValue ServiceCodeType = "InvalidHeaderValue"

	// ServiceCodeInvalidHTTPVerb means the HTTP verb specified was not recognized by the server (400).
	ServiceCodeInvalidHTTPVerb ServiceCodeType = "InvalidHttpVerb"

	// ServiceCodeInvalidInput means one of the request inputs is not valid (400).
	ServiceCodeInvalidInput ServiceCodeType = "InvalidInput"

	// ServiceCodeInvalidMd5 means the MD5 value specified in the request is invalid. The MD5 value must be 128 bits and Base64-encoded (400).
	ServiceCodeInvalidMd5 ServiceCodeType = "InvalidMd5"

	// ServiceCodeInvalidMetadata means the specified metadata is invalid. It includes characters that are not permitted (400).
	ServiceCodeInvalidMetadata ServiceCodeType = "InvalidMetadata"

	// ServiceCodeInvalidQueryParameterValue means an invalid value was specified for one of the query parameters in the request URI (400).
	ServiceCodeInvalidQueryParameterValue ServiceCodeType = "InvalidQueryParameterValue"

	// ServiceCodeInvalidRange means the range specified is invalid for the current size of the resource (416).
	ServiceCodeInvalidRange ServiceCodeType = "InvalidRange"

	// ServiceCodeInvalidResourceName means the specified resource name contains invalid characters (400).
	ServiceCodeInvalidResourceName ServiceCodeType = "InvalidResourceName"

	// ServiceCodeInvalidURI means the requested URI does not represent any resource on the server (400).
	ServiceCodeInvalidURI ServiceCodeType = "InvalidUri"

	// ServiceCodeInvalidXMLDocument means the specified XML is not syntactically valid (400).
	ServiceCodeInvalidXMLDocument ServiceCodeType = "InvalidXmlDocument"

	// ServiceCodeInvalidXMLNodeValue means the value provided for one of the XML nodes in the request body was not in the correct format (400).
	ServiceCodeInvalidXMLNodeValue ServiceCodeType = "InvalidXmlNodeValue"

	// ServiceCodeMd5Mismatch means the MD5 value specified in the request did not match the MD5 value calculated by the server (400).
	ServiceCodeMd5Mismatch ServiceCodeType = "Md5Mismatch"

	// ServiceCodeMetadataTooLarge means the size of the specified metadata exceeds the maximum size permitted (400).
	ServiceCodeMetadataTooLarge ServiceCodeType = "MetadataTooLarge"

	// ServiceCodeMissingContentLengthHeader means the Content-Length header was not specified (411).
	ServiceCodeMissingContentLengthHeader ServiceCodeType = "MissingContentLengthHeader"

	// ServiceCodeMissingRequiredQueryParameter means a required query parameter was not specified for this request (400).
	ServiceCodeMissingRequiredQueryParameter ServiceCodeType = "MissingRequiredQueryParameter"

	// ServiceCodeMissingRequiredHeader means a required HTTP header was not specified (400).
	ServiceCodeMissingRequiredHeader ServiceCodeType = "MissingRequiredHeader"

	// ServiceCodeMissingRequiredXMLNode means a required XML node was not specified in the request body (400).
	ServiceCodeMissingRequiredXMLNode ServiceCodeType = "MissingRequiredXmlNode"

	// ServiceCodeMultipleConditionHeadersNotSupported means multiple condition headers are not supported (400).
	ServiceCodeMultipleConditionHeadersNotSupported ServiceCodeType = "MultipleConditionHeadersNotSupported"

	// ServiceCodeOperationTimedOut means the operation could not be completed within the permitted time (500).
	ServiceCodeOperationTimedOut ServiceCodeType = "OperationTimedOut"

	// ServiceCodeOutOfRangeInput means one of the request inputs is out of range (400).
	ServiceCodeOutOfRangeInput ServiceCodeType = "OutOfRangeInput"

	// ServiceCodeOutOfRangeQueryParameterValue means a query parameter specified in the request URI is outside the permissible range (400).
	ServiceCodeOutOfRangeQueryParameterValue ServiceCodeType = "OutOfRangeQueryParameterValue"

	// ServiceCodeRequestBodyTooLarge means the size of the request body exceeds the maximum size permitted (413).
	ServiceCodeRequestBodyTooLarge ServiceCodeType = "RequestBodyTooLarge"

	// ServiceCodeResourceTypeMismatch means the specified resource type does not match the type of the existing resource (409).
	ServiceCodeResourceTypeMismatch ServiceCodeType = "ResourceTypeMismatch"

	// ServiceCodeRequestURLFailedToParse means the url in the request could not be parsed (400).
	ServiceCodeRequestURLFailedToParse ServiceCodeType = "RequestUrlFailedToParse"

	// ServiceCodeResourceAlreadyExists means the specified resource already exists (409).
	ServiceCodeResourceAlreadyExists ServiceCodeType = "ResourceAlreadyExists"

	// ServiceCodeResourceNotFound means the specified resource does not exist (404).
	ServiceCodeResourceNotFound ServiceCodeType = "ResourceNotFound"

	// ServiceCodeNoAuthenticationInformation means the specified authentication for the resource does not exist (401).
	ServiceCodeNoAuthenticationInformation ServiceCodeType = "NoAuthenticationInformation"

	// ServiceCodeServerBusy means the server is currently unable to receive requests. Please retry your request or Ingress/egress is over the account limit or operations per second is over the account limit (503).
	ServiceCodeServerBusy ServiceCodeType = "ServerBusy"

	// ServiceCodeUnsupportedHeader means one of the HTTP headers specified in the request is not supported (400).
	ServiceCodeUnsupportedHeader ServiceCodeType = "UnsupportedHeader"

	// ServiceCodeUnsupportedXMLNode means one of the XML nodes specified in the request body is not supported (400).
	ServiceCodeUnsupportedXMLNode ServiceCodeType = "UnsupportedXmlNode"

	// ServiceCodeUnsupportedQueryParameter means one of the query parameters specified in the request URI is not supported (400).
	ServiceCodeUnsupportedQueryParameter ServiceCodeType = "UnsupportedQueryParameter"

	// ServiceCodeUnsupportedHTTPVerb means the resource doesn't support the specified HTTP verb (405).
	ServiceCodeUnsupportedHTTPVerb ServiceCodeType = "UnsupportedHttpVerb"
)
