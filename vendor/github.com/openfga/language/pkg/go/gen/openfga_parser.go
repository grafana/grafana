// Code generated from /app/OpenFGAParser.g4 by ANTLR 4.13.1. DO NOT EDIT.

package parser // OpenFGAParser

import (
	"fmt"
	"strconv"
  	"sync"

	"github.com/antlr4-go/antlr/v4"
)

// Suppress unused import errors
var _ = fmt.Printf
var _ = strconv.Itoa
var _ = sync.Once{}


type OpenFGAParser struct {
	*antlr.BaseParser
}

var OpenFGAParserParserStaticData struct {
  once                   sync.Once
  serializedATN          []int32
  LiteralNames           []string
  SymbolicNames          []string
  RuleNames              []string
  PredictionContextCache *antlr.PredictionContextCache
  atn                    *antlr.ATN
  decisionToDFA          []*antlr.DFA
}

func openfgaparserParserInit() {
  staticData := &OpenFGAParserParserStaticData
  staticData.LiteralNames = []string{
    "", "':'", "','", "'<'", "'>'", "'['", "", "'('", "')'", "", "", "'#'", 
    "'and'", "'or'", "'but not'", "'from'", "'module'", "'model'", "'schema'", 
    "", "'extend'", "'type'", "'condition'", "'relations'", "'relation'", 
    "'define'", "'with'", "'=='", "'!='", "'in'", "'<='", "'>='", "'&&'", 
    "'||'", "']'", "'{'", "'}'", "'.'", "'-'", "'!'", "'?'", "'+'", "'*'", 
    "'/'", "'%'", "'true'", "'false'", "'null'",
  }
  staticData.SymbolicNames = []string{
    "", "COLON", "COMMA", "LESS", "GREATER", "LBRACKET", "RBRACKET", "LPAREN", 
    "RPAREN", "WHITESPACE", "IDENTIFIER", "HASH", "AND", "OR", "BUT_NOT", 
    "FROM", "MODULE", "MODEL", "SCHEMA", "SCHEMA_VERSION", "EXTEND", "TYPE", 
    "CONDITION", "RELATIONS", "RELATION", "DEFINE", "KEYWORD_WITH", "EQUALS", 
    "NOT_EQUALS", "IN", "LESS_EQUALS", "GREATER_EQUALS", "LOGICAL_AND", 
    "LOGICAL_OR", "RPRACKET", "LBRACE", "RBRACE", "DOT", "MINUS", "EXCLAM", 
    "QUESTIONMARK", "PLUS", "STAR", "SLASH", "PERCENT", "CEL_TRUE", "CEL_FALSE", 
    "NUL", "CEL_COMMENT", "NUM_FLOAT", "NUM_INT", "NUM_UINT", "STRING", 
    "BYTES", "EXTENDED_IDENTIFIER", "NEWLINE", "CONDITION_PARAM_CONTAINER", 
    "CONDITION_PARAM_TYPE",
  }
  staticData.RuleNames = []string{
    "main", "modelHeader", "moduleHeader", "typeDefs", "typeDef", "relationDeclaration", 
    "relationName", "relationDef", "relationDefNoDirect", "relationDefPartials", 
    "relationDefGrouping", "relationRecurse", "relationRecurseNoDirect", 
    "relationDefDirectAssignment", "relationDefRewrite", "relationDefTypeRestriction", 
    "relationDefTypeRestrictionBase", "conditions", "condition", "conditionName", 
    "conditionParameter", "parameterName", "parameterType", "multiLineComment", 
    "identifier", "extended_identifier", "conditionExpression",
  }
  staticData.PredictionContextCache = antlr.NewPredictionContextCache()
  staticData.serializedATN = []int32{
	4, 1, 57, 392, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4, 7, 
	4, 2, 5, 7, 5, 2, 6, 7, 6, 2, 7, 7, 7, 2, 8, 7, 8, 2, 9, 7, 9, 2, 10, 7, 
	10, 2, 11, 7, 11, 2, 12, 7, 12, 2, 13, 7, 13, 2, 14, 7, 14, 2, 15, 7, 15, 
	2, 16, 7, 16, 2, 17, 7, 17, 2, 18, 7, 18, 2, 19, 7, 19, 2, 20, 7, 20, 2, 
	21, 7, 21, 2, 22, 7, 22, 2, 23, 7, 23, 2, 24, 7, 24, 2, 25, 7, 25, 2, 26, 
	7, 26, 1, 0, 3, 0, 56, 8, 0, 1, 0, 3, 0, 59, 8, 0, 1, 0, 1, 0, 3, 0, 63, 
	8, 0, 1, 0, 3, 0, 66, 8, 0, 1, 0, 1, 0, 3, 0, 70, 8, 0, 1, 0, 1, 0, 3, 
	0, 74, 8, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 3, 1, 81, 8, 1, 1, 1, 1, 1, 
	1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 89, 8, 1, 1, 2, 1, 2, 1, 2, 3, 2, 94, 8, 
	2, 1, 2, 1, 2, 1, 2, 1, 2, 3, 2, 100, 8, 2, 1, 3, 5, 3, 103, 8, 3, 10, 
	3, 12, 3, 106, 9, 3, 1, 4, 1, 4, 3, 4, 110, 8, 4, 1, 4, 1, 4, 1, 4, 3, 
	4, 115, 8, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 4, 4, 123, 8, 4, 11, 
	4, 12, 4, 124, 3, 4, 127, 8, 4, 1, 5, 1, 5, 3, 5, 131, 8, 5, 1, 5, 1, 5, 
	1, 5, 1, 5, 1, 5, 3, 5, 138, 8, 5, 1, 5, 1, 5, 3, 5, 142, 8, 5, 1, 5, 1, 
	5, 1, 6, 1, 6, 1, 7, 1, 7, 1, 7, 3, 7, 151, 8, 7, 1, 7, 3, 7, 154, 8, 7, 
	1, 8, 1, 8, 3, 8, 158, 8, 8, 1, 8, 3, 8, 161, 8, 8, 1, 9, 1, 9, 1, 9, 1, 
	9, 1, 9, 3, 9, 168, 8, 9, 4, 9, 170, 8, 9, 11, 9, 12, 9, 171, 1, 9, 1, 
	9, 1, 9, 1, 9, 1, 9, 3, 9, 179, 8, 9, 4, 9, 181, 8, 9, 11, 9, 12, 9, 182, 
	1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 3, 9, 190, 8, 9, 3, 9, 192, 8, 9, 1, 10, 
	1, 10, 1, 11, 1, 11, 5, 11, 198, 8, 11, 10, 11, 12, 11, 201, 9, 11, 1, 
	11, 1, 11, 3, 11, 205, 8, 11, 1, 11, 5, 11, 208, 8, 11, 10, 11, 12, 11, 
	211, 9, 11, 1, 11, 1, 11, 1, 12, 1, 12, 5, 12, 217, 8, 12, 10, 12, 12, 
	12, 220, 9, 12, 1, 12, 1, 12, 3, 12, 224, 8, 12, 1, 12, 5, 12, 227, 8, 
	12, 10, 12, 12, 12, 230, 9, 12, 1, 12, 1, 12, 1, 13, 1, 13, 3, 13, 236, 
	8, 13, 1, 13, 1, 13, 3, 13, 240, 8, 13, 1, 13, 1, 13, 3, 13, 244, 8, 13, 
	1, 13, 1, 13, 3, 13, 248, 8, 13, 5, 13, 250, 8, 13, 10, 13, 12, 13, 253, 
	9, 13, 1, 13, 1, 13, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 3, 14, 262, 8, 
	14, 1, 15, 3, 15, 265, 8, 15, 1, 15, 1, 15, 1, 15, 1, 15, 1, 15, 1, 15, 
	1, 15, 3, 15, 274, 8, 15, 1, 15, 3, 15, 277, 8, 15, 1, 16, 1, 16, 1, 16, 
	1, 16, 1, 16, 3, 16, 284, 8, 16, 1, 17, 5, 17, 287, 8, 17, 10, 17, 12, 
	17, 290, 9, 17, 1, 18, 1, 18, 3, 18, 294, 8, 18, 1, 18, 1, 18, 1, 18, 1, 
	18, 1, 18, 3, 18, 301, 8, 18, 1, 18, 1, 18, 3, 18, 305, 8, 18, 1, 18, 1, 
	18, 3, 18, 309, 8, 18, 1, 18, 1, 18, 3, 18, 313, 8, 18, 1, 18, 1, 18, 3, 
	18, 317, 8, 18, 5, 18, 319, 8, 18, 10, 18, 12, 18, 322, 9, 18, 1, 18, 3, 
	18, 325, 8, 18, 1, 18, 1, 18, 3, 18, 329, 8, 18, 1, 18, 1, 18, 3, 18, 333, 
	8, 18, 1, 18, 3, 18, 336, 8, 18, 1, 18, 1, 18, 3, 18, 340, 8, 18, 1, 18, 
	1, 18, 1, 19, 1, 19, 1, 20, 3, 20, 347, 8, 20, 1, 20, 1, 20, 3, 20, 351, 
	8, 20, 1, 20, 1, 20, 3, 20, 355, 8, 20, 1, 20, 1, 20, 1, 21, 1, 21, 1, 
	22, 1, 22, 1, 22, 1, 22, 1, 22, 3, 22, 366, 8, 22, 1, 23, 1, 23, 5, 23, 
	370, 8, 23, 10, 23, 12, 23, 373, 9, 23, 1, 23, 1, 23, 3, 23, 377, 8, 23, 
	1, 24, 1, 24, 1, 25, 1, 25, 3, 25, 383, 8, 25, 1, 26, 1, 26, 5, 26, 387, 
	8, 26, 10, 26, 12, 26, 390, 9, 26, 1, 26, 0, 0, 27, 0, 2, 4, 6, 8, 10, 
	12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 
	48, 50, 52, 0, 4, 1, 0, 55, 55, 4, 0, 10, 10, 16, 18, 20, 21, 24, 24, 5, 
	0, 3, 5, 7, 10, 27, 35, 37, 53, 55, 55, 1, 0, 36, 36, 433, 0, 55, 1, 0, 
	0, 0, 2, 80, 1, 0, 0, 0, 4, 93, 1, 0, 0, 0, 6, 104, 1, 0, 0, 0, 8, 109, 
	1, 0, 0, 0, 10, 130, 1, 0, 0, 0, 12, 145, 1, 0, 0, 0, 14, 150, 1, 0, 0, 
	0, 16, 157, 1, 0, 0, 0, 18, 191, 1, 0, 0, 0, 20, 193, 1, 0, 0, 0, 22, 195, 
	1, 0, 0, 0, 24, 214, 1, 0, 0, 0, 26, 233, 1, 0, 0, 0, 28, 256, 1, 0, 0, 
	0, 30, 264, 1, 0, 0, 0, 32, 278, 1, 0, 0, 0, 34, 288, 1, 0, 0, 0, 36, 293, 
	1, 0, 0, 0, 38, 343, 1, 0, 0, 0, 40, 346, 1, 0, 0, 0, 42, 358, 1, 0, 0, 
	0, 44, 365, 1, 0, 0, 0, 46, 367, 1, 0, 0, 0, 48, 378, 1, 0, 0, 0, 50, 382, 
	1, 0, 0, 0, 52, 388, 1, 0, 0, 0, 54, 56, 5, 9, 0, 0, 55, 54, 1, 0, 0, 0, 
	55, 56, 1, 0, 0, 0, 56, 58, 1, 0, 0, 0, 57, 59, 5, 55, 0, 0, 58, 57, 1, 
	0, 0, 0, 58, 59, 1, 0, 0, 0, 59, 62, 1, 0, 0, 0, 60, 63, 3, 2, 1, 0, 61, 
	63, 3, 4, 2, 0, 62, 60, 1, 0, 0, 0, 62, 61, 1, 0, 0, 0, 63, 65, 1, 0, 0, 
	0, 64, 66, 5, 55, 0, 0, 65, 64, 1, 0, 0, 0, 65, 66, 1, 0, 0, 0, 66, 67, 
	1, 0, 0, 0, 67, 69, 3, 6, 3, 0, 68, 70, 5, 55, 0, 0, 69, 68, 1, 0, 0, 0, 
	69, 70, 1, 0, 0, 0, 70, 71, 1, 0, 0, 0, 71, 73, 3, 34, 17, 0, 72, 74, 5, 
	55, 0, 0, 73, 72, 1, 0, 0, 0, 73, 74, 1, 0, 0, 0, 74, 75, 1, 0, 0, 0, 75, 
	76, 5, 0, 0, 1, 76, 1, 1, 0, 0, 0, 77, 78, 3, 46, 23, 0, 78, 79, 5, 55, 
	0, 0, 79, 81, 1, 0, 0, 0, 80, 77, 1, 0, 0, 0, 80, 81, 1, 0, 0, 0, 81, 82, 
	1, 0, 0, 0, 82, 83, 5, 17, 0, 0, 83, 84, 5, 55, 0, 0, 84, 85, 5, 18, 0, 
	0, 85, 86, 5, 9, 0, 0, 86, 88, 5, 19, 0, 0, 87, 89, 5, 9, 0, 0, 88, 87, 
	1, 0, 0, 0, 88, 89, 1, 0, 0, 0, 89, 3, 1, 0, 0, 0, 90, 91, 3, 46, 23, 0, 
	91, 92, 5, 55, 0, 0, 92, 94, 1, 0, 0, 0, 93, 90, 1, 0, 0, 0, 93, 94, 1, 
	0, 0, 0, 94, 95, 1, 0, 0, 0, 95, 96, 5, 16, 0, 0, 96, 97, 5, 9, 0, 0, 97, 
	99, 3, 48, 24, 0, 98, 100, 5, 9, 0, 0, 99, 98, 1, 0, 0, 0, 99, 100, 1, 
	0, 0, 0, 100, 5, 1, 0, 0, 0, 101, 103, 3, 8, 4, 0, 102, 101, 1, 0, 0, 0, 
	103, 106, 1, 0, 0, 0, 104, 102, 1, 0, 0, 0, 104, 105, 1, 0, 0, 0, 105, 
	7, 1, 0, 0, 0, 106, 104, 1, 0, 0, 0, 107, 108, 5, 55, 0, 0, 108, 110, 3, 
	46, 23, 0, 109, 107, 1, 0, 0, 0, 109, 110, 1, 0, 0, 0, 110, 111, 1, 0, 
	0, 0, 111, 114, 5, 55, 0, 0, 112, 113, 5, 20, 0, 0, 113, 115, 5, 9, 0, 
	0, 114, 112, 1, 0, 0, 0, 114, 115, 1, 0, 0, 0, 115, 116, 1, 0, 0, 0, 116, 
	117, 5, 21, 0, 0, 117, 118, 5, 9, 0, 0, 118, 126, 3, 50, 25, 0, 119, 120, 
	5, 55, 0, 0, 120, 122, 5, 23, 0, 0, 121, 123, 3, 10, 5, 0, 122, 121, 1, 
	0, 0, 0, 123, 124, 1, 0, 0, 0, 124, 122, 1, 0, 0, 0, 124, 125, 1, 0, 0, 
	0, 125, 127, 1, 0, 0, 0, 126, 119, 1, 0, 0, 0, 126, 127, 1, 0, 0, 0, 127, 
	9, 1, 0, 0, 0, 128, 129, 5, 55, 0, 0, 129, 131, 3, 46, 23, 0, 130, 128, 
	1, 0, 0, 0, 130, 131, 1, 0, 0, 0, 131, 132, 1, 0, 0, 0, 132, 133, 5, 55, 
	0, 0, 133, 134, 5, 25, 0, 0, 134, 135, 5, 9, 0, 0, 135, 137, 3, 12, 6, 
	0, 136, 138, 5, 9, 0, 0, 137, 136, 1, 0, 0, 0, 137, 138, 1, 0, 0, 0, 138, 
	139, 1, 0, 0, 0, 139, 141, 5, 1, 0, 0, 140, 142, 5, 9, 0, 0, 141, 140, 
	1, 0, 0, 0, 141, 142, 1, 0, 0, 0, 142, 143, 1, 0, 0, 0, 143, 144, 3, 14, 
	7, 0, 144, 11, 1, 0, 0, 0, 145, 146, 3, 50, 25, 0, 146, 13, 1, 0, 0, 0, 
	147, 151, 3, 26, 13, 0, 148, 151, 3, 20, 10, 0, 149, 151, 3, 22, 11, 0, 
	150, 147, 1, 0, 0, 0, 150, 148, 1, 0, 0, 0, 150, 149, 1, 0, 0, 0, 151, 
	153, 1, 0, 0, 0, 152, 154, 3, 18, 9, 0, 153, 152, 1, 0, 0, 0, 153, 154, 
	1, 0, 0, 0, 154, 15, 1, 0, 0, 0, 155, 158, 3, 20, 10, 0, 156, 158, 3, 24, 
	12, 0, 157, 155, 1, 0, 0, 0, 157, 156, 1, 0, 0, 0, 158, 160, 1, 0, 0, 0, 
	159, 161, 3, 18, 9, 0, 160, 159, 1, 0, 0, 0, 160, 161, 1, 0, 0, 0, 161, 
	17, 1, 0, 0, 0, 162, 163, 5, 9, 0, 0, 163, 164, 5, 13, 0, 0, 164, 167, 
	5, 9, 0, 0, 165, 168, 3, 20, 10, 0, 166, 168, 3, 24, 12, 0, 167, 165, 1, 
	0, 0, 0, 167, 166, 1, 0, 0, 0, 168, 170, 1, 0, 0, 0, 169, 162, 1, 0, 0, 
	0, 170, 171, 1, 0, 0, 0, 171, 169, 1, 0, 0, 0, 171, 172, 1, 0, 0, 0, 172, 
	192, 1, 0, 0, 0, 173, 174, 5, 9, 0, 0, 174, 175, 5, 12, 0, 0, 175, 178, 
	5, 9, 0, 0, 176, 179, 3, 20, 10, 0, 177, 179, 3, 24, 12, 0, 178, 176, 1, 
	0, 0, 0, 178, 177, 1, 0, 0, 0, 179, 181, 1, 0, 0, 0, 180, 173, 1, 0, 0, 
	0, 181, 182, 1, 0, 0, 0, 182, 180, 1, 0, 0, 0, 182, 183, 1, 0, 0, 0, 183, 
	192, 1, 0, 0, 0, 184, 185, 5, 9, 0, 0, 185, 186, 5, 14, 0, 0, 186, 189, 
	5, 9, 0, 0, 187, 190, 3, 20, 10, 0, 188, 190, 3, 24, 12, 0, 189, 187, 1, 
	0, 0, 0, 189, 188, 1, 0, 0, 0, 190, 192, 1, 0, 0, 0, 191, 169, 1, 0, 0, 
	0, 191, 180, 1, 0, 0, 0, 191, 184, 1, 0, 0, 0, 192, 19, 1, 0, 0, 0, 193, 
	194, 3, 28, 14, 0, 194, 21, 1, 0, 0, 0, 195, 199, 5, 7, 0, 0, 196, 198, 
	5, 9, 0, 0, 197, 196, 1, 0, 0, 0, 198, 201, 1, 0, 0, 0, 199, 197, 1, 0, 
	0, 0, 199, 200, 1, 0, 0, 0, 200, 204, 1, 0, 0, 0, 201, 199, 1, 0, 0, 0, 
	202, 205, 3, 14, 7, 0, 203, 205, 3, 24, 12, 0, 204, 202, 1, 0, 0, 0, 204, 
	203, 1, 0, 0, 0, 205, 209, 1, 0, 0, 0, 206, 208, 5, 9, 0, 0, 207, 206, 
	1, 0, 0, 0, 208, 211, 1, 0, 0, 0, 209, 207, 1, 0, 0, 0, 209, 210, 1, 0, 
	0, 0, 210, 212, 1, 0, 0, 0, 211, 209, 1, 0, 0, 0, 212, 213, 5, 8, 0, 0, 
	213, 23, 1, 0, 0, 0, 214, 218, 5, 7, 0, 0, 215, 217, 5, 9, 0, 0, 216, 215, 
	1, 0, 0, 0, 217, 220, 1, 0, 0, 0, 218, 216, 1, 0, 0, 0, 218, 219, 1, 0, 
	0, 0, 219, 223, 1, 0, 0, 0, 220, 218, 1, 0, 0, 0, 221, 224, 3, 16, 8, 0, 
	222, 224, 3, 24, 12, 0, 223, 221, 1, 0, 0, 0, 223, 222, 1, 0, 0, 0, 224, 
	228, 1, 0, 0, 0, 225, 227, 5, 9, 0, 0, 226, 225, 1, 0, 0, 0, 227, 230, 
	1, 0, 0, 0, 228, 226, 1, 0, 0, 0, 228, 229, 1, 0, 0, 0, 229, 231, 1, 0, 
	0, 0, 230, 228, 1, 0, 0, 0, 231, 232, 5, 8, 0, 0, 232, 25, 1, 0, 0, 0, 
	233, 235, 5, 5, 0, 0, 234, 236, 5, 9, 0, 0, 235, 234, 1, 0, 0, 0, 235, 
	236, 1, 0, 0, 0, 236, 237, 1, 0, 0, 0, 237, 239, 3, 30, 15, 0, 238, 240, 
	5, 9, 0, 0, 239, 238, 1, 0, 0, 0, 239, 240, 1, 0, 0, 0, 240, 251, 1, 0, 
	0, 0, 241, 243, 5, 2, 0, 0, 242, 244, 5, 9, 0, 0, 243, 242, 1, 0, 0, 0, 
	243, 244, 1, 0, 0, 0, 244, 245, 1, 0, 0, 0, 245, 247, 3, 30, 15, 0, 246, 
	248, 5, 9, 0, 0, 247, 246, 1, 0, 0, 0, 247, 248, 1, 0, 0, 0, 248, 250, 
	1, 0, 0, 0, 249, 241, 1, 0, 0, 0, 250, 253, 1, 0, 0, 0, 251, 249, 1, 0, 
	0, 0, 251, 252, 1, 0, 0, 0, 252, 254, 1, 0, 0, 0, 253, 251, 1, 0, 0, 0, 
	254, 255, 5, 34, 0, 0, 255, 27, 1, 0, 0, 0, 256, 261, 3, 50, 25, 0, 257, 
	258, 5, 9, 0, 0, 258, 259, 5, 15, 0, 0, 259, 260, 5, 9, 0, 0, 260, 262, 
	3, 50, 25, 0, 261, 257, 1, 0, 0, 0, 261, 262, 1, 0, 0, 0, 262, 29, 1, 0, 
	0, 0, 263, 265, 5, 55, 0, 0, 264, 263, 1, 0, 0, 0, 264, 265, 1, 0, 0, 0, 
	265, 273, 1, 0, 0, 0, 266, 274, 3, 32, 16, 0, 267, 268, 3, 32, 16, 0, 268, 
	269, 5, 9, 0, 0, 269, 270, 5, 26, 0, 0, 270, 271, 5, 9, 0, 0, 271, 272, 
	3, 38, 19, 0, 272, 274, 1, 0, 0, 0, 273, 266, 1, 0, 0, 0, 273, 267, 1, 
	0, 0, 0, 274, 276, 1, 0, 0, 0, 275, 277, 5, 55, 0, 0, 276, 275, 1, 0, 0, 
	0, 276, 277, 1, 0, 0, 0, 277, 31, 1, 0, 0, 0, 278, 283, 3, 50, 25, 0, 279, 
	280, 5, 1, 0, 0, 280, 284, 5, 42, 0, 0, 281, 282, 5, 11, 0, 0, 282, 284, 
	3, 50, 25, 0, 283, 279, 1, 0, 0, 0, 283, 281, 1, 0, 0, 0, 283, 284, 1, 
	0, 0, 0, 284, 33, 1, 0, 0, 0, 285, 287, 3, 36, 18, 0, 286, 285, 1, 0, 0, 
	0, 287, 290, 1, 0, 0, 0, 288, 286, 1, 0, 0, 0, 288, 289, 1, 0, 0, 0, 289, 
	35, 1, 0, 0, 0, 290, 288, 1, 0, 0, 0, 291, 292, 5, 55, 0, 0, 292, 294, 
	3, 46, 23, 0, 293, 291, 1, 0, 0, 0, 293, 294, 1, 0, 0, 0, 294, 295, 1, 
	0, 0, 0, 295, 296, 5, 55, 0, 0, 296, 297, 5, 22, 0, 0, 297, 298, 5, 9, 
	0, 0, 298, 300, 3, 38, 19, 0, 299, 301, 5, 9, 0, 0, 300, 299, 1, 0, 0, 
	0, 300, 301, 1, 0, 0, 0, 301, 302, 1, 0, 0, 0, 302, 304, 5, 7, 0, 0, 303, 
	305, 5, 9, 0, 0, 304, 303, 1, 0, 0, 0, 304, 305, 1, 0, 0, 0, 305, 306, 
	1, 0, 0, 0, 306, 308, 3, 40, 20, 0, 307, 309, 5, 9, 0, 0, 308, 307, 1, 
	0, 0, 0, 308, 309, 1, 0, 0, 0, 309, 320, 1, 0, 0, 0, 310, 312, 5, 2, 0, 
	0, 311, 313, 5, 9, 0, 0, 312, 311, 1, 0, 0, 0, 312, 313, 1, 0, 0, 0, 313, 
	314, 1, 0, 0, 0, 314, 316, 3, 40, 20, 0, 315, 317, 5, 9, 0, 0, 316, 315, 
	1, 0, 0, 0, 316, 317, 1, 0, 0, 0, 317, 319, 1, 0, 0, 0, 318, 310, 1, 0, 
	0, 0, 319, 322, 1, 0, 0, 0, 320, 318, 1, 0, 0, 0, 320, 321, 1, 0, 0, 0, 
	321, 324, 1, 0, 0, 0, 322, 320, 1, 0, 0, 0, 323, 325, 5, 55, 0, 0, 324, 
	323, 1, 0, 0, 0, 324, 325, 1, 0, 0, 0, 325, 326, 1, 0, 0, 0, 326, 328, 
	5, 8, 0, 0, 327, 329, 5, 9, 0, 0, 328, 327, 1, 0, 0, 0, 328, 329, 1, 0, 
	0, 0, 329, 330, 1, 0, 0, 0, 330, 332, 5, 35, 0, 0, 331, 333, 5, 55, 0, 
	0, 332, 331, 1, 0, 0, 0, 332, 333, 1, 0, 0, 0, 333, 335, 1, 0, 0, 0, 334, 
	336, 5, 9, 0, 0, 335, 334, 1, 0, 0, 0, 335, 336, 1, 0, 0, 0, 336, 337, 
	1, 0, 0, 0, 337, 339, 3, 52, 26, 0, 338, 340, 5, 55, 0, 0, 339, 338, 1, 
	0, 0, 0, 339, 340, 1, 0, 0, 0, 340, 341, 1, 0, 0, 0, 341, 342, 5, 36, 0, 
	0, 342, 37, 1, 0, 0, 0, 343, 344, 5, 10, 0, 0, 344, 39, 1, 0, 0, 0, 345, 
	347, 5, 55, 0, 0, 346, 345, 1, 0, 0, 0, 346, 347, 1, 0, 0, 0, 347, 348, 
	1, 0, 0, 0, 348, 350, 3, 42, 21, 0, 349, 351, 5, 9, 0, 0, 350, 349, 1, 
	0, 0, 0, 350, 351, 1, 0, 0, 0, 351, 352, 1, 0, 0, 0, 352, 354, 5, 1, 0, 
	0, 353, 355, 5, 9, 0, 0, 354, 353, 1, 0, 0, 0, 354, 355, 1, 0, 0, 0, 355, 
	356, 1, 0, 0, 0, 356, 357, 3, 44, 22, 0, 357, 41, 1, 0, 0, 0, 358, 359, 
	5, 10, 0, 0, 359, 43, 1, 0, 0, 0, 360, 366, 5, 57, 0, 0, 361, 362, 5, 56, 
	0, 0, 362, 363, 5, 3, 0, 0, 363, 364, 5, 57, 0, 0, 364, 366, 5, 4, 0, 0, 
	365, 360, 1, 0, 0, 0, 365, 361, 1, 0, 0, 0, 366, 45, 1, 0, 0, 0, 367, 371, 
	5, 11, 0, 0, 368, 370, 8, 0, 0, 0, 369, 368, 1, 0, 0, 0, 370, 373, 1, 0, 
	0, 0, 371, 369, 1, 0, 0, 0, 371, 372, 1, 0, 0, 0, 372, 376, 1, 0, 0, 0, 
	373, 371, 1, 0, 0, 0, 374, 375, 5, 55, 0, 0, 375, 377, 3, 46, 23, 0, 376, 
	374, 1, 0, 0, 0, 376, 377, 1, 0, 0, 0, 377, 47, 1, 0, 0, 0, 378, 379, 7, 
	1, 0, 0, 379, 49, 1, 0, 0, 0, 380, 383, 3, 48, 24, 0, 381, 383, 5, 54, 
	0, 0, 382, 380, 1, 0, 0, 0, 382, 381, 1, 0, 0, 0, 383, 51, 1, 0, 0, 0, 
	384, 387, 7, 2, 0, 0, 385, 387, 8, 3, 0, 0, 386, 384, 1, 0, 0, 0, 386, 
	385, 1, 0, 0, 0, 387, 390, 1, 0, 0, 0, 388, 386, 1, 0, 0, 0, 388, 389, 
	1, 0, 0, 0, 389, 53, 1, 0, 0, 0, 390, 388, 1, 0, 0, 0, 66, 55, 58, 62, 
	65, 69, 73, 80, 88, 93, 99, 104, 109, 114, 124, 126, 130, 137, 141, 150, 
	153, 157, 160, 167, 171, 178, 182, 189, 191, 199, 204, 209, 218, 223, 228, 
	235, 239, 243, 247, 251, 261, 264, 273, 276, 283, 288, 293, 300, 304, 308, 
	312, 316, 320, 324, 328, 332, 335, 339, 346, 350, 354, 365, 371, 376, 382, 
	386, 388,
}
  deserializer := antlr.NewATNDeserializer(nil)
  staticData.atn = deserializer.Deserialize(staticData.serializedATN)
  atn := staticData.atn
  staticData.decisionToDFA = make([]*antlr.DFA, len(atn.DecisionToState))
  decisionToDFA := staticData.decisionToDFA
  for index, state := range atn.DecisionToState {
    decisionToDFA[index] = antlr.NewDFA(state, index)
  }
}

