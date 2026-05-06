// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Code generated from semantic convention specification. DO NOT EDIT.

package semconv

// This document defines the shared attributes used to report a single exception associated with a span or log.
const (
	// The type of the exception (its fully-qualified class name, if applicable). The
	// dynamic type of the exception should be preferred over the static type in
	// languages that support it.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'java.net.ConnectException', 'OSError'
	AttributeExceptionType = "exception.type"
	// The exception message.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Division by zero', "Can't convert 'int' object to str implicitly"
	AttributeExceptionMessage = "exception.message"
	// A stacktrace as a string in the natural representation for the language
	// runtime. The representation is to be determined and documented by each language
	// SIG.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Exception in thread "main" java.lang.RuntimeException: Test
	// exception\\n at '
	//  'com.example.GenerateTrace.methodB(GenerateTrace.java:13)\\n at '
	//  'com.example.GenerateTrace.methodA(GenerateTrace.java:9)\\n at '
	//  'com.example.GenerateTrace.main(GenerateTrace.java:5)'
	AttributeExceptionStacktrace = "exception.stacktrace"
)

// This document defines attributes for Events represented using Log Records.
const (
	// The name identifies the event.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'click', 'exception'
	AttributeEventName = "event.name"
	// The domain identifies the business context for the events.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	// Note: Events across different domains may have same event.name, yet be
	// unrelated events.
	AttributeEventDomain = "event.domain"
)

const (
	// Events from browser apps
	AttributeEventDomainBrowser = "browser"
	// Events from mobile apps
	AttributeEventDomainDevice = "device"
	// Events from Kubernetes
	AttributeEventDomainK8S = "k8s"
)

// Span attributes used by AWS Lambda (in addition to general `faas` attributes).
const (
	// The full invoked ARN as provided on the Context passed to the function (Lambda-
	// Runtime-Invoked-Function-ARN header on the /runtime/invocation/next
	// applicable).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:lambda:us-east-1:123456:function:myfunction:myalias'
	// Note: This may be different from faas.id if an alias is involved.
	AttributeAWSLambdaInvokedARN = "aws.lambda.invoked_arn"
)

// This document defines attributes for CloudEvents. CloudEvents is a specification on how to define event data in a standard way. These attributes can be attached to spans when performing operations with CloudEvents, regardless of the protocol being used.
const (
	// The event_id uniquely identifies the event.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: '123e4567-e89b-12d3-a456-426614174000', '0001'
	AttributeCloudeventsEventID = "cloudevents.event_id"
	// The source identifies the context in which an event happened.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'https://github.com/cloudevents', '/cloudevents/spec/pull/123', 'my-
	// service'
	AttributeCloudeventsEventSource = "cloudevents.event_source"
	// The version of the CloudEvents specification which the event uses.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '1.0'
	AttributeCloudeventsEventSpecVersion = "cloudevents.event_spec_version"
	// The event_type contains a value describing the type of event related to the
	// originating occurrence.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'com.github.pull_request.opened', 'com.example.object.deleted.v2'
	AttributeCloudeventsEventType = "cloudevents.event_type"
	// The subject of the event in the context of the event producer (identified by
	// source).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'mynewfile.jpg'
	AttributeCloudeventsEventSubject = "cloudevents.event_subject"
)

// This document defines semantic conventions for the OpenTracing Shim
const (
	// Parent-child Reference type
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Note: The causal relationship between a child Span and a parent Span.
	AttributeOpentracingRefType = "opentracing.ref_type"
)

const (
	// The parent Span depends on the child Span in some capacity
	AttributeOpentracingRefTypeChildOf = "child_of"
	// The parent Span does not depend in any way on the result of the child Span
	AttributeOpentracingRefTypeFollowsFrom = "follows_from"
)

// This document defines the attributes used to perform database client calls.
const (
	// An identifier for the database management system (DBMS) product being used. See
	// below for a list of well-known identifiers.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	AttributeDBSystem = "db.system"
	// The connection string used to connect to the database. It is recommended to
	// remove embedded credentials.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Server=(localdb)\\v11.0;Integrated Security=true;'
	AttributeDBConnectionString = "db.connection_string"
	// Username for accessing the database.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'readonly_user', 'reporting_user'
	AttributeDBUser = "db.user"
	// The fully-qualified class name of the Java Database Connectivity (JDBC) driver
	// used to connect.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'org.postgresql.Driver',
	// 'com.microsoft.sqlserver.jdbc.SQLServerDriver'
	AttributeDBJDBCDriverClassname = "db.jdbc.driver_classname"
	// This attribute is used to report the name of the database being accessed. For
	// commands that switch the database, this should be set to the target database
	// (even if the command fails).
	//
	// Type: string
	// Requirement Level: Conditionally Required - If applicable.
	// Stability: stable
	// Examples: 'customers', 'main'
	// Note: In some SQL databases, the database name to be used is called
	// &quot;schema name&quot;. In case there are multiple layers that could be
	// considered for database name (e.g. Oracle instance name and schema name), the
	// database name to be used is the more specific layer (e.g. Oracle schema name).
	AttributeDBName = "db.name"
	// The database statement being executed.
	//
	// Type: string
	// Requirement Level: Conditionally Required - If applicable and not explicitly
	// disabled via instrumentation configuration.
	// Stability: stable
	// Examples: 'SELECT * FROM wuser_table', 'SET mykey "WuValue"'
	// Note: The value may be sanitized to exclude sensitive information.
	AttributeDBStatement = "db.statement"
	// The name of the operation being executed, e.g. the MongoDB command name such as
	// findAndModify, or the SQL keyword.
	//
	// Type: string
	// Requirement Level: Conditionally Required - If `db.statement` is not
	// applicable.
	// Stability: stable
	// Examples: 'findAndModify', 'HMSET', 'SELECT'
	// Note: When setting this to an SQL keyword, it is not recommended to attempt any
	// client-side parsing of db.statement just to get this property, but it should be
	// set if the operation name is provided by the library being instrumented. If the
	// SQL statement has an ambiguous operation, or performs more than one operation,
	// this value may be omitted.
	AttributeDBOperation = "db.operation"
)

