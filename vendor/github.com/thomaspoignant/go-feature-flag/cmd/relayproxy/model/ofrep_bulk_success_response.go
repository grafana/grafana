package model

type OFREPBulkEvaluateSuccessResponse struct {
	Flags []OFREPFlagBulkEvaluateSuccessResponse `json:"flags"`
}

type OFREPFlagBulkEvaluateSuccessResponse struct {
	OFREPEvaluateSuccessResponse `json:",inline"`
	ErrorCode                    string `json:"errorCode,omitempty"`
	ErrorDetails                 string `json:"errorDetails,omitempty"`
}
