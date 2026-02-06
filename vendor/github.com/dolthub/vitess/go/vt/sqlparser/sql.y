/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

%{
package sqlparser

import "fmt"
import "strings"
//import "runtime/debug"

func setParseTree(yylex interface{}, stmt Statement) {
  yylex.(*Tokenizer).ParseTree = stmt
}

func setAllowComments(yylex interface{}, allow bool) {
  yylex.(*Tokenizer).AllowComments = allow
}

func incNesting(yylex interface{}) bool {
  yylex.(*Tokenizer).nesting++
  if yylex.(*Tokenizer).nesting == 200 {
    return true
  }
  return false
}

func decNesting(yylex interface{}) {
  yylex.(*Tokenizer).nesting--
}

func statementSeen(yylex interface{}) {
  if yylex.(*Tokenizer).stopAfterFirstStmt {
    yylex.(*Tokenizer).stopped = true
  }
}

func yyPosition(yylex interface{}) int {
  return yylex.(*Tokenizer).Position
}

func yyOldPosition(yylex interface{}) int {
  return yylex.(*Tokenizer).OldPosition
}

func yySpecialCommentMode(yylex interface{}) bool {
  tkn := yylex.(*Tokenizer)
  return tkn.specialComment != nil
}

func tryCastExpr(v interface{}) Expr {
	e, _ := v.(Expr)
	return e
}

func tryCastStatement(v interface{}) Statement {
	e, _ := v.(Statement)
	return e
}

%}

%union {
    val interface{}
    bytes []byte
}

// These precedence rules are there to handle shift-reduce conflicts.

// STRING_TYPE_PREFIX_NON_KEYWORD is used to resolve shift-reduce conflicts occuring due to column_name symbol and
// being able to use keywords like DATE and TIME as prefixes to strings to denote their type. The shift-reduce conflict occurrs because
// after seeing one of these non-reserved keywords, if we see a STRING, then we can either shift to use the STRING typed rule in literal or
// reduce the non-reserved keyword into column_name and eventually use a rule from simple_expr.
// The way to fix this conflict is to give shifting higher precedence than reducing.
// Adding no precedence also works, since shifting is the default, but it reports some conflicts
// Precedence is also assined to shifting on STRING.
// We also need to add a lower precedence to reducing the grammar symbol to non-reserved keywords.
// In order to ensure lower precedence of reduction, this rule has to come before the precedence declaration of STRING.
// This precedence should not be used anywhere else other than with non-reserved-keywords that are also used for type-casting a STRING.
%nonassoc <str> STRING_TYPE_PREFIX_NON_KEYWORD

%token LEX_ERROR

// Special tokens
%token <bytes> FOR_SYSTEM_TIME
%token <bytes> FOR_VERSION

%left <bytes> EXCEPT
%left <bytes> UNION
%left <bytes> INTERSECT
%token <bytes> SELECT STREAM INSERT UPDATE DELETE FROM WHERE GROUP HAVING ORDER BY LIMIT OFFSET FOR CALL
%token <bytes> RETURNING
%token <bytes> ALL DISTINCT AS EXISTS ASC DESC DUPLICATE DEFAULT SET LOCK UNLOCK KEYS OF
%token <bytes> OUTFILE DUMPFILE DATA LOAD LINES TERMINATED ESCAPED ENCLOSED OPTIONALLY STARTING
%right <bytes> UNIQUE KEY
%token <bytes> SYSTEM_TIME CONTAINED VERSION VERSIONS
%token <bytes> VALUES LAST_INSERT_ID SQL_CALC_FOUND_ROWS
%token <bytes> NEXT VALUE SHARE MODE
%token <bytes> SQL_NO_CACHE SQL_CACHE
%left <bytes> JOIN STRAIGHT_JOIN LEFT RIGHT INNER OUTER CROSS NATURAL USE FORCE
%left <bytes> ON USING
%token <empty> '(' ',' ')' '@' ':'
%nonassoc <bytes> STRING
%token <bytes> ID HEX INTEGRAL FLOAT HEXNUM VALUE_ARG LIST_ARG COMMENT COMMENT_KEYWORD BIT_LITERAL
%token <bytes> NULL TRUE FALSE OFF
%right <bytes> INTO

// Precedence dictated by mysql. But the vitess grammar is simplified.
// Some of these operators don't conflict in our situation. Nevertheless,
// it's better to have these listed in the correct order. Also, we don't
// support all operators yet.
%left <bytes> OR
%left <bytes> XOR
%left <bytes> AND
%right <bytes> NOT '!'
%left <bytes> BETWEEN CASE WHEN THEN ELSE ELSEIF END
%left <bytes> '=' '<' '>' LE GE NE NULL_SAFE_EQUAL IS LIKE REGEXP IN ASSIGNMENT_OP
%nonassoc  UNBOUNDED // ideally should have same precedence as IDENT
%nonassoc ID NULL PARTITION RANGE ROWS GROUPS PRECEDING FOLLOWING
%left <bytes> '|'
%left <bytes> '&'
%left <bytes> SHIFT_LEFT SHIFT_RIGHT
%left <bytes> '+' '-'
%left <bytes> '*' '/' DIV '%' MOD
%left <bytes> CONCAT
%left <bytes> '^'
%right <bytes> '~' UNARY
%left <bytes> COLLATE
%right <bytes> BINARY UNDERSCORE_ARMSCII8 UNDERSCORE_ASCII UNDERSCORE_BIG5 UNDERSCORE_BINARY UNDERSCORE_CP1250
%right <bytes> UNDERSCORE_CP1251 UNDERSCORE_CP1256 UNDERSCORE_CP1257 UNDERSCORE_CP850 UNDERSCORE_CP852 UNDERSCORE_CP866
%right <bytes> UNDERSCORE_CP932 UNDERSCORE_DEC8 UNDERSCORE_EUCJPMS UNDERSCORE_EUCKR UNDERSCORE_GB18030 UNDERSCORE_GB2312
%right <bytes> UNDERSCORE_GBK UNDERSCORE_GEOSTD8 UNDERSCORE_GREEK UNDERSCORE_HEBREW UNDERSCORE_HP8 UNDERSCORE_KEYBCS2
%right <bytes> UNDERSCORE_KOI8R UNDERSCORE_KOI8U UNDERSCORE_LATIN1 UNDERSCORE_LATIN2 UNDERSCORE_LATIN5 UNDERSCORE_LATIN7
%right <bytes> UNDERSCORE_MACCE UNDERSCORE_MACROMAN UNDERSCORE_SJIS UNDERSCORE_SWE7 UNDERSCORE_TIS620 UNDERSCORE_UCS2
%right <bytes> UNDERSCORE_UJIS UNDERSCORE_UTF16 UNDERSCORE_UTF16LE UNDERSCORE_UTF32 UNDERSCORE_UTF8 UNDERSCORE_UTF8MB3 UNDERSCORE_UTF8MB4
%right <bytes> INTERVAL
%nonassoc <bytes> '.'

// There is no need to define precedence for the JSON
// operators because the syntax is restricted enough that
// they don't cause conflicts.
%token <empty> JSON_EXTRACT_OP JSON_UNQUOTE_EXTRACT_OP

// DDL Tokens
%token <bytes> CREATE ALTER DROP RENAME ANALYZE ADD MODIFY CHANGE
%token <bytes> SCHEMA TABLE INDEX INDEXES VIEW TO IGNORE IF PRIMARY COLUMN SPATIAL VECTOR FULLTEXT KEY_BLOCK_SIZE CHECK
%token <bytes> ACTION CASCADE CONSTRAINT FOREIGN NO REFERENCES RESTRICT
%token <bytes> FIRST AFTER LAST
%token <bytes> SHOW DESCRIBE EXPLAIN DATE ESCAPE REPAIR OPTIMIZE TRUNCATE FORMAT EXTENDED PLAN
%token <bytes> MAXVALUE PARTITION REORGANIZE LESS THAN PROCEDURE TRIGGER TRIGGERS FUNCTION
%token <bytes> STATUS VARIABLES WARNINGS ERRORS KILL CONNECTION
%token <bytes> SEQUENCE ENABLE DISABLE
%token <bytes> EACH ROW BEFORE FOLLOWS PRECEDES DEFINER INVOKER
%token <bytes> INOUT OUT DETERMINISTIC CONTAINS READS MODIFIES SQL SECURITY TEMPORARY ALGORITHM MERGE TEMPTABLE UNDEFINED
%token <bytes> EVENT EVENTS SCHEDULE EVERY STARTS ENDS COMPLETION PRESERVE CASCADED
%token <bytes> INSTANT INPLACE COPY
%token <bytes> DISCARD IMPORT
%token <bytes> SHARED EXCLUSIVE
%token <bytes> WITHOUT VALIDATION
%token <bytes> COALESCE EXCHANGE REBUILD REMOVE PARTITIONING

// SIGNAL Tokens
%token <bytes> CLASS_ORIGIN SUBCLASS_ORIGIN MESSAGE_TEXT MYSQL_ERRNO CONSTRAINT_CATALOG CONSTRAINT_SCHEMA
%token <bytes> CONSTRAINT_NAME CATALOG_NAME SCHEMA_NAME TABLE_NAME COLUMN_NAME CURSOR_NAME SIGNAL RESIGNAL SQLSTATE

// Stored Procedure Tokens
%token <bytes> DECLARE CONDITION CURSOR CONTINUE EXIT UNDO HANDLER FOUND SQLWARNING SQLEXCEPTION FETCH OPEN CLOSE
%token <bytes> LOOP LEAVE ITERATE REPEAT UNTIL WHILE DO RETURN

// Permissions Tokens
%token <bytes> USER IDENTIFIED ROLE REUSE GRANT GRANTS REVOKE NONE ATTRIBUTE RANDOM PASSWORD INITIAL AUTHENTICATION
%token <bytes> SSL X509 CIPHER ISSUER SUBJECT ACCOUNT EXPIRE NEVER OPTION OPTIONAL ADMIN PRIVILEGES
%token <bytes> MAX_QUERIES_PER_HOUR MAX_UPDATES_PER_HOUR MAX_CONNECTIONS_PER_HOUR MAX_USER_CONNECTIONS FLUSH
%token <bytes> FAILED_LOGIN_ATTEMPTS PASSWORD_LOCK_TIME UNBOUNDED REQUIRE PROXY ROUTINE TABLESPACE CLIENT SLAVE
%token <bytes> EXECUTE FILE RELOAD REPLICATION SHUTDOWN SUPER USAGE LOGS ENGINE ERROR GENERAL HOSTS
%token <bytes> OPTIMIZER_COSTS RELAY SLOW USER_RESOURCES NO_WRITE_TO_BINLOG CHANNEL UNKNOWN

// Dynamic Privilege Tokens
%token <bytes> APPLICATION_PASSWORD_ADMIN AUDIT_ABORT_EXEMPT AUDIT_ADMIN AUTHENTICATION_POLICY_ADMIN BACKUP_ADMIN
%token <bytes> BINLOG_ADMIN BINLOG_ENCRYPTION_ADMIN CLONE_ADMIN CONNECTION_ADMIN ENCRYPTION_KEY_ADMIN FIREWALL_ADMIN
%token <bytes> FIREWALL_EXEMPT FIREWALL_USER FLUSH_OPTIMIZER_COSTS FLUSH_STATUS FLUSH_TABLES FLUSH_USER_RESOURCES
%token <bytes> GROUP_REPLICATION_ADMIN GROUP_REPLICATION_STREAM INNODB_REDO_LOG_ARCHIVE INNODB_REDO_LOG_ENABLE
%token <bytes> NDB_STORED_USER PASSWORDLESS_USER_ADMIN PERSIST_RO_VARIABLES_ADMIN REPLICATION_APPLIER
%token <bytes> REPLICATION_SLAVE_ADMIN RESOURCE_GROUP_ADMIN RESOURCE_GROUP_USER ROLE_ADMIN SENSITIVE_VARIABLES_OBSERVER
%token <bytes> SESSION_VARIABLES_ADMIN SET_USER_ID SHOW_ROUTINE SKIP_QUERY_REWRITE SYSTEM_VARIABLES_ADMIN
%token <bytes> TABLE_ENCRYPTION_ADMIN TP_CONNECTION_ADMIN VERSION_TOKEN_ADMIN XA_RECOVER_ADMIN

// Replication Tokens
%token <bytes> REPLICA REPLICAS SOURCE STOP RESET FILTER LOG MASTER
%token <bytes> SOURCE_HOST SOURCE_SSL SOURCE_USER SOURCE_PASSWORD SOURCE_PORT SOURCE_CONNECT_RETRY SOURCE_RETRY_COUNT SOURCE_AUTO_POSITION
%token <bytes> REPLICATE_DO_TABLE REPLICATE_IGNORE_TABLE
%token <bytes> IO_THREAD SQL_THREAD

// Transaction Tokens
%token <bytes> BEGIN START TRANSACTION COMMIT ROLLBACK SAVEPOINT WORK RELEASE CHAIN CONSISTENT SNAPSHOT

// Type Tokens
%token <bytes> BIT TINYINT SMALLINT MEDIUMINT INT INTEGER BIGINT INTNUM SERIAL INT1 INT2 INT3 INT4 INT8
%token <bytes> REAL DOUBLE FLOAT_TYPE DECIMAL NUMERIC DEC FIXED PRECISION
%token <bytes> TIME TIMESTAMP DATETIME
%token <bytes> CHAR VARCHAR BOOL CHARACTER VARBINARY NCHAR NVARCHAR NATIONAL VARYING VARCHARACTER
%token <bytes> TEXT TINYTEXT MEDIUMTEXT LONGTEXT LONG
%token <bytes> BLOB TINYBLOB MEDIUMBLOB LONGBLOB JSON ENUM
%token <bytes> GEOMETRY POINT LINESTRING POLYGON GEOMETRYCOLLECTION MULTIPOINT MULTILINESTRING MULTIPOLYGON

// Lock tokens
%token <bytes> LOCAL LOW_PRIORITY SKIP LOCKED

// Type Modifiers
%token <bytes> NULLX AUTO_INCREMENT APPROXNUM SIGNED UNSIGNED ZEROFILL SRID

// Supported SHOW tokens
%token <bytes> COLLATION DATABASES SCHEMAS TABLES FULL PROCESSLIST COLUMNS FIELDS ENGINES PLUGINS

// SET tokens
%token <bytes> NAMES CHARSET GLOBAL SESSION ISOLATION LEVEL READ WRITE ONLY REPEATABLE COMMITTED UNCOMMITTED SERIALIZABLE
%token <bytes> ENCRYPTION

// Functions
%token <bytes> CURRENT_TIMESTAMP NOW DATABASE CURRENT_DATE CURRENT_USER
%token <bytes> CURRENT_TIME LOCALTIME LOCALTIMESTAMP
%token <bytes> UTC_DATE UTC_TIME UTC_TIMESTAMP
%token <bytes> REPLACE
%token <bytes> CONVERT CAST POSITION
%token <bytes> SUBSTR SUBSTRING
%token <bytes> TRIM LEADING TRAILING BOTH
%token <bytes> GROUP_CONCAT SEPARATOR
%token <bytes> TIMESTAMPADD TIMESTAMPDIFF EXTRACT
%token <bytes> GET_FORMAT

// Window functions
%token <bytes> OVER WINDOW GROUPING GROUPS
%token <bytes> CURRENT ROWS RANGE
%token <bytes> AVG BIT_AND BIT_OR BIT_XOR COUNT JSON_ARRAYAGG JSON_OBJECTAGG MAX MIN STDDEV_POP STDDEV STD STDDEV_SAMP
%token <bytes> SUM VAR_POP VARIANCE VAR_SAMP CUME_DIST DENSE_RANK FIRST_VALUE LAG LAST_VALUE LEAD NTH_VALUE NTILE
%token <bytes> ROW_NUMBER PERCENT_RANK RANK

// Table functions
%token <bytes> DUAL JSON_TABLE PATH

// Table options
%token <bytes> AVG_ROW_LENGTH
%token <bytes> CHECKSUM COMPACT COMPRESSED COMPRESSION
%token <bytes> DISK DIRECTORY DELAY_KEY_WRITE DYNAMIC
%token <bytes> ENGINE_ATTRIBUTE ENCRYPTED ENCRYPTION_KEY_ID
%token <bytes> HASH
%token <bytes> INSERT_METHOD ITEF_QUOTES
%token <bytes> LIST
%token <bytes> MIN_ROWS MAX_ROWS
%token <bytes> PACK_KEYS
%token <bytes> MEMORY
%token <bytes> PAGE_CHECKSUM PAGE_COMPRESSED PAGE_COMPRESSION_LEVEL PARTITIONS
%token <bytes> REDUNDANT
%token <bytes> ROW_FORMAT
%token <bytes> SECONDARY_ENGINE SECONDARY_ENGINE_ATTRIBUTE STATS_AUTO_RECALC STATS_PERSISTENT STATS_SAMPLE_PAGES STORAGE
%token <bytes> SUBPARTITION SUBPARTITIONS
%token <bytes> TABLE_CHECKSUM TRANSACTIONAL
%token <bytes> VERSIONING
%token <bytes> YES

// Prepared statements
%token <bytes> PREPARE DEALLOCATE

// Match
%token <bytes> MATCH AGAINST BOOLEAN LANGUAGE WITH QUERY EXPANSION

// Time Unit Tokens
%token <bytes> MICROSECOND SECOND MINUTE HOUR DAY WEEK MONTH QUARTER YEAR
%token <bytes> SECOND_MICROSECOND
%token <bytes> MINUTE_MICROSECOND MINUTE_SECOND
%token <bytes> HOUR_MICROSECOND HOUR_SECOND HOUR_MINUTE
%token <bytes> DAY_MICROSECOND DAY_SECOND DAY_MINUTE DAY_HOUR
%token <bytes> YEAR_MONTH

// Spatial Reference System Tokens
%token <bytes> NAME SYSTEM

// MySQL reserved words that are currently unused.
%token <bytes> ACCESSIBLE ASENSITIVE
%token <bytes> CUBE
%token <bytes> DELAYED DISTINCTROW
%token <bytes> EMPTY
%token <bytes> FLOAT4 FLOAT8
%token <bytes> GET
%token <bytes> HIGH_PRIORITY
%token <bytes> INSENSITIVE IO_AFTER_GTIDS IO_BEFORE_GTIDS LINEAR
%token <bytes> MASTER_BIND MASTER_SSL_VERIFY_SERVER_CERT MIDDLEINT
%token <bytes> PURGE
%token <bytes> READ_WRITE RLIKE
%token <bytes> SENSITIVE SPECIFIC SQL_BIG_RESULT SQL_SMALL_RESULT

%token <bytes> UNUSED DESCRIPTION LATERAL MEMBER RECURSIVE
%token <bytes> BUCKETS CLONE COMPONENT DEFINITION ENFORCED NOT_ENFORCED EXCLUDE FOLLOWING GEOMCOLLECTION GET_MASTER_PUBLIC_KEY HISTOGRAM HISTORY
%token <bytes> INACTIVE INVISIBLE MASTER_COMPRESSION_ALGORITHMS MASTER_PUBLIC_KEY_PATH MASTER_TLS_CIPHERSUITES MASTER_ZSTD_COMPRESSION_LEVEL
%token <bytes> NESTED NETWORK_NAMESPACE NOWAIT NULLS OJ OLD ORDINALITY ORGANIZATION OTHERS PERSIST PERSIST_ONLY PRECEDING PRIVILEGE_CHECKS_USER PROCESS
%token <bytes> REFERENCE REQUIRE_ROW_FORMAT RESOURCE RESPECT RESTART RETAIN SECONDARY SECONDARY_LOAD SECONDARY_UNLOAD
%token <bytes> THREAD_PRIORITY TIES VCPU VISIBLE INFILE

// MySQL unreserved keywords that are currently unused
%token <bytes> ACTIVE AGGREGATE ANY ARRAY ASCII AT AUTOEXTEND_SIZE

// Generated Columns
%token <bytes> GENERATED ALWAYS STORED VIRTUAL

// TODO: categorize/organize these somehow later
%token <bytes> NVAR PASSWORD_LOCK

%type <val> command
%type <val> create_query_expression create_query_select_expression select_statement with_select select_or_set_op base_select base_select_no_cte select_statement_with_no_trailing_into values_select_statement
%type <val> set_op intersect_stmt union_except_lhs union_except_rhs
%type <val> stream_statement insert_statement update_statement delete_statement set_statement trigger_body
%type <val> create_statement rename_statement drop_statement truncate_statement call_statement
%type <val> trigger_begin_end_block statement_list_statement case_statement if_statement signal_statement
%type <val> begin_end_block declare_statement resignal_statement open_statement close_statement fetch_statement
%type <val> loop_statement leave_statement iterate_statement repeat_statement while_statement return_statement
%type <val> savepoint_statement rollback_savepoint_statement release_savepoint_statement purge_binary_logs_statement
%type <val> lock_statement unlock_statement kill_statement grant_statement revoke_statement flush_statement replication_statement
%type <val> ignore_unknown_user_opt
%type <bytes> thread_type_opt
%type <val> statement_list
%type <val> case_statement_case_list
%type <val> case_statement_case
%type <val> elseif_list
%type <val> elseif_list_item
%type <val> fetch_variable_list
%type <val> signal_information_item
%type <val> signal_information_item_list
%type <val> signal_information_name
%type <val> declare_handler_condition
%type <val> declare_handler_condition_list
%type <val> declare_handler_action
%type <bytes> signal_condition_value
%type <bytes> char_or_character
%type <val> trigger_time trigger_event
%type <val> with_or_without
%type <val> alter_statement alter_table_statement alter_database_statement alter_event_statement alter_user_statement
%type <val> create_table_prefix rename_list alter_table_statement_part alter_table_options
%type <val> alter_table_statement_list
%type <val> analyze_statement analyze_opt show_statement use_statement prepare_statement execute_statement deallocate_statement
%type <val> describe_statement explain_statement explainable_statement
%type <val> begin_statement commit_statement rollback_statement start_transaction_statement load_statement
%type <bytes> work_opt no_opt chain_opt release_opt index_name_opt no_first_last yes_no
%type <val> comment_opt comment_list
%type <val> distinct_opt union_op intersect_op except_op insert_or_replace
%type <val> match_option format_opt plan_opt
%type <val> separator_opt
%type <val> like_escape_opt
%type <val> select_expression_list argument_expression_list argument_expression_list_opt
%type <val> select_expression argument_expression
%type <val> expression naked_like group_by
%type <val> table_references cte_list from_opt
%type <val> with_clause with_clause_opt
%type <val> table_reference table_function table_factor join_table common_table_expression
%type <val> values_statement subquery_or_values
%type <val> subquery
%type <val> join_condition join_condition_opt on_expression_opt
%type <val> table_name_list delete_table_list view_name_list
%type <val> inner_join outer_join straight_join natural_join
%type <val> trigger_name
%type <val> table_name load_into_table_name into_table_name delete_table_name
%type <val> aliased_table_name aliased_table_options
%type <val> as_of_clause as_of_point_clause between_times between_versions all_times all_versions
%type <val> procedure_name
%type <val> event_name rename_event_name_opt
%type <val> index_hint_list
%type <val> where_expression_opt
%type <val> condition
%type <val> boolean_value
%type <val> all_opt enforced_opt
%type <val> compare
%type <val> insert_data insert_data_alias insert_data_select insert_data_values
%type <val> value value_expression num_val as_of_opt limit_val integral_or_interval_expr timestamp_value
%type <bytes> time_unit non_microsecond_time_unit date_datetime_time_timestamp
%type <val> function_call_keyword function_call_nonkeyword function_call_generic function_call_conflict
%type <val> func_datetime_prec_opt function_call_window function_call_aggregate_with_window function_call_on_update
%type <val> is_suffix
%type <val> col_tuple
%type <val> expression_list group_by_list partition_by_opt
%type <val> tuple_list row_list

%type <val> row_tuple tuple_or_empty
%type <val> tuple_expression
%type <val> column_name
%type <val> when_expression_list
%type <val> when_expression
%type <val> expression_opt else_expression_opt
%type <val> group_by_opt
%type <val> having_opt having
%type <val> order_by_opt order_list
%type <val> column_order_opt
%type <val> trigger_order_opt
%type <val> order
%type <val> over over_opt
%type <val> window window_opt
%type <val> window_definition window_spec
%type <val> frame_opt
%type <val> frame_extent
%type <val> frame_bound
%type <val> lexer_position lexer_old_position
%type <val> special_comment_mode
%type <val> asc_desc_opt
%type <val> limit_opt
%type <val> lock_opt
%type <val> ins_column
%type <val> ins_column_list ins_column_list_opt column_list paren_column_list column_list_opt
%type <val> opt_partition_clause partition_list
%type <val> returning_clause_opt
%type <val> variable_list
%type <val> system_variable_list
%type <val> system_variable
%type <val> into_opt
%type <val> on_dup_opt assignment_list set_opt
%type <val> set_list transaction_chars
%type <bytes> charset_or_character_set
%type <val> assignment_expression
%type <val> set_expression set_expression_assignment transaction_char
%type <val> set_scope_primary set_scope_secondary
%type <val> isolation_level
%type <bytes> for_from
%type <val> ignore_opt default_opt
%type <val> from_database_opt columns_or_fields
%type <val> full_opt
%type <val> like_or_where_opt
%type <val> exists_opt not_exists_opt temp_opt
%type <val> query_opts
%type <val> key_type key_type_opt
%type <val> flush_type flush_type_opt
%type <val> to_or_as_opt to_or_as /*to_opt*/ as_opt column_opt
%type <val> algorithm_view_opt algorithm_part_opt definer_opt security_opt
%type <val> view_opts
%type <val> opt_with_check_option
%type <bytes> reserved_keyword qualified_column_name_safe_reserved_keyword non_reserved_keyword column_name_safe_keyword function_call_keywords non_reserved_keyword2 non_reserved_keyword3 all_non_reserved id_or_non_reserved
%type <val> sql_id reserved_sql_id col_alias as_ci_opt using_opt existing_window_name_opt
%type <val> reserved_sql_id_list
%type <val> charset_value
%type <val> table_id reserved_table_id table_alias
%type <val> charset underscore_charsets
%type <val> show_session_or_global
%type <val> convert_type
%type <val> column_type  column_type_options
%type <val> int_type decimal_type numeric_type time_type char_type spatial_type
%type <val> char_length_opt length_opt column_comment ignore_number_opt comment_keyword_opt
%type <val> column_default on_update
%type <val> charset_opt character_set collate_opt collate table_option_collate
%type <val> default_keyword_opt
%type <val> charset_default_opt collate_default_opt encryption_default_opt
%type <val> creation_option creation_option_opt
%type <val> stored_opt
%type <val> signed_or_unsigned_opt zero_fill_opt
%type <val> float_length_opt decimal_length_opt
%type <val> auto_increment local_opt optionally_opt
%type <val> column_key
%type <val> enum_values
%type <val> column_definition column_definition_for_create
%type <val> index_definition
%type <val> foreign_key_definition check_constraint_definition
%type <val> index_or_key indexes_or_keys index_or_key_opt
%type <val> from_or_in show_database_opt
%type <val> name_opt
%type <val> equal_opt assignment_op
%type <val> table_spec table_column_list
%type <val> table_opt_value row_fmt_opt
%type <val> partition_option_opt partition_option partition_option_part linear_partition_opt
%type <val> subpartition_opt
%type <val> linear_opt
%type <val> range_or_list
%type <val> partition_num_opt subpartition_num_opt
%type <val> index_info
%type <val> index_column
%type <val> index_column_list
%type <val> index_option
%type <val> index_option_list index_option_list_opt
%type <val> table_option
%type <val> table_option_list
%type <val> flush_option
%type <val> flush_tables_read_lock_opt
%type <val> replication_option_list replication_filter_option_list
%type <val> replication_option replication_filter_option
%type <val> relay_logs_attribute
%type <val> foreign_key_details check_constraint_info
%type <val> partition_definitions partition_definitions_opt
%type <val> partition_definition
%type <val> partition_operation
%type <val> partition_operation_list_opt partition_operation_list
%type <val> fk_reference_action fk_on_delete fk_on_update drop_statement_action
%type <val> pk_name_opt constraint_symbol_opt infile_opt ignore_or_replace_opt
%type <val> call_param_list_opt
%type <val> proc_param_list_opt proc_param_list
%type <val> proc_param
%type <val> characteristic_list_opt characteristic_list
%type <val> characteristic
%type <val> fields_opt
%type <val> lines_opt lines_option_list
%type <val> enclosed_by_opt
%type <val> terminated_by_opt escaped_by_opt
%type <val> lock_table_list
%type <val> lock_table
%type <val> lock_type
%type <val> account_name role_name
%type <val> account_name_list role_name_list default_role_opt
%type <val> rename_user_list
%type <val> account_name_str user_comment_attribute
%type <val> account_with_auth
%type <val> account_with_auth_list
%type <val> authentication authentication_opt authentication_initial
%type <val> event_schedule
%type <val> event_starts_opt event_ends_opt
%type <val> event_status_opt
%type <val> event_on_completion_preserve_opt
%type <val> event_schedule_intervals_opt
%type <val> tls_option_item
%type <val> tls_options tls_option_item_list
%type <val> account_limit_item
%type <val> account_limits account_limit_item_list
%type <val> pass_lock_item
%type <val> pass_lock_options pass_lock_item_list
%type <val> grant_privilege
%type <val> grant_privilege_list
%type <bytes> dynamic_privilege
%type <val> grant_privilege_columns_opt grant_privilege_column_list
%type <val> grant_object_type
%type <val> grant_privilege_level
%type <val> grant_assumption
%type <val> with_grant_opt with_admin_opt
%type <bytes> any_identifier
%type <val> any_identifier_list
%type <val> create_spatial_ref_sys
%type <val> srs_attribute

%type <val> json_table
%type <val> json_table_column_list
%type <val> json_table_column_definition
%type <val> json_table_column_options
%type <val> val_on_empty val_on_error

%type <bytes> coericble_to_integral

%start any_command

%%

any_command:
  command
  {
    setParseTree(yylex, tryCastStatement($1))
  }
| command ';'
  {
    setParseTree(yylex, tryCastStatement($1))
    statementSeen(yylex)
  }

command:
  select_statement
  {
    $$ = $1.(SelectStatement)
  }
| values_select_statement
  {
    $$ = $1.(SelectStatement)
  }
| stream_statement
| insert_statement
| update_statement
| delete_statement
| set_statement
| create_statement
| alter_statement
| rename_statement
| drop_statement
| truncate_statement
| analyze_statement
| prepare_statement
| execute_statement
| deallocate_statement
| show_statement
| use_statement
| begin_statement
| commit_statement
| rollback_statement
| explain_statement
| describe_statement
| signal_statement
| resignal_statement
| call_statement
| load_statement
| savepoint_statement
| rollback_savepoint_statement
| release_savepoint_statement
| lock_statement
| unlock_statement
| kill_statement
| grant_statement
| revoke_statement
| replication_statement
| flush_statement
| purge_binary_logs_statement
| /*empty*/
{
  setParseTree(yylex, nil)
}

set_opt:
  {
    $$ = AssignmentExprs(nil)
  }
| SET assignment_list
  {
    $$ = $2.(AssignmentExprs)
  }

load_statement:
  LOAD DATA local_opt infile_opt ignore_or_replace_opt load_into_table_name opt_partition_clause charset_opt fields_opt lines_opt ignore_number_opt column_list_opt set_opt
  {
    $$ = &Load{
      Local: $3.(BoolVal),
      Infile: $4.(string),
      IgnoreOrReplace: $5.(string),
      Table: $6.(TableName),
      Partition: $7.(Partitions),
      Charset: $8.(string),
      Fields: $9.(*Fields),
      Lines: $10.(*Lines),
      IgnoreNum: $11.(*SQLVal),
      Columns: $12.(Columns),
      SetExprs: $13.(AssignmentExprs),
      Auth: AuthInformation{
        AuthType: AuthType_FILE,
        TargetType: AuthTargetType_Global,
      },
    }
  }

select_statement:
  with_select order_by_opt limit_opt lock_opt into_opt
  {
    s := $1.(SelectStatement)
    s.SetOrderBy($2.(OrderBy))
    s.SetLimit($3.(*Limit))
    s.SetLock($4)
    if err := s.SetInto($5.(*Into)); err != nil {
    	yylex.Error(err.Error())
    	return 1
    }
    $$ = s
  }
| SELECT comment_opt query_opts NEXT num_val for_from table_name
  {
    tableName := $7.(TableName)
    $$ = &Select{
    	Comments: Comments($2.(Comments)),
    	QueryOpts: $3.(QueryOpts),
    	SelectExprs: SelectExprs{Nextval{Expr: tryCastExpr($5)}},
    	From: TableExprs{&AliasedTableExpr{
    	  Expr: tableName,
    	  Auth: AuthInformation{
            AuthType: AuthType_SELECT,
            TargetType: AuthTargetType_SingleTableIdentifier,
            TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
          },
        }},
    }
  }

values_select_statement:
  values_statement order_by_opt limit_opt
  {
    $$ = &Select{
    	SelectExprs: SelectExprs{&StarExpr{}},
    	From: TableExprs{&AliasedTableExpr{
    	  Expr: $1.(SimpleTableExpr),
    	  Auth: AuthInformation{AuthType: AuthType_IGNORE},
    	}},
    	OrderBy: $2.(OrderBy),
    	Limit: $3.(*Limit),
    }
  }
| openb values_select_statement closeb
  {
    $$ = $2.(SelectStatement)
  }

select_statement_with_no_trailing_into:
  select_statement
  {
    if $1.(SelectStatement).GetInto() != nil {
      yylex.Error(fmt.Errorf("INTO clause is not allowed").Error())
      return 1
    }
    $$ = $1.(SelectStatement)
  }

stream_statement:
  STREAM comment_opt select_expression FROM table_name
  {
    $$ = &Stream{Comments: Comments($2.(Comments)), SelectExpr: $3.(SelectExpr), Table: $5.(TableName)}
  }

// select_or_set_op is an unparenthesized SELECT without an order by clause or UNION/INTERSECT/EXCEPT operation
// TODO: select_or_set_op should also include openb select_statement_with_no_trailing_into closeb; so it should just use base_select
select_or_set_op:
  base_select_no_cte
  {
    $$ = $1.(SelectStatement)
  }
| set_op
  {
    $$ = $1.(SelectStatement)
  }

// set_op is a UNION/INTERSECT/EXCEPT operation
set_op:
  intersect_stmt
  {
    $$ = $1.(SelectStatement)
  }
| union_except_lhs union_op union_except_rhs
  {
    $$ = &SetOp{Type: $2.(string), Left: $1.(SelectStatement), Right: $3.(SelectStatement)}
  }
| union_except_lhs except_op union_except_rhs
  {
    $$ = &SetOp{Type: $2.(string), Left: $1.(SelectStatement), Right: $3.(SelectStatement)}
  }

// intersect_stmt is an INTERSECT operation
// in order to enforce its higher precedence over UNION/EXCEPT, it is defined as a terminal rule
// this way, base_select and other intersect_stmt are greedily paired up
intersect_stmt:
  base_select intersect_op base_select
  {
    $$ = &SetOp{Type: $2.(string), Left: $1.(SelectStatement), Right: $3.(SelectStatement)}
  }
| intersect_stmt intersect_op base_select
  {
    $$ = &SetOp{Type: $2.(string), Left: $1.(SelectStatement), Right: $3.(SelectStatement)}
  }

// base_select is either a simple SELECT or a SELECT wrapped in parentheses
base_select:
  base_select_no_cte
  {
    if $1.(SelectStatement).GetInto() != nil {
      yylex.Error(fmt.Errorf("INTO clause is not allowed").Error())
      return 1
    }
    $$ = $1.(SelectStatement)
  }
| openb select_statement_with_no_trailing_into closeb
  {
    $$ = &ParenSelect{Select: $2.(SelectStatement)}
  }

// union_except_lhs is either a simple select or a set_op
// this allows further nesting of UNION/INTERSECT/EXCEPT
union_except_lhs:
  base_select
  {
    $$ = $1.(SelectStatement)
  }
| set_op
  {
    $$ = $1.(SelectStatement)
  }

// union_except_rhs is either a simple SELECT or an intersect_stmt
// this is a terminal rule, to prevent further nesting of set_op
union_except_rhs:
  base_select
  {
    $$ = $1.(SelectStatement)
  }
| intersect_stmt
  {
    $$ = $1.(SelectStatement)
  }

with_select:
  select_or_set_op
  {
    $$ = $1.(SelectStatement)
  }
| WITH with_clause select_or_set_op
  {
    with := $2.(*With)
    selectStatement := $3.(SelectStatement)
    handleCTEAuth(selectStatement, with)
    selectStatement.SetWith(with)
    $$ = selectStatement
  }

with_clause:
  RECURSIVE cte_list
  {
    $$ = &With{Ctes: $2.([]*CommonTableExpr), Recursive: true}
  }
| cte_list {
    $$ = &With{Ctes: $1.([]*CommonTableExpr), Recursive: false}
}