// OpenFGAParserInit initializes any static state used to implement OpenFGAParser. By default the
// static state used to implement the parser is lazily initialized during the first call to
// NewOpenFGAParser(). You can call this function if you wish to initialize the static state ahead
// of time.
func OpenFGAParserInit() {
  staticData := &OpenFGAParserParserStaticData
  staticData.once.Do(openfgaparserParserInit)
}

// NewOpenFGAParser produces a new parser instance for the optional input antlr.TokenStream.
func NewOpenFGAParser(input antlr.TokenStream) *OpenFGAParser {
	OpenFGAParserInit()
	this := new(OpenFGAParser)
	this.BaseParser = antlr.NewBaseParser(input)
  staticData := &OpenFGAParserParserStaticData
	this.Interpreter = antlr.NewParserATNSimulator(this, staticData.atn, staticData.decisionToDFA, staticData.PredictionContextCache)
	this.RuleNames = staticData.RuleNames
	this.LiteralNames = staticData.LiteralNames
	this.SymbolicNames = staticData.SymbolicNames
	this.GrammarFileName = "OpenFGAParser.g4"

	return this
}


// OpenFGAParser tokens.
const (
	OpenFGAParserEOF = antlr.TokenEOF
	OpenFGAParserCOLON = 1
	OpenFGAParserCOMMA = 2
	OpenFGAParserLESS = 3
	OpenFGAParserGREATER = 4
	OpenFGAParserLBRACKET = 5
	OpenFGAParserRBRACKET = 6
	OpenFGAParserLPAREN = 7
	OpenFGAParserRPAREN = 8
	OpenFGAParserWHITESPACE = 9
	OpenFGAParserIDENTIFIER = 10
	OpenFGAParserHASH = 11
	OpenFGAParserAND = 12
	OpenFGAParserOR = 13
	OpenFGAParserBUT_NOT = 14
	OpenFGAParserFROM = 15
	OpenFGAParserMODULE = 16
	OpenFGAParserMODEL = 17
	OpenFGAParserSCHEMA = 18
	OpenFGAParserSCHEMA_VERSION = 19
	OpenFGAParserEXTEND = 20
	OpenFGAParserTYPE = 21
	OpenFGAParserCONDITION = 22
	OpenFGAParserRELATIONS = 23
	OpenFGAParserRELATION = 24
	OpenFGAParserDEFINE = 25
	OpenFGAParserKEYWORD_WITH = 26
	OpenFGAParserEQUALS = 27
	OpenFGAParserNOT_EQUALS = 28
	OpenFGAParserIN = 29
	OpenFGAParserLESS_EQUALS = 30
	OpenFGAParserGREATER_EQUALS = 31
	OpenFGAParserLOGICAL_AND = 32
	OpenFGAParserLOGICAL_OR = 33
	OpenFGAParserRPRACKET = 34
	OpenFGAParserLBRACE = 35
	OpenFGAParserRBRACE = 36
	OpenFGAParserDOT = 37
	OpenFGAParserMINUS = 38
	OpenFGAParserEXCLAM = 39
	OpenFGAParserQUESTIONMARK = 40
	OpenFGAParserPLUS = 41
	OpenFGAParserSTAR = 42
	OpenFGAParserSLASH = 43
	OpenFGAParserPERCENT = 44
	OpenFGAParserCEL_TRUE = 45
	OpenFGAParserCEL_FALSE = 46
	OpenFGAParserNUL = 47
	OpenFGAParserCEL_COMMENT = 48
	OpenFGAParserNUM_FLOAT = 49
	OpenFGAParserNUM_INT = 50
	OpenFGAParserNUM_UINT = 51
	OpenFGAParserSTRING = 52
	OpenFGAParserBYTES = 53
	OpenFGAParserEXTENDED_IDENTIFIER = 54
	OpenFGAParserNEWLINE = 55
	OpenFGAParserCONDITION_PARAM_CONTAINER = 56
	OpenFGAParserCONDITION_PARAM_TYPE = 57
)