const (
	// Some other SQL database. Fallback only. See notes
	AttributeDBSystemOtherSQL = "other_sql"
	// Microsoft SQL Server
	AttributeDBSystemMSSQL = "mssql"
	// MySQL
	AttributeDBSystemMySQL = "mysql"
	// Oracle Database
	AttributeDBSystemOracle = "oracle"
	// IBM DB2
	AttributeDBSystemDB2 = "db2"
	// PostgreSQL
	AttributeDBSystemPostgreSQL = "postgresql"
	// Amazon Redshift
	AttributeDBSystemRedshift = "redshift"
	// Apache Hive
	AttributeDBSystemHive = "hive"
	// Cloudscape
	AttributeDBSystemCloudscape = "cloudscape"
	// HyperSQL DataBase
	AttributeDBSystemHSQLDB = "hsqldb"
	// Progress Database
	AttributeDBSystemProgress = "progress"
	// SAP MaxDB
	AttributeDBSystemMaxDB = "maxdb"
	// SAP HANA
	AttributeDBSystemHanaDB = "hanadb"
	// Ingres
	AttributeDBSystemIngres = "ingres"
	// FirstSQL
	AttributeDBSystemFirstSQL = "firstsql"
	// EnterpriseDB
	AttributeDBSystemEDB = "edb"
	// InterSystems Caché
	AttributeDBSystemCache = "cache"
	// Adabas (Adaptable Database System)
	AttributeDBSystemAdabas = "adabas"
	// Firebird
	AttributeDBSystemFirebird = "firebird"
	// Apache Derby
	AttributeDBSystemDerby = "derby"
	// FileMaker
	AttributeDBSystemFilemaker = "filemaker"
	// Informix
	AttributeDBSystemInformix = "informix"
	// InstantDB
	AttributeDBSystemInstantDB = "instantdb"
	// InterBase
	AttributeDBSystemInterbase = "interbase"
	// MariaDB
	AttributeDBSystemMariaDB = "mariadb"
	// Netezza
	AttributeDBSystemNetezza = "netezza"
	// Pervasive PSQL
	AttributeDBSystemPervasive = "pervasive"
	// PointBase
	AttributeDBSystemPointbase = "pointbase"
	// SQLite
	AttributeDBSystemSqlite = "sqlite"
	// Sybase
	AttributeDBSystemSybase = "sybase"
	// Teradata
	AttributeDBSystemTeradata = "teradata"
	// Vertica
	AttributeDBSystemVertica = "vertica"
	// H2
	AttributeDBSystemH2 = "h2"
	// ColdFusion IMQ
	AttributeDBSystemColdfusion = "coldfusion"
	// Apache Cassandra
	AttributeDBSystemCassandra = "cassandra"
	// Apache HBase
	AttributeDBSystemHBase = "hbase"
	// MongoDB
	AttributeDBSystemMongoDB = "mongodb"
	// Redis
	AttributeDBSystemRedis = "redis"
	// Couchbase
	AttributeDBSystemCouchbase = "couchbase"
	// CouchDB
	AttributeDBSystemCouchDB = "couchdb"
	// Microsoft Azure Cosmos DB
	AttributeDBSystemCosmosDB = "cosmosdb"
	// Amazon DynamoDB
	AttributeDBSystemDynamoDB = "dynamodb"
	// Neo4j
	AttributeDBSystemNeo4j = "neo4j"
	// Apache Geode
	AttributeDBSystemGeode = "geode"
	// Elasticsearch
	AttributeDBSystemElasticsearch = "elasticsearch"
	// Memcached
	AttributeDBSystemMemcached = "memcached"
	// CockroachDB
	AttributeDBSystemCockroachdb = "cockroachdb"
	// OpenSearch
	AttributeDBSystemOpensearch = "opensearch"
)

// Connection-level attributes for Microsoft SQL Server
const (
	// The Microsoft SQL Server instance name connecting to. This name is used to
	// determine the port of a named instance.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'MSSQLSERVER'
	// Note: If setting a db.mssql.instance_name, net.peer.port is no longer required
	// (but still recommended if non-standard).
	AttributeDBMSSQLInstanceName = "db.mssql.instance_name"
)

// Call-level attributes for Cassandra
const (
	// The fetch size used for paging, i.e. how many rows will be returned at once.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 5000
	AttributeDBCassandraPageSize = "db.cassandra.page_size"
	// The consistency level of the query. Based on consistency values from CQL.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeDBCassandraConsistencyLevel = "db.cassandra.consistency_level"
	// The name of the primary table that the operation is acting upon, including the
	// keyspace name (if applicable).
	//
	// Type: string
	// Requirement Level: Recommended
	// Stability: stable
	// Examples: 'mytable'
	// Note: This mirrors the db.sql.table attribute but references cassandra rather
	// than sql. It is not recommended to attempt any client-side parsing of
	// db.statement just to get this property, but it should be set if it is provided
	// by the library being instrumented. If the operation is acting upon an anonymous
	// table, or more than one table, this value MUST NOT be set.
	AttributeDBCassandraTable = "db.cassandra.table"
	// Whether or not the query is idempotent.
	//
	// Type: boolean
	// Requirement Level: Optional
	// Stability: stable
	AttributeDBCassandraIdempotence = "db.cassandra.idempotence"
	// The number of times a query was speculatively executed. Not set or 0 if the
	// query was not executed speculatively.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 0, 2
	AttributeDBCassandraSpeculativeExecutionCount = "db.cassandra.speculative_execution_count"
	// The ID of the coordinating node for a query.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'be13faa2-8574-4d71-926d-27f16cf8a7af'
	AttributeDBCassandraCoordinatorID = "db.cassandra.coordinator.id"
	// The data center of the coordinating node for a query.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'us-west-2'
	AttributeDBCassandraCoordinatorDC = "db.cassandra.coordinator.dc"
)

const (
	// all
	AttributeDBCassandraConsistencyLevelAll = "all"
	// each_quorum
	AttributeDBCassandraConsistencyLevelEachQuorum = "each_quorum"
	// quorum
	AttributeDBCassandraConsistencyLevelQuorum = "quorum"
	// local_quorum
	AttributeDBCassandraConsistencyLevelLocalQuorum = "local_quorum"
	// one
	AttributeDBCassandraConsistencyLevelOne = "one"
	// two
	AttributeDBCassandraConsistencyLevelTwo = "two"
	// three
	AttributeDBCassandraConsistencyLevelThree = "three"
	// local_one
	AttributeDBCassandraConsistencyLevelLocalOne = "local_one"
	// any
	AttributeDBCassandraConsistencyLevelAny = "any"
	// serial
	AttributeDBCassandraConsistencyLevelSerial = "serial"
	// local_serial
	AttributeDBCassandraConsistencyLevelLocalSerial = "local_serial"
)

// Call-level attributes for Redis
const (
	// The index of the database being accessed as used in the SELECT command,
	// provided as an integer. To be used instead of the generic db.name attribute.
	//
	// Type: int
	// Requirement Level: Conditionally Required - If other than the default database
	// (`0`).
	// Stability: stable
	// Examples: 0, 1, 15
	AttributeDBRedisDBIndex = "db.redis.database_index"
)

// Call-level attributes for MongoDB
const (
	// The collection being accessed within the database stated in db.name.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'customers', 'products'
	AttributeDBMongoDBCollection = "db.mongodb.collection"
)

// Call-level attributes for SQL databases
const (
	// The name of the primary table that the operation is acting upon, including the
	// database name (if applicable).
	//
	// Type: string
	// Requirement Level: Recommended
	// Stability: stable
	// Examples: 'public.users', 'customers'
	// Note: It is not recommended to attempt any client-side parsing of db.statement
	// just to get this property, but it should be set if it is provided by the
	// library being instrumented. If the operation is acting upon an anonymous table,
	// or more than one table, this value MUST NOT be set.
	AttributeDBSQLTable = "db.sql.table"
)

// Span attributes used by non-OTLP exporters to represent OpenTelemetry Span's concepts.
const (
	// Name of the code, either &quot;OK&quot; or &quot;ERROR&quot;. MUST NOT be set
	// if the status code is UNSET.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeOtelStatusCode = "otel.status_code"
	// Description of the Status if it has a value, otherwise not set.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'resource not found'
	AttributeOtelStatusDescription = "otel.status_description"
)

const (
	// The operation has been validated by an Application developer or Operator to have completed successfully
	AttributeOtelStatusCodeOk = "OK"
	// The operation contains an error
	AttributeOtelStatusCodeError = "ERROR"
)

