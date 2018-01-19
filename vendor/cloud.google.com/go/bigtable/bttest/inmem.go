/*
Copyright 2015 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/*
Package bttest contains test helpers for working with the bigtable package.

To use a Server, create it, and then connect to it with no security:
(The project/instance values are ignored.)
	srv, err := bttest.NewServer("127.0.0.1:0")
	...
	conn, err := grpc.Dial(srv.Addr, grpc.WithInsecure())
	...
	client, err := bigtable.NewClient(ctx, proj, instance,
	        option.WithGRPCConn(conn))
	...
*/
package bttest // import "cloud.google.com/go/bigtable/bttest"

import (
	"encoding/binary"
	"fmt"
	"log"
	"math/rand"
	"net"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"bytes"

	emptypb "github.com/golang/protobuf/ptypes/empty"
	"github.com/golang/protobuf/ptypes/wrappers"
	"golang.org/x/net/context"
	btapb "google.golang.org/genproto/googleapis/bigtable/admin/v2"
	btpb "google.golang.org/genproto/googleapis/bigtable/v2"
	statpb "google.golang.org/genproto/googleapis/rpc/status"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
)

// Server is an in-memory Cloud Bigtable fake.
// It is unauthenticated, and only a rough approximation.
type Server struct {
	Addr string

	l   net.Listener
	srv *grpc.Server
	s   *server
}

// server is the real implementation of the fake.
// It is a separate and unexported type so the API won't be cluttered with
// methods that are only relevant to the fake's implementation.
type server struct {
	mu     sync.Mutex
	tables map[string]*table // keyed by fully qualified name
	gcc    chan int          // set when gcloop starts, closed when server shuts down

	// Any unimplemented methods will cause a panic.
	btapb.BigtableTableAdminServer
	btpb.BigtableServer
}

// NewServer creates a new Server.
// The Server will be listening for gRPC connections, without TLS,
// on the provided address. The resolved address is named by the Addr field.
func NewServer(laddr string, opt ...grpc.ServerOption) (*Server, error) {
	l, err := net.Listen("tcp", laddr)
	if err != nil {
		return nil, err
	}

	s := &Server{
		Addr: l.Addr().String(),
		l:    l,
		srv:  grpc.NewServer(opt...),
		s: &server{
			tables: make(map[string]*table),
		},
	}
	btapb.RegisterBigtableTableAdminServer(s.srv, s.s)
	btpb.RegisterBigtableServer(s.srv, s.s)

	go s.srv.Serve(s.l)

	return s, nil
}

// Close shuts down the server.
func (s *Server) Close() {
	s.s.mu.Lock()
	if s.s.gcc != nil {
		close(s.s.gcc)
	}
	s.s.mu.Unlock()

	s.srv.Stop()
	s.l.Close()
}

func (s *server) CreateTable(ctx context.Context, req *btapb.CreateTableRequest) (*btapb.Table, error) {
	tbl := req.Parent + "/tables/" + req.TableId

	s.mu.Lock()
	if _, ok := s.tables[tbl]; ok {
		s.mu.Unlock()
		return nil, grpc.Errorf(codes.AlreadyExists, "table %q already exists", tbl)
	}
	s.tables[tbl] = newTable(req)
	s.mu.Unlock()

	return &btapb.Table{Name: tbl}, nil
}

func (s *server) ListTables(ctx context.Context, req *btapb.ListTablesRequest) (*btapb.ListTablesResponse, error) {
	res := &btapb.ListTablesResponse{}
	prefix := req.Parent + "/tables/"

	s.mu.Lock()
	for tbl := range s.tables {
		if strings.HasPrefix(tbl, prefix) {
			res.Tables = append(res.Tables, &btapb.Table{Name: tbl})
		}
	}
	s.mu.Unlock()

	return res, nil
}

func (s *server) GetTable(ctx context.Context, req *btapb.GetTableRequest) (*btapb.Table, error) {
	tbl := req.Name

	s.mu.Lock()
	tblIns, ok := s.tables[tbl]
	s.mu.Unlock()
	if !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", tbl)
	}

	return &btapb.Table{
		Name:           tbl,
		ColumnFamilies: toColumnFamilies(tblIns.columnFamilies()),
	}, nil
}

func (s *server) DeleteTable(ctx context.Context, req *btapb.DeleteTableRequest) (*emptypb.Empty, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.tables[req.Name]; !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", req.Name)
	}
	delete(s.tables, req.Name)
	return &emptypb.Empty{}, nil
}

