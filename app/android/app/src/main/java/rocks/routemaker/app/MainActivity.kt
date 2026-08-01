package rocks.routemaker.app

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.ViewGroup
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.Callback
import com.lynx.tasm.LynxLoadMeta
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.TemplateData

class MainActivity : Activity() {

    private lateinit var lynxView: LynxView
    private var mapCallback: Callback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        lynxView = LynxViewBuilder()
            .setColorScheme(RouteMakerAppearance.lynxColorScheme(resources.configuration))
            .build(this)
        setContentView(
            lynxView,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )

        val globalProps = mutableMapOf<String, Any>(
            "apiBaseUrl" to BuildConfig.API_BASE_URL,
            "systemTheme" to RouteMakerAppearance.systemTheme(this),
        )
        RouteMakerAppearance.preference(this)?.let { globalProps["themePreference"] = it }

        val loadMetaBuilder = LynxLoadMeta.Builder()
        loadMetaBuilder.setUrl("main.lynx.bundle")
        loadMetaBuilder.setGlobalProps(TemplateData.fromMap(globalProps))
        val loadMeta = loadMetaBuilder.build()
        lynxView.loadTemplate(loadMeta)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)

        val systemTheme = RouteMakerAppearance.systemTheme(newConfig)
        lynxView.updateColorScheme(RouteMakerAppearance.lynxColorScheme(newConfig))
        lynxView.sendGlobalEvent(
            RouteMakerAppearance.SYSTEM_THEME_EVENT,
            JavaOnlyArray.of(systemTheme),
        )
    }

    fun openMap(scene: String, callback: Callback) {
        mapCallback = callback
        startActivityForResult(
            Intent(this, RouteMakerMapActivity::class.java)
                .putExtra(RouteMakerMapActivity.SCENE, scene),
            MAP_REQUEST,
        )
    }

    @Deprecated("Activity results are intentionally local to this single native map screen.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != MAP_REQUEST) return
        mapCallback?.invoke(
            if (resultCode == RESULT_OK) data?.getStringExtra(RouteMakerMapActivity.GYM_ID).orEmpty()
            else "",
        )
        mapCallback = null
    }

    override fun onDestroy() {
        mapCallback?.invoke("")
        mapCallback = null
        lynxView.destroy()
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        lynxView.onEnterForeground()
    }

    override fun onPause() {
        lynxView.onEnterBackground()
        super.onPause()
    }

    private companion object {
        const val MAP_REQUEST = 41
    }
}