// OpenFGAParser rules.
const (
	OpenFGAParserRULE_main = 0
	OpenFGAParserRULE_modelHeader = 1
	OpenFGAParserRULE_moduleHeader = 2
	OpenFGAParserRULE_typeDefs = 3
	OpenFGAParserRULE_typeDef = 4
	OpenFGAParserRULE_relationDeclaration = 5
	OpenFGAParserRULE_relationName = 6
	OpenFGAParserRULE_relationDef = 7
	OpenFGAParserRULE_relationDefNoDirect = 8
	OpenFGAParserRULE_relationDefPartials = 9
	OpenFGAParserRULE_relationDefGrouping = 10
	OpenFGAParserRULE_relationRecurse = 11
	OpenFGAParserRULE_relationRecurseNoDirect = 12
	OpenFGAParserRULE_relationDefDirectAssignment = 13
	OpenFGAParserRULE_relationDefRewrite = 14
	OpenFGAParserRULE_relationDefTypeRestriction = 15
	OpenFGAParserRULE_relationDefTypeRestrictionBase = 16
	OpenFGAParserRULE_conditions = 17
	OpenFGAParserRULE_condition = 18
	OpenFGAParserRULE_conditionName = 19
	OpenFGAParserRULE_conditionParameter = 20
	OpenFGAParserRULE_parameterName = 21
	OpenFGAParserRULE_parameterType = 22
	OpenFGAParserRULE_multiLineComment = 23
	OpenFGAParserRULE_identifier = 24
	OpenFGAParserRULE_extended_identifier = 25
	OpenFGAParserRULE_conditionExpression = 26
)

// IMainContext is an interface to support dynamic dispatch.
type IMainContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	TypeDefs() ITypeDefsContext
	Conditions() IConditionsContext
	EOF() antlr.TerminalNode
	ModelHeader() IModelHeaderContext
	ModuleHeader() IModuleHeaderContext
	WHITESPACE() antlr.TerminalNode
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode

	// IsMainContext differentiates from other interfaces.
	IsMainContext()
}

type MainContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyMainContext() *MainContext {
	var p = new(MainContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_main
	return p
}

func InitEmptyMainContext(p *MainContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_main
}

func (*MainContext) IsMainContext() {}

func NewMainContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *MainContext {
	var p = new(MainContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_main

	return p
}

func (s *MainContext) GetParser() antlr.Parser { return s.parser }

func (s *MainContext) TypeDefs() ITypeDefsContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(ITypeDefsContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(ITypeDefsContext)
}

func (s *MainContext) Conditions() IConditionsContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IConditionsContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IConditionsContext)
}

func (s *MainContext) EOF() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserEOF, 0)
}

func (s *MainContext) ModelHeader() IModelHeaderContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IModelHeaderContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IModelHeaderContext)
}

func (s *MainContext) ModuleHeader() IModuleHeaderContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IModuleHeaderContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IModuleHeaderContext)
}

func (s *MainContext) WHITESPACE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, 0)
}

func (s *MainContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *MainContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *MainContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *MainContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *MainContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterMain(s)
	}
}

func (s *MainContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitMain(s)
	}
}




func (p *OpenFGAParser) Main() (localctx IMainContext) {
	localctx = NewMainContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 0, OpenFGAParserRULE_main)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(55)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(54)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	p.SetState(58)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(57)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	p.SetState(62)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 2, p.GetParserRuleContext()) {
	case 1:
		{
			p.SetState(60)
			p.ModelHeader()
		}


	case 2:
		{
			p.SetState(61)
			p.ModuleHeader()
		}

	case antlr.ATNInvalidAltNumber:
		goto errorExit
	}
	p.SetState(65)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 3, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(64)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	{
		p.SetState(67)
		p.TypeDefs()
	}
	p.SetState(69)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 4, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(68)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	{
		p.SetState(71)
		p.Conditions()
	}
	p.SetState(73)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(72)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(75)
		p.Match(OpenFGAParserEOF)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IModelHeaderContext is an interface to support dynamic dispatch.
type IModelHeaderContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// GetSchemaVersion returns the schemaVersion token.
	GetSchemaVersion() antlr.Token 


	// SetSchemaVersion sets the schemaVersion token.
	SetSchemaVersion(antlr.Token) 


	// Getter signatures
	MODEL() antlr.TerminalNode
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	SCHEMA() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	SCHEMA_VERSION() antlr.TerminalNode
	MultiLineComment() IMultiLineCommentContext

	// IsModelHeaderContext differentiates from other interfaces.
	IsModelHeaderContext()
}

type ModelHeaderContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
	schemaVersion antlr.Token
}

func NewEmptyModelHeaderContext() *ModelHeaderContext {
	var p = new(ModelHeaderContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_modelHeader
	return p
}

func InitEmptyModelHeaderContext(p *ModelHeaderContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_modelHeader
}

func (*ModelHeaderContext) IsModelHeaderContext() {}

func NewModelHeaderContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ModelHeaderContext {
	var p = new(ModelHeaderContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_modelHeader

	return p
}

func (s *ModelHeaderContext) GetParser() antlr.Parser { return s.parser }

func (s *ModelHeaderContext) GetSchemaVersion() antlr.Token { return s.schemaVersion }


func (s *ModelHeaderContext) SetSchemaVersion(v antlr.Token) { s.schemaVersion = v }


func (s *ModelHeaderContext) MODEL() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserMODEL, 0)
}

func (s *ModelHeaderContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *ModelHeaderContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *ModelHeaderContext) SCHEMA() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSCHEMA, 0)
}

func (s *ModelHeaderContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *ModelHeaderContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *ModelHeaderContext) SCHEMA_VERSION() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSCHEMA_VERSION, 0)
}

func (s *ModelHeaderContext) MultiLineComment() IMultiLineCommentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IMultiLineCommentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IMultiLineCommentContext)
}

func (s *ModelHeaderContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ModelHeaderContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ModelHeaderContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterModelHeader(s)
	}
}

func (s *ModelHeaderContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitModelHeader(s)
	}
}




func (p *OpenFGAParser) ModelHeader() (localctx IModelHeaderContext) {
	localctx = NewModelHeaderContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 2, OpenFGAParserRULE_modelHeader)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(80)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserHASH {
		{
			p.SetState(77)
			p.MultiLineComment()
		}
		{
			p.SetState(78)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(82)
		p.Match(OpenFGAParserMODEL)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(83)
		p.Match(OpenFGAParserNEWLINE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(84)
		p.Match(OpenFGAParserSCHEMA)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(85)
		p.Match(OpenFGAParserWHITESPACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(86)

		var _m = p.Match(OpenFGAParserSCHEMA_VERSION)

		localctx.(*ModelHeaderContext).schemaVersion = _m
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(88)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(87)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IModuleHeaderContext is an interface to support dynamic dispatch.
type IModuleHeaderContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// GetModuleName returns the moduleName rule contexts.
	GetModuleName() IIdentifierContext


	// SetModuleName sets the moduleName rule contexts.
	SetModuleName(IIdentifierContext)


	// Getter signatures
	MODULE() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	Identifier() IIdentifierContext
	MultiLineComment() IMultiLineCommentContext
	NEWLINE() antlr.TerminalNode

	// IsModuleHeaderContext differentiates from other interfaces.
	IsModuleHeaderContext()
}

type ModuleHeaderContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
	moduleName IIdentifierContext 
}

func NewEmptyModuleHeaderContext() *ModuleHeaderContext {
	var p = new(ModuleHeaderContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_moduleHeader
	return p
}

func InitEmptyModuleHeaderContext(p *ModuleHeaderContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_moduleHeader
}

func (*ModuleHeaderContext) IsModuleHeaderContext() {}

func NewModuleHeaderContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ModuleHeaderContext {
	var p = new(ModuleHeaderContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_moduleHeader

	return p
}

func (s *ModuleHeaderContext) GetParser() antlr.Parser { return s.parser }

func (s *ModuleHeaderContext) GetModuleName() IIdentifierContext { return s.moduleName }


func (s *ModuleHeaderContext) SetModuleName(v IIdentifierContext) { s.moduleName = v }


func (s *ModuleHeaderContext) MODULE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserMODULE, 0)
}

func (s *ModuleHeaderContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *ModuleHeaderContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *ModuleHeaderContext) Identifier() IIdentifierContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IIdentifierContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IIdentifierContext)
}

func (s *ModuleHeaderContext) MultiLineComment() IMultiLineCommentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IMultiLineCommentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IMultiLineCommentContext)
}

func (s *ModuleHeaderContext) NEWLINE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, 0)
}

func (s *ModuleHeaderContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ModuleHeaderContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ModuleHeaderContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterModuleHeader(s)
	}
}

func (s *ModuleHeaderContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitModuleHeader(s)
	}
}




func (p *OpenFGAParser) ModuleHeader() (localctx IModuleHeaderContext) {
	localctx = NewModuleHeaderContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 4, OpenFGAParserRULE_moduleHeader)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(93)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserHASH {
		{
			p.SetState(90)
			p.MultiLineComment()
		}
		{
			p.SetState(91)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(95)
		p.Match(OpenFGAParserMODULE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(96)
		p.Match(OpenFGAParserWHITESPACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(97)

		var _x = p.Identifier()


		localctx.(*ModuleHeaderContext).moduleName = _x
	}
	p.SetState(99)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(98)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// ITypeDefsContext is an interface to support dynamic dispatch.
type ITypeDefsContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	AllTypeDef() []ITypeDefContext
	TypeDef(i int) ITypeDefContext

	// IsTypeDefsContext differentiates from other interfaces.
	IsTypeDefsContext()
}

type TypeDefsContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyTypeDefsContext() *TypeDefsContext {
	var p = new(TypeDefsContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_typeDefs
	return p
}

func InitEmptyTypeDefsContext(p *TypeDefsContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_typeDefs
}

func (*TypeDefsContext) IsTypeDefsContext() {}

func NewTypeDefsContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *TypeDefsContext {
	var p = new(TypeDefsContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_typeDefs

	return p
}

func (s *TypeDefsContext) GetParser() antlr.Parser { return s.parser }

func (s *TypeDefsContext) AllTypeDef() []ITypeDefContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(ITypeDefContext); ok {
			len++
		}
	}

	tst := make([]ITypeDefContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(ITypeDefContext); ok {
			tst[i] = t.(ITypeDefContext)
			i++
		}
	}

	return tst
}

func (s *TypeDefsContext) TypeDef(i int) ITypeDefContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(ITypeDefContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(ITypeDefContext)
}

func (s *TypeDefsContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *TypeDefsContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *TypeDefsContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterTypeDefs(s)
	}
}

func (s *TypeDefsContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitTypeDefs(s)
	}
}




func (p *OpenFGAParser) TypeDefs() (localctx ITypeDefsContext) {
	localctx = NewTypeDefsContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 6, OpenFGAParserRULE_typeDefs)
	var _alt int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(104)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 10, p.GetParserRuleContext())
	if p.HasError() {
		goto errorExit
	}
	for _alt != 2 && _alt != antlr.ATNInvalidAltNumber {
		if _alt == 1 {
			{
				p.SetState(101)
				p.TypeDef()
			}


		}
		p.SetState(106)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 10, p.GetParserRuleContext())
		if p.HasError() {
			goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// ITypeDefContext is an interface to support dynamic dispatch.
type ITypeDefContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// GetTypeName returns the typeName rule contexts.
	GetTypeName() IExtended_identifierContext


	// SetTypeName sets the typeName rule contexts.
	SetTypeName(IExtended_identifierContext)


	// Getter signatures
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	TYPE() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	Extended_identifier() IExtended_identifierContext
	MultiLineComment() IMultiLineCommentContext
	EXTEND() antlr.TerminalNode
	RELATIONS() antlr.TerminalNode
	AllRelationDeclaration() []IRelationDeclarationContext
	RelationDeclaration(i int) IRelationDeclarationContext

	// IsTypeDefContext differentiates from other interfaces.
	IsTypeDefContext()
}

type TypeDefContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
	typeName IExtended_identifierContext 
}

func NewEmptyTypeDefContext() *TypeDefContext {
	var p = new(TypeDefContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_typeDef
	return p
}

func InitEmptyTypeDefContext(p *TypeDefContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_typeDef
}

func (*TypeDefContext) IsTypeDefContext() {}

func NewTypeDefContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *TypeDefContext {
	var p = new(TypeDefContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_typeDef

	return p
}

func (s *TypeDefContext) GetParser() antlr.Parser { return s.parser }

func (s *TypeDefContext) GetTypeName() IExtended_identifierContext { return s.typeName }


func (s *TypeDefContext) SetTypeName(v IExtended_identifierContext) { s.typeName = v }


func (s *TypeDefContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *TypeDefContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *TypeDefContext) TYPE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserTYPE, 0)
}

func (s *TypeDefContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *TypeDefContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *TypeDefContext) Extended_identifier() IExtended_identifierContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IExtended_identifierContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IExtended_identifierContext)
}

func (s *TypeDefContext) MultiLineComment() IMultiLineCommentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IMultiLineCommentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IMultiLineCommentContext)
}

func (s *TypeDefContext) EXTEND() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserEXTEND, 0)
}

func (s *TypeDefContext) RELATIONS() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRELATIONS, 0)
}

func (s *TypeDefContext) AllRelationDeclaration() []IRelationDeclarationContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IRelationDeclarationContext); ok {
			len++
		}
	}

	tst := make([]IRelationDeclarationContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IRelationDeclarationContext); ok {
			tst[i] = t.(IRelationDeclarationContext)
			i++
		}
	}

	return tst
}

func (s *TypeDefContext) RelationDeclaration(i int) IRelationDeclarationContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDeclarationContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDeclarationContext)
}

func (s *TypeDefContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *TypeDefContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *TypeDefContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterTypeDef(s)
	}
}

func (s *TypeDefContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitTypeDef(s)
	}
}




func (p *OpenFGAParser) TypeDef() (localctx ITypeDefContext) {
	localctx = NewTypeDefContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 8, OpenFGAParserRULE_typeDef)
	var _la int

	var _alt int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(109)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 11, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(107)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(108)
			p.MultiLineComment()
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	{
		p.SetState(111)
		p.Match(OpenFGAParserNEWLINE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(114)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserEXTEND {
		{
			p.SetState(112)
			p.Match(OpenFGAParserEXTEND)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(113)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(116)
		p.Match(OpenFGAParserTYPE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(117)
		p.Match(OpenFGAParserWHITESPACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(118)

		var _x = p.Extended_identifier()


		localctx.(*TypeDefContext).typeName = _x
	}
	p.SetState(126)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 14, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(119)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(120)
			p.Match(OpenFGAParserRELATIONS)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		p.SetState(122)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_alt = 1
		for ok := true; ok; ok = _alt != 2 && _alt != antlr.ATNInvalidAltNumber {
			switch _alt {
			case 1:
					{
						p.SetState(121)
						p.RelationDeclaration()
					}




			default:
				p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
				goto errorExit
			}

			p.SetState(124)
			p.GetErrorHandler().Sync(p)
			_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 13, p.GetParserRuleContext())
			if p.HasError() {
				goto errorExit
			}
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDeclarationContext is an interface to support dynamic dispatch.
type IRelationDeclarationContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	DEFINE() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	RelationName() IRelationNameContext
	COLON() antlr.TerminalNode
	RelationDef() IRelationDefContext
	MultiLineComment() IMultiLineCommentContext

	// IsRelationDeclarationContext differentiates from other interfaces.
	IsRelationDeclarationContext()
}

type RelationDeclarationContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDeclarationContext() *RelationDeclarationContext {
	var p = new(RelationDeclarationContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDeclaration
	return p
}

func InitEmptyRelationDeclarationContext(p *RelationDeclarationContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDeclaration
}

func (*RelationDeclarationContext) IsRelationDeclarationContext() {}

func NewRelationDeclarationContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDeclarationContext {
	var p = new(RelationDeclarationContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDeclaration

	return p
}

func (s *RelationDeclarationContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDeclarationContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *RelationDeclarationContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *RelationDeclarationContext) DEFINE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserDEFINE, 0)
}

func (s *RelationDeclarationContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationDeclarationContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationDeclarationContext) RelationName() IRelationNameContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationNameContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationNameContext)
}

func (s *RelationDeclarationContext) COLON() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCOLON, 0)
}

func (s *RelationDeclarationContext) RelationDef() IRelationDefContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefContext)
}

func (s *RelationDeclarationContext) MultiLineComment() IMultiLineCommentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IMultiLineCommentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IMultiLineCommentContext)
}

func (s *RelationDeclarationContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDeclarationContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDeclarationContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDeclaration(s)
	}
}

func (s *RelationDeclarationContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDeclaration(s)
	}
}




func (p *OpenFGAParser) RelationDeclaration() (localctx IRelationDeclarationContext) {
	localctx = NewRelationDeclarationContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 10, OpenFGAParserRULE_relationDeclaration)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(130)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 15, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(128)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(129)
			p.MultiLineComment()
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	{
		p.SetState(132)
		p.Match(OpenFGAParserNEWLINE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(133)
		p.Match(OpenFGAParserDEFINE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(134)
		p.Match(OpenFGAParserWHITESPACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(135)
		p.RelationName()
	}
	p.SetState(137)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(136)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(139)
		p.Match(OpenFGAParserCOLON)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(141)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(140)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}

	{
		p.SetState(143)
		p.RelationDef()
	}




errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationNameContext is an interface to support dynamic dispatch.
type IRelationNameContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	Extended_identifier() IExtended_identifierContext

	// IsRelationNameContext differentiates from other interfaces.
	IsRelationNameContext()
}

type RelationNameContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationNameContext() *RelationNameContext {
	var p = new(RelationNameContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationName
	return p
}

func InitEmptyRelationNameContext(p *RelationNameContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationName
}

func (*RelationNameContext) IsRelationNameContext() {}

func NewRelationNameContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationNameContext {
	var p = new(RelationNameContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationName

	return p
}

func (s *RelationNameContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationNameContext) Extended_identifier() IExtended_identifierContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IExtended_identifierContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IExtended_identifierContext)
}

func (s *RelationNameContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationNameContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationNameContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationName(s)
	}
}

func (s *RelationNameContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationName(s)
	}
}




func (p *OpenFGAParser) RelationName() (localctx IRelationNameContext) {
	localctx = NewRelationNameContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 12, OpenFGAParserRULE_relationName)
	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(145)
		p.Extended_identifier()
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefContext is an interface to support dynamic dispatch.
type IRelationDefContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	RelationDefDirectAssignment() IRelationDefDirectAssignmentContext
	RelationDefGrouping() IRelationDefGroupingContext
	RelationRecurse() IRelationRecurseContext
	RelationDefPartials() IRelationDefPartialsContext

	// IsRelationDefContext differentiates from other interfaces.
	IsRelationDefContext()
}

type RelationDefContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDefContext() *RelationDefContext {
	var p = new(RelationDefContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDef
	return p
}

func InitEmptyRelationDefContext(p *RelationDefContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDef
}

func (*RelationDefContext) IsRelationDefContext() {}

func NewRelationDefContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefContext {
	var p = new(RelationDefContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDef

	return p
}

func (s *RelationDefContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefContext) RelationDefDirectAssignment() IRelationDefDirectAssignmentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefDirectAssignmentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefDirectAssignmentContext)
}

func (s *RelationDefContext) RelationDefGrouping() IRelationDefGroupingContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefGroupingContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefGroupingContext)
}

func (s *RelationDefContext) RelationRecurse() IRelationRecurseContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationRecurseContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationRecurseContext)
}

func (s *RelationDefContext) RelationDefPartials() IRelationDefPartialsContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefPartialsContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefPartialsContext)
}

func (s *RelationDefContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDef(s)
	}
}

func (s *RelationDefContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDef(s)
	}
}




func (p *OpenFGAParser) RelationDef() (localctx IRelationDefContext) {
	localctx = NewRelationDefContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 14, OpenFGAParserRULE_relationDef)
	p.EnterOuterAlt(localctx, 1)
	p.SetState(150)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetTokenStream().LA(1) {
	case OpenFGAParserLBRACKET:
		{
			p.SetState(147)
			p.RelationDefDirectAssignment()
		}


	case OpenFGAParserIDENTIFIER, OpenFGAParserMODULE, OpenFGAParserMODEL, OpenFGAParserSCHEMA, OpenFGAParserEXTEND, OpenFGAParserTYPE, OpenFGAParserRELATION, OpenFGAParserEXTENDED_IDENTIFIER:
		{
			p.SetState(148)
			p.RelationDefGrouping()
		}


	case OpenFGAParserLPAREN:
		{
			p.SetState(149)
			p.RelationRecurse()
		}



	default:
		p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
		goto errorExit
	}
	p.SetState(153)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 19, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(152)
			p.RelationDefPartials()
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefNoDirectContext is an interface to support dynamic dispatch.
type IRelationDefNoDirectContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	RelationDefGrouping() IRelationDefGroupingContext
	RelationRecurseNoDirect() IRelationRecurseNoDirectContext
	RelationDefPartials() IRelationDefPartialsContext

	// IsRelationDefNoDirectContext differentiates from other interfaces.
	IsRelationDefNoDirectContext()
}

type RelationDefNoDirectContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDefNoDirectContext() *RelationDefNoDirectContext {
	var p = new(RelationDefNoDirectContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefNoDirect
	return p
}

func InitEmptyRelationDefNoDirectContext(p *RelationDefNoDirectContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefNoDirect
}

func (*RelationDefNoDirectContext) IsRelationDefNoDirectContext() {}

func NewRelationDefNoDirectContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefNoDirectContext {
	var p = new(RelationDefNoDirectContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefNoDirect

	return p
}

func (s *RelationDefNoDirectContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefNoDirectContext) RelationDefGrouping() IRelationDefGroupingContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefGroupingContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefGroupingContext)
}

func (s *RelationDefNoDirectContext) RelationRecurseNoDirect() IRelationRecurseNoDirectContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationRecurseNoDirectContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationRecurseNoDirectContext)
}

func (s *RelationDefNoDirectContext) RelationDefPartials() IRelationDefPartialsContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefPartialsContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefPartialsContext)
}

func (s *RelationDefNoDirectContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefNoDirectContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefNoDirectContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefNoDirect(s)
	}
}

func (s *RelationDefNoDirectContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefNoDirect(s)
	}
}




func (p *OpenFGAParser) RelationDefNoDirect() (localctx IRelationDefNoDirectContext) {
	localctx = NewRelationDefNoDirectContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 16, OpenFGAParserRULE_relationDefNoDirect)
	p.EnterOuterAlt(localctx, 1)
	p.SetState(157)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetTokenStream().LA(1) {
	case OpenFGAParserIDENTIFIER, OpenFGAParserMODULE, OpenFGAParserMODEL, OpenFGAParserSCHEMA, OpenFGAParserEXTEND, OpenFGAParserTYPE, OpenFGAParserRELATION, OpenFGAParserEXTENDED_IDENTIFIER:
		{
			p.SetState(155)
			p.RelationDefGrouping()
		}


	case OpenFGAParserLPAREN:
		{
			p.SetState(156)
			p.RelationRecurseNoDirect()
		}



	default:
		p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
		goto errorExit
	}
	p.SetState(160)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 21, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(159)
			p.RelationDefPartials()
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefPartialsContext is an interface to support dynamic dispatch.
type IRelationDefPartialsContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	AllOR() []antlr.TerminalNode
	OR(i int) antlr.TerminalNode
	AllRelationDefGrouping() []IRelationDefGroupingContext
	RelationDefGrouping(i int) IRelationDefGroupingContext
	AllRelationRecurseNoDirect() []IRelationRecurseNoDirectContext
	RelationRecurseNoDirect(i int) IRelationRecurseNoDirectContext
	AllAND() []antlr.TerminalNode
	AND(i int) antlr.TerminalNode
	BUT_NOT() antlr.TerminalNode

	// IsRelationDefPartialsContext differentiates from other interfaces.
	IsRelationDefPartialsContext()
}

type RelationDefPartialsContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDefPartialsContext() *RelationDefPartialsContext {
	var p = new(RelationDefPartialsContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefPartials
	return p
}

func InitEmptyRelationDefPartialsContext(p *RelationDefPartialsContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefPartials
}

func (*RelationDefPartialsContext) IsRelationDefPartialsContext() {}

func NewRelationDefPartialsContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefPartialsContext {
	var p = new(RelationDefPartialsContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefPartials

	return p
}

func (s *RelationDefPartialsContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefPartialsContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationDefPartialsContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationDefPartialsContext) AllOR() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserOR)
}

func (s *RelationDefPartialsContext) OR(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserOR, i)
}

func (s *RelationDefPartialsContext) AllRelationDefGrouping() []IRelationDefGroupingContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IRelationDefGroupingContext); ok {
			len++
		}
	}

	tst := make([]IRelationDefGroupingContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IRelationDefGroupingContext); ok {
			tst[i] = t.(IRelationDefGroupingContext)
			i++
		}
	}

	return tst
}

func (s *RelationDefPartialsContext) RelationDefGrouping(i int) IRelationDefGroupingContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefGroupingContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefGroupingContext)
}

func (s *RelationDefPartialsContext) AllRelationRecurseNoDirect() []IRelationRecurseNoDirectContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IRelationRecurseNoDirectContext); ok {
			len++
		}
	}

	tst := make([]IRelationRecurseNoDirectContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IRelationRecurseNoDirectContext); ok {
			tst[i] = t.(IRelationRecurseNoDirectContext)
			i++
		}
	}

	return tst
}

func (s *RelationDefPartialsContext) RelationRecurseNoDirect(i int) IRelationRecurseNoDirectContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationRecurseNoDirectContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationRecurseNoDirectContext)
}

func (s *RelationDefPartialsContext) AllAND() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserAND)
}

func (s *RelationDefPartialsContext) AND(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserAND, i)
}

func (s *RelationDefPartialsContext) BUT_NOT() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserBUT_NOT, 0)
}

func (s *RelationDefPartialsContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefPartialsContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefPartialsContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefPartials(s)
	}
}

func (s *RelationDefPartialsContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefPartials(s)
	}
}