func (s *server) ModifyColumnFamilies(ctx context.Context, req *btapb.ModifyColumnFamiliesRequest) (*btapb.Table, error) {
	tblName := req.Name[strings.LastIndex(req.Name, "/")+1:]

	s.mu.Lock()
	tbl, ok := s.tables[req.Name]
	s.mu.Unlock()
	if !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", req.Name)
	}

	tbl.mu.Lock()
	defer tbl.mu.Unlock()

	for _, mod := range req.Modifications {
		if create := mod.GetCreate(); create != nil {
			if _, ok := tbl.families[mod.Id]; ok {
				return nil, grpc.Errorf(codes.AlreadyExists, "family %q already exists", mod.Id)
			}
			newcf := &columnFamily{
				name:   req.Name + "/columnFamilies/" + mod.Id,
				order:  tbl.counter,
				gcRule: create.GcRule,
			}
			tbl.counter++
			tbl.families[mod.Id] = newcf
		} else if mod.GetDrop() {
			if _, ok := tbl.families[mod.Id]; !ok {
				return nil, fmt.Errorf("can't delete unknown family %q", mod.Id)
			}
			delete(tbl.families, mod.Id)
		} else if modify := mod.GetUpdate(); modify != nil {
			if _, ok := tbl.families[mod.Id]; !ok {
				return nil, fmt.Errorf("no such family %q", mod.Id)
			}
			newcf := &columnFamily{
				name:   req.Name + "/columnFamilies/" + mod.Id,
				gcRule: modify.GcRule,
			}
			// assume that we ALWAYS want to replace by the new setting
			// we may need partial update through
			tbl.families[mod.Id] = newcf
		}
	}

	s.needGC()
	return &btapb.Table{
		Name:           tblName,
		ColumnFamilies: toColumnFamilies(tbl.families),
	}, nil
}

func (s *server) DropRowRange(ctx context.Context, req *btapb.DropRowRangeRequest) (*emptypb.Empty, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tbl, ok := s.tables[req.Name]
	if !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", req.Name)
	}

	if req.GetDeleteAllDataFromTable() {
		tbl.rows = nil
		tbl.rowIndex = make(map[string]*row)
	} else {
		// Delete rows by prefix
		prefixBytes := req.GetRowKeyPrefix()
		if prefixBytes == nil {
			return nil, fmt.Errorf("missing row key prefix")
		}
		prefix := string(prefixBytes)

		start := -1
		end := 0
		for i, row := range tbl.rows {
			match := strings.HasPrefix(row.key, prefix)
			if match {
				// Delete the mapping. Row will be deleted from sorted range below.
				delete(tbl.rowIndex, row.key)
			}
			if match && start == -1 {
				start = i
			} else if !match && start != -1 {
				break
			}
			end++
		}
		if start != -1 {
			// Delete the range, using method from https://github.com/golang/go/wiki/SliceTricks
			copy(tbl.rows[start:], tbl.rows[end:])
			for k, n := len(tbl.rows)-end+start, len(tbl.rows); k < n; k++ {
				tbl.rows[k] = nil
			}
			tbl.rows = tbl.rows[:len(tbl.rows)-end+start]
		}
	}

	return &emptypb.Empty{}, nil
}

func (s *server) ReadRows(req *btpb.ReadRowsRequest, stream btpb.Bigtable_ReadRowsServer) error {
	s.mu.Lock()
	tbl, ok := s.tables[req.TableName]
	s.mu.Unlock()
	if !ok {
		return grpc.Errorf(codes.NotFound, "table %q not found", req.TableName)
	}

	// Rows to read can be specified by a set of row keys and/or a set of row ranges.
	// Output is a stream of sorted, de-duped rows.
	tbl.mu.RLock()
	rowSet := make(map[string]*row)
	if req.Rows != nil {
		// Add the explicitly given keys
		for _, key := range req.Rows.RowKeys {
			start := string(key)
			addRows(start, start+"\x00", tbl, rowSet)
		}

		// Add keys from row ranges
		for _, rr := range req.Rows.RowRanges {
			var start, end string
			switch sk := rr.StartKey.(type) {
			case *btpb.RowRange_StartKeyClosed:
				start = string(sk.StartKeyClosed)
			case *btpb.RowRange_StartKeyOpen:
				start = string(sk.StartKeyOpen) + "\x00"
			}
			switch ek := rr.EndKey.(type) {
			case *btpb.RowRange_EndKeyClosed:
				end = string(ek.EndKeyClosed) + "\x00"
			case *btpb.RowRange_EndKeyOpen:
				end = string(ek.EndKeyOpen)
			}

			addRows(start, end, tbl, rowSet)
		}
	} else {
		// Read all rows
		addRows("", "", tbl, rowSet)
	}
	tbl.mu.RUnlock()

	rows := make([]*row, 0, len(rowSet))
	for _, r := range rowSet {
		rows = append(rows, r)
	}
	sort.Sort(byRowKey(rows))

	limit := int(req.RowsLimit)
	count := 0
	for _, r := range rows {
		if limit > 0 && count >= limit {
			return nil
		}
		streamed, err := streamRow(stream, r, req.Filter)
		if err != nil {
			return err
		}
		if streamed {
			count++
		}
	}
	return nil
}

func addRows(start, end string, tbl *table, rowSet map[string]*row) {
	si, ei := 0, len(tbl.rows) // half-open interval
	if start != "" {
		si = sort.Search(len(tbl.rows), func(i int) bool { return tbl.rows[i].key >= start })
	}
	if end != "" {
		ei = sort.Search(len(tbl.rows), func(i int) bool { return tbl.rows[i].key >= end })
	}
	if si < ei {
		for _, row := range tbl.rows[si:ei] {
			rowSet[row.key] = row
		}
	}
}