base_select_no_cte:
  SELECT comment_opt query_opts select_expression_list into_opt from_opt where_expression_opt group_by_opt having_opt window_opt
  {
    $$ = &Select{
    	Comments: Comments($2.(Comments)),
    	QueryOpts: $3.(QueryOpts),
	SelectExprs: $4.(SelectExprs),
	Into: $5.(*Into),
	From: SetAuthType($6.(TableExprs), AuthType_SELECT, true).(TableExprs),
	Where: NewWhere(WhereStr, tryCastExpr($7)),
	GroupBy: GroupBy($8.(Exprs)),
	Having: NewWhere(HavingStr, tryCastExpr($9)),
	Window: $10.(Window),
    }
  }
| TABLE table_reference
  {
    $$ = &Select{
	SelectExprs: SelectExprs{&StarExpr{}},
	From: TableExprs{SetAuthType($2.(TableExpr), AuthType_SELECT, true).(TableExpr)},
    }
  }

from_opt:
  {
    $$ = TableExprs(nil)
  }
| FROM DUAL
  {
    $$ = TableExprs(nil)
  }
| FROM table_references
  {
    $$ = $2.(TableExprs)
  }

// They may appear either before from-clause or at the end of a query. This causes shift/reduce conflict when INTO
// token is used and has two cases it can be interpreted as depending on whether the query is table-less or other
// clauses (WHERE, GROUP BY, HAVING, WINDOW) are present.
into_opt:
%prec INTO
  {
    $$ = (*Into)(nil)
  }
| INTO variable_list
  {
    $$ = &Into{Variables: $2.(Variables)}
  }
| INTO DUMPFILE STRING
  {
    $$ = &Into{Dumpfile: string($3)}
  }
| INTO OUTFILE STRING charset_opt fields_opt lines_opt
  {
    $$ = &Into{Outfile: string($3), Charset: $4.(string), Fields: $5.(*Fields), Lines: $6.(*Lines)}
  }

variable_list:
  sql_id
  {
    $$ = Variables{$1.(ColIdent)}
  }
| variable_list ',' sql_id
  {
    $$ = append($$.(Variables), $3.(ColIdent))
  }

with_clause_opt:
  {
    $$ = (*With)(nil)
  }
| WITH with_clause
  {
    $$ = $2.(*With)
  }

cte_list:
  common_table_expression
  {
    $$ = []*CommonTableExpr{$1.(*CommonTableExpr)}
  }
| cte_list ',' common_table_expression
  {
    $$ = append($1.([]*CommonTableExpr), $3.(*CommonTableExpr))
  }

common_table_expression:
  table_alias ins_column_list_opt AS subquery_or_values
  {
    $$ = &CommonTableExpr{
      &AliasedTableExpr{
        Expr: $4.(SimpleTableExpr),
        As: $1.(TableIdent),
        Auth: AuthInformation{AuthType: AuthType_IGNORE},
      },
    $2.(Columns)}
  }

insert_statement:
  with_clause_opt insert_or_replace comment_opt ignore_opt into_table_name opt_partition_clause insert_data_alias on_dup_opt returning_clause_opt
  {
    // insert_data returns a *Insert pre-filled with Columns & Values
    ins := $7.(*Insert)
    ins.Action = $2.(string)
    ins.Comments = $3.(Comments)
    ins.Ignore = $4.(string)
    tableName := $5.(TableName)
    ins.Table = tableName
    authType := AuthType_INSERT
    if ins.Action == ReplaceStr {
      authType = AuthType_REPLACE
    }
    ins.Auth = AuthInformation{
      AuthType: authType,
      TargetType: AuthTargetType_SingleTableIdentifier,
      TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
    }
    ins.Partitions = $6.(Partitions)
    ins.OnDup = OnDup($8.(AssignmentExprs))
    ins.Returning = $9.(SelectExprs)
    with := $1.(*With)
    handleCTEAuth(ins, with)
    ins.With = with
    $$ = ins
  }
| with_clause_opt insert_or_replace comment_opt ignore_opt into_table_name opt_partition_clause insert_data_select on_dup_opt returning_clause_opt
  {
    // insert_data returns a *Insert pre-filled with Columns & Values
    ins := $7.(*Insert)
    ins.Action = $2.(string)
    ins.Comments = $3.(Comments)
    ins.Ignore = $4.(string)
    tableName := $5.(TableName)
    ins.Table = tableName
    authType := AuthType_INSERT
    if ins.Action == ReplaceStr {
      authType = AuthType_REPLACE
    }
    ins.Auth = AuthInformation{
      AuthType: authType,
      TargetType: AuthTargetType_SingleTableIdentifier,
      TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
    }
    ins.Partitions = $6.(Partitions)
    ins.OnDup = OnDup($8.(AssignmentExprs))
    ins.Returning = $9.(SelectExprs)
    with := $1.(*With)
    handleCTEAuth(ins, with)
    ins.With = with
    $$ = ins
  }
| with_clause_opt insert_or_replace comment_opt ignore_opt into_table_name opt_partition_clause SET assignment_list on_dup_opt returning_clause_opt
  {
    cols := make(Columns, 0, len($8.(AssignmentExprs)))
    vals := make(ValTuple, 0, len($9.(AssignmentExprs)))
    for _, updateList := range $8.(AssignmentExprs) {
      cols = append(cols, updateList.Name.Name)
      vals = append(vals, updateList.Expr)
    }
    tableName := $5.(TableName)
    authType := AuthType_INSERT
    if $2.(string) == ReplaceStr {
      authType = AuthType_REPLACE
    }
    ins := &Insert{
	Action: $2.(string),
	Comments: Comments($3.(Comments)),
	Ignore: $4.(string),
	Table: tableName,
	Partitions: $6.(Partitions),
	Columns: cols,
	Rows: &AliasedValues{Values: Values{vals}},
	OnDup: OnDup($9.(AssignmentExprs)),
	Returning: $10.(SelectExprs),
	Auth: AuthInformation{
	  AuthType: authType,
	  TargetType: AuthTargetType_SingleTableIdentifier,
	  TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
	},
    }
    with := $1.(*With)
    handleCTEAuth(ins, with)
    ins.With = with
    $$ = ins
  }

insert_or_replace:
  INSERT
  {
    $$ = InsertStr
  }
| REPLACE
  {
    $$ = ReplaceStr
  }

update_statement:
  with_clause_opt UPDATE comment_opt ignore_opt table_references SET assignment_list where_expression_opt order_by_opt limit_opt
  {
    update := &Update{
	Comments: Comments($3.(Comments)),
	Ignore: $4.(string),
	TableExprs: SetAuthType($5.(TableExprs), AuthType_UPDATE, true).(TableExprs),
	Exprs: $7.(AssignmentExprs),
	Where: NewWhere(WhereStr, tryCastExpr($8)),
	OrderBy: $9.(OrderBy),
	Limit: $10.(*Limit),
    }
    with := $1.(*With)
    handleCTEAuth(update, with)
    update.With = with
    $$ = update
  }

delete_statement:
  with_clause_opt DELETE comment_opt FROM table_name opt_partition_clause where_expression_opt order_by_opt limit_opt
  {
    tableName := $5.(TableName)
    delete := &Delete{
	Comments: Comments($3.(Comments)),
	TableExprs: TableExprs{&AliasedTableExpr{
	  Expr: tableName,
	  Auth: AuthInformation{
            AuthType: AuthType_DELETE,
            TargetType: AuthTargetType_SingleTableIdentifier,
            TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
          },
	}},
	Partitions: $6.(Partitions),
	Where: NewWhere(WhereStr, tryCastExpr($7)),
	OrderBy: $8.(OrderBy),
	Limit: $9.(*Limit),
    }
    with := $1.(*With)
    handleCTEAuth(delete, with)
    delete.With = with
    $$ = delete
  }
| with_clause_opt DELETE comment_opt FROM table_name_list USING table_references where_expression_opt
  {
    delete := &Delete{
	Comments: Comments($3.(Comments)),
	Targets: $5.(TableNames),
	TableExprs: SetAuthType($7.(TableExprs), AuthType_DELETE, true).(TableExprs),
	Where: NewWhere(WhereStr, tryCastExpr($8)),
    }
    with := $1.(*With)
    handleCTEAuth(delete, with)
    delete.With = with
    $$ = delete
  }
| with_clause_opt DELETE comment_opt table_name_list from_or_using table_references where_expression_opt
  {
    delete := &Delete{
	Comments: Comments($3.(Comments)),
	Targets: $4.(TableNames),
	TableExprs: SetAuthType($6.(TableExprs), AuthType_DELETE, true).(TableExprs),
	Where: NewWhere(WhereStr, tryCastExpr($7)),
    }
    with := $1.(*With)
    handleCTEAuth(delete, with)
    delete.With = with
    $$ = delete
  }
| with_clause_opt DELETE comment_opt delete_table_list from_or_using table_references where_expression_opt
  {
    tableNames := $4.(TableNames)
    authTargetNames := make([]string, len(tableNames)*2)
    for i, tableName := range tableNames {
    	authTargetNames[2*i] = tableName.DbQualifier.String()
    	authTargetNames[2*i+1] = tableName.Name.String()
    }
    delete := &Delete{
	Comments: Comments($3.(Comments)),
	Targets: tableNames,
	TableExprs: SetAuthType($6.(TableExprs), AuthType_DELETE, true).(TableExprs),
	Where: NewWhere(WhereStr, tryCastExpr($7)),
    }
    with := $1.(*With)
    handleCTEAuth(delete, with)
    delete.With = with
    $$ = delete
  }

from_or_using:
  FROM {}
| USING {}

view_name_list:
  table_name
  {
    $$ = TableNames{$1.(TableName).ToViewName()}
  }
| view_name_list ',' table_name
  {
    $$ = append($$.(TableNames), $3.(TableName).ToViewName())
  }

table_name_list:
  table_name
  {
    $$ = TableNames{$1.(TableName)}
  }
| table_name_list ',' table_name
  {
    $$ = append($$.(TableNames), $3.(TableName))
  }

delete_table_list:
  delete_table_name
  {
    $$ = TableNames{$1.(TableName)}
  }
| delete_table_list ',' delete_table_name
  {
    $$ = append($$.(TableNames), $3.(TableName))
  }

opt_partition_clause:
  {
    $$ = Partitions(nil)
  }
| PARTITION openb partition_list closeb
  {
    $$ = $3.(Partitions)
  }

returning_clause_opt:
  {
    $$ = SelectExprs(nil)
  }
| RETURNING select_expression_list
  {
    $$ = $2.(SelectExprs)
  }

set_statement:
  SET comment_opt set_list
  {
    $$ = &Set{Comments: Comments($2.(Comments)), Exprs: $3.(SetVarExprs)}
  }
| SET comment_opt TRANSACTION transaction_chars
  {
    for i := 0; i < len($4.(SetVarExprs)); i++ {
      $4.(SetVarExprs)[i].Scope = SetScope_None
    }
    $$ = &Set{Comments: Comments($2.(Comments)), Exprs: $4.(SetVarExprs)}
  }
| SET comment_opt set_scope_primary TRANSACTION transaction_chars
  {
    for i := 0; i < len($5.(SetVarExprs)); i++ {
      $5.(SetVarExprs)[i].Scope = $3.(SetScope)
    }
    $$ = &Set{Comments: Comments($2.(Comments)), Exprs: $5.(SetVarExprs)}
  }

transaction_chars:
  transaction_char
  {
    $$ = SetVarExprs{$1.(*SetVarExpr)}
  }
| transaction_chars ',' transaction_char
  {
    $$ = append($$.(SetVarExprs), $3.(*SetVarExpr))
  }

transaction_char:
  ISOLATION LEVEL isolation_level
  {
    $$ = &SetVarExpr{Name: NewColName(TransactionStr), Expr: NewStrVal([]byte($3.(string)))}
  }
| READ WRITE
  {
    $$ = &SetVarExpr{Name: NewColName(TransactionStr), Expr: NewStrVal([]byte(TxReadWrite))}
  }
| READ ONLY
  {
    $$ = &SetVarExpr{Name: NewColName(TransactionStr), Expr: NewStrVal([]byte(TxReadOnly))}
  }

isolation_level:
  REPEATABLE READ
  {
    $$ = IsolationLevelRepeatableRead
  }
| READ COMMITTED
  {
    $$ = IsolationLevelReadCommitted
  }
| READ UNCOMMITTED
  {
    $$ = IsolationLevelReadUncommitted
  }
| SERIALIZABLE
  {
    $$ = IsolationLevelSerializable
  }

lexer_position:
  {
    $$ = yyPosition(yylex)
  }

lexer_old_position:
  {
    $$ = yyOldPosition(yylex)
  }

special_comment_mode:
  {
    $$ = yySpecialCommentMode(yylex)
  }

create_statement:
  create_table_prefix table_spec
  {
    $1.(*DDL).TableSpec = $2.(*TableSpec)
    if len($1.(*DDL).TableSpec.Constraints) > 0 {
      $1.(*DDL).ConstraintAction = AddStr
    }
    $$ = $1.(*DDL)
  }
  // TODO: Allow for table specs to be parsed here
| create_table_prefix AS create_query_expression
  {
    $1.(*DDL).OptSelect = &OptSelect{Select: $3.(SelectStatement)}
    $$ = $1.(*DDL)
  }
  // Currently, only unparenthesized SELECT expressions
  // are permitted for `CREATE AS` if `AS` is omitted.
  // This is done to avoid ambiguity when parsing
  // > CREATE TABLE AS (...
| create_table_prefix create_query_select_expression
   {
     $1.(*DDL).OptSelect = &OptSelect{Select: $2.(SelectStatement)}
     $$ = $1.(*DDL)
   }
| create_table_prefix LIKE table_name
  {
    $1.(*DDL).OptLike = &OptLike{LikeTables: []TableName{$3.(TableName)}}
    $$ = $1.(*DDL)
  }
| CREATE key_type_opt INDEX not_exists_opt sql_id using_opt ON table_name '(' index_column_list ')' index_option_list_opt
  {
    // For consistency, we always return AlterTable for any ALTER TABLE-equivalent statements
    tableName := $8.(TableName)
    ddl := &DDL{
      Action: AlterStr,
      Table: tableName,
      IfNotExists: $4.(int) != 0,
      IndexSpec: &IndexSpec{
        Action: CreateStr,
        ToName: $5.(ColIdent),
        Using: $6.(ColIdent),
        Type: $2.(string),
        Columns: $10.([]*IndexColumn),
        Options: $12.([]*IndexOption),
        ifNotExists: $4.(int) != 0,
      },
      Auth: AuthInformation{
        AuthType: AuthType_INDEX,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
    $$ = &AlterTable{
      Table: $8.(TableName),
      Statements: []*DDL{ddl},
      Auth: AuthInformation{AuthType: AuthType_IGNORE},
    }
  }
| CREATE view_opts VIEW not_exists_opt table_name ins_column_list_opt AS lexer_position special_comment_mode select_statement_with_no_trailing_into lexer_position opt_with_check_option
  {
    viewName := $5.(TableName)
    $2.(*ViewSpec).ViewName = viewName.ToViewName()
    $2.(*ViewSpec).ViewExpr = $10.(SelectStatement)
    $2.(*ViewSpec).Columns = $6.(Columns)
    $2.(*ViewSpec).CheckOption = $12.(ViewCheckOption)
    $$ = &DDL{
      Action: CreateStr,
      ViewSpec: $2.(*ViewSpec),
      IfNotExists: $4.(int) != 0,
      SpecialCommentMode: $9.(bool),
      SubStatementPositionStart: $8.(int),
      SubStatementPositionEnd: $11.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_VIEW,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{viewName.DbQualifier.String()},
      },
    }
  }
| CREATE view_opts VIEW not_exists_opt table_name ins_column_list_opt AS lexer_position special_comment_mode openb select_statement_with_no_trailing_into closeb lexer_position opt_with_check_option
  {
    // Accept parenthesized SELECT for MySQL compatibility (single level only)
    viewName := $5.(TableName)
    $2.(*ViewSpec).ViewName = viewName.ToViewName()
    $2.(*ViewSpec).ViewExpr = &ParenSelect{Select: $11.(SelectStatement)}
    $2.(*ViewSpec).Columns = $6.(Columns)
    $2.(*ViewSpec).CheckOption = $14.(ViewCheckOption)
    $$ = &DDL{
      Action: CreateStr,
      ViewSpec: $2.(*ViewSpec),
      IfNotExists: $4.(int) != 0,
      SpecialCommentMode: $9.(bool),
      // Capture inner SELECT span, not parentheses
      SubStatementPositionStart: $8.(int),
      SubStatementPositionEnd: $13.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_VIEW,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{viewName.DbQualifier.String()},
      },
    }
  }
| CREATE OR REPLACE view_opts VIEW table_name ins_column_list_opt AS lexer_position special_comment_mode select_statement_with_no_trailing_into lexer_position opt_with_check_option
  {
    viewName := $6.(TableName)
    $4.(*ViewSpec).ViewName = viewName.ToViewName()
    $4.(*ViewSpec).ViewExpr = $11.(SelectStatement)
    $4.(*ViewSpec).Columns = $7.(Columns)
    $4.(*ViewSpec).CheckOption = $13.(ViewCheckOption)
    $$ = &DDL{
      Action: CreateStr,
      ViewSpec: $4.(*ViewSpec),
      SpecialCommentMode: $10.(bool),
      SubStatementPositionStart: $9.(int),
      SubStatementPositionEnd: $12.(int) - 1,
      OrReplace: true,
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_VIEW,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{viewName.DbQualifier.String()},
      },
    }
  }
| CREATE OR REPLACE view_opts VIEW table_name ins_column_list_opt AS lexer_position special_comment_mode openb select_statement_with_no_trailing_into closeb lexer_position opt_with_check_option
  {
    // Accept parenthesized SELECT for MySQL compatibility (single level only)
    viewName := $6.(TableName)
    $4.(*ViewSpec).ViewName = viewName.ToViewName()
    $4.(*ViewSpec).ViewExpr = &ParenSelect{Select: $12.(SelectStatement)}
    $4.(*ViewSpec).Columns = $7.(Columns)
    $4.(*ViewSpec).CheckOption = $15.(ViewCheckOption)
    $$ = &DDL{
      Action: CreateStr,
      ViewSpec: $4.(*ViewSpec),
      SpecialCommentMode: $10.(bool),
      // Capture inner SELECT span, not parentheses
      SubStatementPositionStart: $9.(int),
      SubStatementPositionEnd: $14.(int) - 1,
      OrReplace: true,
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_VIEW,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{viewName.DbQualifier.String()},
      },
    }
  }
| CREATE DATABASE not_exists_opt ID creation_option_opt
  {
    var ne bool
    if $3.(int) != 0 {
      ne = true
    }
    $$ = &DBDDL{
      Action: CreateStr,
      SchemaOrDatabase: "database",
      DBName: string($4),
      IfNotExists: ne,
      CharsetCollate: $5.([]*CharsetAndCollate),
      Auth: AuthInformation{
        AuthType: AuthType_CREATE,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| CREATE SCHEMA not_exists_opt ID creation_option_opt
  {
    var ne bool
    if $3.(int) != 0 {
      ne = true
    }
    $$ = &DBDDL{
      Action: CreateStr,
      SchemaOrDatabase: "schema",
      DBName: string($4),
      IfNotExists: ne,
      CharsetCollate: $5.([]*CharsetAndCollate),
      Auth: AuthInformation{
        AuthType: AuthType_CREATE,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| CREATE definer_opt TRIGGER trigger_name trigger_time trigger_event ON table_name FOR EACH ROW trigger_order_opt lexer_position special_comment_mode trigger_body lexer_position
  {
    tableName := $8.(TableName)
    $$ = &DDL{
      Action: CreateStr,
      Table: tableName,
      TriggerSpec: &TriggerSpec{
        TrigName: $4.(TriggerName),
        Definer: $2.(string),
        Time: $5.(string),
        Event: $6.(string),
        Order: $12.(*TriggerOrder),
        Body: tryCastStatement($15),
      },
      SpecialCommentMode: $14.(bool),
      SubStatementPositionStart: $13.(int),
      SubStatementPositionEnd: $16.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_TRIGGER,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
  }
| CREATE definer_opt PROCEDURE procedure_name '(' proc_param_list_opt ')' characteristic_list_opt lexer_old_position special_comment_mode statement_list_statement lexer_position
  {
    procName := $4.(ProcedureName)
    $$ = &DDL{
      Action: CreateStr,
      ProcedureSpec: &ProcedureSpec{
        ProcName: procName,
        Definer: $2.(string),
        Params: $6.([]ProcedureParam),
        Characteristics: $8.([]Characteristic),
        Body: tryCastStatement($11),
      },
      SpecialCommentMode: $10.(bool),
      SubStatementPositionStart: $9.(int),
      SubStatementPositionEnd: $12.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_ROUTINE,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{procName.Qualifier.String()},
      },
    }
  }
| CREATE USER not_exists_opt account_with_auth_list default_role_opt tls_options account_limits pass_lock_options user_comment_attribute
  {
    var notExists bool
    if $3.(int) != 0 {
      notExists = true
    }
    tlsOptions, err := NewTLSOptions($6.([]TLSOptionItem))
    if err != nil {
      yylex.Error(err.Error())
      return 1
    }
    accountLimits, err := NewAccountLimits($7.([]AccountLimitItem))
    if err != nil {
      yylex.Error(err.Error())
      return 1
    }
    passwordOptions, locked := NewPasswordOptionsWithLock($8.([]PassLockItem))
    $$ = &CreateUser{
      IfNotExists: notExists,
      Users: $4.([]AccountWithAuth),
      DefaultRoles: $5.([]AccountName),
      TLSOptions: tlsOptions,
      AccountLimits: accountLimits,
      PasswordOptions: passwordOptions,
      Locked: locked,
      Attribute: $9.(string),
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_USER,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| CREATE ROLE not_exists_opt role_name_list
  {
    var notExists bool
    if $3.(int) != 0 {
      notExists = true
    }
    $$ = &CreateRole{
      IfNotExists: notExists,
      Roles: $4.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_ROLE,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| CREATE definer_opt EVENT not_exists_opt event_name ON SCHEDULE event_schedule event_on_completion_preserve_opt event_status_opt comment_keyword_opt DO lexer_position statement_list_statement lexer_position
  {
    eventName := $5.(EventName)
    var notExists bool
    if $4.(int) != 0 {
      notExists = true
    }
    $$ = &DDL{
      Action: CreateStr,
      EventSpec: &EventSpec{
        EventName: eventName,
        Definer: $2.(string),
        IfNotExists: notExists,
        OnSchedule: $8.(*EventScheduleSpec),
        OnCompletionPreserve: $9.(EventOnCompletion),
        Status: $10.(EventStatus),
        Comment: $11.(*SQLVal),
        Body: tryCastStatement($14),
      },
      SubStatementPositionStart: $13.(int),
      SubStatementPositionEnd: $15.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_EVENT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{eventName.Qualifier.String()},
      },
    }
  }
| create_spatial_ref_sys
  {
    $$ = tryCastStatement($1)
  }

create_spatial_ref_sys:
  CREATE SPATIAL REFERENCE SYSTEM INTEGRAL srs_attribute
  {
    $$ = &CreateSpatialRefSys{
      SRID: NewIntVal($5),
      SrsAttr: $6.(*SrsAttribute),
      Auth: AuthInformation{
        AuthType: AuthType_INSERT,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{"mysql", "st_spatial_references_systems"},
      },
    }
  }
| CREATE SPATIAL REFERENCE SYSTEM IF NOT EXISTS INTEGRAL srs_attribute
  {
    $$ = &CreateSpatialRefSys{
      SRID: NewIntVal($8),
      IfNotExists: true,
      SrsAttr: $9.(*SrsAttribute),
      Auth: AuthInformation{
        AuthType: AuthType_INSERT,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{"mysql", "st_spatial_references_systems"},
      },
    }
  }
| CREATE OR REPLACE SPATIAL REFERENCE SYSTEM INTEGRAL srs_attribute
  {
    $$ = &CreateSpatialRefSys{
      SRID: NewIntVal($7),
      OrReplace: true,
      SrsAttr: $8.(*SrsAttribute),
      Auth: AuthInformation{
        AuthType: AuthType_INSERT,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{"mysql", "st_spatial_references_systems"},
      },
    }
  }

srs_attribute:
  {
    $$ = new(SrsAttribute)
  }
| srs_attribute NAME STRING
  {
    if $1.(*SrsAttribute).Name != "" {
      yylex.Error("multiple definitions of attribute name")
      return 1
    }
    $1.(*SrsAttribute).Name = string($3)
    $$ = $1.(*SrsAttribute)
  }
| srs_attribute DEFINITION STRING
  {
    if $1.(*SrsAttribute).Definition != "" {
      yylex.Error("multiple definitions of attribute definition")
      return 1
    }
    $1.(*SrsAttribute).Definition = string($3)
    $$ = $1.(*SrsAttribute)
  }
| srs_attribute ORGANIZATION STRING IDENTIFIED BY INTEGRAL
  {
    if $1.(*SrsAttribute).Organization != "" {
      yylex.Error("multiple definitions of attribute organization")
      return 1
    }
    $1.(*SrsAttribute).Organization = string($3)
    $1.(*SrsAttribute).OrgID = NewIntVal($6)
    $$ = $1.(*SrsAttribute)
  }
| srs_attribute DESCRIPTION STRING
  {
    if $1.(*SrsAttribute).Description != "" {
      yylex.Error("multiple definitions of attribute description")
      return 1
    }
    $1.(*SrsAttribute).Description = string($3)
    $$ = $1.(*SrsAttribute)
  }

opt_with_check_option:
  /* EMPTY */
  {
    $$ = ViewCheckOptionUnspecified
  }
| WITH CHECK OPTION
  {
    $$ = ViewCheckOptionCascaded
  }
| WITH CASCADED CHECK OPTION
  {
    $$ = ViewCheckOptionCascaded
  }
| WITH LOCAL CHECK OPTION
  {
    $$ = ViewCheckOptionLocal
  }

default_role_opt:
  {
    $$ = []AccountName(nil)
  }
| DEFAULT ROLE role_name_list
  {
    $$ = $3.([]AccountName)
  }

tls_options:
  {
    $$ = []TLSOptionItem(nil)
  }
| REQUIRE NONE
  {
    $$ = []TLSOptionItem(nil)
  }
| REQUIRE tls_option_item_list
  {
    $$ = $2.([]TLSOptionItem)
  }

tls_option_item_list:
  tls_option_item
  {
    $$ = []TLSOptionItem{$1.(TLSOptionItem)}
  }
| tls_option_item_list AND tls_option_item
  {
    $$ = append($1.([]TLSOptionItem), $3.(TLSOptionItem))
  }

tls_option_item:
  SSL
  {
    $$ = TLSOptionItem{TLSOptionItemType: TLSOptionItemType_SSL, ItemData: ""}
  }
| X509
  {
    $$ = TLSOptionItem{TLSOptionItemType: TLSOptionItemType_X509, ItemData: ""}
  }
| CIPHER STRING
  {
    $$ = TLSOptionItem{TLSOptionItemType: TLSOptionItemType_Cipher, ItemData: string($2)}
  }
| ISSUER STRING
  {
    $$ = TLSOptionItem{TLSOptionItemType: TLSOptionItemType_Issuer, ItemData: string($2)}
  }
| SUBJECT STRING
  {
    $$ = TLSOptionItem{TLSOptionItemType: TLSOptionItemType_Subject, ItemData: string($2)}
  }

account_limits:
  {
    $$ = []AccountLimitItem(nil)
  }
| WITH account_limit_item_list
  {
    $$ = $2.([]AccountLimitItem)
  }

account_limit_item_list:
  account_limit_item
  {
    $$ = []AccountLimitItem{$1.(AccountLimitItem)}
  }
| account_limit_item_list account_limit_item
  {
    $$ = append($1.([]AccountLimitItem), $2.(AccountLimitItem))
  }

account_limit_item:
  MAX_QUERIES_PER_HOUR INTEGRAL
  {
    $$ = AccountLimitItem{AccountLimitItemType: AccountLimitItemType_Queries_PH, Count: NewIntVal($2)}
  }
| MAX_UPDATES_PER_HOUR INTEGRAL
  {
    $$ = AccountLimitItem{AccountLimitItemType: AccountLimitItemType_Updates_PH, Count: NewIntVal($2)}
  }
| MAX_CONNECTIONS_PER_HOUR INTEGRAL
  {
    $$ = AccountLimitItem{AccountLimitItemType: AccountLimitItemType_Connections_PH, Count: NewIntVal($2)}
  }
| MAX_USER_CONNECTIONS INTEGRAL
  {
    $$ = AccountLimitItem{AccountLimitItemType: AccountLimitItemType_Connections, Count: NewIntVal($2)}
  }

pass_lock_options:
  {
    $$ = []PassLockItem(nil)
  }
| pass_lock_item_list
  {
    $$ = $1.([]PassLockItem)
  }

pass_lock_item_list:
  pass_lock_item
  {
    $$ = []PassLockItem{$1.(PassLockItem)}
  }
| pass_lock_item_list pass_lock_item
  {
    $$ = append($1.([]PassLockItem), $2.(PassLockItem))
  }

pass_lock_item:
  PASSWORD EXPIRE DEFAULT
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassExpireDefault, Value: nil}
  }
| PASSWORD EXPIRE NEVER
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassExpireNever, Value: nil}
  }
| PASSWORD EXPIRE INTERVAL INTEGRAL DAY
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassExpireInterval, Value: NewIntVal($4)}
  }
| PASSWORD HISTORY DEFAULT
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassHistory, Value: nil}
  }
| PASSWORD HISTORY INTEGRAL
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassHistory, Value: NewIntVal($3)}
  }
| PASSWORD REUSE INTERVAL DEFAULT
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassReuseInterval, Value: nil}
  }
| PASSWORD REUSE INTERVAL INTEGRAL DAY
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassReuseInterval, Value: NewIntVal($4)}
  }
| PASSWORD REQUIRE CURRENT DEFAULT
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassReqCurrentDefault, Value: nil}
  }
| PASSWORD REQUIRE CURRENT OPTIONAL
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassReqCurrentOptional, Value: nil}
  }
| FAILED_LOGIN_ATTEMPTS INTEGRAL
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassFailedLogins, Value: NewIntVal($2)}
  }
| PASSWORD_LOCK_TIME INTEGRAL
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassLockTime, Value: NewIntVal($2)}
  }
| PASSWORD_LOCK_TIME UNBOUNDED
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_PassLockTime, Value: nil}
  }
| ACCOUNT LOCK
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_AccountLock, Value: nil}
  }
| ACCOUNT UNLOCK
  {
    $$ = PassLockItem{PassLockItemType: PassLockItemType_AccountUnlock, Value: nil}
  }

user_comment_attribute:
  {
    $$ = ""
  }
| COMMENT_KEYWORD STRING
  {
    comment := string($2)
    $$ = `{"comment": "`+escapeDoubleQuotes(comment)+`"}`
  }
| ATTRIBUTE STRING
  {
    $$ = string($2)
  }

grant_statement:
  GRANT ALL ON grant_object_type grant_privilege_level TO account_name_list with_grant_opt grant_assumption
  {
    allPriv := []Privilege{Privilege{Type: PrivilegeType_All, Columns: nil}}
    $$ = &GrantPrivilege{
      Privileges: allPriv,
      ObjectType: $4.(GrantObjectType),
      PrivilegeLevel: $5.(PrivilegeLevel),
      To: $7.([]AccountName),
      WithGrantOption: $8.(bool),
      As: $9.(*GrantUserAssumption),
      Auth: AuthInformation{
        AuthType: AuthType_GRANT_PRIVILEGE,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| GRANT ALL PRIVILEGES ON grant_object_type grant_privilege_level TO account_name_list with_grant_opt grant_assumption
    {
      allPriv := []Privilege{Privilege{Type: PrivilegeType_All, Columns: nil}}
      $$ = &GrantPrivilege{
        Privileges: allPriv,
        ObjectType: $5.(GrantObjectType),
        PrivilegeLevel: $6.(PrivilegeLevel),
        To: $8.([]AccountName),
        WithGrantOption: $9.(bool),
        As: $10.(*GrantUserAssumption),
        Auth: AuthInformation{
          AuthType: AuthType_GRANT_PRIVILEGE,
          TargetType: AuthTargetType_Ignore,
        },
      }
    }
| GRANT grant_privilege_list ON grant_object_type grant_privilege_level TO account_name_list with_grant_opt grant_assumption
  {
    $$ = &GrantPrivilege{
      Privileges: $2.([]Privilege),
      ObjectType: $4.(GrantObjectType),
      PrivilegeLevel: $5.(PrivilegeLevel),
      To: $7.([]AccountName),
      WithGrantOption: $8.(bool),
      As: $9.(*GrantUserAssumption),
      Auth: AuthInformation{
        AuthType: AuthType_GRANT_PRIVILEGE,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| GRANT role_name_list TO account_name_list with_admin_opt
  {
    $$ = &GrantRole{
      Roles: $2.([]AccountName),
      To: $4.([]AccountName),
      WithAdminOption: $5.(bool),
      Auth: AuthInformation{
        AuthType: AuthType_GRANT_ROLE,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| GRANT PROXY ON account_name TO account_name_list with_grant_opt
  {
    $$ = &GrantProxy{
      On: $4.(AccountName),
      To: $6.([]AccountName),
      WithGrantOption: $7.(bool),
      Auth: AuthInformation{
        AuthType: AuthType_GRANT_PROXY,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }

ignore_unknown_user_opt:
  {
    $$ = false
  }
| IGNORE UNKNOWN USER
  {
    $$ = true
  }

revoke_statement:
  REVOKE exists_opt ALL ON grant_object_type grant_privilege_level FROM account_name_list ignore_unknown_user_opt
  {
    allPriv := []Privilege{Privilege{Type: PrivilegeType_All, Columns: nil}}
    $$ = &RevokePrivilege{
      IfExists: $2.(int) == 1,
      Privileges: allPriv,
      ObjectType: $5.(GrantObjectType),
      PrivilegeLevel: $6.(PrivilegeLevel),
      From: $8.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_REVOKE_PRIVILEGE,
        TargetType: AuthTargetType_Ignore,
      },
      IgnoreUnknownUser: $9.(bool),
    }
  }
| REVOKE exists_opt grant_privilege_list ON grant_object_type grant_privilege_level FROM account_name_list ignore_unknown_user_opt
  {
    $$ = &RevokePrivilege{
      IfExists: $2.(int) == 1,
      Privileges: $3.([]Privilege),
      ObjectType: $5.(GrantObjectType),
      PrivilegeLevel: $6.(PrivilegeLevel),
      From: $8.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_REVOKE_PRIVILEGE,
        TargetType: AuthTargetType_Ignore,
      },
      IgnoreUnknownUser: $9.(bool),
    }
  }
| REVOKE exists_opt ALL ',' GRANT OPTION FROM account_name_list ignore_unknown_user_opt
  {
    allPriv := []Privilege{Privilege{Type: PrivilegeType_All, Columns: nil}}
    $$ = &RevokePrivilege{
      IfExists: $2.(int) == 1,
      Privileges: allPriv,
      ObjectType: GrantObjectType_Any,
      PrivilegeLevel: PrivilegeLevel{Database: "*", TableRoutine: "*"},
      From: $8.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_REVOKE_ALL,
        TargetType: AuthTargetType_Ignore,
      },
      IgnoreUnknownUser: $9.(bool),
    }
  }
| REVOKE exists_opt ALL PRIVILEGES ',' GRANT OPTION FROM account_name_list ignore_unknown_user_opt
  {
    allPriv := []Privilege{Privilege{Type: PrivilegeType_All, Columns: nil}}
    $$ = &RevokePrivilege{
      IfExists: $2.(int) == 1,
      Privileges: allPriv,
      ObjectType: GrantObjectType_Any,
      PrivilegeLevel: PrivilegeLevel{Database: "*", TableRoutine: "*"},
      From: $9.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_REVOKE_ALL,
        TargetType: AuthTargetType_Ignore,
      },
      IgnoreUnknownUser: $10.(bool),
    }
  }
| REVOKE exists_opt role_name_list FROM account_name_list ignore_unknown_user_opt
  {
    $$ = &RevokeRole{
      IfExists: $2.(int) == 1,
      Roles: $3.([]AccountName),
      From: $5.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_REVOKE_ROLE,
        TargetType: AuthTargetType_Ignore,
      },
      IgnoreUnknownUser: $6.(bool),
    }
  }
| REVOKE exists_opt PROXY ON account_name FROM account_name_list ignore_unknown_user_opt
  {
    $$ = &RevokeProxy{
      IfExists: $2.(int) == 1,
      On: $5.(AccountName),
      From: $7.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_REVOKE_PROXY,
        TargetType: AuthTargetType_Ignore,
      },
      IgnoreUnknownUser: $8.(bool),
    }
  }

grant_privilege:
  ALTER grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Alter, Columns: $2.([]string)}
  }
| ALTER ROUTINE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_AlterRoutine, Columns: $3.([]string)}
  }
| CREATE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Create, Columns: $2.([]string)}
  }
| CREATE ROLE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_CreateRole, Columns: $3.([]string)}
  }
| CREATE ROUTINE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_CreateRoutine, Columns: $3.([]string)}
  }
| CREATE TABLESPACE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_CreateTablespace, Columns: $3.([]string)}
  }
