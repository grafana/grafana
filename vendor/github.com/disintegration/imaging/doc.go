/*
Package imaging provides basic image processing functions (resize, rotate, crop, brightness/contrast adjustments, etc.).

All the image processing functions provided by the package accept any image type that implements image.Image interface
as an input, and return a new image of *image.NRGBA type (32bit RGBA colors, not premultiplied by alpha).
*/
package imaging
