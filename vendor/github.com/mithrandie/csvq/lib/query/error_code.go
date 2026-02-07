package query

const returnCodeBaseSignal = 128
const errorSignalBase = 91280

const (
	ReturnCodeApplicationError          = 1
	ReturnCodeIncorrectUsage            = 2
	ReturnCodeSyntaxError               = 4
	ReturnCodeContextDone               = 8
	ReturnCodeIOError                   = 16
	ReturnCodeSystemError               = 32
	ReturnCodeDefaultUserTriggeredError = 64
)

const (
	//Application Error
	ErrorFatal                                = 1
	ErrorCannotDetectFileEncoding             = 10001
	ErrorFieldAmbiguous                       = 10101
	ErrorFieldNotExist                        = 10102
	ErrorFieldNotGroupKey                     = 10103
	ErrorDuplicateFieldName                   = 10104
	ErrorNotGroupingRecords                   = 10201
	ErrorNotAllowedAnalyticFunction           = 10202
	ErrorUndeclaredVariable                   = 10301
	ErrorVariableRedeclared                   = 10302
	ErrorUndefinedConstant                    = 10321
	ErrorInvalidUrl                           = 10341
	ErrorUnsupportedUrlScheme                 = 10342
	ErrorFunctionNotExist                     = 10401
	ErrorFunctionArgumentsLength              = 10402
	ErrorFunctionInvalidArgument              = 10403
	ErrorFunctionRedeclared                   = 10501
	ErrorBuiltInFunctionDeclared              = 10502
	ErrorDuplicateParameter                   = 10503
	ErrorSubqueryTooManyRecords               = 10601
	ErrorSubqueryTooManyFields                = 10602
	ErrorJsonQueryTooManyRecords              = 10701
	ErrorLoadJson                             = 10702
	ErrorEmptyJsonQuery                       = 10703 // Not in use after v1.14.0
	ErrorJsonLinesStructure                   = 10704
	ErrorEmptyJsonTable                       = 10801 // Not in use after v1.14.0
	ErrorIncorrectLateralUsage                = 10802
	ErrorEmptyInlineTable                     = 10803
	ErrorInvalidTableObject                   = 10901
	ErrorTableObjectInvalidDelimiter          = 10902
	ErrorTableObjectInvalidDelimiterPositions = 10903
	ErrorTableObjectInvalidJsonQuery          = 10904
	ErrorTableObjectArgumentsLength           = 10905
	ErrorTableObjectJsonArgumentsLength       = 10906
	ErrorTableObjectInvalidArgument           = 10907
	ErrorCursorRedeclared                     = 11001
	ErrorUndeclaredCursor                     = 11002
	ErrorCursorClosed                         = 11003
	ErrorCursorOpen                           = 11004
	ErrorInvalidCursorStatement               = 11005
	ErrorPseudoCursor                         = 11006
	ErrorCursorFetchLength                    = 11007
	ErrorInvalidFetchPosition                 = 11008
	ErrorInlineTableRedefined                 = 11101
	ErrorUndefinedInlineTable                 = 11102
	ErrorInlineTableFieldLength               = 11103
	ErrorFileNameAmbiguous                    = 11201
	ErrorDataParsing                          = 11301
	ErrorDataEncoding                         = 11351
	ErrorTableFieldLength                     = 11401
	ErrorTemporaryTableRedeclared             = 11501
	ErrorUndeclaredTemporaryTable             = 11502
	ErrorTemporaryTableFieldLength            = 11503
	ErrorDuplicateTableName                   = 11601
	ErrorTableNotLoaded                       = 11602
	ErrorStdinEmpty                           = 11603
	ErrorInlineTableCannotBeUpdated           = 11604
	ErrorAliasMustBeSpecifiedForUpdate        = 11605
	ErrorRowValueLengthInComparison           = 11701
	ErrorFieldLengthInComparison              = 11702
	ErrorInvalidLimitPercentage               = 11801
	ErrorInvalidLimitNumber                   = 11802
	ErrorInvalidOffsetNumber                  = 11901
	ErrorCombinedSetFieldLength               = 12001
	ErrorRecursionExceededLimit               = 12002
	ErrorNestedRecursion                      = 12003
	ErrorInsertRowValueLength                 = 12101
	ErrorInsertSelectFieldLength              = 12102
	ErrorUpdateFieldNotExist                  = 12201
	ErrorUpdateValueAmbiguous                 = 12202
	ErrorDeleteTableNotSpecified              = 12301
	ErrorShowInvalidObjectType                = 12401
	ErrorReplaceValueLength                   = 12501
	ErrorSourceInvalidFilePath                = 12601
	ErrorInvalidFlagName                      = 12701
	ErrorFlagValueNowAllowedFormat            = 12702
	ErrorInvalidFlagValue                     = 12703
	ErrorAddFlagNotSupportedName              = 12801
	ErrorRemoveFlagNotSupportedName           = 12802
	ErrorInvalidFlagValueToBeRemoved          = 12803
	ErrorInvalidRuntimeInformation            = 12901
	ErrorNotTable                             = 13001
	ErrorInvalidTableAttributeName            = 13002
	ErrorTableAttributeValueNotAllowedFormat  = 13003
	ErrorInvalidTableAttributeValue           = 13004
	ErrorInvalidEventName                     = 13101
	ErrorInternalRecordIdNotExist             = 13201
	ErrorInternalRecordIdEmpty                = 13202
	ErrorFieldLengthNotMatch                  = 13301
	ErrorRowValueLengthInList                 = 13401
	ErrorFormatStringLengthNotMatch           = 13501
	ErrorUnknownFormatPlaceholder             = 13502
	ErrorFormatUnexpectedTermination          = 13503
	ErrorInvalidReloadType                    = 13601
	ErrorLoadConfiguration                    = 13701
	ErrorDuplicateStatementName               = 13801
	ErrorStatementNotExist                    = 13802
	ErrorStatementReplaceValueNotSpecified    = 13803
	ErrorReplaceKeyNotSet                     = 13901
	ErrorSelectIntoQueryFieldLengthNotMatch   = 14001
	ErrorSelectIntoQueryTooManyRecords        = 14002
	ErrorIntegerDevidedByZero                 = 30000

	//Incorrect Command Usage
	ErrorIncorrectCommandUsage = 90020

	//Syntax Error
	ErrorSyntaxError                  = 90040
	ErrorInvalidValueExpression       = 90041
	ErrorNestedAggregateFunctions     = 90042
	ErrorPreparedStatementSyntaxError = 90043

	//Context Error
	ErrorContextDone     = 90080
	ErrorContextCanceled = 90081
	ErrorFileLockTimeout = 90082

	//IO Error
	ErrorIO               = 90160
	ErrorCommit           = 90171
	ErrorRollback         = 90172
	ErrorInvalidPath      = 90180
	ErrorFileNotExist     = 90181
	ErrorFileAlreadyExist = 90182
	ErrorFileUnableToRead = 90183

	//System Error
	ErrorSystemError      = 90320
	ErrorExternalCommand  = 30330
	ErrorHttpRequestError = 30400

	//User Triggered Error
	ErrorExit          = 90640
	ErrorUserTriggered = 90650
)
