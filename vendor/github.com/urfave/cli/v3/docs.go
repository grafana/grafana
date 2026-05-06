package cli

import (
	"fmt"
	"os"
	"runtime"
	"strings"
)

func prefixFor(name string) (prefix string) {
	if len(name) == 1 {
		prefix = "-"
	} else {
		prefix = "--"
	}

	return
}

// Returns the placeholder, if any, and the unquoted usage string.
func unquoteUsage(usage string) (string, string) {
	for i := 0; i < len(usage); i++ {
		if usage[i] == '`' {
			for j := i + 1; j < len(usage); j++ {
				if usage[j] == '`' {
					name := usage[i+1 : j]
					usage = usage[:i] + name + usage[j+1:]
					return name, usage
				}
			}
			break
		}
	}
	return "", usage
}

func prefixedNames(names []string, placeholder string) string {
	var prefixed string
	for i, name := range names {
		if name == "" {
			continue
		}

		prefixed += prefixFor(name) + name
		if placeholder != "" {
			prefixed += " " + placeholder
		}
		if i < len(names)-1 {
			prefixed += ", "
		}
	}
	return prefixed
}

func envFormat(envVars []string, prefix, sep, suffix string) string {
	if len(envVars) > 0 {
		return fmt.Sprintf(" [%s%s%s]", prefix, strings.Join(envVars, sep), suffix)
	}
	return ""
}

func defaultEnvFormat(envVars []string) string {
	return envFormat(envVars, "$", ", $", "")
}

func withEnvHint(envVars []string, str string) string {
	envText := ""
	if runtime.GOOS != "windows" || os.Getenv("PSHOME") != "" {
		envText = defaultEnvFormat(envVars)
	} else {
		envText = envFormat(envVars, "%", "%, %", "%")
	}
	return str + envText
}

func withFileHint(filePath, str string) string {
	fileText := ""
	if filePath != "" {
		fileText = fmt.Sprintf(" [%s]", filePath)
	}
	return str + fileText
}

func formatDefault(format string) string {
	return " (default: " + format + ")"
}

func stringifyFlag(f Flag) string {
	// enforce DocGeneration interface on flags to avoid reflection
	df, ok := f.(DocGenerationFlag)
	if !ok {
		return ""
	}
	placeholder, usage := unquoteUsage(df.GetUsage())
	needsPlaceholder := df.TakesValue()
	// if needsPlaceholder is true, placeholder is empty
	if needsPlaceholder && placeholder == "" {
		// try to get type from flag
		if tname := df.TypeName(); tname != "" {
			placeholder = tname
		} else {
			placeholder = defaultPlaceholder
		}
	}

	defaultValueString := ""

	// don't print default text for required flags
	if rf, ok := f.(RequiredFlag); !ok || !rf.IsRequired() {
		isVisible := df.IsDefaultVisible()
		if s := df.GetDefaultText(); isVisible && s != "" {
			defaultValueString = fmt.Sprintf(formatDefault("%s"), s)
		}
	}

	usageWithDefault := strings.TrimSpace(usage + defaultValueString)

	pn := prefixedNames(f.Names(), placeholder)
	sliceFlag, ok := f.(DocGenerationMultiValueFlag)
	if ok && sliceFlag.IsMultiValueFlag() {
		pn = pn + " [ " + pn + " ]"
	}

	return withEnvHint(df.GetEnvVars(), fmt.Sprintf("%s\t%s", pn, usageWithDefault))
}
