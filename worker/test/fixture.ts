/** Minimal baseline JPEG (1x1). */
export const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwD9LKKKK+bP5zP/2Q=='
  ),
  (value) => value.charCodeAt(0)
);

const frameOffset = (bytes: Uint8Array) =>
  bytes.findIndex((value, i) => value === 0xff && bytes[i + 1] === 0xc0);

/** The fixture with its frame header rewritten to another size. */
export function jpegOfSize(width: number, height: number) {
  const bytes = JPEG.slice();
  bytes.set([height >> 8, height & 0xff, width >> 8, width & 0xff], frameOffset(bytes) + 5);
  return bytes;
}

/** The fixture padded with comment segments to exactly `length` bytes. */
export function jpegOfLength(length: number) {
  const bytes = new Uint8Array(length);
  bytes.set(JPEG.subarray(0, 2));
  let offset = 2;
  let padding = length - JPEG.length;
  while (padding > 0) {
    let chunk = Math.min(padding, 60_000);
    // A comment segment needs a marker, a length and at least two bytes.
    if (padding - chunk > 0 && padding - chunk < 6) chunk -= 6;
    bytes.set([0xff, 0xfe, (chunk - 2) >> 8, (chunk - 2) & 0xff], offset);
    offset += chunk;
    padding -= chunk;
  }
  bytes.set(JPEG.subarray(2), offset);
  return bytes;
}