// This semantic convention describes an instance of a function that runs without provisioning or managing of servers (also known as serverless functions or Function as a Service (FaaS)) with spans.
const (
	// Type of the trigger which caused this function execution.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Note: For the server/consumer span on the incoming side,
	// faas.trigger MUST be set.Clients invoking FaaS instances usually cannot set
	// faas.trigger,
	// since they would typically need to look in the payload to determine
	// the event type. If clients set it, it should be the same as the
	// trigger that corresponding incoming would have (i.e., this has
	// nothing to do with the underlying transport used to make the API
	// call to invoke the lambda, which is often HTTP).
	AttributeFaaSTrigger = "faas.trigger"
	// The execution ID of the current function execution.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'af9d5aa4-a685-4c5f-a22b-444f80b3cc28'
	AttributeFaaSExecution = "faas.execution"
)

const (
	// A response to some data source operation such as a database or filesystem read/write
	AttributeFaaSTriggerDatasource = "datasource"
	// To provide an answer to an inbound HTTP request
	AttributeFaaSTriggerHTTP = "http"
	// A function is set to be executed when messages are sent to a messaging system
	AttributeFaaSTriggerPubsub = "pubsub"
	// A function is scheduled to be executed regularly
	AttributeFaaSTriggerTimer = "timer"
	// If none of the others apply
	AttributeFaaSTriggerOther = "other"
)

// Semantic Convention for FaaS triggered as a response to some data source operation such as a database or filesystem read/write.
const (
	// The name of the source on which the triggering operation was performed. For
	// example, in Cloud Storage or S3 corresponds to the bucket name, and in Cosmos
	// DB to the database name.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'myBucketName', 'myDBName'
	AttributeFaaSDocumentCollection = "faas.document.collection"
	// Describes the type of the operation that was performed on the data.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	AttributeFaaSDocumentOperation = "faas.document.operation"
	// A string containing the time when the data was accessed in the ISO 8601 format
	// expressed in UTC.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '2020-01-23T13:47:06Z'
	AttributeFaaSDocumentTime = "faas.document.time"
	// The document name/table subjected to the operation. For example, in Cloud
	// Storage or S3 is the name of the file, and in Cosmos DB the table name.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'myFile.txt', 'myTableName'
	AttributeFaaSDocumentName = "faas.document.name"
)

const (
	// When a new object is created
	AttributeFaaSDocumentOperationInsert = "insert"
	// When an object is modified
	AttributeFaaSDocumentOperationEdit = "edit"
	// When an object is deleted
	AttributeFaaSDocumentOperationDelete = "delete"
)

// Semantic Convention for FaaS scheduled to be executed regularly.
const (
	// A string containing the function invocation time in the ISO 8601 format
	// expressed in UTC.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '2020-01-23T13:47:06Z'
	AttributeFaaSTime = "faas.time"
	// A string containing the schedule period as Cron Expression.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '0/5 * * * ? *'
	AttributeFaaSCron = "faas.cron"
)

// Contains additional attributes for incoming FaaS spans.
const (
	// A boolean that is true if the serverless function is executed for the first
	// time (aka cold-start).
	//
	// Type: boolean
	// Requirement Level: Optional
	// Stability: stable
	AttributeFaaSColdstart = "faas.coldstart"
)

// Contains additional attributes for outgoing FaaS spans.
const (
	// The name of the invoked function.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'my-function'
	// Note: SHOULD be equal to the faas.name resource attribute of the invoked
	// function.
	AttributeFaaSInvokedName = "faas.invoked_name"
	// The cloud provider of the invoked function.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	// Note: SHOULD be equal to the cloud.provider resource attribute of the invoked
	// function.
	AttributeFaaSInvokedProvider = "faas.invoked_provider"
	// The cloud region of the invoked function.
	//
	// Type: string
	// Requirement Level: Conditionally Required - For some cloud providers, like AWS
	// or GCP, the region in which a function is hosted is essential to uniquely
	// identify the function and also part of its endpoint. Since it's part of the
	// endpoint being called, the region is always known to clients. In these cases,
	// `faas.invoked_region` MUST be set accordingly. If the region is unknown to the
	// client or not required for identifying the invoked function, setting
	// `faas.invoked_region` is optional.
	// Stability: stable
	// Examples: 'eu-central-1'
	// Note: SHOULD be equal to the cloud.region resource attribute of the invoked
	// function.
	AttributeFaaSInvokedRegion = "faas.invoked_region"
)

const (
	// Alibaba Cloud
	AttributeFaaSInvokedProviderAlibabaCloud = "alibaba_cloud"
	// Amazon Web Services
	AttributeFaaSInvokedProviderAWS = "aws"
	// Microsoft Azure
	AttributeFaaSInvokedProviderAzure = "azure"
	// Google Cloud Platform
	AttributeFaaSInvokedProviderGCP = "gcp"
	// Tencent Cloud
	AttributeFaaSInvokedProviderTencentCloud = "tencent_cloud"
)

// These attributes may be used for any network related operation.
const (
	// Transport protocol used. See note below.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeNetTransport = "net.transport"
	// Application layer protocol used. The value SHOULD be normalized to lowercase.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'amqp', 'http', 'mqtt'
	AttributeNetAppProtocolName = "net.app.protocol.name"
	// Version of the application layer protocol used. See note below.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '3.1.1'
	// Note: net.app.protocol.version refers to the version of the protocol used and
	// might be different from the protocol client's version. If the HTTP client used
	// has a version of 0.27.2, but sends HTTP version 1.1, this attribute should be
	// set to 1.1.
	AttributeNetAppProtocolVersion = "net.app.protocol.version"
	// Remote socket peer name.
	//
	// Type: string
	// Requirement Level: Recommended - If available and different from
	// `net.peer.name` and if `net.sock.peer.addr` is set.
	// Stability: stable
	// Examples: 'proxy.example.com'
	AttributeNetSockPeerName = "net.sock.peer.name"
	// Remote socket peer address: IPv4 or IPv6 for internet protocols, path for local
	// communication, etc.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '127.0.0.1', '/tmp/mysql.sock'
	AttributeNetSockPeerAddr = "net.sock.peer.addr"
	// Remote socket peer port.
	//
	// Type: int
	// Requirement Level: Recommended - If defined for the address family and if
	// different than `net.peer.port` and if `net.sock.peer.addr` is set.
	// Stability: stable
	// Examples: 16456
	AttributeNetSockPeerPort = "net.sock.peer.port"
	// Protocol address family which is used for communication.
	//
	// Type: Enum
	// Requirement Level: Conditionally Required - If different than `inet` and if any
	// of `net.sock.peer.addr` or `net.sock.host.addr` are set. Consumers of telemetry
	// SHOULD accept both IPv4 and IPv6 formats for the address in
	// `net.sock.peer.addr` if `net.sock.family` is not set. This is to support
	// instrumentations that follow previous versions of this document.
	// Stability: stable
	// Examples: 'inet6', 'bluetooth'
	AttributeNetSockFamily = "net.sock.family"
	// Logical remote hostname, see note below.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'example.com'
	// Note: net.peer.name SHOULD NOT be set if capturing it would require an extra
	// DNS lookup.
	AttributeNetPeerName = "net.peer.name"
	// Logical remote port number
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 80, 8080, 443
	AttributeNetPeerPort = "net.peer.port"
	// Logical local hostname or similar, see note below.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'localhost'
	AttributeNetHostName = "net.host.name"
	// Logical local port number, preferably the one that the peer used to connect
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 8080
	AttributeNetHostPort = "net.host.port"
	// Local socket address. Useful in case of a multi-IP host.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '192.168.0.1'
	AttributeNetSockHostAddr = "net.sock.host.addr"
	// Local socket port number.
	//
	// Type: int
	// Requirement Level: Recommended - If defined for the address family and if
	// different than `net.host.port` and if `net.sock.host.addr` is set.
	// Stability: stable
	// Examples: 35555
	AttributeNetSockHostPort = "net.sock.host.port"
	// The internet connection type currently being used by the host.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'wifi'
	AttributeNetHostConnectionType = "net.host.connection.type"
	// This describes more details regarding the connection.type. It may be the type
	// of cell technology connection, but it could be used for describing details
	// about a wifi connection.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'LTE'
	AttributeNetHostConnectionSubtype = "net.host.connection.subtype"
	// The name of the mobile carrier.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'sprint'
	AttributeNetHostCarrierName = "net.host.carrier.name"
	// The mobile carrier country code.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '310'
	AttributeNetHostCarrierMcc = "net.host.carrier.mcc"
	// The mobile carrier network code.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '001'
	AttributeNetHostCarrierMnc = "net.host.carrier.mnc"
	// The ISO 3166-1 alpha-2 2-character country code associated with the mobile
	// carrier network.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'DE'
	AttributeNetHostCarrierIcc = "net.host.carrier.icc"
)