| CREATE TEMPORARY TABLES grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_CreateTemporaryTables, Columns: $4.([]string)}
  }
| CREATE USER grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_CreateUser, Columns: $3.([]string)}
  }
| CREATE VIEW grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_CreateView, Columns: $3.([]string)}
  }
| DELETE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Delete, Columns: $2.([]string)}
  }
| DROP grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Drop, Columns: $2.([]string)}
  }
| DROP ROLE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_DropRole, Columns: $3.([]string)}
  }
| EVENT grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Event, Columns: $2.([]string)}
  }
| EXECUTE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Execute, Columns: $2.([]string)}
  }
| FILE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_File, Columns: $2.([]string)}
  }
| GRANT OPTION grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_GrantOption, Columns: $3.([]string)}
  }
| INDEX grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Index, Columns: $2.([]string)}
  }
| INSERT grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Insert, Columns: $2.([]string)}
  }
| LOCK TABLES grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_LockTables, Columns: $3.([]string)}
  }
| PROCESS grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Process, Columns: $2.([]string)}
  }
| REFERENCES grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_References, Columns: $2.([]string)}
  }
| RELOAD grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Reload, Columns: $2.([]string)}
  }
| REPLICATION CLIENT grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_ReplicationClient, Columns: $3.([]string)}
  }
| REPLICATION SLAVE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_ReplicationSlave, Columns: $3.([]string)}
  }
| SELECT grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Select, Columns: $2.([]string)}
  }
| SHOW DATABASES grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_ShowDatabases, Columns: $3.([]string)}
  }
| SHOW VIEW grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_ShowView, Columns: $3.([]string)}
  }
| SHUTDOWN grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Shutdown, Columns: $2.([]string)}
  }
| SUPER grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Super, Columns: $2.([]string)}
  }
| TRIGGER grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Trigger, Columns: $2.([]string)}
  }
| UPDATE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Update, Columns: $2.([]string)}
  }
| USAGE grant_privilege_columns_opt
  {
    $$ = Privilege{Type: PrivilegeType_Usage, Columns: $2.([]string)}
  }
| dynamic_privilege
  {
    $$ = Privilege{Type: PrivilegeType_Dynamic, DynamicName: strings.ToLower(string($1))}
  }

grant_privilege_list:
  grant_privilege
  {
    $$ = []Privilege{$1.(Privilege)}
  }
| grant_privilege_list ',' grant_privilege
  {
    $$ = append($1.([]Privilege), $3.(Privilege))
  }

dynamic_privilege:
  APPLICATION_PASSWORD_ADMIN
| AUDIT_ABORT_EXEMPT
| AUDIT_ADMIN
| AUTHENTICATION_POLICY_ADMIN
| BACKUP_ADMIN
| BINLOG_ADMIN
| BINLOG_ENCRYPTION_ADMIN
| CLONE_ADMIN
| CONNECTION_ADMIN
| ENCRYPTION_KEY_ADMIN
| FIREWALL_ADMIN
| FIREWALL_EXEMPT
| FIREWALL_USER
| FLUSH_OPTIMIZER_COSTS
| FLUSH_STATUS
| FLUSH_TABLES
| FLUSH_USER_RESOURCES
| GROUP_REPLICATION_ADMIN
| GROUP_REPLICATION_STREAM
| INNODB_REDO_LOG_ARCHIVE
| INNODB_REDO_LOG_ENABLE
| NDB_STORED_USER
| PASSWORDLESS_USER_ADMIN
| PERSIST_RO_VARIABLES_ADMIN
| REPLICATION_APPLIER
| REPLICATION_SLAVE_ADMIN
| RESOURCE_GROUP_ADMIN
| RESOURCE_GROUP_USER
| ROLE_ADMIN
| SENSITIVE_VARIABLES_OBSERVER
| SESSION_VARIABLES_ADMIN
| SET_USER_ID
| SHOW_ROUTINE
| SKIP_QUERY_REWRITE
| SYSTEM_VARIABLES_ADMIN
| TABLE_ENCRYPTION_ADMIN
| TP_CONNECTION_ADMIN
| VERSION_TOKEN_ADMIN
| XA_RECOVER_ADMIN

grant_privilege_columns_opt:
  {
    $$ = []string(nil)
  }
| '(' grant_privilege_column_list ')'
  {
    $$ = $2.([]string)
  }

grant_privilege_column_list:
  sql_id
  {
    $$ = []string{$1.(ColIdent).String()}
  }
| grant_privilege_column_list ',' sql_id
  {
    $$ = append($1.([]string), $3.(ColIdent).String())
  }

grant_object_type:
  {
    $$ = GrantObjectType_Any
  }
| TABLE
  {
    $$ = GrantObjectType_Table
  }
| FUNCTION
  {
    $$ = GrantObjectType_Function
  }
| PROCEDURE
  {
    $$ = GrantObjectType_Procedure
  }

grant_privilege_level:
  '*'
  {
    $$ = PrivilegeLevel{Database: "", TableRoutine: "*"}
  }
| '*' '.' '*'
  {
    $$ = PrivilegeLevel{Database: "*", TableRoutine: "*"}
  }
| sql_id
  {
    $$ = PrivilegeLevel{Database: "", TableRoutine: $1.(ColIdent).String()}
  }
| sql_id '.' '*'
  {
    $$ = PrivilegeLevel{Database: $1.(ColIdent).String(), TableRoutine: "*"}
  }
| sql_id '.' sql_id
  {
    $$ = PrivilegeLevel{Database: $1.(ColIdent).String(), TableRoutine: $3.(ColIdent).String()}
  }

grant_assumption:
  {
    $$ = (*GrantUserAssumption)(nil)
  }
| AS account_name
  {
    $$ = &GrantUserAssumption{Type: GrantUserAssumptionType_Default, User: $2.(AccountName), Roles: nil}
  }
| AS account_name WITH ROLE DEFAULT
  {
    $$ = &GrantUserAssumption{Type: GrantUserAssumptionType_Default, User: $2.(AccountName), Roles: nil}
  }
| AS account_name WITH ROLE NONE
  {
    $$ = &GrantUserAssumption{Type: GrantUserAssumptionType_None, User: $2.(AccountName), Roles: nil}
  }
| AS account_name WITH ROLE ALL
  {
    $$ = &GrantUserAssumption{Type: GrantUserAssumptionType_All, User: $2.(AccountName), Roles: nil}
  }
| AS account_name WITH ROLE ALL EXCEPT role_name_list
  {
    $$ = &GrantUserAssumption{Type: GrantUserAssumptionType_AllExcept, User: $2.(AccountName), Roles: $7.([]AccountName)}
  }
| AS account_name WITH ROLE role_name_list
  {
    $$ = &GrantUserAssumption{Type: GrantUserAssumptionType_Roles, User: $2.(AccountName), Roles: $5.([]AccountName)}
  }

with_grant_opt:
  {
    $$ = false
  }
| WITH GRANT OPTION
  {
    $$ = true
  }

with_admin_opt:
  {
    $$ = false
  }
| WITH ADMIN OPTION
  {
    $$ = true
  }

// TODO: Implement IGNORE, REPLACE, VALUES, and TABLE
create_query_select_expression:
  base_select_no_cte order_by_opt limit_opt lock_opt
  {
    if $1.(SelectStatement).GetInto() != nil {
      yylex.Error(fmt.Errorf("INTO clause is not allowed").Error())
      return 1
    }
    $1.(SelectStatement).SetOrderBy($2.(OrderBy))
    $1.(SelectStatement).SetLimit($3.(*Limit))
    $1.(SelectStatement).SetLock($4.(string))
    $$ = $1.(SelectStatement)
  }

create_query_expression:
  select_or_set_op order_by_opt limit_opt lock_opt
  {
    if $1.(SelectStatement).GetInto() != nil {
      yylex.Error(fmt.Errorf("INTO clause is not allowed").Error())
      return 1
    }
    $1.(SelectStatement).SetOrderBy($2.(OrderBy))
    $1.(SelectStatement).SetLimit($3.(*Limit))
    $1.(SelectStatement).SetLock($4.(string))
    $$ = $1.(SelectStatement)
  }

proc_param_list_opt:
  {
    $$ = []ProcedureParam(nil)
  }
| proc_param_list
  {
    $$ = $1.([]ProcedureParam)
  }

proc_param_list:
  proc_param
  {
    $$ = []ProcedureParam{$1.(ProcedureParam)}
  }
| proc_param_list ',' proc_param
  {
    $$ = append($$.([]ProcedureParam), $3.(ProcedureParam))
  }

proc_param:
  sql_id column_type
  {
    $$ = ProcedureParam{Direction: ProcedureParamDirection_In, Name: $1.(ColIdent).String(), Type: $2.(ColumnType)}
  }
| IN sql_id column_type
  {
    $$ = ProcedureParam{Direction: ProcedureParamDirection_In, Name: $2.(ColIdent).String(), Type: $3.(ColumnType)}
  }
| INOUT sql_id column_type
  {
    $$ = ProcedureParam{Direction: ProcedureParamDirection_Inout, Name: $2.(ColIdent).String(), Type: $3.(ColumnType)}
  }
| OUT sql_id column_type
  {
    $$ = ProcedureParam{Direction: ProcedureParamDirection_Out, Name: $2.(ColIdent).String(), Type: $3.(ColumnType)}
  }

characteristic_list_opt:
  {
    $$ = []Characteristic(nil)
  }
| characteristic_list
  {
    $$ = $1.([]Characteristic)
  }

characteristic_list:
  characteristic
  {
    $$ = []Characteristic{$1.(Characteristic)}
  }
| characteristic_list characteristic
  {
    $$ = append($$.([]Characteristic), $2.(Characteristic))
  }

characteristic:
  COMMENT_KEYWORD STRING
  {
    $$ = Characteristic{Type: CharacteristicValue_Comment, Comment: string($2)}
  }
| LANGUAGE SQL
  {
    $$ = Characteristic{Type: CharacteristicValue_LanguageSql}
  }
| NOT DETERMINISTIC
  {
    $$ = Characteristic{Type: CharacteristicValue_NotDeterministic}
  }
| DETERMINISTIC
  {
    $$ = Characteristic{Type: CharacteristicValue_Deterministic}
  }
| CONTAINS SQL
  {
    $$ = Characteristic{Type: CharacteristicValue_ContainsSql}
  }
| NO SQL
  {
    $$ = Characteristic{Type: CharacteristicValue_NoSql}
  }
| READS SQL DATA
  {
    $$ = Characteristic{Type: CharacteristicValue_ReadsSqlData}
  }
| MODIFIES SQL DATA
  {
    $$ = Characteristic{Type: CharacteristicValue_ModifiesSqlData}
  }
| SQL SECURITY DEFINER
  {
    $$ = Characteristic{Type: CharacteristicValue_SqlSecurityDefiner}
  }
| SQL SECURITY INVOKER
  {
    $$ = Characteristic{Type: CharacteristicValue_SqlSecurityInvoker}
  }

begin_end_block:
  BEGIN END
  {
    $$ = &BeginEndBlock{Label: ""}
  }
| ID ':' BEGIN END
  {
    $$ = &BeginEndBlock{Label: string($1)}
  }
| ID ':' BEGIN END ID
  {
    label := string($1)
      if label != string($5) {
        yylex.Error("End-label "+string($5)+" without match")
        return 1
      }
    $$ = &BeginEndBlock{Label: label}
  }
| BEGIN statement_list ';' END
  {
    $$ = &BeginEndBlock{Label: "", Statements: $2.(Statements)}
  }
| ID ':' BEGIN statement_list ';' END
  {
    $$ = &BeginEndBlock{Label: string($1), Statements: $4.(Statements)}
  }
| ID ':' BEGIN statement_list ';' END ID
  {
    label := string($1)
      if label != string($7) {
        yylex.Error("End-label "+string($7)+" without match")
        return 1
      }
    $$ = &BeginEndBlock{Label: label, Statements: $4.(Statements)}
  }

view_opts:
  definer_opt security_opt
  {
    $$ = &ViewSpec{Algorithm: "", Definer: $1.(string), Security: $2.(string)}
  }
| algorithm_view_opt definer_opt security_opt
  {
    $$ = &ViewSpec{Algorithm: $1.(string), Definer: $2.(string), Security: $3.(string)}
  }

algorithm_view_opt:
  ALGORITHM '=' UNDEFINED
  {
    $$ = string($3)
  }
| ALGORITHM '=' MERGE
  {
    $$ = string($3)
  }
| ALGORITHM '=' TEMPTABLE
  {
    $$ = string($3)
  }

definer_opt:
  {
    $$ = ""
  }
| DEFINER '=' account_name
  {
    $$ = $3.(AccountName).String()
  }

security_opt:
  {
    $$ = ""
  }
| SQL SECURITY DEFINER
  {
    $$ = string($3)
  }
| SQL SECURITY INVOKER
  {
    $$ = string($3)
  }

account_name_str:
  STRING
  {
    $$ = string($1)
  }
| ID
  {
    $$ = string($1)
  }
| non_reserved_keyword
  {
    $$ = string($1)
  }

account_name:
  account_name_str '@' account_name_str
  {
    anyHost := false
    if $3.(string) == "%" {
      anyHost = true
    }
    $$ = AccountName{Name: $1.(string), Host: $3.(string), AnyHost: anyHost}
  }
| account_name_str '@'
  {
    $$ = AccountName{Name: $1.(string), Host: "", AnyHost: false}
  }
| account_name_str
  {
    $$ = AccountName{Name: $1.(string), Host: "", AnyHost: true}
  }

account_name_list:
  account_name
  {
    $$ = []AccountName{$1.(AccountName)}
  }
| account_name_list ',' account_name
  {
    $$ = append($1.([]AccountName), $3.(AccountName))
  }

role_name:
  account_name_str '@' account_name_str
  {
    if len($1.(string)) == 0 {
      yylex.Error("the anonymous user is not a valid role name")
      return 1
    }
    $$ = AccountName{Name: $1.(string), Host: $3.(string), AnyHost: false}
  }
| account_name_str '@'
  {
    if len($1.(string)) == 0 {
      yylex.Error("the anonymous user is not a valid role name")
      return 1
    }
    $$ = AccountName{Name: $1.(string), Host: "", AnyHost: false}
  }
| account_name_str
  {
    if len($1.(string)) == 0 {
      yylex.Error("the anonymous user is not a valid role name")
      return 1
    }
    $$ = AccountName{Name: $1.(string), Host: "", AnyHost: true}
  }

role_name_list:
  role_name
  {
    $$ = []AccountName{$1.(AccountName)}
  }
| role_name_list ',' role_name
  {
    $$ = append($1.([]AccountName), $3.(AccountName))
  }

account_with_auth:
  account_name
  {
    $$ = AccountWithAuth{AccountName: $1.(AccountName)}
  }
| account_name authentication
  {
    $$ = AccountWithAuth{AccountName: $1.(AccountName), Auth1: $2.(*Authentication)}
  }
| account_name authentication INITIAL AUTHENTICATION authentication_initial
  {
    $$ = AccountWithAuth{AccountName: $1.(AccountName), Auth1: $2.(*Authentication), AuthInitial: $5.(*Authentication)}
  }
| account_name authentication AND authentication
  {
    $$ = AccountWithAuth{AccountName: $1.(AccountName), Auth1: $2.(*Authentication), Auth2: $4.(*Authentication)}
  }
| account_name authentication AND authentication AND authentication
  {
    $$ = AccountWithAuth{AccountName: $1.(AccountName), Auth1: $2.(*Authentication), Auth2: $4.(*Authentication), Auth3: $6.(*Authentication)}
  }

authentication_opt:
  {
    $$ = &Authentication{}
  }
| authentication
  {
    $$ = $1
  }

authentication:
  IDENTIFIED BY RANDOM PASSWORD
  {
    $$ = &Authentication{RandomPassword: true}
  }
| IDENTIFIED BY STRING
  {
    $$ = &Authentication{Password: string($3)}
  }
| IDENTIFIED WITH ID
  {
    $$ = &Authentication{Plugin: string($3)}
  }
| IDENTIFIED WITH STRING
  {
    $$ = &Authentication{Plugin: string($3)}
  }
| IDENTIFIED WITH ID BY RANDOM PASSWORD
  {
    $$ = &Authentication{Plugin: string($3), RandomPassword: true}
  }
| IDENTIFIED WITH STRING BY RANDOM PASSWORD
  {
    $$ = &Authentication{Plugin: string($3), RandomPassword: true}
  }
| IDENTIFIED WITH ID BY STRING
  {
    $$ = &Authentication{Plugin: string($3), Password: string($5)}
  }
| IDENTIFIED WITH STRING BY STRING
  {
    $$ = &Authentication{Plugin: string($3), Password: string($5)}
  }
| IDENTIFIED WITH ID AS STRING
  {
    $$ = &Authentication{Plugin: string($3), Identity: string($5)}
  }
| IDENTIFIED WITH STRING AS STRING
  {
    $$ = &Authentication{Plugin: string($3), Identity: string($5)}
  }

authentication_initial:
  IDENTIFIED BY RANDOM PASSWORD
  {
    $$ = &Authentication{RandomPassword: true}
  }
| IDENTIFIED BY STRING
  {
    $$ = &Authentication{Password: string($3)}
  }
| IDENTIFIED WITH ID AS STRING
  {
    $$ = &Authentication{Plugin: string($3), Identity: string($5)}
  }

account_with_auth_list:
  account_with_auth
  {
    $$ = []AccountWithAuth{$1.(AccountWithAuth)}
  }
| account_with_auth_list ',' account_with_auth
  {
    $$ = append($1.([]AccountWithAuth), $3.(AccountWithAuth))
  }

event_name:
  sql_id
  {
    $$ = EventName{Name: $1.(ColIdent)}
  }
| table_id '.' sql_id
  {
    $$ = EventName{Qualifier: $1.(TableIdent), Name: $3.(ColIdent)}
  }

event_schedule:
  AT timestamp_value event_schedule_intervals_opt
  {
    $$ = &EventScheduleSpec{At: &EventScheduleTimeSpec{EventTimestamp: tryCastExpr($2), EventIntervals: $3.([]IntervalExpr)}}
  }
| EVERY value non_microsecond_time_unit event_starts_opt event_ends_opt
  {
    $$ = &EventScheduleSpec{EveryInterval: IntervalExpr{Expr: tryCastExpr($2), Unit: string($3)}, Starts: $4.(*EventScheduleTimeSpec), Ends: $5.(*EventScheduleTimeSpec)}
  }

event_schedule_intervals_opt:
  {
    $$ = []IntervalExpr{}
  }
| event_schedule_intervals_opt '+' INTERVAL value non_microsecond_time_unit
  {
    $$ = append($1.([]IntervalExpr), IntervalExpr{Expr: tryCastExpr($4), Unit: string($5)})
  }

event_starts_opt:
  {
    $$ = (*EventScheduleTimeSpec)(nil)
  }
| STARTS timestamp_value event_schedule_intervals_opt
  {
    $$ = &EventScheduleTimeSpec{EventTimestamp: tryCastExpr($2), EventIntervals: $3.([]IntervalExpr)}
  }

event_ends_opt:
  {
    $$ = (*EventScheduleTimeSpec)(nil)
  }
| ENDS timestamp_value event_schedule_intervals_opt
  {
    $$ = &EventScheduleTimeSpec{EventTimestamp: tryCastExpr($2), EventIntervals: $3.([]IntervalExpr)}
  }

event_on_completion_preserve_opt:
  {
    $$ = EventOnCompletion_Undefined
  }
| ON COMPLETION PRESERVE
  {
    $$ = EventOnCompletion_Preserve
  }
| ON COMPLETION NOT PRESERVE
  {
    $$ = EventOnCompletion_NotPreserve
  }

event_status_opt:
  {
    $$ = EventStatus_Undefined
  }
| ENABLE
  {
    $$ = EventStatus_Enable
  }
| DISABLE
  {
    $$ = EventStatus_Disable
  }
| DISABLE ON SLAVE
  {
    $$ = EventStatus_DisableOnSlave
  }

comment_keyword_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| COMMENT_KEYWORD STRING
  {
    $$ = NewStrVal($2)
  }

timestamp_value:
  value
  {
    $$ = tryCastExpr($1)
  }
| function_call_nonkeyword
  {
    $$ = tryCastExpr($1)
  }

trigger_time:
  BEFORE
  {
    $$ = BeforeStr
  }
| AFTER
  {
    $$ = AfterStr
  }

trigger_event:
  INSERT
  {
    $$ = InsertStr
  }
| UPDATE
  {
    $$ = UpdateStr
  }
| DELETE
  {
    $$ = DeleteStr
  }

trigger_order_opt:
  {
    $$ = (*TriggerOrder)(nil)
  }
| FOLLOWS ID
  {
    $$ = &TriggerOrder{PrecedesOrFollows: FollowsStr, OtherTriggerName: string($2)}
  }
| PRECEDES ID
  {
    $$ = &TriggerOrder{PrecedesOrFollows: PrecedesStr, OtherTriggerName: string($2)}
  }

trigger_body:
  trigger_begin_end_block
  {
    $$ = tryCastStatement($1)
  }
| set_statement
| call_statement
| insert_statement
| update_statement
| delete_statement

trigger_begin_end_block:
  BEGIN statement_list ';' END
  {
    $$ = &BeginEndBlock{Statements: $2.(Statements)}
  }
| BEGIN END
  {
    $$ = &BeginEndBlock{}
  }

case_statement:
  CASE expression case_statement_case_list END CASE
  {
    $$ = &CaseStatement{Expr: tryCastExpr($2), Cases: $3.([]CaseStatementCase)}
  }
| CASE expression case_statement_case_list ELSE statement_list ';' END CASE
  {
    $$ = &CaseStatement{Expr: tryCastExpr($2), Cases: $3.([]CaseStatementCase), Else: $5.(Statements)}
  }
| CASE case_statement_case_list END CASE
  {
    $$ = &CaseStatement{Expr: nil, Cases: $2.([]CaseStatementCase)}
  }
| CASE case_statement_case_list ELSE statement_list ';' END CASE
  {
    $$ = &CaseStatement{Expr: nil, Cases: $2.([]CaseStatementCase), Else: $4.(Statements)}
  }

case_statement_case_list:
  case_statement_case
  {
    $$ = []CaseStatementCase{$1.(CaseStatementCase)}
  }
| case_statement_case_list case_statement_case
  {
    $$ = append($$.([]CaseStatementCase), $2.(CaseStatementCase))
  }

case_statement_case:
  WHEN expression THEN statement_list ';'
  {
    $$ = CaseStatementCase{Case: tryCastExpr($2), Statements: $4.(Statements)}
  }

if_statement:
  IF expression THEN statement_list ';' END IF
  {
    conds := []IfStatementCondition{IfStatementCondition{Expr: tryCastExpr($2), Statements: $4.(Statements)}}
    $$ = &IfStatement{Conditions: conds}
  }
| IF expression THEN statement_list ';' ELSE statement_list ';' END IF
  {
    conds := []IfStatementCondition{IfStatementCondition{Expr: tryCastExpr($2), Statements: $4.(Statements)}}
    $$ = &IfStatement{Conditions: conds, Else: $7.(Statements)}
  }
| IF expression THEN statement_list ';' elseif_list END IF
  {
    conds := $6.([]IfStatementCondition)
    conds = append([]IfStatementCondition{IfStatementCondition{Expr: tryCastExpr($2), Statements: $4.(Statements)}}, conds...)
    $$ = &IfStatement{Conditions: conds}
  }
| IF expression THEN statement_list ';' elseif_list ELSE statement_list ';' END IF
  {
    conds := $6.([]IfStatementCondition)
    conds = append([]IfStatementCondition{IfStatementCondition{Expr: tryCastExpr($2), Statements: $4.(Statements)}}, conds...)
    $$ = &IfStatement{Conditions: conds, Else: $8.(Statements)}
  }

elseif_list:
  elseif_list_item
  {
    $$ = []IfStatementCondition{$1.(IfStatementCondition)}
  }
| elseif_list elseif_list_item
  {
    $$ = append($$.([]IfStatementCondition), $2.(IfStatementCondition))
  }

elseif_list_item:
  ELSEIF expression THEN statement_list ';'
  {
    $$ = IfStatementCondition{Expr: tryCastExpr($2), Statements: $4.(Statements)}
  }

declare_statement:
  DECLARE ID CONDITION FOR signal_condition_value
  {
    $$ = &Declare{Condition: &DeclareCondition{Name: string($2), SqlStateValue: string($5)}}
  }
| DECLARE ID CONDITION FOR INTEGRAL
  {
    $$ = &Declare{Condition: &DeclareCondition{Name: string($2), MysqlErrorCode: NewIntVal($5)}}
  }
| DECLARE ID CURSOR FOR select_statement_with_no_trailing_into
  {
    $$ = &Declare{Cursor: &DeclareCursor{Name: string($2), SelectStmt: $5.(SelectStatement)}}
  }
| DECLARE declare_handler_action HANDLER FOR declare_handler_condition_list statement_list_statement
  {
    $$ = &Declare{Handler: &DeclareHandler{Action: $2.(DeclareHandlerAction), ConditionValues: $5.([]DeclareHandlerCondition), Statement: tryCastStatement($6)}}
  }
| DECLARE reserved_sql_id_list column_type charset_opt collate_opt
  {
    ct := $3.(ColumnType)
    ct.Charset = $4.(string)
    ct.Collate = $5.(string)
    $$ = &Declare{Variables: &DeclareVariables{Names: $2.([]ColIdent), VarType: ct}}
  }
| DECLARE reserved_sql_id_list column_type charset_opt collate_opt DEFAULT value_expression
  {
    ct := $3.(ColumnType)
    ct.Charset = $4.(string)
    ct.Collate = $5.(string)
    ct.Default = tryCastExpr($7)
    $$ = &Declare{Variables: &DeclareVariables{Names: $2.([]ColIdent), VarType: ct}}
  }

declare_handler_action:
  CONTINUE
  {
    $$ = DeclareHandlerAction_Continue
  }
| EXIT
  {
    $$ = DeclareHandlerAction_Exit
  }
| UNDO
  {
    $$ = DeclareHandlerAction_Undo
  }

declare_handler_condition_list:
  declare_handler_condition
  {
    $$ = []DeclareHandlerCondition{$1.(DeclareHandlerCondition)}
  }
| declare_handler_condition_list ',' declare_handler_condition
  {
    $$ = append($$.([]DeclareHandlerCondition), $3.(DeclareHandlerCondition))
  }

declare_handler_condition:
  INTEGRAL
  {
    $$ = DeclareHandlerCondition{ValueType: DeclareHandlerCondition_MysqlErrorCode, MysqlErrorCode: NewIntVal($1)}
  }
| signal_condition_value
  {
    $$ = DeclareHandlerCondition{ValueType: DeclareHandlerCondition_SqlState, String: string($1)}
  }
| SQLWARNING
  {
    $$ = DeclareHandlerCondition{ValueType: DeclareHandlerCondition_SqlWarning}
  }
| NOT FOUND
  {
    $$ = DeclareHandlerCondition{ValueType: DeclareHandlerCondition_NotFound}
  }
| SQLEXCEPTION
  {
    $$ = DeclareHandlerCondition{ValueType: DeclareHandlerCondition_SqlException}
  }
| ID
  {
    $$ = DeclareHandlerCondition{ValueType: DeclareHandlerCondition_ConditionName, String: string($1)}
  }

open_statement:
  OPEN ID
  {
    $$ = &OpenCursor{Name: string($2)}
  }

close_statement:
  CLOSE ID
  {
    $$ = &CloseCursor{Name: string($2)}
  }

fetch_statement:
  FETCH fetch_next_from_opt ID INTO fetch_variable_list
  {
    $$ = &FetchCursor{Name: string($3), Variables: $5.([]string)}
  }

fetch_next_from_opt:
  {}
| FROM
| NEXT FROM
  {}

fetch_variable_list:
  ID
  {
    $$ = []string{string($1)}
  }
| fetch_variable_list ',' ID
  {
    $$ = append($$.([]string), string($3))
  }

loop_statement:
  LOOP statement_list ';' END LOOP
  {
    $$ = &Loop{Label: "", Statements: $2.(Statements)}
  }
| ID ':' LOOP statement_list ';' END LOOP
  {
    $$ = &Loop{Label: string($1), Statements: $4.(Statements)}
  }
| ID ':' LOOP statement_list ';' END LOOP ID
  {
    label := string($1)
    if label != string($8) {
      yylex.Error("End-label "+string($8)+" without match")
      return 1
    }
    $$ = &Loop{Label: label, Statements: $4.(Statements)}
  }

repeat_statement:
  REPEAT statement_list ';' UNTIL expression END REPEAT
  {
    $$ = &Repeat{Label: "", Statements: $2.(Statements), Condition: tryCastExpr($5)}
  }
| ID ':' REPEAT statement_list ';' UNTIL expression END REPEAT
  {
    $$ = &Repeat{Label: string($1), Statements: $4.(Statements), Condition: tryCastExpr($7)}
  }
| ID ':' REPEAT statement_list ';' UNTIL expression END REPEAT ID
  {
    label := string($1)
    if label != string($10) {
      yylex.Error("End-label "+string($10)+" without match")
      return 1
    }
    $$ = &Repeat{Label: label, Statements: $4.(Statements), Condition: tryCastExpr($7)}
  }

while_statement:
  WHILE expression DO statement_list ';' END WHILE
  {
    $$ = &While{Label: "", Condition: tryCastExpr($2), Statements: $4.(Statements)}
  }
| ID ':' WHILE expression DO statement_list ';' END WHILE
  {
    $$ = &While{Label: string($1), Condition: tryCastExpr($4), Statements: $6.(Statements)}
  }
| ID ':' WHILE expression DO statement_list ';' END WHILE ID
  {
    label := string($1)
    if label != string($10) {
      yylex.Error("End-label "+string($10)+" without match")
      return 1
    }
    $$ = &While{Label: label, Condition: tryCastExpr($4), Statements: $6.(Statements)}
  }

leave_statement:
  LEAVE ID
  {
    $$ = &Leave{Label: string($2)}
  }

iterate_statement:
  ITERATE ID
  {
    $$ = &Iterate{Label: string($2)}
  }

return_statement:
  RETURN value_expression
  {
    $$ = &Return{Expr: tryCastExpr($2)}
  }

signal_statement:
  SIGNAL signal_condition_value
  {
    $$ = &Signal{SqlStateValue: string($2)}
  }
| SIGNAL signal_condition_value SET signal_information_item_list
  {
    $$ = &Signal{SqlStateValue: string($2), Info: $4.([]SignalInfo)}
  }
| SIGNAL ID
  {
    $$ = &Signal{ConditionName: string($2)}
  }
| SIGNAL ID SET signal_information_item_list
  {
    $$ = &Signal{ConditionName: string($2), Info: $4.([]SignalInfo)}
  }

signal_condition_value:
  SQLSTATE STRING
  {
    $$ = $2
  }
| SQLSTATE VALUE STRING
  {
    $$ = $3
  }

signal_information_item_list:
  signal_information_item
  {
    $$ = []SignalInfo{$1.(SignalInfo)}
  }
| signal_information_item_list ',' signal_information_item
  {
    $$ = append($$.([]SignalInfo), $3.(SignalInfo))
  }

signal_information_item:
  signal_information_name '=' value
  {
    $$ = SignalInfo{ConditionItemName: $1.(SignalConditionItemName), Value: tryCastExpr($3).(*SQLVal)}
  }
| signal_information_name '=' sql_id
  {
    $$ = SignalInfo{ConditionItemName: $1.(SignalConditionItemName), Value: &ColName{Name: $3.(ColIdent)}}
  }

signal_information_name:
  CLASS_ORIGIN
  {
    $$ = SignalConditionItemName_ClassOrigin
  }
| SUBCLASS_ORIGIN
  {
    $$ = SignalConditionItemName_SubclassOrigin
  }
| MESSAGE_TEXT
  {
    $$ = SignalConditionItemName_MessageText
  }
| MYSQL_ERRNO
  {
    $$ = SignalConditionItemName_MysqlErrno
  }
| CONSTRAINT_CATALOG
  {
    $$ = SignalConditionItemName_ConstraintCatalog
  }
| CONSTRAINT_SCHEMA
  {
    $$ = SignalConditionItemName_ConstraintSchema
  }
| CONSTRAINT_NAME
  {
    $$ = SignalConditionItemName_ConstraintName
  }
| CATALOG_NAME
  {
    $$ = SignalConditionItemName_CatalogName
  }
| SCHEMA_NAME
  {
    $$ = SignalConditionItemName_SchemaName
  }
| TABLE_NAME
  {
    $$ = SignalConditionItemName_TableName
  }
| COLUMN_NAME
  {
    $$ = SignalConditionItemName_ColumnName
  }
| CURSOR_NAME
  {
    $$ = SignalConditionItemName_CursorName
  }

resignal_statement:
  RESIGNAL
  {
    $$ = &Resignal{}
  }
| RESIGNAL signal_condition_value
  {
    $$ = &Resignal{Signal{SqlStateValue: string($2)}}
  }
| RESIGNAL signal_condition_value SET signal_information_item_list
  {
    $$ = &Resignal{Signal{SqlStateValue: string($2), Info: $4.([]SignalInfo)}}
  }
| RESIGNAL SET signal_information_item_list
  {
    $$ = &Resignal{Signal{Info: $3.([]SignalInfo)}}
  }
| RESIGNAL ID
  {
    $$ = &Resignal{Signal{ConditionName: string($2)}}
  }
| RESIGNAL ID SET signal_information_item_list
  {
    $$ = &Resignal{Signal{ConditionName: string($2), Info: $4.([]SignalInfo)}}
  }

call_statement:
  CALL procedure_name call_param_list_opt as_of_opt
  {
    procName := $2.(ProcedureName)
    exprs := $3.(Exprs)
    $$ = &Call{
      ProcName: procName,
      Params: exprs,
      AsOf: tryCastExpr($4),
      Auth: AuthInformation{
        AuthType: AuthType_CALL,
        TargetType: AuthTargetType_Ignore,
        TargetNames: []string{procName.Qualifier.String(), procName.Name.String(), fmt.Sprintf("%d", len(exprs))},
      },
    }
  }

call_param_list_opt:
  {
    $$ = Exprs(nil)
  }
| '(' ')'
  {
    $$ = Exprs(nil)
  }
| '(' expression_list ')'
  {
    $$ = $2.(Exprs)
  }

statement_list:
  statement_list_statement
  {
    $$ = Statements{tryCastStatement($1)}
  }
| statement_list ';' statement_list_statement
  {
    $$ = append($$.(Statements), tryCastStatement($3))
  }

statement_list_statement:
  select_statement
  {
    $$ = $1.(SelectStatement)
  }
| insert_statement
| update_statement
| delete_statement
| set_statement
| create_statement
| alter_statement
| rename_statement
| drop_statement
| case_statement
| if_statement
| truncate_statement
| analyze_statement
| prepare_statement
| execute_statement
| deallocate_statement
| show_statement
| start_transaction_statement
| commit_statement
| rollback_statement
| explain_statement
| describe_statement
| declare_statement
| open_statement
| close_statement
| loop_statement
| repeat_statement
| while_statement
| leave_statement
| iterate_statement
| fetch_statement
| signal_statement
| resignal_statement
| return_statement
| call_statement
| savepoint_statement
| rollback_savepoint_statement
| release_savepoint_statement
| grant_statement
| revoke_statement
| begin_end_block
| flush_statement
| purge_binary_logs_statement

create_table_prefix:
  CREATE temp_opt TABLE not_exists_opt table_name
  {
    var temp bool
    authType := AuthType_CREATE
    if $2.(int) != 0 {
      temp = true
      authType = AuthType_CREATE_TEMP
    }

    var ne bool
    if $4.(int) != 0 {
      ne = true
    }

    tableName := $5.(TableName)
    $$ = &DDL{
      Action: CreateStr,
      Table: tableName,
      IfNotExists: ne,
      Temporary: temp,
      Auth: AuthInformation{
        AuthType: authType,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{tableName.DbQualifier.String()},
      },
    }
  }
| CREATE temp_opt TABLE not_exists_opt FORMAT
  {
    authType := AuthType_CREATE
    var temp bool
    if $2.(int) != 0 {
      temp = true
      authType = AuthType_CREATE_TEMP
    }

    var ne bool
    if $4.(int) != 0 {
      ne = true
    }

    $$ = &DDL{
      Action: CreateStr,
      Table: TableName{
        Name: NewTableIdent(string($5)),
      },
      IfNotExists: ne,
      Temporary: temp,
      Auth: AuthInformation{
        AuthType: authType,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{""},
      },
    }
  }

table_spec:
  '(' table_column_list ')' table_option_list partition_option_opt
  {
    $$ = $2.(*TableSpec)
    for _, opt := range $4.([]*TableOption) {
      $$.(*TableSpec).AddTableOption(opt)
    }
    $$.(*TableSpec).PartitionOpt = $5.(*PartitionOption)
  }

table_column_list:
  column_definition_for_create
  {
    $$ = &TableSpec{}
    $$.(*TableSpec).AddColumn($1.(*ColumnDefinition))
  }
