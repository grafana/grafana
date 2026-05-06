package pgx

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

/*
buildLoadDerivedTypesSQL generates the correct query for retrieving type information.

	pgVersion: the major version of the PostgreSQL server
	typeNames: the names of the types to load. If nil, load all types.
*/
func buildLoadDerivedTypesSQL(pgVersion int64, typeNames []string) string {
	supportsMultirange := (pgVersion >= 14)
	var typeNamesClause string

	if typeNames == nil {
		// This should not occur; this will not return any types
		typeNamesClause = "= ''"
	} else {
		typeNamesClause = "= ANY($1)"
	}
	parts := make([]string, 0, 10)

	// Each of the type names provided might be found in pg_class or pg_type.
	// Additionally, it may or may not include a schema portion.
	parts = append(parts, `
WITH RECURSIVE
-- find the OIDs in pg_class which match one of the provided type names
selected_classes(oid,reltype) AS (
    -- this query uses the namespace search path, so will match type names without a schema prefix
    SELECT pg_class.oid, pg_class.reltype
    FROM pg_catalog.pg_class
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = pg_class.relnamespace
    WHERE pg_catalog.pg_table_is_visible(pg_class.oid)
      AND relname `, typeNamesClause, `
UNION ALL
    -- this query will only match type names which include the schema prefix
    SELECT pg_class.oid, pg_class.reltype
    FROM pg_class
    INNER JOIN pg_namespace ON (pg_class.relnamespace = pg_namespace.oid)
    WHERE nspname || '.' || relname `, typeNamesClause, `
),
selected_types(oid) AS (
    -- collect the OIDs from pg_types which correspond to the selected classes
    SELECT reltype AS oid
    FROM selected_classes
UNION ALL
    -- as well as any other type names which match our criteria
    SELECT pg_type.oid
    FROM pg_type
    LEFT OUTER JOIN pg_namespace ON (pg_type.typnamespace = pg_namespace.oid)
    WHERE typname `, typeNamesClause, `
        OR nspname || '.' || typname `, typeNamesClause, `
),
-- this builds a parent/child mapping of objects, allowing us to know
-- all the child (ie: dependent) types that a parent (type) requires
-- As can be seen, there are 3 ways this can occur (the last of which
-- is due to being a composite class, where the composite fields are children)
pc(parent, child) AS (
    SELECT parent.oid, parent.typelem
    FROM pg_type parent
    WHERE parent.typtype = 'b' AND parent.typelem != 0
UNION ALL
    SELECT parent.oid, parent.typbasetype
    FROM pg_type parent
    WHERE parent.typtypmod = -1 AND parent.typbasetype != 0
UNION ALL
    SELECT pg_type.oid, atttypid
    FROM pg_attribute
    INNER JOIN pg_class ON (pg_class.oid = pg_attribute.attrelid)
    INNER JOIN pg_type ON (pg_type.oid = pg_class.reltype)
    WHERE NOT attisdropped
      AND attnum > 0
),
-- Now construct a recursive query which includes a 'depth' element.
-- This is used to ensure that the "youngest" children are registered before
-- their parents.
relationships(parent, child, depth) AS (
    SELECT DISTINCT 0::OID, selected_types.oid, 0
    FROM selected_types
UNION ALL
    SELECT pg_type.oid AS parent, pg_attribute.atttypid AS child, 1
    FROM selected_classes c
    inner join pg_type ON (c.reltype = pg_type.oid)
    inner join pg_attribute on (c.oid = pg_attribute.attrelid)
UNION ALL
    SELECT pc.parent, pc.child, relationships.depth + 1
    FROM pc
    INNER JOIN relationships ON (pc.parent = relationships.child)
),
-- composite fields need to be encapsulated as a couple of arrays to provide the required information for registration
composite AS (
    SELECT pg_type.oid, ARRAY_AGG(attname ORDER BY attnum) AS attnames, ARRAY_AGG(atttypid ORDER BY ATTNUM) AS atttypids
    FROM pg_attribute
    INNER JOIN pg_class ON (pg_class.oid = pg_attribute.attrelid)
    INNER JOIN pg_type ON (pg_type.oid = pg_class.reltype)
    WHERE NOT attisdropped
      AND attnum > 0
    GROUP BY pg_type.oid
)
-- Bring together this information, showing all the information which might possibly be required
-- to complete the registration, applying filters to only show the items which relate to the selected
-- types/classes.
SELECT typname,
       pg_namespace.nspname,
       typtype,
       typbasetype,
       typelem,
       pg_type.oid,`)
	if supportsMultirange {
		parts = append(parts, `
       COALESCE(multirange.rngtypid, 0) AS rngtypid,`)
	} else {
		parts = append(parts, `
       0 AS rngtypid,`)
	}
	parts = append(parts, `
       COALESCE(pg_range.rngsubtype, 0) AS rngsubtype,
       attnames, atttypids
    FROM relationships
    INNER JOIN pg_type ON (pg_type.oid = relationships.child)
    LEFT OUTER JOIN pg_range ON (pg_type.oid = pg_range.rngtypid)`)
	if supportsMultirange {
		parts = append(parts, `
    LEFT OUTER JOIN pg_range multirange ON (pg_type.oid = multirange.rngmultitypid)`)
	}

	parts = append(parts, `
    LEFT OUTER JOIN composite USING (oid)
    LEFT OUTER JOIN pg_namespace ON (pg_type.typnamespace = pg_namespace.oid)
    WHERE NOT (typtype = 'b' AND typelem = 0)`)
	parts = append(parts, `
    GROUP BY typname, pg_namespace.nspname, typtype, typbasetype, typelem, pg_type.oid, pg_range.rngsubtype,`)
	if supportsMultirange {
		parts = append(parts, `
        multirange.rngtypid,`)
	}
	parts = append(parts, `
        attnames, atttypids
    ORDER BY MAX(depth) desc, typname;`)
	return strings.Join(parts, "")
}