func (p *OpenFGAParser) RelationDefPartials() (localctx IRelationDefPartialsContext) {
	localctx = NewRelationDefPartialsContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 18, OpenFGAParserRULE_relationDefPartials)
	var _alt int

	p.SetState(191)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 27, p.GetParserRuleContext()) {
	case 1:
		p.EnterOuterAlt(localctx, 1)
		p.SetState(169)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_alt = 1
		for ok := true; ok; ok = _alt != 2 && _alt != antlr.ATNInvalidAltNumber {
			switch _alt {
			case 1:
					{
						p.SetState(162)
						p.Match(OpenFGAParserWHITESPACE)
						if p.HasError() {
								// Recognition error - abort rule
								goto errorExit
						}
					}
					{
						p.SetState(163)
						p.Match(OpenFGAParserOR)
						if p.HasError() {
								// Recognition error - abort rule
								goto errorExit
						}
					}
					{
						p.SetState(164)
						p.Match(OpenFGAParserWHITESPACE)
						if p.HasError() {
								// Recognition error - abort rule
								goto errorExit
						}
					}
					p.SetState(167)
					p.GetErrorHandler().Sync(p)
					if p.HasError() {
						goto errorExit
					}

					switch p.GetTokenStream().LA(1) {
					case OpenFGAParserIDENTIFIER, OpenFGAParserMODULE, OpenFGAParserMODEL, OpenFGAParserSCHEMA, OpenFGAParserEXTEND, OpenFGAParserTYPE, OpenFGAParserRELATION, OpenFGAParserEXTENDED_IDENTIFIER:
						{
							p.SetState(165)
							p.RelationDefGrouping()
						}


					case OpenFGAParserLPAREN:
						{
							p.SetState(166)
							p.RelationRecurseNoDirect()
						}



					default:
						p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
						goto errorExit
					}




			default:
				p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
				goto errorExit
			}

			p.SetState(171)
			p.GetErrorHandler().Sync(p)
			_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 23, p.GetParserRuleContext())
			if p.HasError() {
				goto errorExit
			}
		}


	case 2:
		p.EnterOuterAlt(localctx, 2)
		p.SetState(180)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_alt = 1
		for ok := true; ok; ok = _alt != 2 && _alt != antlr.ATNInvalidAltNumber {
			switch _alt {
			case 1:
					{
						p.SetState(173)
						p.Match(OpenFGAParserWHITESPACE)
						if p.HasError() {
								// Recognition error - abort rule
								goto errorExit
						}
					}
					{
						p.SetState(174)
						p.Match(OpenFGAParserAND)
						if p.HasError() {
								// Recognition error - abort rule
								goto errorExit
						}
					}
					{
						p.SetState(175)
						p.Match(OpenFGAParserWHITESPACE)
						if p.HasError() {
								// Recognition error - abort rule
								goto errorExit
						}
					}
					p.SetState(178)
					p.GetErrorHandler().Sync(p)
					if p.HasError() {
						goto errorExit
					}

					switch p.GetTokenStream().LA(1) {
					case OpenFGAParserIDENTIFIER, OpenFGAParserMODULE, OpenFGAParserMODEL, OpenFGAParserSCHEMA, OpenFGAParserEXTEND, OpenFGAParserTYPE, OpenFGAParserRELATION, OpenFGAParserEXTENDED_IDENTIFIER:
						{
							p.SetState(176)
							p.RelationDefGrouping()
						}


					case OpenFGAParserLPAREN:
						{
							p.SetState(177)
							p.RelationRecurseNoDirect()
						}



					default:
						p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
						goto errorExit
					}




			default:
				p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
				goto errorExit
			}

			p.SetState(182)
			p.GetErrorHandler().Sync(p)
			_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 25, p.GetParserRuleContext())
			if p.HasError() {
				goto errorExit
			}
		}


	case 3:
		p.EnterOuterAlt(localctx, 3)
		{
			p.SetState(184)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(185)
			p.Match(OpenFGAParserBUT_NOT)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(186)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		p.SetState(189)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}

		switch p.GetTokenStream().LA(1) {
		case OpenFGAParserIDENTIFIER, OpenFGAParserMODULE, OpenFGAParserMODEL, OpenFGAParserSCHEMA, OpenFGAParserEXTEND, OpenFGAParserTYPE, OpenFGAParserRELATION, OpenFGAParserEXTENDED_IDENTIFIER:
			{
				p.SetState(187)
				p.RelationDefGrouping()
			}


		case OpenFGAParserLPAREN:
			{
				p.SetState(188)
				p.RelationRecurseNoDirect()
			}



		default:
			p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
			goto errorExit
		}


	case antlr.ATNInvalidAltNumber:
		goto errorExit
	}


errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefGroupingContext is an interface to support dynamic dispatch.
type IRelationDefGroupingContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	RelationDefRewrite() IRelationDefRewriteContext

	// IsRelationDefGroupingContext differentiates from other interfaces.
	IsRelationDefGroupingContext()
}

type RelationDefGroupingContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDefGroupingContext() *RelationDefGroupingContext {
	var p = new(RelationDefGroupingContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefGrouping
	return p
}

func InitEmptyRelationDefGroupingContext(p *RelationDefGroupingContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefGrouping
}

func (*RelationDefGroupingContext) IsRelationDefGroupingContext() {}

func NewRelationDefGroupingContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefGroupingContext {
	var p = new(RelationDefGroupingContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefGrouping

	return p
}

func (s *RelationDefGroupingContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefGroupingContext) RelationDefRewrite() IRelationDefRewriteContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefRewriteContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefRewriteContext)
}

func (s *RelationDefGroupingContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefGroupingContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefGroupingContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefGrouping(s)
	}
}

func (s *RelationDefGroupingContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefGrouping(s)
	}
}




func (p *OpenFGAParser) RelationDefGrouping() (localctx IRelationDefGroupingContext) {
	localctx = NewRelationDefGroupingContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 20, OpenFGAParserRULE_relationDefGrouping)
	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(193)
		p.RelationDefRewrite()
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationRecurseContext is an interface to support dynamic dispatch.
type IRelationRecurseContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	LPAREN() antlr.TerminalNode
	RPAREN() antlr.TerminalNode
	RelationDef() IRelationDefContext
	RelationRecurseNoDirect() IRelationRecurseNoDirectContext
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode

	// IsRelationRecurseContext differentiates from other interfaces.
	IsRelationRecurseContext()
}

type RelationRecurseContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationRecurseContext() *RelationRecurseContext {
	var p = new(RelationRecurseContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationRecurse
	return p
}

func InitEmptyRelationRecurseContext(p *RelationRecurseContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationRecurse
}

func (*RelationRecurseContext) IsRelationRecurseContext() {}

func NewRelationRecurseContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationRecurseContext {
	var p = new(RelationRecurseContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationRecurse

	return p
}

func (s *RelationRecurseContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationRecurseContext) LPAREN() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLPAREN, 0)
}

func (s *RelationRecurseContext) RPAREN() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRPAREN, 0)
}

func (s *RelationRecurseContext) RelationDef() IRelationDefContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefContext)
}

func (s *RelationRecurseContext) RelationRecurseNoDirect() IRelationRecurseNoDirectContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationRecurseNoDirectContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationRecurseNoDirectContext)
}

func (s *RelationRecurseContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationRecurseContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationRecurseContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationRecurseContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationRecurseContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationRecurse(s)
	}
}

func (s *RelationRecurseContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationRecurse(s)
	}
}




func (p *OpenFGAParser) RelationRecurse() (localctx IRelationRecurseContext) {
	localctx = NewRelationRecurseContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 22, OpenFGAParserRULE_relationRecurse)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(195)
		p.Match(OpenFGAParserLPAREN)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(199)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(196)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}


		p.SetState(201)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	p.SetState(204)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 29, p.GetParserRuleContext()) {
	case 1:
		{
			p.SetState(202)
			p.RelationDef()
		}


	case 2:
		{
			p.SetState(203)
			p.RelationRecurseNoDirect()
		}

	case antlr.ATNInvalidAltNumber:
		goto errorExit
	}
	p.SetState(209)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(206)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}


		p.SetState(211)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	{
		p.SetState(212)
		p.Match(OpenFGAParserRPAREN)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationRecurseNoDirectContext is an interface to support dynamic dispatch.
type IRelationRecurseNoDirectContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	LPAREN() antlr.TerminalNode
	RPAREN() antlr.TerminalNode
	RelationDefNoDirect() IRelationDefNoDirectContext
	RelationRecurseNoDirect() IRelationRecurseNoDirectContext
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode

	// IsRelationRecurseNoDirectContext differentiates from other interfaces.
	IsRelationRecurseNoDirectContext()
}

type RelationRecurseNoDirectContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationRecurseNoDirectContext() *RelationRecurseNoDirectContext {
	var p = new(RelationRecurseNoDirectContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationRecurseNoDirect
	return p
}

func InitEmptyRelationRecurseNoDirectContext(p *RelationRecurseNoDirectContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationRecurseNoDirect
}

func (*RelationRecurseNoDirectContext) IsRelationRecurseNoDirectContext() {}

func NewRelationRecurseNoDirectContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationRecurseNoDirectContext {
	var p = new(RelationRecurseNoDirectContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationRecurseNoDirect

	return p
}

func (s *RelationRecurseNoDirectContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationRecurseNoDirectContext) LPAREN() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLPAREN, 0)
}

func (s *RelationRecurseNoDirectContext) RPAREN() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRPAREN, 0)
}

func (s *RelationRecurseNoDirectContext) RelationDefNoDirect() IRelationDefNoDirectContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefNoDirectContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefNoDirectContext)
}

func (s *RelationRecurseNoDirectContext) RelationRecurseNoDirect() IRelationRecurseNoDirectContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationRecurseNoDirectContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationRecurseNoDirectContext)
}

func (s *RelationRecurseNoDirectContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationRecurseNoDirectContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationRecurseNoDirectContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationRecurseNoDirectContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationRecurseNoDirectContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationRecurseNoDirect(s)
	}
}

func (s *RelationRecurseNoDirectContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationRecurseNoDirect(s)
	}
}




func (p *OpenFGAParser) RelationRecurseNoDirect() (localctx IRelationRecurseNoDirectContext) {
	localctx = NewRelationRecurseNoDirectContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 24, OpenFGAParserRULE_relationRecurseNoDirect)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(214)
		p.Match(OpenFGAParserLPAREN)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(218)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(215)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}


		p.SetState(220)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	p.SetState(223)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 32, p.GetParserRuleContext()) {
	case 1:
		{
			p.SetState(221)
			p.RelationDefNoDirect()
		}


	case 2:
		{
			p.SetState(222)
			p.RelationRecurseNoDirect()
		}

	case antlr.ATNInvalidAltNumber:
		goto errorExit
	}
	p.SetState(228)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(225)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}


		p.SetState(230)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	{
		p.SetState(231)
		p.Match(OpenFGAParserRPAREN)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefDirectAssignmentContext is an interface to support dynamic dispatch.
type IRelationDefDirectAssignmentContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	LBRACKET() antlr.TerminalNode
	AllRelationDefTypeRestriction() []IRelationDefTypeRestrictionContext
	RelationDefTypeRestriction(i int) IRelationDefTypeRestrictionContext
	RPRACKET() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	AllCOMMA() []antlr.TerminalNode
	COMMA(i int) antlr.TerminalNode

	// IsRelationDefDirectAssignmentContext differentiates from other interfaces.
	IsRelationDefDirectAssignmentContext()
}

type RelationDefDirectAssignmentContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDefDirectAssignmentContext() *RelationDefDirectAssignmentContext {
	var p = new(RelationDefDirectAssignmentContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefDirectAssignment
	return p
}

func InitEmptyRelationDefDirectAssignmentContext(p *RelationDefDirectAssignmentContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefDirectAssignment
}

func (*RelationDefDirectAssignmentContext) IsRelationDefDirectAssignmentContext() {}

func NewRelationDefDirectAssignmentContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefDirectAssignmentContext {
	var p = new(RelationDefDirectAssignmentContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefDirectAssignment

	return p
}

func (s *RelationDefDirectAssignmentContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefDirectAssignmentContext) LBRACKET() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLBRACKET, 0)
}

func (s *RelationDefDirectAssignmentContext) AllRelationDefTypeRestriction() []IRelationDefTypeRestrictionContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IRelationDefTypeRestrictionContext); ok {
			len++
		}
	}

	tst := make([]IRelationDefTypeRestrictionContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IRelationDefTypeRestrictionContext); ok {
			tst[i] = t.(IRelationDefTypeRestrictionContext)
			i++
		}
	}

	return tst
}

func (s *RelationDefDirectAssignmentContext) RelationDefTypeRestriction(i int) IRelationDefTypeRestrictionContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefTypeRestrictionContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefTypeRestrictionContext)
}

func (s *RelationDefDirectAssignmentContext) RPRACKET() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRPRACKET, 0)
}

func (s *RelationDefDirectAssignmentContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationDefDirectAssignmentContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationDefDirectAssignmentContext) AllCOMMA() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserCOMMA)
}

func (s *RelationDefDirectAssignmentContext) COMMA(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCOMMA, i)
}

func (s *RelationDefDirectAssignmentContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefDirectAssignmentContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefDirectAssignmentContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefDirectAssignment(s)
	}
}

func (s *RelationDefDirectAssignmentContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefDirectAssignment(s)
	}
}




func (p *OpenFGAParser) RelationDefDirectAssignment() (localctx IRelationDefDirectAssignmentContext) {
	localctx = NewRelationDefDirectAssignmentContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 26, OpenFGAParserRULE_relationDefDirectAssignment)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(233)
		p.Match(OpenFGAParserLBRACKET)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(235)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(234)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(237)
		p.RelationDefTypeRestriction()
	}
	p.SetState(239)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(238)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	p.SetState(251)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for _la == OpenFGAParserCOMMA {
		{
			p.SetState(241)
			p.Match(OpenFGAParserCOMMA)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		p.SetState(243)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_la = p.GetTokenStream().LA(1)


		if _la == OpenFGAParserWHITESPACE {
			{
				p.SetState(242)
				p.Match(OpenFGAParserWHITESPACE)
				if p.HasError() {
						// Recognition error - abort rule
						goto errorExit
				}
			}

		}
		{
			p.SetState(245)
			p.RelationDefTypeRestriction()
		}
		p.SetState(247)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_la = p.GetTokenStream().LA(1)


		if _la == OpenFGAParserWHITESPACE {
			{
				p.SetState(246)
				p.Match(OpenFGAParserWHITESPACE)
				if p.HasError() {
						// Recognition error - abort rule
						goto errorExit
				}
			}

		}


		p.SetState(253)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	{
		p.SetState(254)
		p.Match(OpenFGAParserRPRACKET)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefRewriteContext is an interface to support dynamic dispatch.
type IRelationDefRewriteContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// GetRewriteComputedusersetName returns the rewriteComputedusersetName rule contexts.
	GetRewriteComputedusersetName() IExtended_identifierContext

	// GetRewriteTuplesetName returns the rewriteTuplesetName rule contexts.
	GetRewriteTuplesetName() IExtended_identifierContext


	// SetRewriteComputedusersetName sets the rewriteComputedusersetName rule contexts.
	SetRewriteComputedusersetName(IExtended_identifierContext)

	// SetRewriteTuplesetName sets the rewriteTuplesetName rule contexts.
	SetRewriteTuplesetName(IExtended_identifierContext)


	// Getter signatures
	AllExtended_identifier() []IExtended_identifierContext
	Extended_identifier(i int) IExtended_identifierContext
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	FROM() antlr.TerminalNode

	// IsRelationDefRewriteContext differentiates from other interfaces.
	IsRelationDefRewriteContext()
}

type RelationDefRewriteContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
	rewriteComputedusersetName IExtended_identifierContext 
	rewriteTuplesetName IExtended_identifierContext 
}

func NewEmptyRelationDefRewriteContext() *RelationDefRewriteContext {
	var p = new(RelationDefRewriteContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefRewrite
	return p
}

func InitEmptyRelationDefRewriteContext(p *RelationDefRewriteContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefRewrite
}

func (*RelationDefRewriteContext) IsRelationDefRewriteContext() {}

func NewRelationDefRewriteContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefRewriteContext {
	var p = new(RelationDefRewriteContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefRewrite

	return p
}

func (s *RelationDefRewriteContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefRewriteContext) GetRewriteComputedusersetName() IExtended_identifierContext { return s.rewriteComputedusersetName }

func (s *RelationDefRewriteContext) GetRewriteTuplesetName() IExtended_identifierContext { return s.rewriteTuplesetName }


func (s *RelationDefRewriteContext) SetRewriteComputedusersetName(v IExtended_identifierContext) { s.rewriteComputedusersetName = v }

func (s *RelationDefRewriteContext) SetRewriteTuplesetName(v IExtended_identifierContext) { s.rewriteTuplesetName = v }


func (s *RelationDefRewriteContext) AllExtended_identifier() []IExtended_identifierContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IExtended_identifierContext); ok {
			len++
		}
	}

	tst := make([]IExtended_identifierContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IExtended_identifierContext); ok {
			tst[i] = t.(IExtended_identifierContext)
			i++
		}
	}

	return tst
}

