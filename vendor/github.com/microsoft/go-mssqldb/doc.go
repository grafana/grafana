// package mssql implements the TDS protocol used to connect to MS SQL Server (sqlserver)
// database servers.
//
// This package registers the driver:
//    sqlserver: uses native "@" parameter placeholder names and does no pre-processing.
//
// If the ordinal position is used for query parameters, identifiers will be named
// "@p1", "@p2", ... "@pN".
//
// Please refer to the README for the format of the DSN. There are multiple DSN
// formats accepted: ADO style, ODBC style, and URL style. The following is an
// example of a URL style DSN:
//    sqlserver://sa:mypass@localhost:1234?database=master&connection+timeout=30
package mssql
