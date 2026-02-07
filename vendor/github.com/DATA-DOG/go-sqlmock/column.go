package sqlmock

import "reflect"

// Column is a mocked column Metadata for rows.ColumnTypes()
type Column struct {
	name       string
	dbType     string
	nullable   bool
	nullableOk bool
	length     int64
	lengthOk   bool
	precision  int64
	scale      int64
	psOk       bool
	scanType   reflect.Type
}

func (c *Column) Name() string {
	return c.name
}

func (c *Column) DbType() string {
	return c.dbType
}

func (c *Column) IsNullable() (bool, bool) {
	return c.nullable, c.nullableOk
}

func (c *Column) Length() (int64, bool) {
	return c.length, c.lengthOk
}

func (c *Column) PrecisionScale() (int64, int64, bool) {
	return c.precision, c.scale, c.psOk
}

func (c *Column) ScanType() reflect.Type {
	return c.scanType
}

// NewColumn returns a Column with specified name
func NewColumn(name string) *Column {
	return &Column{
		name: name,
	}
}

// Nullable returns the column with nullable metadata set
func (c *Column) Nullable(nullable bool) *Column {
	c.nullable = nullable
	c.nullableOk = true
	return c
}

// OfType returns the column with type metadata set
func (c *Column) OfType(dbType string, sampleValue interface{}) *Column {
	c.dbType = dbType
	c.scanType = reflect.TypeOf(sampleValue)
	return c
}

// WithLength returns the column with length metadata set.
func (c *Column) WithLength(length int64) *Column {
	c.length = length
	c.lengthOk = true
	return c
}

// WithPrecisionAndScale returns the column with precision and scale metadata set.
func (c *Column) WithPrecisionAndScale(precision, scale int64) *Column {
	c.precision = precision
	c.scale = scale
	c.psOk = true
	return c
}