func (s *RelationDefRewriteContext) Extended_identifier(i int) IExtended_identifierContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IExtended_identifierContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IExtended_identifierContext)
}

func (s *RelationDefRewriteContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationDefRewriteContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationDefRewriteContext) FROM() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserFROM, 0)
}

func (s *RelationDefRewriteContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefRewriteContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefRewriteContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefRewrite(s)
	}
}

func (s *RelationDefRewriteContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefRewrite(s)
	}
}




func (p *OpenFGAParser) RelationDefRewrite() (localctx IRelationDefRewriteContext) {
	localctx = NewRelationDefRewriteContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 28, OpenFGAParserRULE_relationDefRewrite)
	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(256)

		var _x = p.Extended_identifier()


		localctx.(*RelationDefRewriteContext).rewriteComputedusersetName = _x
	}
	p.SetState(261)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 39, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(257)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(258)
			p.Match(OpenFGAParserFROM)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(259)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(260)

			var _x = p.Extended_identifier()


			localctx.(*RelationDefRewriteContext).rewriteTuplesetName = _x
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefTypeRestrictionContext is an interface to support dynamic dispatch.
type IRelationDefTypeRestrictionContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	RelationDefTypeRestrictionBase() IRelationDefTypeRestrictionBaseContext
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	KEYWORD_WITH() antlr.TerminalNode
	ConditionName() IConditionNameContext

	// IsRelationDefTypeRestrictionContext differentiates from other interfaces.
	IsRelationDefTypeRestrictionContext()
}

type RelationDefTypeRestrictionContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyRelationDefTypeRestrictionContext() *RelationDefTypeRestrictionContext {
	var p = new(RelationDefTypeRestrictionContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefTypeRestriction
	return p
}

func InitEmptyRelationDefTypeRestrictionContext(p *RelationDefTypeRestrictionContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefTypeRestriction
}

func (*RelationDefTypeRestrictionContext) IsRelationDefTypeRestrictionContext() {}

func NewRelationDefTypeRestrictionContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefTypeRestrictionContext {
	var p = new(RelationDefTypeRestrictionContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefTypeRestriction

	return p
}

func (s *RelationDefTypeRestrictionContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefTypeRestrictionContext) RelationDefTypeRestrictionBase() IRelationDefTypeRestrictionBaseContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IRelationDefTypeRestrictionBaseContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IRelationDefTypeRestrictionBaseContext)
}

func (s *RelationDefTypeRestrictionContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *RelationDefTypeRestrictionContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *RelationDefTypeRestrictionContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *RelationDefTypeRestrictionContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *RelationDefTypeRestrictionContext) KEYWORD_WITH() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserKEYWORD_WITH, 0)
}

func (s *RelationDefTypeRestrictionContext) ConditionName() IConditionNameContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IConditionNameContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IConditionNameContext)
}

func (s *RelationDefTypeRestrictionContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefTypeRestrictionContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefTypeRestrictionContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefTypeRestriction(s)
	}
}

func (s *RelationDefTypeRestrictionContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefTypeRestriction(s)
	}
}




func (p *OpenFGAParser) RelationDefTypeRestriction() (localctx IRelationDefTypeRestrictionContext) {
	localctx = NewRelationDefTypeRestrictionContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 30, OpenFGAParserRULE_relationDefTypeRestriction)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(264)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(263)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	p.SetState(273)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 41, p.GetParserRuleContext()) {
	case 1:
		{
			p.SetState(266)
			p.RelationDefTypeRestrictionBase()
		}


	case 2:
		{
			p.SetState(267)
			p.RelationDefTypeRestrictionBase()
		}
		{
			p.SetState(268)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(269)
			p.Match(OpenFGAParserKEYWORD_WITH)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(270)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(271)
			p.ConditionName()
		}


	case antlr.ATNInvalidAltNumber:
		goto errorExit
	}
	p.SetState(276)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(275)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IRelationDefTypeRestrictionBaseContext is an interface to support dynamic dispatch.
type IRelationDefTypeRestrictionBaseContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// GetRelationDefTypeRestrictionWildcard returns the relationDefTypeRestrictionWildcard token.
	GetRelationDefTypeRestrictionWildcard() antlr.Token 


	// SetRelationDefTypeRestrictionWildcard sets the relationDefTypeRestrictionWildcard token.
	SetRelationDefTypeRestrictionWildcard(antlr.Token) 


	// GetRelationDefTypeRestrictionType returns the relationDefTypeRestrictionType rule contexts.
	GetRelationDefTypeRestrictionType() IExtended_identifierContext

	// GetRelationDefTypeRestrictionRelation returns the relationDefTypeRestrictionRelation rule contexts.
	GetRelationDefTypeRestrictionRelation() IExtended_identifierContext


	// SetRelationDefTypeRestrictionType sets the relationDefTypeRestrictionType rule contexts.
	SetRelationDefTypeRestrictionType(IExtended_identifierContext)

	// SetRelationDefTypeRestrictionRelation sets the relationDefTypeRestrictionRelation rule contexts.
	SetRelationDefTypeRestrictionRelation(IExtended_identifierContext)


	// Getter signatures
	AllExtended_identifier() []IExtended_identifierContext
	Extended_identifier(i int) IExtended_identifierContext
	COLON() antlr.TerminalNode
	HASH() antlr.TerminalNode
	STAR() antlr.TerminalNode

	// IsRelationDefTypeRestrictionBaseContext differentiates from other interfaces.
	IsRelationDefTypeRestrictionBaseContext()
}

type RelationDefTypeRestrictionBaseContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
	relationDefTypeRestrictionType IExtended_identifierContext 
	relationDefTypeRestrictionWildcard antlr.Token
	relationDefTypeRestrictionRelation IExtended_identifierContext 
}

func NewEmptyRelationDefTypeRestrictionBaseContext() *RelationDefTypeRestrictionBaseContext {
	var p = new(RelationDefTypeRestrictionBaseContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefTypeRestrictionBase
	return p
}

func InitEmptyRelationDefTypeRestrictionBaseContext(p *RelationDefTypeRestrictionBaseContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_relationDefTypeRestrictionBase
}

func (*RelationDefTypeRestrictionBaseContext) IsRelationDefTypeRestrictionBaseContext() {}

func NewRelationDefTypeRestrictionBaseContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *RelationDefTypeRestrictionBaseContext {
	var p = new(RelationDefTypeRestrictionBaseContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_relationDefTypeRestrictionBase

	return p
}

func (s *RelationDefTypeRestrictionBaseContext) GetParser() antlr.Parser { return s.parser }

func (s *RelationDefTypeRestrictionBaseContext) GetRelationDefTypeRestrictionWildcard() antlr.Token { return s.relationDefTypeRestrictionWildcard }


func (s *RelationDefTypeRestrictionBaseContext) SetRelationDefTypeRestrictionWildcard(v antlr.Token) { s.relationDefTypeRestrictionWildcard = v }


func (s *RelationDefTypeRestrictionBaseContext) GetRelationDefTypeRestrictionType() IExtended_identifierContext { return s.relationDefTypeRestrictionType }

func (s *RelationDefTypeRestrictionBaseContext) GetRelationDefTypeRestrictionRelation() IExtended_identifierContext { return s.relationDefTypeRestrictionRelation }


func (s *RelationDefTypeRestrictionBaseContext) SetRelationDefTypeRestrictionType(v IExtended_identifierContext) { s.relationDefTypeRestrictionType = v }

func (s *RelationDefTypeRestrictionBaseContext) SetRelationDefTypeRestrictionRelation(v IExtended_identifierContext) { s.relationDefTypeRestrictionRelation = v }


func (s *RelationDefTypeRestrictionBaseContext) AllExtended_identifier() []IExtended_identifierContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IExtended_identifierContext); ok {
			len++
		}
	}

	tst := make([]IExtended_identifierContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IExtended_identifierContext); ok {
			tst[i] = t.(IExtended_identifierContext)
			i++
		}
	}

	return tst
}

func (s *RelationDefTypeRestrictionBaseContext) Extended_identifier(i int) IExtended_identifierContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IExtended_identifierContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IExtended_identifierContext)
}

func (s *RelationDefTypeRestrictionBaseContext) COLON() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCOLON, 0)
}

func (s *RelationDefTypeRestrictionBaseContext) HASH() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserHASH, 0)
}

func (s *RelationDefTypeRestrictionBaseContext) STAR() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSTAR, 0)
}

func (s *RelationDefTypeRestrictionBaseContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *RelationDefTypeRestrictionBaseContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *RelationDefTypeRestrictionBaseContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterRelationDefTypeRestrictionBase(s)
	}
}

func (s *RelationDefTypeRestrictionBaseContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitRelationDefTypeRestrictionBase(s)
	}
}




func (p *OpenFGAParser) RelationDefTypeRestrictionBase() (localctx IRelationDefTypeRestrictionBaseContext) {
	localctx = NewRelationDefTypeRestrictionBaseContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 32, OpenFGAParserRULE_relationDefTypeRestrictionBase)
	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(278)

		var _x = p.Extended_identifier()


		localctx.(*RelationDefTypeRestrictionBaseContext).relationDefTypeRestrictionType = _x
	}
	p.SetState(283)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	switch p.GetTokenStream().LA(1) {
	case OpenFGAParserCOLON:
		{
			p.SetState(279)
			p.Match(OpenFGAParserCOLON)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(280)

			var _m = p.Match(OpenFGAParserSTAR)

			localctx.(*RelationDefTypeRestrictionBaseContext).relationDefTypeRestrictionWildcard = _m
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}



	case OpenFGAParserHASH:
		{
			p.SetState(281)
			p.Match(OpenFGAParserHASH)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(282)

			var _x = p.Extended_identifier()


			localctx.(*RelationDefTypeRestrictionBaseContext).relationDefTypeRestrictionRelation = _x
		}



	case OpenFGAParserCOMMA, OpenFGAParserWHITESPACE, OpenFGAParserRPRACKET, OpenFGAParserNEWLINE:



	default:
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IConditionsContext is an interface to support dynamic dispatch.
type IConditionsContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	AllCondition() []IConditionContext
	Condition(i int) IConditionContext

	// IsConditionsContext differentiates from other interfaces.
	IsConditionsContext()
}

type ConditionsContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyConditionsContext() *ConditionsContext {
	var p = new(ConditionsContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditions
	return p
}

func InitEmptyConditionsContext(p *ConditionsContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditions
}

func (*ConditionsContext) IsConditionsContext() {}

func NewConditionsContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ConditionsContext {
	var p = new(ConditionsContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_conditions

	return p
}

func (s *ConditionsContext) GetParser() antlr.Parser { return s.parser }

func (s *ConditionsContext) AllCondition() []IConditionContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IConditionContext); ok {
			len++
		}
	}

	tst := make([]IConditionContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IConditionContext); ok {
			tst[i] = t.(IConditionContext)
			i++
		}
	}

	return tst
}

func (s *ConditionsContext) Condition(i int) IConditionContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IConditionContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IConditionContext)
}

func (s *ConditionsContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ConditionsContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ConditionsContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterConditions(s)
	}
}

func (s *ConditionsContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitConditions(s)
	}
}




func (p *OpenFGAParser) Conditions() (localctx IConditionsContext) {
	localctx = NewConditionsContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 34, OpenFGAParserRULE_conditions)
	var _alt int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(288)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 44, p.GetParserRuleContext())
	if p.HasError() {
		goto errorExit
	}
	for _alt != 2 && _alt != antlr.ATNInvalidAltNumber {
		if _alt == 1 {
			{
				p.SetState(285)
				p.Condition()
			}


		}
		p.SetState(290)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 44, p.GetParserRuleContext())
		if p.HasError() {
			goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IConditionContext is an interface to support dynamic dispatch.
type IConditionContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	CONDITION() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	ConditionName() IConditionNameContext
	LPAREN() antlr.TerminalNode
	AllConditionParameter() []IConditionParameterContext
	ConditionParameter(i int) IConditionParameterContext
	RPAREN() antlr.TerminalNode
	LBRACE() antlr.TerminalNode
	ConditionExpression() IConditionExpressionContext
	RBRACE() antlr.TerminalNode
	MultiLineComment() IMultiLineCommentContext
	AllCOMMA() []antlr.TerminalNode
	COMMA(i int) antlr.TerminalNode

	// IsConditionContext differentiates from other interfaces.
	IsConditionContext()
}

type ConditionContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyConditionContext() *ConditionContext {
	var p = new(ConditionContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_condition
	return p
}

func InitEmptyConditionContext(p *ConditionContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_condition
}

func (*ConditionContext) IsConditionContext() {}

func NewConditionContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ConditionContext {
	var p = new(ConditionContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_condition

	return p
}

func (s *ConditionContext) GetParser() antlr.Parser { return s.parser }

func (s *ConditionContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *ConditionContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *ConditionContext) CONDITION() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCONDITION, 0)
}

func (s *ConditionContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *ConditionContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *ConditionContext) ConditionName() IConditionNameContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IConditionNameContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IConditionNameContext)
}

func (s *ConditionContext) LPAREN() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLPAREN, 0)
}

func (s *ConditionContext) AllConditionParameter() []IConditionParameterContext {
	children := s.GetChildren()
	len := 0
	for _, ctx := range children {
		if _, ok := ctx.(IConditionParameterContext); ok {
			len++
		}
	}

	tst := make([]IConditionParameterContext, len)
	i := 0
	for _, ctx := range children {
		if t, ok := ctx.(IConditionParameterContext); ok {
			tst[i] = t.(IConditionParameterContext)
			i++
		}
	}

	return tst
}

func (s *ConditionContext) ConditionParameter(i int) IConditionParameterContext {
	var t antlr.RuleContext;
	j := 0
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IConditionParameterContext); ok {
			if j == i {
				t = ctx.(antlr.RuleContext);
				break
			}
			j++
		}
	}

	if t == nil {
		return nil
	}

	return t.(IConditionParameterContext)
}

func (s *ConditionContext) RPAREN() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRPAREN, 0)
}

func (s *ConditionContext) LBRACE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLBRACE, 0)
}

func (s *ConditionContext) ConditionExpression() IConditionExpressionContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IConditionExpressionContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IConditionExpressionContext)
}

func (s *ConditionContext) RBRACE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRBRACE, 0)
}

func (s *ConditionContext) MultiLineComment() IMultiLineCommentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IMultiLineCommentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IMultiLineCommentContext)
}

