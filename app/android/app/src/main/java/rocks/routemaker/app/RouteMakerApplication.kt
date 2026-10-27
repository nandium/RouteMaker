package rocks.routemaker.app

import android.app.Application
import android.graphics.Typeface
import com.facebook.drawee.backends.pipeline.Fresco
import com.lynx.service.http.LynxHttpService
import com.lynx.service.image.LynxImageService
import com.lynx.service.log.LynxLogService
import com.lynx.tasm.LynxEnv
import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.BehaviorBundle
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.shadow.ShadowNode
import com.lynx.tasm.behavior.shadow.text.TypefaceCache
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.service.LynxServiceCenter
import com.lynx.xelement.input.LynxUIInput
import com.lynx.xelement.input.LynxUIInputShadowNode
import com.lynx.xelement.svg.LynxUISVG

class RouteMakerApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // LynxImageService loads images through Fresco's pipeline.
        Fresco.initialize(this)

        LynxServiceCenter.inst().apply {
            registerService(LynxHttpService)
            registerService(LynxImageService.getInstance())
            registerService(LynxLogService)
        }

        registerDisplayFont()

        // The bundle is passed to the view as bytes, so there is no template provider.
        LynxEnv.inst().apply {
            init(this@RouteMakerApplication, null, null, behaviorBundle)
            registerModule("RouteMakerSession", RouteMakerSessionModule::class.java)
            registerModule("RouteMakerShare", RouteMakerShareModule::class.java)
            registerModule("RouteMakerAppearance", RouteMakerAppearanceModule::class.java)
            registerModule("RouteMakerNavigation", RouteMakerNavigationModule::class.java)
            registerModule("RouteMakerMap", RouteMakerMapModule::class.java)
        }
    }

    // CSS names the face "RM Display" and carries the weight in that name, so Lynx's typeface
    // cache gets the one font file for every style.
    private fun registerDisplayFont() {
        val display = Typeface.createFromAsset(assets, "fonts/RMDisplay-800.ttf")
        for (style in Typeface.NORMAL..Typeface.BOLD_ITALIC) {
            TypefaceCache.cacheTypeface("RM Display", style, display)
        }
    }

    private val behaviorBundle = BehaviorBundle {
        listOf(
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
}
