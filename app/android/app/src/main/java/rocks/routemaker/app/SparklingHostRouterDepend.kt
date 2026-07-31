// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package rocks.routemaker.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.tiktok.sparkling.Sparkling
import com.tiktok.sparkling.SparklingContext
import com.tiktok.sparkling.hybridkit.service.HybridActivityStackManager
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IBridgeContext
import com.tiktok.sparkling.method.router.utils.IHostRouterDepend

class SparklingHostRouterDepend: IHostRouterDepend {

    override fun openScheme(
        bridgeContext: IBridgeContext?,
        scheme: String,
        extraParams: Map<String, Any>,
        platformType: BridgePlatformType,
        context: Context?
    ): Boolean {
        val useSysBrowser = when (val value = extraParams["useSysBrowser"]) {
            is Boolean -> value
            is String -> value.equals("true", ignoreCase = true)
            else -> false
        }
        if (
            useSysBrowser &&
            (scheme.startsWith("http://", ignoreCase = true) ||
                scheme.startsWith("https://", ignoreCase = true))
        ) {
            val browserContext = context ?: HybridActivityStackManager.getTopActivity() ?: return false
            return try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(scheme))
                if (browserContext !is Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                browserContext.startActivity(intent)
                true
            } catch (_: Exception) {
                false
            }
        }
        val sparklingContext = SparklingContext()
        sparklingContext.scheme = scheme
        context?.let {  Sparkling.Companion.build(it, sparklingContext).navigate() }
        return true
    }

    override fun closeView(
        bridgeContext: IBridgeContext?,
        type: BridgePlatformType,
        containerID: String?,
        animated: Boolean?
    ): Boolean {
        val ownerActivity = bridgeContext?.ownerActivity
        if (ownerActivity != null) {
            ownerActivity.finish()
        } else {
            HybridActivityStackManager.getTopActivity()?.finish()
        }
        return true
    }
}
