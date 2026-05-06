package mstypes

// CypherBlock implements https://msdn.microsoft.com/en-us/library/cc237040.aspx
type CypherBlock struct {
	Data [8]byte // size = 8
}

// UserSessionKey implements https://msdn.microsoft.com/en-us/library/cc237080.aspx
type UserSessionKey struct {
	CypherBlock [2]CypherBlock // size = 2
}
