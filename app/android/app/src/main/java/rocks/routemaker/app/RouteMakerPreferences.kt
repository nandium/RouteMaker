package rocks.routemaker.app

import android.content.Context

/** Private storage shared by the session and appearance modules. */
fun Context.routeMakerPreferences() = getSharedPreferences("routemaker", Context.MODE_PRIVATE)