const (
	// ip_tcp
	AttributeNetTransportTCP = "ip_tcp"
	// ip_udp
	AttributeNetTransportUDP = "ip_udp"
	// Named or anonymous pipe. See note below
	AttributeNetTransportPipe = "pipe"
	// In-process communication
	AttributeNetTransportInProc = "inproc"
	// Something else (non IP-based)
	AttributeNetTransportOther = "other"
)

const (
	// IPv4 address
	AttributeNetSockFamilyInet = "inet"
	// IPv6 address
	AttributeNetSockFamilyInet6 = "inet6"
	// Unix domain socket path
	AttributeNetSockFamilyUnix = "unix"
)

const (
	// wifi
	AttributeNetHostConnectionTypeWifi = "wifi"
	// wired
	AttributeNetHostConnectionTypeWired = "wired"
	// cell
	AttributeNetHostConnectionTypeCell = "cell"
	// unavailable
	AttributeNetHostConnectionTypeUnavailable = "unavailable"
	// unknown
	AttributeNetHostConnectionTypeUnknown = "unknown"
)

const (
	// GPRS
	AttributeNetHostConnectionSubtypeGprs = "gprs"
	// EDGE
	AttributeNetHostConnectionSubtypeEdge = "edge"
	// UMTS
	AttributeNetHostConnectionSubtypeUmts = "umts"
	// CDMA
	AttributeNetHostConnectionSubtypeCdma = "cdma"
	// EVDO Rel. 0
	AttributeNetHostConnectionSubtypeEvdo0 = "evdo_0"
	// EVDO Rev. A
	AttributeNetHostConnectionSubtypeEvdoA = "evdo_a"
	// CDMA2000 1XRTT
	AttributeNetHostConnectionSubtypeCdma20001xrtt = "cdma2000_1xrtt"
	// HSDPA
	AttributeNetHostConnectionSubtypeHsdpa = "hsdpa"
	// HSUPA
	AttributeNetHostConnectionSubtypeHsupa = "hsupa"
	// HSPA
	AttributeNetHostConnectionSubtypeHspa = "hspa"
	// IDEN
	AttributeNetHostConnectionSubtypeIden = "iden"
	// EVDO Rev. B
	AttributeNetHostConnectionSubtypeEvdoB = "evdo_b"
	// LTE
	AttributeNetHostConnectionSubtypeLte = "lte"
	// EHRPD
	AttributeNetHostConnectionSubtypeEhrpd = "ehrpd"
	// HSPAP
	AttributeNetHostConnectionSubtypeHspap = "hspap"
	// GSM
	AttributeNetHostConnectionSubtypeGsm = "gsm"
	// TD-SCDMA
	AttributeNetHostConnectionSubtypeTdScdma = "td_scdma"
	// IWLAN
	AttributeNetHostConnectionSubtypeIwlan = "iwlan"
	// 5G NR (New Radio)
	AttributeNetHostConnectionSubtypeNr = "nr"
	// 5G NRNSA (New Radio Non-Standalone)
	AttributeNetHostConnectionSubtypeNrnsa = "nrnsa"
	// LTE CA
	AttributeNetHostConnectionSubtypeLteCa = "lte_ca"
)

// Operations that access some remote service.
const (
	// The service.name of the remote service. SHOULD be equal to the actual
	// service.name resource attribute of the remote service if any.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'AuthTokenCache'
	AttributePeerService = "peer.service"
)

// These attributes may be used for any operation with an authenticated and/or authorized enduser.
const (
	// Username or client_id extracted from the access token or Authorization header
	// in the inbound request from outside the system.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'username'
	AttributeEnduserID = "enduser.id"
	// Actual/assumed role the client is making the request under extracted from token
	// or application security context.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'admin'
	AttributeEnduserRole = "enduser.role"
	// Scopes or granted authorities the client currently possesses extracted from
	// token or application security context. The value would come from the scope
	// associated with an OAuth 2.0 Access Token or an attribute value in a SAML 2.0
	// Assertion.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'read:message, write:files'
	AttributeEnduserScope = "enduser.scope"
)

// These attributes may be used for any operation to store information about a thread that started a span.
const (
	// Current &quot;managed&quot; thread ID (as opposed to OS thread ID).
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 42
	AttributeThreadID = "thread.id"
	// Current thread name.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'main'
	AttributeThreadName = "thread.name"
)

// These attributes allow to report this unit of code and therefore to provide more context about the span.
const (
	// The method or function name, or equivalent (usually rightmost part of the code
	// unit's name).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'serveRequest'
	AttributeCodeFunction = "code.function"
	// The &quot;namespace&quot; within which code.function is defined. Usually the
	// qualified class or module name, such that code.namespace + some separator +
	// code.function form a unique identifier for the code unit.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'com.example.MyHTTPService'
	AttributeCodeNamespace = "code.namespace"
	// The source code file name that identifies the code unit as uniquely as possible
	// (preferably an absolute file path).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '/usr/local/MyApplication/content_root/app/index.php'
	AttributeCodeFilepath = "code.filepath"
	// The line number in code.filepath best representing the operation. It SHOULD
	// point within the code unit named in code.function.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 42
	AttributeCodeLineNumber = "code.lineno"
)

// This document defines semantic conventions for HTTP client and server Spans.
const (
	// HTTP request method.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'GET', 'POST', 'HEAD'
	AttributeHTTPMethod = "http.method"
	// HTTP response status code.
	//
	// Type: int
	// Requirement Level: Conditionally Required - If and only if one was
	// received/sent.
	// Stability: stable
	// Examples: 200
	AttributeHTTPStatusCode = "http.status_code"
	// Kind of HTTP protocol used.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Note: If net.transport is not specified, it can be assumed to be IP.TCP except
	// if http.flavor is QUIC, in which case IP.UDP is assumed.
	AttributeHTTPFlavor = "http.flavor"
	// Value of the HTTP User-Agent header sent by the client.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'CERN-LineMode/2.15 libwww/2.17b3'
	AttributeHTTPUserAgent = "http.user_agent"
	// The size of the request payload body in bytes. This is the number of bytes
	// transferred excluding headers and is often, but not always, present as the
	// Content-Length header. For requests using transport encoding, this should be
	// the compressed size.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 3495
	AttributeHTTPRequestContentLength = "http.request_content_length"
	// The size of the response payload body in bytes. This is the number of bytes
	// transferred excluding headers and is often, but not always, present as the
	// Content-Length header. For requests using transport encoding, this should be
	// the compressed size.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 3495
	AttributeHTTPResponseContentLength = "http.response_content_length"
)

