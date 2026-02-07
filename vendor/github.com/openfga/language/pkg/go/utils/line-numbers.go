package utils

import (
	"slices"
	"strings"
)

func GetConditionLineNumber(conditionName string, lines []string) int {
	return slices.IndexFunc(lines, func(line string) bool {
		return strings.HasPrefix(strings.TrimSpace(line), "condition "+conditionName)
	})
}

func GetTypeLineNumber(typeName string, lines []string) int {
	return slices.IndexFunc(lines, func(line string) bool {
		return strings.HasPrefix(strings.TrimSpace(line), "type "+typeName)
	})
}

func GetExtendedTypeLineNumber(typeName string, lines []string) int {
	return slices.IndexFunc(lines, func(line string) bool {
		return strings.HasPrefix(strings.TrimSpace(line), "extend type "+typeName)
	})
}

func GetRelationLineNumber(relation string, lines []string) int {
	return slices.IndexFunc(lines, func(line string) bool {
		return strings.HasPrefix(strings.TrimSpace(line), "define "+relation)
	})
}

type StartEnd struct {
	Start int
	End   int
}

func ConstructLineAndColumnData(lines []string, lineIndex int, symbol string) (StartEnd, StartEnd) {
	if len(lines) == 0 || lineIndex == -1 {
		return StartEnd{
				Start: 0,
				End:   0,
			},
			StartEnd{
				Start: 0,
				End:   0,
			}
	}

	rawLine := lines[lineIndex]

	wordIdx := strings.Index(rawLine, symbol)

	if wordIdx == -1 {
		wordIdx = 0
	}

	return StartEnd{
			Start: lineIndex,
			End:   lineIndex,
		},
		StartEnd{
			Start: wordIdx,
			End:   wordIdx + len(symbol),
		}
}
