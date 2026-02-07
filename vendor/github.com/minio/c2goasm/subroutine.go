/*
 * Minio Cloud Storage, (C) 2017 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

var regexpRet = regexp.MustCompile(`^\s*ret`)

type Subroutine struct {
	name     string
	body     []string
	epilogue Epilogue
	table    Table
}

type Global struct {
	dotGlobalLine   int
	globalName      string
	globalLabelLine int
}

var globlRe = regexp.MustCompile(`^\s*.globl\s+([^\s]+)\s*.*`)

func splitOnGlobals(lines []string) []Global {

	var result []Global

	for index, line := range lines {
		if globlRe.MatchString(line) {
			match := globlRe.FindStringSubmatch(line)
			scrambled := match[1]
			name := extractName(scrambled)

			labelLine := findLabel(lines, scrambled)

			result = append(result, Global{dotGlobalLine: index, globalName: name, globalLabelLine: labelLine})
		}
	}

	return result
}

// Segment the source into multiple routines
func segmentSource(src []string) []Subroutine {

	globals := splitOnGlobals(src)

	if len(globals) == 0 {
		return []Subroutine{}
	}

	subroutines := []Subroutine{}

	splitBegin := globals[0].dotGlobalLine
	for iglobal, global := range globals {
		splitEnd := len(src)
		if iglobal < len(globals)-1 {
			splitEnd = globals[iglobal+1].dotGlobalLine
		}

		// Search for `ret` statement
		for lineRet := splitBegin; lineRet < splitEnd; lineRet++ {
			if match := regexpRet.FindStringSubmatch(src[lineRet]); len(match) > 0 {

				newsub := extractSubroutine(lineRet, src, global)

				subroutines = append(subroutines, newsub)

				break
			}
		}

		splitBegin = splitEnd
	}

	return subroutines
}

var disabledForTesting = false

func extractSubroutine(lineRet int, src []string, global Global) Subroutine {

	bodyStart := global.globalLabelLine + 1
	bodyEnd := lineRet + 1

	// loop until all missing labels are found
	for !disabledForTesting {
		missingLabels := getMissingLabels(src[bodyStart:bodyEnd])

		if len(missingLabels) == 0 {
			break
		}

		// add the missing lines in order to find the missing labels
		postEpilogueLines := getMissingLines(src, bodyEnd-1, missingLabels)

		bodyEnd += postEpilogueLines
	}

	subroutine := Subroutine{
		name:     global.globalName,
		body:     src[bodyStart:bodyEnd],
		epilogue: extractEpilogue(src[bodyStart:bodyEnd]),
	}

	// Remove prologue lines from subroutine
	subroutine.removePrologueLines(src, bodyStart, bodyEnd)

	return subroutine
}

func (s *Subroutine) removePrologueLines(src []string, bodyStart int, bodyEnd int) {

	prologueLines := getPrologueLines(src[bodyStart:bodyEnd], &s.epilogue)

	// Remove prologue lines from body
	s.body = s.body[prologueLines:]

	// Adjust range of epilogue accordingly
	s.epilogue.Start -= prologueLines
	s.epilogue.End -= prologueLines
}

func extractEpilogue(src []string) Epilogue {

	for iline, line := range src {

		if match := regexpRet.FindStringSubmatch(line); len(match) > 0 {

			// Found closing ret statement, start searching back to first non epilogue instruction
			epilogueStart := iline
			for ; epilogueStart >= 0; epilogueStart-- {
				if !isEpilogueInstruction(src[epilogueStart]) {
					epilogueStart++
					break
				}
			}

			epilogue := extractEpilogueInfo(src, epilogueStart, iline+1)

			return epilogue
		}
	}

	panic("Failed to find 'ret' instruction")
}

func getMissingLabels(src []string) map[string]bool {

	labelMap := make(map[string]bool)
	jumpMap := make(map[string]bool)

	for _, line := range src {

		line, _ := stripComments(line)
		if _, label := fixLabels(line); label != "" {
			labelMap[label] = true
		}
		if _, _, label := upperCaseJumps(line); label != "" {
			jumpMap[label] = true
		}

	}

	for label, _ := range labelMap {
		if _, ok := jumpMap[label]; ok {
			delete(jumpMap, label)
		}
	}

	return jumpMap
}

func getMissingLines(src []string, lineRet int, missingLabels map[string]bool) int {

	var iline int
	// first scan until we've found the missing labels
	for iline = lineRet; len(missingLabels) > 0 && iline < len(src); iline++ {
		line, _ := stripComments(src[iline])
		_, label := fixLabels(line)
		if label != "" {
			if _, ok := missingLabels[label]; ok {
				delete(missingLabels, label)
			}
		}
	}
	// then scan until we find an (unconditional) JMP
	for ; iline < len(src); iline++ {
		line, _ := stripComments(src[iline])
		_, jump, _ := upperCaseJumps(line)
		if jump == "JMP" {
			break
		}
	}

	return iline - lineRet
}

func getPrologueLines(lines []string, epilogue *Epilogue) int {

	index, line := 0, ""

	for index, line = range lines {

		var skip bool
		line, skip = stripComments(line) // Remove ## comments
		if skip {
			continue
		}

		if !epilogue.isPrologueInstruction(line) {
			break
		}
	}

	return index
}

func findLabel(lines []string, label string) int {

	labelDef := label + ":"

	for index, line := range lines {
		if strings.HasPrefix(line, labelDef) {
			return index
		}
	}

	panic(fmt.Sprintf("Failed to find label: %s", labelDef))
}

func extractNamePart(part string) (int, string) {

	digits := 0
	for _, d := range part {
		if unicode.IsDigit(d) {
			digits += 1
		} else {
			break
		}
	}
	length, _ := strconv.Atoi(part[:digits])
	return digits + length, part[digits:(digits + length)]
}

func extractName(name string) string {

	// Only proceed for C++ mangled names
	if !(strings.HasPrefix(name, "_ZN") || strings.HasPrefix(name, "__Z")) {
		return name
	}

	var parts []string

	// Parse C++ mangled name in the form of '_ZN4Simd4Avx213Yuv444pToBgraEPKhmS2_mS2_mmmPhmh'
	for index, ch := range name {
		if unicode.IsDigit(ch) {

			for index < len(name) {
				size, part := extractNamePart(name[index:])
				if size == 0 {
					break
				}

				parts = append(parts, part)
				index += size
			}

			break
		}
	}

	return strings.Join(parts, "")
}