const (
	// HTTP/1.0
	AttributeHTTPFlavorHTTP10 = "1.0"
	// HTTP/1.1
	AttributeHTTPFlavorHTTP11 = "1.1"
	// HTTP/2
	AttributeHTTPFlavorHTTP20 = "2.0"
	// HTTP/3
	AttributeHTTPFlavorHTTP30 = "3.0"
	// SPDY protocol
	AttributeHTTPFlavorSPDY = "SPDY"
	// QUIC protocol
	AttributeHTTPFlavorQUIC = "QUIC"
)

// Semantic Convention for HTTP Client
const (
	// Full HTTP request URL in the form scheme://host[:port]/path?query[#fragment].
	// Usually the fragment is not transmitted over HTTP, but if it is known, it
	// should be included nevertheless.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'https://www.foo.bar/search?q=OpenTelemetry#SemConv'
	// Note: http.url MUST NOT contain credentials passed via URL in form of
	// https://username:password@www.example.com/. In such case the attribute's value
	// should be https://www.example.com/.
	AttributeHTTPURL = "http.url"
	// The ordinal number of request resending attempt (for any reason, including
	// redirects).
	//
	// Type: int
	// Requirement Level: Recommended - if and only if request was retried.
	// Stability: stable
	// Examples: 3
	// Note: The resend count SHOULD be updated each time an HTTP request gets resent
	// by the client, regardless of what was the cause of the resending (e.g.
	// redirection, authorization failure, 503 Server Unavailable, network issues, or
	// any other).
	AttributeHTTPResendCount = "http.resend_count"
)

// Semantic Convention for HTTP Server
const (
	// The URI scheme identifying the used protocol.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'http', 'https'
	AttributeHTTPScheme = "http.scheme"
	// The full request target as passed in a HTTP request line or equivalent.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: '/path/12314/?q=ddds'
	AttributeHTTPTarget = "http.target"
	// The matched route (path template in the format used by the respective server
	// framework). See note below
	//
	// Type: string
	// Requirement Level: Conditionally Required - If and only if it's available
	// Stability: stable
	// Examples: '/users/:userID?', '{controller}/{action}/{id?}'
	// Note: 'http.route' MUST NOT be populated when this is not supported by the HTTP
	// server framework as the route attribute should have low-cardinality and the URI
	// path can NOT substitute it.
	AttributeHTTPRoute = "http.route"
	// The IP address of the original client behind all proxies, if known (e.g. from
	// X-Forwarded-For).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '83.164.160.102'
	// Note: This is not necessarily the same as net.sock.peer.addr, which would
	// identify the network-level peer, which may be a proxy.This attribute should be
	// set when a source of information different
	// from the one used for net.sock.peer.addr, is available even if that other
	// source just confirms the same value as net.sock.peer.addr.
	// Rationale: For net.sock.peer.addr, one typically does not know if it
	// comes from a proxy, reverse proxy, or the actual client. Setting
	// http.client_ip when it's the same as net.sock.peer.addr means that
	// one is at least somewhat confident that the address is not that of
	// the closest proxy.
	AttributeHTTPClientIP = "http.client_ip"
)

// Attributes that exist for multiple DynamoDB request types.
const (
	// The keys in the RequestItems object field.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Users', 'Cats'
	AttributeAWSDynamoDBTableNames = "aws.dynamodb.table_names"
	// The JSON-serialized value of each item in the ConsumedCapacity response field.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '{ "CapacityUnits": number, "GlobalSecondaryIndexes": { "string" : {
	// "CapacityUnits": number, "ReadCapacityUnits": number, "WriteCapacityUnits":
	// number } }, "LocalSecondaryIndexes": { "string" : { "CapacityUnits": number,
	// "ReadCapacityUnits": number, "WriteCapacityUnits": number } },
	// "ReadCapacityUnits": number, "Table": { "CapacityUnits": number,
	// "ReadCapacityUnits": number, "WriteCapacityUnits": number }, "TableName":
	// "string", "WriteCapacityUnits": number }'
	AttributeAWSDynamoDBConsumedCapacity = "aws.dynamodb.consumed_capacity"
	// The JSON-serialized value of the ItemCollectionMetrics response field.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '{ "string" : [ { "ItemCollectionKey": { "string" : { "B": blob,
	// "BOOL": boolean, "BS": [ blob ], "L": [ "AttributeValue" ], "M": { "string" :
	// "AttributeValue" }, "N": "string", "NS": [ "string" ], "NULL": boolean, "S":
	// "string", "SS": [ "string" ] } }, "SizeEstimateRangeGB": [ number ] } ] }'
	AttributeAWSDynamoDBItemCollectionMetrics = "aws.dynamodb.item_collection_metrics"
	// The value of the ProvisionedThroughput.ReadCapacityUnits request parameter.
	//
	// Type: double
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 1.0, 2.0
	AttributeAWSDynamoDBProvisionedReadCapacity = "aws.dynamodb.provisioned_read_capacity"
	// The value of the ProvisionedThroughput.WriteCapacityUnits request parameter.
	//
	// Type: double
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 1.0, 2.0
	AttributeAWSDynamoDBProvisionedWriteCapacity = "aws.dynamodb.provisioned_write_capacity"
	// The value of the ConsistentRead request parameter.
	//
	// Type: boolean
	// Requirement Level: Optional
	// Stability: stable
	AttributeAWSDynamoDBConsistentRead = "aws.dynamodb.consistent_read"
	// The value of the ProjectionExpression request parameter.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Title', 'Title, Price, Color', 'Title, Description, RelatedItems,
	// ProductReviews'
	AttributeAWSDynamoDBProjection = "aws.dynamodb.projection"
	// The value of the Limit request parameter.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 10
	AttributeAWSDynamoDBLimit = "aws.dynamodb.limit"
	// The value of the AttributesToGet request parameter.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'lives', 'id'
	AttributeAWSDynamoDBAttributesToGet = "aws.dynamodb.attributes_to_get"
	// The value of the IndexName request parameter.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'name_to_group'
	AttributeAWSDynamoDBIndexName = "aws.dynamodb.index_name"
	// The value of the Select request parameter.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'ALL_ATTRIBUTES', 'COUNT'
	AttributeAWSDynamoDBSelect = "aws.dynamodb.select"
)

// DynamoDB.CreateTable
const (
	// The JSON-serialized value of each item of the GlobalSecondaryIndexes request
	// field
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '{ "IndexName": "string", "KeySchema": [ { "AttributeName": "string",
	// "KeyType": "string" } ], "Projection": { "NonKeyAttributes": [ "string" ],
	// "ProjectionType": "string" }, "ProvisionedThroughput": { "ReadCapacityUnits":
	// number, "WriteCapacityUnits": number } }'
	AttributeAWSDynamoDBGlobalSecondaryIndexes = "aws.dynamodb.global_secondary_indexes"
	// The JSON-serialized value of each item of the LocalSecondaryIndexes request
	// field.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '{ "IndexARN": "string", "IndexName": "string", "IndexSizeBytes":
	// number, "ItemCount": number, "KeySchema": [ { "AttributeName": "string",
	// "KeyType": "string" } ], "Projection": { "NonKeyAttributes": [ "string" ],
	// "ProjectionType": "string" } }'
	AttributeAWSDynamoDBLocalSecondaryIndexes = "aws.dynamodb.local_secondary_indexes"
)

