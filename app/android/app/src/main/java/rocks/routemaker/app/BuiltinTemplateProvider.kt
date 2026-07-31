// Copyright (c) 2025 RouteMaker contributors.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package rocks.routemaker.app

import android.content.Context
import com.lynx.tasm.provider.AbsTemplateProvider
import java.io.IOException

class BuiltinTemplateProvider(context: Context) : AbsTemplateProvider() {

    private val applicationContext = context.applicationContext

    override fun loadTemplate(uri: String, callback: Callback) {
        Thread {
            try {
                applicationContext.assets.open(uri).use { inputStream ->
                    callback.onSuccess(inputStream.readBytes())
                }
            } catch (e: IOException) {
                callback.onFailed(e.message)
            }
        }.start()
    }
}
