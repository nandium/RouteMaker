package rocks.routemaker.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/** Opens the website's browser-only tools and hands system Back to ReactLynx. */
class RouteMakerNavigationModule(context: Context) : LynxModule(context) {

    // `replace` only matters to the web host, which can navigate in place.
    @LynxMethod
    fun openExternal(url: String, replace: Boolean, callback: Callback) {
        if (!isSiteUrl(url, BuildConfig.API_BASE_URL)) {
            callback.invoke(false)
            return
        }
        val activity = mContext.mainActivity()
        activity.runOnUiThread {
            val opened = try {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                true
            } catch (_: ActivityNotFoundException) {
                false
            }
            callback.invoke(opened)
        }
    }

    @LynxMethod
    fun setCanGoBack(canGoBack: Boolean) {
        val activity = mContext.mainActivity()
        activity.runOnUiThread { activity.setCanGoBack(canGoBack) }
    }
}

/**
 * Whether [url] is a page of [site] (the API base URL, without a trailing slash). Only the
 * site's own pages may open, so a URL and any sign-in code in it never reaches another host.
 * Comparing text avoids parsers that disagree about the host.
 */
internal fun isSiteUrl(url: String, site: String) = url == site || url.startsWith("$site/")
