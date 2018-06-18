// package mssql implements the TDS protocol used to connect to MS SQL Server (sqlserver)
// database servers.
//
// This package registers two drivers:
//    sqlserver: uses native "@" parameter placeholder names and does no pre-processing.
//    mssql: expects identifiers to be prefixed with ":" and pre-processes queries.
//
// If the ordinal position is used for query parameters, identifiers will be named
// "@p1", "@p2", ... "@pN".
//
// Please refer to the README for the format of the DSN.
package mssql
