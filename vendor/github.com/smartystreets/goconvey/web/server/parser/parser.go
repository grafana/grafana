package parser

import (
	"log"

	"github.com/smartystreets/goconvey/web/server/contract"
)

type Parser struct {
	parser func(*contract.PackageResult, string)
}

func (self *Parser) Parse(packages []*contract.Package) {
	for _, p := range packages {
		if p.Active() && p.HasUsableResult() {
			self.parser(p.Result, p.Output)
		} else if p.Ignored {
			p.Result.Outcome = contract.Ignored
		} else if p.Disabled {
			p.Result.Outcome = contract.Disabled
		} else {
			p.Result.Outcome = contract.TestRunAbortedUnexpectedly
		}
		log.Printf("[%s]: %s\n", p.Result.Outcome, p.Name)
	}
}

func NewParser(helper func(*contract.PackageResult, string)) *Parser {
	self := new(Parser)
	self.parser = helper
	return self
}
