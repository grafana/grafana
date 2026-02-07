//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package generated

import (
	"encoding/xml"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
	"net/url"
)

type TransactionalContentSetter interface {
	SetCRC64([]byte)
	SetMD5([]byte)
}

func (a *AppendBlobClientAppendBlockOptions) SetCRC64(v []byte) {
	a.TransactionalContentCRC64 = v
}

func (a *AppendBlobClientAppendBlockOptions) SetMD5(v []byte) {
	a.TransactionalContentMD5 = v
}

func (b *BlockBlobClientStageBlockOptions) SetCRC64(v []byte) {
	b.TransactionalContentCRC64 = v
}

func (b *BlockBlobClientStageBlockOptions) SetMD5(v []byte) {
	b.TransactionalContentMD5 = v
}

func (p *PageBlobClientUploadPagesOptions) SetCRC64(v []byte) {
	p.TransactionalContentCRC64 = v
}

func (p *PageBlobClientUploadPagesOptions) SetMD5(v []byte) {
	p.TransactionalContentMD5 = v
}

func (b *BlockBlobClientUploadOptions) SetCRC64(v []byte) {
	b.TransactionalContentCRC64 = v
}

func (b *BlockBlobClientUploadOptions) SetMD5(v []byte) {
	b.TransactionalContentMD5 = v
}

type SourceContentSetter interface {
	SetSourceContentCRC64(v []byte)
	SetSourceContentMD5(v []byte)
}

func (a *AppendBlobClientAppendBlockFromURLOptions) SetSourceContentCRC64(v []byte) {
	a.SourceContentcrc64 = v
}

func (a *AppendBlobClientAppendBlockFromURLOptions) SetSourceContentMD5(v []byte) {
	a.SourceContentMD5 = v
}

func (b *BlockBlobClientStageBlockFromURLOptions) SetSourceContentCRC64(v []byte) {
	b.SourceContentcrc64 = v
}

func (b *BlockBlobClientStageBlockFromURLOptions) SetSourceContentMD5(v []byte) {
	b.SourceContentMD5 = v
}

func (p *PageBlobClientUploadPagesFromURLOptions) SetSourceContentCRC64(v []byte) {
	p.SourceContentcrc64 = v
}

func (p *PageBlobClientUploadPagesFromURLOptions) SetSourceContentMD5(v []byte) {
	p.SourceContentMD5 = v
}

// Custom UnmarshalXML functions for types that need special handling.

// UnmarshalXML implements the xml.Unmarshaller interface for type BlobPrefix.
func (b *BlobPrefix) UnmarshalXML(dec *xml.Decoder, start xml.StartElement) error {
	type alias BlobPrefix
	aux := &struct {
		*alias
		BlobName *BlobName `xml:"Name"`
	}{
		alias: (*alias)(b),
	}
	if err := dec.DecodeElement(aux, &start); err != nil {
		return err
	}
	if aux.BlobName != nil {
		if aux.BlobName.Encoded != nil && *aux.BlobName.Encoded {
			name, err := url.QueryUnescape(*aux.BlobName.Content)

			// name, err := base64.StdEncoding.DecodeString(*aux.BlobName.Content)
			if err != nil {
				return err
			}
			b.Name = to.Ptr(string(name))
		} else {
			b.Name = aux.BlobName.Content
		}
	}
	return nil
}

// UnmarshalXML implements the xml.Unmarshaller interface for type BlobItem.
func (b *BlobItem) UnmarshalXML(dec *xml.Decoder, start xml.StartElement) error {
	type alias BlobItem
	aux := &struct {
		*alias
		BlobName   *BlobName            `xml:"Name"`
		Metadata   additionalProperties `xml:"Metadata"`
		OrMetadata additionalProperties `xml:"OrMetadata"`
	}{
		alias: (*alias)(b),
	}
	if err := dec.DecodeElement(aux, &start); err != nil {
		return err
	}
	b.Metadata = (map[string]*string)(aux.Metadata)
	b.OrMetadata = (map[string]*string)(aux.OrMetadata)
	if aux.BlobName != nil {
		if aux.BlobName.Encoded != nil && *aux.BlobName.Encoded {
			name, err := url.QueryUnescape(*aux.BlobName.Content)

			// name, err := base64.StdEncoding.DecodeString(*aux.BlobName.Content)
			if err != nil {
				return err
			}
			b.Name = to.Ptr(string(name))
		} else {
			b.Name = aux.BlobName.Content
		}
	}
	return nil
}