// DynamoDB.ListTables
const (
	// The value of the ExclusiveStartTableName request parameter.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Users', 'CatsTable'
	AttributeAWSDynamoDBExclusiveStartTable = "aws.dynamodb.exclusive_start_table"
	// The the number of items in the TableNames response parameter.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 20
	AttributeAWSDynamoDBTableCount = "aws.dynamodb.table_count"
)

// DynamoDB.Query
const (
	// The value of the ScanIndexForward request parameter.
	//
	// Type: boolean
	// Requirement Level: Optional
	// Stability: stable
	AttributeAWSDynamoDBScanForward = "aws.dynamodb.scan_forward"
)

// DynamoDB.Scan
const (
	// The value of the Segment request parameter.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 10
	AttributeAWSDynamoDBSegment = "aws.dynamodb.segment"
	// The value of the TotalSegments request parameter.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 100
	AttributeAWSDynamoDBTotalSegments = "aws.dynamodb.total_segments"
	// The value of the Count response parameter.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 10
	AttributeAWSDynamoDBCount = "aws.dynamodb.count"
	// The value of the ScannedCount response parameter.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 50
	AttributeAWSDynamoDBScannedCount = "aws.dynamodb.scanned_count"
)

// DynamoDB.UpdateTable
const (
	// The JSON-serialized value of each item in the AttributeDefinitions request
	// field.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '{ "AttributeName": "string", "AttributeType": "string" }'
	AttributeAWSDynamoDBAttributeDefinitions = "aws.dynamodb.attribute_definitions"
	// The JSON-serialized value of each item in the the GlobalSecondaryIndexUpdates
	// request field.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '{ "Create": { "IndexName": "string", "KeySchema": [ {
	// "AttributeName": "string", "KeyType": "string" } ], "Projection": {
	// "NonKeyAttributes": [ "string" ], "ProjectionType": "string" },
	// "ProvisionedThroughput": { "ReadCapacityUnits": number, "WriteCapacityUnits":
	// number } }'
	AttributeAWSDynamoDBGlobalSecondaryIndexUpdates = "aws.dynamodb.global_secondary_index_updates"
)

// This document defines semantic conventions to apply when instrumenting the GraphQL implementation. They map GraphQL operations to attributes on a Span.
const (
	// The name of the operation being executed.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'findBookByID'
	AttributeGraphqlOperationName = "graphql.operation.name"
	// The type of the operation being executed.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'query', 'mutation', 'subscription'
	AttributeGraphqlOperationType = "graphql.operation.type"
	// The GraphQL document being executed.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'query findBookByID { bookByID(id: ?) { name } }'
	// Note: The value may be sanitized to exclude sensitive information.
	AttributeGraphqlDocument = "graphql.document"
)

const (
	// GraphQL query
	AttributeGraphqlOperationTypeQuery = "query"
	// GraphQL mutation
	AttributeGraphqlOperationTypeMutation = "mutation"
	// GraphQL subscription
	AttributeGraphqlOperationTypeSubscription = "subscription"
)

// This document defines the attributes used in messaging systems.
const (
	// A string identifying the messaging system.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'kafka', 'rabbitmq', 'rocketmq', 'activemq', 'AmazonSQS'
	AttributeMessagingSystem = "messaging.system"
	// The message destination name. This might be equal to the span name but is
	// required nevertheless.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'MyQueue', 'MyTopic'
	AttributeMessagingDestination = "messaging.destination"
	// The kind of message destination
	//
	// Type: Enum
	// Requirement Level: Conditionally Required - If the message destination is
	// either a `queue` or `topic`.
	// Stability: stable
	AttributeMessagingDestinationKind = "messaging.destination_kind"
	// A boolean that is true if the message destination is temporary.
	//
	// Type: boolean
	// Requirement Level: Conditionally Required - If value is `true`. When missing,
	// the value is assumed to be `false`.
	// Stability: stable
	AttributeMessagingTempDestination = "messaging.temp_destination"
	// The name of the transport protocol.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'AMQP', 'MQTT'
	AttributeMessagingProtocol = "messaging.protocol"
	// The version of the transport protocol.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '0.9.1'
	AttributeMessagingProtocolVersion = "messaging.protocol_version"
	// Connection string.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'tibjmsnaming://localhost:7222',
	// 'https://queue.amazonaws.com/80398EXAMPLE/MyQueue'
	AttributeMessagingURL = "messaging.url"
	// A value used by the messaging system as an identifier for the message,
	// represented as a string.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '452a7c7c7c7048c2f887f61572b18fc2'
	AttributeMessagingMessageID = "messaging.message_id"
	// The conversation ID identifying the conversation to which the message belongs,
	// represented as a string. Sometimes called &quot;Correlation ID&quot;.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'MyConversationID'
	AttributeMessagingConversationID = "messaging.conversation_id"
	// The (uncompressed) size of the message payload in bytes. Also use this
	// attribute if it is unknown whether the compressed or uncompressed payload size
	// is reported.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 2738
	AttributeMessagingMessagePayloadSizeBytes = "messaging.message_payload_size_bytes"
	// The compressed size of the message payload in bytes.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 2048
	AttributeMessagingMessagePayloadCompressedSizeBytes = "messaging.message_payload_compressed_size_bytes"
)

const (
	// A message sent to a queue
	AttributeMessagingDestinationKindQueue = "queue"
	// A message sent to a topic
	AttributeMessagingDestinationKindTopic = "topic"
)

// Semantic convention for a consumer of messages received from a messaging system
const (
	// A string identifying the kind of message consumption as defined in the
	// Operation names section above. If the operation is &quot;send&quot;, this
	// attribute MUST NOT be set, since the operation can be inferred from the span
	// kind in that case.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeMessagingOperation = "messaging.operation"
	// The identifier for the consumer receiving a message. For Kafka, set it to
	// {messaging.kafka.consumer_group} - {messaging.kafka.client_id}, if both are
	// present, or only messaging.kafka.consumer_group. For brokers, such as RabbitMQ
	// and Artemis, set it to the client_id of the client consuming the message.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'mygroup - client-6'
	AttributeMessagingConsumerID = "messaging.consumer_id"
)

const (
	// receive
	AttributeMessagingOperationReceive = "receive"
	// process
	AttributeMessagingOperationProcess = "process"
)

// Attributes for RabbitMQ
const (
	// RabbitMQ message routing key.
	//
	// Type: string
	// Requirement Level: Conditionally Required - If not empty.
	// Stability: stable
	// Examples: 'myKey'
	AttributeMessagingRabbitmqRoutingKey = "messaging.rabbitmq.routing_key"
)

