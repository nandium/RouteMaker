package rocks.routemaker.app

import android.content.Context
import android.content.res.Configuration
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

object RouteMakerAppearance {
    private const val PREFERENCE = "routemaker.theme"

    /** The saved "light" or "dark", or null when the system's theme applies. */
    fun preference(context: Context): String? =
        context.routeMakerPreferences().getString(PREFERENCE, null)

    /** Saves "light" or "dark"; "system" forgets the choice so the system's theme applies. */
    fun save(context: Context, preference: String) {
        val editor = context.routeMakerPreferences().edit()
        if (preference == "system") editor.remove(PREFERENCE) else editor.putString(PREFERENCE, preference)
        editor.apply()
    }

    fun systemTheme(configuration: Configuration): String =
        if ((configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES) {
            "dark"
        } else {
            "light"
        }
}

class RouteMakerAppearanceModule(context: Context) : LynxModule(context) {

    @LynxMethod
    fun setPreference(preference: String) {
        RouteMakerAppearance.save(mContext, preference)
        val activity = mContext.mainActivity()
        activity.runOnUiThread { activity.applyWindowTheme() }
    }
}
