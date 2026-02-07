// Code generated from /app/OpenFGAParser.g4 by ANTLR 4.13.1. DO NOT EDIT.

package parser // OpenFGAParser

import "github.com/antlr4-go/antlr/v4"


// OpenFGAParserListener is a complete listener for a parse tree produced by OpenFGAParser.
type OpenFGAParserListener interface {
	antlr.ParseTreeListener

	// EnterMain is called when entering the main production.
	EnterMain(c *MainContext)

	// EnterModelHeader is called when entering the modelHeader production.
	EnterModelHeader(c *ModelHeaderContext)

	// EnterModuleHeader is called when entering the moduleHeader production.
	EnterModuleHeader(c *ModuleHeaderContext)

	// EnterTypeDefs is called when entering the typeDefs production.
	EnterTypeDefs(c *TypeDefsContext)

	// EnterTypeDef is called when entering the typeDef production.
	EnterTypeDef(c *TypeDefContext)

	// EnterRelationDeclaration is called when entering the relationDeclaration production.
	EnterRelationDeclaration(c *RelationDeclarationContext)

	// EnterRelationName is called when entering the relationName production.
	EnterRelationName(c *RelationNameContext)

	// EnterRelationDef is called when entering the relationDef production.
	EnterRelationDef(c *RelationDefContext)

	// EnterRelationDefNoDirect is called when entering the relationDefNoDirect production.
	EnterRelationDefNoDirect(c *RelationDefNoDirectContext)

	// EnterRelationDefPartials is called when entering the relationDefPartials production.
	EnterRelationDefPartials(c *RelationDefPartialsContext)

	// EnterRelationDefGrouping is called when entering the relationDefGrouping production.
	EnterRelationDefGrouping(c *RelationDefGroupingContext)

	// EnterRelationRecurse is called when entering the relationRecurse production.
	EnterRelationRecurse(c *RelationRecurseContext)

	// EnterRelationRecurseNoDirect is called when entering the relationRecurseNoDirect production.
	EnterRelationRecurseNoDirect(c *RelationRecurseNoDirectContext)

	// EnterRelationDefDirectAssignment is called when entering the relationDefDirectAssignment production.
	EnterRelationDefDirectAssignment(c *RelationDefDirectAssignmentContext)

	// EnterRelationDefRewrite is called when entering the relationDefRewrite production.
	EnterRelationDefRewrite(c *RelationDefRewriteContext)

	// EnterRelationDefTypeRestriction is called when entering the relationDefTypeRestriction production.
	EnterRelationDefTypeRestriction(c *RelationDefTypeRestrictionContext)

	// EnterRelationDefTypeRestrictionBase is called when entering the relationDefTypeRestrictionBase production.
	EnterRelationDefTypeRestrictionBase(c *RelationDefTypeRestrictionBaseContext)

	// EnterConditions is called when entering the conditions production.
	EnterConditions(c *ConditionsContext)

	// EnterCondition is called when entering the condition production.
	EnterCondition(c *ConditionContext)

	// EnterConditionName is called when entering the conditionName production.
	EnterConditionName(c *ConditionNameContext)

	// EnterConditionParameter is called when entering the conditionParameter production.
	EnterConditionParameter(c *ConditionParameterContext)

	// EnterParameterName is called when entering the parameterName production.
	EnterParameterName(c *ParameterNameContext)

	// EnterParameterType is called when entering the parameterType production.
	EnterParameterType(c *ParameterTypeContext)

	// EnterMultiLineComment is called when entering the multiLineComment production.
	EnterMultiLineComment(c *MultiLineCommentContext)

	// EnterIdentifier is called when entering the identifier production.
	EnterIdentifier(c *IdentifierContext)

	// EnterExtended_identifier is called when entering the extended_identifier production.
	EnterExtended_identifier(c *Extended_identifierContext)

	// EnterConditionExpression is called when entering the conditionExpression production.
	EnterConditionExpression(c *ConditionExpressionContext)

	// ExitMain is called when exiting the main production.
	ExitMain(c *MainContext)

	// ExitModelHeader is called when exiting the modelHeader production.
	ExitModelHeader(c *ModelHeaderContext)

	// ExitModuleHeader is called when exiting the moduleHeader production.
	ExitModuleHeader(c *ModuleHeaderContext)

	// ExitTypeDefs is called when exiting the typeDefs production.
	ExitTypeDefs(c *TypeDefsContext)

	// ExitTypeDef is called when exiting the typeDef production.
	ExitTypeDef(c *TypeDefContext)

	// ExitRelationDeclaration is called when exiting the relationDeclaration production.
	ExitRelationDeclaration(c *RelationDeclarationContext)

	// ExitRelationName is called when exiting the relationName production.
	ExitRelationName(c *RelationNameContext)

	// ExitRelationDef is called when exiting the relationDef production.
	ExitRelationDef(c *RelationDefContext)

	// ExitRelationDefNoDirect is called when exiting the relationDefNoDirect production.
	ExitRelationDefNoDirect(c *RelationDefNoDirectContext)

	// ExitRelationDefPartials is called when exiting the relationDefPartials production.
	ExitRelationDefPartials(c *RelationDefPartialsContext)

	// ExitRelationDefGrouping is called when exiting the relationDefGrouping production.
	ExitRelationDefGrouping(c *RelationDefGroupingContext)

	// ExitRelationRecurse is called when exiting the relationRecurse production.
	ExitRelationRecurse(c *RelationRecurseContext)

	// ExitRelationRecurseNoDirect is called when exiting the relationRecurseNoDirect production.
	ExitRelationRecurseNoDirect(c *RelationRecurseNoDirectContext)

	// ExitRelationDefDirectAssignment is called when exiting the relationDefDirectAssignment production.
	ExitRelationDefDirectAssignment(c *RelationDefDirectAssignmentContext)

	// ExitRelationDefRewrite is called when exiting the relationDefRewrite production.
	ExitRelationDefRewrite(c *RelationDefRewriteContext)

	// ExitRelationDefTypeRestriction is called when exiting the relationDefTypeRestriction production.
	ExitRelationDefTypeRestriction(c *RelationDefTypeRestrictionContext)

	// ExitRelationDefTypeRestrictionBase is called when exiting the relationDefTypeRestrictionBase production.
	ExitRelationDefTypeRestrictionBase(c *RelationDefTypeRestrictionBaseContext)

	// ExitConditions is called when exiting the conditions production.
	ExitConditions(c *ConditionsContext)

	// ExitCondition is called when exiting the condition production.
	ExitCondition(c *ConditionContext)

	// ExitConditionName is called when exiting the conditionName production.
	ExitConditionName(c *ConditionNameContext)

	// ExitConditionParameter is called when exiting the conditionParameter production.
	ExitConditionParameter(c *ConditionParameterContext)

	// ExitParameterName is called when exiting the parameterName production.
	ExitParameterName(c *ParameterNameContext)

	// ExitParameterType is called when exiting the parameterType production.
	ExitParameterType(c *ParameterTypeContext)

	// ExitMultiLineComment is called when exiting the multiLineComment production.
	ExitMultiLineComment(c *MultiLineCommentContext)

	// ExitIdentifier is called when exiting the identifier production.
	ExitIdentifier(c *IdentifierContext)

	// ExitExtended_identifier is called when exiting the extended_identifier production.
	ExitExtended_identifier(c *Extended_identifierContext)

	// ExitConditionExpression is called when exiting the conditionExpression production.
	ExitConditionExpression(c *ConditionExpressionContext)
}
