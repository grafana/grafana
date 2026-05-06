// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package information_schema

import (
	"github.com/dolthub/vitess/go/sqltypes"

	. "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const (
	// InnoDBBufferPageName is the name of the INNODB_BUFFER_PAGE Table
	InnoDBBufferPageName = "innodb_buffer_page"
	// InnoDBBufferPageLRUName is the name of the INNODB_BUFFER_PAGE_LRU Table
	InnoDBBufferPageLRUName = "innodb_buffer_page_lru"
	// InnoDBBufferPoolStatsName is the name of the INNODB_BUFFER_POOL_STATS Table
	InnoDBBufferPoolStatsName = "innodb_buffer_pool_stats"
	// InnoDBCachedIndexesName is the name of the INNODB_CACHED_INDEXES Table
	InnoDBCachedIndexesName = "innodb_cached_indexes"
	// InnoDBCmpName is the name of the INNODB_CMP and INNODB_CMP_RESET Tables
	InnoDBCmpName      = "innodb_cmp"
	InnoDBCmpResetName = "innodb_cmp_reset"
	// InnoDBCmpmemName is the name of the INNODB_CMPMEM and INNODB_CMPMEM_RESET Tables
	InnoDBCmpmemName      = "innodb_cmpmem"
	InnoDBCmpmemResetName = "innodb_cmpmem_reset"
	// InnoDBCmpPerIndexName is the name of the INNODB_CMP_PER_INDEX and INNODB_CMP_PER_INDEX_RESET Table
	InnoDBCmpPerIndexName      = "innodb_cmp_per_index"
	InnoDBCmpPerIndexResetName = "innodb_cmp_per_index_reset"
	// InnoDBColumnsName is the name of the INNODB_COLUMNS Table
	InnoDBColumnsName = "innodb_columns"
	// InnoDBDatafilesName is the name of the INNODB_DATAFILES Table
	InnoDBDatafilesName = "innodb_datafiles"
	// InnoDBFieldsName is the name of the INNODB_FIELDS Table
	InnoDBFieldsName = "innodb_fields"
	// InnoDBForeignName is the name of the INNODB_FOREIGN Table
	InnoDBForeignName = "innodb_foreign"
	// InnoDBForeignColsName is the name of the INNODB_FOREIGN_COLS Table
	InnoDBForeignColsName = "innodb_foreign_cols"
	// InnoDBFtBeingDeletedName is the name of the INNODB_FT_BEING_DELETED Table
	InnoDBFtBeingDeletedName = "innodb_ft_being_deleted"
	// InnoDBFtConfigName is the name of the INNODB_FT_CONFIG Table
	InnoDBFtConfigName = "innodb_ft_config"
	// InnoDBFtDefaultStopwordName is the name of the INNODB_FT_DEFAULT_STOPWORD Table
	InnoDBFtDefaultStopwordName = "innodb_ft_default_stopword"
	// InnoDBFtDeletedName is the name of the INNODB_FT_DELETED Table
	InnoDBFtDeletedName = "innodb_ft_deleted"
	// InnoDBFtIndexCacheName is the name of the INNODB_FT_INDEX_CACHE Table
	InnoDBFtIndexCacheName = "innodb_ft_index_cache"
	// InnoDBFtIndexTableName is the name of the INNODB_FT_INDEX_TABLE Table
	InnoDBFtIndexTableName = "innodb_ft_index_table"
	// InnoDBIndexesName is the name of the INNODB_INDEXES Table
	InnoDBIndexesName = "innodb_indexes"
	// InnoDBMetricsName is the name of the INNODB_METRICS Table
	InnoDBMetricsName = "innodb_metrics"
	// InnoDBSessionTempTablespacesName is the name of the INNODB_SESSION_TEMP_TABLESPACES Table
	InnoDBSessionTempTablespacesName = "innodb_session_temp_tablespaces"
	// InnoDBTablesName is the name of the INNODB_TABLES Table
	InnoDBTablesName = "innodb_tables"
	// InnoDBTablespacesName is the name of the INNODB_TABLESPACES Table
	InnoDBTablespacesName = "innodb_tablespaces"
	// InnoDBTablespacesBriefName is the name of the INNODB_TABLESPACES_BRIEF Table
	InnoDBTablespacesBriefName = "innodb_tablespaces_brief"
	// InnoDBTablestatsName is the name of the INNODB_TABLESTATS View
	InnoDBTablestatsName = "innodb_tablestats"
	// InnoDBTempTableInfoName is the name of the INNODB_TEMP_TABLE_INFO table
	InnoDBTempTableInfoName = "innodb_temp_table_info"
	// InnoDBTrxName is the name of the INNODB_TRX Table
	InnoDBTrxName = "innodb_trx"
	// InnoDBVirtualName is the name of the INNODB_VIRTUAL Table
	InnoDBVirtualName = "innodb_virtual"
)

