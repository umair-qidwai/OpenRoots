import ExpoModulesCore
import Foundation
import CryptoKit

public class OpenRootsIntegrityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OpenRootsIntegrity")
    // Expo AsyncFunction executes on its module queue, never the JS/UI thread.
    AsyncFunction("sha256") { (uri: String) throws -> String in
      guard let url = URL(string: uri), url.isFileURL else {
        throw NSError(domain: "OpenRootsIntegrity", code: 1, userInfo: [NSLocalizedDescriptionKey: "Expected a private file URL"])
      }
      let canonical = url.standardizedFileURL.resolvingSymlinksInPath()
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].resolvingSymlinksInPath()
      guard canonical.path.hasPrefix(documents.path + "/"),
            try canonical.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true,
            let input = InputStream(url: canonical) else {
        throw NSError(domain: "OpenRootsIntegrity", code: 2, userInfo: [NSLocalizedDescriptionKey: "File must be inside private document storage"])
      }
      input.open()
      defer { input.close() }
      var hasher = SHA256()
      var buffer = [UInt8](repeating: 0, count: 1024 * 1024)
      while true {
        let count = input.read(&buffer, maxLength: buffer.count)
        if count < 0 { throw input.streamError ?? NSError(domain: "OpenRootsIntegrity", code: 3) }
        if count == 0 { break }
        // One bounded chunk; never materialize a model-sized NSData/Data object.
        hasher.update(data: Data(buffer.prefix(count)))
      }
      return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
  }
}
