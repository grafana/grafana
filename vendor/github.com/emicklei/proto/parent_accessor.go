// Copyright (c) 2018 Ernest Micklei
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package proto

func getParent(child Visitee) Visitee {
	if child == nil {
		return nil
	}
	pa := new(parentAccessor)
	child.Accept(pa)
	return pa.parent
}

type parentAccessor struct {
	parent Visitee
}

func (p *parentAccessor) VisitMessage(m *Message) {
	p.parent = m.Parent
}
func (p *parentAccessor) VisitService(v *Service) {
	p.parent = v.Parent
}
func (p *parentAccessor) VisitSyntax(s *Syntax) {
	p.parent = s.Parent
}
func (p *parentAccessor) VisitPackage(pkg *Package) {
	p.parent = pkg.Parent
}
func (p *parentAccessor) VisitOption(o *Option) {
	p.parent = o.Parent
}
func (p *parentAccessor) VisitImport(i *Import) {
	p.parent = i.Parent
}
func (p *parentAccessor) VisitNormalField(i *NormalField) {
	p.parent = i.Parent
}
func (p *parentAccessor) VisitEnumField(i *EnumField) {
	p.parent = i.Parent
}
func (p *parentAccessor) VisitEnum(e *Enum) {
	p.parent = e.Parent
}
func (p *parentAccessor) VisitComment(e *Comment) {}
func (p *parentAccessor) VisitOneof(o *Oneof) {
	p.parent = o.Parent
}
func (p *parentAccessor) VisitOneofField(o *OneOfField) {
	p.parent = o.Parent
}
func (p *parentAccessor) VisitReserved(rs *Reserved) {
	p.parent = rs.Parent
}
func (p *parentAccessor) VisitRPC(rpc *RPC) {
	p.parent = rpc.Parent
}
func (p *parentAccessor) VisitMapField(f *MapField) {
	p.parent = f.Parent
}
func (p *parentAccessor) VisitGroup(g *Group) {
	p.parent = g.Parent
}
func (p *parentAccessor) VisitExtensions(e *Extensions) {
	p.parent = e.Parent
}
func (p *parentAccessor) VisitEdition(e *Edition) {
	p.parent = e.Parent
}
func (p *parentAccessor) VisitProto(*Proto) {}
