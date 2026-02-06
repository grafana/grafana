// Code generated from /app/OpenFGAParser.g4 by ANTLR 4.13.1. DO NOT EDIT.

package parser // OpenFGAParser

import "github.com/antlr4-go/antlr/v4"

// BaseOpenFGAParserListener is a complete listener for a parse tree produced by OpenFGAParser.
type BaseOpenFGAParserListener struct{}

var _ OpenFGAParserListener = &BaseOpenFGAParserListener{}

// VisitTerminal is called when a terminal node is visited.
func (s *BaseOpenFGAParserListener) VisitTerminal(node antlr.TerminalNode) {}

// VisitErrorNode is called when an error node is visited.
func (s *BaseOpenFGAParserListener) VisitErrorNode(node antlr.ErrorNode) {}

// EnterEveryRule is called when any rule is entered.
func (s *BaseOpenFGAParserListener) EnterEveryRule(ctx antlr.ParserRuleContext) {}

// ExitEveryRule is called when any rule is exited.
func (s *BaseOpenFGAParserListener) ExitEveryRule(ctx antlr.ParserRuleContext) {}

// EnterMain is called when production main is entered.
func (s *BaseOpenFGAParserListener) EnterMain(ctx *MainContext) {}

// ExitMain is called when production main is exited.
func (s *BaseOpenFGAParserListener) ExitMain(ctx *MainContext) {}

// EnterModelHeader is called when production modelHeader is entered.
func (s *BaseOpenFGAParserListener) EnterModelHeader(ctx *ModelHeaderContext) {}

// ExitModelHeader is called when production modelHeader is exited.
func (s *BaseOpenFGAParserListener) ExitModelHeader(ctx *ModelHeaderContext) {}

// EnterModuleHeader is called when production moduleHeader is entered.
func (s *BaseOpenFGAParserListener) EnterModuleHeader(ctx *ModuleHeaderContext) {}

// ExitModuleHeader is called when production moduleHeader is exited.
func (s *BaseOpenFGAParserListener) ExitModuleHeader(ctx *ModuleHeaderContext) {}

// EnterTypeDefs is called when production typeDefs is entered.
func (s *BaseOpenFGAParserListener) EnterTypeDefs(ctx *TypeDefsContext) {}

// ExitTypeDefs is called when production typeDefs is exited.
func (s *BaseOpenFGAParserListener) ExitTypeDefs(ctx *TypeDefsContext) {}

// EnterTypeDef is called when production typeDef is entered.
func (s *BaseOpenFGAParserListener) EnterTypeDef(ctx *TypeDefContext) {}

// ExitTypeDef is called when production typeDef is exited.
func (s *BaseOpenFGAParserListener) ExitTypeDef(ctx *TypeDefContext) {}

// EnterRelationDeclaration is called when production relationDeclaration is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDeclaration(ctx *RelationDeclarationContext) {}

// ExitRelationDeclaration is called when production relationDeclaration is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDeclaration(ctx *RelationDeclarationContext) {}

// EnterRelationName is called when production relationName is entered.
func (s *BaseOpenFGAParserListener) EnterRelationName(ctx *RelationNameContext) {}

// ExitRelationName is called when production relationName is exited.
func (s *BaseOpenFGAParserListener) ExitRelationName(ctx *RelationNameContext) {}

// EnterRelationDef is called when production relationDef is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDef(ctx *RelationDefContext) {}

// ExitRelationDef is called when production relationDef is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDef(ctx *RelationDefContext) {}

// EnterRelationDefNoDirect is called when production relationDefNoDirect is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefNoDirect(ctx *RelationDefNoDirectContext) {}

// ExitRelationDefNoDirect is called when production relationDefNoDirect is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefNoDirect(ctx *RelationDefNoDirectContext) {}

// EnterRelationDefPartials is called when production relationDefPartials is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefPartials(ctx *RelationDefPartialsContext) {}

// ExitRelationDefPartials is called when production relationDefPartials is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefPartials(ctx *RelationDefPartialsContext) {}

// EnterRelationDefGrouping is called when production relationDefGrouping is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefGrouping(ctx *RelationDefGroupingContext) {}

// ExitRelationDefGrouping is called when production relationDefGrouping is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefGrouping(ctx *RelationDefGroupingContext) {}

// EnterRelationRecurse is called when production relationRecurse is entered.
func (s *BaseOpenFGAParserListener) EnterRelationRecurse(ctx *RelationRecurseContext) {}

// ExitRelationRecurse is called when production relationRecurse is exited.
func (s *BaseOpenFGAParserListener) ExitRelationRecurse(ctx *RelationRecurseContext) {}

// EnterRelationRecurseNoDirect is called when production relationRecurseNoDirect is entered.
func (s *BaseOpenFGAParserListener) EnterRelationRecurseNoDirect(ctx *RelationRecurseNoDirectContext) {}

