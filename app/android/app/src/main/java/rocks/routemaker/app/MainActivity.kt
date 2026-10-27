package rocks.routemaker.app

import android.content.Context
import android.content.res.Configuration
import android.database.ContentObserver
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.tasm.LynxLoadMeta
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.TemplateData
import com.lynx.tasm.utils.ContextUtils

/** Lynx hands modules a wrapped context; unwrap it to reach the activity. */
fun Context.mainActivity() = ContextUtils.getActivity(this) as MainActivity

class MainActivity : ComponentActivity() {

    private lateinit var lynxView: LynxView
    private lateinit var publishedProps: Map<String, Any>
    private var mapCallback: Callback? = null

    // Paints the bottom inset in the navigation color, so the app's tab bar flows into it.
    private val bottomBar by lazy { View(this) }

    private val pickGym = registerForActivityResult(PickGym()) { gymId ->
        mapCallback?.invoke(gymId.orEmpty())
        mapCallback = null
    }

    // Enabled only while ReactLynx has a screen to go back to.
    private val backCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            lynxView.sendGlobalEvent("routemaker:back", JavaOnlyArray())
        }
    }

    private val animationScaleObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) {
            publishGlobalProps()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        applyWindowTheme()
        super.onCreate(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, backCallback)

        lynxView = LynxViewBuilder().setFontScale(resources.configuration.fontScale).build(this)
        setContentView(insetColumn(this, lynxView, bottomBar))

        publishedProps = globalProps()
        val loadMeta = LynxLoadMeta.Builder().apply {
            setUrl(BUNDLE)
            setBinaryData(assets.open(BUNDLE).use { it.readBytes() })
            setGlobalProps(TemplateData.fromMap(publishedProps))
        }.build()
        lynxView.loadTemplate(loadMeta)

        contentResolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
            false,
            animationScaleObserver,
        )
    }

    // Lynx assigns the whole map, so every update carries every prop.
    private fun globalProps() = buildMap<String, Any> {
        val configuration = resources.configuration
        put("apiBaseUrl", BuildConfig.API_BASE_URL)
        put("systemTheme", RouteMakerAppearance.systemTheme(configuration))
        // Rounded because the float 1.3 would reach JS as 1.2999999523, below a 1.3 threshold.
        put("fontScale", Math.round(configuration.fontScale * 100) / 100.0)
        // "Remove animations" in the accessibility settings sets the animator scale to zero.
        put("reducedMotion", animationScale() == 0f)
        // "light", "dark", or "system" when the user has not chosen.
        put("themePreference", RouteMakerAppearance.preference(this@MainActivity) ?: "system")
    }

    private fun animationScale() =
        Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)

    private fun publishGlobalProps() {
        val props = globalProps()
        if (props == publishedProps) return
        publishedProps = props
        lynxView.updateGlobalProps(props)
    }

    /** Matches the system bars and the window behind them to the in-app theme. */
    fun applyWindowTheme() {
        val theme = RouteMakerAppearance.preference(this)
            ?: RouteMakerAppearance.systemTheme(resources.configuration)
        val dark = theme == "dark"
        // The bottom bar is dark in both themes, so the navigation buttons are always light.
        enableEdgeToEdge(
            SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark },
            SystemBarStyle.dark(Color.TRANSPARENT),
        )
        window.setBackgroundDrawable(
            ColorDrawable(getColor(if (dark) R.color.background_dark else R.color.background_light)),
        )
        bottomBar.setBackgroundColor(getColor(if (dark) R.color.nav_dark else R.color.nav_light))
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        lynxView.updateFontScale(newConfig.fontScale)
        applyWindowTheme()
        publishGlobalProps()
    }

    fun openMap(scene: MapScene, callback: Callback) {
        if (mapCallback != null) {
            callback.invoke("")
            return
        }
        mapCallback = callback
        pickGym.launch(scene)
    }

    fun setCanGoBack(canGoBack: Boolean) {
        backCallback.isEnabled = canGoBack
    }

    override fun onStart() {
        super.onStart()
        lynxView.onEnterForeground()
    }

    override fun onStop() {
        lynxView.onEnterBackground()
        super.onStop()
    }

    override fun onDestroy() {
        contentResolver.unregisterContentObserver(animationScaleObserver)
        lynxView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val BUNDLE = "main.lynx.bundle"
    }
}
