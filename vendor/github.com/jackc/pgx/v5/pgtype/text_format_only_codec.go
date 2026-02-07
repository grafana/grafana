package pgtype

type TextFormatOnlyCodec struct {
	Codec
}

func (c *TextFormatOnlyCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode && c.Codec.FormatSupported(format)
}

func (TextFormatOnlyCodec) PreferredFormat() int16 {
	return TextFormatCode
}