| check_constraint_definition
  {
    $$ = &TableSpec{}
    $$.(*TableSpec).AddConstraint($1.(*ConstraintDefinition))
  }
| table_column_list ',' column_definition_for_create
  {
    $$.(*TableSpec).AddColumn($3.(*ColumnDefinition))
  }
| table_column_list ',' index_definition
  {
    $$.(*TableSpec).AddIndex($3.(*IndexDefinition))
  }
| table_column_list ',' foreign_key_definition
  {
    $$.(*TableSpec).AddConstraint($3.(*ConstraintDefinition))
  }
| table_column_list ',' check_constraint_definition
  {
    $$.(*TableSpec).AddConstraint($3.(*ConstraintDefinition))
  }

column_definition:
  ID column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }
| all_non_reserved column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }

column_definition_for_create:
  sql_id column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: $1.(ColIdent), Type: *ctp}
  }
| column_name_safe_keyword column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }
| non_reserved_keyword2 column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }
| non_reserved_keyword3 column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }
| ESCAPE column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }
| function_call_keywords column_type column_type_options
  {
    ct1 := $2.(ColumnType)
    ct2 := $3.(ColumnType)
    ctp := &ct1
    if err := ctp.merge(ct2); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &ColumnDefinition{Name: NewColIdent(string($1)), Type: *ctp}
  }

stored_opt:
  {
    $$ = BoolVal(false)
  }
| VIRTUAL
  {
    $$ = BoolVal(false)
  }
| STORED
  {
    $$ = BoolVal(true)
  }

column_type_options:
  {
    $$ = ColumnType{}
  }
| column_type_options INVISIBLE
  {
    $$ = $1.(ColumnType)
  }
