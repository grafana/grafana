package uaparser

type Os struct {
	Family     string
	Major      string
	Minor      string
	Patch      string
	PatchMinor string `yaml:"patch_minor"`
}

func (parser *osParser) Match(line string, os *Os) {
	matches := parser.Reg.FindStringSubmatchIndex(line)
	if len(matches) > 0 {
		os.Family = string(parser.Reg.ExpandString(nil, parser.OSReplacement, line, matches))
		os.Major = string(parser.Reg.ExpandString(nil, parser.V1Replacement, line, matches))
		os.Minor = string(parser.Reg.ExpandString(nil, parser.V2Replacement, line, matches))
		os.Patch = string(parser.Reg.ExpandString(nil, parser.V3Replacement, line, matches))
		os.PatchMinor = string(parser.Reg.ExpandString(nil, parser.V4Replacement, line, matches))
	}
}

func (os *Os) ToString() string {
	var str string
	if os.Family != "" {
		str += os.Family
	}
	version := os.ToVersionString()
	if version != "" {
		str += " " + version
	}
	return str
}

func (os *Os) ToVersionString() string {
	var version string
	if os.Major != "" {
		version += os.Major
	}
	if os.Minor != "" {
		version += "." + os.Minor
	}
	if os.Patch != "" {
		version += "." + os.Patch
	}
	if os.PatchMinor != "" {
		version += "." + os.PatchMinor
	}
	return version
}