func (s *ConditionContext) AllCOMMA() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserCOMMA)
}

func (s *ConditionContext) COMMA(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCOMMA, i)
}

func (s *ConditionContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ConditionContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ConditionContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterCondition(s)
	}
}

func (s *ConditionContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitCondition(s)
	}
}




func (p *OpenFGAParser) Condition() (localctx IConditionContext) {
	localctx = NewConditionContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 36, OpenFGAParserRULE_condition)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(293)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 45, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(291)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(292)
			p.MultiLineComment()
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	{
		p.SetState(295)
		p.Match(OpenFGAParserNEWLINE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(296)
		p.Match(OpenFGAParserCONDITION)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(297)
		p.Match(OpenFGAParserWHITESPACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	{
		p.SetState(298)
		p.ConditionName()
	}
	p.SetState(300)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(299)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(302)
		p.Match(OpenFGAParserLPAREN)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(304)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(303)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(306)
		p.ConditionParameter()
	}
	p.SetState(308)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(307)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	p.SetState(320)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for _la == OpenFGAParserCOMMA {
		{
			p.SetState(310)
			p.Match(OpenFGAParserCOMMA)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		p.SetState(312)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_la = p.GetTokenStream().LA(1)


		if _la == OpenFGAParserWHITESPACE {
			{
				p.SetState(311)
				p.Match(OpenFGAParserWHITESPACE)
				if p.HasError() {
						// Recognition error - abort rule
						goto errorExit
				}
			}

		}
		{
			p.SetState(314)
			p.ConditionParameter()
		}
		p.SetState(316)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
			goto errorExit
		}
		_la = p.GetTokenStream().LA(1)


		if _la == OpenFGAParserWHITESPACE {
			{
				p.SetState(315)
				p.Match(OpenFGAParserWHITESPACE)
				if p.HasError() {
						// Recognition error - abort rule
						goto errorExit
				}
			}

		}


		p.SetState(322)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	p.SetState(324)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(323)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(326)
		p.Match(OpenFGAParserRPAREN)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(328)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(327)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(330)
		p.Match(OpenFGAParserLBRACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(332)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 54, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(331)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	p.SetState(335)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 55, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(334)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}
	{
		p.SetState(337)
		p.ConditionExpression()
	}
	p.SetState(339)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(338)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(341)
		p.Match(OpenFGAParserRBRACE)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IConditionNameContext is an interface to support dynamic dispatch.
type IConditionNameContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	IDENTIFIER() antlr.TerminalNode

	// IsConditionNameContext differentiates from other interfaces.
	IsConditionNameContext()
}

type ConditionNameContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyConditionNameContext() *ConditionNameContext {
	var p = new(ConditionNameContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditionName
	return p
}

func InitEmptyConditionNameContext(p *ConditionNameContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditionName
}

func (*ConditionNameContext) IsConditionNameContext() {}

func NewConditionNameContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ConditionNameContext {
	var p = new(ConditionNameContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_conditionName

	return p
}

func (s *ConditionNameContext) GetParser() antlr.Parser { return s.parser }

func (s *ConditionNameContext) IDENTIFIER() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserIDENTIFIER, 0)
}

func (s *ConditionNameContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ConditionNameContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ConditionNameContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterConditionName(s)
	}
}

func (s *ConditionNameContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitConditionName(s)
	}
}




func (p *OpenFGAParser) ConditionName() (localctx IConditionNameContext) {
	localctx = NewConditionNameContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 38, OpenFGAParserRULE_conditionName)
	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(343)
		p.Match(OpenFGAParserIDENTIFIER)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IConditionParameterContext is an interface to support dynamic dispatch.
type IConditionParameterContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	ParameterName() IParameterNameContext
	COLON() antlr.TerminalNode
	ParameterType() IParameterTypeContext
	NEWLINE() antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode

	// IsConditionParameterContext differentiates from other interfaces.
	IsConditionParameterContext()
}

type ConditionParameterContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyConditionParameterContext() *ConditionParameterContext {
	var p = new(ConditionParameterContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditionParameter
	return p
}

func InitEmptyConditionParameterContext(p *ConditionParameterContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditionParameter
}

func (*ConditionParameterContext) IsConditionParameterContext() {}

func NewConditionParameterContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ConditionParameterContext {
	var p = new(ConditionParameterContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_conditionParameter

	return p
}

func (s *ConditionParameterContext) GetParser() antlr.Parser { return s.parser }

func (s *ConditionParameterContext) ParameterName() IParameterNameContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IParameterNameContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IParameterNameContext)
}

func (s *ConditionParameterContext) COLON() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCOLON, 0)
}

func (s *ConditionParameterContext) ParameterType() IParameterTypeContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IParameterTypeContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IParameterTypeContext)
}

func (s *ConditionParameterContext) NEWLINE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, 0)
}

func (s *ConditionParameterContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *ConditionParameterContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *ConditionParameterContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ConditionParameterContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ConditionParameterContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterConditionParameter(s)
	}
}

func (s *ConditionParameterContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitConditionParameter(s)
	}
}




func (p *OpenFGAParser) ConditionParameter() (localctx IConditionParameterContext) {
	localctx = NewConditionParameterContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 40, OpenFGAParserRULE_conditionParameter)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(346)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserNEWLINE {
		{
			p.SetState(345)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(348)
		p.ParameterName()
	}
	p.SetState(350)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(349)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(352)
		p.Match(OpenFGAParserCOLON)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(354)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	if _la == OpenFGAParserWHITESPACE {
		{
			p.SetState(353)
			p.Match(OpenFGAParserWHITESPACE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}

	}
	{
		p.SetState(356)
		p.ParameterType()
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IParameterNameContext is an interface to support dynamic dispatch.
type IParameterNameContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	IDENTIFIER() antlr.TerminalNode

	// IsParameterNameContext differentiates from other interfaces.
	IsParameterNameContext()
}

type ParameterNameContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyParameterNameContext() *ParameterNameContext {
	var p = new(ParameterNameContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_parameterName
	return p
}

func InitEmptyParameterNameContext(p *ParameterNameContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_parameterName
}

func (*ParameterNameContext) IsParameterNameContext() {}

func NewParameterNameContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ParameterNameContext {
	var p = new(ParameterNameContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_parameterName

	return p
}

func (s *ParameterNameContext) GetParser() antlr.Parser { return s.parser }

func (s *ParameterNameContext) IDENTIFIER() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserIDENTIFIER, 0)
}

func (s *ParameterNameContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ParameterNameContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ParameterNameContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterParameterName(s)
	}
}

func (s *ParameterNameContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitParameterName(s)
	}
}




func (p *OpenFGAParser) ParameterName() (localctx IParameterNameContext) {
	localctx = NewParameterNameContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 42, OpenFGAParserRULE_parameterName)
	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(358)
		p.Match(OpenFGAParserIDENTIFIER)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IParameterTypeContext is an interface to support dynamic dispatch.
type IParameterTypeContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	CONDITION_PARAM_TYPE() antlr.TerminalNode
	CONDITION_PARAM_CONTAINER() antlr.TerminalNode
	LESS() antlr.TerminalNode
	GREATER() antlr.TerminalNode

	// IsParameterTypeContext differentiates from other interfaces.
	IsParameterTypeContext()
}

type ParameterTypeContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyParameterTypeContext() *ParameterTypeContext {
	var p = new(ParameterTypeContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_parameterType
	return p
}

func InitEmptyParameterTypeContext(p *ParameterTypeContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_parameterType
}

func (*ParameterTypeContext) IsParameterTypeContext() {}

func NewParameterTypeContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ParameterTypeContext {
	var p = new(ParameterTypeContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_parameterType

	return p
}

func (s *ParameterTypeContext) GetParser() antlr.Parser { return s.parser }

func (s *ParameterTypeContext) CONDITION_PARAM_TYPE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCONDITION_PARAM_TYPE, 0)
}

func (s *ParameterTypeContext) CONDITION_PARAM_CONTAINER() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCONDITION_PARAM_CONTAINER, 0)
}

func (s *ParameterTypeContext) LESS() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLESS, 0)
}

func (s *ParameterTypeContext) GREATER() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserGREATER, 0)
}

func (s *ParameterTypeContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ParameterTypeContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ParameterTypeContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterParameterType(s)
	}
}

func (s *ParameterTypeContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitParameterType(s)
	}
}




func (p *OpenFGAParser) ParameterType() (localctx IParameterTypeContext) {
	localctx = NewParameterTypeContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 44, OpenFGAParserRULE_parameterType)
	p.SetState(365)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetTokenStream().LA(1) {
	case OpenFGAParserCONDITION_PARAM_TYPE:
		p.EnterOuterAlt(localctx, 1)
		{
			p.SetState(360)
			p.Match(OpenFGAParserCONDITION_PARAM_TYPE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}


	case OpenFGAParserCONDITION_PARAM_CONTAINER:
		p.EnterOuterAlt(localctx, 2)
		{
			p.SetState(361)
			p.Match(OpenFGAParserCONDITION_PARAM_CONTAINER)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(362)
			p.Match(OpenFGAParserLESS)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(363)
			p.Match(OpenFGAParserCONDITION_PARAM_TYPE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(364)
			p.Match(OpenFGAParserGREATER)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}




	default:
		p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
		goto errorExit
	}


errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IMultiLineCommentContext is an interface to support dynamic dispatch.
type IMultiLineCommentContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	HASH() antlr.TerminalNode
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	MultiLineComment() IMultiLineCommentContext

	// IsMultiLineCommentContext differentiates from other interfaces.
	IsMultiLineCommentContext()
}

type MultiLineCommentContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyMultiLineCommentContext() *MultiLineCommentContext {
	var p = new(MultiLineCommentContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_multiLineComment
	return p
}

func InitEmptyMultiLineCommentContext(p *MultiLineCommentContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_multiLineComment
}

func (*MultiLineCommentContext) IsMultiLineCommentContext() {}

func NewMultiLineCommentContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *MultiLineCommentContext {
	var p = new(MultiLineCommentContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_multiLineComment

	return p
}

func (s *MultiLineCommentContext) GetParser() antlr.Parser { return s.parser }

func (s *MultiLineCommentContext) HASH() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserHASH, 0)
}

func (s *MultiLineCommentContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *MultiLineCommentContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *MultiLineCommentContext) MultiLineComment() IMultiLineCommentContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IMultiLineCommentContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IMultiLineCommentContext)
}

func (s *MultiLineCommentContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *MultiLineCommentContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *MultiLineCommentContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterMultiLineComment(s)
	}
}

func (s *MultiLineCommentContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitMultiLineComment(s)
	}
}




func (p *OpenFGAParser) MultiLineComment() (localctx IMultiLineCommentContext) {
	localctx = NewMultiLineCommentContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 46, OpenFGAParserRULE_multiLineComment)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(367)
		p.Match(OpenFGAParserHASH)
		if p.HasError() {
				// Recognition error - abort rule
				goto errorExit
		}
	}
	p.SetState(371)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_la = p.GetTokenStream().LA(1)


	for ((int64(_la) & ^0x3f) == 0 && ((int64(1) << _la) & 252201579132747774) != 0) {
		{
			p.SetState(368)
			_la = p.GetTokenStream().LA(1)

			if _la <= 0 || _la == OpenFGAParserNEWLINE  {
				p.GetErrorHandler().RecoverInline(p)
			} else {
				p.GetErrorHandler().ReportMatch(p)
				p.Consume()
			}
		}


		p.SetState(373)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_la = p.GetTokenStream().LA(1)
	}
	p.SetState(376)
	p.GetErrorHandler().Sync(p)


	if p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 62, p.GetParserRuleContext()) == 1 {
		{
			p.SetState(374)
			p.Match(OpenFGAParserNEWLINE)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}
		{
			p.SetState(375)
			p.MultiLineComment()
		}

		} else if p.HasError() { // JIM
			goto errorExit
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IIdentifierContext is an interface to support dynamic dispatch.
type IIdentifierContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	MODEL() antlr.TerminalNode
	SCHEMA() antlr.TerminalNode
	TYPE() antlr.TerminalNode
	RELATION() antlr.TerminalNode
	IDENTIFIER() antlr.TerminalNode
	MODULE() antlr.TerminalNode
	EXTEND() antlr.TerminalNode

	// IsIdentifierContext differentiates from other interfaces.
	IsIdentifierContext()
}

type IdentifierContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyIdentifierContext() *IdentifierContext {
	var p = new(IdentifierContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_identifier
	return p
}

func InitEmptyIdentifierContext(p *IdentifierContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_identifier
}

func (*IdentifierContext) IsIdentifierContext() {}

func NewIdentifierContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *IdentifierContext {
	var p = new(IdentifierContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_identifier

	return p
}

func (s *IdentifierContext) GetParser() antlr.Parser { return s.parser }

func (s *IdentifierContext) MODEL() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserMODEL, 0)
}

func (s *IdentifierContext) SCHEMA() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSCHEMA, 0)
}

func (s *IdentifierContext) TYPE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserTYPE, 0)
}

func (s *IdentifierContext) RELATION() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRELATION, 0)
}

func (s *IdentifierContext) IDENTIFIER() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserIDENTIFIER, 0)
}

func (s *IdentifierContext) MODULE() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserMODULE, 0)
}

func (s *IdentifierContext) EXTEND() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserEXTEND, 0)
}

func (s *IdentifierContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *IdentifierContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *IdentifierContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterIdentifier(s)
	}
}

func (s *IdentifierContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitIdentifier(s)
	}
}




func (p *OpenFGAParser) Identifier() (localctx IIdentifierContext) {
	localctx = NewIdentifierContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 48, OpenFGAParserRULE_identifier)
	var _la int

	p.EnterOuterAlt(localctx, 1)
	{
		p.SetState(378)
		_la = p.GetTokenStream().LA(1)

		if !(((int64(_la) & ^0x3f) == 0 && ((int64(1) << _la) & 20382720) != 0)) {
			p.GetErrorHandler().RecoverInline(p)
		} else {
			p.GetErrorHandler().ReportMatch(p)
			p.Consume()
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IExtended_identifierContext is an interface to support dynamic dispatch.
type IExtended_identifierContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	Identifier() IIdentifierContext
	EXTENDED_IDENTIFIER() antlr.TerminalNode

	// IsExtended_identifierContext differentiates from other interfaces.
	IsExtended_identifierContext()
}

type Extended_identifierContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyExtended_identifierContext() *Extended_identifierContext {
	var p = new(Extended_identifierContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_extended_identifier
	return p
}

func InitEmptyExtended_identifierContext(p *Extended_identifierContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_extended_identifier
}

func (*Extended_identifierContext) IsExtended_identifierContext() {}

func NewExtended_identifierContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *Extended_identifierContext {
	var p = new(Extended_identifierContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_extended_identifier

	return p
}

func (s *Extended_identifierContext) GetParser() antlr.Parser { return s.parser }

func (s *Extended_identifierContext) Identifier() IIdentifierContext {
	var t antlr.RuleContext;
	for _, ctx := range s.GetChildren() {
		if _, ok := ctx.(IIdentifierContext); ok {
			t = ctx.(antlr.RuleContext);
			break
		}
	}

	if t == nil {
		return nil
	}

	return t.(IIdentifierContext)
}

func (s *Extended_identifierContext) EXTENDED_IDENTIFIER() antlr.TerminalNode {
	return s.GetToken(OpenFGAParserEXTENDED_IDENTIFIER, 0)
}

func (s *Extended_identifierContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *Extended_identifierContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *Extended_identifierContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterExtended_identifier(s)
	}
}

func (s *Extended_identifierContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitExtended_identifier(s)
	}
}




func (p *OpenFGAParser) Extended_identifier() (localctx IExtended_identifierContext) {
	localctx = NewExtended_identifierContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 50, OpenFGAParserRULE_extended_identifier)
	p.SetState(382)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}

	switch p.GetTokenStream().LA(1) {
	case OpenFGAParserIDENTIFIER, OpenFGAParserMODULE, OpenFGAParserMODEL, OpenFGAParserSCHEMA, OpenFGAParserEXTEND, OpenFGAParserTYPE, OpenFGAParserRELATION:
		p.EnterOuterAlt(localctx, 1)
		{
			p.SetState(380)
			p.Identifier()
		}


	case OpenFGAParserEXTENDED_IDENTIFIER:
		p.EnterOuterAlt(localctx, 2)
		{
			p.SetState(381)
			p.Match(OpenFGAParserEXTENDED_IDENTIFIER)
			if p.HasError() {
					// Recognition error - abort rule
					goto errorExit
			}
		}



	default:
		p.SetError(antlr.NewNoViableAltException(p, nil, nil, nil, nil, nil))
		goto errorExit
	}


errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


// IConditionExpressionContext is an interface to support dynamic dispatch.
type IConditionExpressionContext interface {
	antlr.ParserRuleContext

	// GetParser returns the parser.
	GetParser() antlr.Parser

	// Getter signatures
	AllIDENTIFIER() []antlr.TerminalNode
	IDENTIFIER(i int) antlr.TerminalNode
	AllEQUALS() []antlr.TerminalNode
	EQUALS(i int) antlr.TerminalNode
	AllNOT_EQUALS() []antlr.TerminalNode
	NOT_EQUALS(i int) antlr.TerminalNode
	AllIN() []antlr.TerminalNode
	IN(i int) antlr.TerminalNode
	AllLESS() []antlr.TerminalNode
	LESS(i int) antlr.TerminalNode
	AllLESS_EQUALS() []antlr.TerminalNode
	LESS_EQUALS(i int) antlr.TerminalNode
	AllGREATER_EQUALS() []antlr.TerminalNode
	GREATER_EQUALS(i int) antlr.TerminalNode
	AllGREATER() []antlr.TerminalNode
	GREATER(i int) antlr.TerminalNode
	AllLOGICAL_AND() []antlr.TerminalNode
	LOGICAL_AND(i int) antlr.TerminalNode
	AllLOGICAL_OR() []antlr.TerminalNode
	LOGICAL_OR(i int) antlr.TerminalNode
	AllLBRACKET() []antlr.TerminalNode
	LBRACKET(i int) antlr.TerminalNode
	AllRPRACKET() []antlr.TerminalNode
	RPRACKET(i int) antlr.TerminalNode
	AllLBRACE() []antlr.TerminalNode
	LBRACE(i int) antlr.TerminalNode
	AllLPAREN() []antlr.TerminalNode
	LPAREN(i int) antlr.TerminalNode
	AllRPAREN() []antlr.TerminalNode
	RPAREN(i int) antlr.TerminalNode
	AllDOT() []antlr.TerminalNode
	DOT(i int) antlr.TerminalNode
	AllMINUS() []antlr.TerminalNode
	MINUS(i int) antlr.TerminalNode
	AllEXCLAM() []antlr.TerminalNode
	EXCLAM(i int) antlr.TerminalNode
	AllQUESTIONMARK() []antlr.TerminalNode
	QUESTIONMARK(i int) antlr.TerminalNode
	AllPLUS() []antlr.TerminalNode
	PLUS(i int) antlr.TerminalNode
	AllSTAR() []antlr.TerminalNode
	STAR(i int) antlr.TerminalNode
	AllSLASH() []antlr.TerminalNode
	SLASH(i int) antlr.TerminalNode
	AllPERCENT() []antlr.TerminalNode
	PERCENT(i int) antlr.TerminalNode
	AllCEL_TRUE() []antlr.TerminalNode
	CEL_TRUE(i int) antlr.TerminalNode
	AllCEL_FALSE() []antlr.TerminalNode
	CEL_FALSE(i int) antlr.TerminalNode
	AllNUL() []antlr.TerminalNode
	NUL(i int) antlr.TerminalNode
	AllWHITESPACE() []antlr.TerminalNode
	WHITESPACE(i int) antlr.TerminalNode
	AllCEL_COMMENT() []antlr.TerminalNode
	CEL_COMMENT(i int) antlr.TerminalNode
	AllNUM_FLOAT() []antlr.TerminalNode
	NUM_FLOAT(i int) antlr.TerminalNode
	AllNUM_INT() []antlr.TerminalNode
	NUM_INT(i int) antlr.TerminalNode
	AllNUM_UINT() []antlr.TerminalNode
	NUM_UINT(i int) antlr.TerminalNode
	AllSTRING() []antlr.TerminalNode
	STRING(i int) antlr.TerminalNode
	AllBYTES() []antlr.TerminalNode
	BYTES(i int) antlr.TerminalNode
	AllNEWLINE() []antlr.TerminalNode
	NEWLINE(i int) antlr.TerminalNode
	AllRBRACE() []antlr.TerminalNode
	RBRACE(i int) antlr.TerminalNode

	// IsConditionExpressionContext differentiates from other interfaces.
	IsConditionExpressionContext()
}

type ConditionExpressionContext struct {
	antlr.BaseParserRuleContext
	parser antlr.Parser
}

func NewEmptyConditionExpressionContext() *ConditionExpressionContext {
	var p = new(ConditionExpressionContext)
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditionExpression
	return p
}

func InitEmptyConditionExpressionContext(p *ConditionExpressionContext)  {
	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, nil, -1)
	p.RuleIndex = OpenFGAParserRULE_conditionExpression
}

func (*ConditionExpressionContext) IsConditionExpressionContext() {}

func NewConditionExpressionContext(parser antlr.Parser, parent antlr.ParserRuleContext, invokingState int) *ConditionExpressionContext {
	var p = new(ConditionExpressionContext)

	antlr.InitBaseParserRuleContext(&p.BaseParserRuleContext, parent, invokingState)

	p.parser = parser
	p.RuleIndex = OpenFGAParserRULE_conditionExpression

	return p
}

func (s *ConditionExpressionContext) GetParser() antlr.Parser { return s.parser }

func (s *ConditionExpressionContext) AllIDENTIFIER() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserIDENTIFIER)
}

func (s *ConditionExpressionContext) IDENTIFIER(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserIDENTIFIER, i)
}

func (s *ConditionExpressionContext) AllEQUALS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserEQUALS)
}

func (s *ConditionExpressionContext) EQUALS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserEQUALS, i)
}

func (s *ConditionExpressionContext) AllNOT_EQUALS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNOT_EQUALS)
}

func (s *ConditionExpressionContext) NOT_EQUALS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNOT_EQUALS, i)
}

func (s *ConditionExpressionContext) AllIN() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserIN)
}

func (s *ConditionExpressionContext) IN(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserIN, i)
}

func (s *ConditionExpressionContext) AllLESS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLESS)
}

func (s *ConditionExpressionContext) LESS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLESS, i)
}

func (s *ConditionExpressionContext) AllLESS_EQUALS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLESS_EQUALS)
}

func (s *ConditionExpressionContext) LESS_EQUALS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLESS_EQUALS, i)
}

func (s *ConditionExpressionContext) AllGREATER_EQUALS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserGREATER_EQUALS)
}

func (s *ConditionExpressionContext) GREATER_EQUALS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserGREATER_EQUALS, i)
}

func (s *ConditionExpressionContext) AllGREATER() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserGREATER)
}

func (s *ConditionExpressionContext) GREATER(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserGREATER, i)
}

func (s *ConditionExpressionContext) AllLOGICAL_AND() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLOGICAL_AND)
}

func (s *ConditionExpressionContext) LOGICAL_AND(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLOGICAL_AND, i)
}

func (s *ConditionExpressionContext) AllLOGICAL_OR() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLOGICAL_OR)
}

func (s *ConditionExpressionContext) LOGICAL_OR(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLOGICAL_OR, i)
}

func (s *ConditionExpressionContext) AllLBRACKET() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLBRACKET)
}

func (s *ConditionExpressionContext) LBRACKET(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLBRACKET, i)
}

func (s *ConditionExpressionContext) AllRPRACKET() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserRPRACKET)
}

func (s *ConditionExpressionContext) RPRACKET(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRPRACKET, i)
}

func (s *ConditionExpressionContext) AllLBRACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLBRACE)
}

func (s *ConditionExpressionContext) LBRACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLBRACE, i)
}

func (s *ConditionExpressionContext) AllLPAREN() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserLPAREN)
}

func (s *ConditionExpressionContext) LPAREN(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserLPAREN, i)
}

func (s *ConditionExpressionContext) AllRPAREN() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserRPAREN)
}

func (s *ConditionExpressionContext) RPAREN(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRPAREN, i)
}

func (s *ConditionExpressionContext) AllDOT() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserDOT)
}

func (s *ConditionExpressionContext) DOT(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserDOT, i)
}

func (s *ConditionExpressionContext) AllMINUS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserMINUS)
}

func (s *ConditionExpressionContext) MINUS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserMINUS, i)
}

func (s *ConditionExpressionContext) AllEXCLAM() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserEXCLAM)
}

func (s *ConditionExpressionContext) EXCLAM(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserEXCLAM, i)
}

func (s *ConditionExpressionContext) AllQUESTIONMARK() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserQUESTIONMARK)
}

func (s *ConditionExpressionContext) QUESTIONMARK(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserQUESTIONMARK, i)
}

func (s *ConditionExpressionContext) AllPLUS() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserPLUS)
}

func (s *ConditionExpressionContext) PLUS(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserPLUS, i)
}

func (s *ConditionExpressionContext) AllSTAR() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserSTAR)
}

func (s *ConditionExpressionContext) STAR(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSTAR, i)
}

func (s *ConditionExpressionContext) AllSLASH() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserSLASH)
}

func (s *ConditionExpressionContext) SLASH(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSLASH, i)
}

func (s *ConditionExpressionContext) AllPERCENT() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserPERCENT)
}

func (s *ConditionExpressionContext) PERCENT(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserPERCENT, i)
}

func (s *ConditionExpressionContext) AllCEL_TRUE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserCEL_TRUE)
}

func (s *ConditionExpressionContext) CEL_TRUE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCEL_TRUE, i)
}

func (s *ConditionExpressionContext) AllCEL_FALSE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserCEL_FALSE)
}

func (s *ConditionExpressionContext) CEL_FALSE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCEL_FALSE, i)
}

func (s *ConditionExpressionContext) AllNUL() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNUL)
}

func (s *ConditionExpressionContext) NUL(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNUL, i)
}

func (s *ConditionExpressionContext) AllWHITESPACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserWHITESPACE)
}

func (s *ConditionExpressionContext) WHITESPACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserWHITESPACE, i)
}

func (s *ConditionExpressionContext) AllCEL_COMMENT() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserCEL_COMMENT)
}

func (s *ConditionExpressionContext) CEL_COMMENT(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserCEL_COMMENT, i)
}

func (s *ConditionExpressionContext) AllNUM_FLOAT() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNUM_FLOAT)
}

func (s *ConditionExpressionContext) NUM_FLOAT(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNUM_FLOAT, i)
}

func (s *ConditionExpressionContext) AllNUM_INT() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNUM_INT)
}

func (s *ConditionExpressionContext) NUM_INT(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNUM_INT, i)
}

func (s *ConditionExpressionContext) AllNUM_UINT() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNUM_UINT)
}

func (s *ConditionExpressionContext) NUM_UINT(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNUM_UINT, i)
}

func (s *ConditionExpressionContext) AllSTRING() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserSTRING)
}

func (s *ConditionExpressionContext) STRING(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserSTRING, i)
}

func (s *ConditionExpressionContext) AllBYTES() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserBYTES)
}

func (s *ConditionExpressionContext) BYTES(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserBYTES, i)
}

func (s *ConditionExpressionContext) AllNEWLINE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserNEWLINE)
}

func (s *ConditionExpressionContext) NEWLINE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserNEWLINE, i)
}

func (s *ConditionExpressionContext) AllRBRACE() []antlr.TerminalNode {
	return s.GetTokens(OpenFGAParserRBRACE)
}

func (s *ConditionExpressionContext) RBRACE(i int) antlr.TerminalNode {
	return s.GetToken(OpenFGAParserRBRACE, i)
}

func (s *ConditionExpressionContext) GetRuleContext() antlr.RuleContext {
	return s
}

func (s *ConditionExpressionContext) ToStringTree(ruleNames []string, recog antlr.Recognizer) string {
	return antlr.TreesStringTree(s, ruleNames, recog)
}


func (s *ConditionExpressionContext) EnterRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.EnterConditionExpression(s)
	}
}

func (s *ConditionExpressionContext) ExitRule(listener antlr.ParseTreeListener) {
	if listenerT, ok := listener.(OpenFGAParserListener); ok {
		listenerT.ExitConditionExpression(s)
	}
}




func (p *OpenFGAParser) ConditionExpression() (localctx IConditionExpressionContext) {
	localctx = NewConditionExpressionContext(p, p.GetParserRuleContext(), p.GetState())
	p.EnterRule(localctx, 52, OpenFGAParserRULE_conditionExpression)
	var _la int

	var _alt int

	p.EnterOuterAlt(localctx, 1)
	p.SetState(388)
	p.GetErrorHandler().Sync(p)
	if p.HasError() {
		goto errorExit
	}
	_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 65, p.GetParserRuleContext())
	if p.HasError() {
		goto errorExit
	}
	for _alt != 2 && _alt != antlr.ATNInvalidAltNumber {
		if _alt == 1 {
			p.SetState(386)
			p.GetErrorHandler().Sync(p)
			if p.HasError() {
				goto errorExit
			}

			switch p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 64, p.GetParserRuleContext()) {
			case 1:
				{
					p.SetState(384)
					_la = p.GetTokenStream().LA(1)

					if !(((int64(_la) & ^0x3f) == 0 && ((int64(1) << _la) & 54043126674753464) != 0)) {
						p.GetErrorHandler().RecoverInline(p)
					} else {
						p.GetErrorHandler().ReportMatch(p)
						p.Consume()
					}
				}


			case 2:
				{
					p.SetState(385)
					_la = p.GetTokenStream().LA(1)

					if _la <= 0 || _la == OpenFGAParserRBRACE  {
						p.GetErrorHandler().RecoverInline(p)
					} else {
						p.GetErrorHandler().ReportMatch(p)
						p.Consume()
					}
				}

			case antlr.ATNInvalidAltNumber:
				goto errorExit
			}

		}
		p.SetState(390)
		p.GetErrorHandler().Sync(p)
		if p.HasError() {
	    	goto errorExit
	    }
		_alt = p.GetInterpreter().AdaptivePredict(p.BaseParser, p.GetTokenStream(), 65, p.GetParserRuleContext())
		if p.HasError() {
			goto errorExit
		}
	}



errorExit:
	if p.HasError() {
		v := p.GetError()
		localctx.SetException(v)
		p.GetErrorHandler().ReportError(p, v)
		p.GetErrorHandler().Recover(p, v)
		p.SetError(nil)
	}
	p.ExitRule()
	return localctx
	goto errorExit // Trick to prevent compiler error if the label is not used
}