// streamRow filters the given row and sends it via the given stream.
// Returns true if at least one cell matched the filter and was streamed, false otherwise.
func streamRow(stream btpb.Bigtable_ReadRowsServer, r *row, f *btpb.RowFilter) (bool, error) {
	r.mu.Lock()
	nr := r.copy()
	r.mu.Unlock()
	r = nr

	if !filterRow(f, r) {
		return false, nil
	}

	rrr := &btpb.ReadRowsResponse{}
	families := r.sortedFamilies()
	for _, fam := range families {
		for _, colName := range fam.colNames {
			cells := fam.cells[colName]
			if len(cells) == 0 {
				continue
			}
			// TODO(dsymonds): Apply transformers.
			for _, cell := range cells {
				rrr.Chunks = append(rrr.Chunks, &btpb.ReadRowsResponse_CellChunk{
					RowKey:          []byte(r.key),
					FamilyName:      &wrappers.StringValue{Value: fam.name},
					Qualifier:       &wrappers.BytesValue{Value: []byte(colName)},
					TimestampMicros: cell.ts,
					Value:           cell.value,
				})
			}
		}
	}
	// We can't have a cell with just COMMIT set, which would imply a new empty cell.
	// So modify the last cell to have the COMMIT flag set.
	if len(rrr.Chunks) > 0 {
		rrr.Chunks[len(rrr.Chunks)-1].RowStatus = &btpb.ReadRowsResponse_CellChunk_CommitRow{true}
	}

	return true, stream.Send(rrr)
}

// filterRow modifies a row with the given filter. Returns true if at least one cell from the row matches,
// false otherwise.
func filterRow(f *btpb.RowFilter, r *row) bool {
	if f == nil {
		return true
	}
	// Handle filters that apply beyond just including/excluding cells.
	switch f := f.Filter.(type) {
	case *btpb.RowFilter_Chain_:
		for _, sub := range f.Chain.Filters {
			if !filterRow(sub, r) {
				return false
			}
		}
		return true
	case *btpb.RowFilter_Interleave_:
		srs := make([]*row, 0, len(f.Interleave.Filters))
		for _, sub := range f.Interleave.Filters {
			sr := r.copy()
			filterRow(sub, sr)
			srs = append(srs, sr)
		}
		// merge
		// TODO(dsymonds): is this correct?
		r.families = make(map[string]*family)
		for _, sr := range srs {
			for _, fam := range sr.families {
				f := r.getOrCreateFamily(fam.name, fam.order)
				for colName, cs := range fam.cells {
					f.cells[colName] = append(f.cellsByColumn(colName), cs...)
				}
			}
		}
		var count int
		for _, fam := range r.families {
			for _, cs := range fam.cells {
				sort.Sort(byDescTS(cs))
				count += len(cs)
			}
		}
		return count > 0
	case *btpb.RowFilter_CellsPerColumnLimitFilter:
		lim := int(f.CellsPerColumnLimitFilter)
		for _, fam := range r.families {
			for col, cs := range fam.cells {
				if len(cs) > lim {
					fam.cells[col] = cs[:lim]
				}
			}
		}
		return true
	case *btpb.RowFilter_Condition_:
		if filterRow(f.Condition.PredicateFilter, r.copy()) {
			if f.Condition.TrueFilter == nil {
				return false
			}
			return filterRow(f.Condition.TrueFilter, r)
		}
		if f.Condition.FalseFilter == nil {
			return false
		}
		return filterRow(f.Condition.FalseFilter, r)
	case *btpb.RowFilter_RowKeyRegexFilter:
		pat := string(f.RowKeyRegexFilter)
		rx, err := regexp.Compile(pat)
		if err != nil {
			log.Printf("Bad rowkey_regex_filter pattern %q: %v", pat, err)
			return false
		}
		if !rx.MatchString(r.key) {
			return false
		}
	case *btpb.RowFilter_CellsPerRowLimitFilter:
		// Grab the first n cells in the row.
		lim := int(f.CellsPerRowLimitFilter)
		for _, fam := range r.families {
			for _, col := range fam.colNames {
				cs := fam.cells[col]
				if len(cs) > lim {
					fam.cells[col] = cs[:lim]
					lim = 0
				} else {
					lim -= len(cs)
				}
			}
		}
		return true
	case *btpb.RowFilter_CellsPerRowOffsetFilter:
		// Skip the first n cells in the row.
		offset := int(f.CellsPerRowOffsetFilter)
		for _, fam := range r.families {
			for _, col := range fam.colNames {
				cs := fam.cells[col]
				if len(cs) > offset {
					fam.cells[col] = cs[offset:]
					offset = 0
					return true
				} else {
					fam.cells[col] = cs[:0]
					offset -= len(cs)
				}
			}
		}
		return true
	}

	// Any other case, operate on a per-cell basis.
	cellCount := 0
	for _, fam := range r.families {
		for colName, cs := range fam.cells {
			fam.cells[colName] = filterCells(f, fam.name, colName, cs)
			cellCount += len(fam.cells[colName])
		}
	}
	return cellCount > 0
}

