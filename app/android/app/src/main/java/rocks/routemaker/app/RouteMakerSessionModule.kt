package rocks.routemaker.app

import android.content.Context
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

// Plain private preferences are enough here: the app sandbox protects them and
// allowBackup="false" keeps them out of backups.
class RouteMakerSessionModule(context: Context) : LynxModule(context) {
    private val preferences = context.routeMakerPreferences()

    @LynxMethod
    fun getToken(callback: Callback) {
        callback.invoke(preferences.getString(TOKEN, "").orEmpty())
    }

    @LynxMethod
    fun setToken(token: String) {
        preferences.edit().putString(TOKEN, token).apply()
    }

    @LynxMethod
    fun clearToken() {
        preferences.edit().remove(TOKEN).apply()
    }

    private companion object {
        const val TOKEN = "routemaker.session"
    }
}
