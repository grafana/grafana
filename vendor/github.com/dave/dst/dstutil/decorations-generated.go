package dstutil

import "github.com/dave/dst"

func decorations(n dst.Node) (before, after dst.SpaceType, points []DecorationPoint) {
	switch n := n.(type) {
	case *dst.ArrayType:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Lbrack", n.Decs.Lbrack})
		points = append(points, DecorationPoint{"Len", n.Decs.Len})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.AssignStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Tok", n.Decs.Tok})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BadDecl:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BadExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BadStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BasicLit:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BinaryExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"Op", n.Decs.Op})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BlockStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Lbrace", n.Decs.Lbrace})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.BranchStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Tok", n.Decs.Tok})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.CallExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Fun", n.Decs.Fun})
		points = append(points, DecorationPoint{"Lparen", n.Decs.Lparen})
		points = append(points, DecorationPoint{"Ellipsis", n.Decs.Ellipsis})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.CaseClause:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Case", n.Decs.Case})
		points = append(points, DecorationPoint{"Colon", n.Decs.Colon})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.ChanType:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Begin", n.Decs.Begin})
		points = append(points, DecorationPoint{"Arrow", n.Decs.Arrow})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.CommClause:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Case", n.Decs.Case})
		points = append(points, DecorationPoint{"Comm", n.Decs.Comm})
		points = append(points, DecorationPoint{"Colon", n.Decs.Colon})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.CompositeLit:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Type", n.Decs.Type})
		points = append(points, DecorationPoint{"Lbrace", n.Decs.Lbrace})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.DeclStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.DeferStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Defer", n.Decs.Defer})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.Ellipsis:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Ellipsis", n.Decs.Ellipsis})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.EmptyStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.ExprStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.Field:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Type", n.Decs.Type})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.FieldList:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Opening", n.Decs.Opening})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.File:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Package", n.Decs.Package})
		points = append(points, DecorationPoint{"Name", n.Decs.Name})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.ForStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"For", n.Decs.For})
		points = append(points, DecorationPoint{"Init", n.Decs.Init})
		points = append(points, DecorationPoint{"Cond", n.Decs.Cond})
		points = append(points, DecorationPoint{"Post", n.Decs.Post})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.FuncDecl:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Func", n.Decs.Func})
		points = append(points, DecorationPoint{"Recv", n.Decs.Recv})
		points = append(points, DecorationPoint{"Name", n.Decs.Name})
		points = append(points, DecorationPoint{"TypeParams", n.Decs.TypeParams})
		points = append(points, DecorationPoint{"Params", n.Decs.Params})
		points = append(points, DecorationPoint{"Results", n.Decs.Results})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.FuncLit:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Type", n.Decs.Type})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.FuncType:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Func", n.Decs.Func})
		points = append(points, DecorationPoint{"TypeParams", n.Decs.TypeParams})
		points = append(points, DecorationPoint{"Params", n.Decs.Params})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.GenDecl:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Tok", n.Decs.Tok})
		points = append(points, DecorationPoint{"Lparen", n.Decs.Lparen})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.GoStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Go", n.Decs.Go})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.Ident:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.IfStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"If", n.Decs.If})
		points = append(points, DecorationPoint{"Init", n.Decs.Init})
		points = append(points, DecorationPoint{"Cond", n.Decs.Cond})
		points = append(points, DecorationPoint{"Else", n.Decs.Else})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.ImportSpec:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Name", n.Decs.Name})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.IncDecStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.IndexExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"Lbrack", n.Decs.Lbrack})
		points = append(points, DecorationPoint{"Index", n.Decs.Index})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.IndexListExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"Lbrack", n.Decs.Lbrack})
		points = append(points, DecorationPoint{"Indices", n.Decs.Indices})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.InterfaceType:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Interface", n.Decs.Interface})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.KeyValueExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Key", n.Decs.Key})
		points = append(points, DecorationPoint{"Colon", n.Decs.Colon})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.LabeledStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Label", n.Decs.Label})
		points = append(points, DecorationPoint{"Colon", n.Decs.Colon})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.MapType:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Map", n.Decs.Map})
		points = append(points, DecorationPoint{"Key", n.Decs.Key})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.Package:
	case *dst.ParenExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Lparen", n.Decs.Lparen})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.RangeStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"For", n.Decs.For})
		points = append(points, DecorationPoint{"Key", n.Decs.Key})
		points = append(points, DecorationPoint{"Value", n.Decs.Value})
		points = append(points, DecorationPoint{"Range", n.Decs.Range})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.ReturnStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Return", n.Decs.Return})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.SelectStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Select", n.Decs.Select})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.SelectorExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.SendStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Chan", n.Decs.Chan})
		points = append(points, DecorationPoint{"Arrow", n.Decs.Arrow})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.SliceExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"Lbrack", n.Decs.Lbrack})
		points = append(points, DecorationPoint{"Low", n.Decs.Low})
		points = append(points, DecorationPoint{"High", n.Decs.High})
		points = append(points, DecorationPoint{"Max", n.Decs.Max})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.StarExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Star", n.Decs.Star})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.StructType:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Struct", n.Decs.Struct})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.SwitchStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Switch", n.Decs.Switch})
		points = append(points, DecorationPoint{"Init", n.Decs.Init})
		points = append(points, DecorationPoint{"Tag", n.Decs.Tag})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.TypeAssertExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"X", n.Decs.X})
		points = append(points, DecorationPoint{"Lparen", n.Decs.Lparen})
		points = append(points, DecorationPoint{"Type", n.Decs.Type})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.TypeSpec:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Name", n.Decs.Name})
		points = append(points, DecorationPoint{"TypeParams", n.Decs.TypeParams})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.TypeSwitchStmt:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Switch", n.Decs.Switch})
		points = append(points, DecorationPoint{"Init", n.Decs.Init})
		points = append(points, DecorationPoint{"Assign", n.Decs.Assign})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.UnaryExpr:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Op", n.Decs.Op})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	case *dst.ValueSpec:
		before = n.Decs.Before
		after = n.Decs.After
		points = append(points, DecorationPoint{"Start", n.Decs.Start})
		points = append(points, DecorationPoint{"Assign", n.Decs.Assign})
		points = append(points, DecorationPoint{"End", n.Decs.End})
	}
	return
}