func filterCells(f *btpb.RowFilter, fam, col string, cs []cell) []cell {
	var ret []cell
	for _, cell := range cs {
		if includeCell(f, fam, col, cell) {
			cell = modifyCell(f, cell)
			ret = append(ret, cell)
		}
	}
	return ret
}

func modifyCell(f *btpb.RowFilter, c cell) cell {
	if f == nil {
		return c
	}
	// Consider filters that may modify the cell contents
	switch f.Filter.(type) {
	case *btpb.RowFilter_StripValueTransformer:
		return cell{ts: c.ts}
	default:
		return c
	}
}

func includeCell(f *btpb.RowFilter, fam, col string, cell cell) bool {
	if f == nil {
		return true
	}
	// TODO(dsymonds): Implement many more filters.
	switch f := f.Filter.(type) {
	case *btpb.RowFilter_CellsPerColumnLimitFilter:
		// Don't log, row-level filter
		return true
	case *btpb.RowFilter_RowKeyRegexFilter:
		// Don't log, row-level filter
		return true
	case *btpb.RowFilter_StripValueTransformer:
		// Don't log, cell-modifying filter
		return true
	default:
		log.Printf("WARNING: don't know how to handle filter of type %T (ignoring it)", f)
		return true
	case *btpb.RowFilter_FamilyNameRegexFilter:
		pat := string(f.FamilyNameRegexFilter)
		rx, err := regexp.Compile(pat)
		if err != nil {
			log.Printf("Bad family_name_regex_filter pattern %q: %v", pat, err)
			return false
		}
		return rx.MatchString(fam)
	case *btpb.RowFilter_ColumnQualifierRegexFilter:
		pat := string(f.ColumnQualifierRegexFilter)
		rx, err := regexp.Compile(pat)
		if err != nil {
			log.Printf("Bad column_qualifier_regex_filter pattern %q: %v", pat, err)
			return false
		}
		return rx.MatchString(col)
	case *btpb.RowFilter_ValueRegexFilter:
		pat := string(f.ValueRegexFilter)
		rx, err := regexp.Compile(pat)
		if err != nil {
			log.Printf("Bad value_regex_filter pattern %q: %v", pat, err)
			return false
		}
		return rx.Match(cell.value)
	case *btpb.RowFilter_ColumnRangeFilter:
		if fam != f.ColumnRangeFilter.FamilyName {
			return false
		}
		// Start qualifier defaults to empty string closed
		inRangeStart := func() bool { return col >= "" }
		switch sq := f.ColumnRangeFilter.StartQualifier.(type) {
		case *btpb.ColumnRange_StartQualifierOpen:
			inRangeStart = func() bool { return col > string(sq.StartQualifierOpen) }
		case *btpb.ColumnRange_StartQualifierClosed:
			inRangeStart = func() bool { return col >= string(sq.StartQualifierClosed) }
		}
		// End qualifier defaults to no upper boundary
		inRangeEnd := func() bool { return true }
		switch eq := f.ColumnRangeFilter.EndQualifier.(type) {
		case *btpb.ColumnRange_EndQualifierClosed:
			inRangeEnd = func() bool { return col <= string(eq.EndQualifierClosed) }
		case *btpb.ColumnRange_EndQualifierOpen:
			inRangeEnd = func() bool { return col < string(eq.EndQualifierOpen) }
		}
		return inRangeStart() && inRangeEnd()
	case *btpb.RowFilter_TimestampRangeFilter:
		// Lower bound is inclusive and defaults to 0, upper bound is exclusive and defaults to infinity.
		return cell.ts >= f.TimestampRangeFilter.StartTimestampMicros &&
			(f.TimestampRangeFilter.EndTimestampMicros == 0 || cell.ts < f.TimestampRangeFilter.EndTimestampMicros)
	case *btpb.RowFilter_ValueRangeFilter:
		v := cell.value
		// Start value defaults to empty string closed
		inRangeStart := func() bool { return bytes.Compare(v, []byte{}) >= 0 }
		switch sv := f.ValueRangeFilter.StartValue.(type) {
		case *btpb.ValueRange_StartValueOpen:
			inRangeStart = func() bool { return bytes.Compare(v, sv.StartValueOpen) > 0 }
		case *btpb.ValueRange_StartValueClosed:
			inRangeStart = func() bool { return bytes.Compare(v, sv.StartValueClosed) >= 0 }
		}
		// End value defaults to no upper boundary
		inRangeEnd := func() bool { return true }
		switch ev := f.ValueRangeFilter.EndValue.(type) {
		case *btpb.ValueRange_EndValueClosed:
			inRangeEnd = func() bool { return bytes.Compare(v, ev.EndValueClosed) <= 0 }
		case *btpb.ValueRange_EndValueOpen:
			inRangeEnd = func() bool { return bytes.Compare(v, ev.EndValueOpen) < 0 }
		}
		return inRangeStart() && inRangeEnd()
	}
}

