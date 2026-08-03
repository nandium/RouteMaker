package rocks.routemaker.app

import android.app.Application
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.imagepipeline.memory.PoolConfig
import com.facebook.imagepipeline.memory.PoolFactory
import com.lynx.service.http.LynxHttpService
import com.lynx.service.image.LynxImageService
import com.lynx.service.log.LynxLogService
import com.lynx.tasm.INativeLibraryLoader
import com.lynx.tasm.LynxEnv
import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.BehaviorBundle
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.shadow.ShadowNode
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.service.LynxServiceCenter
import com.lynx.xelement.input.LynxUIInput
import com.lynx.xelement.input.LynxUIInputShadowNode
import com.lynx.xelement.svg.LynxUISVG

class RouteMakerApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        initFresco()
        initLynx()
    }

    private fun initFresco() {
        val factory = PoolFactory(PoolConfig.newBuilder().build())
        val config = ImagePipelineConfig.newBuilder(applicationContext)
            .setPoolFactory(factory)
            .build()
        Fresco.initialize(applicationContext, config)
    }

    private fun initLynx() {
        val services = LynxServiceCenter.inst()
        services.registerService(LynxHttpService)
        services.registerService(LynxImageService.getInstance())
        services.registerService(LynxLogService)

        val environment = LynxEnv.inst()
        environment.init(
            this,
            INativeLibraryLoader { libraryName -> System.loadLibrary(libraryName) },
            BuiltinTemplateProvider(this),
            RouteMakerBehaviorBundle(),
        )
        environment.registerModule("RouteMakerSession", RouteMakerSessionModule::class.java)
        environment.registerModule("RouteMakerShare", RouteMakerShareModule::class.java)
        environment.registerModule("RouteMakerAppearance", RouteMakerAppearanceModule::class.java)
        environment.registerModule("RouteMakerNavigation", RouteMakerNavigationModule::class.java)
        environment.registerModule("RouteMakerMap", RouteMakerMapModule::class.java)
    }
}

private class RouteMakerBehaviorBundle : BehaviorBundle {
    override fun create(): List<Behavior> = listOf(
        object : Behavior("input", false) {
            override fun createUI(context: LynxContext?): LynxUI<*> =
                LynxUIInput(requireNotNull(context))

            override fun createShadowNode(): ShadowNode = LynxUIInputShadowNode()
        },
        object : Behavior("svg", false) {
            override fun createUI(context: LynxContext?): LynxUI<*> =
                LynxUISVG(requireNotNull(context))
        },
    )
}