| column_type_options NULL
  {
    opt := ColumnType{Null: BoolVal(true), NotNull: BoolVal(false), sawnull: true}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options NOT NULL
  {
    opt := ColumnType{Null: BoolVal(false), NotNull: BoolVal(true), sawnull: true}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options character_set
  {
    opt := ColumnType{Charset: $2.(string)}
    ct := $1.(ColumnType)
    if err := ct.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = ct
  }
| column_type_options collate
  {
    opt := ColumnType{Collate: $2.(string)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options BINARY
  {
    opt := ColumnType{BinaryCollate: true}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options column_default
  {
    opt := ColumnType{Default: tryCastExpr($2)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options on_update
  {
    opt := ColumnType{OnUpdate: tryCastExpr($2)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options auto_increment
  {
    opt := ColumnType{Autoincrement: $2.(BoolVal), sawai: true}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options column_key
  {
    opt := ColumnType{KeyOpt: $2.(ColumnKeyOption)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options column_comment
  {
    opt := ColumnType{Comment: $2.(*SQLVal)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options AS openb value_expression closeb stored_opt
  {
    opt := ColumnType{GeneratedExpr: &ParenExpr{tryCastExpr($4)}, Stored: $6.(BoolVal)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options GENERATED ALWAYS AS openb value_expression closeb stored_opt
  {
    opt := ColumnType{GeneratedExpr: &ParenExpr{tryCastExpr($6)}, Stored: $8.(BoolVal)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options SRID INTEGRAL
  {
    opt := ColumnType{SRID: NewIntVal($3)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options REFERENCES table_name '(' column_list ')'
  // TODO: This still needs support for "ON DELETE" and "ON UPDATE"
  {
    opt := ColumnType{ForeignKeyDef: &ForeignKeyDefinition{ReferencedTable: $3.(TableName), ReferencedColumns: $5.(Columns)}}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }
| column_type_options check_constraint_definition
  {
    opt := ColumnType{Constraint: $2.(*ConstraintDefinition)}
    ct := $1.(ColumnType)
    ctp := &ct
    if err := ctp.merge(opt); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = *ctp
  }

column_type:
  numeric_type signed_or_unsigned_opt zero_fill_opt
  {
    ct := $1.(ColumnType)
    ct.Unsigned = $2.(BoolVal)
    ct.Zerofill = $3.(BoolVal)
    $$ = ct
  }
| char_type
| time_type
| spatial_type

numeric_type:
  int_type length_opt
  {
    ct := $1.(ColumnType)
    ct.Length = $2.(*SQLVal)
    $$ = ct
  }
| decimal_type
  {
    $$ = $1.(ColumnType)
  }

int_type:
  BIT
  {
    $$ = ColumnType{Type: string($1)}
  }
| BOOL
  {
    $$ = ColumnType{Type: string($1)}
  }
| BOOLEAN
  {
    $$ = ColumnType{Type: string($1)}
  }
| TINYINT
  {
    $$ = ColumnType{Type: string($1)}
  }
| SMALLINT
  {
    $$ = ColumnType{Type: string($1)}
  }
| MEDIUMINT
  {
    $$ = ColumnType{Type: string($1)}
  }
| INT
  {
    $$ = ColumnType{Type: string($1)}
  }
| INTEGER
  {
    $$ = ColumnType{Type: string($1)}
  }
| BIGINT
  {
    $$ = ColumnType{Type: string($1)}
  }
| SERIAL
  {
    $$ = ColumnType{Type: "bigint", Unsigned: true, NotNull: true, Autoincrement: true, KeyOpt: colKeyUnique}
  }
| INT1
  {
    $$ = ColumnType{Type: "tinyint"}
  }
| INT2
  {
    $$ = ColumnType{Type: "smallint"}
  }
| INT3
  {
    $$ = ColumnType{Type: "mediumint"}
  }
| INT4
  {
    $$ = ColumnType{Type: "int"}
  }
| INT8
  {
    $$ = ColumnType{Type: "bigint"}
  }

decimal_type:
REAL float_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| DOUBLE float_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| DOUBLE PRECISION float_length_opt
  {
    ct := ColumnType{Type: string($1) + " " + string($2)}
    ct.Length = $3.(LengthScaleOption).Length
    ct.Scale = $3.(LengthScaleOption).Scale
    $$ = ct
  }
| FLOAT_TYPE decimal_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| DECIMAL decimal_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| NUMERIC decimal_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| DEC decimal_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| FIXED decimal_length_opt
  {
    ct := ColumnType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }

time_type:
  DATE
  {
    $$ = ColumnType{Type: string($1)}
  }
| TIME length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| TIMESTAMP length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| DATETIME length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| YEAR
  {
    $$ = ColumnType{Type: string($1)}
  }

char_type:
  char_or_character char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| NATIONAL char_or_character char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2), Length: $3.(*SQLVal)}
  }
| NCHAR char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| NCHAR VARCHAR char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2), Length: $3.(*SQLVal)}
  }
| NCHAR VARYING char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2), Length: $3.(*SQLVal)}
  }
| VARCHAR char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| CHAR VARYING char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2), Length: $3.(*SQLVal)}
  }
| CHARACTER VARYING char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2), Length: $3.(*SQLVal)}
  }
| NVARCHAR char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| NATIONAL VARCHAR char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2), Length: $3.(*SQLVal)}
  }
| NATIONAL char_or_character VARYING char_length_opt
  {
    $$ = ColumnType{Type: string($1) + " " + string($2) + " " + string($3), Length: $4.(*SQLVal)}
  }
| BINARY char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| VARBINARY char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| TEXT char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| TINYTEXT
  {
    $$ = ColumnType{Type: string($1)}
  }
| MEDIUMTEXT
  {
    $$ = ColumnType{Type: string($1)}
  }
| LONGTEXT
  {
    $$ = ColumnType{Type: string($1)}
  }
| LONG
  {
    $$ = ColumnType{Type: string($1)}
  }
| LONG VARCHAR
  {
    $$ = ColumnType{Type: string($1) + " " + string($2)}
  }
| BLOB
  {
    $$ = ColumnType{Type: string($1)}
  }
| TINYBLOB
  {
    $$ = ColumnType{Type: string($1)}
  }
| MEDIUMBLOB
  {
    $$ = ColumnType{Type: string($1)}
  }
| LONGBLOB
  {
    $$ = ColumnType{Type: string($1)}
  }
| JSON
  {
    $$ = ColumnType{Type: string($1)}
  }
| ENUM '(' enum_values ')'
  {
    $$ = ColumnType{Type: string($1), EnumValues: $3.([]string)}
  }
// need set_values / SetValues ?
| SET '(' enum_values ')'
  {
    $$ = ColumnType{Type: string($1), EnumValues: $3.([]string)}
  }

spatial_type:
  GEOMETRY
  {
    $$ = ColumnType{Type: string($1)}
  }
| POINT
  {
    $$ = ColumnType{Type: string($1)}
  }
| LINESTRING
  {
    $$ = ColumnType{Type: string($1)}
  }
| POLYGON
  {
    $$ = ColumnType{Type: string($1)}
  }
| GEOMETRYCOLLECTION
  {
    $$ = ColumnType{Type: string($1)}
  }
| VECTOR char_length_opt
  {
    $$ = ColumnType{Type: string($1), Length: $2.(*SQLVal)}
  }
| MULTIPOINT
  {
    $$ = ColumnType{Type: string($1)}
  }
| MULTILINESTRING
  {
    $$ = ColumnType{Type: string($1)}
  }
| MULTIPOLYGON
  {
    $$ = ColumnType{Type: string($1)}
  }

enum_values:
  STRING
  {
    $$ = make([]string, 0, 4)
    $$ = append($$.([]string), string($1))
  }
| enum_values ',' STRING
  {
    $$ = append($1.([]string), string($3))
  }

length_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| '(' INTEGRAL ')'
  {
    $$ = NewIntVal($2)
  }

char_length_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| '(' INTEGRAL ')'
  {
    $$ = NewIntVal($2)
  }
| '(' MAX ')'
  {
    $$ = NewValArg($2)
  }

float_length_opt:
  {
    $$ = LengthScaleOption{}
  }
| '(' INTEGRAL ',' INTEGRAL ')'
  {
    $$ = LengthScaleOption{
        Length: NewIntVal($2),
        Scale: NewIntVal($4),
    }
  }

decimal_length_opt:
  {
    $$ = LengthScaleOption{}
  }
| '(' INTEGRAL ')'
  {
    $$ = LengthScaleOption{
        Length: NewIntVal($2),
    }
  }
| '(' INTEGRAL ',' INTEGRAL ')'
  {
    $$ = LengthScaleOption{
        Length: NewIntVal($2),
        Scale: NewIntVal($4),
    }
  }

signed_or_unsigned_opt:
  {
    $$ = BoolVal(false)
  }
| SIGNED
  {
   $$ = BoolVal(false)
  }
| UNSIGNED
  {
    $$ = BoolVal(true)
  }

zero_fill_opt:
  {
    $$ = BoolVal(false)
  }
| ZEROFILL
  {
    $$ = BoolVal(true)
  }

column_default:
  DEFAULT value
  {
    $$ = tryCastExpr($2)
  }
| DEFAULT '-' value
  {
    if num, ok := tryCastExpr($3).(*SQLVal); ok && num.Type == IntVal {
      // Handle double negative
      if num.Val[0] == '-' {
        num.Val = num.Val[1:]
        $$ = num
      } else {
        $$ = NewIntVal(append([]byte("-"), num.Val...))
      }
    } else {
      $$ = &UnaryExpr{Operator: UMinusStr, Expr: tryCastExpr($3)}
    }
  }
| DEFAULT underscore_charsets STRING
  {
    $$ = &UnaryExpr{Operator: $2.(string), Expr: NewStrVal($3)}
  }
| DEFAULT boolean_value
  {
    $$ = $2.(BoolVal)
  }
| DEFAULT function_call_nonkeyword
  {
    $$ = tryCastExpr($2)
  }
| DEFAULT openb value_expression closeb
  {
    $$ = &ParenExpr{tryCastExpr($3)}
  }

on_update:
  ON UPDATE function_call_on_update
  {
    $$ = tryCastExpr($3)
  }

auto_increment:
  AUTO_INCREMENT
  {
    $$ = BoolVal(true)
  }

charset_opt:
  {
    $$ = ""
  }
| character_set
  {
    $$ = $1.(string)
  }

character_set:
  CHARACTER SET ID
  {
    $$ = string($3)
  }
| CHARACTER SET BINARY
  {
    $$ = string($3)
  }
| CHARACTER SET STRING
  {
    $$ = string($3)
  }
| CHARSET ID
  {
    $$ = string($2)
  }
| CHARSET BINARY
  {
    $$ = string($2)
  }
| CHARSET STRING
  {
    $$ = string($2)
  }


collate_opt:
  {
    $$ = ""
  }
| collate
  {
    $$ = $1.(string)
  }

collate:
  COLLATE ID
  {
    $$ = string($2)
  }
| COLLATE STRING
  {
    $$ = string($2)
  }
| COLLATE BINARY
  {
    $$ = string($2)
  }

default_keyword_opt:
  {
    $$ = false
  }
| DEFAULT
  {
    $$ = true
  }

creation_option_opt:
  {
    $$ = []*CharsetAndCollate(nil)
  }
| creation_option
  {
    $$ = $1.([]*CharsetAndCollate)
  }

creation_option:
  charset_default_opt
  {
    $$ = []*CharsetAndCollate{$1.(*CharsetAndCollate)}
  }
| collate_default_opt
  {
    $$ = []*CharsetAndCollate{$1.(*CharsetAndCollate)}
  }
| encryption_default_opt
  {
    $$ = []*CharsetAndCollate{$1.(*CharsetAndCollate)}
  }
| creation_option collate_default_opt
  {
    $$ = append($1.([]*CharsetAndCollate),$2.(*CharsetAndCollate))
  }
| creation_option charset_default_opt
  {
    $$ = append($1.([]*CharsetAndCollate),$2.(*CharsetAndCollate))
  }
| creation_option encryption_default_opt
  {
    $$ = append($1.([]*CharsetAndCollate),$2.(*CharsetAndCollate))
  }

charset_default_opt:
  default_keyword_opt CHARACTER SET equal_opt ID
  {
    $$ = &CharsetAndCollate{Type: string($2) + " " + string($3), Value: string($5), IsDefault: $1.(bool)}
  }
| default_keyword_opt CHARACTER SET equal_opt STRING
  {
    $$ = &CharsetAndCollate{Type: string($2) + " " + string($3), Value: string($5), IsDefault: $1.(bool)}
  }
| default_keyword_opt CHARACTER SET equal_opt BINARY
  {
    $$ = &CharsetAndCollate{Type: string($2) + " " + string($3), Value: string($5), IsDefault: $1.(bool)}
  }
| default_keyword_opt CHARSET equal_opt ID
  {
    $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
  }
| default_keyword_opt CHARSET equal_opt STRING
  {
    $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
  }
| default_keyword_opt CHARSET equal_opt BINARY
  {
    $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
  }

collate_default_opt:
  default_keyword_opt COLLATE equal_opt ID
  {
    $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
  }
| default_keyword_opt COLLATE equal_opt STRING
    {
      $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
    }
| default_keyword_opt COLLATE equal_opt BINARY
  {
    $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
  }

encryption_default_opt:
  default_keyword_opt ENCRYPTION equal_opt STRING
  {
    $$ = &CharsetAndCollate{Type: string($2), Value: string($4), IsDefault: $1.(bool)}
  }

column_key:
  PRIMARY KEY
  {
    $$ = colKeyPrimary
  }
| KEY
  {
    $$ = colKey
  }
| UNIQUE KEY
  {
    $$ = colKeyUniqueKey
  }
| UNIQUE
  {
    $$ = colKeyUnique
  }
| FULLTEXT KEY
  {
    $$ = colKeyFulltextKey
  }

column_comment:
  COMMENT_KEYWORD STRING
  {
    $$ = NewStrVal($2)
  }

purge_binary_logs_statement:
  PURGE BINARY LOGS TO STRING
  {
    $$ = &PurgeBinaryLogs{To: string($5)}
  }
| PURGE BINARY LOGS BEFORE value_expression
  {
    $$ = &PurgeBinaryLogs{Before: tryCastExpr($5)}
  }

flush_statement:
  FLUSH flush_type_opt flush_option
  {
    $$ = &Flush{
      Type: $2.(string),
      Option: $3.(*FlushOption),
      Auth: AuthInformation{
        AuthType: AuthType_RELOAD,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{"mysql"},
      },
    }
  }

flush_option:
  BINARY LOGS
  {
    $$ = &FlushOption{Name: string($1) + " " +  string($2)}
  }
| ENGINE LOGS
  {
    $$ = &FlushOption{Name: string($1) + " " +  string($2)}
  }
| ERROR LOGS
  {
    $$ = &FlushOption{Name: string($1) + " " +  string($2)}
  }
| GENERAL LOGS
  {
    $$ = &FlushOption{Name: string($1) + " " +  string($2)}
  }
| HOSTS
  {
    $$ = &FlushOption{Name: string($1)}
  }
| LOGS
  {
    $$ = &FlushOption{Name: string($1)}
  }
| PRIVILEGES
  {
    $$ = &FlushOption{Name: string($1)}
  }
| OPTIMIZER_COSTS
  {
    $$ = &FlushOption{Name: string($1)}
  }
| RELAY LOGS relay_logs_attribute
  {
    $$ = &FlushOption{Name: string($1) + " " +  string($2), Channel: $3.(string)}
  }
| SLOW LOGS
  {
    $$ = &FlushOption{Name: string($1) + " " +  string($2)}
  }
| STATUS
  {
    $$ = &FlushOption{Name: string($1)}
  }
| USER_RESOURCES
  {
    $$ = &FlushOption{Name: string($1)}
  }
| TABLE flush_tables_read_lock_opt
  {
    $$ = &FlushOption{Name: string($1), ReadLock: $2.(bool)}
  }
| TABLES flush_tables_read_lock_opt
  {
    $$ = &FlushOption{Name: string($1), ReadLock: $2.(bool)}
  }
| TABLE table_name_list flush_tables_read_lock_opt
  {
    $$ = &FlushOption{Name: string($1), Tables: $2.(TableNames), ReadLock: $3.(bool)}
  }
| TABLES table_name_list flush_tables_read_lock_opt
  {
    $$ = &FlushOption{Name: string($1), Tables: $2.(TableNames), ReadLock: $3.(bool)}
  }

flush_tables_read_lock_opt:
  {$$ = false}
| WITH READ LOCK
  {$$ = true}

relay_logs_attribute:
  { $$ = "" }
| FOR CHANNEL STRING
  { $$ = string($3) }

flush_type:
  NO_WRITE_TO_BINLOG
  { $$ = string($1) }
| LOCAL
  { $$ = string($1) }

flush_type_opt:
  { $$ = "" }
| flush_type
  { $$ = $1.(string) }

replication_statement:
  CHANGE REPLICATION SOURCE TO replication_option_list
  {
    $$ = &ChangeReplicationSource{
      Options: $5.([]*ReplicationOption),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| CHANGE REPLICATION FILTER replication_filter_option_list
  {
    $$ = &ChangeReplicationFilter{
      Options: $4.([]*ReplicationOption),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| START REPLICA
  {
    $$ = &StartReplica{
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| STOP REPLICA thread_type_opt
  {
    $$ = &StopReplica{
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| RESET REPLICA all_opt
  {
    $$ = &ResetReplica{
      All: $3.(bool),
      Auth: AuthInformation{
        AuthType: AuthType_RELOAD,
        TargetType: AuthTargetType_Global,
      },
    }
  }

all_opt:
  { $$ = false }
| ALL
  { $$ = true }

thread_type_opt:
  {
    $$ = nil
  }
| IO_THREAD
  {
    $$ = $1
  }
| SQL_THREAD
  {
    $$ = $1
  }

replication_option_list:
  replication_option
  {
    $$ = []*ReplicationOption{$1.(*ReplicationOption)}
  }
| replication_option_list ',' replication_option
 {
   $$ = append($$.([]*ReplicationOption), $3.(*ReplicationOption))
 }

replication_option:
  SOURCE_HOST '=' STRING
  {
    $$ = &ReplicationOption{Name: string($1), Value: string($3)}
  }
| SOURCE_USER '=' STRING
  {
    $$ = &ReplicationOption{Name: string($1), Value: string($3)}
  }
| SOURCE_PASSWORD '=' STRING
  {
    $$ = &ReplicationOption{Name: string($1), Value: string($3)}
  }
| SOURCE_SSL '=' INTEGRAL
  {
    $$ = &ReplicationOption{Name: string($1), Value: mustAtoi(yylex, string($3))}
  }
| SOURCE_PORT '=' INTEGRAL
  {
    $$ = &ReplicationOption{Name: string($1), Value: mustAtoi(yylex, string($3))}
  }
| SOURCE_CONNECT_RETRY '=' INTEGRAL
  {
    $$ = &ReplicationOption{Name: string($1), Value: mustAtoi(yylex, string($3))}
  }
| SOURCE_RETRY_COUNT '=' INTEGRAL
  {
    $$ = &ReplicationOption{Name: string($1), Value: mustAtoi(yylex, string($3))}
  }
| SOURCE_AUTO_POSITION '=' INTEGRAL
  {
    $$ = &ReplicationOption{Name: string($1), Value: mustAtoi(yylex, string($3))}
  }

replication_filter_option_list:
  replication_filter_option
  {
    $$ = []*ReplicationOption{$1.(*ReplicationOption)}
  }
| replication_filter_option_list ',' replication_filter_option
 {
   $$ = append($$.([]*ReplicationOption), $3.(*ReplicationOption))
 }

replication_filter_option:
  REPLICATE_DO_TABLE '=' '(' table_name_list ')'
  {
    $$ = &ReplicationOption{Name: string($1), Value: $4.(TableNames)}
  }
| REPLICATE_IGNORE_TABLE '=' '(' table_name_list ')'
  {
    $$ = &ReplicationOption{Name: string($1), Value: $4.(TableNames)}
  }

index_definition:
  index_info '(' index_column_list ')' index_option_list
  {
    $$ = &IndexDefinition{Info: $1.(*IndexInfo), Columns: $3.([]*IndexColumn), Options: $5.([]*IndexOption)}
  }
| index_info '(' index_column_list ')'
  {
    $$ = &IndexDefinition{Info: $1.(*IndexInfo), Columns: $3.([]*IndexColumn)}
  }

index_option_list_opt:
  {
    $$ = []*IndexOption(nil)
  }
| index_option_list
  {
    $$ = $1.([]*IndexOption)
  }

index_option_list:
  index_option
  {
    $$ = []*IndexOption{$1.(*IndexOption)}
  }
| index_option_list index_option
  {
    $$ = append($$.([]*IndexOption), $2.(*IndexOption))
  }

index_option:
  USING any_identifier // TODO: should be restricted
  {
    $$ = &IndexOption{Name: string($1), Using: string($2)}
  }
| KEY_BLOCK_SIZE equal_opt INTEGRAL
  {
    // should not be string
    $$ = &IndexOption{Name: string($1), Value: NewIntVal($3)}
  }
| COMMENT_KEYWORD STRING
  {
    $$ = &IndexOption{Name: string($1), Value: NewStrVal($2)}
  }
| ENGINE_ATTRIBUTE equal_opt STRING
  {
    $$ = &IndexOption{Name: string($1), Value: NewStrVal($3)}
  }
| SECONDARY_ENGINE_ATTRIBUTE equal_opt STRING
  {
    $$ = &IndexOption{Name: string($1), Value: NewStrVal($3)}
  }
| VISIBLE
  {
    $$ = &IndexOption{Name: string($1), Value: nil}
  }
| INVISIBLE
  {
    $$ = &IndexOption{Name: string($1), Value: nil}
  }

equal_opt:
  /* empty */
  {
    $$ = ""
  }
| assignment_op
  {
    $$ = string($1.(string))
  }

assignment_op:
  '='
  {
    $$ = string($1)
  }
| ASSIGNMENT_OP
  {
    $$ = ":="
  }

index_info:
  // A name may be specified for a primary key, but it is ignored since the primary
  // key is always named 'PRIMARY'
  PRIMARY KEY name_opt
  {
    $$ = &IndexInfo{Type: string($1) + " " + string($2), Name: NewColIdent("PRIMARY"), Primary: true, Unique: true}
  }
| CONSTRAINT name_opt PRIMARY KEY name_opt
  {
    $$ = &IndexInfo{Type: string($3) + " " + string($4), Name: NewColIdent("PRIMARY"), Primary: true, Unique: true}
  }
| SPATIAL index_or_key name_opt
  {
    $$ = &IndexInfo{Type: string($1) + " " + string($2.(string)), Name: NewColIdent($3.(string)), Spatial: true, Unique: false}
  }
| FULLTEXT index_or_key_opt name_opt
  {
    $$ = &IndexInfo{Type: string($1) + " " + string($2.(string)), Name: NewColIdent($3.(string)), Fulltext: true}
  }
| VECTOR index_or_key name_opt
  {
    $$ = &IndexInfo{Type: string($1) + " " + string($2.(string)), Name: NewColIdent($3.(string)), Vector: true}
  }
| CONSTRAINT name_opt UNIQUE index_or_key_opt name_opt
  {
    var name string
    name = $2.(string)
    if name == "" {
      name = $5.(string)
    }
    $$ = &IndexInfo{Type: string($3) + " " + string($4.(string)), Name: NewColIdent(name), Unique: true}
  }
| UNIQUE index_or_key name_opt
  {
    $$ = &IndexInfo{Type: string($1) + " " + string($2.(string)), Name: NewColIdent($3.(string)), Unique: true}
  }
| UNIQUE name_opt
  {
    $$ = &IndexInfo{Type: string($1), Name: NewColIdent($2.(string)), Unique: true}
  }
| index_or_key name_opt
  {
    $$ = &IndexInfo{Type: string($1.(string)), Name: NewColIdent($2.(string)), Unique: false}
  }

indexes_or_keys:
  INDEX
  {
    $$ = string($1)
  }
| INDEXES
  {
    $$ = string($1)
  }
| KEYS
  {
    $$ = string($1)
  }

index_or_key:
  INDEX
  {
    $$ = string($1)
  }
| KEY
  {
    $$ = string($1)
  }

index_or_key_opt:
  {
    $$ = ""
  }
| index_or_key
  {
    $$ = $1.(string)
  }

name_opt:
  {
    $$ = ""
  }
| ID
  {
    $$ = string($1)
  }
| non_reserved_keyword
  {
    $$ = string($1)
  }

index_column_list:
  index_column
  {
    $$ = []*IndexColumn{$1.(*IndexColumn)}
  }
| index_column_list ',' index_column
  {
    $$ = append($$.([]*IndexColumn), $3.(*IndexColumn))
  }

index_column:
  ID length_opt asc_desc_opt
  {
      $$ = &IndexColumn{Column: NewColIdent(string($1)), Length: $2.(*SQLVal), Order: $3.(string)}
  }
| all_non_reserved length_opt asc_desc_opt
  {
      $$ = &IndexColumn{Column: NewColIdent(string($1)), Length: $2.(*SQLVal), Order: $3.(string)}
  }

foreign_key_definition:
  CONSTRAINT id_or_non_reserved foreign_key_details
  {
    $$ = &ConstraintDefinition{Name: string($2), Details: $3.(ConstraintInfo)}
  }
| CONSTRAINT foreign_key_details
  {
    $$ = &ConstraintDefinition{Details: $2.(ConstraintInfo)}
  }
| foreign_key_details
  {
    $$ = &ConstraintDefinition{Details: $1.(ConstraintInfo)}
  }

foreign_key_details:
  FOREIGN KEY index_name_opt '(' column_list ')' REFERENCES table_name '(' column_list ')'
  {
    $$ = &ForeignKeyDefinition{Source: $5.(Columns), ReferencedTable: $8.(TableName), ReferencedColumns: $10.(Columns), Index: string($3)}
  }
| FOREIGN KEY index_name_opt '(' column_list ')' REFERENCES table_name '(' column_list ')' fk_on_delete
  {
    $$ = &ForeignKeyDefinition{Source: $5.(Columns), ReferencedTable: $8.(TableName), ReferencedColumns: $10.(Columns), OnDelete: $12.(ReferenceAction), Index: string($3)}
  }
| FOREIGN KEY index_name_opt '(' column_list ')' REFERENCES table_name '(' column_list ')' fk_on_update
  {
    $$ = &ForeignKeyDefinition{Source: $5.(Columns), ReferencedTable: $8.(TableName), ReferencedColumns: $10.(Columns), OnUpdate: $12.(ReferenceAction), Index: string($3)}
  }
| FOREIGN KEY index_name_opt '(' column_list ')' REFERENCES table_name '(' column_list ')' fk_on_delete fk_on_update
  {
    $$ = &ForeignKeyDefinition{Source: $5.(Columns), ReferencedTable: $8.(TableName), ReferencedColumns: $10.(Columns), OnDelete: $12.(ReferenceAction), OnUpdate: $13.(ReferenceAction), Index: string($3)}
  }
| FOREIGN KEY index_name_opt '(' column_list ')' REFERENCES table_name '(' column_list ')' fk_on_update fk_on_delete
  {
    $$ = &ForeignKeyDefinition{Source: $5.(Columns), ReferencedTable: $8.(TableName), ReferencedColumns: $10.(Columns), OnDelete: $13.(ReferenceAction), OnUpdate: $12.(ReferenceAction), Index: string($3)}
  }

index_name_opt:
  {
    $$ = []byte(nil)
  }
| id_or_non_reserved
  {
    $$ = $1
  }

check_constraint_definition:
  CONSTRAINT id_or_non_reserved check_constraint_info
  {
    $$ = &ConstraintDefinition{Name: string($2), Details: $3.(ConstraintInfo)}
  }
| CONSTRAINT check_constraint_info
  {
    $$ = &ConstraintDefinition{Details: $2.(ConstraintInfo)}
  }
|  check_constraint_info
  {
    $$ = &ConstraintDefinition{Details: $1.(ConstraintInfo)}
  }

check_constraint_info:
  CHECK '(' expression ')' enforced_opt
  {
    $$ = &CheckConstraintDefinition{Expr: tryCastExpr($3), Enforced: $5.(bool)}
  }

from_or_in:
  FROM
  {
    $$ = string($1)
  }
| IN
  {
    $$ = string($1)
  }

show_database_opt:
  {
    $$ = ""
  }
| FROM ID
  {
    $$ = string($2)
  }
| IN ID
  {
    $$ = string($2)
  }

fk_on_delete:
  ON DELETE fk_reference_action
  {
    $$ = $3.(ReferenceAction)
  }

fk_on_update:
  ON UPDATE fk_reference_action
  {
    $$ = $3.(ReferenceAction)
  }

fk_reference_action:
  RESTRICT
  {
    $$ = Restrict
  }
| CASCADE
  {
    $$ = Cascade
  }
| NO ACTION
  {
    $$ = NoAction
  }
| SET DEFAULT
  {
    $$ = SetDefault
  }
| SET NULL
  {
    $$ = SetNull
  }

enforced_opt:
  {
    $$ = true
  }
| ENFORCED
  {
    $$ = true
  }
| NOT_ENFORCED
  {
    $$ = false
  }

table_option_list:
  {
    $$ = []*TableOption(nil)
  }
| table_option_list table_option
  {
    $$ = append($1.([]*TableOption), $2.(*TableOption))
  }
| table_option_list ',' table_option
  {
    $$ = append($1.([]*TableOption), $3.(*TableOption))
  }

table_option:
  AUTOEXTEND_SIZE equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| AUTO_INCREMENT equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| AVG_ROW_LENGTH equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| default_keyword_opt CHARSET equal_opt charset
  {
    $$ = &TableOption{Name: "CHARACTER SET", Value: $4.(string)}
  }
| default_keyword_opt CHARACTER SET equal_opt charset
  {
    $$ = &TableOption{Name: string($2) + " " + string($3), Value: $5.(string)}
  }
| CHECKSUM equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| TABLE_CHECKSUM equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: "CHECKSUM", Value: string($3)}
  }
| default_keyword_opt COLLATE equal_opt table_option_collate
  {
    $$ = &TableOption{Name: string($2), Value: $4.(string)}
  }
| COMMENT_KEYWORD equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| COMPRESSION equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| CONNECTION equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| DATA DIRECTORY equal_opt STRING
  {
    $$ = &TableOption{Name: string($1) + " "  + string($2), Value: string($4)}
  }
| INDEX DIRECTORY equal_opt STRING
  {
    $$ = &TableOption{Name: string($1) + " "  + string($2), Value: string($4)}
  }
| ITEF_QUOTES equal_opt yes_no
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| DELAY_KEY_WRITE equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| ENCRYPTION equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| ENCRYPTED equal_opt yes_no
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| ENCRYPTION_KEY_ID equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| ENGINE equal_opt any_identifier
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| ENGINE_ATTRIBUTE equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| INSERT_METHOD equal_opt no_first_last
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| KEY_BLOCK_SIZE equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| MAX_ROWS equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| MIN_ROWS equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| PACK_KEYS equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| PAGE_CHECKSUM equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| PAGE_COMPRESSED equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| PAGE_COMPRESSION_LEVEL equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| PASSWORD equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| ROW_FORMAT equal_opt row_fmt_opt
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| START TRANSACTION
  {
    $$ = &TableOption{Name: string($1) + string($2)}
  }
| SECONDARY_ENGINE equal_opt ID
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| SECONDARY_ENGINE equal_opt NULL
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| SECONDARY_ENGINE equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| SECONDARY_ENGINE_ATTRIBUTE equal_opt STRING
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| SEQUENCE equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| STATS_AUTO_RECALC equal_opt DEFAULT
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| STATS_AUTO_RECALC equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| STATS_PERSISTENT equal_opt DEFAULT
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| STATS_PERSISTENT equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| STATS_SAMPLE_PAGES equal_opt table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $3.(string)}
  }
| TABLESPACE table_opt_value
  {
    $$ = &TableOption{Name: string($1), Value: $2.(string)}
  }
| TABLESPACE any_identifier
  {
    $$ = &TableOption{Name: string($1), Value: string($2)}
  }
| TABLESPACE any_identifier STORAGE DISK
  {
    $$ = &TableOption{Name: string($1), Value: string($2) + " "  + string($3) + " "  + string($4)}
  }
| TABLESPACE any_identifier STORAGE MEMORY
  {
    $$ = &TableOption{Name: string($1), Value: string($2) + " "  + string($3) + " "  + string($4)}
  }
| TRANSACTIONAL equal_opt coericble_to_integral
  {
    $$ = &TableOption{Name: string($1), Value: string($3)}
  }
| UNION equal_opt openb any_identifier_list closeb
  {
    $$ = &TableOption{Name: string($1), Value: "(" + $4.(string) + ")"}
  }
| WITH SYSTEM VERSIONING
  {
    $$ = &TableOption{Name: string($1) + " " + string($2) + " " + string($3)}
  }

no_first_last:
  NO
  {
    $$ = $1
  }
| FIRST
  {
    $$ = $1
  }
| LAST
  {
    $$ = $1
  }

yes_no:
  YES
  {
    $$ = $1
  }
| NO
  {
    $$ = $1
  }

table_option_collate:
  any_identifier
  {
    $$ = string($1)
  }
| STRING
  {
    $$ = string($1)
  }

table_opt_value:
  STRING
  {
    $$ = "'" + string($1) + "'"
  }
| coericble_to_integral
  {
    $$ = string($1)
  }
// TODO: should be able to use non_reserved_keywords
| COMMENT_KEYWORD
  {
    $$ = string($1)
  }
| EVENT
  {
    $$ = string($1)
  }
| PASSWORD
  {
    $$ = string($1)
  }

coericble_to_integral:
  INTEGRAL
  {
     $$ = $1
  }
| HEXNUM
  {
    $$ = $1
  }
| FLOAT
  {
     $$ = $1
  }

row_fmt_opt:
  DEFAULT
  {
    $$ = string($1)
  }
| DYNAMIC
  {
    $$ = string($1)
  }
| FIXED
  {
    $$ = string($1)
  }
| COMPRESSED
  {
    $$ = string($1)
  }
| REDUNDANT
  {
    $$ = string($1)
  }
| COMPACT
  {
    $$ = string($1)
  }

any_identifier_list:
  any_identifier
  {
    $$ = string($1)
  }
| any_identifier_list ',' any_identifier
  {
    $$ = $1.(string) + "," + string($3)
  }

any_identifier:
  ID
| non_reserved_keyword
| reserved_keyword

// TODO: partition options for table creation will parse, but do nothing for now
partition_option_opt:
  {
    $$ = (*PartitionOption)(nil)
  }
| partition_option
  {
    $$ = $1.(*PartitionOption)
  }

partition_option:
  PARTITION BY partition_option_part partition_num_opt subpartition_opt partition_definitions_opt
  {
    $3.(*PartitionOption).Partitions = $4.(*SQLVal)
    $3.(*PartitionOption).SubPartition = $5.(*SubPartition)
    $3.(*PartitionOption).Definitions = $6.([]*PartitionDefinition)
    $$ = $3.(*PartitionOption)
  }

partition_option_part:
  linear_partition_opt
  {
    $$ = $1.(*PartitionOption)
  }
| range_or_list openb value_expression closeb
  {
    $$ = &PartitionOption {
    	PartitionType: string($1.(string)),
    	Expr: tryCastExpr($3),
    }
  }
| range_or_list COLUMNS openb column_list closeb
  {
    $$ = &PartitionOption {
    	PartitionType: string($1.(string)),
    	ColList: $4.(Columns),
    }
  }

linear_partition_opt:
  linear_opt HASH openb value_expression closeb
  {
    $$ = &PartitionOption {
    	IsLinear: $1.(bool),
    	PartitionType: string($2),
    	Expr: tryCastExpr($4),
    }
  }
| linear_opt KEY algorithm_part_opt openb column_list closeb
  {
    $$ = &PartitionOption {
	IsLinear: $1.(bool),
	PartitionType: string($2),
	KeyAlgorithm: $3.(string),
	ColList: $5.(Columns),
    }
  }

linear_opt:
  {
    $$ = false
  }
| LINEAR
  {
    $$ = true
  }

algorithm_part_opt:
  {
    $$ = ""
  }
| ALGORITHM '=' INTEGRAL
  {
    $$ = string($1) + " = " + string($3)
  }

range_or_list:
  RANGE
  {
    $$ = string($1)
  }
| LIST
  {
    $$ = string($1)
  }

partition_num_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| PARTITIONS INTEGRAL
  {
    $$ = NewIntVal($2)
  }

subpartition_opt:
  {
    $$ = (*SubPartition)(nil)
  }
| SUBPARTITION BY linear_opt HASH openb value_expression closeb subpartition_num_opt
  {
    $$ = &SubPartition{
    	IsLinear: $3.(bool),
    	PartitionType: string($4),
    	Expr: tryCastExpr($6),
    	SubPartitions: $8.(*SQLVal),
    }
  }
| SUBPARTITION BY linear_opt KEY algorithm_part_opt openb value_expression closeb subpartition_num_opt
  {
    $$ = &SubPartition{
    	IsLinear: $3.(bool),
    	PartitionType: string($4),
    	KeyAlgorithm: $5.(string),
    	Expr: tryCastExpr($7),
    	SubPartitions: $9.(*SQLVal),
    }
  }

subpartition_num_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| SUBPARTITIONS INTEGRAL
  {
    $$ = NewIntVal($2)
  }

constraint_symbol_opt:
  {
    $$ = ""
  }
| CONSTRAINT
  {
    $$ = ""
  }
| CONSTRAINT ID
  {
    $$ = string($2)
  }

pk_name_opt:
  {
    $$ = string("")
  }
| CONSTRAINT ID
  {
    $$ = string($2)
  }

alter_statement:
  alter_database_statement
| alter_table_statement
| alter_event_statement
| alter_user_statement

alter_database_statement:
  ALTER DATABASE ID creation_option_opt
  {
    $$ = &DBDDL{
      Action: AlterStr,
      SchemaOrDatabase: "database",
      DBName: string($3),
      CharsetCollate: $4.([]*CharsetAndCollate),
      Auth: AuthInformation{
        AuthType: AuthType_ALTER,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{string($3)},
      },
    }
  }
| ALTER DATABASE creation_option_opt
  {
    $$ = &DBDDL{
      Action: AlterStr,
      SchemaOrDatabase: "database",
      CharsetCollate: $3.([]*CharsetAndCollate),
      Auth: AuthInformation{
        AuthType: AuthType_ALTER,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{""},
      },
    }
  }

alter_table_statement:
  ALTER ignore_opt TABLE table_name alter_table_statement_list partition_operation_list_opt partition_option_opt
  {
    tableName := $4.(TableName)
    ddls := $5.([]*DDL)
    for i := 0; i < len(ddls); i++ {
    	ddl := ddls[i]
    	if ddl.Action == RenameStr {
    		ddl.FromTables = append(TableNames{tableName}, ddl.FromTables...)
	} else {
		ddl.Table = tableName
	}
	PrependAuthTargetNames(ddl, []string{tableName.DbQualifier.String(), tableName.Name.String()})
    }
    $$ = &AlterTable{
      Table: tableName,
      Statements: ddls,
      PartitionSpecs: $6.([]*PartitionSpec),
      Auth: AuthInformation{AuthType: AuthType_IGNORE},
    }
  }
| ALTER ignore_opt TABLE table_name partition_operation_list
  {
    tableName := $4.(TableName)
    $$ = &AlterTable{
      Table: tableName,
      PartitionSpecs: $5.([]*PartitionSpec),
      Auth: AuthInformation{
        AuthType: AuthType_ALTER,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
  }
| ALTER ignore_opt TABLE table_name partition_option
  {
    tableName := $4.(TableName)
    $$ = &AlterTable{
      Table: tableName,
      Auth: AuthInformation{
        AuthType: AuthType_ALTER,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
  }

alter_table_statement_list:
  alter_table_statement_part
  {
    $$ = []*DDL{$1.(*DDL)}
  }
| alter_table_statement_list ',' alter_table_statement_part
  {
    $$ = append($$.([]*DDL), $3.(*DDL))
  }

alter_table_statement_part:
  ADD column_opt '(' column_definition ')'
  {
    ddl := &DDL{
    	Action: AlterStr,
    	ColumnAction: AddStr,
    	TableSpec: &TableSpec{},
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddColumn($4.(*ColumnDefinition))
    ddl.Column = $4.(*ColumnDefinition).Name
    if ddl.TableSpec.Constraints != nil {
    	ddl.ConstraintAction = AddStr
    }
    $$ = ddl
  }
| ADD column_opt column_definition column_order_opt
  {
    ddl := &DDL{
    	Action: AlterStr,
	ColumnAction: AddStr,
	TableSpec: &TableSpec{},
	ColumnOrder: $4.(*ColumnOrder),
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddColumn($3.(*ColumnDefinition))
    ddl.Column = $3.(*ColumnDefinition).Name
    if ddl.TableSpec.Constraints != nil {
    	ddl.ConstraintAction = AddStr
    }
    $$ = ddl
  }
| ADD index_or_key not_exists_opt name_opt using_opt '(' index_column_list ')' index_option_list_opt
  {
    $$ = &DDL{
    	Action: AlterStr,
    	IfNotExists: $3.(int) != 0,
    	IndexSpec: &IndexSpec{
    		Action: CreateStr,
    		ToName: NewColIdent($4.(string)),
    		Using: $5.(ColIdent),
    		Columns: $7.([]*IndexColumn),
    		Options: $9.([]*IndexOption),
    		ifNotExists: $3.(int) != 0,
	    },
	    Auth: AuthInformation{
        	AuthType: AuthType_INDEX,
        	TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| ADD constraint_symbol_opt key_type index_or_key_opt not_exists_opt name_opt using_opt '(' index_column_list ')' index_option_list_opt
  {
    idxName := $6.(string)
    if len(idxName) == 0 {
      idxName = $2.(string)
    }
    $$ = &DDL{
    	Action: AlterStr,
    	IfNotExists: $5.(int) != 0,
    	IndexSpec: &IndexSpec{
    		Action: CreateStr,
    		ToName: NewColIdent(idxName),
    		Type: $3.(string),
    		Using: $7.(ColIdent),
    		Columns: $9.([]*IndexColumn),
    		Options: $11.([]*IndexOption),
    		ifNotExists: $5.(int) != 0,
        },
        Auth: AuthInformation{
            AuthType: AuthType_INDEX,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
// A name may be specified for a primary key, but it is ignored since the primary
// key is always named 'PRIMARY'
| ADD pk_name_opt PRIMARY KEY name_opt '(' index_column_list ')' index_option_list_opt
  {
    ddl := &DDL{
    	Action: AlterStr,
    	IndexSpec: &IndexSpec{
    		Action: CreateStr,
        },
        Auth: AuthInformation{
            AuthType: AuthType_INDEX,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.IndexSpec = &IndexSpec{
    	Action: CreateStr,
        Using: NewColIdent(""),
        ToName: NewColIdent($2.(string)),
        Type: PrimaryStr,
        Columns: $7.([]*IndexColumn),
        Options: $9.([]*IndexOption),
    }
    $$ = ddl
  }
| ADD foreign_key_definition
  {
    ddl := &DDL{
    	Action: AlterStr,
    	ConstraintAction: AddStr,
    	TableSpec: &TableSpec{},
    	Auth: AuthInformation{
            AuthType: AuthType_FOREIGN_KEY,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddConstraint($2.(*ConstraintDefinition))
    $$ = ddl
  }
| ADD check_constraint_definition
  {
    ddl := &DDL{
	Action: AlterStr,
	ConstraintAction: AddStr,
	TableSpec: &TableSpec{},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddConstraint($2.(*ConstraintDefinition))
    $$ = ddl
  }
| DROP CONSTRAINT id_or_non_reserved
  {
    $$ = &DDL{
    	Action: AlterStr,
        ConstraintAction: DropStr,
        TableSpec: &TableSpec{
            Constraints: []*ConstraintDefinition{
                &ConstraintDefinition{
                    Name: string($3),
                },
            },
        },
        Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| DROP CHECK id_or_non_reserved
  {
    $$ = &DDL{
    	Action: AlterStr,
    	ConstraintAction: DropStr,
    	TableSpec: &TableSpec{
    		Constraints: []*ConstraintDefinition{
    			&ConstraintDefinition{
    				Name: string($3),
    				Details: &CheckConstraintDefinition{},
			},
		},
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| ALTER CONSTRAINT id_or_non_reserved ENFORCED
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALTER CHECK id_or_non_reserved ENFORCED
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALTER CONSTRAINT id_or_non_reserved NOT_ENFORCED
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALTER CHECK id_or_non_reserved NOT_ENFORCED
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALGORITHM equal_opt DEFAULT
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALGORITHM equal_opt INSTANT
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALGORITHM equal_opt INPLACE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALGORITHM equal_opt COPY
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALTER column_opt sql_id SET DEFAULT value_expression
  {
    $$ = &DDL{
    	Action: AlterStr,
	DefaultSpec: &DefaultSpec{
		Action: SetStr,
		Column: $3.(ColIdent),
		Value: tryCastExpr($6),
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| ALTER column_opt sql_id DROP DEFAULT
  {
    colName := $3.(ColIdent)
    $$ = &DDL{
    	Action: AlterStr,
    	DefaultSpec: &DefaultSpec{
    		Action: DropStr,
    		Column: colName,
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_TableColumn,
            TargetNames: []string{colName.String()},
        },
    }
  }
| ALTER INDEX id_or_non_reserved VISIBLE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_INDEX,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| ALTER INDEX id_or_non_reserved INVISIBLE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_INDEX,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| CHANGE column_opt ID column_definition column_order_opt
  {
    ddl := &DDL{
    	Action: AlterStr,
    	ColumnAction: ChangeStr,
    	TableSpec: &TableSpec{},
    	Column: NewColIdent(string($3)),
    	ColumnOrder: $5.(*ColumnOrder),
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddColumn($4.(*ColumnDefinition))
    $$ = ddl
  }
| default_keyword_opt CHARACTER SET equal_opt charset
  {
    $$ = &DDL{
    	Action: AlterStr,
    	AlterCollationSpec: &AlterCollationSpec{
    		CharacterSet: $5.(string),
    		Collation: "",
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| default_keyword_opt CHARACTER SET equal_opt charset COLLATE equal_opt charset
  {
    $$ = &DDL{
    	Action: AlterStr,
    	AlterCollationSpec: &AlterCollationSpec{
    		CharacterSet: $5.(string),
    		Collation: $8.(string),
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| default_keyword_opt COLLATE equal_opt charset
  {
    $$ = &DDL{
    	Action: AlterStr,
    	AlterCollationSpec: &AlterCollationSpec{
    		CharacterSet: "",
    		Collation: $4.(string),
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| CONVERT TO CHARACTER SET charset
  {
    $$ = &DDL{
    	Action: AlterStr,
    	AlterCollationSpec: &AlterCollationSpec{
    		CharacterSet: $5.(string),
    		Collation: "",
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| CONVERT TO CHARACTER SET charset COLLATE charset
  {
    $$ = &DDL{
    	Action: AlterStr,
    	AlterCollationSpec: &AlterCollationSpec{
    		CharacterSet: $5.(string),
    		Collation: $7.(string),
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| DISABLE KEYS
  {
    $$ = &DDL{
    	Action: AlterStr,
    	IndexSpec: &IndexSpec{
    		Action: string($1),
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| ENABLE KEYS
  {
    $$ = &DDL{
    	Action: AlterStr,
    	IndexSpec: &IndexSpec{
    		Action: string($1),
	},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| DISCARD TABLESPACE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| IMPORT TABLESPACE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| DROP column_opt id_or_non_reserved
  {
    $$ = &DDL{
    	Action: AlterStr,
    	ColumnAction: DropStr,
    	Column: NewColIdent(string($3)),
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| DROP index_or_key exists_opt sql_id
  {
    $$ = &DDL{
    	Action: AlterStr,
    	IfExists: $3.(int) != 0,
    	IndexSpec: &IndexSpec{
    		Action: DropStr,
    		ToName: $4.(ColIdent),
    		ifExists: $3.(int) != 0,
        },
        Auth: AuthInformation{
            AuthType: AuthType_INDEX,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| DROP PRIMARY KEY
  {
    $$ = &DDL{
    	Action: AlterStr,
	IndexSpec: &IndexSpec{
		Action: DropStr,
		Type: PrimaryStr,
	},
	Auth: AuthInformation{
            AuthType: AuthType_INDEX,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| DROP FOREIGN KEY id_or_non_reserved
  {
    ddl := &DDL{
    	Action: AlterStr,
	ConstraintAction: DropStr,
	TableSpec: &TableSpec{},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
    	Name: string($4),
    	Details: &ForeignKeyDefinition{},
    })
    $$ = ddl
  }
| FORCE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| LOCK equal_opt DEFAULT
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_LOCK,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| LOCK equal_opt NONE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_LOCK,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| LOCK equal_opt SHARED
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_LOCK,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| LOCK equal_opt EXCLUSIVE
  {
    $$ = &DDL{
      Action: AlterStr,
      Auth: AuthInformation{
          AuthType: AuthType_LOCK,
          TargetType: AuthTargetType_SingleTableIdentifier,
      },
    }
  }
| MODIFY column_opt column_definition column_order_opt
  {
    ddl := &DDL{
    	Action: AlterStr,
    	ColumnAction: ModifyStr,
    	TableSpec: &TableSpec{},
    	ColumnOrder: $4.(*ColumnOrder),
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddColumn($3.(*ColumnDefinition))
    if len(ddl.TableSpec.Constraints) > 0 {
      ddl.ConstraintAction = AddStr
    }
    ddl.Column = $3.(*ColumnDefinition).Name
    $$ = ddl
  }
// | ORDER BY col_name [, col_name] ...
| RENAME COLUMN id_or_non_reserved to_or_as id_or_non_reserved
  {
    $$ = &DDL{
    	Action: AlterStr,
    	ColumnAction: RenameStr,
    	Column: NewColIdent(string($3)),
    	ToColumn: NewColIdent(string($5)),
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| RENAME index_or_key sql_id TO sql_id
  {
    $$ = &DDL{
    	Action: AlterStr,
    	IndexSpec: &IndexSpec{
    		Action: RenameStr,
    		FromName: $3.(ColIdent),
    		ToName: $5.(ColIdent),
	},
	Auth: AuthInformation{
            AuthType: AuthType_INDEX,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| RENAME to_or_as_opt table_name
  {
    // Change this to a rename statement
    tableName := $3.(TableName)
    $$ = &DDL{
    	Action: RenameStr,
    	ToTables: TableNames{tableName},
    	Auth: AuthInformation{
            AuthType: AuthType_RENAME,
            TargetType: AuthTargetType_Ignore,
            TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
        },
    }
  }
| RENAME CONSTRAINT FOREIGN KEY id_or_non_reserved TO id_or_non_reserved
  {
    ddl := &DDL{
    	Action: AlterStr,
    	ConstraintAction: RenameStr,
    	TableSpec: &TableSpec{},
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
    	Name: string($5),
    	Details: &ForeignKeyDefinition{},
    })
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
    	Name: string($7),
    	Details: &ForeignKeyDefinition{},
    })
    $$ = ddl
  }
| RENAME CONSTRAINT CHECK id_or_non_reserved TO id_or_non_reserved
  {
    ddl := &DDL{
    	Action: AlterStr,
    	ConstraintAction: RenameStr,
    	TableSpec: &TableSpec{},
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
    	Name: string($4),
    	Details: &CheckConstraintDefinition{},
    })
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
 	Name: string($6),
 	Details: &CheckConstraintDefinition{},
    })
    $$ = ddl
  }
| RENAME CONSTRAINT id_or_non_reserved TO id_or_non_reserved
  {
    ddl := &DDL{
    	Action: AlterStr,
	ConstraintAction: RenameStr,
	TableSpec: &TableSpec{},
	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
    	Name: string($3),
    })
    ddl.TableSpec.AddConstraint(&ConstraintDefinition{
    	Name: string($5),
    })
    $$ = ddl
  }
| with_or_without VALIDATION
  {
    $$ = &DDL{
    	Action: AlterStr,
    	Auth: AuthInformation{
            AuthType: AuthType_ALTER,
            TargetType: AuthTargetType_SingleTableIdentifier,
        },
    }
  }
| alter_table_options
  {
    ddl := $1.(*DDL)
    ddl.Auth = AuthInformation{
        AuthType: AuthType_ALTER,
        TargetType: AuthTargetType_SingleTableIdentifier,
    }
    $$ = ddl
  }

// TODO: these are the same as table_option_list, but we need to have the return type be different
alter_table_options:
  AUTOEXTEND_SIZE equal_opt table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| AUTO_INCREMENT equal_opt expression
  {
    $$ = &DDL{Action: AlterStr, AutoIncSpec: &AutoIncSpec{Value: tryCastExpr($3)}}
  }
| AVG_ROW_LENGTH equal_opt table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| CHECKSUM equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| TABLE_CHECKSUM equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| COMMENT_KEYWORD equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr, AlterCommentSpec: &AlterCommentSpec{Comment: string($3)}}
  }
| COMPRESSION equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| CONNECTION equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| DATA DIRECTORY equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| INDEX DIRECTORY equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| ITEF_QUOTES equal_opt yes_no
  {
    $$ = &DDL{Action: AlterStr}
  }
| DELAY_KEY_WRITE equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| ENCRYPTION equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| ENCRYPTED equal_opt yes_no
  {
    $$ = &DDL{Action: AlterStr}
  }
| ENCRYPTION_KEY_ID equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| ENGINE equal_opt any_identifier
  {
    $$ = &DDL{Action: AlterStr}
  }
| ENGINE_ATTRIBUTE equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| INSERT_METHOD equal_opt no_first_last
  {
    $$ = &DDL{Action: AlterStr}
  }
| KEY_BLOCK_SIZE equal_opt table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| MAX_ROWS equal_opt table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| MIN_ROWS equal_opt table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| PACK_KEYS equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| PAGE_CHECKSUM equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| PAGE_COMPRESSED equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| PAGE_COMPRESSION_LEVEL equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| PASSWORD equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| ROW_FORMAT equal_opt row_fmt_opt
  {
    $$ = &DDL{Action: AlterStr}
  }
| SECONDARY_ENGINE equal_opt ID
  {
    $$ = &DDL{Action: AlterStr}
  }
| SECONDARY_ENGINE equal_opt NULL
  {
    $$ = &DDL{Action: AlterStr}
  }
| SECONDARY_ENGINE equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| SECONDARY_ENGINE_ATTRIBUTE equal_opt STRING
  {
    $$ = &DDL{Action: AlterStr}
  }
| SEQUENCE equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| STATS_AUTO_RECALC equal_opt DEFAULT
  {
    $$ = &DDL{Action: AlterStr}
  }
| STATS_AUTO_RECALC equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| STATS_PERSISTENT equal_opt DEFAULT
  {
    $$ = &DDL{Action: AlterStr}
  }
| STATS_PERSISTENT equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| STATS_SAMPLE_PAGES equal_opt table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| TABLESPACE table_opt_value
  {
    $$ = &DDL{Action: AlterStr}
  }
| TABLESPACE any_identifier
  {
    $$ = &DDL{Action: AlterStr}
  }
| TABLESPACE any_identifier STORAGE DISK
  {
    $$ = &DDL{Action: AlterStr}
  }
| TABLESPACE any_identifier STORAGE MEMORY
  {
    $$ = &DDL{Action: AlterStr}
  }
| TRANSACTIONAL equal_opt coericble_to_integral
  {
    $$ = &DDL{Action: AlterStr}
  }
| UNION equal_opt openb any_identifier_list closeb
  {
    $$ = &DDL{Action: AlterStr}
  }
| WITH SYSTEM VERSIONING
  {
    $$ = &DDL{Action: AlterStr}
  }

with_or_without:
  WITH
  {
    $$ = true
  }
| WITHOUT
  {
    $$ = false
  }

id_or_non_reserved:
  ID
| all_non_reserved

alter_user_statement:
  ALTER USER exists_opt account_name authentication_opt account_limits
  {
    var ifExists bool
    if $3.(int) != 0 {
      ifExists = true
    }
    accountName := $4.(AccountName)
    accountLimits, err := NewAccountLimits($6.([]AccountLimitItem))
    if err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &DDL{
      Action: AlterStr,
      User: accountName,
      Authentication: $5.(*Authentication),
      IfExists: ifExists,
      Auth: AuthInformation{
          AuthType: AuthType_ALTER_USER,
          TargetType: AuthTargetType_Ignore,
          TargetNames: []string{accountName.Name, accountName.Host},
      },
      AccountLimits: accountLimits,
    }
  }

column_order_opt:
  {
    $$ = (*ColumnOrder)(nil)
  }
| FIRST
  {
    $$ = &ColumnOrder{First: true}
  }
| AFTER ID
  {
    $$ = &ColumnOrder{AfterColumn: NewColIdent(string($2))}
  }

column_opt:
  { }
| COLUMN
  { }

partition_operation_list_opt:
  {
    $$ = []*PartitionSpec(nil)
  }
| partition_operation_list
  {
    $$ = $1.([]*PartitionSpec)
  }

partition_operation_list:
  partition_operation
  {
    $$ = []*PartitionSpec{$1.(*PartitionSpec)}
  }
| partition_operation_list partition_operation
  {
    $$ = append($1.([]*PartitionSpec), $2.(*PartitionSpec))
  }

partition_operation:
  ADD PARTITION openb partition_definitions closeb
  {
    $$ = &PartitionSpec{Action: AddStr, Definitions: $4.([]*PartitionDefinition)}
  }
| DROP PARTITION partition_list
  {
    $$ = &PartitionSpec{Action: DropStr, Names: $3.(Partitions)}
  }
| DISCARD PARTITION partition_list TABLESPACE
  {
    $$ = &PartitionSpec{Action: DiscardStr, Names: $3.(Partitions)}
  }
| DISCARD PARTITION ALL TABLESPACE
  {
    $$ = &PartitionSpec{Action: DiscardStr, IsAll: true}
  }
| IMPORT PARTITION partition_list TABLESPACE
  {
    $$ = &PartitionSpec{Action: ImportStr, Names: $3.(Partitions)}
  }
| IMPORT PARTITION ALL TABLESPACE
  {
    $$ = &PartitionSpec{Action: ImportStr, IsAll: true}
  }
| TRUNCATE PARTITION partition_list TABLESPACE
  {
    $$ = &PartitionSpec{Action: TruncateStr, Names: $3.(Partitions)}
  }
| TRUNCATE PARTITION ALL TABLESPACE
  {
    $$ = &PartitionSpec{Action: TruncateStr, IsAll: true}
  }
| COALESCE PARTITION INTEGRAL
  {
    $$ = &PartitionSpec{Action: CoalesceStr, Number: NewIntVal($3)}
  }
| REORGANIZE PARTITION partition_list INTO openb partition_definitions closeb
  {
    $$ = &PartitionSpec{Action: ReorganizeStr, Names: $3.(Partitions), Definitions: $6.([]*PartitionDefinition)}
  }
| EXCHANGE PARTITION sql_id WITH TABLE table_name
  {
    $$ = &PartitionSpec{Action: ExchangeStr, Names: Partitions{$3.(ColIdent)}, TableName: $6.(TableName)}
  }
| EXCHANGE PARTITION sql_id WITH TABLE table_name with_or_without VALIDATION
  {
    $$ = &PartitionSpec{Action: ExchangeStr, Names: Partitions{$3.(ColIdent)}, TableName: $6.(TableName), WithValidation: $7.(bool)}
  }
| ANALYZE PARTITION partition_list
  {
    $$ = &PartitionSpec{Action: AnalyzeStr, Names: $3.(Partitions)}
  }
| ANALYZE PARTITION ALL
  {
    $$ = &PartitionSpec{Action: AnalyzeStr, IsAll: true}
  }
// The parser confuses CHECK with column_definitions
//| CHECK PARTITION partition_list
//  {
//    $$ = &PartitionSpec{Action: CheckStr, Names: $3}
//  }
//| CHECK PARTITION ALL
//  {
//    $$ = &PartitionSpec{Action: CheckStr, IsAll: true}
//  }
| OPTIMIZE PARTITION partition_list
  {
    $$ = &PartitionSpec{Action: OptimizeStr, Names: $3.(Partitions)}
  }
| OPTIMIZE PARTITION ALL
  {
    $$ = &PartitionSpec{Action: OptimizeStr, IsAll: true}
  }
| REBUILD PARTITION partition_list
  {
    $$ = &PartitionSpec{Action: RebuildStr, Names: $3.(Partitions)}
  }
| REBUILD PARTITION ALL
  {
    $$ = &PartitionSpec{Action: RebuildStr, IsAll: true}
  }
| REPAIR PARTITION partition_list
  {
    $$ = &PartitionSpec{Action: RepairStr, Names: $3.(Partitions)}
  }
| REPAIR PARTITION ALL
  {
    $$ = &PartitionSpec{Action: RepairStr, IsAll: true}
  }
| REMOVE PARTITIONING
  {
    $$ = &PartitionSpec{Action: RemoveStr}
  }

partition_definitions_opt:
  {
    $$ = []*PartitionDefinition(nil)
  }
| openb partition_definitions closeb
  {
    $$ = $2.([]*PartitionDefinition)
  }

partition_definitions:
  partition_definition
  {
    $$ = []*PartitionDefinition{$1.(*PartitionDefinition)}
  }
| partition_definitions ',' partition_definition
  {
    $$ = append($1.([]*PartitionDefinition), $3.(*PartitionDefinition))
  }

partition_definition:
  PARTITION sql_id VALUES LESS THAN openb value_expression closeb
  {
    $$ = &PartitionDefinition{Name: $2.(ColIdent), Limit: tryCastExpr($7)}
  }
| PARTITION sql_id VALUES LESS THAN openb MAXVALUE closeb
  {
    $$ = &PartitionDefinition{Name: $2.(ColIdent), Maxvalue: true}
  }

alter_event_statement:
  ALTER definer_opt EVENT event_name event_on_completion_preserve_opt rename_event_name_opt event_status_opt comment_keyword_opt
  {
    eventName := $4.(EventName)
    renameName := $6.(EventName)
    targetNames := []string{eventName.Qualifier.String()}
    if len(renameName.Qualifier.String()) > 0 {
      targetNames = append(targetNames, renameName.Qualifier.String())
    }
    es := &EventSpec{
      EventName: eventName,
      Definer: $2.(string),
      OnCompletionPreserve: $5.(EventOnCompletion),
      RenameName: renameName,
      Status: $7.(EventStatus),
      Comment: $8.(*SQLVal),
    }
    if err := es.ValidateAlterEvent(); err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $$ = &DDL{
      Action: AlterStr,
      EventSpec: es,
      Auth: AuthInformation{
        AuthType: AuthType_EVENT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: targetNames,
      },
    }
  }
| ALTER definer_opt EVENT event_name ON SCHEDULE event_schedule event_on_completion_preserve_opt rename_event_name_opt event_status_opt comment_keyword_opt
  {
    eventName := $4.(EventName)
    renameName := $9.(EventName)
    targetNames := []string{eventName.Qualifier.String()}
    if len(renameName.Qualifier.String()) > 0 {
      targetNames = append(targetNames, renameName.Qualifier.String())
    }
    $$ = &DDL{
      Action: AlterStr,
      EventSpec: &EventSpec{
        EventName: eventName,
        Definer: $2.(string),
        OnSchedule: $7.(*EventScheduleSpec),
        OnCompletionPreserve: $8.(EventOnCompletion),
        RenameName: renameName,
        Status: $10.(EventStatus),
        Comment: $11.(*SQLVal),
      },
      Auth: AuthInformation{
        AuthType: AuthType_EVENT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: targetNames,
      },
    }
  }
| ALTER definer_opt EVENT event_name event_on_completion_preserve_opt rename_event_name_opt event_status_opt comment_keyword_opt DO lexer_position statement_list_statement lexer_position
  {
    eventName := $4.(EventName)
    renameName := $6.(EventName)
    targetNames := []string{eventName.Qualifier.String()}
    if len(renameName.Qualifier.String()) > 0 {
      targetNames = append(targetNames, renameName.Qualifier.String())
    }
    $$ = &DDL{
      Action: AlterStr,
      EventSpec: &EventSpec{
        EventName: eventName,
        Definer: $2.(string),
        OnCompletionPreserve: $5.(EventOnCompletion),
        RenameName: renameName,
        Status: $7.(EventStatus),
        Comment: $8.(*SQLVal),
        Body: tryCastStatement($11),
      },
      SubStatementPositionStart: $10.(int),
      SubStatementPositionEnd: $12.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_EVENT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: targetNames,
      },
    }
  }
| ALTER definer_opt EVENT event_name ON SCHEDULE event_schedule event_on_completion_preserve_opt rename_event_name_opt event_status_opt comment_keyword_opt DO lexer_position statement_list_statement lexer_position
  {
    eventName := $4.(EventName)
    renameName := $9.(EventName)
    targetNames := []string{eventName.Qualifier.String()}
    if len(renameName.Qualifier.String()) > 0 {
      targetNames = append(targetNames, renameName.Qualifier.String())
    }
    $$ = &DDL{
      Action: AlterStr,
      EventSpec: &EventSpec{
        EventName: eventName,
        Definer: $2.(string),
        OnSchedule: $7.(*EventScheduleSpec),
        OnCompletionPreserve: $8.(EventOnCompletion),
        RenameName: renameName,
        Status: $10.(EventStatus),
        Comment: $11.(*SQLVal),
        Body: tryCastStatement($14),
      },
      SubStatementPositionStart: $13.(int),
      SubStatementPositionEnd: $15.(int) - 1,
      Auth: AuthInformation{
        AuthType: AuthType_EVENT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: targetNames,
      },
    }
  }

rename_event_name_opt:
  {
    $$ = EventName{}
  }
| RENAME TO event_name
  {
    $$ = $3.(EventName)
  }

rename_statement:
  RENAME TABLE rename_list
  {
    $$ = $3.(*DDL)
  }
| RENAME USER rename_user_list
  {
    $$ = &RenameUser{
      Accounts: $3.([]AccountRename),
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_USER,
        TargetType: AuthTargetType_Global,
      },
    }
  }

rename_list:
  table_name TO table_name
  {
    fromTableName := $1.(TableName)
    toTableName := $3.(TableName)
    $$ = &DDL{
      Action: RenameStr,
      FromTables: TableNames{
        fromTableName,
      },
      ToTables: TableNames{
        toTableName,
      },
      Auth: AuthInformation{
        AuthType: AuthType_RENAME,
        TargetType: AuthTargetType_Ignore,
        TargetNames: []string{
          fromTableName.DbQualifier.String(),
          fromTableName.Name.String(),
          toTableName.DbQualifier.String(),
          toTableName.Name.String(),
        },
      },
    }
  }
| rename_list ',' table_name TO table_name
  {
    $$ = $1.(*DDL)
    fromTableName := $3.(TableName)
    toTableName := $5.(TableName)
    $$.(*DDL).FromTables = append($$.(*DDL).FromTables, fromTableName)
    $$.(*DDL).ToTables = append($$.(*DDL).ToTables, toTableName)
    $$.(*DDL).Auth.TargetNames = append($$.(*DDL).Auth.TargetNames,
      fromTableName.DbQualifier.String(),
      fromTableName.Name.String(),
      toTableName.DbQualifier.String(),
      toTableName.Name.String(),
    )
  }

rename_user_list:
  account_name TO account_name
  {
    $$ = []AccountRename{{From: $1.(AccountName), To: $3.(AccountName)}}
  }
| rename_user_list ',' account_name TO account_name
  {
    $$ = append($1.([]AccountRename), AccountRename{From: $3.(AccountName), To: $5.(AccountName)})
  }

drop_statement:
  DROP temp_opt TABLE exists_opt table_name_list drop_statement_action
  {
    var temp bool
    if $2.(int) != 0 {
      temp = true
    }

    var exists bool
    if $4.(int) != 0 {
      exists = true
    }

    tableNames := $5.(TableNames)
    $$ = &DDL{
      Action: DropStr,
      FromTables: tableNames,
      IfExists: exists,
      Temporary: temp,
      Auth: AuthInformation{
        AuthType: AuthType_DROP,
        TargetType: AuthTargetType_MultipleTableIdentifiers,
        TargetNames: tableNames.AuthMultipleTableIdentifiers(),
      },
    }
  }
| DROP INDEX exists_opt sql_id ON table_name
  {
    // For consistency, we always use a AlterTable for ALTER TABLE equivalent statements
    tableName := $6.(TableName)
    ddl := &DDL{
      Action: AlterStr,
      Table: tableName,
      IndexSpec: &IndexSpec{
        Action: DropStr,
        ToName: $4.(ColIdent),
        ifExists: $3.(int) != 0,
      },
      IfExists: $3.(int) != 0,
      Auth: AuthInformation{
        AuthType: AuthType_INDEX,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
    $$ = &AlterTable{
      Table: tableName,
      Statements: []*DDL{ddl},
      Auth: AuthInformation{AuthType: AuthType_IGNORE},
    }
  }
| DROP VIEW exists_opt view_name_list
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    tableNames := $4.(TableNames)
    $$ = &DDL{
      Action: DropStr,
      FromViews: tableNames,
      IfExists: exists,
      Auth: AuthInformation{
        AuthType: AuthType_DROP,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: tableNames.DbQualifiers(),
      },
    }
  }
| DROP DATABASE exists_opt ID
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    $$ = &DBDDL{
      Action: DropStr,
      SchemaOrDatabase: "database",
      DBName: string($4),
      IfExists: exists,
      Auth: AuthInformation{
        AuthType: AuthType_DROP,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| DROP SCHEMA exists_opt ID
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    $$ = &DBDDL{
      Action: DropStr,
      SchemaOrDatabase: "schema",
      DBName: string($4),
      IfExists: exists,
      Auth: AuthInformation{
        AuthType: AuthType_DROP,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| DROP TRIGGER exists_opt trigger_name
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    triggerName := $4.(TriggerName)
    $$ = &DDL{
      Action: DropStr,
      TriggerSpec: &TriggerSpec{
        TrigName: triggerName,
      },
      IfExists: exists,
      Auth: AuthInformation{
        AuthType: AuthType_TRIGGER,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{triggerName.Qualifier.String(), triggerName.Name.String()},
      },
    }
  }
| DROP PROCEDURE exists_opt procedure_name
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    procName := $4.(ProcedureName)
    $$ = &DDL{
      Action: DropStr,
      ProcedureSpec: &ProcedureSpec{
        ProcName: procName,
      },
      IfExists: exists,
      Auth: AuthInformation{
        AuthType: AuthType_ALTER_ROUTINE,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{procName.Qualifier.String()},
      },
    }
  }
| DROP USER exists_opt account_name_list
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    $$ = &DropUser{
      IfExists: exists,
      AccountNames: $4.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_CREATE_USER,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| DROP ROLE exists_opt role_name_list
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    $$ = &DropRole{
      IfExists: exists,
      Roles: $4.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_DROP_ROLE,
        TargetType: AuthTargetType_Ignore,
      },
    }
  }
| DROP EVENT exists_opt event_name
  {
    var exists bool
    if $3.(int) != 0 {
      exists = true
    }
    eventName := $4.(EventName)
    $$ = &DDL{
      Action: DropStr,
      EventSpec: &EventSpec{EventName: eventName},
      IfExists: exists,
      Auth: AuthInformation{
        AuthType: AuthType_EVENT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{eventName.Qualifier.String()},
      },
    }
  }

drop_statement_action:
  {

  }
| RESTRICT
  {
    $$ = Restrict
  }
| CASCADE
  {
    $$ = Cascade
  }

truncate_statement:
  TRUNCATE TABLE table_name
  {
    tableName := $3.(TableName)
    $$ = &DDL{
      Action: TruncateStr,
      Table: tableName,
      Auth: AuthInformation{
        AuthType: AuthType_DROP,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
  }
| TRUNCATE table_name
  {
    tableName := $2.(TableName)
    $$ = &DDL{
      Action: TruncateStr,
      Table: tableName,
      Auth: AuthInformation{
        AuthType: AuthType_DROP,
        TargetType: AuthTargetType_SingleTableIdentifier,
        TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
      },
    }
  }

analyze_statement:
  ANALYZE TABLE analyze_opt
  {
    $$ = tryCastStatement($3)
  }

analyze_opt:
  table_name UPDATE HISTOGRAM ON paren_column_list USING DATA value_expression
  {
    $$ = &Analyze{Tables: []TableName{$1.(TableName)}, Action: UpdateStr, Columns: $5.(Columns), Using: tryCastExpr($8)}
  }
| table_name DROP HISTOGRAM ON paren_column_list
  {
    $$ = &Analyze{Tables: []TableName{$1.(TableName)}, Action: DropStr, Columns: $5.(Columns)}
  }
| table_name_list
  {
    $$ = &Analyze{Tables: $1.(TableNames)}
  }

all_non_reserved:
  non_reserved_keyword
| non_reserved_keyword2
| non_reserved_keyword3
| column_name_safe_keyword
| function_call_keywords

prepare_statement:
  PREPARE ID FROM STRING
  {
    $$ = &Prepare{Name: string($2), Expr: string($4)}
  }
| PREPARE all_non_reserved FROM STRING
  {
    $$ = &Prepare{Name: string($2), Expr: string($4)}
  }
| PREPARE ID FROM system_variable
  {
    $$ = &Prepare{Name: string($2), Expr: string($4.(string))}
  }
| PREPARE all_non_reserved FROM system_variable
  {
    $$ = &Prepare{Name: string($2), Expr: string($4.(string))}
  }

system_variable_list:
  system_variable
  {
    $$ = []string{$1.(string)}
  }
| system_variable_list ',' system_variable
  {
    $$ = append($1.([]string), $3.(string))
  }

// TODO: ensure these start with '@'
system_variable:
  ID
  {
    $$ = string($1)
  }
| all_non_reserved
  {
    $$ = string($1)
  }

execute_statement:
  EXECUTE ID
  {
    $$ = &Execute{Name: string($2)}
  }
| EXECUTE non_reserved_keyword
  {
    $$ = &Execute{Name: string($2)}
  }
| EXECUTE ID USING system_variable_list
  {
    $$ = &Execute{Name: string($2), VarList: $4.([]string)}
  }
| EXECUTE non_reserved_keyword USING system_variable_list
  {
    $$ = &Execute{Name: string($2), VarList: $4.([]string)}
  }

deallocate_statement:
  DEALLOCATE PREPARE ID
  {
    $$ = &Deallocate{Name: string($3)}
  }
| DEALLOCATE PREPARE all_non_reserved
  {
    $$ = &Deallocate{Name: string($3)}
  }
| DROP PREPARE ID
  {
    $$ = &Deallocate{Name: string($3)}
  }
| DROP PREPARE all_non_reserved
  {
    $$ = &Deallocate{Name: string($3)}
  }

show_statement:
  SHOW BINARY ID /* SHOW BINARY LOGS */
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION_CLIENT,
        TargetType: AuthTargetType_Global,
      },
    }
  }
/* SHOW CHARACTER SET and SHOW CHARSET are equivalent */
| SHOW CHARACTER SET like_or_where_opt
  {
    $$ = &Show{
      Type: CharsetStr,
      Filter: $4.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CHARSET like_or_where_opt
  {
    $$ = &Show{
      Type: string($2),
      Filter: $3.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CREATE DATABASE not_exists_opt ID
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      IfNotExists: $4.(int) == 1,
      Database: string($5),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CREATE SCHEMA not_exists_opt ID
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      IfNotExists: $4.(int) == 1,
      Database: string($5),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CREATE TABLE table_name as_of_opt
  {
    showTablesOpt := &ShowTablesOpt{AsOf:tryCastExpr($5)}
    $$ = &Show{
      Type: CreateTableStr,
      Table: $4.(TableName),
      ShowTablesOpt: showTablesOpt,
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CREATE PROCEDURE table_name
  {
    tableName := $4.(TableName)
    $$ = &Show{
      Type: CreateProcedureStr,
      Table: $4.(TableName),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW_CREATE_PROCEDURE,
        TargetType: AuthTargetType_Ignore,
        TargetNames: []string{tableName.DbQualifier.String()},
      },
    }
  }
| SHOW CREATE TRIGGER table_name
  {
    $$ = &Show{
      Type: CreateTriggerStr,
      Table: $4.(TableName),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CREATE VIEW table_name
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Table: $4.(TableName),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW CREATE EVENT table_name
  {
    $$ = &Show{
      Type: CreateEventStr,
      Table: $4.(TableName),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW DATABASES like_or_where_opt
  {
    $$ = &Show{
      Type: string($2),
      Filter: $3.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW SCHEMAS
  {
    $$ = &Show{
      Type: string($2),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW ENGINES
  {
    $$ = &Show{
      Type: string($2),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW indexes_or_keys from_or_in table_name show_database_opt where_expression_opt
  {
    $$ = &Show{
      Type: IndexStr,
      Table: $4.(TableName),
      Database: $5.(string),
      ShowIndexFilterOpt: tryCastExpr($6),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW PLUGINS
  {
    $$ = &Show{
      Type: string($2),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW PROCEDURE STATUS like_or_where_opt
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Filter: $4.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW REPLICA STATUS
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION_CLIENT,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| SHOW SLAVE STATUS
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION_CLIENT,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| SHOW FUNCTION STATUS like_or_where_opt
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Filter: $4.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW show_session_or_global STATUS like_or_where_opt
  {
    $$ = &Show{
      Scope: $2.(string),
      Type: string($3),
      Filter: $4.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW TABLE STATUS from_database_opt like_or_where_opt
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Database: $4.(string),
      Filter:$5.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW full_opt columns_or_fields FROM table_name from_database_opt as_of_opt like_or_where_opt
  {
    showTablesOpt := &ShowTablesOpt{DbName:$6.(string), AsOf:tryCastExpr($7), Filter:$8.(*ShowFilter)}
    $$ = &Show{
      Type: string($3.(string)),
      ShowTablesOpt: showTablesOpt,
      Table: $5.(TableName),
      Full: $2.(bool),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW full_opt TABLES from_database_opt as_of_opt like_or_where_opt
  {
    showTablesOpt := &ShowTablesOpt{DbName: $4.(string), Filter: $6.(*ShowFilter), AsOf: tryCastExpr($5)}
    $$ = &Show{
      Type: string($3),
      ShowTablesOpt: showTablesOpt,
      Full: $2.(bool),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW full_opt PROCESSLIST
  {
    $$ = &Show{
      Type: string($3),
      Full: $2.(bool),
      Auth: AuthInformation{
        AuthType: AuthType_PROCESS,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| SHOW TRIGGERS from_database_opt like_or_where_opt
  {
    $$ = &Show{
      Type: string($2),
      ShowTablesOpt: &ShowTablesOpt{
        DbName: $3.(string),
        Filter: $4.(*ShowFilter),
      },
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW show_session_or_global VARIABLES like_or_where_opt
  {
    $$ = &Show{
      Scope: $2.(string),
      Type: string($3),
      Filter: $4.(*ShowFilter),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW COLLATION
  {
    $$ = &Show{
      Type: string($2),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW COLLATION WHERE expression
  {
    $$ = &Show{
      Type: string($2),
      ShowCollationFilterOpt: tryCastExpr($4),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW COLLATION naked_like
  {
    cmp := tryCastExpr($3).(*ComparisonExpr)
    cmp.Left = &ColName{Name: NewColIdent("collation")}
    $$ = &Show{
      Type: string($2),
      ShowCollationFilterOpt: cmp,
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW GRANTS
  {
    $$ = &ShowGrants{
      Auth: AuthInformation{
        AuthType: AuthType_SELECT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{"mysql"},
      },
    }
  }
| SHOW GRANTS FOR account_name
  {
    an := $4.(AccountName)
    $$ = &ShowGrants{
      For: &an,
      Auth: AuthInformation{
        AuthType: AuthType_SELECT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{"mysql"},
      },
    }
  }
| SHOW GRANTS FOR CURRENT_USER func_parens_opt
  {
    $$ = &ShowGrants{
      CurrentUser: true,
      Auth: AuthInformation{
        AuthType: AuthType_SELECT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{"mysql"},
      },
    }
  }
| SHOW GRANTS FOR account_name USING role_name_list
  {
    an := $4.(AccountName)
    $$ = &ShowGrants{
      For: &an,
      Using: $6.([]AccountName),
      Auth: AuthInformation{
        AuthType: AuthType_SELECT,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{"mysql"},
      },
    }
  }
| SHOW PRIVILEGES
  {
    $$ = &ShowPrivileges{
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW COUNT openb '*' closeb WARNINGS
  {
    $$ = &Show{
      Type: string($6),
      CountStar: true,
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW COUNT openb '*' closeb ERRORS
  {
    $$ = &Show{
      Type: string($6),
      CountStar: true,
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW WARNINGS limit_opt
  {
    $$ = &Show{
      Type: string($2),
      Limit: $3.(*Limit),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW ERRORS limit_opt
  {
    $$ = &Show{
      Type: string($2),
      Limit: $3.(*Limit),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW EVENTS from_database_opt like_or_where_opt
  {
    $$ = &Show{
      Type: string($2),
      ShowTablesOpt: &ShowTablesOpt{
        DbName: $3.(string),
        Filter: $4.(*ShowFilter),
      },
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW REPLICAS
  {
    $$ = &Show{
      Type: string($2),
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW BINARY LOG STATUS
  {
    $$ = &Show{
      Type: string($2) + " " + string($3) + " " + string($4),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION_CLIENT,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| SHOW MASTER STATUS
  {
    $$ = &Show{
      Type: "BINARY LOG STATUS",
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }
| SHOW BINARY LOGS
  {
    $$ = &Show{
      Type: string($2) + " " + string($3),
      Auth: AuthInformation{
        AuthType: AuthType_REPLICATION_CLIENT,
        TargetType: AuthTargetType_Global,
      },
    }
  }

naked_like:
LIKE value_expression like_escape_opt
  {
    $$ = &ComparisonExpr{Operator: LikeStr, Right: tryCastExpr($2), Escape: tryCastExpr($3)}
  }

full_opt:
  /* empty */
  {
    $$ = false
  }
| FULL
  {
    $$ = true
  }

columns_or_fields:
  COLUMNS
  {
      $$ = string($1)
  }
| FIELDS
  {
      $$ = string($1)
  }

from_database_opt:
  /* empty */
  {
    $$ = ""
  }
| FROM table_id
  {
    $$ = $2.(TableIdent).v
  }
| IN table_id
  {
    $$ = $2.(TableIdent).v
  }

like_or_where_opt:
  /* empty */
  {
    $$ = (*ShowFilter)(nil)
  }
| LIKE STRING
  {
    $$ = &ShowFilter{Like:string($2)}
  }
| LIKE underscore_charsets STRING
  {
    $$ = &ShowFilter{Like:string($3)}
  }
| WHERE expression
  {
    $$ = &ShowFilter{Filter:tryCastExpr($2)}
  }

show_session_or_global:
  /* empty */
  {
    $$ = ""
  }
| SESSION
  {
    $$ = SessionStr
  }
| GLOBAL
  {
    $$ = GlobalStr
  }

use_statement:
  USE table_id
  {
    tableIdent := $2.(TableIdent)
    $$ = &Use{
      DBName: tableIdent,
      Auth: AuthInformation{
        AuthType: AuthType_VISIBLE,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{tableIdent.String()},
      },
    }
  }
| USE table_id '/' table_id
  {
    firstTableIdent := $2.(TableIdent)
    tableIdent := TableIdent{v: firstTableIdent.v+"/"+$4.(TableIdent).v}
    $$ = &Use{
      DBName: tableIdent,
      Auth: AuthInformation{
        AuthType: AuthType_VISIBLE,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{firstTableIdent.String()},
      },
    }
  }
| USE
  {
    $$ = &Use{
      DBName: TableIdent{v:""},
      Auth: AuthInformation{
        AuthType: AuthType_VISIBLE,
        TargetType: AuthTargetType_DatabaseIdentifiers,
        TargetNames: []string{""},
      },
    }
  }

work_opt:
  {
    $$ = []byte(nil)
  }
| WORK
  {
    $$ = $1
  }

begin_statement:
  BEGIN work_opt
  {
    $$ = &Begin{}
  }
| start_transaction_statement
  {
    $$ = tryCastStatement($1)
  }

start_transaction_statement:
  START TRANSACTION
  {
    $$ = &Begin{}
  }
| START TRANSACTION READ WRITE
  {
    $$ = &Begin{TransactionCharacteristic: TxReadWrite}
  }
 | START TRANSACTION READ ONLY
  {
    $$ = &Begin{TransactionCharacteristic: TxReadOnly}
  }
| START TRANSACTION WITH CONSISTENT SNAPSHOT
  {
    $$ = &Begin{}
  }

no_opt:
  {
    $$ = []byte(nil)
  }
| NO
  {
    $$ = []byte(nil)
  }

chain_opt:
  {
    $$ = []byte(nil)
  }
| AND no_opt CHAIN
  {
    $$ = []byte(nil)
  }

release_opt:
  {
    $$ = []byte(nil)
  }
| no_opt RELEASE
  {
    $$ = []byte(nil)
  }

commit_statement:
  COMMIT work_opt chain_opt release_opt
  {
    $$ = &Commit{}
  }

rollback_statement:
  ROLLBACK work_opt chain_opt release_opt
  {
    $$ = &Rollback{}
  }

savepoint_statement:
  SAVEPOINT ID
  {
    $$ = &Savepoint{Identifier: string($2)}
  }

rollback_savepoint_statement:
  ROLLBACK TO ID
  {
    $$ = &RollbackSavepoint{Identifier: string($3)}
  }
| ROLLBACK WORK TO ID
  {
    $$ = &RollbackSavepoint{Identifier: string($4)}
  }
| ROLLBACK TO SAVEPOINT ID
  {
    $$ = &RollbackSavepoint{Identifier: string($4)}
  }
| ROLLBACK WORK TO SAVEPOINT ID
  {
    $$ = &RollbackSavepoint{Identifier: string($5)}
  }

release_savepoint_statement:
  RELEASE SAVEPOINT ID
  {
    $$ = &ReleaseSavepoint{Identifier: string($3)}
  }

explain_statement:
  explain_verb format_opt plan_opt explainable_statement
  {
    $$ = &Explain{ExplainFormat: $2.(string), Plan: $3.(bool), Statement: tryCastStatement($4)}
  }
| explain_verb EXTENDED format_opt plan_opt explainable_statement
  {
    $$ = &Explain{ExplainFormat: $3.(string), Plan: $4.(bool), Statement: tryCastStatement($5)}
  }
| explain_verb ANALYZE plan_opt select_statement_with_no_trailing_into
  {
    $$ = &Explain{Analyze: true, Plan: $3.(bool), ExplainFormat: TreeStr, Statement: $4.(SelectStatement)}
  }

explainable_statement:
  select_statement
  {
    $$ = $1.(SelectStatement)
  }
| delete_statement
| insert_statement
| update_statement

format_opt:
  {
    $$ = ""
  }
| FORMAT '=' ID
  {
    $$ = string($3)
  }

plan_opt:
  {
    $$ = false
  }
| PLAN
  {
    $$ = true
  }

explain_verb:
  EXPLAIN
| DESCRIBE
| DESC

describe_statement:
  explain_verb table_name as_of_opt
  // rewrite describe table as show columns from table
  {
    showTablesOpt := &ShowTablesOpt{AsOf:tryCastExpr($3)}
    $$ = &Show{
      Type: "columns",
      Table: $2.(TableName),
      ShowTablesOpt: showTablesOpt,
      Auth: AuthInformation{
        AuthType: AuthType_SHOW,
        TargetType: AuthTargetType_TODO,
      },
    }
  }

// XXXX: the skipped '|' delimiter in comment_opt and
// non-standard list empty terminal pattern in comment_list
// are intentional. The empty terminal means the rule will
// always reduce, and the skipped delimiter acts as a entry/
// exit for enabling COMMENT tokens to be consumed rather
// than skipped.
comment_opt:
  {
    setAllowComments(yylex, true)
  }
 comment_list
  {
    // this is an extension of the previous rule, so
    // we use $2 here
    $$ = $2
    setAllowComments(yylex, false)
  }

comment_list:
 {
    $$ = Comments(nil)
 }
| comment_list COMMENT
  {
    $$ = append($1.(Comments), $2)
  }

union_op:
  UNION
  {
    $$ = UnionStr
  }
| UNION ALL
  {
    $$ = UnionAllStr
  }
| UNION DISTINCT
  {
    $$ = UnionDistinctStr
  }

intersect_op:
  INTERSECT
  {
    $$ = IntersectStr
  }
| INTERSECT ALL
  {
    $$ = IntersectAllStr
  }
| INTERSECT DISTINCT
  {
    $$ = IntersectDistinctStr
  }

except_op:
  EXCEPT
  {
    $$ = ExceptStr
  }
| EXCEPT ALL
  {
    $$ = ExceptAllStr
  }
| EXCEPT DISTINCT
  {
    $$ = ExceptDistinctStr
  }

query_opts:
  {
    $$ = QueryOpts{}
  }
| query_opts ALL
  {
    opt := QueryOpts{All: true}
    qo := $1.(QueryOpts)
    qop := &qo
    if err := qop.merge(opt); err != nil {
    	yylex.Error(err.Error())
	return 1
    }
    $$ = qo
  }
| query_opts DISTINCT
  {
    opt := QueryOpts{Distinct: true}
    qo := $1.(QueryOpts)
    qop := &qo
    if err := qop.merge(opt); err != nil {
    	yylex.Error(err.Error())
	return 1
    }
    $$ = qo
  }
| query_opts STRAIGHT_JOIN
  {
    opt := QueryOpts{StraightJoinHint: true}
    qo := $1.(QueryOpts)
    qop := &qo
    if err := qop.merge(opt); err != nil {
    	yylex.Error(err.Error())
	return 1
    }
    $$ = qo
  }
| query_opts SQL_CALC_FOUND_ROWS
  {
    opt := QueryOpts{SQLCalcFoundRows: true}
    qo := $1.(QueryOpts)
    qop := &qo
    if err := qop.merge(opt); err != nil {
    	yylex.Error(err.Error())
	return 1
    }
    $$ = qo
  }
| query_opts SQL_CACHE
  {
    opt := QueryOpts{SQLCache: true}
    qo := $1.(QueryOpts)
    qop := &qo
    if err := qop.merge(opt); err != nil {
    	yylex.Error(err.Error())
	return 1
    }
    $$ = qo
  }
| query_opts SQL_NO_CACHE
  {
    opt := QueryOpts{SQLNoCache: true}
    qo := $1.(QueryOpts)
    qop := &qo
    if err := qop.merge(opt); err != nil {
    	yylex.Error(err.Error())
	return 1
    }
    $$ = qo
  }

distinct_opt:
  {
    $$ = ""
  }
| ALL
  {
    $$ = AllStr
  }
| DISTINCT
  {
    $$ = DistinctStr
  }

select_expression_list:
  lexer_old_position select_expression lexer_old_position
  {
    if ae, ok := $2.(SelectExpr).(*AliasedExpr); ok {
      ae.StartParsePos = $1.(int)
      ae.EndParsePos = $3.(int)-1
    }
    $$ = SelectExprs{$2.(SelectExpr)}
  }
| select_expression_list ',' lexer_old_position select_expression lexer_old_position
  {
    if ae, ok := $4.(SelectExpr).(*AliasedExpr); ok {
      ae.StartParsePos = $3.(int)
      ae.EndParsePos = $5.(int)-1
    }
    $$ = append($$.(SelectExprs), $4.(SelectExpr))
  }

// argument_expression is identical to select_expression except aliases are not allowed
argument_expression:
  '*'
  {
    $$ = &StarExpr{}
  }
| expression
  {
    $$ = &AliasedExpr{Expr: tryCastExpr($1)}
  }
| table_id '.' '*'
  {
    $$ = &StarExpr{TableName: TableName{Name: $1.(TableIdent)}}
  }
| table_id '.' reserved_table_id '.' '*'
  {
    $$ = &StarExpr{TableName: TableName{DbQualifier: $1.(TableIdent), Name: $3.(TableIdent)}}
  }

select_expression:
  '*'
  {
    $$ = &StarExpr{}
  }
| expression as_ci_opt
  {
    $$ = &AliasedExpr{Expr: tryCastExpr($1), As: $2.(ColIdent)}
  }
| table_id '.' '*'
  {
    $$ = &StarExpr{TableName: TableName{Name: $1.(TableIdent)}}
  }
| table_id '.' reserved_table_id '.' '*'
  {
    $$ = &StarExpr{TableName: TableName{DbQualifier: $1.(TableIdent), Name: $3.(TableIdent)}}
  }

over:
  OVER sql_id
  {
    $$ = &Over{NameRef: $2.(ColIdent)}
  }
| OVER window_spec
  {
    $$ = (*Over)($2.(*WindowDef))
  }

window_spec:
  openb existing_window_name_opt partition_by_opt order_by_opt frame_opt closeb
  {
    $$ = &WindowDef{NameRef: $2.(ColIdent), PartitionBy: $3.(Exprs), OrderBy: $4.(OrderBy), Frame: $5.(*Frame)}
  }

existing_window_name_opt:
  {
    $$ = ColIdent{}
  }
| ID {
    $$ = NewColIdent(string($1))
  }

partition_by_opt:
  {
    $$ = Exprs(nil)
  }
| PARTITION BY expression_list
  {
    $$ = $3.(Exprs)
  }

over_opt:
  {
    $$ = (*Over)(nil)
  }
| over
  {
    $$ = $1.(*Over)
  }

frame_opt:
  {
    $$ = (*Frame)(nil)
  }
| ROWS frame_extent
  {
    $$ = &Frame{Unit: RowsUnit, Extent: $2.(*FrameExtent)}
  }
| RANGE frame_extent
  {
    $$ = &Frame{Unit: RangeUnit, Extent: $2.(*FrameExtent)}
  }

// enforce PRECEDING < CURRENT ROW < FOLLOWING
frame_extent:
  BETWEEN frame_bound AND frame_bound
  {
    startBound := $2.(*FrameBound)
    endBound := $4.(*FrameBound)
    switch {
    case startBound.Type == UnboundedFollowing:
      yylex.Error("frame start cannot be UNBOUNDED FOLLOWING")
      return 1
    case endBound.Type == UnboundedPreceding:
      yylex.Error("frame end cannot be UNBOUNDED PRECEDING")
      return 1
    case startBound.Type == CurrentRow && endBound.Type == ExprPreceding:
      yylex.Error("frame starting from current row cannot have preceding rows")
      return 1
    case startBound.Type == ExprFollowing && endBound.Type == ExprPreceding:
      yylex.Error("frame starting from following row cannot have preceding rows")
      return 1
    case startBound.Type == ExprFollowing && endBound.Type == CurrentRow:
      yylex.Error("frame starting from following row cannot have preceding rows")
      return 1
    }
    $$ = &FrameExtent{Start: startBound, End: endBound}
  }
| frame_bound
  {
    startBound := $1.(*FrameBound)
     switch {
     case startBound.Type == UnboundedFollowing:
       yylex.Error("frame start cannot be UNBOUNDED FOLLOWING")
       return 1
     case startBound.Type == ExprFollowing:
       yylex.Error("frame starting from following row cannot end with current row")
       return 1
     }
     $$ = &FrameExtent{Start: startBound}
  }

frame_bound:
UNBOUNDED PRECEDING
  {
    $$ = &FrameBound{Type: UnboundedPreceding}
  }
| UNBOUNDED FOLLOWING
  {
    $$ = &FrameBound{Type: UnboundedFollowing}
  }
| CURRENT ROW
  {
    $$ = &FrameBound{Type: CurrentRow}
  }
| integral_or_interval_expr PRECEDING
  {
    $$ = &FrameBound{
       Expr: tryCastExpr($1),
       Type: ExprPreceding,
     }
  }
| integral_or_interval_expr FOLLOWING
  {
    $$ = &FrameBound{
       Expr: tryCastExpr($1),
       Type: ExprFollowing,
     }
  }

window_opt:
  {
  $$ = Window(nil)
  }
| WINDOW window {
  $$ = $2.(Window)
  }

window:
  window_definition
  {
    $$ = Window{$1.(*WindowDef)}
  }
| window ',' window_definition {
    $$ = append($1.(Window), $3.(*WindowDef))
  }

window_definition:
  sql_id AS window_spec
  {
    def := $3.(*WindowDef)
    def.Name = $1.(ColIdent)
    $$ = def
  }

date_datetime_time_timestamp:
  DATE
| DATETIME
| TIME
| TIMESTAMP

time_unit:
  non_microsecond_time_unit
| MICROSECOND
| SECOND_MICROSECOND
| MINUTE_MICROSECOND
| HOUR_MICROSECOND
| DAY_MICROSECOND

non_microsecond_time_unit:
  YEAR
| QUARTER
| MONTH
| DAY
| HOUR
| MINUTE
| WEEK
| SECOND
| YEAR_MONTH
| DAY_HOUR
| DAY_MINUTE
| DAY_SECOND
| HOUR_MINUTE
| HOUR_SECOND
| MINUTE_SECOND

// TODO : support prepared statements
integral_or_interval_expr:
  INTEGRAL
  {
    $$ = NewIntVal($1)
  }
| INTERVAL value time_unit
  {
    $$ = &IntervalExpr{Expr: tryCastExpr($2), Unit: string($3)}
  }

as_ci_opt:
  {
    $$ = ColIdent{}
  }
| col_alias
  {
    $$ = $1.(ColIdent)
  }
| AS col_alias
  {
    $$ = $2.(ColIdent)
  }
| AS ESCAPE
  {
    $$ = NewColIdent(string($2))
  }

col_alias:
  ID
  {
    $$ = NewColIdent(string($1))
  }
| STRING
  {
    $$ = NewColIdent(string($1))
  }
| all_non_reserved
  {
    $$ = NewColIdent(string($1))
  }

table_references:
  table_reference
  {
    $$ = TableExprs{$1.(TableExpr)}
  }
| table_references ',' table_reference
  {
    $$ = append($$.(TableExprs), $3.(TableExpr))
  }

table_reference:
  table_factor
| join_table

table_factor:
  aliased_table_name
  {
    $$ = $1.(*AliasedTableExpr)
  }
| subquery_or_values as_opt table_alias column_list_opt
  {
    switch n := $1.(SimpleTableExpr).(type) {
    case *Subquery:
        n.Columns = $4.(Columns)
    case *ValuesStatement:
        n.Columns = $4.(Columns)
    }
    $$ = &AliasedTableExpr{
      Lateral: false,
      Expr:$1.(SimpleTableExpr),
      As: $3.(TableIdent),
      Auth: AuthInformation{AuthType: AuthType_IGNORE},
    }
  }
| LATERAL subquery_or_values as_opt table_alias column_list_opt
  {
    switch n := $2.(SimpleTableExpr).(type) {
    case *Subquery:
        n.Columns = $5.(Columns)
    case *ValuesStatement:
        n.Columns = $5.(Columns)
    }
    $$ = &AliasedTableExpr{
      Lateral: true,
      Expr:$2.(SimpleTableExpr),
      As: $4.(TableIdent),
      Auth: AuthInformation{AuthType: AuthType_IGNORE},
    }
  }
| subquery_or_values
  {
    // missed alias for subquery
    yylex.Error("Every derived table must have its own alias")
    return 1
  }
| LATERAL subquery_or_values
  {
    // missed alias for subquery
    yylex.Error("Every derived table must have its own alias")
    return 1
  }
| openb table_references closeb
  {
    $$ = &ParenTableExpr{Exprs: $2.(TableExprs)}
  }
| table_function
| json_table

values_statement:
  VALUES row_list
  {
    $$ = &ValuesStatement{Rows: $2.(Values)}
  }

row_list:
  row_opt row_tuple
  {
    $$ = Values{$2.(ValTuple)}
  }
| row_list ',' row_opt row_tuple
  {
    $$ = append($$.(Values), $4.(ValTuple))
  }

row_opt:
  {}
| ROW
  {}

aliased_table_name:
  table_name aliased_table_options
  {
    $$ = $2.(*AliasedTableExpr)
    tableName := $1.(TableName)
    $$.(*AliasedTableExpr).Expr = tableName
    $$.(*AliasedTableExpr).Auth = AuthInformation{
      TargetType: AuthTargetType_SingleTableIdentifier,
      TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
    }
  }
| table_name PARTITION openb partition_list closeb aliased_table_options
  {
    $$ = $6.(*AliasedTableExpr)
    tableName := $1.(TableName)
    $$.(*AliasedTableExpr).Expr = tableName
    $$.(*AliasedTableExpr).Partitions = $4.(Partitions)
    $$.(*AliasedTableExpr).Auth = AuthInformation{
      TargetType: AuthTargetType_SingleTableIdentifier,
      TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
    }
  }

// All possible combinations of qualifiers for a table alias expression, declared in a single rule to avoid
// shift/reduce conflicts.
aliased_table_options:
  index_hint_list
  {
    $$ = &AliasedTableExpr{Hints: $1.(*IndexHints)}
  }
| as_opt table_alias index_hint_list
  {
    $$ = &AliasedTableExpr{As: $2.(TableIdent), Hints: $3.(*IndexHints)}
  }
| as_of_clause index_hint_list
  {
    $$ = &AliasedTableExpr{AsOf: $1.(*AsOf), Hints: $2.(*IndexHints)}
  }
| as_of_clause as_opt table_alias index_hint_list
  {
    $$ = &AliasedTableExpr{AsOf: $1.(*AsOf), As: $3.(TableIdent), Hints: $4.(*IndexHints)}
  }

as_of_clause:
  as_of_point_clause
  {
    $$ = $1.(*AsOf)
  }
| between_times
  {
    $$ = $1.(*AsOf)
  }
| between_versions
  {
    $$ = $1.(*AsOf)
  }
| all_times
  {
    $$ = $1.(*AsOf)
  }
| all_versions
  {
    $$ = $1.(*AsOf)
  }

between_times:
  FOR_SYSTEM_TIME BETWEEN value_expression AND value_expression
  {
    $$ = &AsOf{Start: tryCastExpr($3), End: tryCastExpr($5), EndInclusive: true}
  }
| FOR_SYSTEM_TIME FROM value_expression TO value_expression
  {
    $$ = &AsOf{Start: tryCastExpr($3), End: tryCastExpr($5)}
  }
| FOR_SYSTEM_TIME CONTAINED IN openb value_expression ',' value_expression closeb
  {
    $$ = &AsOf{Start: tryCastExpr($5), End: tryCastExpr($7), StartInclusive: true, EndInclusive: true}
  }

between_versions:
  FOR_VERSION BETWEEN value_expression AND value_expression
  {
    $$ = &AsOf{Start: tryCastExpr($3), End: tryCastExpr($5), EndInclusive: true}
  }
| FOR_VERSION FROM value_expression TO value_expression
  {
    $$ = &AsOf{Start: tryCastExpr($3), End: tryCastExpr($5)}
  }
| FOR_VERSION CONTAINED IN openb value_expression ',' value_expression closeb
  {
    $$ = &AsOf{Start: tryCastExpr($5), End: tryCastExpr($7), StartInclusive: true, EndInclusive: true}
  }
| VERSIONS BETWEEN value_expression AND value_expression
  {
    $$ = &AsOf{Start: tryCastExpr($3), End: tryCastExpr($5), EndInclusive: true}
  }
| VERSIONS FROM value_expression TO value_expression
  {
    $$ = &AsOf{Start: tryCastExpr($3), End: tryCastExpr($5)}
  }
| VERSIONS CONTAINED IN openb value_expression ',' value_expression closeb
  {
    $$ = &AsOf{Start: tryCastExpr($5), End: tryCastExpr($7), StartInclusive: true, EndInclusive: true}
  }

all_times:
  FOR_SYSTEM_TIME ALL
  {
    $$ = &AsOf{All: true}
  }

all_versions:
  FOR_VERSION ALL
  {
    $$ = &AsOf{All: true}
  }
| VERSIONS ALL
  {
    $$ = &AsOf{All: true}
  }

as_of_point_clause:
  AS OF value_expression
  {
    $$ = &AsOf{Time: tryCastExpr($3)}
  }
| FOR_SYSTEM_TIME AS OF value_expression
  {
    $$ = &AsOf{Time: tryCastExpr($4)}
  }
| FOR_VERSION AS OF value_expression
  {
    $$ = &AsOf{Time: tryCastExpr($4)}
  }

as_of_opt:
  {
    $$ = Expr(nil)
  }
| as_of_point_clause
  {
    $$ = $1.(*AsOf).Time
  }

paren_column_list:
  '(' column_list ')'
  {
    $$ = $2.(Columns)
  }
| column_list
  {
    $$ = $1.(Columns)
  }

column_list_opt:
  {
    $$ = Columns(nil)
  }
| '(' column_list ')'
  {
    $$ = $2.(Columns)
  }

column_list:
  sql_id
  {
    $$ = Columns{$1.(ColIdent)}
  }
| column_list ',' sql_id
  {
    $$ = append($$.(Columns), $3.(ColIdent))
  }

partition_list:
  sql_id
  {
    $$ = Partitions{$1.(ColIdent)}
  }
| partition_list ',' sql_id
  {
    $$ = append($$.(Partitions), $3.(ColIdent))
  }

table_function:
  ID openb argument_expression_list_opt closeb
  {
    $$ = &TableFuncExpr{Name: string($1), Exprs: $3.(SelectExprs)}
  }
| ID openb argument_expression_list_opt closeb as_opt table_alias
  {
    $$ = &TableFuncExpr{Name: string($1), Exprs: $3.(SelectExprs), Alias: $6.(TableIdent)}
  }


// There is a grammar conflict here:
// 1: INSERT INTO a SELECT * FROM b JOIN c ON b.i = c.i
// 2: INSERT INTO a SELECT * FROM b JOIN c ON DUPLICATE KEY UPDATE a.i = 1
// When yacc encounters the ON clause, it cannot determine which way to
// resolve. The %prec override below makes the parser choose the
// first construct, which automatically makes the second construct a
// syntax error. This is the same behavior as MySQL.
join_table:
  table_reference inner_join table_factor join_condition_opt
  {
    $$ = &JoinTableExpr{LeftExpr: $1.(TableExpr), Join: $2.(string), RightExpr: $3.(TableExpr), Condition: $4.(JoinCondition)}
  }
| table_reference straight_join table_factor on_expression_opt
  {
    $$ = &JoinTableExpr{LeftExpr: $1.(TableExpr), Join: $2.(string), RightExpr: $3.(TableExpr), Condition: $4.(JoinCondition)}
  }
| table_reference outer_join table_reference join_condition
  {
    $$ = &JoinTableExpr{LeftExpr: $1.(TableExpr), Join: $2.(string), RightExpr: $3.(TableExpr), Condition: $4.(JoinCondition)}
  }
| table_reference natural_join table_factor
  {
    $$ = &JoinTableExpr{LeftExpr: $1.(TableExpr), Join: $2.(string), RightExpr: $3.(TableExpr)}
  }

join_condition:
  ON expression
  { $$ = JoinCondition{On: tryCastExpr($2)} }
| USING '(' column_list ')'
  { $$ = JoinCondition{Using: $3.(Columns)} }

join_condition_opt:
%prec JOIN
  { $$ = JoinCondition{} }
| join_condition
  { $$ = $1.(JoinCondition) }

on_expression_opt:
%prec JOIN
  { $$ = JoinCondition{} }
| ON expression
  { $$ = JoinCondition{On: tryCastExpr($2)} }

table_alias:
  table_id
| column_name_safe_keyword
  {
    $$ = NewTableIdent(string($1))
  }
| function_call_keywords
  {
    $$ = NewTableIdent(string($1))
  }

inner_join:
  JOIN
  {
    $$ = JoinStr
  }
| INNER JOIN
  {
    $$ = JoinStr
  }
| CROSS JOIN
  {
    $$ = JoinStr
  }

straight_join:
  STRAIGHT_JOIN
  {
    $$ = StraightJoinStr
  }

outer_join:
  LEFT JOIN
  {
    $$ = LeftJoinStr
  }
| LEFT OUTER JOIN
  {
    $$ = LeftJoinStr
  }
| RIGHT JOIN
  {
    $$ = RightJoinStr
  }
| RIGHT OUTER JOIN
  {
    $$ = RightJoinStr
  }
| FULL OUTER JOIN
  {
    $$ = FullOuterJoinStr
  }
| FULL JOIN
  {
    $$ = FullOuterJoinStr
  }

natural_join:
  NATURAL JOIN
  {
    $$ = NaturalJoinStr
  }
| NATURAL outer_join
  {
    if $2.(string) == LeftJoinStr {
      $$ = NaturalLeftJoinStr
    } else {
      $$ = NaturalRightJoinStr
    }
  }

json_table:
  JSON_TABLE openb value_expression ',' STRING COLUMNS openb json_table_column_list closeb closeb as_opt table_alias
  {
    $8.(*JSONTableSpec).Path = string($5)
    $$ = &JSONTableExpr{Data: tryCastExpr($3), Spec: $8.(*JSONTableSpec), Alias: $12.(TableIdent)}
  }

json_table_column_list:
  json_table_column_definition
  {
    $$ = &JSONTableSpec{}
    $$.(*JSONTableSpec).AddColumn($1.(*JSONTableColDef))
  }
| json_table_column_list ',' json_table_column_definition
  {
    $$.(*JSONTableSpec).AddColumn($3.(*JSONTableColDef))
  }

json_table_column_definition:
  reserved_sql_id column_type json_table_column_options
  {
    $$ = &JSONTableColDef{Name: $1.(ColIdent), Type: $2.(ColumnType), Opts: $3.(JSONTableColOpts)}
  }
| reserved_sql_id FOR ORDINALITY
  {
    $$ = &JSONTableColDef{Name: $1.(ColIdent), Type: ColumnType{Type: "INTEGER", Unsigned: true, Autoincrement: true}}
  }
| NESTED STRING COLUMNS openb json_table_column_list closeb
  {
    $5.(*JSONTableSpec).Path = string($2)
    $$ = &JSONTableColDef{Spec: $5.(*JSONTableSpec)}
  }
| NESTED PATH STRING COLUMNS openb json_table_column_list closeb
  {
    $6.(*JSONTableSpec).Path = string($3)
    $$ = &JSONTableColDef{Spec: $6.(*JSONTableSpec)}
  }

json_table_column_options:
  PATH STRING
  {
    $$ = JSONTableColOpts{Path: string($2)}
  }
| PATH STRING val_on_empty
  {
    $$ = JSONTableColOpts{Path: string($2), ValOnEmpty: tryCastExpr($3)}
  }
| PATH STRING val_on_error
  {
    $$ = JSONTableColOpts{Path: string($2), ValOnError: tryCastExpr($3)}
  }
| PATH STRING val_on_empty val_on_error
  {
    $$ = JSONTableColOpts{Path: string($2), ValOnEmpty: tryCastExpr($3), ValOnError: tryCastExpr($4)}
  }
| PATH STRING val_on_error val_on_empty
  {
    $$ = JSONTableColOpts{Path: string($2), ValOnEmpty: tryCastExpr($4), ValOnError: tryCastExpr($3)}
  }
| PATH STRING ERROR ON EMPTY
  {
    $$ = JSONTableColOpts{Path: string($2), ErrorOnEmpty: true}
  }
| PATH STRING ERROR ON ERROR
  {
    $$ = JSONTableColOpts{Path: string($2), ErrorOnError: true}
  }
| PATH STRING ERROR ON EMPTY ERROR ON ERROR
  {
    $$ = JSONTableColOpts{Path: string($2), ErrorOnEmpty: true, ErrorOnError: true}
  }
| PATH STRING ERROR ON ERROR ERROR ON EMPTY
  {
    $$ = JSONTableColOpts{Path: string($2), ErrorOnEmpty: true, ErrorOnError: true}
  }
| EXISTS PATH STRING
  {
    $$ = JSONTableColOpts{Path: string($3), Exists: true}
  }

val_on_empty:
  NULL ON EMPTY
  {
    $$ = &NullVal{}
  }
| DEFAULT value ON EMPTY
  {
    $$ = tryCastExpr($2)
  }

val_on_error:
  NULL ON ERROR
  {
    $$ = &NullVal{}
  }
| DEFAULT value ON ERROR
  {
    $$ = tryCastExpr($2)
  }

trigger_name:
  sql_id
  {
    $$ = TriggerName{Name: $1.(ColIdent)}
  }
| table_id '.' sql_id
  {
    $$ = TriggerName{Qualifier: $1.(TableIdent), Name: $3.(ColIdent)}
  }

load_into_table_name:
  INTO TABLE table_name
  {
    $$ = $3.(TableName)
  }

into_table_name:
  INTO table_name
  {
    $$ = $2.(TableName)
  }
| table_name
  {
    $$ = $1.(TableName)
  }

table_name:
  table_id
  {
    $$ = TableName{Name: $1.(TableIdent)}
  }
| table_id '.' reserved_table_id
  {
    $$ = TableName{DbQualifier: $1.(TableIdent), Name: $3.(TableIdent)}
  }
| column_name_safe_keyword
  {
    $$ = TableName{Name: NewTableIdent(string($1))}
  }
| non_reserved_keyword2
  {
    $$ = TableName{Name: NewTableIdent(string($1))}
  }
| function_call_keywords
  {
    $$ = TableName{Name: NewTableIdent(string($1))}
  }
| ACCOUNT
  {
    $$ = TableName{Name: NewTableIdent(string($1))}
  }

procedure_name:
  sql_id
  {
    $$ = ProcedureName{Name: $1.(ColIdent)}
  }
| table_id '.' sql_id
  {
    $$ = ProcedureName{Qualifier: $1.(TableIdent), Name: $3.(ColIdent)}
  }

delete_table_name:
table_id '.' '*'
  {
    $$ = TableName{Name: $1.(TableIdent)}
  }

index_hint_list:
  {
    $$ = (*IndexHints)(nil)
  }
| USE INDEX openb column_list closeb
  {
    $$ = &IndexHints{Type: UseStr, Indexes: $4.(Columns)}
  }
| IGNORE INDEX openb column_list closeb
  {
    $$ = &IndexHints{Type: IgnoreStr, Indexes: $4.(Columns)}
  }
| FORCE INDEX openb column_list closeb
  {
    $$ = &IndexHints{Type: ForceStr, Indexes: $4.(Columns)}
  }

where_expression_opt:
  {
    $$ = Expr(nil)
  }
| WHERE expression
  {
    $$ = tryCastExpr($2)
  }

expression:
  condition
  {
    $$ = tryCastExpr($1)
  }
| expression AND expression
  {
    $$ = &AndExpr{Left: tryCastExpr($1), Right: tryCastExpr($3)}
  }
| expression OR expression
  {
    $$ = &OrExpr{Left: tryCastExpr($1), Right: tryCastExpr($3)}
  }
| expression XOR expression
  {
    $$ = &XorExpr{Left: tryCastExpr($1), Right: tryCastExpr($3)}
  }
| NOT expression
  {
    $$ = &NotExpr{Expr: tryCastExpr($2)}
  }
| expression IS is_suffix
  {
    $$ = &IsExpr{Operator: $3.(string), Expr: tryCastExpr($1)}
  }
| value_expression
  {
    $$ = tryCastExpr($1)
  }
| DEFAULT default_opt
  {
    $$ = &Default{ColName: $2.(string)}
  }

default_opt:
  /* empty */
  {
    $$ = ""
  }
| openb ID closeb
  {
    $$ = string($2)
  }

boolean_value:
  TRUE
  {
    $$ = BoolVal(true)
  }
| FALSE
  {
    $$ = BoolVal(false)
  }

condition:
  value_expression compare value_expression
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: $2.(string), Right: tryCastExpr($3)}
  }
| value_expression IN col_tuple
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: InStr, Right: $3.(ColTuple)}
  }
| value_expression NOT IN col_tuple
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: NotInStr, Right: $4.(ColTuple)}
  }
| value_expression LIKE value_expression like_escape_opt
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: LikeStr, Right: tryCastExpr($3), Escape: tryCastExpr($4)}
  }
| value_expression NOT LIKE value_expression like_escape_opt
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: NotLikeStr, Right: tryCastExpr($4), Escape: tryCastExpr($5)}
  }
| value_expression REGEXP value_expression
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: RegexpStr, Right: tryCastExpr($3)}
  }
| value_expression NOT REGEXP value_expression
  {
    $$ = &ComparisonExpr{Left: tryCastExpr($1), Operator: NotRegexpStr, Right: tryCastExpr($4)}
  }
| value_expression BETWEEN value_expression AND value_expression
  {
    $$ = &RangeCond{Left: tryCastExpr($1), Operator: BetweenStr, From: tryCastExpr($3), To: tryCastExpr($5)}
  }
| value_expression NOT BETWEEN value_expression AND value_expression
  {
    $$ = &RangeCond{Left: tryCastExpr($1), Operator: NotBetweenStr, From: tryCastExpr($4), To: tryCastExpr($6)}
  }
| EXISTS subquery
  {
    $$ = &ExistsExpr{Subquery: $2.(*Subquery)}
  }

is_suffix:
  NULL
  {
    $$ = IsNullStr
  }
| NOT NULL
  {
    $$ = IsNotNullStr
  }
| TRUE
  {
    $$ = IsTrueStr
  }
| NOT TRUE
  {
    $$ = IsNotTrueStr
  }
| FALSE
  {
    $$ = IsFalseStr
  }
| NOT FALSE
  {
    $$ = IsNotFalseStr
  }

compare:
  '='
  {
    $$ = EqualStr
  }
| '<'
  {
    $$ = LessThanStr
  }
| '>'
  {
    $$ = GreaterThanStr
  }
| LE
  {
    $$ = LessEqualStr
  }
| GE
  {
    $$ = GreaterEqualStr
  }
| NE
  {
    $$ = NotEqualStr
  }
| NULL_SAFE_EQUAL
  {
    $$ = NullSafeEqualStr
  }

like_escape_opt:
  {
    $$ = Expr(nil)
  }
| ESCAPE value_expression
  {
    $$ = tryCastExpr($2)
  }

col_tuple:
  row_tuple
  {
    $$ = $1.(ValTuple)
  }
| subquery
  {
    $$ = $1.(*Subquery)
  }
| LIST_ARG
  {
    $$ = ListArg($1)
  }

subquery:
  openb select_statement_with_no_trailing_into closeb
  {
    $$ = &Subquery{Select: $2.(SelectStatement)}
  }

subquery_or_values:
  subquery
  {
    $$ = $1.(*Subquery)
  }
| openb values_statement closeb
  {
    $$ = $2.(SimpleTableExpr)
  }

argument_expression_list_opt:
  {
    $$ = SelectExprs(nil)
  }
| argument_expression_list

argument_expression_list:
  argument_expression
  {
    $$ = SelectExprs{$1.(SelectExpr)}
  }
| argument_expression_list ',' argument_expression
  {
    $$ = append($1.(SelectExprs), $3.(SelectExpr))
  }

expression_list:
  expression
  {
    $$ = Exprs{tryCastExpr($1)}
  }
| expression_list ',' expression
  {
    $$ = append($1.(Exprs), tryCastExpr($3))
  }

value_expression:
  value
  {
    $$ = tryCastExpr($1)
  }
| ACCOUNT
  {
    $$ = &ColName{Name: NewColIdent(string($1))}
  }
| FORMAT
  {
    $$ = &ColName{Name: NewColIdent(string($1))}
  }
| boolean_value
  {
    $$ = $1.(BoolVal)
  }
| column_name
  {
    $$ = $1.(*ColName)
  }
| column_name_safe_keyword
  {
    $$ = &ColName{Name: NewColIdent(string($1))}
  }
| tuple_expression
  {
    $$ = tryCastExpr($1)
  }
| subquery
  {
    $$ = $1.(*Subquery)
  }
| value_expression '&' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: BitAndStr, Right: tryCastExpr($3)}
  }
| value_expression '|' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: BitOrStr, Right: tryCastExpr($3)}
  }
| value_expression '^' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: BitXorStr, Right: tryCastExpr($3)}
  }
| value_expression '+' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: PlusStr, Right: tryCastExpr($3)}
  }
| value_expression '-' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: MinusStr, Right: tryCastExpr($3)}
  }
| value_expression '*' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: MultStr, Right: tryCastExpr($3)}
  }
| value_expression '/' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: DivStr, Right: tryCastExpr($3)}
  }
| value_expression DIV value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: IntDivStr, Right: tryCastExpr($3)}
  }
| value_expression '%' value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: ModStr, Right: tryCastExpr($3)}
  }
| value_expression MOD value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: ModStr, Right: tryCastExpr($3)}
  }
| value_expression SHIFT_LEFT value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: ShiftLeftStr, Right: tryCastExpr($3)}
  }
| value_expression SHIFT_RIGHT value_expression
  {
    $$ = &BinaryExpr{Left: tryCastExpr($1), Operator: ShiftRightStr, Right: tryCastExpr($3)}
  }
| column_name JSON_EXTRACT_OP value
  {
    $$ = &BinaryExpr{Left: $1.(*ColName), Operator: JSONExtractOp, Right: tryCastExpr($3)}
  }
| column_name JSON_UNQUOTE_EXTRACT_OP value
  {
    $$ = &BinaryExpr{Left: $1.(*ColName), Operator: JSONUnquoteExtractOp, Right: tryCastExpr($3)}
  }
| value_expression COLLATE charset
  {
    $$ = &CollateExpr{Expr: tryCastExpr($1), Collation: $3.(string)}
  }
| BINARY value_expression %prec UNARY
  {
    $$ = &UnaryExpr{Operator: BinaryStr, Expr: tryCastExpr($2)}
  }
| underscore_charsets value_expression %prec UNARY
  {
    $$ = &UnaryExpr{Operator: $1.(string), Expr: tryCastExpr($2)}
  }
| '+'  value_expression %prec UNARY
  {
    if num, ok := tryCastExpr($2).(*SQLVal); ok && num.Type == IntVal {
      $$ = num
    } else {
      $$ = &UnaryExpr{Operator: UPlusStr, Expr: tryCastExpr($2)}
    }
  }
| '-'  value_expression %prec UNARY
  {
    if num, ok := tryCastExpr($2).(*SQLVal); ok && num.Type == IntVal {
      // Handle double negative
      if num.Val[0] == '-' {
        num.Val = num.Val[1:]
        $$ = num
      } else {
        $$ = NewIntVal(append([]byte("-"), num.Val...))
      }
    } else {
      $$ = &UnaryExpr{Operator: UMinusStr, Expr: tryCastExpr($2)}
    }
  }
| '~'  value_expression
  {
    $$ = &UnaryExpr{Operator: TildaStr, Expr: tryCastExpr($2)}
  }
| '!' value_expression %prec UNARY
  {
    $$ = &UnaryExpr{Operator: BangStr, Expr: tryCastExpr($2)}
  }
| INTERVAL value_expression sql_id
  {
    // This rule prevents the usage of INTERVAL
    // as a function. If support is needed for that,
    // we'll need to revisit this. The solution
    // will be non-trivial because of grammar conflicts.
    $$ = &IntervalExpr{Expr: tryCastExpr($2), Unit: $3.(ColIdent).String()}
  }
| value_expression CONCAT value_expression
  {
     $$ = &FuncExpr{Name: NewColIdent("CONCAT"), Exprs: []SelectExpr{&AliasedExpr{Expr: tryCastExpr($1)}, &AliasedExpr{Expr: tryCastExpr($3)}}}
  }
| function_call_generic
| function_call_keyword
| function_call_nonkeyword
| function_call_conflict
| function_call_window
| function_call_aggregate_with_window

/*
  Regular function calls without special token or syntax, guaranteed to not
  introduce side effects due to being a simple identifier
*/
function_call_generic:
  sql_id openb distinct_opt argument_expression_list_opt closeb
  {
    $$ = &FuncExpr{Name: $1.(ColIdent), Distinct: $3.(string) == DistinctStr, Exprs: $4.(SelectExprs)}
  }
| table_id '.' reserved_sql_id openb argument_expression_list_opt closeb
  {
    $$ = &FuncExpr{Qualifier: $1.(TableIdent), Name: $3.(ColIdent), Exprs: $5.(SelectExprs)}
  }

/*
   Special aggregate function calls that can't be treated like a normal function call, because they have an optional
   OVER clause (not legal on any other non-window, non-aggregate function)
 */
function_call_aggregate_with_window:
 MAX openb distinct_opt argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $4.(SelectExprs), Distinct: $3.(string) == DistinctStr, Over: $6.(*Over)}
  }
| AVG openb distinct_opt argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $4.(SelectExprs), Distinct: $3.(string) == DistinctStr, Over: $6.(*Over)}
  }
| BIT_AND openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| BIT_OR openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| BIT_XOR openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| COUNT openb distinct_opt argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $4.(SelectExprs), Distinct: $3.(string) == DistinctStr, Over: $6.(*Over)}
  }
| JSON_ARRAYAGG openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| JSON_OBJECTAGG openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| MIN openb distinct_opt argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $4.(SelectExprs), Distinct: $3.(string) == DistinctStr, Over: $6.(*Over)}
  }
| STDDEV_POP openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| STDDEV openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| STD openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| STDDEV_SAMP openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| SUM openb distinct_opt argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $4.(SelectExprs), Distinct: $3.(string) == DistinctStr, Over: $6.(*Over)}
  }
| VAR_POP openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| VARIANCE openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| VAR_SAMP openb argument_expression_list closeb over_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }

/*
  Function calls with an OVER expression, only valid for certain aggregate and window functions
*/
function_call_window:
  CUME_DIST openb closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Over: $4.(*Over)}
  }
| DENSE_RANK openb closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Over: $4.(*Over)}
  }
| FIRST_VALUE openb argument_expression closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{$3.(SelectExpr)}, Over: $5.(*Over)}
  }
| LAG openb argument_expression_list closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| LAST_VALUE openb argument_expression closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{$3.(SelectExpr)}, Over: $5.(*Over)}
  }
| LEAD openb argument_expression_list closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| NTH_VALUE openb argument_expression_list closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs), Over: $5.(*Over)}
  }
| NTILE openb argument_expression closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{$3.(SelectExpr)}, Over: $5.(*Over)}
  }
| PERCENT_RANK openb closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Over: $4.(*Over)}
  }
| RANK openb closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Over: $4.(*Over)}
  }
| ROW_NUMBER openb closeb over
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Over: $4.(*Over)}
  }

/*
  Function calls using reserved keywords, with dedicated grammar rules
  as a result
  TODO: some of these change the case or even the name of the function expression. Should be preserved.
*/
function_call_keyword:
  LEFT openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| RIGHT openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| FORMAT openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| GROUPING openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| SCHEMA openb closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1))}
  }
| CONVERT openb expression ',' convert_type closeb
  {
    $$ = &ConvertExpr{Name: string($1), Expr: tryCastExpr($3), Type: $5.(*ConvertType)}
  }
| CAST openb expression AS convert_type closeb
  {
    $$ = &ConvertExpr{Name: string($1), Expr: tryCastExpr($3), Type: $5.(*ConvertType)}
  }
| CHAR openb argument_expression_list closeb
  {
    $$ = &CharExpr{Exprs: $3.(SelectExprs)}
  }
| CHAR openb argument_expression_list USING charset closeb
  {
    $$ = &CharExpr{Exprs: $3.(SelectExprs), Type: $5.(string)}
  }
| CONVERT openb expression USING charset closeb
  {
    $$ = &ConvertUsingExpr{Expr: tryCastExpr($3), Type: $5.(string)}
  }
| POSITION openb value_expression IN value_expression closeb
  {
    $$ = &FuncExpr{Name: NewColIdent("LOCATE"), Exprs: []SelectExpr{&AliasedExpr{Expr: tryCastExpr($3)}, &AliasedExpr{Expr: tryCastExpr($5)}}}
  }
| INSERT openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| SUBSTR openb column_name FROM value_expression FOR value_expression closeb
  {
    $$ = &SubstrExpr{Name: $3.(*ColName), From: tryCastExpr($5), To: tryCastExpr($7)}
  }
| SUBSTRING openb column_name FROM value_expression FOR value_expression closeb
  {
    $$ = &SubstrExpr{Name: $3.(*ColName), From: tryCastExpr($5), To: tryCastExpr($7)}
  }
| SUBSTR openb STRING FROM value_expression FOR value_expression closeb
  {
    $$ = &SubstrExpr{StrVal: NewStrVal($3), From: tryCastExpr($5), To: tryCastExpr($7)}
  }
| SUBSTRING openb STRING FROM value_expression FOR value_expression closeb
  {
    $$ = &SubstrExpr{StrVal: NewStrVal($3), From: tryCastExpr($5), To: tryCastExpr($7)}
  }
| TRIM openb value_expression closeb
  {
    $$ = &TrimExpr{Pattern: NewStrVal([]byte(" ")), Str: tryCastExpr($3), Dir: Both}
  }
| TRIM openb value_expression FROM value_expression closeb
  {
    $$ = &TrimExpr{Pattern: tryCastExpr($3), Str: tryCastExpr($5), Dir: Both}
  }
| TRIM openb LEADING value_expression FROM value_expression closeb
  {
    $$ = &TrimExpr{Pattern: tryCastExpr($4), Str: tryCastExpr($6), Dir: Leading}
  }
| TRIM openb TRAILING value_expression FROM value_expression closeb
  {
    $$ = &TrimExpr{Pattern: tryCastExpr($4), Str: tryCastExpr($6), Dir: Trailing}
  }
| TRIM openb BOTH value_expression FROM value_expression closeb
  {
    $$ = &TrimExpr{Pattern: tryCastExpr($4), Str: tryCastExpr($6), Dir: Both}
  }
| MATCH openb argument_expression_list closeb AGAINST openb value_expression match_option closeb
  {
  $$ = &MatchExpr{Columns: $3.(SelectExprs), Expr: tryCastExpr($7), Option: $8.(string)}
  }
| FIRST openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| GROUP_CONCAT openb distinct_opt argument_expression_list order_by_opt separator_opt closeb
  {
    $$ = &GroupConcatExpr{Distinct: $3.(string), Exprs: $4.(SelectExprs), OrderBy: $5.(OrderBy), Separator: $6.(Separator)}
  }
| CASE expression_opt when_expression_list else_expression_opt END
  {
    $$ = &CaseExpr{Expr: tryCastExpr($2), Whens: $3.([]*When), Else: tryCastExpr($4)}
  }
| VALUES openb column_name closeb
  {
    $$ = &ValuesFuncExpr{Name: $3.(*ColName)}
  }
| VALUES openb column_name_safe_keyword closeb
  {
    $$ = &ValuesFuncExpr{Name: NewColName(string($3))}
  }
// TODO: non_reserved_keyword and non_reserved_keyword2 cause grammar conflicts
| VALUES openb non_reserved_keyword3 closeb
  {
    $$ = &ValuesFuncExpr{Name: NewColName(string($3))}
  }
| REPEAT openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }

/*
  Function calls using non reserved keywords but with special syntax forms.
  Dedicated grammar rules are needed because of the special syntax
*/
function_call_nonkeyword:
// functions that do not support fractional second precision (fsp)
  CURRENT_DATE func_parens_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1))}
  }
| CURRENT_USER func_parens_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1))}
  }
| UTC_DATE func_parens_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1))}
  }
// functions that can be called with optional second argument
| function_call_on_update
  {
    $$ = tryCastExpr($1)
  }
| CURRENT_TIME func_datetime_prec_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: tryCastExpr($2)}}}
  }
| UTC_TIME func_datetime_prec_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: tryCastExpr($2)}}}
  }
| UTC_TIMESTAMP func_datetime_prec_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: tryCastExpr($2)}}}
  }
| TIMESTAMPADD openb time_unit ',' value_expression ',' value_expression closeb
  {
    $$ = &TimestampFuncExpr{Name:string("timestampadd"), Unit:string($3), Expr1:tryCastExpr($5), Expr2:tryCastExpr($7)}
  }
| TIMESTAMPDIFF openb time_unit ',' value_expression ',' value_expression closeb
  {
    $$ = &TimestampFuncExpr{Name:string("timestampdiff"), Unit:string($3), Expr1:tryCastExpr($5), Expr2:tryCastExpr($7)}
  }
| EXTRACT openb time_unit FROM value_expression closeb
  {
    $$ = &ExtractFuncExpr{Name: string($1), Unit: string($3), Expr: tryCastExpr($5)}
  }
| GET_FORMAT openb date_datetime_time_timestamp ',' value_expression closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: NewStrVal($3)}, &AliasedExpr{Expr: tryCastExpr($5)}}}
  }

// functions that can be used with the ON UPDATE clause
function_call_on_update:
  // NOW is special; it can't be called without parentheses
  NOW openb closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1))}
  }
| NOW openb INTEGRAL closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: NewIntVal($3)}}}
  }
| CURRENT_TIMESTAMP func_datetime_prec_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: tryCastExpr($2)}}}
  }
| LOCALTIME func_datetime_prec_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: tryCastExpr($2)}}}
  }