func (s *server) MutateRow(ctx context.Context, req *btpb.MutateRowRequest) (*btpb.MutateRowResponse, error) {
	s.mu.Lock()
	tbl, ok := s.tables[req.TableName]
	s.mu.Unlock()
	if !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", req.TableName)
	}
	fs := tbl.columnFamilies()
	r, _ := tbl.mutableRow(string(req.RowKey))
	r.mu.Lock()
	defer tbl.resortRowIndex() // Make sure the row lock is released before this grabs the table lock
	defer r.mu.Unlock()
	if err := applyMutations(tbl, r, req.Mutations, fs); err != nil {
		return nil, err
	}
	return &btpb.MutateRowResponse{}, nil
}

func (s *server) MutateRows(req *btpb.MutateRowsRequest, stream btpb.Bigtable_MutateRowsServer) error {
	s.mu.Lock()
	tbl, ok := s.tables[req.TableName]
	s.mu.Unlock()
	if !ok {
		return grpc.Errorf(codes.NotFound, "table %q not found", req.TableName)
	}
	res := &btpb.MutateRowsResponse{Entries: make([]*btpb.MutateRowsResponse_Entry, len(req.Entries))}

	fs := tbl.columnFamilies()

	defer tbl.resortRowIndex()
	for i, entry := range req.Entries {
		r, _ := tbl.mutableRow(string(entry.RowKey))
		r.mu.Lock()
		code, msg := int32(codes.OK), ""
		if err := applyMutations(tbl, r, entry.Mutations, fs); err != nil {
			code = int32(codes.Internal)
			msg = err.Error()
		}
		res.Entries[i] = &btpb.MutateRowsResponse_Entry{
			Index:  int64(i),
			Status: &statpb.Status{Code: code, Message: msg},
		}
		r.mu.Unlock()
	}
	stream.Send(res)
	return nil
}

func (s *server) CheckAndMutateRow(ctx context.Context, req *btpb.CheckAndMutateRowRequest) (*btpb.CheckAndMutateRowResponse, error) {
	s.mu.Lock()
	tbl, ok := s.tables[req.TableName]
	s.mu.Unlock()
	if !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", req.TableName)
	}
	res := &btpb.CheckAndMutateRowResponse{}

	fs := tbl.columnFamilies()

	r, _ := tbl.mutableRow(string(req.RowKey))
	r.mu.Lock()
	defer r.mu.Unlock()

	// Figure out which mutation to apply.
	whichMut := false
	if req.PredicateFilter == nil {
		// Use true_mutations iff row contains any cells.
		whichMut = !r.isEmpty()
	} else {
		// Use true_mutations iff any cells in the row match the filter.
		// TODO(dsymonds): This could be cheaper.
		nr := r.copy()
		filterRow(req.PredicateFilter, nr)
		whichMut = !nr.isEmpty()
	}
	res.PredicateMatched = whichMut
	muts := req.FalseMutations
	if whichMut {
		muts = req.TrueMutations
	}

	defer tbl.resortRowIndex()
	if err := applyMutations(tbl, r, muts, fs); err != nil {
		return nil, err
	}
	return res, nil
}

// applyMutations applies a sequence of mutations to a row.
// fam should be a snapshot of the keys of tbl.families.
// It assumes r.mu is locked.
func applyMutations(tbl *table, r *row, muts []*btpb.Mutation, fs map[string]*columnFamily) error {
	for _, mut := range muts {
		switch mut := mut.Mutation.(type) {
		default:
			return fmt.Errorf("can't handle mutation type %T", mut)
		case *btpb.Mutation_SetCell_:
			set := mut.SetCell
			if _, ok := fs[set.FamilyName]; !ok {
				return fmt.Errorf("unknown family %q", set.FamilyName)
			}
			ts := set.TimestampMicros
			if ts == -1 { // bigtable.ServerTime
				ts = newTimestamp()
			}
			if !tbl.validTimestamp(ts) {
				return fmt.Errorf("invalid timestamp %d", ts)
			}
			fam := set.FamilyName
			col := string(set.ColumnQualifier)

			newCell := cell{ts: ts, value: set.Value}
			f := r.getOrCreateFamily(fam, fs[fam].order)
			f.cells[col] = appendOrReplaceCell(f.cellsByColumn(col), newCell)
		case *btpb.Mutation_DeleteFromColumn_:
			del := mut.DeleteFromColumn
			if _, ok := fs[del.FamilyName]; !ok {
				return fmt.Errorf("unknown family %q", del.FamilyName)
			}
			fam := del.FamilyName
			col := string(del.ColumnQualifier)
			if _, ok := r.families[fam]; ok {
				cs := r.families[fam].cells[col]
				if del.TimeRange != nil {
					tsr := del.TimeRange
					if !tbl.validTimestamp(tsr.StartTimestampMicros) {
						return fmt.Errorf("invalid timestamp %d", tsr.StartTimestampMicros)
					}
					if !tbl.validTimestamp(tsr.EndTimestampMicros) {
						return fmt.Errorf("invalid timestamp %d", tsr.EndTimestampMicros)
					}
					// Find half-open interval to remove.
					// Cells are in descending timestamp order,
					// so the predicates to sort.Search are inverted.
					si, ei := 0, len(cs)
					if tsr.StartTimestampMicros > 0 {
						ei = sort.Search(len(cs), func(i int) bool { return cs[i].ts < tsr.StartTimestampMicros })
					}
					if tsr.EndTimestampMicros > 0 {
						si = sort.Search(len(cs), func(i int) bool { return cs[i].ts < tsr.EndTimestampMicros })
					}
					if si < ei {
						copy(cs[si:], cs[ei:])
						cs = cs[:len(cs)-(ei-si)]
					}
				} else {
					cs = nil
				}
				if len(cs) == 0 {
					delete(r.families[fam].cells, col)
					colNames := r.families[fam].colNames
					i := sort.Search(len(colNames), func(i int) bool { return colNames[i] >= col })
					if i < len(colNames) && colNames[i] == col {
						r.families[fam].colNames = append(colNames[:i], colNames[i+1:]...)
					}
					if len(r.families[fam].cells) == 0 {
						delete(r.families, fam)
					}
				} else {
					r.families[fam].cells[col] = cs
				}
			}
		case *btpb.Mutation_DeleteFromRow_:
			r.families = make(map[string]*family)
		case *btpb.Mutation_DeleteFromFamily_:
			fampre := mut.DeleteFromFamily.FamilyName
			delete(r.families, fampre)
		}
	}
	return nil
}