// Attributes for Apache Kafka
const (
	// Message keys in Kafka are used for grouping alike messages to ensure they're
	// processed on the same partition. They differ from messaging.message_id in that
	// they're not unique. If the key is null, the attribute MUST NOT be set.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'myKey'
	// Note: If the key type is not string, it's string representation has to be
	// supplied for the attribute. If the key has no unambiguous, canonical string
	// form, don't include its value.
	AttributeMessagingKafkaMessageKey = "messaging.kafka.message_key"
	// Name of the Kafka Consumer Group that is handling the message. Only applies to
	// consumers, not producers.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'my-group'
	AttributeMessagingKafkaConsumerGroup = "messaging.kafka.consumer_group"
	// Client ID for the Consumer or Producer that is handling the message.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'client-5'
	AttributeMessagingKafkaClientID = "messaging.kafka.client_id"
	// Partition the message is sent to.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 2
	AttributeMessagingKafkaPartition = "messaging.kafka.partition"
	// The offset of a record in the corresponding Kafka partition.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 42
	AttributeMessagingKafkaMessageOffset = "messaging.kafka.message.offset"
	// A boolean that is true if the message is a tombstone.
	//
	// Type: boolean
	// Requirement Level: Conditionally Required - If value is `true`. When missing,
	// the value is assumed to be `false`.
	// Stability: stable
	AttributeMessagingKafkaTombstone = "messaging.kafka.tombstone"
)

// Attributes for Apache RocketMQ
const (
	// Namespace of RocketMQ resources, resources in different namespaces are
	// individual.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'myNamespace'
	AttributeMessagingRocketmqNamespace = "messaging.rocketmq.namespace"
	// Name of the RocketMQ producer/consumer group that is handling the message. The
	// client type is identified by the SpanKind.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'myConsumerGroup'
	AttributeMessagingRocketmqClientGroup = "messaging.rocketmq.client_group"
	// The unique identifier for each client.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'myhost@8742@s8083jm'
	AttributeMessagingRocketmqClientID = "messaging.rocketmq.client_id"
	// The timestamp in milliseconds that the delay message is expected to be
	// delivered to consumer.
	//
	// Type: int
	// Requirement Level: Conditionally Required - If the message type is delay and
	// delay time level is not specified.
	// Stability: stable
	// Examples: 1665987217045
	AttributeMessagingRocketmqDeliveryTimestamp = "messaging.rocketmq.delivery_timestamp"
	// The delay time level for delay message, which determines the message delay
	// time.
	//
	// Type: int
	// Requirement Level: Conditionally Required - If the message type is delay and
	// delivery timestamp is not specified.
	// Stability: stable
	// Examples: 3
	AttributeMessagingRocketmqDelayTimeLevel = "messaging.rocketmq.delay_time_level"
	// It is essential for FIFO message. Messages that belong to the same message
	// group are always processed one by one within the same consumer group.
	//
	// Type: string
	// Requirement Level: Conditionally Required - If the message type is FIFO.
	// Stability: stable
	// Examples: 'myMessageGroup'
	AttributeMessagingRocketmqMessageGroup = "messaging.rocketmq.message_group"
	// Type of message.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeMessagingRocketmqMessageType = "messaging.rocketmq.message_type"
	// The secondary classifier of message besides topic.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'tagA'
	AttributeMessagingRocketmqMessageTag = "messaging.rocketmq.message_tag"
	// Key(s) of message, another way to mark message besides message id.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'keyA', 'keyB'
	AttributeMessagingRocketmqMessageKeys = "messaging.rocketmq.message_keys"
	// Model of message consumption. This only applies to consumer spans.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeMessagingRocketmqConsumptionModel = "messaging.rocketmq.consumption_model"
)

const (
	// Normal message
	AttributeMessagingRocketmqMessageTypeNormal = "normal"
	// FIFO message
	AttributeMessagingRocketmqMessageTypeFifo = "fifo"
	// Delay message
	AttributeMessagingRocketmqMessageTypeDelay = "delay"
	// Transaction message
	AttributeMessagingRocketmqMessageTypeTransaction = "transaction"
)

const (
	// Clustering consumption model
	AttributeMessagingRocketmqConsumptionModelClustering = "clustering"
	// Broadcasting consumption model
	AttributeMessagingRocketmqConsumptionModelBroadcasting = "broadcasting"
)

// This document defines semantic conventions for remote procedure calls.
const (
	// A string identifying the remoting system. See below for a list of well-known
	// identifiers.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	AttributeRPCSystem = "rpc.system"
	// The full (logical) name of the service being called, including its package
	// name, if applicable.
	//
	// Type: string
	// Requirement Level: Recommended
	// Stability: stable
	// Examples: 'myservice.EchoService'
	// Note: This is the logical name of the service from the RPC interface
	// perspective, which can be different from the name of any implementing class.
	// The code.namespace attribute may be used to store the latter (despite the
	// attribute name, it may include a class name; e.g., class with method actually
	// executing the call on the server side, RPC client stub class on the client
	// side).
	AttributeRPCService = "rpc.service"
	// The name of the (logical) method being called, must be equal to the $method
	// part in the span name.
	//
	// Type: string
	// Requirement Level: Recommended
	// Stability: stable
	// Examples: 'exampleMethod'
	// Note: This is the logical name of the method from the RPC interface
	// perspective, which can be different from the name of any implementing
	// method/function. The code.function attribute may be used to store the latter
	// (e.g., method actually executing the call on the server side, RPC client stub
	// method on the client side).
	AttributeRPCMethod = "rpc.method"
)

const (
	// gRPC
	AttributeRPCSystemGRPC = "grpc"
	// Java RMI
	AttributeRPCSystemJavaRmi = "java_rmi"
	// .NET WCF
	AttributeRPCSystemDotnetWcf = "dotnet_wcf"
	// Apache Dubbo
	AttributeRPCSystemApacheDubbo = "apache_dubbo"
)

// Tech-specific attributes for gRPC.
const (
	// The numeric status code of the gRPC request.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	AttributeRPCGRPCStatusCode = "rpc.grpc.status_code"
)

const (
	// OK
	AttributeRPCGRPCStatusCodeOk = "0"
	// CANCELLED
	AttributeRPCGRPCStatusCodeCancelled = "1"
	// UNKNOWN
	AttributeRPCGRPCStatusCodeUnknown = "2"
	// INVALID_ARGUMENT
	AttributeRPCGRPCStatusCodeInvalidArgument = "3"
	// DEADLINE_EXCEEDED
	AttributeRPCGRPCStatusCodeDeadlineExceeded = "4"
	// NOT_FOUND
	AttributeRPCGRPCStatusCodeNotFound = "5"
	// ALREADY_EXISTS
	AttributeRPCGRPCStatusCodeAlreadyExists = "6"
	// PERMISSION_DENIED
	AttributeRPCGRPCStatusCodePermissionDenied = "7"
	// RESOURCE_EXHAUSTED
	AttributeRPCGRPCStatusCodeResourceExhausted = "8"
	// FAILED_PRECONDITION
	AttributeRPCGRPCStatusCodeFailedPrecondition = "9"
	// ABORTED
	AttributeRPCGRPCStatusCodeAborted = "10"
	// OUT_OF_RANGE
	AttributeRPCGRPCStatusCodeOutOfRange = "11"
	// UNIMPLEMENTED
	AttributeRPCGRPCStatusCodeUnimplemented = "12"
	// INTERNAL
	AttributeRPCGRPCStatusCodeInternal = "13"
	// UNAVAILABLE
	AttributeRPCGRPCStatusCodeUnavailable = "14"
	// DATA_LOSS
	AttributeRPCGRPCStatusCodeDataLoss = "15"
	// UNAUTHENTICATED
	AttributeRPCGRPCStatusCodeUnauthenticated = "16"
)

