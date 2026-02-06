package client

import (
	"bytes"
	"context"
	"crypto"
	"fmt"
	"io"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/storage"
)

type FetchOptions struct {
	NoCache      bool
	NoProgress   bool
	NoBlobFilter bool
	Want         []hash.Hash
	Done         bool // not sure why we need this one
	Deepen       int
	Shallow      bool

	// NoExtraObjects stops reading the packfile once all wanted objects have been found.
	// This can significantly improve performance when fetching specific objects from large repositories,
	// as it avoids downloading and processing unnecessary objects.
	NoExtraObjects bool
}

func (c *rawClient) Fetch(ctx context.Context, opts FetchOptions) (map[string]*protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Fetch", "wantCount", len(opts.Want), "noCache", opts.NoCache)

	objects := make(map[string]*protocol.PackfileObject)
	storage := storage.FromContext(ctx)

	cachedObjects, pendingOpts := c.checkCacheForObjects(ctx, opts, objects, storage)
	if cachedObjects {
		return objects, nil
	}

	pkt, err := c.buildFetchRequest(pendingOpts)
	if err != nil {
		return nil, err
	}

	c.logFetchRequest(logger, pkt, pendingOpts)

	responseReader, response, err := c.sendFetchRequest(ctx, pkt)
	if err != nil {
		return nil, err
	}

	if responseReader != nil {
		defer func() {
			if closeErr := responseReader.Close(); closeErr != nil {
				logger.Error("error closing response reader", "error", closeErr)
			}
		}()
	}

	err = c.processPackfileResponse(ctx, response, objects, storage, pendingOpts)
	if err != nil {
		return nil, err
	}

	logger.Debug("Fetch completed", "totalObjects", len(objects))
	return objects, nil
}

// checkCacheForObjects checks if objects are available in cache and returns cached objects
func (c *rawClient) checkCacheForObjects(ctx context.Context, opts FetchOptions, objects map[string]*protocol.PackfileObject, storage storage.PackfileStorage) (bool, FetchOptions) {
	logger := log.FromContext(ctx)

	if storage == nil || opts.NoCache {
		return false, opts
	}

	pending := make([]hash.Hash, 0, len(opts.Want))
	for _, want := range opts.Want {
		obj, ok := storage.Get(want)
		if !ok {
			pending = append(pending, want)
		} else {
			objects[want.String()] = obj
		}
	}

	if len(objects) == len(opts.Want) {
		logger.Debug("All objects found in cache", "objectCount", len(objects))
		return true, opts
	}

	logger.Debug("Some objects not found in cache", "foundInCache", len(objects), "pendingFetch", len(pending))
	opts.Want = pending
	return false, opts
}

// buildFetchRequest constructs the fetch request packet
func (c *rawClient) buildFetchRequest(opts FetchOptions) ([]byte, error) {
	packs := c.buildBasicPacks(opts)
	packs = c.addWantPacks(packs, opts)
	packs = c.addOptionalPacks(packs, opts)

	return protocol.FormatPacks(packs...)
}

// buildBasicPacks creates the basic pack structure
func (c *rawClient) buildBasicPacks(opts FetchOptions) []protocol.Pack {
	packs := []protocol.Pack{
		protocol.PackLine("command=fetch\n"),
		protocol.PackLine("object-format=sha1\n"),
		protocol.SpecialPack(protocol.DelimeterPacket),
	}

	if opts.NoProgress {
		packs = append(packs, protocol.PackLine("no-progress\n"))
	}

	if opts.NoBlobFilter {
		packs = append(packs, protocol.PackLine("filter blob:none\n"))
	}

	return packs
}

// addWantPacks adds want and shallow pack lines
func (c *rawClient) addWantPacks(packs []protocol.Pack, opts FetchOptions) []protocol.Pack {
	for _, want := range opts.Want {
		packs = append(packs, protocol.PackLine(fmt.Sprintf("want %s\n", want.String())))
		if opts.Shallow {
			packs = append(packs, protocol.PackLine(fmt.Sprintf("shallow %s\n", want.String())))
		}
	}
	return packs
}

// addOptionalPacks adds optional pack lines and finishes the pack
func (c *rawClient) addOptionalPacks(packs []protocol.Pack, opts FetchOptions) []protocol.Pack {
	if opts.Deepen > 0 {
		packs = append(packs, protocol.PackLine(fmt.Sprintf("deepen %d\n", opts.Deepen)))
	}

	if opts.Shallow {
		for _, want := range opts.Want {
			packs = append(packs, protocol.PackLine(fmt.Sprintf("shallow %s\n", want.String())))
		}
	}

	if opts.Done {
		packs = append(packs, protocol.PackLine("done\n"))
	}

	return append(packs, protocol.FlushPacket)
}

