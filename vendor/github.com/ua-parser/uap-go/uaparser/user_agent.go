package uaparser

type UserAgent struct {
	Family string
	Major  string
	Minor  string
	Patch  string
}

func (parser *uaParser) Match(line string, ua *UserAgent) {
	matches := parser.Reg.FindStringSubmatchIndex(line)
	if len(matches) > 0 {
		ua.Family = string(parser.Reg.ExpandString(nil, parser.FamilyReplacement, line, matches))
		ua.Major = string(parser.Reg.ExpandString(nil, parser.V1Replacement, line, matches))
		ua.Minor = string(parser.Reg.ExpandString(nil, parser.V2Replacement, line, matches))
		ua.Patch = string(parser.Reg.ExpandString(nil, parser.V3Replacement, line, matches))
	}
}

func (ua *UserAgent) ToString() string {
	var str string
	if ua.Family != "" {
		str += ua.Family
	}
	version := ua.ToVersionString()
	if version != "" {
		str += " " + version
	}
	return str
}

func (ua *UserAgent) ToVersionString() string {
	var version string
	if ua.Major != "" {
		version += ua.Major
	}
	if ua.Minor != "" {
		version += "." + ua.Minor
	}
	if ua.Patch != "" {
		version += "." + ua.Patch
	}
	return version
}
