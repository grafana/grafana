// Copyright (c) 2022 Ernest Micklei
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

// NoopVisitor is a no-operation visitor that can be used when creating your own visitor that is interested in only one or a few types.
// It implements the Visitor interface.
type NoopVisitor struct{}

// VisitMessage is part of Visitor interface
func (n NoopVisitor) VisitMessage(m *Message) {}

// VisitService is part of Visitor interface
func (n NoopVisitor) VisitService(v *Service) {}

// VisitSyntax is part of Visitor interface
func (n NoopVisitor) VisitSyntax(s *Syntax) {}

// VisitPackage is part of Visitor interface
func (n NoopVisitor) VisitPackage(p *Package) {}

// VisitOption is part of Visitor interface
func (n NoopVisitor) VisitOption(o *Option) {}

// VisitImport is part of Visitor interface
func (n NoopVisitor) VisitImport(i *Import) {}

// VisitNormalField is part of Visitor interface
func (n NoopVisitor) VisitNormalField(i *NormalField) {}

// VisitEnumField is part of Visitor interface
func (n NoopVisitor) VisitEnumField(i *EnumField) {}

// VisitEnum is part of Visitor interface
func (n NoopVisitor) VisitEnum(e *Enum) {}

// VisitComment is part of Visitor interface
func (n NoopVisitor) VisitComment(e *Comment) {}

// VisitOneof is part of Visitor interface
func (n NoopVisitor) VisitOneof(o *Oneof) {}

// VisitOneofField is part of Visitor interface
func (n NoopVisitor) VisitOneofField(o *OneOfField) {}

// VisitReserved is part of Visitor interface
func (n NoopVisitor) VisitReserved(r *Reserved) {}

// VisitRPC is part of Visitor interface
func (n NoopVisitor) VisitRPC(r *RPC) {}

// VisitMapField is part of Visitor interface
func (n NoopVisitor) VisitMapField(f *MapField) {}

// VisitGroup is part of Visitor interface
func (n NoopVisitor) VisitGroup(g *Group) {}

// VisitExtensions is part of Visitor interface
func (n NoopVisitor) VisitExtensions(e *Extensions) {}