var innoDBBufferPageSchema = Schema{
	{Name: "pool_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "block_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "space", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "page_number", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "page_type", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "flush_type", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "fix_count", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "is_hashed", Type: types.MustCreateString(sqltypes.VarChar, 3, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "newest_modification", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "oldest_modification", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "access_time", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "table_name", Type: types.MustCreateString(sqltypes.VarChar, 1024, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "index_name", Type: types.MustCreateString(sqltypes.VarChar, 1024, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "number_records", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "data_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "compressed_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "page_state", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "io_fix", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "is_old", Type: types.MustCreateString(sqltypes.VarChar, 3, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
	{Name: "free_page_clock", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageName},
	{Name: "is_stale", Type: types.MustCreateString(sqltypes.VarChar, 3, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageName},
}

var innoDBBufferPageLRUSchema = Schema{
	{Name: "pool_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "lru_position", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "space", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "page_number", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "page_type", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "flush_type", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "fix_count", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "is_hashed", Type: types.MustCreateString(sqltypes.VarChar, 3, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "newest_modification", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "oldest_modification", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "access_time", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "table_name", Type: types.MustCreateString(sqltypes.VarChar, 1024, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "index_name", Type: types.MustCreateString(sqltypes.VarChar, 1024, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "number_records", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "data_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "compressed_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
	{Name: "compressed", Type: types.MustCreateString(sqltypes.VarChar, 3, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "io_fix", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "is_old", Type: types.MustCreateString(sqltypes.VarChar, 3, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBBufferPageLRUName},
	{Name: "free_page_clock", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPageLRUName},
}

var innoDBBufferPoolStatsSchema = Schema{
	{Name: "pool_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pool_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "free_buffers", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "database_pages", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "old_database_pages", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "modified_database_pages", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pending_decompress", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pending_reads", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pending_flush_lru", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pending_flush_list", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_made_young", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_not_made_young", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_made_young_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_made_not_young_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "number_pages_read", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "number_pages_created", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "number_pages_written", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_read_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_create_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "pages_written_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "number_pages_get", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "hit_rate", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "young_make_per_thousand_gets", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "not_young_make_per_thousand_gets", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "number_pages_read_ahead", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "number_read_ahead_evicted", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "read_ahead_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "read_ahead_evicted_rate", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "lru_io_total", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "lru_io_current", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "uncompress_total", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
	{Name: "uncompress_current", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBBufferPoolStatsName},
}

var innoDBCachedIndexesSchema = Schema{
	{Name: "space_id", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBCachedIndexesName},
	{Name: "index_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBCachedIndexesName},
	{Name: "n_cached_pages", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBCachedIndexesName},
}

var innoDBCmpSchema = Schema{
	{Name: "page_size", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpName},
	{Name: "compress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpName},
	{Name: "compress_ops_ok", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpName},
	{Name: "compress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpName},
	{Name: "uncompress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpName},
	{Name: "uncompress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpName},
}

var innoDBCmpResetSchema = Schema{
	{Name: "page_size", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpResetName},
	{Name: "compress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpResetName},
	{Name: "compress_ops_ok", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpResetName},
	{Name: "compress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpResetName},
	{Name: "uncompress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpResetName},
	{Name: "uncompress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpResetName},
}

var innoDBCmpmemSchema = Schema{
	{Name: "page_size", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemName},
	{Name: "buffer_pool_instance", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemName},
	{Name: "pages_used", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemName},
	{Name: "pages_free", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemName},
	{Name: "relocation_ops", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBCmpmemName},
	{Name: "relocation_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemName},
}

var innoDBCmpmemResetSchema = Schema{
	{Name: "page_size", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemResetName},
	{Name: "buffer_pool_instance", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemResetName},
	{Name: "pages_used", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemResetName},
	{Name: "pages_free", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemResetName},
	{Name: "relocation_ops", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBCmpmemResetName},
	{Name: "relocation_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpmemResetName},
}

var innoDBCmpPerIndexSchema = Schema{
	{Name: "database_name", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "table_name", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "index_name", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "compress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "compress_ops_ok", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "compress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "uncompress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexName},
	{Name: "uncompress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexName},
}

var innoDBCmpPerIndexResetSchema = Schema{
	{Name: "database_name", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "table_name", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "index_name", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "compress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "compress_ops_ok", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "compress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "uncompress_ops", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
	{Name: "uncompress_time", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBCmpPerIndexResetName},
}

var innoDBColumnsSchema = Schema{
	{Name: "table_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "pos", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "mtype", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "prtype", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "len", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "has_default", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBColumnsName},
	{Name: "default_value", Type: types.Text, Default: nil, Nullable: true, Source: InnoDBColumnsName},
}

var innoDBDatafilesSchema = Schema{
	{Name: "space_id", Type: types.MustCreateBinary(sqltypes.VarBinary, 256), Default: nil, Nullable: true, Source: InnoDBDatafilesName},
	{Name: "path", Type: types.MustCreateString(sqltypes.VarChar, 512, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBDatafilesName},
}

var innoDBFieldsSchema = Schema{
	{Name: "index_id", Type: types.MustCreateBinary(sqltypes.VarBinary, 256), Default: nil, Nullable: true, Source: InnoDBFieldsName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBFieldsName},
	{Name: "pos", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFieldsName},
}

var innoDBForeignSchema = Schema{
	{Name: "id", Type: types.MustCreateString(sqltypes.VarChar, 129, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBForeignName},
	{Name: "for_name", Type: types.MustCreateString(sqltypes.VarChar, 129, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBForeignName},
	{Name: "ref_name", Type: types.MustCreateString(sqltypes.VarChar, 129, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBForeignName},
	{Name: "n_cols", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBForeignName},
	{Name: "type", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBForeignName},
}

var innoDBForeignColsSchema = Schema{
	{Name: "id", Type: types.MustCreateString(sqltypes.VarChar, 129, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBForeignColsName},
	{Name: "for_col_name", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBForeignColsName},
	{Name: "ref_col_name", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBForeignColsName},
	{Name: "pos", Type: types.Uint32, Default: nil, Nullable: false, Source: InnoDBForeignColsName},
}

var innoDBFtBeingDeletedSchema = Schema{
	{Name: "type", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtBeingDeletedName},
}

var innoDBFtConfigSchema = Schema{
	{Name: "key", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBFtConfigName},
	{Name: "value", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBFtConfigName},
}

var innoDBFtDefaultStopwordSchema = Schema{
	{Name: "value", Type: types.MustCreateString(sqltypes.VarChar, 18, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 18, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBFtDefaultStopwordName},
}

var innoDBFtDeletedSchema = Schema{
	{Name: "doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtDeletedName},
}

var innoDBFtIndexCacheSchema = Schema{
	{Name: "word", Type: types.MustCreateString(sqltypes.VarChar, 337, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 337, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBFtIndexCacheName},
	{Name: "first_doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexCacheName},
	{Name: "last_doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexCacheName},
	{Name: "doc_count", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexCacheName},
	{Name: "doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexCacheName},
	{Name: "position", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexCacheName},
}

var innoDBFtIndexTableSchema = Schema{
	{Name: "word", Type: types.MustCreateString(sqltypes.VarChar, 337, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 337, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBFtIndexTableName},
	{Name: "first_doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexTableName},
	{Name: "last_doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexTableName},
	{Name: "doc_count", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexTableName},
	{Name: "doc_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexTableName},
	{Name: "position", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBFtIndexTableName},
}

var innoDBIndexesSchema = Schema{
	{Name: "index_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "table_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "type", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "n_fields", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "page_no", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "space", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBIndexesName},
	{Name: "merge_threshold", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBIndexesName},
}

var innoDBMetricsSchema = Schema{
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBMetricsName},
	{Name: "subsystem", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBMetricsName},
	{Name: "count", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBMetricsName},
	{Name: "max_count", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "min_count", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "avg_count", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "count_reset", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBMetricsName},
	{Name: "max_count_reset", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "min_count_reset", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "avg_count_reset", Type: types.Float32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Float32, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "time_enabled", Type: types.Datetime, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Datetime, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "time_disabled", Type: types.Datetime, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Datetime, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "time_elapsed", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "time_reset", Type: types.Datetime, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Datetime, false), Nullable: true, Source: InnoDBMetricsName},
	{Name: "status", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBMetricsName},
	{Name: "type", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBMetricsName},
	{Name: "comment", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBMetricsName},
}

var innoDBSessionTempTablespacesSchema = Schema{
	{Name: "id", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBSessionTempTablespacesName},
	{Name: "space", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBSessionTempTablespacesName},
	{Name: "path", Type: types.MustCreateString(sqltypes.VarChar, 4001, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 4001, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBSessionTempTablespacesName},
	{Name: "size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBSessionTempTablespacesName},
	{Name: "state", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBSessionTempTablespacesName},
	{Name: "purpose", Type: types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBSessionTempTablespacesName},
}

var innoDBTablesSchema = Schema{
	{Name: "table_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablesName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 655, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 655, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBTablesName},
	{Name: "flag", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTablesName},
	{Name: "n_cols", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTablesName},
	{Name: "space", Type: types.Int64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int64, false), Nullable: false, Source: InnoDBTablesName},
	{Name: "row_format", Type: types.MustCreateString(sqltypes.VarChar, 12, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablesName},
	{Name: "zip_page_size", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablesName},
	{Name: "space_type", Type: types.MustCreateString(sqltypes.VarChar, 12, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablesName},
	{Name: "instant_cols", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTablesName},
}

var innoDBTablespacesSchema = Schema{
	{Name: "space", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 655, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 655, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "flag", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "row_format", Type: types.MustCreateString(sqltypes.VarChar, 22, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesName},
	{Name: "page_size", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "zip_page_size", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "space_type", Type: types.MustCreateString(sqltypes.VarChar, 10, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesName},
	{Name: "fs_block_size", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "file_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "allocated_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "autoextend_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "server_version", Type: types.MustCreateString(sqltypes.VarChar, 10, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesName},
	{Name: "space_version", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBTablespacesName},
	{Name: "encryption", Type: types.MustCreateString(sqltypes.VarChar, 1, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesName},
	{Name: "state", Type: types.MustCreateString(sqltypes.VarChar, 10, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesName},
}

var innoDBTablespacesBriefSchema = Schema{
	{Name: "space", Type: types.MustCreateString(sqltypes.VarChar, 256, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesBriefName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 268, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBTablespacesBriefName},
	{Name: "path", Type: types.MustCreateString(sqltypes.VarChar, 512, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBTablespacesBriefName},
	{Name: "flag", Type: types.MustCreateString(sqltypes.VarChar, 256, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTablespacesBriefName},
	{Name: "space_type", Type: types.MustCreateString(sqltypes.VarChar, 7, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: InnoDBTablespacesBriefName},
}

var innoDBTablestatsSchema = Schema{
	{Name: "table_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "stats_initialized", Type: types.MustCreateString(sqltypes.VarChar, 193, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 192, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "num_rows", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "clust_index_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "other_index_size", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "modified_counter", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "autoinc", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTablestatsName},
	{Name: "ref_count", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTablestatsName},
}

var innoDBTempTableSchema = Schema{
	{Name: "table_id", Type: types.Int64, Default: nil, Nullable: false, Source: InnoDBTempTableInfoName},
	{Name: "name", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTempTableInfoName},
	{Name: "n_cols", Type: types.Uint64, Default: nil, Nullable: false, Source: InnoDBTempTableInfoName},
	{Name: "space", Type: types.Uint64, Default: nil, Nullable: false, Source: InnoDBTempTableInfoName},
}

var innoDBTrxSchema = Schema{
	{Name: "trx_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_state", Type: types.MustCreateString(sqltypes.VarChar, 13, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 13, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_started", Type: types.Datetime, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `"0000-00-00 00:00:00"`, types.Datetime, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_requested_lock_id", Type: types.MustCreateString(sqltypes.VarChar, 105, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTrxName},
	{Name: "trx_wait_started", Type: types.Datetime, Default: nil, Nullable: true, Source: InnoDBTrxName},
	{Name: "trx_weight", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_mysql_thread_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_query", Type: types.MustCreateString(sqltypes.VarChar, 1024, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTrxName},
	{Name: "trx_operation_state", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTrxName},
	{Name: "trx_tables_in_use", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_tables_locked", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_lock_structs", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_lock_memory_bytes", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_rows_locked", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_rows_modified", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_concurrency_tickets", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_isolation_level", Type: types.MustCreateString(sqltypes.VarChar, 16, Collation_Information_Schema_Default), Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, `""`, types.MustCreateString(sqltypes.VarChar, 16, Collation_Information_Schema_Default), false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_unique_checks", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_foreign_key_checks", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_last_foreign_key_error", Type: types.MustCreateString(sqltypes.VarChar, 256, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: InnoDBTrxName},
	{Name: "trx_adaptive_hash_latched", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_adaptive_hash_timeout", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_is_read_only", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_autocommit_non_locking", Type: types.Int32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Int32, false), Nullable: false, Source: InnoDBTrxName},
	{Name: "trx_schedule_weight", Type: types.Uint64, Default: nil, Nullable: true, Source: InnoDBTrxName},
}

var innoDBVirtualSchema = Schema{
	{Name: "table_id", Type: types.Uint64, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint64, false), Nullable: false, Source: InnoDBVirtualName},
	{Name: "pos", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBVirtualName},
	{Name: "base_pos", Type: types.Uint32, Default: planbuilder.MustStringToColumnDefaultValue(sqlCtx, "0", types.Uint32, false), Nullable: false, Source: InnoDBVirtualName},
}

// innoDBTempTableRowIter returns info on the temporary tables stored in the session.
// TODO: Since Table ids and Space are not yet supported this table is not completely accurate yet.
func innoDBTempTableRowIter(ctx *Context, c Catalog) (RowIter, error) {
	var rows []Row
	for _, db := range c.AllDatabases(ctx) {
		tb, ok := db.(TemporaryTableDatabase)
		if !ok {
			continue
		}

		tables, err := tb.GetAllTemporaryTables(ctx)
		if err != nil {
			return nil, err
		}

		for i, table := range tables {
			rows = append(rows, Row{i, table.String(), len(table.Schema()), 0})
		}
	}

	return RowsToRowIter(rows...), nil
}