func maxTimestamp(x, y int64) int64 {
	if x > y {
		return x
	}
	return y
}

func newTimestamp() int64 {
	ts := time.Now().UnixNano() / 1e3
	ts -= ts % 1000 // round to millisecond granularity
	return ts
}

func appendOrReplaceCell(cs []cell, newCell cell) []cell {
	replaced := false
	for i, cell := range cs {
		if cell.ts == newCell.ts {
			cs[i] = newCell
			replaced = true
			break
		}
	}
	if !replaced {
		cs = append(cs, newCell)
	}
	sort.Sort(byDescTS(cs))
	return cs
}

func (s *server) ReadModifyWriteRow(ctx context.Context, req *btpb.ReadModifyWriteRowRequest) (*btpb.ReadModifyWriteRowResponse, error) {
	s.mu.Lock()
	tbl, ok := s.tables[req.TableName]
	s.mu.Unlock()
	if !ok {
		return nil, grpc.Errorf(codes.NotFound, "table %q not found", req.TableName)
	}
	updates := make(map[string]cell) // copy of updated cells; keyed by full column name

	fs := tbl.columnFamilies()

	rowKey := string(req.RowKey)
	r, isNewRow := tbl.mutableRow(rowKey)
	// This must be done before the row lock, acquired below, is released.
	if isNewRow {
		defer tbl.resortRowIndex()
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	// Assume all mutations apply to the most recent version of the cell.
	// TODO(dsymonds): Verify this assumption and document it in the proto.
	for _, rule := range req.Rules {
		if _, ok := fs[rule.FamilyName]; !ok {
			return nil, fmt.Errorf("unknown family %q", rule.FamilyName)
		}

		fam := rule.FamilyName
		col := string(rule.ColumnQualifier)
		isEmpty := false
		f := r.getOrCreateFamily(fam, fs[fam].order)
		cs := f.cells[col]
		isEmpty = len(cs) == 0

		ts := newTimestamp()
		var newCell, prevCell cell
		if !isEmpty {
			cells := r.families[fam].cells[col]
			prevCell = cells[0]

			// ts is the max of now or the prev cell's timestamp in case the
			// prev cell is in the future
			ts = maxTimestamp(ts, prevCell.ts)
		}

		switch rule := rule.Rule.(type) {
		default:
			return nil, fmt.Errorf("unknown RMW rule oneof %T", rule)
		case *btpb.ReadModifyWriteRule_AppendValue:
			newCell = cell{ts: ts, value: append(prevCell.value, rule.AppendValue...)}
		case *btpb.ReadModifyWriteRule_IncrementAmount:
			var v int64
			if !isEmpty {
				prevVal := prevCell.value
				if len(prevVal) != 8 {
					return nil, fmt.Errorf("increment on non-64-bit value")
				}
				v = int64(binary.BigEndian.Uint64(prevVal))
			}
			v += rule.IncrementAmount
			var val [8]byte
			binary.BigEndian.PutUint64(val[:], uint64(v))
			newCell = cell{ts: ts, value: val[:]}
		}
		key := strings.Join([]string{fam, col}, ":")
		updates[key] = newCell
		f.cells[col] = appendOrReplaceCell(f.cellsByColumn(col), newCell)
	}

	res := &btpb.Row{
		Key: req.RowKey,
	}
	for col, cell := range updates {
		i := strings.Index(col, ":")
		fam, qual := col[:i], col[i+1:]
		var f *btpb.Family
		for _, ff := range res.Families {
			if ff.Name == fam {
				f = ff
				break
			}
		}
		if f == nil {
			f = &btpb.Family{Name: fam}
			res.Families = append(res.Families, f)
		}
		f.Columns = append(f.Columns, &btpb.Column{
			Qualifier: []byte(qual),
			Cells: []*btpb.Cell{{
				TimestampMicros: cell.ts,
				Value:           cell.value,
			}},
		})
	}
	return &btpb.ReadModifyWriteRowResponse{Row: res}, nil
}

func (s *server) SampleRowKeys(req *btpb.SampleRowKeysRequest, stream btpb.Bigtable_SampleRowKeysServer) error {
	s.mu.Lock()
	tbl, ok := s.tables[req.TableName]
	s.mu.Unlock()
	if !ok {
		return grpc.Errorf(codes.NotFound, "table %q not found", req.TableName)
	}

	tbl.mu.RLock()
	defer tbl.mu.RUnlock()

	// The return value of SampleRowKeys is very loosely defined. Return at least the
	// final row key in the table and choose other row keys randomly.
	var offset int64
	for i, row := range tbl.rows {
		if i == len(tbl.rows)-1 || rand.Int31n(100) == 0 {
			resp := &btpb.SampleRowKeysResponse{
				RowKey:      []byte(row.key),
				OffsetBytes: offset,
			}
			err := stream.Send(resp)
			if err != nil {
				return err
			}
		}
		offset += int64(row.size())
	}
	return nil
}

// needGC is invoked whenever the server needs gcloop running.
func (s *server) needGC() {
	s.mu.Lock()
	if s.gcc == nil {
		s.gcc = make(chan int)
		go s.gcloop(s.gcc)
	}
	s.mu.Unlock()
}

func (s *server) gcloop(done <-chan int) {
	const (
		minWait = 500  // ms
		maxWait = 1500 // ms
	)

	for {
		// Wait for a random time interval.
		d := time.Duration(minWait+rand.Intn(maxWait-minWait)) * time.Millisecond
		select {
		case <-time.After(d):
		case <-done:
			return // server has been closed
		}

		// Do a GC pass over all tables.
		var tables []*table
		s.mu.Lock()
		for _, tbl := range s.tables {
			tables = append(tables, tbl)
		}
		s.mu.Unlock()
		for _, tbl := range tables {
			tbl.gc()
		}
	}
}

type table struct {
	mu       sync.RWMutex
	counter  uint64                   // increment by 1 when a new family is created
	families map[string]*columnFamily // keyed by plain family name
	rows     []*row                   // sorted by row key
	rowIndex map[string]*row          // indexed by row key
}

func newTable(ctr *btapb.CreateTableRequest) *table {
	fams := make(map[string]*columnFamily)
	c := uint64(0)
	if ctr.Table != nil {
		for id, cf := range ctr.Table.ColumnFamilies {
			fams[id] = &columnFamily{
				name:   ctr.Parent + "/columnFamilies/" + id,
				order:  c,
				gcRule: cf.GcRule,
			}
			c++
		}
	}
	return &table{
		families: fams,
		counter:  c,
		rowIndex: make(map[string]*row),
	}
}

func (t *table) validTimestamp(ts int64) bool {
	// Assume millisecond granularity is required.
	return ts%1000 == 0
}

func (t *table) columnFamilies() map[string]*columnFamily {
	cp := make(map[string]*columnFamily)
	t.mu.RLock()
	for fam, cf := range t.families {
		cp[fam] = cf
	}
	t.mu.RUnlock()
	return cp
}

func (t *table) mutableRow(row string) (mutRow *row, isNewRow bool) {
	// Try fast path first.
	t.mu.RLock()
	r := t.rowIndex[row]
	t.mu.RUnlock()
	if r != nil {
		return r, false
	}

	// We probably need to create the row.
	t.mu.Lock()
	r = t.rowIndex[row]
	if r == nil {
		r = newRow(row)
		t.rowIndex[row] = r
		t.rows = append(t.rows, r)
	}
	t.mu.Unlock()
	return r, true
}

func (t *table) resortRowIndex() {
	t.mu.Lock()
	sort.Sort(byRowKey(t.rows))
	t.mu.Unlock()
}

func (t *table) gc() {
	// This method doesn't add or remove rows, so we only need a read lock for the table.
	t.mu.RLock()
	defer t.mu.RUnlock()

	// Gather GC rules we'll apply.
	rules := make(map[string]*btapb.GcRule) // keyed by "fam"
	for fam, cf := range t.families {
		if cf.gcRule != nil {
			rules[fam] = cf.gcRule
		}
	}
	if len(rules) == 0 {
		return
	}

	for _, r := range t.rows {
		r.mu.Lock()
		r.gc(rules)
		r.mu.Unlock()
	}
}

type byRowKey []*row

func (b byRowKey) Len() int           { return len(b) }
func (b byRowKey) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b byRowKey) Less(i, j int) bool { return b[i].key < b[j].key }

