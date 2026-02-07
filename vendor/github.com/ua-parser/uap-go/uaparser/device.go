package uaparser

import "strings"

type Device struct {
	Family string
	Brand  string
	Model  string
}

func (parser *deviceParser) Match(line string, dvc *Device) {
	matches := parser.Reg.FindStringSubmatchIndex(line)

	if len(matches) == 0 {
		return
	}

	dvc.Family = string(parser.Reg.ExpandString(nil, parser.DeviceReplacement, line, matches))
	dvc.Family = strings.TrimSpace(dvc.Family)

	dvc.Brand = string(parser.Reg.ExpandString(nil, parser.BrandReplacement, line, matches))
	dvc.Brand = strings.TrimSpace(dvc.Brand)

	dvc.Model = string(parser.Reg.ExpandString(nil, parser.ModelReplacement, line, matches))
	dvc.Model = strings.TrimSpace(dvc.Model)
}

func (dvc *Device) ToString() string {
	return dvc.Family
}
