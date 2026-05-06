package s3

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
)

// ListObjectVersionsAPIClient is a client that implements the ListObjectVersions
// operation
type ListObjectVersionsAPIClient interface {
	ListObjectVersions(context.Context, *ListObjectVersionsInput, ...func(*Options)) (*ListObjectVersionsOutput, error)
}

var _ ListObjectVersionsAPIClient = (*Client)(nil)

// ListObjectVersionsPaginatorOptions is the paginator options for ListObjectVersions
type ListObjectVersionsPaginatorOptions struct {
	// (Optional) The maximum number of Object Versions that you want Amazon S3 to
	// return.
	Limit int32

	// Set to true if pagination should stop if the service returns a pagination token
	// that matches the most recent token provided to the service.
	StopOnDuplicateToken bool
}

// ListObjectVersionsPaginator is a paginator for ListObjectVersions
type ListObjectVersionsPaginator struct {
	options         ListObjectVersionsPaginatorOptions
	client          ListObjectVersionsAPIClient
	params          *ListObjectVersionsInput
	firstPage       bool
	keyMarker       *string
	versionIDMarker *string
	isTruncated     bool
}

// NewListObjectVersionsPaginator returns a new ListObjectVersionsPaginator
func NewListObjectVersionsPaginator(client ListObjectVersionsAPIClient, params *ListObjectVersionsInput, optFns ...func(*ListObjectVersionsPaginatorOptions)) *ListObjectVersionsPaginator {
	if params == nil {
		params = &ListObjectVersionsInput{}
	}

	options := ListObjectVersionsPaginatorOptions{}
	if params.MaxKeys != nil {
		options.Limit = aws.ToInt32(params.MaxKeys)
	}

	for _, fn := range optFns {
		fn(&options)
	}

	return &ListObjectVersionsPaginator{
		options:         options,
		client:          client,
		params:          params,
		firstPage:       true,
		keyMarker:       params.KeyMarker,
		versionIDMarker: params.VersionIdMarker,
	}
}

// HasMorePages returns a boolean indicating whether more pages are available
func (p *ListObjectVersionsPaginator) HasMorePages() bool {
	return p.firstPage || p.isTruncated
}

// NextPage retrieves the next ListObjectVersions page.
func (p *ListObjectVersionsPaginator) NextPage(ctx context.Context, optFns ...func(*Options)) (*ListObjectVersionsOutput, error) {
	if !p.HasMorePages() {
		return nil, fmt.Errorf("no more pages available")
	}

	params := *p.params
	params.KeyMarker = p.keyMarker
	params.VersionIdMarker = p.versionIDMarker

	var limit int32
	if p.options.Limit > 0 {
		limit = p.options.Limit
	}
	if limit > 0 {
		params.MaxKeys = aws.Int32(limit)
	}

	result, err := p.client.ListObjectVersions(ctx, &params, optFns...)
	if err != nil {
		return nil, err
	}
	p.firstPage = false

	prevToken := p.keyMarker
	p.isTruncated = aws.ToBool(result.IsTruncated)
	p.keyMarker = nil
	p.versionIDMarker = nil
	if aws.ToBool(result.IsTruncated) {
		p.keyMarker = result.NextKeyMarker
		p.versionIDMarker = result.NextVersionIdMarker
	}

	if p.options.StopOnDuplicateToken &&
		prevToken != nil &&
		p.keyMarker != nil &&
		*prevToken == *p.keyMarker {
		p.isTruncated = false
	}

	return result, nil
}

// ListMultipartUploadsAPIClient is a client that implements the ListMultipartUploads
// operation
type ListMultipartUploadsAPIClient interface {
	ListMultipartUploads(context.Context, *ListMultipartUploadsInput, ...func(*Options)) (*ListMultipartUploadsOutput, error)
}

var _ ListMultipartUploadsAPIClient = (*Client)(nil)

// ListMultipartUploadsPaginatorOptions is the paginator options for ListMultipartUploads
type ListMultipartUploadsPaginatorOptions struct {
	// (Optional) The maximum number of Multipart Uploads that you want Amazon S3 to
	// return.
	Limit int32

	// Set to true if pagination should stop if the service returns a pagination token
	// that matches the most recent token provided to the service.
	StopOnDuplicateToken bool
}

// ListMultipartUploadsPaginator is a paginator for ListMultipartUploads
type ListMultipartUploadsPaginator struct {
	options        ListMultipartUploadsPaginatorOptions
	client         ListMultipartUploadsAPIClient
	params         *ListMultipartUploadsInput
	firstPage      bool
	keyMarker      *string
	uploadIDMarker *string
	isTruncated    bool
}

// NewListMultipartUploadsPaginator returns a new ListMultipartUploadsPaginator
func NewListMultipartUploadsPaginator(client ListMultipartUploadsAPIClient, params *ListMultipartUploadsInput, optFns ...func(*ListMultipartUploadsPaginatorOptions)) *ListMultipartUploadsPaginator {
	if params == nil {
		params = &ListMultipartUploadsInput{}
	}

	options := ListMultipartUploadsPaginatorOptions{}
	if params.MaxUploads != nil {
		options.Limit = aws.ToInt32(params.MaxUploads)
	}

	for _, fn := range optFns {
		fn(&options)
	}

	return &ListMultipartUploadsPaginator{
		options:        options,
		client:         client,
		params:         params,
		firstPage:      true,
		keyMarker:      params.KeyMarker,
		uploadIDMarker: params.UploadIdMarker,
	}
}

// HasMorePages returns a boolean indicating whether more pages are available
func (p *ListMultipartUploadsPaginator) HasMorePages() bool {
	return p.firstPage || p.isTruncated
}

// NextPage retrieves the next ListMultipartUploads page.
func (p *ListMultipartUploadsPaginator) NextPage(ctx context.Context, optFns ...func(*Options)) (*ListMultipartUploadsOutput, error) {
	if !p.HasMorePages() {
		return nil, fmt.Errorf("no more pages available")
	}

	params := *p.params
	params.KeyMarker = p.keyMarker
	params.UploadIdMarker = p.uploadIDMarker

	var limit int32
	if p.options.Limit > 0 {
		limit = p.options.Limit
	}
	if limit > 0 {
		params.MaxUploads = aws.Int32(limit)
	}

	result, err := p.client.ListMultipartUploads(ctx, &params, optFns...)
	if err != nil {
		return nil, err
	}
	p.firstPage = false

	prevToken := p.keyMarker
	p.isTruncated = aws.ToBool(result.IsTruncated)
	p.keyMarker = nil
	p.uploadIDMarker = nil
	if aws.ToBool(result.IsTruncated) {
		p.keyMarker = result.NextKeyMarker
		p.uploadIDMarker = result.NextUploadIdMarker
	}

	if p.options.StopOnDuplicateToken &&
		prevToken != nil &&
		p.keyMarker != nil &&
		*prevToken == *p.keyMarker {
		p.isTruncated = false
	}

	return result, nil
}