| LOCALTIMESTAMP func_datetime_prec_opt
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: SelectExprs{&AliasedExpr{Expr: tryCastExpr($2)}}}
  }

// Optional parens for certain keyword functions that don't require them.
func_parens_opt:
  /* empty */
| openb closeb

// Optional datetime precision for certain functions.
func_datetime_prec_opt:
  // no arg is the same as 0
  func_parens_opt
  {
    $$ = NewIntVal([]byte("0"))
  }
| openb INTEGRAL closeb
  {
    $$ = NewIntVal($2)
  }

/*
  Function calls using non reserved keywords with *normal* syntax forms. Because
  the names are non-reserved, they need a dedicated rule so as not to conflict
*/
function_call_conflict:
  IF openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| DATABASE openb argument_expression_list_opt closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| MOD openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| REPLACE openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| SUBSTR openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }
| SUBSTRING openb argument_expression_list closeb
  {
    $$ = &FuncExpr{Name: NewColIdent(string($1)), Exprs: $3.(SelectExprs)}
  }

match_option:
/*empty*/
  {
    $$ = ""
  }
| IN BOOLEAN MODE
  {
    $$ = BooleanModeStr
  }
| IN NATURAL LANGUAGE MODE
 {
    $$ = NaturalLanguageModeStr
 }
| IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION
 {
    $$ = NaturalLanguageModeWithQueryExpansionStr
 }
| WITH QUERY EXPANSION
 {
    $$ = QueryExpansionStr
 }

charset:
  ID
{
    $$ = string($1)
}
| STRING
{
    $$ = string($1)
}
| BINARY
{
    $$ = string($1)
}

underscore_charsets:
  UNDERSCORE_ARMSCII8
  {
    $$ = Armscii8Str
  }
| UNDERSCORE_ASCII
  {
    $$ = AsciiStr
  }
| UNDERSCORE_BIG5
  {
    $$ = Big5Str
  }
| UNDERSCORE_BINARY
  {
    $$ = UBinaryStr
  }
| UNDERSCORE_CP1250
  {
    $$ = Cp1250Str
  }
| UNDERSCORE_CP1251
  {
    $$ = Cp1251Str
  }
| UNDERSCORE_CP1256
  {
    $$ = Cp1256Str
  }
| UNDERSCORE_CP1257
  {
    $$ = Cp1257Str
  }
| UNDERSCORE_CP850
  {
    $$ = Cp850Str
  }
| UNDERSCORE_CP852
  {
    $$ = Cp852Str
  }
| UNDERSCORE_CP866
  {
    $$ = Cp866Str
  }
| UNDERSCORE_CP932
  {
    $$ = Cp932Str
  }
| UNDERSCORE_DEC8
  {
    $$ = Dec8Str
  }
| UNDERSCORE_EUCJPMS
  {
    $$ = EucjpmsStr
  }
| UNDERSCORE_EUCKR
  {
    $$ = EuckrStr
  }
| UNDERSCORE_GB18030
  {
    $$ = Gb18030Str
  }
| UNDERSCORE_GB2312
  {
    $$ = Gb2312Str
  }
| UNDERSCORE_GBK
  {
    $$ = GbkStr
  }
| UNDERSCORE_GEOSTD8
  {
    $$ = Geostd8Str
  }
| UNDERSCORE_GREEK
  {
    $$ = GreekStr
  }
| UNDERSCORE_HEBREW
  {
    $$ = HebrewStr
  }
| UNDERSCORE_HP8
  {
    $$ = Hp8Str
  }
| UNDERSCORE_KEYBCS2
  {
    $$ = Keybcs2Str
  }
| UNDERSCORE_KOI8R
  {
    $$ = Koi8rStr
  }
| UNDERSCORE_KOI8U
  {
    $$ = Koi8uStr
  }
| UNDERSCORE_LATIN1
  {
    $$ = Latin1Str
  }
| UNDERSCORE_LATIN2
  {
    $$ = Latin2Str
  }
| UNDERSCORE_LATIN5
  {
    $$ = Latin5Str
  }
| UNDERSCORE_LATIN7
  {
    $$ = Latin7Str
  }
| UNDERSCORE_MACCE
  {
    $$ = MacceStr
  }
| UNDERSCORE_MACROMAN
  {
    $$ = MacromanStr
  }
| UNDERSCORE_SJIS
  {
    $$ = SjisStr
  }
| UNDERSCORE_SWE7
  {
    $$ = Swe7Str
  }
| UNDERSCORE_TIS620
  {
    $$ = Tis620Str
  }
| UNDERSCORE_UCS2
  {
    $$ = Ucs2Str
  }
| UNDERSCORE_UJIS
  {
    $$ = UjisStr
  }
| UNDERSCORE_UTF16
  {
    $$ = Utf16Str
  }
| UNDERSCORE_UTF16LE
  {
    $$ = Utf16leStr
  }
| UNDERSCORE_UTF32
  {
    $$ = Utf32Str
  }
| UNDERSCORE_UTF8
  {
    $$ = Utf8mb3Str
  }
| UNDERSCORE_UTF8MB3
  {
    $$ = Utf8mb3Str
  }
| UNDERSCORE_UTF8MB4
  {
    $$ = Utf8mb4Str
  }

convert_type:
  BINARY length_opt
  {
    $$ = &ConvertType{Type: string($1), Length: $2.(*SQLVal)}
  }
| CHAR length_opt charset_opt
  {
    $$ = &ConvertType{Type: string($1), Length: $2.(*SQLVal), Charset: $3.(string), Operator: CharacterSetStr}
  }
| CHAR length_opt ID
  {
    $$ = &ConvertType{Type: string($1), Length: $2.(*SQLVal), Charset: string($3)}
  }
| CHARACTER length_opt charset_opt
  {
    $$ = &ConvertType{Type: "CHAR", Length: $2.(*SQLVal), Charset: $3.(string), Operator: CharacterSetStr}
  }
| CHARACTER length_opt ID
  {
    $$ = &ConvertType{Type: "CHAR", Length: $2.(*SQLVal), Charset: string($3)}
  }
| DATE
  {
    $$ = &ConvertType{Type: string($1)}
  }
| DATETIME length_opt
  {
    $$ = &ConvertType{Type: string($1), Length: $2.(*SQLVal)}
  }
| DECIMAL decimal_length_opt
  {
    ct := &ConvertType{Type: string($1)}
    ct.Length = $2.(LengthScaleOption).Length
    ct.Scale = $2.(LengthScaleOption).Scale
    $$ = ct
  }
| DOUBLE
  {
    $$ = &ConvertType{Type: string($1)}
  }
| DOUBLE PRECISION
  {
    $$ = &ConvertType{Type: string($1)}
  }
| REAL
  {
    $$ = &ConvertType{Type: string($1)}
  }
| FLOAT_TYPE
  {
    $$ = &ConvertType{Type: string($1)}
  }
| JSON
  {
    $$ = &ConvertType{Type: string($1)}
  }
| NCHAR length_opt
  {
    $$ = &ConvertType{Type: string($1), Length: $2.(*SQLVal)}
  }
| SIGNED
  {
    $$ = &ConvertType{Type: string($1)}
  }
| SIGNED INTEGER
  {
    $$ = &ConvertType{Type: string($1)}
  }
| TIME length_opt
  {
    $$ = &ConvertType{Type: string($1), Length: $2.(*SQLVal)}
  }
| UNSIGNED
  {
    $$ = &ConvertType{Type: string($1)}
  }
| UNSIGNED INTEGER
  {
    $$ = &ConvertType{Type: string($1)}
  }
| YEAR
  {
    $$ = &ConvertType{Type: string($1)}
  }

char_or_character:
  CHAR
  {
    $$ = $1
  }
| CHARACTER
  {
    $$ = $1
  }

expression_opt:
  {
    $$ = Expr(nil)
  }
| expression
  {
    $$ = tryCastExpr($1)
  }

separator_opt:
  {
    $$ = Separator{SeparatorString: "", DefaultSeparator: true}
  }
| SEPARATOR STRING
  {
    $$ = Separator{SeparatorString: string($2), DefaultSeparator: false}
  }

when_expression_list:
  when_expression
  {
    $$ = []*When{$1.(*When)}
  }
| when_expression_list when_expression
  {
    $$ = append($1.([]*When), $2.(*When))
  }

when_expression:
  WHEN expression THEN expression
  {
    $$ = &When{Cond: tryCastExpr($2), Val: tryCastExpr($4)}
  }

else_expression_opt:
  {
    $$ = Expr(nil)
  }
| ELSE expression
  {
    $$ = tryCastExpr($2)
  }

column_name:
  sql_id
  {
    $$ = &ColName{Name: $1.(ColIdent)}
  }
| non_reserved_keyword2
  {
    $$ = &ColName{Name: NewColIdent(string($1))}
  }
| table_id '.' reserved_sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: $1.(TableIdent)}, Name: $3.(ColIdent)}
  }
| table_id '.' non_reserved_keyword2
  {
    $$ = &ColName{Qualifier: TableName{Name: $1.(TableIdent)}, Name: NewColIdent(string($3))}
  }
| table_id '.' column_name_safe_keyword
  {
    $$ = &ColName{Qualifier: TableName{Name: $1.(TableIdent)}, Name: NewColIdent(string($3))}
  }
| table_id '.' function_call_keywords
  {
    $$ = &ColName{Qualifier: TableName{Name: $1.(TableIdent)}, Name: NewColIdent(string($3))}
  }
| table_id '.' ACCOUNT
  {
    $$ = &ColName{Qualifier: TableName{Name: $1.(TableIdent)}, Name: NewColIdent(string($3))}
  }
| table_id '.' FORMAT
  {
    $$ = &ColName{Qualifier: TableName{Name: $1.(TableIdent)}, Name: NewColIdent(string($3))}
  }
| column_name_safe_keyword '.' sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: $3.(ColIdent)}
  }
| function_call_keywords '.' sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: $3.(ColIdent)}
  }
| qualified_column_name_safe_reserved_keyword '.' reserved_sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: $3.(ColIdent)}
  }
| non_reserved_keyword2 '.' reserved_sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: $3.(ColIdent)}
  }
| non_reserved_keyword2 '.' FULL
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: NewColIdent(string($3))}
  }
| ACCOUNT '.' reserved_sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: $3.(ColIdent)}
  }
| FORMAT '.' reserved_sql_id
  {
    $$ = &ColName{Qualifier: TableName{Name: NewTableIdent(string($1))}, Name: $3.(ColIdent)}
  }
| function_call_keywords
  {
    $$ = &ColName{Name: NewColIdent(string($1))}
  }
| table_id '.' reserved_table_id '.' reserved_sql_id
  {
    $$ = &ColName{Qualifier: TableName{DbQualifier: $1.(TableIdent), Name: $3.(TableIdent)}, Name: $5.(ColIdent)}
  }

value:
  STRING
  {
    $$ = NewStrVal($1)
  }
| DATE STRING
  {
    $$ = NewStrVal($2)
  }
| TIME STRING
  {
    $$ = NewStrVal($2)
  }
| TIMESTAMP STRING
  {
    $$ = NewStrVal($2)
  }
| HEX
  {
    $$ = NewHexVal($1)
  }
| BIT_LITERAL
  {
    $$ = NewBitVal($1)
  }
| INTEGRAL
  {
    $$ = NewIntVal($1)
  }
| FLOAT
  {
    $$ = NewFloatVal($1)
  }
| HEXNUM
  {
    $$ = NewHexNum($1)
  }
| VALUE_ARG
  {
    $$ = NewValArg($1)
  }
| NULL
  {
    $$ = &NullVal{}
  }

num_val:
  VALUE
  {
    $$ = NewIntVal([]byte("1"))
  }
| INTEGRAL VALUES
  {
    $$ = NewIntVal($1)
  }
| VALUE_ARG VALUES
  {
    $$ = NewValArg($1)
  }

group_by_opt:
  {
    $$ = Exprs(nil)
  }
| GROUP BY group_by_list
  {
    $$ = $3.(Exprs)
  }

group_by_list:
  group_by
  {
    $$ = Exprs{tryCastExpr($1)}
  }
| group_by_list ',' group_by
  {
    $$ = append($1.(Exprs), tryCastExpr($3))
  }

group_by:
  expression
  {
    $$ = tryCastExpr($1)
  }

having_opt:
  {
    $$ = Expr(nil)
  }
| HAVING having
  {
    $$ = tryCastExpr($2)
  }

having:
  expression
  {
    $$ = tryCastExpr($1)
  }

order_by_opt:
  {
    $$ = OrderBy(nil)
  }
| ORDER BY order_list
  {
    $$ = $3.(OrderBy)
  }

order_list:
  order
  {
    $$ = OrderBy{$1.(*Order)}
  }
| order_list ',' order
  {
    $$ = append($1.(OrderBy), $3.(*Order))
  }

order:
  expression asc_desc_opt
  {
    $$ = &Order{Expr: tryCastExpr($1), Direction: $2.(string)}
  }

asc_desc_opt:
  {
    $$ = AscScr
  }
| ASC
  {
    $$ = AscScr
  }
| DESC
  {
    $$ = DescScr
  }

limit_opt:
  {
    $$ = (*Limit)(nil)
  }
| LIMIT limit_val
  {
    $$ = &Limit{Rowcount: tryCastExpr($2)}
  }
| LIMIT limit_val ',' limit_val
  {
    $$ = &Limit{Offset: tryCastExpr($2), Rowcount: tryCastExpr($4)}
  }
| LIMIT limit_val OFFSET limit_val
  {
    $$ = &Limit{Offset: tryCastExpr($4), Rowcount: tryCastExpr($2)}
  }

limit_val:
INTEGRAL
  {
    $$ = NewIntVal($1)
  }