type row struct {
	key string

	mu       sync.Mutex
	families map[string]*family // keyed by family name
}

func newRow(key string) *row {
	return &row{
		key:      key,
		families: make(map[string]*family),
	}
}

// copy returns a copy of the row.
// Cell values are aliased.
// r.mu should be held.
func (r *row) copy() *row {
	nr := newRow(r.key)
	for _, fam := range r.families {
		nr.families[fam.name] = &family{
			name:     fam.name,
			order:    fam.order,
			colNames: fam.colNames,
			cells:    make(map[string][]cell),
		}
		for col, cs := range fam.cells {
			// Copy the []cell slice, but not the []byte inside each cell.
			nr.families[fam.name].cells[col] = append([]cell(nil), cs...)
		}
	}
	return nr
}

// isEmpty returns true if a row doesn't contain any cell
func (r *row) isEmpty() bool {
	for _, fam := range r.families {
		for _, cs := range fam.cells {
			if len(cs) > 0 {
				return false
			}
		}
	}
	return true
}

// sortedFamilies returns a column family set
// sorted in ascending creation order in a row.
func (r *row) sortedFamilies() []*family {
	var families []*family
	for _, fam := range r.families {
		families = append(families, fam)
	}
	sort.Sort(byCreationOrder(families))
	return families
}

