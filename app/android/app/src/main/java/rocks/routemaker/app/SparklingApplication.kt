// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package rocks.routemaker.app

import android.app.Application

import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.imagepipeline.memory.PoolConfig
import com.facebook.imagepipeline.memory.PoolFactory
import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.ui.LynxUI
import com.tiktok.sparkling.hybridkit.HybridKit
import com.tiktok.sparkling.hybridkit.config.BaseInfoConfig
import com.tiktok.sparkling.hybridkit.config.SparklingHybridConfig
import com.tiktok.sparkling.hybridkit.config.SparklingLynxConfig
import com.tiktok.sparkling.hybridkit.lynx.SparklingLynxModuleWrapper

class SparklingApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        initFresco()
        initHybridKit()
    }

    private fun initFresco() {
        val factory = PoolFactory(PoolConfig.newBuilder().build())
        val builder = ImagePipelineConfig.newBuilder(applicationContext).setPoolFactory(factory)
        Fresco.initialize(applicationContext, builder.build())
    }

    private fun initHybridKit() {
        HybridKit.init(this)
        val baseInfoConfig = BaseInfoConfig(isDebug = BuildConfig.DEBUG)
        val lynxConfig = SparklingLynxConfig.build(this) {
            addBehaviors(listOf(
                object : Behavior("input", false) {
                    override fun createUI(context: LynxContext?): LynxUI<*>? {
                        return LynxInputComponent(context)
                    }
                }
            ))
            addLynxModules(
                mapOf(
                    "RouteMakerSession" to SparklingLynxModuleWrapper(
                        RouteMakerSessionModule::class.java,
                        null,
                    ),
                    "RouteMakerShare" to SparklingLynxModuleWrapper(
                        RouteMakerShareModule::class.java,
                        null,
                    ),
                    "RouteMakerAppearance" to SparklingLynxModuleWrapper(
                        RouteMakerAppearanceModule::class.java,
                        null,
                    ),
                    "RouteMakerNavigation" to SparklingLynxModuleWrapper(
                        RouteMakerNavigationModule::class.java,
                        null,
                    ),
                ),
            )
            setTemplateProvider(BuiltinTemplateProvider(this@SparklingApplication))
        }
        val hybridConfig = SparklingHybridConfig.build(baseInfoConfig) {
            setLynxConfig(lynxConfig)
        }
        HybridKit.setHybridConfig(hybridConfig, this)
        HybridKit.initLynxKit()
    }
}
