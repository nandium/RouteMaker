package rocks.routemaker.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/** Opens browser-only tools through the host platform. */
class RouteMakerNavigationModule(context: Context) : LynxModule(context) {
    private val hostContext = context

    @LynxMethod
    fun openExternal(url: String, _replace: Boolean, callback: Callback) {
        val uri = Uri.parse(url)
        if (uri.scheme?.lowercase() !in SUPPORTED_SCHEMES || uri.host.isNullOrBlank()) {
            callback.invoke(false)
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, uri)
        if (hostContext !is Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            hostContext.startActivity(intent)
            callback.invoke(true)
        } catch (_: Exception) {
            callback.invoke(false)
        }
    }

    private companion object {
        val SUPPORTED_SCHEMES = setOf("http", "https")
    }
}
