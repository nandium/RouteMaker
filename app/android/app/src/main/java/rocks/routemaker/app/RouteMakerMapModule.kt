package rocks.routemaker.app

import android.content.Context
import android.content.ContextWrapper
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/** Thin bridge: ReactLynx owns gym data and navigation; Android owns the map. */
class RouteMakerMapModule(context: Context) : LynxModule(context) {
    private val activity = context.findActivity()

    @LynxMethod
    fun open(scene: String, callback: Callback) {
        val host = activity
        if (host == null) {
            callback.invoke("")
            return
        }
        host.openMap(scene, callback)
    }
}

private tailrec fun Context.findActivity(): MainActivity? = when (this) {
    is MainActivity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