// logFetchRequest logs the fetch request details
func (c *rawClient) logFetchRequest(logger log.Logger, pkt []byte, opts FetchOptions) {
	logger.Debug("Send fetch request",
		"requestSize", len(pkt),
		"options", map[string]interface{}{
			"noProgress":     opts.NoProgress,
			"noBlobFilter":   opts.NoBlobFilter,
			"deepen":         opts.Deepen,
			"shallow":        opts.Shallow,
			"done":           opts.Done,
			"noExtraObjects": opts.NoExtraObjects,
		})
	logger.Debug("Fetch request raw data", "request", string(pkt))
}

// sendFetchRequest sends the fetch request and parses the response
func (c *rawClient) sendFetchRequest(ctx context.Context, pkt []byte) (io.ReadCloser, *protocol.FetchResponse, error) {
	responseReader, err := c.UploadPack(ctx, bytes.NewReader(pkt))
	if err != nil {
		return nil, nil, fmt.Errorf("sending commands: %w", err)
	}

	parser := protocol.NewParser(responseReader)
	response, err := protocol.ParseFetchResponse(ctx, parser)
	if err != nil {
		return nil, nil, fmt.Errorf("parsing fetch response stream: %w", err)
	}

	return responseReader, response, nil
}

// processPackfileResponse processes the packfile response and extracts objects
func (c *rawClient) processPackfileResponse(ctx context.Context, response *protocol.FetchResponse, objects map[string]*protocol.PackfileObject, storage storage.PackfileStorage, opts FetchOptions) error {
	logger := log.FromContext(ctx)
	// Build a set of pending wanted object hashes for quick lookup if early termination is enabled
	// Only build this if we have specific objects we want AND NoExtraObjects is enabled
	var pendingWantedHashes map[string]bool
	if opts.NoExtraObjects && len(opts.Want) > 0 {
		pendingWantedHashes = make(map[string]bool, len(opts.Want))
		for _, hash := range opts.Want {
			pendingWantedHashes[hash.String()] = true
		}
		logger.Debug("Early termination enabled", "pendingObjects", len(pendingWantedHashes))
	}

	// Collect delta objects for later resolution
	var deltas []*protocol.PackfileObject

	var count, objectCount, foundWantedCount, totalDelta int
	for {
		obj, err := response.Packfile.ReadObject(ctx)
		if err != nil {
			logger.Debug("Finished reading objects", "error", err, "totalObjects", objectCount, "foundWanted", foundWantedCount, "totalDeltas", totalDelta)
			break
		}

		if obj.Object == nil {
			break
		}
		count++

		// Collect delta objects for later resolution instead of skipping them
		if obj.Object.Type == protocol.ObjectTypeRefDelta {
			totalDelta++
			logger.Debug("Found delta object", "parent", obj.Object.Delta.Parent)
			deltas = append(deltas, obj.Object)
			continue
		}

		if storage != nil {
			storage.Add(obj.Object)
		}

		objects[obj.Object.Hash.String()] = obj.Object
		objectCount++

		// Check for early termination if enabled and we have pending wants
		if pendingWantedHashes != nil {
			objHashStr := obj.Object.Hash.String()
			if pendingWantedHashes[objHashStr] {
				foundWantedCount++
				logger.Debug("Found wanted object", "hash", objHashStr, "foundCount", foundWantedCount, "totalWanted", len(pendingWantedHashes))

				// Stop reading if we've found all wanted objects
				if foundWantedCount >= len(pendingWantedHashes) {
					logger.Debug("All wanted objects found, stopping early", "totalObjectsRead", objectCount, "skippingRemaining", len(objects)-count)
				}
			}
		}
	}

	// Resolve deltas if any were found
	if len(deltas) > 0 {
		logger.Debug("Resolving deltas", "deltaCount", len(deltas), "baseObjectCount", len(objects))
		err := c.resolveDeltas(ctx, deltas, objects, storage)
		if err != nil {
			return fmt.Errorf("failed to resolve deltas: %w", err)
		}
	}

	return nil
}

// resolveDeltas resolves delta objects by applying them to their base objects.
// This function handles delta chains where a delta's base might itself be a delta.
// Resolution is done iteratively until all deltas are resolved or we detect unresolvable deltas.
func (c *rawClient) resolveDeltas(ctx context.Context, deltas []*protocol.PackfileObject, objects map[string]*protocol.PackfileObject, storage storage.PackfileStorage) error {
	logger := log.FromContext(ctx)

	remaining := make([]*protocol.PackfileObject, len(deltas))
	copy(remaining, deltas)

	maxIterations := len(deltas) + 1
	for iteration := 1; len(remaining) > 0 && iteration <= maxIterations; iteration++ {
		resolvedCount, stillPending := c.resolveDeltaIteration(ctx, remaining, objects, storage)
		remaining = stillPending

		if resolvedCount == 0 && len(remaining) > 0 {
			return c.createMissingBasesError(remaining)
		}

		logger.Debug("Delta resolution iteration complete", "iteration", iteration, "resolved", resolvedCount, "remaining", len(remaining))
	}

	if len(remaining) > 0 {
		return fmt.Errorf("failed to resolve all deltas after %d iterations: %d deltas remaining", maxIterations, len(remaining))
	}

	logger.Debug("All deltas resolved successfully", "totalDeltas", len(deltas))
	return nil
}