type derivedTypeInfo struct {
	Oid, Typbasetype, Typelem, Rngsubtype, Rngtypid uint32
	TypeName, Typtype, NspName                      string
	Attnames                                        []string
	Atttypids                                       []uint32
}

// LoadTypes performs a single (complex) query, returning all the required
// information to register the named types, as well as any other types directly
// or indirectly required to complete the registration.
// The result of this call can be passed into RegisterTypes to complete the process.
func (c *Conn) LoadTypes(ctx context.Context, typeNames []string) ([]*pgtype.Type, error) {
	m := c.TypeMap()
	if len(typeNames) == 0 {
		return nil, fmt.Errorf("No type names were supplied.")
	}

	// Disregard server version errors. This will result in
	// the SQL not support recent structures such as multirange
	serverVersion, _ := serverVersion(c)
	sql := buildLoadDerivedTypesSQL(serverVersion, typeNames)
	rows, err := c.Query(ctx, sql, QueryExecModeSimpleProtocol, typeNames)
	if err != nil {
		return nil, fmt.Errorf("While generating load types query: %w", err)
	}
	defer rows.Close()
	result := make([]*pgtype.Type, 0, 100)
	for rows.Next() {
		ti := derivedTypeInfo{}
		err = rows.Scan(&ti.TypeName, &ti.NspName, &ti.Typtype, &ti.Typbasetype, &ti.Typelem, &ti.Oid, &ti.Rngtypid, &ti.Rngsubtype, &ti.Attnames, &ti.Atttypids)
		if err != nil {
			return nil, fmt.Errorf("While scanning type information: %w", err)
		}
		var type_ *pgtype.Type
		switch ti.Typtype {
		case "b": // array
			dt, ok := m.TypeForOID(ti.Typelem)
			if !ok {
				return nil, fmt.Errorf("Array element OID %v not registered while loading pgtype %q", ti.Typelem, ti.TypeName)
			}
			type_ = &pgtype.Type{Name: ti.TypeName, OID: ti.Oid, Codec: &pgtype.ArrayCodec{ElementType: dt}}
		case "c": // composite
			var fields []pgtype.CompositeCodecField
			for i, fieldName := range ti.Attnames {
				dt, ok := m.TypeForOID(ti.Atttypids[i])
				if !ok {
					return nil, fmt.Errorf("Unknown field for composite type %q:  field %q (OID %v) is not already registered.", ti.TypeName, fieldName, ti.Atttypids[i])
				}
				fields = append(fields, pgtype.CompositeCodecField{Name: fieldName, Type: dt})
			}

			type_ = &pgtype.Type{Name: ti.TypeName, OID: ti.Oid, Codec: &pgtype.CompositeCodec{Fields: fields}}
		case "d": // domain
			dt, ok := m.TypeForOID(ti.Typbasetype)
			if !ok {
				return nil, fmt.Errorf("Domain base type OID %v was not already registered, needed for %q", ti.Typbasetype, ti.TypeName)
			}

			type_ = &pgtype.Type{Name: ti.TypeName, OID: ti.Oid, Codec: dt.Codec}
		case "e": // enum
			type_ = &pgtype.Type{Name: ti.TypeName, OID: ti.Oid, Codec: &pgtype.EnumCodec{}}
		case "r": // range
			dt, ok := m.TypeForOID(ti.Rngsubtype)
			if !ok {
				return nil, fmt.Errorf("Range element OID %v was not already registered, needed for %q", ti.Rngsubtype, ti.TypeName)
			}

			type_ = &pgtype.Type{Name: ti.TypeName, OID: ti.Oid, Codec: &pgtype.RangeCodec{ElementType: dt}}
		case "m": // multirange
			dt, ok := m.TypeForOID(ti.Rngtypid)
			if !ok {
				return nil, fmt.Errorf("Multirange element OID %v was not already registered, needed for %q", ti.Rngtypid, ti.TypeName)
			}

			type_ = &pgtype.Type{Name: ti.TypeName, OID: ti.Oid, Codec: &pgtype.MultirangeCodec{ElementType: dt}}
		default:
			return nil, fmt.Errorf("Unknown typtype %q was found while registering %q", ti.Typtype, ti.TypeName)
		}

		// the type_ is imposible to be null
		m.RegisterType(type_)
		if ti.NspName != "" {
			nspType := &pgtype.Type{Name: ti.NspName + "." + type_.Name, OID: type_.OID, Codec: type_.Codec}
			m.RegisterType(nspType)
			result = append(result, nspType)
		}
		result = append(result, type_)
	}
	return result, nil
}

// serverVersion returns the postgresql server version.
func serverVersion(c *Conn) (int64, error) {
	serverVersionStr := c.PgConn().ParameterStatus("server_version")
	serverVersionStr = regexp.MustCompile(`^[0-9]+`).FindString(serverVersionStr)
	// if not PostgreSQL do nothing
	if serverVersionStr == "" {
		return 0, fmt.Errorf("Cannot identify server version in %q", serverVersionStr)
	}

	version, err := strconv.ParseInt(serverVersionStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("postgres version parsing failed: %w", err)
	}
	return version, nil
}
