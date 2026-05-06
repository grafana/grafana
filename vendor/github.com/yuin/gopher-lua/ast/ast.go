package ast

type PositionHolder interface {
	Line() int
	SetLine(int)
	LastLine() int
	SetLastLine(int)
}

type Node struct {
	line     int
	lastline int
}

func (self *Node) Line() int {
	return self.line
}

func (self *Node) SetLine(line int) {
	self.line = line
}

func (self *Node) LastLine() int {
	return self.lastline
}

func (self *Node) SetLastLine(line int) {
	self.lastline = line
}