// resolveDeltaIteration processes one iteration of delta resolution
func (c *rawClient) resolveDeltaIteration(ctx context.Context, deltas []*protocol.PackfileObject, objects map[string]*protocol.PackfileObject, storage storage.PackfileStorage) (int, []*protocol.PackfileObject) {
	logger := log.FromContext(ctx)
	var stillPending []*protocol.PackfileObject
	resolvedCount := 0

	for _, delta := range deltas {
		if delta.Delta == nil {
			logger.Debug("Skipping object without delta", "type", delta.Type)
			continue
		}

		baseObj, found := c.findBaseObject(ctx, delta.Delta.Parent, objects, storage)
		if !found {
			stillPending = append(stillPending, delta)
			continue
		}

		if err := c.resolveSingleDelta(ctx, delta, baseObj, objects, storage); err != nil {
			logger.Debug("Failed to resolve delta", "parent", delta.Delta.Parent, "error", err)
			stillPending = append(stillPending, delta)
			continue
		}

		resolvedCount++
	}

	return resolvedCount, stillPending
}

// findBaseObject finds the base object for a delta, checking both objects map and storage
func (c *rawClient) findBaseObject(ctx context.Context, parentHash string, objects map[string]*protocol.PackfileObject, storage storage.PackfileStorage) (*protocol.PackfileObject, bool) {
	logger := log.FromContext(ctx)

	// First check in-memory objects
	if baseObj, exists := objects[parentHash]; exists {
		return baseObj, true
	}

	// Then check storage if available
	if storage != nil {
		baseHash, err := hash.FromHex(parentHash)
		if err != nil {
			logger.Debug("Invalid parent hash in delta", "parent", parentHash, "error", err)
			return nil, false
		}

		if baseObj, exists := storage.Get(baseHash); exists {
			return baseObj, true
		}
	}

	logger.Debug("Base object not found", "parent", parentHash)
	return nil, false
}

// resolveSingleDelta resolves a single delta object and adds it to the objects map
func (c *rawClient) resolveSingleDelta(ctx context.Context, delta *protocol.PackfileObject, baseObj *protocol.PackfileObject, objects map[string]*protocol.PackfileObject, storage storage.PackfileStorage) error {
	logger := log.FromContext(ctx)

	// Apply the delta to the base object
	resolvedData, err := protocol.ApplyDelta(baseObj.Data, delta.Delta)
	if err != nil {
		return fmt.Errorf("failed to apply delta: %w", err)
	}

	// Calculate the hash and type of resolved object
	resolvedHash, resolvedType, err := c.inferResolvedObjectType(ctx, resolvedData, baseObj)
	if err != nil {
		return fmt.Errorf("failed to infer object type: %w", err)
	}

	// Create and parse the resolved object
	resolvedObj := &protocol.PackfileObject{
		Type: resolvedType,
		Data: resolvedData,
		Hash: resolvedHash,
	}

	if err := c.parseResolvedObject(ctx, resolvedObj); err != nil {
		logger.Debug("Warning: failed to parse resolved object", "hash", resolvedHash.String(), "error", err)
	}

	// Add to objects map and storage
	objects[resolvedHash.String()] = resolvedObj
	if storage != nil {
		storage.Add(resolvedObj)
	}

	logger.Debug("Resolved delta", "hash", resolvedHash.String(), "parent", delta.Delta.Parent, "type", resolvedType)
	return nil
}

// createMissingBasesError creates an error for unresolvable deltas
func (c *rawClient) createMissingBasesError(remaining []*protocol.PackfileObject) error {
	missingBases := make([]string, 0, len(remaining))
	for _, delta := range remaining {
		if delta.Delta != nil {
			missingBases = append(missingBases, delta.Delta.Parent)
		}
	}
	return fmt.Errorf("unable to resolve %d deltas: missing base objects %v", len(remaining), missingBases)
}

// inferResolvedObjectType infers the object type of a resolved delta object
// and calculates its hash. Since deltas don't store the target object type explicitly,
// we infer it from the base object type (deltas typically maintain the same type).
func (c *rawClient) inferResolvedObjectType(ctx context.Context, data []byte, baseObj *protocol.PackfileObject) (hash.Hash, protocol.ObjectType, error) {
	// In most cases, delta objects preserve the type of their base
	targetType := baseObj.Type

	// Calculate the hash with the inferred type
	resolvedHash, err := protocol.Object(crypto.SHA1, targetType, data)
	if err != nil {
		return hash.Zero, protocol.ObjectTypeInvalid, fmt.Errorf("failed to calculate object hash: %w", err)
	}

	return resolvedHash, targetType, nil
}

// parseResolvedObject parses the content of resolved delta objects (trees and commits)
// to ensure their fields are properly populated for consumers.
func (c *rawClient) parseResolvedObject(ctx context.Context, obj *protocol.PackfileObject) error {
	// Parse the object using the public Parse() method
	return obj.Parse()
}
