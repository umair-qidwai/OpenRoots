package expo.modules.openrootsintegrity

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URI
import java.security.MessageDigest

class OpenRootsIntegrityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OpenRootsIntegrity")
    AsyncFunction("sha256") { uri: String ->
      val parsed = URI(uri)
      require(parsed.scheme == "file") { "Expected a private file URL" }
      val file = File(parsed).canonicalFile
      val root = requireNotNull(appContext.reactContext) { "React context unavailable" }.filesDir.canonicalFile
      require(file.path.startsWith(root.path + File.separator) && file.isFile) {
        "File must be inside private document storage"
      }
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().buffered(1024 * 1024).use { input ->
        val buffer = ByteArray(1024 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          if (count > 0) digest.update(buffer, 0, count)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }
  }
}
