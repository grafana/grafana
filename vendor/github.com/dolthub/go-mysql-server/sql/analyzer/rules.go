// Copyright 2020-2021 Dolthub, Inc.
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

package analyzer

func init() {
	OnceAfterAll = []Rule{
		{Id: assignExecIndexesId, Apply: assignExecIndexes},
		// resolveInsertRows inserts a projection wrapping values that cannot be seen by fixup
		{Id: resolveInsertRowsId, Apply: resolveInsertRows},
		{Id: applyTriggersId, Apply: applyTriggers},
		{Id: applyProceduresId, Apply: applyProcedures},
		{Id: inlineSubqueryAliasRefsId, Apply: inlineSubqueryAliasRefs},
		{Id: cacheSubqueryAliasesInJoinsId, Apply: cacheSubqueryAliasesInJoins},
		{Id: QuoteDefaultColumnValueNamesId, Apply: quoteDefaultColumnValueNames},
		{Id: TrackProcessId, Apply: trackProcess},
	}
}

// OnceBeforeDefault contains the rules to be applied just once before the
// DefaultRules.
var OnceBeforeDefault = []Rule{
	{Id: applyDefaultSelectLimitId, Apply: applyDefaultSelectLimit},
	{Id: replaceCountStarId, Apply: replaceCountStar},
	{Id: validateOffsetAndLimitId, Apply: validateOffsetAndLimit},
	{Id: ValidateCreateTableId, Apply: validateCreateTable},
	{Id: validateAlterTableId, Apply: validateAlterTable},
	{Id: validateExprSemId, Apply: validateExprSem},
	{Id: resolveDropConstraintId, Apply: resolveDropConstraint},
	{Id: ResolveAlterColumnId, Apply: resolveAlterColumn},
	{Id: validateDropTablesId, Apply: validateDropTables},
	{Id: resolveCreateSelectId, Apply: resolveCreateSelect},
	{Id: validateDropConstraintId, Apply: validateDropConstraint},
	{Id: resolveUnionsId, Apply: resolveUnions},
	{Id: validateCreateTriggerId, Apply: validateCreateTrigger},
	{Id: ValidateColumnDefaultsId, Apply: validateColumnDefaults},
	{Id: validateReadOnlyDatabaseId, Apply: validateReadOnlyDatabase},
	{Id: validateReadOnlyTransactionId, Apply: validateReadOnlyTransaction},
	{Id: validateDatabaseSetId, Apply: validateDatabaseSet},
	{Id: validateDeleteFromId, Apply: validateDeleteFrom},
	{Id: simplifyFiltersId, Apply: simplifyFilters}, //TODO inline?
	{Id: pushNotFiltersId, Apply: pushNotFilters},   //TODO inline?
	{Id: hoistOutOfScopeFiltersId, Apply: hoistOutOfScopeFilters},
	{Id: validateGroupById, Apply: validateGroupBy},
}

// AlwaysBeforeDefault contains the rules to be applied just once before the
// DefaultRules. These are an extension of the OnceBeforeDefault rules that
// will always apply to nodes, unlike the OnceBeforeDefault rules that may
// be excluded depending on the node. This is only used by integrators.
var AlwaysBeforeDefault []Rule

// DefaultRules to apply when analyzing nodes.
var DefaultRules = []Rule{
	{Id: validateStarExpressionsId, Apply: validateStarExpressions}, //TODO
	{Id: replaceSubqueriesId, Apply: replaceSubqueries},
	{Id: pushdownSubqueryAliasFiltersId, Apply: pushdownSubqueryAliasFilters},
	{Id: pruneTablesId, Apply: pruneTables},
	{Id: validateCheckConstraintId, Apply: validateCheckConstraints},
	{Id: unnestInSubqueriesId, Apply: unnestInSubqueries},
	{Id: resolveSubqueriesId, Apply: resolveSubqueries},
	{Id: replaceCrossJoinsId, Apply: replaceCrossJoins},
}

var OnceAfterDefault = []Rule{
	{Id: unnestExistsSubqueriesId, Apply: unnestExistsSubqueries},
	{Id: moveJoinCondsToFilterId, Apply: moveJoinConditionsToFilter},
	{Id: finalizeUnionsId, Apply: finalizeUnions},
	{Id: loadTriggersId, Apply: loadTriggers},
	{Id: processTruncateId, Apply: processTruncate},
	{Id: stripTableNameInDefaultsId, Apply: stripTableNamesFromColumnDefaults},
	{Id: pushFiltersId, Apply: pushFilters},
	{Id: optimizeJoinsId, Apply: optimizeJoins},
	{Id: finalizeSubqueriesId, Apply: finalizeSubqueries},
	{Id: applyIndexesFromOuterScopeId, Apply: applyIndexesFromOuterScope},
	{Id: replaceAggId, Apply: replaceAgg},
	{Id: replaceIdxSortId, Apply: replaceIdxSort},
	{Id: eraseProjectionId, Apply: eraseProjection},
	{Id: flattenDistinctId, Apply: flattenDistinct},
	{Id: insertTopNId, Apply: insertTopNNodes},
	{Id: replaceIdxOrderByDistanceId, Apply: replaceIdxOrderByDistance},
	{Id: applyHashInId, Apply: applyHashIn},
	{Id: assignRoutinesId, Apply: assignRoutines},
	{Id: modifyUpdateExprsForJoinId, Apply: modifyUpdateExprsForJoin},
	{Id: applyForeignKeysId, Apply: applyForeignKeys},
	{Id: interpreterId, Apply: interpreter},
}

// DefaultValidationRules to apply while analyzing nodes.
var DefaultValidationRules = []Rule{
	{Id: validateResolvedId, Apply: validateResolved},
	{Id: validateOrderById, Apply: validateOrderBy},
	{Id: validateSchemaSourceId, Apply: validateSchemaSource},
	{Id: validateIndexCreationId, Apply: validateIndexCreation},
	{Id: ValidateOperandsId, Apply: validateOperands},
	{Id: validateIntervalUsageId, Apply: validateIntervalUsage},
	{Id: validateSubqueryColumnsId, Apply: validateSubqueryColumns},
	{Id: validateUnionSchemasMatchId, Apply: validateUnionSchemasMatch},
	{Id: validateAggregationsId, Apply: validateAggregations},
}

var OnceAfterAll []Rule
