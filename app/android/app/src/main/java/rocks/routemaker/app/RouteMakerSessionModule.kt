package rocks.routemaker.app

import android.content.Context
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

class RouteMakerSessionModule(context: Context) : LynxModule(context) {
    private val preferences =
        context.getSharedPreferences("routemaker.session", Context.MODE_PRIVATE)

    @LynxMethod
    fun getToken(callback: Callback) {
        callback.invoke(preferences.getString(TOKEN, "") ?: "")
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
        const val TOKEN = "token"
    }
}