// ExitRelationRecurseNoDirect is called when production relationRecurseNoDirect is exited.
func (s *BaseOpenFGAParserListener) ExitRelationRecurseNoDirect(ctx *RelationRecurseNoDirectContext) {}

// EnterRelationDefDirectAssignment is called when production relationDefDirectAssignment is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefDirectAssignment(ctx *RelationDefDirectAssignmentContext) {}

// ExitRelationDefDirectAssignment is called when production relationDefDirectAssignment is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefDirectAssignment(ctx *RelationDefDirectAssignmentContext) {}

// EnterRelationDefRewrite is called when production relationDefRewrite is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefRewrite(ctx *RelationDefRewriteContext) {}

// ExitRelationDefRewrite is called when production relationDefRewrite is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefRewrite(ctx *RelationDefRewriteContext) {}

// EnterRelationDefTypeRestriction is called when production relationDefTypeRestriction is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefTypeRestriction(ctx *RelationDefTypeRestrictionContext) {}

// ExitRelationDefTypeRestriction is called when production relationDefTypeRestriction is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefTypeRestriction(ctx *RelationDefTypeRestrictionContext) {}

// EnterRelationDefTypeRestrictionBase is called when production relationDefTypeRestrictionBase is entered.
func (s *BaseOpenFGAParserListener) EnterRelationDefTypeRestrictionBase(ctx *RelationDefTypeRestrictionBaseContext) {}

// ExitRelationDefTypeRestrictionBase is called when production relationDefTypeRestrictionBase is exited.
func (s *BaseOpenFGAParserListener) ExitRelationDefTypeRestrictionBase(ctx *RelationDefTypeRestrictionBaseContext) {}

// EnterConditions is called when production conditions is entered.
func (s *BaseOpenFGAParserListener) EnterConditions(ctx *ConditionsContext) {}

// ExitConditions is called when production conditions is exited.
func (s *BaseOpenFGAParserListener) ExitConditions(ctx *ConditionsContext) {}

// EnterCondition is called when production condition is entered.
func (s *BaseOpenFGAParserListener) EnterCondition(ctx *ConditionContext) {}

// ExitCondition is called when production condition is exited.
func (s *BaseOpenFGAParserListener) ExitCondition(ctx *ConditionContext) {}

// EnterConditionName is called when production conditionName is entered.
func (s *BaseOpenFGAParserListener) EnterConditionName(ctx *ConditionNameContext) {}

// ExitConditionName is called when production conditionName is exited.
func (s *BaseOpenFGAParserListener) ExitConditionName(ctx *ConditionNameContext) {}

// EnterConditionParameter is called when production conditionParameter is entered.
func (s *BaseOpenFGAParserListener) EnterConditionParameter(ctx *ConditionParameterContext) {}

// ExitConditionParameter is called when production conditionParameter is exited.
func (s *BaseOpenFGAParserListener) ExitConditionParameter(ctx *ConditionParameterContext) {}

// EnterParameterName is called when production parameterName is entered.
func (s *BaseOpenFGAParserListener) EnterParameterName(ctx *ParameterNameContext) {}

// ExitParameterName is called when production parameterName is exited.
func (s *BaseOpenFGAParserListener) ExitParameterName(ctx *ParameterNameContext) {}

// EnterParameterType is called when production parameterType is entered.
func (s *BaseOpenFGAParserListener) EnterParameterType(ctx *ParameterTypeContext) {}

// ExitParameterType is called when production parameterType is exited.
func (s *BaseOpenFGAParserListener) ExitParameterType(ctx *ParameterTypeContext) {}

// EnterMultiLineComment is called when production multiLineComment is entered.
func (s *BaseOpenFGAParserListener) EnterMultiLineComment(ctx *MultiLineCommentContext) {}

// ExitMultiLineComment is called when production multiLineComment is exited.
func (s *BaseOpenFGAParserListener) ExitMultiLineComment(ctx *MultiLineCommentContext) {}

// EnterIdentifier is called when production identifier is entered.
func (s *BaseOpenFGAParserListener) EnterIdentifier(ctx *IdentifierContext) {}

// ExitIdentifier is called when production identifier is exited.
func (s *BaseOpenFGAParserListener) ExitIdentifier(ctx *IdentifierContext) {}

// EnterExtended_identifier is called when production extended_identifier is entered.
func (s *BaseOpenFGAParserListener) EnterExtended_identifier(ctx *Extended_identifierContext) {}

// ExitExtended_identifier is called when production extended_identifier is exited.
func (s *BaseOpenFGAParserListener) ExitExtended_identifier(ctx *Extended_identifierContext) {}

// EnterConditionExpression is called when production conditionExpression is entered.
func (s *BaseOpenFGAParserListener) EnterConditionExpression(ctx *ConditionExpressionContext) {}

// ExitConditionExpression is called when production conditionExpression is exited.
func (s *BaseOpenFGAParserListener) ExitConditionExpression(ctx *ConditionExpressionContext) {}
