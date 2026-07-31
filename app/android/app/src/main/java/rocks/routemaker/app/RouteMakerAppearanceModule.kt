package rocks.routemaker.app

import android.content.Context
import android.content.res.Configuration
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

object RouteMakerAppearance {
    private const val PREFERENCES = "routemaker.appearance"
    private const val THEME = "theme"

    fun preference(context: Context): String? =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(THEME, null)

    fun systemTheme(context: Context): String =
        systemTheme(context.resources.configuration)

    fun systemTheme(configuration: Configuration): String =
        if (
            configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK ==
            Configuration.UI_MODE_NIGHT_YES
        ) {
            "dark"
        } else {
            "light"
        }

    fun save(context: Context, preference: String) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(THEME, preference)
            .apply()
    }
}

class RouteMakerAppearanceModule(context: Context) : LynxModule(context) {
    private val hostContext = context

    @LynxMethod
    fun setPreference(preference: String) {
        if (preference == "light" || preference == "dark") {
            RouteMakerAppearance.save(hostContext, preference)
        }
    }
}
