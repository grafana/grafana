# geo support in blube

First, all of this geo code is a Go adaptation of the [Lucene 5.3.2 sandbox geo support](https://lucene.apache.org/core/5_3_2/sandbox/org/apache/lucene/util/package-summary.html).

## Notes

- All of the APIs will use float64 for lon/lat values.
- When describing a point in function arguments or return values, we always use the order lon, lat.
- High level APIs will use TopLeft and BottomRight to describe bounding boxes.  This may not map cleanly to min/max lon/lat when crossing the dateline.  The lower level APIs will use min/max lon/lat and require the higher-level code to split boxes accordingly.
