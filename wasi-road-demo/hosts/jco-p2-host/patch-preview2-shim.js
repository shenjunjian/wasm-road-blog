/**
 * Workaround for preview2-shim rejecting `requestedWriteSync` on file open.
 *
 * Rust std `fs::File::create` sets this flag; Wasmtime accepts it, but
 * @bytecodealliance/preview2-shim currently throws "unsupported".
 * Strip sync-related flags before delegating to the original openAt.
 *
 * Must be imported before the jco-transpiled component module loads.
 */
import { types } from "@bytecodealliance/preview2-shim/filesystem";

const { Descriptor } = types;
const originalOpenAt = Descriptor.prototype.openAt;

Descriptor.prototype.openAt = function openAtPatched(
  pathFlags,
  path,
  openFlags,
  descriptorFlags,
) {
  if (descriptorFlags) {
    descriptorFlags = {
      ...descriptorFlags,
      requestedWriteSync: false,
      mutateDirectory: false,
      fileIntegritySync: false,
      dataIntegritySync: false,
    };
  }
  return originalOpenAt.call(this, pathFlags, path, openFlags, descriptorFlags);
};
