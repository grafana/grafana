# Test and Example Data

Unless correcting mistakes, do not change existing examples as this may break outside tests. (However, extending exampleInfo or updating the summary is permitted).

The Directory format is `kind/format/version/collection/example_file.json`.

Additional information for tests is kept in the custom meta data of the first frame in the "exampleInfo" property.

Example File Requirements:

- Must follow the directory format.
- A json file that contains an array of frames (data.Frames)
- Frames do not have a refId set.
- The first frame must have meta.custom as an object, and have the "exampleInfo" property in it.
- exampleInfo must contain:
  - "summary" (string) A description ending in a period.
  - "itemCount" (number) The number if items if a dimensional set based kind (e.g. numeric/timeseries).
  - "collectionVersion" (number) of at least 1.

When new examples are added to a collection, they should be added with the max collectionVersion number within the collection incremented by one. Existing examples should not have their collectionVersion number changed.