func (r *row) getOrCreateFamily(name string, order uint64) *family {
	if _, ok := r.families[name]; !ok {
		r.families[name] = &family{
			name:  name,
			order: order,
			cells: make(map[string][]cell),
		}
	}
	return r.families[name]
}

// gc applies the given GC rules to the row.
// r.mu should be held.
func (r *row) gc(rules map[string]*btapb.GcRule) {
	for _, fam := range r.families {
		rule, ok := rules[fam.name]
		if !ok {
			continue
		}
		for col, cs := range fam.cells {
			r.families[fam.name].cells[col] = applyGC(cs, rule)
		}
	}
}

// size returns the total size of all cell values in the row.
func (r *row) size() int {
	size := 0
	for _, fam := range r.families {
		for _, cells := range fam.cells {
			for _, cell := range cells {
				size += len(cell.value)
			}
		}
	}
	return size
}

func (r *row) String() string {
	return r.key
}

var gcTypeWarn sync.Once

// applyGC applies the given GC rule to the cells.
func applyGC(cells []cell, rule *btapb.GcRule) []cell {
	switch rule := rule.Rule.(type) {
	default:
		// TODO(dsymonds): Support GcRule_Intersection_
		gcTypeWarn.Do(func() {
			log.Printf("Unsupported GC rule type %T", rule)
		})
	case *btapb.GcRule_Union_:
		for _, sub := range rule.Union.Rules {
			cells = applyGC(cells, sub)
		}
		return cells
	case *btapb.GcRule_MaxAge:
		// Timestamps are in microseconds.
		cutoff := time.Now().UnixNano() / 1e3
		cutoff -= rule.MaxAge.Seconds * 1e6
		cutoff -= int64(rule.MaxAge.Nanos) / 1e3
		// The slice of cells in in descending timestamp order.
		// This sort.Search will return the index of the first cell whose timestamp is chronologically before the cutoff.
		si := sort.Search(len(cells), func(i int) bool { return cells[i].ts < cutoff })
		if si < len(cells) {
			log.Printf("bttest: GC MaxAge(%v) deleted %d cells.", rule.MaxAge, len(cells)-si)
		}
		return cells[:si]
	case *btapb.GcRule_MaxNumVersions:
		n := int(rule.MaxNumVersions)
		if len(cells) > n {
			cells = cells[:n]
		}
		return cells
	}
	return cells
}

type family struct {
	name     string            // Column family name
	order    uint64            // Creation order of column family
	colNames []string          // Collumn names are sorted in lexicographical ascending order
	cells    map[string][]cell // Keyed by collumn name; cells are in descending timestamp order
}

type byCreationOrder []*family

func (b byCreationOrder) Len() int           { return len(b) }
func (b byCreationOrder) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b byCreationOrder) Less(i, j int) bool { return b[i].order < b[j].order }

// cellsByColumn adds the column name to colNames set if it does not exist
// and returns all cells within a column
func (f *family) cellsByColumn(name string) []cell {
	if _, ok := f.cells[name]; !ok {
		f.colNames = append(f.colNames, name)
		sort.Strings(f.colNames)
	}
	return f.cells[name]
}

type cell struct {
	ts    int64
	value []byte
}

type byDescTS []cell

func (b byDescTS) Len() int           { return len(b) }
func (b byDescTS) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b byDescTS) Less(i, j int) bool { return b[i].ts > b[j].ts }

type columnFamily struct {
	name   string
	order  uint64 // Creation order of column family
	gcRule *btapb.GcRule
}

func (c *columnFamily) proto() *btapb.ColumnFamily {
	return &btapb.ColumnFamily{
		GcRule: c.gcRule,
	}
}

func toColumnFamilies(families map[string]*columnFamily) map[string]*btapb.ColumnFamily {
	fs := make(map[string]*btapb.ColumnFamily)
	for k, v := range families {
		fs[k] = v.proto()
	}
	return fs
}
