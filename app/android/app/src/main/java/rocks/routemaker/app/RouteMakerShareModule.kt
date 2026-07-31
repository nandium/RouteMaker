package rocks.routemaker.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/** Small native bridge so the Lynx route detail can use the platform share sheet. */
class RouteMakerShareModule(context: Context) : LynxModule(context) {
    private val hostContext = context

    @LynxMethod
    fun share(url: String, title: String?, callback: Callback) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, url)
            putExtra(Intent.EXTRA_TITLE, title ?: "RouteMaker route")
        }
        val chooser = Intent.createChooser(send, title ?: "Share route")
        if (hostContext !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            hostContext.startActivity(chooser)
            callback.invoke("opened")
        } catch (_: Exception) {
            callback.invoke("unavailable")
        }
    }
}