// Tech-specific attributes for [JSON RPC](https://www.jsonrpc.org/).
const (
	// Protocol version as in jsonrpc property of request/response. Since JSON-RPC 1.0
	// does not specify this, the value can be omitted.
	//
	// Type: string
	// Requirement Level: Conditionally Required - If other than the default version
	// (`1.0`)
	// Stability: stable
	// Examples: '2.0', '1.0'
	AttributeRPCJsonrpcVersion = "rpc.jsonrpc.version"
	// id property of request or response. Since protocol allows id to be int, string,
	// null or missing (for notifications), value is expected to be cast to string for
	// simplicity. Use empty string in case of null value. Omit entirely if this is a
	// notification.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '10', 'request-7', ''
	AttributeRPCJsonrpcRequestID = "rpc.jsonrpc.request_id"
	// error.code property of response if it is an error response.
	//
	// Type: int
	// Requirement Level: Conditionally Required - If response is not successful.
	// Stability: stable
	// Examples: -32700, 100
	AttributeRPCJsonrpcErrorCode = "rpc.jsonrpc.error_code"
	// error.message property of response if it is an error response.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Parse error', 'User already exists'
	AttributeRPCJsonrpcErrorMessage = "rpc.jsonrpc.error_message"
)

func GetTraceSemanticConventionAttributeNames() []string {
	return []string{
		AttributeExceptionType,
		AttributeExceptionMessage,
		AttributeExceptionStacktrace,
		AttributeEventName,
		AttributeEventDomain,
		AttributeAWSLambdaInvokedARN,
		AttributeCloudeventsEventID,
		AttributeCloudeventsEventSource,
		AttributeCloudeventsEventSpecVersion,
		AttributeCloudeventsEventType,
		AttributeCloudeventsEventSubject,
		AttributeOpentracingRefType,
		AttributeDBSystem,
		AttributeDBConnectionString,
		AttributeDBUser,
		AttributeDBJDBCDriverClassname,
		AttributeDBName,
		AttributeDBStatement,
		AttributeDBOperation,
		AttributeDBMSSQLInstanceName,
		AttributeDBCassandraPageSize,
		AttributeDBCassandraConsistencyLevel,
		AttributeDBCassandraTable,
		AttributeDBCassandraIdempotence,
		AttributeDBCassandraSpeculativeExecutionCount,
		AttributeDBCassandraCoordinatorID,
		AttributeDBCassandraCoordinatorDC,
		AttributeDBRedisDBIndex,
		AttributeDBMongoDBCollection,
		AttributeDBSQLTable,
		AttributeOtelStatusCode,
		AttributeOtelStatusDescription,
		AttributeFaaSTrigger,
		AttributeFaaSExecution,
		AttributeFaaSDocumentCollection,
		AttributeFaaSDocumentOperation,
		AttributeFaaSDocumentTime,
		AttributeFaaSDocumentName,
		AttributeFaaSTime,
		AttributeFaaSCron,
		AttributeFaaSColdstart,
		AttributeFaaSInvokedName,
		AttributeFaaSInvokedProvider,
		AttributeFaaSInvokedRegion,
		AttributeNetTransport,
		AttributeNetAppProtocolName,
		AttributeNetAppProtocolVersion,
		AttributeNetSockPeerName,
		AttributeNetSockPeerAddr,
		AttributeNetSockPeerPort,
		AttributeNetSockFamily,
		AttributeNetPeerName,
		AttributeNetPeerPort,
		AttributeNetHostName,
		AttributeNetHostPort,
		AttributeNetSockHostAddr,
		AttributeNetSockHostPort,
		AttributeNetHostConnectionType,
		AttributeNetHostConnectionSubtype,
		AttributeNetHostCarrierName,
		AttributeNetHostCarrierMcc,
		AttributeNetHostCarrierMnc,
		AttributeNetHostCarrierIcc,
		AttributePeerService,
		AttributeEnduserID,
		AttributeEnduserRole,
		AttributeEnduserScope,
		AttributeThreadID,
		AttributeThreadName,
		AttributeCodeFunction,
		AttributeCodeNamespace,
		AttributeCodeFilepath,
		AttributeCodeLineNumber,
		AttributeHTTPMethod,
		AttributeHTTPStatusCode,
		AttributeHTTPFlavor,
		AttributeHTTPUserAgent,
		AttributeHTTPRequestContentLength,
		AttributeHTTPResponseContentLength,
		AttributeHTTPURL,
		AttributeHTTPResendCount,
		AttributeHTTPScheme,
		AttributeHTTPTarget,
		AttributeHTTPRoute,
		AttributeHTTPClientIP,
		AttributeAWSDynamoDBTableNames,
		AttributeAWSDynamoDBConsumedCapacity,
		AttributeAWSDynamoDBItemCollectionMetrics,
		AttributeAWSDynamoDBProvisionedReadCapacity,
		AttributeAWSDynamoDBProvisionedWriteCapacity,
		AttributeAWSDynamoDBConsistentRead,
		AttributeAWSDynamoDBProjection,
		AttributeAWSDynamoDBLimit,
		AttributeAWSDynamoDBAttributesToGet,
		AttributeAWSDynamoDBIndexName,
		AttributeAWSDynamoDBSelect,
		AttributeAWSDynamoDBGlobalSecondaryIndexes,
		AttributeAWSDynamoDBLocalSecondaryIndexes,
		AttributeAWSDynamoDBExclusiveStartTable,
		AttributeAWSDynamoDBTableCount,
		AttributeAWSDynamoDBScanForward,
		AttributeAWSDynamoDBSegment,
		AttributeAWSDynamoDBTotalSegments,
		AttributeAWSDynamoDBCount,
		AttributeAWSDynamoDBScannedCount,
		AttributeAWSDynamoDBAttributeDefinitions,
		AttributeAWSDynamoDBGlobalSecondaryIndexUpdates,
		AttributeGraphqlOperationName,
		AttributeGraphqlOperationType,
		AttributeGraphqlDocument,
		AttributeMessagingSystem,
		AttributeMessagingDestination,
		AttributeMessagingDestinationKind,
		AttributeMessagingTempDestination,
		AttributeMessagingProtocol,
		AttributeMessagingProtocolVersion,
		AttributeMessagingURL,
		AttributeMessagingMessageID,
		AttributeMessagingConversationID,
		AttributeMessagingMessagePayloadSizeBytes,
		AttributeMessagingMessagePayloadCompressedSizeBytes,
		AttributeMessagingOperation,
		AttributeMessagingConsumerID,
		AttributeMessagingRabbitmqRoutingKey,
		AttributeMessagingKafkaMessageKey,
		AttributeMessagingKafkaConsumerGroup,
		AttributeMessagingKafkaClientID,
		AttributeMessagingKafkaPartition,
		AttributeMessagingKafkaMessageOffset,
		AttributeMessagingKafkaTombstone,
		AttributeMessagingRocketmqNamespace,
		AttributeMessagingRocketmqClientGroup,
		AttributeMessagingRocketmqClientID,
		AttributeMessagingRocketmqDeliveryTimestamp,
		AttributeMessagingRocketmqDelayTimeLevel,
		AttributeMessagingRocketmqMessageGroup,
		AttributeMessagingRocketmqMessageType,
		AttributeMessagingRocketmqMessageTag,
		AttributeMessagingRocketmqMessageKeys,
		AttributeMessagingRocketmqConsumptionModel,
		AttributeRPCSystem,
		AttributeRPCService,
		AttributeRPCMethod,
		AttributeRPCGRPCStatusCode,
		AttributeRPCJsonrpcVersion,
		AttributeRPCJsonrpcRequestID,
		AttributeRPCJsonrpcErrorCode,
		AttributeRPCJsonrpcErrorMessage,
	}
}
