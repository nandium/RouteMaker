import com.android.build.api.variant.BuildConfigField
import java.net.URI

plugins {
    // AGP 9 compiles Kotlin itself, so there is no Kotlin plugin.
    alias(libs.plugins.android.application)
}

val productionApiBaseUrl = "https://routemaker-worker.nandium.workers.dev"
val debugApiBaseUrl = "http://10.0.2.2:8787"
// The trailing slash is dropped once here, so isSiteUrl and the JS see one base URL.
val apiBaseUrlOverride = providers.gradleProperty("routeMakerApiBaseUrl")
    .orElse(providers.environmentVariable("ROUTEMAKER_API_BASE_URL"))
    .map { it.trim().trimEnd('/') }
    .filter { it.isNotEmpty() }

fun requireHttps(url: String): String {
    val uri = runCatching { URI(url) }.getOrNull()
    require(uri?.scheme.equals("https", ignoreCase = true) && !uri?.host.isNullOrBlank()) {
        "Release API endpoint must be an HTTPS URL with a host: $url"
    }
    return url
}

val hostAssets = layout.buildDirectory.dir("host-assets")

android {
    namespace = "rocks.routemaker.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "rocks.routemaker.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        ndk {
            // Arm only: Fresco 2.3.0's x86_64 libraries are not 16 KB aligned.
            abiFilters.addAll(listOf("armeabi-v7a", "arm64-v8a"))
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        // Code under test may log; the Android stubs would otherwise throw.
        unitTests.isReturnDefaultValues = true
    }

    sourceSets.named("main") {
        assets.directories.add(hostAssets.get().asFile.path)
    }
}

// Resolved lazily so only release builds validate the URL.
androidComponents.onVariants { variant ->
    val url = if (variant.buildType == "release") {
        apiBaseUrlOverride.map(::requireHttps).orElse(productionApiBaseUrl)
    } else {
        apiBaseUrlOverride.orElse(debugApiBaseUrl)
    }
    variant.buildConfigFields?.put("API_BASE_URL", url.map { BuildConfigField("String", "\"$it\"", null) })
}

// iOS reads these files from app/dist and app/resource/fonts directly. Android copies only what it
// packages, because dist also holds the web build and debug output.
val lynxBundle = file("../../dist/main.lynx.bundle")
val fonts = file("../../resource/fonts")
val syncHostAssets = tasks.register<Sync>("syncHostAssets") {
    doFirst { check(lynxBundle.exists()) { "Run npm run build first." } }
    from(lynxBundle)
    from(fonts) {
        include("RMDisplay-800.ttf", "OFL.txt")
        into("fonts")
    }
    into(hostAssets)
}
tasks.named("preBuild") {
    dependsOn(syncHostAssets)
}

dependencies {
    // MainActivity and the map screen use these two directly.
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core)
    // XElement's input and SVG views extend AppCompat widgets.
    implementation(libs.androidx.appcompat)
    implementation(libs.lynx)
    implementation(libs.lynx.service.http)
    implementation(libs.lynx.service.image)
    implementation(libs.lynx.service.log)
    implementation(libs.lynx.xelement.input)
    implementation(libs.lynx.xelement.svg)
    // MapLibre's default artifact needs Vulkan 1.0.3, so Play offers the app only to devices
    // that have it. That is intentional.
    implementation(libs.maplibre)
    implementation(libs.fresco)
    testImplementation(libs.junit)
    // The real org.json: the Android jar only has stubs of it.
    testImplementation(libs.json)
}
