package rocks.routemaker.app

import android.content.Context
import android.content.Intent
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

class RouteMakerShareModule(context: Context) : LynxModule(context) {

    @LynxMethod
    fun share(url: String, title: String, callback: Callback) {
        val activity = mContext.mainActivity()
        activity.runOnUiThread {
            val send = Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, url)
                .putExtra(Intent.EXTRA_TITLE, title)
            // The chooser itself reports when nothing can handle the share.
            activity.startActivity(Intent.createChooser(send, title))
            callback.invoke("opened")
        }
    }
}
