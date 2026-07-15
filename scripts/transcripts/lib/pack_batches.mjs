// Greedily pack batch requests into sub-batches whose summed serialized size
// stays under maxBytes. This bounds the total POST body per batches.create()
// call, defending against an aggregate-size connection termination in addition
// to the per-request context limit handled by chunk_transcript.
//
// A single request larger than maxBytes cannot be shrunk here, so it is placed
// alone in its own batch (the model's context limit, not this cap, decides
// whether it ultimately succeeds).
//
// Input order is preserved across the flattened output.
export function packRequests(requests, maxBytes) {
  const batches = [];
  let current = [];
  let currentBytes = 0;

  for (const req of requests) {
    const size = JSON.stringify(req).length;
    if (current.length > 0 && currentBytes + size > maxBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(req);
    currentBytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
