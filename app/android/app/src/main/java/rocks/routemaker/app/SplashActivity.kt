// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package rocks.routemaker.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.tiktok.sparkling.Sparkling
import com.tiktok.sparkling.SparklingContext
import com.tiktok.sparkling.method.registry.core.utils.JsonUtils

class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        gotoSparklingPage()
    }

    private fun gotoSparklingPage() {
        val initData = mutableMapOf<String, Any>(
            "apiBaseUrl" to BuildConfig.API_BASE_URL,
            "systemTheme" to RouteMakerAppearance.systemTheme(this),
        )
        RouteMakerAppearance.preference(this)?.let { initData["themePreference"] = it }
        val initialData: String = JsonUtils.toJson(initData)

        val context = SparklingContext()
        context.scheme = "hybrid://lynxview_page?bundle=main.lynx.bundle&hide_nav_bar=1&screen_orientation=portrait"
        context.withInitData("{ \"initial_data\":$initialData}")
        Sparkling.build(this, context).navigate()
        finish()
    }
}