| VALUE_ARG
  {
    $$ = NewValArg($1)
  }
| column_name
  {
    $$ = $1.(*ColName)
  }

lock_opt:
  {
    $$ = ""
  }
| FOR UPDATE
  {
    $$ = ForUpdateStr
  }
| FOR UPDATE SKIP LOCKED
  {
    $$ = ForUpdateSkipLockedStr
  }
| FOR UPDATE NOWAIT
  {
    $$ = ForUpdateNowaitStr
  }
| FOR UPDATE OF table_name_list
  {
    tables := $4.(TableNames)
    var tableNames []string
    for _, t := range tables {
      tableNames = append(tableNames, t.String())
    }
    lockStr := ForUpdateOfStr + " " + strings.Join(tableNames, ", ")
    $$ = &Lock{
      Type: lockStr,
      Tables: tables,
    }
  }
| FOR UPDATE OF table_name_list SKIP LOCKED
  {
    tables := $4.(TableNames)
    var tableNames []string
    for _, t := range tables {
      tableNames = append(tableNames, t.String())
    }
    lockStr := ForUpdateOfStr + " " + strings.Join(tableNames, ", ") + " skip locked"
    $$ = &Lock{
      Type: lockStr,
      Tables: tables,
    }
  }
| FOR UPDATE OF table_name_list NOWAIT
  {
    tables := $4.(TableNames)
    var tableNames []string
    for _, t := range tables {
      tableNames = append(tableNames, t.String())
    }
    lockStr := ForUpdateOfStr + " " + strings.Join(tableNames, ", ") + " nowait"
    $$ = &Lock{
      Type: lockStr,
      Tables: tables,
    }
  }
| LOCK IN SHARE MODE
  {
    $$ = ShareModeStr
  }

insert_data_alias:
  insert_data
  {
    $$ = $1.(*Insert)
  }
| insert_data as_opt table_alias column_list_opt
  {
    $$ = $1.(*Insert)
    // Rows is guarenteed to be an *AliasedValues here.
    rows := $$.(*Insert).Rows.(*AliasedValues)
    rows.As = $3.(TableIdent)
    if $4.(Columns) != nil {
        rows.Columns = $4.(Columns)
    }
    $$.(*Insert).Rows = rows
  }

// insert_data expands all combinations into a single rule.
// This avoids a shift/reduce conflict while encountering the
// following two possible constructs:
// insert into t1(a, b) (select * from t2)
// insert into t1(select * from t2)
// Because the rules are together, the parser can keep shifting
// the tokens until it disambiguates a as sql_id and select as keyword.
insert_data:
  insert_data_values
  {
    $$ = $1.(*Insert)
  }
| openb closeb insert_data_values
  {
    $3.(*Insert).Columns = []ColIdent{}
    $$ = $3.(*Insert)
  }
| openb ins_column_list closeb insert_data_values
  {
    $4.(*Insert).Columns = $2.(Columns)
    $$ = $4.(*Insert)
  }

insert_data_select:
  select_statement_with_no_trailing_into
  {
    $$ = &Insert{Rows: $1.(SelectStatement)}
  }
| openb ins_column_list closeb select_statement_with_no_trailing_into
  {
    $$ = &Insert{Columns: $2.(Columns), Rows: $4.(SelectStatement)}
  }
| openb select_statement_with_no_trailing_into closeb
  {
    // Drop the redundant parenthesis.
    $$ = &Insert{Rows: $2.(SelectStatement)}
  }
| openb ins_column_list closeb openb select_statement_with_no_trailing_into closeb
  {
    // Drop the redundant parenthesis.
    $$ = &Insert{Columns: $2.(Columns), Rows: $5.(SelectStatement)}
  }

insert_data_values:
  value_or_values tuple_list
  {
    $$ = &Insert{Rows: &AliasedValues{Values: $2.(Values)}, Auth: AuthInformation{AuthType: AuthType_IGNORE}}
  }
| openb insert_data_values closeb
  {
    $$ = $2.(*Insert)
  }

value_or_values:
  VALUES
| VALUE

ins_column_list_opt:
  {
    $$ = Columns(nil)
  }
| openb ins_column_list closeb
  {
    $$ = $2.(Columns)
  }

ins_column_list:
  ins_column
  {
    $$ = Columns{$1.(ColIdent)}
  }
| ins_column_list ',' ins_column
  {
    $$ = append($$.(Columns), $3.(ColIdent))
  }

ins_column:
 reserved_sql_id '.' reserved_sql_id // TODO: This throws away the qualifier, not a huge deal for insert into, but is incorrect
  {
    $$ = $3.(ColIdent)
  }
| reserved_sql_id
  {
    $$ = $1.(ColIdent)
  }
| column_name_safe_keyword
  {
    $$ = NewColIdent(string($1))
  }
| function_call_keywords
  {
    $$ = NewColIdent(string($1))
  }
| non_reserved_keyword2
  {
    $$ = NewColIdent(string($1))
  }
| non_reserved_keyword3
  {
    $$ = NewColIdent(string($1))
  }
| ESCAPE
  {
    $$ = NewColIdent(string($1))
  }

on_dup_opt:
  {
    $$ = AssignmentExprs(nil)
  }
| ON DUPLICATE KEY UPDATE assignment_list
  {
    $$ = $5.(AssignmentExprs)
  }

tuple_list:
  tuple_or_empty
  {
    $$ = Values{$1.(ValTuple)}
  }
| tuple_list ',' tuple_or_empty
  {
    $$ = append($1.(Values), $3.(ValTuple))
  }

tuple_or_empty:
  row_opt row_tuple
  {
    $$ = $2.(ValTuple)
  }
| row_opt openb closeb
  {
    $$ = ValTuple{}
  }

row_tuple:
  openb expression_list closeb
  {
    $$ = ValTuple($2.(Exprs))
  }

tuple_expression:
  row_tuple
  {
    if len($1.(ValTuple)) == 1 {
      $$ = &ParenExpr{$1.(ValTuple)[0]}
    } else {
      $$ = $1.(ValTuple)
    }
  }

assignment_list:
  assignment_expression
  {
    $$ = AssignmentExprs{$1.(*AssignmentExpr)}
  }
| assignment_list ',' assignment_expression
  {
    $$ = append($1.(AssignmentExprs), $3.(*AssignmentExpr))
  }

assignment_expression:
  column_name assignment_op expression
  {
    $$ = &AssignmentExpr{Name: $1.(*ColName), Expr: tryCastExpr($3)}
  }
| column_name_safe_keyword assignment_op expression {
    $$ = &AssignmentExpr{Name: &ColName{Name: NewColIdent(string($1))}, Expr: tryCastExpr($3)}
  }
| non_reserved_keyword3 assignment_op expression
  {
    $$ = &AssignmentExpr{Name: &ColName{Name: NewColIdent(string($1))}, Expr: tryCastExpr($3)}
  }
| ESCAPE assignment_op expression
  {
    $$ = &AssignmentExpr{Name: &ColName{Name: NewColIdent(string($1))}, Expr: tryCastExpr($3)}
  }

set_list:
  set_expression
  {
    $$ = SetVarExprs{$1.(*SetVarExpr)}
  }
| set_list ',' set_expression
  {
    $$ = append($1.(SetVarExprs), $3.(*SetVarExpr))
  }

set_expression:
  set_expression_assignment
  {
    colName, scope, _, err := VarScopeForColName($1.(*SetVarExpr).Name)
    if err != nil {
      yylex.Error(err.Error())
      return 1
    }
    $1.(*SetVarExpr).Name = colName
    $1.(*SetVarExpr).Scope = scope
    $$ = $1.(*SetVarExpr)
  }
| set_scope_primary set_expression_assignment
  {
    _, scope, _, err := VarScopeForColName($2.(*SetVarExpr).Name)
    if err != nil {
      yylex.Error(err.Error())
      return 1
    } else if scope != SetScope_None {
      yylex.Error(fmt.Sprintf("invalid system variable name `%s`", $2.(*SetVarExpr).Name.Name.val))
      return 1
    }
    $2.(*SetVarExpr).Scope = $1.(SetScope)
    $$ = $2.(*SetVarExpr)
  }
| set_scope_secondary set_expression_assignment
  {
    _, scope, _, err := VarScopeForColName($2.(*SetVarExpr).Name)
    if err != nil {
      yylex.Error(err.Error())
      return 1
    } else if scope != SetScope_None {
      yylex.Error(fmt.Sprintf("invalid system variable name `%s`", $2.(*SetVarExpr).Name.Name.val))
      return 1
    }
    $2.(*SetVarExpr).Scope = $1.(SetScope)
    $$ = $2.(*SetVarExpr)
  }
| charset_or_character_set charset_value collate_opt
  {
    $$ = &SetVarExpr{Name: NewColName(string($1)), Expr: tryCastExpr($2), Scope: SetScope_Session}
  }

set_scope_primary:
  GLOBAL
  {
    $$ = SetScope_Global
  }
| SESSION
  {
    $$ = SetScope_Session
  }

set_scope_secondary:
  LOCAL
  {
    $$ = SetScope_Session
  }
| PERSIST
  {
    $$ = SetScope_Persist
  }
| PERSIST_ONLY
  {
    $$ = SetScope_PersistOnly
  }

set_expression_assignment:
  column_name assignment_op ON
  {
    $$ = &SetVarExpr{Name: $1.(*ColName), Expr: NewStrVal($3), Scope: SetScope_None}
  }
| column_name assignment_op OFF
  {
    $$ = &SetVarExpr{Name: $1.(*ColName), Expr: NewStrVal($3), Scope: SetScope_None}
  }
| column_name assignment_op STRING STRING
  {
    // NOTE: This is a fix to allow MySQL dumps to load cleanly when they contain the following:
    //       SET @@GLOBAL.GTID_PURGED= /*!80000 '+'*/ 'beabe64c-9dc6-11ed-8021-a0f9021e8e70:1-126';
    //       The full fix is for any adjacent single-quoted or double-quoted strings to be concatenated but
    //       this fixes the most pressing case. For more details, see: https://github.com/dolthub/dolt/issues/5232
    // In other places we can correctly concatenate adjacent string literals, but the special comments break it

    $$ = &SetVarExpr{Name: $1.(*ColName), Expr: NewStrVal([]byte(string($3)+string($4))), Scope: SetScope_None}
  }
| column_name assignment_op expression
  {
    $$ = &SetVarExpr{Name: $1.(*ColName), Expr: tryCastExpr($3), Scope: SetScope_None}
  }

charset_or_character_set:
  CHARSET
| CHARACTER SET
  {
    $$ = []byte("charset")
  }
| NAMES

charset_value:
  sql_id
  {
    $$ = NewStrVal([]byte($1.(ColIdent).String()))
  }
| STRING
  {
    $$ = NewStrVal($1)
  }
| DEFAULT
  {
    $$ = &Default{}
  }
| BINARY
  {
    $$ = NewStrVal($1)
  }

for_from:
  FOR
| FROM

temp_opt:
  { $$ = 0 }
| TEMPORARY
  { $$ = 1 }

exists_opt:
  { $$ = 0 }
| IF EXISTS
  { $$ = 1 }

not_exists_opt:
  { $$ = 0 }
| IF NOT EXISTS
  { $$ = 1 }

ignore_opt:
  { $$ = "" }
| IGNORE
  { $$ = IgnoreStr }

ignore_number_opt:
  { $$ = (*SQLVal)(nil) }
| IGNORE INTEGRAL LINES
  { $$ = NewIntVal($2) }
| IGNORE INTEGRAL ROWS
  { $$ = NewIntVal($2) }

to_or_as_opt:
  { $$ = struct{}{} }
| to_or_as
  { $$ = struct{}{} }

to_or_as:
  TO
  { $$ = struct{}{} }
| AS
  { $$ = struct{}{} }

as_opt:
  { $$ = struct{}{} }
| AS
  { $$ = struct{}{} }

key_type:
  UNIQUE
  { $$ = UniqueStr }
| FULLTEXT
  { $$ = FulltextStr }
| SPATIAL
  { $$ = SpatialStr }
| VECTOR
  { $$ = VectorStr }

key_type_opt:
  { $$ = "" }
| key_type
  { $$ = $1.(string) }

using_opt:
  { $$ = ColIdent{} }
| USING sql_id
  { $$ = $2.(ColIdent) }

sql_id:
  ID
  {
    $$ = NewColIdent(string($1))
  }
| non_reserved_keyword
  {
    $$ = NewColIdent(string($1))
  }

reserved_sql_id_list:
  reserved_sql_id
  {
    $$ = []ColIdent{$1.(ColIdent)}
  }
| reserved_sql_id_list ',' reserved_sql_id
  {
    $$ = append($$.([]ColIdent), $3.(ColIdent))
  }

reserved_sql_id:
  sql_id
| reserved_keyword
  {
    $$ = NewColIdent(string($1))
  }

table_id:
  ID
  {
    $$ = NewTableIdent(string($1))
  }
| non_reserved_keyword
  {
    $$ = NewTableIdent(string($1))
  }

reserved_table_id:
  table_id
| reserved_keyword
  {
    $$ = NewTableIdent(string($1))
  }
| non_reserved_keyword2
  {
    $$ = NewTableIdent(string($1))
  }
| non_reserved_keyword3
  {
    $$ = NewTableIdent(string($1))
  }

infile_opt:
  { $$ = string("") }
| INFILE STRING
  { $$ = string($2)}

ignore_or_replace_opt:
  { $$ = string("") }
| IGNORE
  { $$ = IgnoreStr }
| REPLACE
  { $$ = ReplaceStr }

local_opt:
  { $$ = BoolVal(false) }
| LOCAL
  { $$ = BoolVal(true) }

enclosed_by_opt:
  {
    $$ = (*EnclosedBy)(nil)
  }
| optionally_opt ENCLOSED BY STRING
  {
    $$ = &EnclosedBy{Optionally: $1.(BoolVal), Delim: NewStrVal($4)}
  }

optionally_opt:
  {
    $$ = BoolVal(false)
  }
| OPTIONALLY
  {
    $$ = BoolVal(true)
  }

terminated_by_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| TERMINATED BY STRING
  {
    $$ = NewStrVal($3)
  }

escaped_by_opt:
  {
    $$ = (*SQLVal)(nil)
  }
| ESCAPED BY STRING
  {
    $$ = NewStrVal($3)
  }

// TODO: support any number of enclosed_by_opt
// TODO: support any number of escaped_by_opt
// TODO: escaped_by_opt and enclosed_by_opt can appear in any order
fields_opt:
  {
    $$ = (*Fields)(nil)
  }
| columns_or_fields terminated_by_opt enclosed_by_opt escaped_by_opt
  {
    $$ = &Fields{TerminatedBy: $2.(*SQLVal), EnclosedBy: $3.(*EnclosedBy), EscapedBy: $4.(*SQLVal)}
  }

lines_opt:
  {
    $$ = (*Lines)(nil)
  }
| LINES lines_option_list
  {
    $$ = $2
  }

lines_option_list:
  {
    $$ = &Lines{}
  }
| lines_option_list STARTING BY STRING
  {
    if $1 == nil {
      $$ = &Lines{StartingBy: NewStrVal($4)}
    } else {
      $1.(*Lines).StartingBy = NewStrVal($4)
      $$ = $1
    }
  }
| lines_option_list TERMINATED BY STRING
  {
    if $1 == nil {
      $$ = &Lines{TerminatedBy: NewStrVal($4)}
    } else {
      $1.(*Lines).TerminatedBy = NewStrVal($4)
      $$ = $1
    }
  }

lock_statement:
  LOCK TABLES lock_table_list
  {
    $$ = &LockTables{Tables: $3.(TableAndLockTypes)}
  }

lock_table_list:
  lock_table
  {
    $$ = TableAndLockTypes{$1.(*TableAndLockType)}
  }
| lock_table_list ',' lock_table
  {
    $$ = append($1.(TableAndLockTypes), $3.(*TableAndLockType))
  }

lock_table:
  table_name lock_type
  {
    tableName := $1.(TableName)
    $$ = &TableAndLockType{
      Table: &AliasedTableExpr{
        Expr: tableName,
        Auth: AuthInformation{
          AuthType: AuthType_LOCK,
          TargetType: AuthTargetType_SingleTableIdentifier,
          TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
        },
      },
      Lock: $2.(LockType),
    }
  }
|  table_name AS table_alias lock_type
  {
    tableName := $1.(TableName)
    $$ = &TableAndLockType{
      Table: &AliasedTableExpr{
        Expr: tableName,
        As: $3.(TableIdent),
        Auth: AuthInformation{
          AuthType: AuthType_LOCK,
          TargetType: AuthTargetType_SingleTableIdentifier,
          TargetNames: []string{tableName.DbQualifier.String(), tableName.Name.String()},
        },
      },
      Lock: $4.(LockType),
    }
  }

lock_type:
  READ
  {
    $$ = LockRead
  }
| READ LOCAL
  {
    $$ = LockReadLocal
  }
| WRITE
  {
    $$ = LockWrite
  }
| LOW_PRIORITY WRITE
  {
    $$ = LockLowPriorityWrite
  }

unlock_statement:
  UNLOCK TABLES
  {
    $$ = &UnlockTables{}
  }

kill_statement:
  KILL INTEGRAL
  {
    $$ = &Kill{
      Connection: true,
      ConnID: NewIntVal($2),
      Auth: AuthInformation{
        AuthType: AuthType_SUPER,
        TargetType: AuthTargetType_Global,
      },
    }
  }
|  KILL QUERY INTEGRAL
  {
    $$ = &Kill{
      ConnID: NewIntVal($3),
      Auth: AuthInformation{
        AuthType: AuthType_SUPER,
        TargetType: AuthTargetType_Global,
      },
    }
  }
| KILL CONNECTION INTEGRAL
  {
    $$ = &Kill{
      Connection: true,
      ConnID: NewIntVal($3),
      Auth: AuthInformation{
        AuthType: AuthType_SUPER,
        TargetType: AuthTargetType_Global,
      },
    }
  }

/*
  Reserved keywords are keywords that MUST be backtick quoted to be used as an identifier. They cannot
  parse correctly as an identifier otherwise. These are not all necessarily reserved keywords in MySQL, but some are.
  These are reserved because they may cause parse conflicts in our grammar.

  TODO: Would be helpful to annotate which are NOT reserved in MySQL. Each of those non-reserved keywords that
        we require to be backtick quoted is a potential customer issue since there's a compatibility issue with MySQL.

  If you want to move one that is not reserved in MySQL (i.e. ESCAPE) to the
  non_reserved_keywords, you'll need to deal with any conflicts.

  Sorted alphabetically
*/
reserved_keyword:
  ACCESSIBLE
| ADD
| ALL
| ALTER
| ANALYZE
| AND
| AS
| ASC
| ASENSITIVE
| BEFORE
| BETWEEN
| BIGINT
| BINARY
| BIT_AND
| BIT_OR
| BIT_XOR
| BLOB
| BOTH
| BY
| CALL
| CASCADE
| CASE
| CHANGE
| CHAR
| CHARACTER
| CHECK
| COLLATE
| COLUMN
| CONSTRAINT
| CONDITION
| CONTINUE
| CONVERT
| CUME_DIST
| CREATE
| CROSS
| CUBE
| CURRENT_DATE
| CURRENT_TIME
| CURRENT_TIMESTAMP
| CURRENT_USER
| CURSOR
| DATABASE
| DATABASES
| DAY_HOUR
| DAY_MICROSECOND
| DAY_MINUTE
| DAY_SECOND
| DEC
| DECIMAL
| DECLARE
| DEFAULT
| DELAYED
| DELETE
| DENSE_RANK
| DESC
| DESCRIBE
| DETERMINISTIC
| DISTINCT
| DISTINCTROW
| DIV
| DOUBLE
| DROP
| DUAL
| EACH
| ELSE
| ELSEIF
| EMPTY
| ENCLOSED
| ESCAPED
| EXCEPT
| EXISTS
| EXIT
| EXPLAIN
| FALSE
| FETCH
| FIRST_VALUE
| FLOAT_TYPE
| FLOAT4
| FLOAT8
| FOR
| FORCE
| FOREIGN
| FROM
| FULLTEXT
| FUNCTION
| GENERATED
| GET
| GRANT
| GROUP
| GROUPING
| GROUPS
| HAVING
| HIGH_PRIORITY
| HOUR_MICROSECOND
| HOUR_MINUTE
| HOUR_SECOND
| IF
| IGNORE
| IN
| INDEX
| INFILE
| INNER
| INOUT
| INSERT
| INSENSITIVE
| INT
| INT1
| INT2
| INT3
| INT4
| INT8
| INTEGER
| INTERVAL
| INTO
| IO_AFTER_GTIDS
| IO_BEFORE_GTIDS
| IS
| ITERATE
| JOIN
| JSON_ARRAYAGG
| JSON_OBJECTAGG
| JSON_TABLE
| KEY
| KEYS
| KILL
| LAG
| LAST_VALUE
| LATERAL
| LEAD
| LEADING
| LEAVE
| LINEAR
| LINES
| LOAD
| LONG
| LONGBLOB
| LONGTEXT
| LOOP
| LOW_PRIORITY
| LEFT
| LIKE
| LIMIT
| LOCALTIME
| LOCALTIMESTAMP
| LOCK
| MASTER_BIND
| MASTER_SSL_VERIFY_SERVER_CERT
| MATCH
| MAXVALUE
| MEDIUMBLOB
| MEDIUMINT
| MEDIUMTEXT
| MEMBER
| MIDDLEINT
| MINUTE_MICROSECOND
| MOD
| MODIFIES
| NATURAL
| NOT
| NO_WRITE_TO_BINLOG
| NTH_VALUE
| NTILE
| NULL
| NUMERIC
| NVAR
| OF
| ON
| OPTIMIZE
| OPTIMIZER_COSTS
| OPTION
| OPTIONALLY
| OR
| ORDER
| OUT
| OUTER
| OUTFILE
| OVER
| PARTITION
| PASSWORD_LOCK
| PERCENT_RANK
| PRECISION
| PRIMARY
| PROCEDURE
| PURGE
| READ
| READS
| READ_WRITE
| RANGE
| RANK
| REAL
| RECURSIVE
| REFERENCES
| REGEXP
| RELEASE
| RENAME
| REPEAT
| REPLACE
| REQUIRE
| RESIGNAL
| RESTRICT
| RETURN
| RETURNING
| REVOKE
| RIGHT
| RLIKE
| ROW
| ROWS
| ROW_NUMBER
| SCHEMA
| SCHEMAS
| SECOND_MICROSECOND
| SELECT
| SENSITIVE
| SEPARATOR
| SET
| SHOW
| SIGNAL
| SMALLINT
| SPATIAL
| SPECIFIC
| SQL
| SQLEXCEPTION
| SQLSTATE
| SQLWARNING
| SQL_BIG_RESULT
| SQL_CALC_FOUND_ROWS
| SQL_SMALL_RESULT
| SSL
| STARTING
| STD
| STDDEV
| STDDEV_POP
| STDDEV_SAMP
| STORED
| STRAIGHT_JOIN
| SUBSTR
| SUBSTRING
| SYSTEM
| TABLE
| TERMINATED
| THEN
| TINYBLOB
| TINYINT
| TINYTEXT
| TO
| TRAILING
| TRIGGER
| TRUE
| UNDO
| UNION
| UNIQUE
| UNLOCK
| UNSIGNED
| UPDATE
| USAGE
| USE
| USING
| UTC_DATE
| UTC_TIME
| UTC_TIMESTAMP
| VALUES
| VARBINARY
| VARCHAR
| VARCHARACTER
| VARIANCE
| VARYING
| VAR_POP
| VAR_SAMP
| VECTOR
| VIRTUAL
| WHEN
| WHERE
| WHILE
| WINDOW
| WITH
| WRITE
| XOR
| YEAR_MONTH
| ZEROFILL

// These reserved keywords are safe to use, unquoted, as the qualifier on a column reference (e.g. 'accessible.myColumn')
qualified_column_name_safe_reserved_keyword:
  ACCESSIBLE
| ADD
| ALTER
| ANALYZE
| AND
| AS
| ASC
| ASENSITIVE
| BEFORE
| BETWEEN
| BIGINT
| BINARY
| BIT_AND
| BIT_OR
| BIT_XOR
| BLOB
| BOTH
| BY
| CALL
| CASCADE
| CASE
| CHANGE
| CHAR
| CHARACTER
| CHECK
| COLLATE
| COLUMN
| CONSTRAINT
| CONDITION
| CONTINUE
| CONVERT
| CUME_DIST
| CREATE
| CROSS
| CUBE
| CURRENT_DATE
| CURRENT_TIME
| CURRENT_TIMESTAMP
| CURRENT_USER
| CURSOR
| DATABASE
| DATABASES
| DAY_HOUR
| DAY_MICROSECOND
| DAY_MINUTE
| DAY_SECOND
| DEC
| DECIMAL
| DECLARE
| DEFAULT
| DELAYED
| DELETE
| DENSE_RANK
| DESC
| DESCRIBE
| DETERMINISTIC
| DISTINCTROW
| DOUBLE
| DROP
| EACH
| ELSE
| ELSEIF
| EMPTY
| ENCLOSED
| ESCAPED
| EXCEPT
| EXISTS
| EXIT
| EXPLAIN
| FALSE
| FETCH
| FIRST_VALUE
| FLOAT_TYPE
| FLOAT4
| FLOAT8
| FOR
| FORCE
| FOREIGN
| FROM
| FULLTEXT
| FUNCTION
| GENERATED
| GET
| GRANT
| GROUP
| GROUPING
| GROUPS
| HAVING
| HIGH_PRIORITY
| HOUR_MICROSECOND
| HOUR_MINUTE
| HOUR_SECOND
| IF
| IGNORE
| IN
| INDEX
| INFILE
| INNER
| INOUT
| INSERT
| INSENSITIVE
| INT
| INT1
| INT2
| INT3
| INT4
| INT8
| INTEGER
| INTERVAL
| INTO
| IO_AFTER_GTIDS
| IO_BEFORE_GTIDS
| IS
| ITERATE
| JOIN
| JSON_ARRAYAGG
| JSON_OBJECTAGG
| JSON_TABLE
| KEYS
| KILL
| LAG
| LAST_VALUE
| LATERAL
| LEAD
| LEADING
| LEAVE
| LINEAR
| LINES
| LOAD
| LONG
| LONGBLOB
| LONGTEXT
| LOOP
| LOW_PRIORITY
| LEFT
| LIKE
| LIMIT
| LOCALTIME
| LOCALTIMESTAMP
| LOCK
| MASTER_BIND
| MASTER_SSL_VERIFY_SERVER_CERT
| MATCH
| MAXVALUE
| MEDIUMBLOB
| MEDIUMINT
| MEDIUMTEXT
| MEMBER
| MIDDLEINT
| MINUTE_MICROSECOND
| MOD
| MODIFIES
| NATURAL
| NOT
| NO_WRITE_TO_BINLOG
| NTH_VALUE
| NTILE
| NULL
| NUMERIC
| NVAR
| OF
| ON
| OPTIMIZE
| OPTIMIZER_COSTS
| OPTION
| OPTIONALLY
| OR
| ORDER
| OUT
| OUTER
| OUTFILE
| OVER
| PARTITION
| PASSWORD_LOCK
| PERCENT_RANK
| PRECISION
| PRIMARY
| PROCEDURE
| PURGE
| READ
| READS
| READ_WRITE
| RANGE
| RANK
| REAL
| RECURSIVE
| REFERENCES
| REGEXP
| RELEASE
| RENAME
| REPEAT
| REPLACE
| REQUIRE
| RESIGNAL
| RESTRICT
| RETURN
| RETURNING
| REVOKE
| RIGHT
| RLIKE
| ROW
| ROWS
| ROW_NUMBER
| SCHEMA
| SCHEMAS
| SECOND_MICROSECOND
| SENSITIVE
| SEPARATOR
| SET
| SHOW
| SIGNAL
| SMALLINT
| SPATIAL
| SPECIFIC
| SQL
| SQLEXCEPTION
| SQLSTATE
| SQLWARNING
| SQL_BIG_RESULT
| SQL_SMALL_RESULT
| SSL
| STARTING
| STD
| STDDEV
| STDDEV_POP
| STDDEV_SAMP
| STORED
| SUBSTR
| SUBSTRING
| SYSTEM
| TABLE
| TERMINATED
| THEN
| TINYBLOB
| TINYINT
| TINYTEXT
| TO
| TRAILING
| TRIGGER
| TRUE
| UNDO
| UNION
| UNIQUE
| UNLOCK
| UNSIGNED
| UPDATE
| USAGE
| USE
| USING
| UTC_DATE
| UTC_TIME
| UTC_TIMESTAMP
| VALUES
| VARBINARY
| VARCHAR
| VARCHARACTER
| VARIANCE
| VARYING
| VAR_POP
| VAR_SAMP
| VECTOR
| VIRTUAL
| WHERE
| WHILE
| WINDOW
| WITH
| WRITE
| XOR
| YEAR_MONTH
| ZEROFILL

/*
  These are non-reserved keywords for Vitess – they don't cause conflicts in the grammar when used as identifiers.
  They can be safely used as unquoted identifiers in queries. Some may be reserved in MySQL, so we backtick quote
  them when we rewrite the query, to prevent any issues.

  Sorted alphabetically
*/
non_reserved_keyword:
  ACTION
| ACTIVE
| ADMIN
| AFTER
| AGAINST
| ALGORITHM
| ALWAYS
| ARRAY
| AT
| AUTHENTICATION
| AUTOEXTEND_SIZE
| AUTO_INCREMENT
| AVG_ROW_LENGTH
| BEGIN
| SERIAL
| BIT
| BOOL
| BOOLEAN
| BUCKETS
| CASCADED
| CATALOG_NAME
| CHAIN
| CHANNEL
| CHARSET
| CHECKSUM
| CIPHER
| CLASS_ORIGIN
| CLIENT
| CLONE
| CLOSE
| COALESCE
| COLLATION
| COLUMNS
| COLUMN_NAME
| COMMIT
| COMPACT
| COMPRESSED
| COMPRESSION
| COMMITTED
| CONNECTION
| COMPLETION
| COMPONENT
| CONSISTENT
| CONSTRAINT_CATALOG
| CONSTRAINT_NAME
| CONSTRAINT_SCHEMA
| CONTAINS
| CURRENT
| CURSOR_NAME
| DATA
| DATE %prec STRING_TYPE_PREFIX_NON_KEYWORD
| DATETIME
| DAY
| DEALLOCATE
| DEFINER
| DEFINITION
| DELAY_KEY_WRITE
| DESCRIPTION
| DIRECTORY
| DISABLE
| DISCARD
| DISK
| DO
| DUMPFILE
| DUPLICATE
| DYNAMIC
| ENABLE
| ENCRYPTION
| END
| ENDS
| ENFORCED
| ENGINE
| ENGINES
| ENGINE_ATTRIBUTE
| ENUM
| ERROR
| ERRORS
| EVENTS
| EVERY
| EXCHANGE
| EXCLUDE
| EXPANSION
| EXPIRE
| EXTENDED
| FIELDS
| FILTER
| FIXED
| FLUSH
| FOLLOWING
| FOLLOWS
| FOUND
| GENERAL
| GEOMCOLLECTION
| GEOMETRY
| GEOMETRYCOLLECTION
| GET_MASTER_PUBLIC_KEY
| GLOBAL
| GRANTS
| HANDLER
| HASH
| HISTOGRAM
| HISTORY
| HOSTS
| HOUR
| IMPORT
| INACTIVE
| INDEXES
| INITIAL
| INSERT_METHOD
| INSTANT
| INVISIBLE
| INVOKER
| IO_THREAD
| ISOLATION
| ISSUER
| JSON
| KEY_BLOCK_SIZE
| LANGUAGE
| LAST
| LAST_INSERT_ID
| LESS
| LEVEL
| LINESTRING
| LIST
| LOCAL
| LOCKED
| LOG
| LOGS
| MASTER
| MASTER_COMPRESSION_ALGORITHMS
| MASTER_PUBLIC_KEY_PATH
| MASTER_TLS_CIPHERSUITES
| MASTER_ZSTD_COMPRESSION_LEVEL
| MAX_CONNECTIONS_PER_HOUR
| MAX_QUERIES_PER_HOUR
| MAX_ROWS
| MAX_UPDATES_PER_HOUR
| MAX_USER_CONNECTIONS
| MEMORY
| MERGE
| MESSAGE_TEXT
| MICROSECOND
| MIN_ROWS
| MINUTE
| MODE
| MODIFY
| MONTH
| MULTILINESTRING
| MULTIPOINT
| MULTIPOLYGON
| MYSQL_ERRNO
| NAME
| NAMES
| NATIONAL
| NCHAR
| NESTED
| NETWORK_NAMESPACE
| NEVER
| NO
| NOWAIT
| NULLS
| NVARCHAR
| OFFSET
| OJ
| OLD
| ONLY
| OPEN
| OPTIONAL
| ORDINALITY
| ORGANIZATION
| OTHERS
| PACK_KEYS
| PARTITIONING
| PARTITIONS
| PATH
| PERSIST
| PERSIST_ONLY
| PLUGINS
| POINT
| POLYGON
| PRECEDES
| PRECEDING
| PREPARE
| PRESERVE
| PRIVILEGE_CHECKS_USER
| PRIVILEGES
| PROCESSLIST
| PROXY
| QUARTER
| QUERY
| RANDOM
| REBUILD
| REDUNDANT
| REFERENCE
| RELAY
| REMOVE
| REORGANIZE
| REPAIR
| REPEATABLE
| REPLICA
| REPLICAS
| REPLICATE_DO_TABLE
| REPLICATE_IGNORE_TABLE
| REPLICATION
| REQUIRE_ROW_FORMAT
| RESET
| RESOURCE
| RESPECT
| RESTART
| RETAIN
| REUSE
| ROLE
| ROLLBACK
| ROUTINE
| ROW_FORMAT
| SAVEPOINT
| SCHEDULE
| SCHEMA_NAME
| SECOND
| SECONDARY
| SECONDARY_ENGINE
| SECONDARY_ENGINE_ATTRIBUTE
| SECONDARY_LOAD
| SECONDARY_UNLOAD
| SECURITY
| SEQUENCE
| SERIALIZABLE
| SESSION
| SHARE
| SIGNED
| SKIP
| SLAVE
| SLOW
| SNAPSHOT
| SOURCE
| SOURCE_CONNECT_RETRY
| SOURCE_HOST
| SOURCE_SSL
| SOURCE_PASSWORD
| SOURCE_PORT
| SOURCE_AUTO_POSITION
| SOURCE_RETRY_COUNT
| SOURCE_USER
| SQL_THREAD
| SRID
| START
| STARTS
| STATUS
| STATS_AUTO_RECALC
| STATS_PERSISTENT
| STATS_SAMPLE_PAGES
| STOP
| STORAGE
| STREAM
| SUBCLASS_ORIGIN
| SUBJECT
| SUBPARTITION
| SUBPARTITIONS
| TABLE_CHECKSUM
| TABLES
| TABLESPACE
| TABLE_NAME
| TEMPORARY
| TEMPTABLE
| TEXT
| THAN
| THREAD_PRIORITY
| TIES
| TIME %prec STRING_TYPE_PREFIX_NON_KEYWORD
| TIMESTAMP %prec STRING_TYPE_PREFIX_NON_KEYWORD
| TRANSACTION
| TRIGGERS
| TRUNCATE
| UNBOUNDED
| UNCOMMITTED
| UNKNOWN
| UNTIL
| UNUSED
| USER
| USER_RESOURCES
| VALIDATION
| VALUE
| VARIABLES
| VERSION
| VERSIONING
| VCPU
| VISIBLE
| UNDEFINED
| WARNINGS
| WEEK
| WITHOUT
| WORK
| X509
| YEAR

// non_reserved_keyword that can't go in non_reserved_keyword for some reason
non_reserved_keyword2:
  ATTRIBUTE
| COMMENT_KEYWORD
| CONTAINED
| EXECUTE
| EXTRACT
| FAILED_LOGIN_ATTEMPTS
| FILE
| FIRST
| FULL
| GET_FORMAT
| IDENTIFIED
| NONE
| PASSWORD
| PASSWORD_LOCK_TIME
| PROCESS
| RELOAD
| SHUTDOWN
| SUPER
| TIMESTAMPADD
| TIMESTAMPDIFF
| VERSIONS
| VIEW

// non_reserved_keyword that can't go in non_reserved_keyword or non_reserved_keyword2 for some reason
non_reserved_keyword3:
  ACCOUNT
| FORMAT
| NEXT
| OFF
| SQL_CACHE
| SQL_NO_CACHE

// Keywords that cause grammar conflicts in some places, but are safe to use as column name / alias identifiers.
column_name_safe_keyword:
  AVG
| COUNT
| EVENT
| MAX
| MIN
| SUM

// Names of functions that require special grammar support. These aren't reserved or non-reserved in MySQL's docs, but are labeled as keywords in our grammar because of their custom syntax.
function_call_keywords:
  CAST
| POSITION
| TRIM

openb:
  '('
  {
    if incNesting(yylex) {
      yylex.Error("max nesting level reached")
      return 1
    }
  }

closeb:
  ')'
  {
    decNesting(yylex)
  }
