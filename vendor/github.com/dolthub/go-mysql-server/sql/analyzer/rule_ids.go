package analyzer

//go:generate stringer -type=RuleId -linecomment

type RuleId int

const (
	// TODO: these comments don't match how the rules are actually applied
	// once before
	applyDefaultSelectLimitId     RuleId = iota // applyDefaultSelectLimit
	validateOffsetAndLimitId                    // validateOffsetAndLimit
	validateStarExpressionsId                   // validateStarExpressions
	ValidateCreateTableId                       // validateCreateTable
	validateAlterTableId                        // validateAlterTable
	validateExprSemId                           // validateExprSem
	loadStoredProceduresId                      // loadStoredProcedures
	validateDropTablesId                        // validateDropTables
	resolveDropConstraintId                     // resolveDropConstraint
	validateDropConstraintId                    // validateDropConstraint
	resolveCreateSelectId                       // resolveCreateSelect
	resolveSubqueriesId                         // resolveSubqueries
	resolveUnionsId                             // resolveUnions
	ValidateColumnDefaultsId                    // validateColumnDefaults
	validateCreateTriggerId                     // validateCreateTrigger
	validateReadOnlyDatabaseId                  // validateReadOnlyDatabase
	validateReadOnlyTransactionId               // validateReadOnlyTransaction
	validateDatabaseSetId                       // validateDatabaseSet
	validatePrivilegesId                        // validatePrivileges
	validateGroupById                           // validateGroupBy

	// default
	flattenTableAliasesId          // flattenTableAliases
	pushdownSubqueryAliasFiltersId // pushdownSubqueryAliasFilters
	replaceSubqueriesId            // replaceSubqueries
	validateCheckConstraintId      // validateCheckConstraints
	replaceCountStarId             // replaceCountStar
	replaceCrossJoinsId            // replaceCrossJoins
	moveJoinCondsToFilterId        // moveJoinConditionsToFilter
	simplifyFiltersId              // simplifyFilters
	pushNotFiltersId               // pushNotFilters

	// after default
	hoistOutOfScopeFiltersId     // hoistOutOfScopeFilters
	unnestInSubqueriesId         // unnestInSubqueries
	unnestExistsSubqueriesId     // unnestExistsSubqueries
	finalizeSubqueriesId         // finalizeSubqueries
	finalizeUnionsId             // finalizeUnions
	loadTriggersId               // loadTriggers
	processTruncateId            // processTruncate
	ResolveAlterColumnId         // ResolveAlterColumn
	stripTableNameInDefaultsId   // stripTableNamesFromColumnDefaults
	optimizeJoinsId              // optimizeJoins
	pushFiltersId                // pushFilters
	applyIndexesFromOuterScopeId // applyIndexesFromOuterScope
	pruneTablesId                // pruneTables
	assignExecIndexesId          // assignExecIndexes
	inlineSubqueryAliasRefsId    // inlineSubqueryAliasRefs
	eraseProjectionId            // eraseProjection
	flattenDistinctId            // flattenDistinct
	replaceAggId                 // replaceAgg
	replaceIdxSortId             // replaceIdxSort
	insertTopNId                 // insertTopNNodes
	replaceIdxOrderByDistanceId  // replaceIdxOrderByDistance
	applyHashInId                // applyHashIn
	resolveInsertRowsId          // resolveInsertRows
	applyTriggersId              // applyTriggers
	applyProceduresId            // applyProcedures
	assignRoutinesId             // assignRoutines
	modifyUpdateExprsForJoinId   // modifyUpdateExprsForJoin
	applyForeignKeysId           // applyForeignKeys
	interpreterId                // interpreter

	// validate
	validateResolvedId          // validateResolved
	validateOrderById           // validateOrderBy
	validateSchemaSourceId      // validateSchemaSource
	validateIndexCreationId     // validateIndexCreation
	ValidateOperandsId          // validateOperands
	validateIntervalUsageId     // validateIntervalUsage
	validateSubqueryColumnsId   // validateSubqueryColumns
	validateUnionSchemasMatchId // validateUnionSchemasMatch
	validateAggregationsId      // validateAggregations
	validateDeleteFromId        // validateDeleteFrom

	// after all
	cacheSubqueryAliasesInJoinsId  // cacheSubqueryAliasesInJoins
	QuoteDefaultColumnValueNamesId // quoteDefaultColumnValueNames
	TrackProcessId                 // trackProcess
)
