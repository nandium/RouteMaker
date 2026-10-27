package rocks.routemaker.app

import android.content.Context
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/** ReactLynx owns gym data and navigation; the host only renders the map. */
class RouteMakerMapModule(context: Context) : LynxModule(context) {

    @LynxMethod
    fun open(sceneJson: String, callback: Callback) {
        val scene = MapScene.parse(sceneJson)
        if (scene == null) {
            callback.invoke("")
            return
        }
        val activity = mContext.mainActivity()
        activity.runOnUiThread { activity.openMap(scene, callback) }
    }
}
