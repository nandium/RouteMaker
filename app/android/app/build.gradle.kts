import java.net.URI

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.kapt)
}

val debugApiBaseUrl = "http://10.0.2.2:8787"

fun configuredApiBaseUrl(): String? =
    providers.gradleProperty("routeMakerApiBaseUrl").orNull?.trim()?.takeIf { it.isNotEmpty() }
        ?: providers.environmentVariable("ROUTEMAKER_API_BASE_URL").orNull?.trim()?.takeIf { it.isNotEmpty() }

fun requireHttpsApiBaseUrl(value: String?): String {
    if (value == null) {
        throw GradleException(
            "Release builds require an HTTPS API endpoint. " +
                "Set -ProuteMakerApiBaseUrl=https://api.example.com or ROUTEMAKER_API_BASE_URL.",
        )
    }
    val uri = try {
        URI(value)
    } catch (error: IllegalArgumentException) {
        throw GradleException("Release API endpoint is not a valid URL: $value", error)
    }
    if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) {
        throw GradleException("Release API endpoint must be an HTTPS URL with a host: $value")
    }
    return value
}

fun buildConfigString(value: String): String =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "rocks.routemaker.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "rocks.routemaker.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        ndk {
            abiFilters.addAll(listOf("armeabi-v7a", "arm64-v8a"))
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField(
                "String",
                "API_BASE_URL",
                buildConfigString(configuredApiBaseUrl() ?: debugApiBaseUrl),
            )
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Validation is wired to release tasks below; an empty value prevents
            // an unconfigured release from silently inheriting the emulator URL.
            buildConfigField(
                "String",
                "API_BASE_URL",
                buildConfigString(configuredApiBaseUrl() ?: ""),
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }

    // Default integrate assets from dist; switch to native assets when env is set
    val useNativeAssets =
        System.getenv("SPARKLING_USE_NATIVE_ASSETS")?.equals("true", ignoreCase = true) ?: false
    sourceSets {
        getByName("main").apply {
            if (useNativeAssets) {
                // Use native assets directory (used in --copy mode)
                assets.setSrcDirs(listOf("src/main/assets"))
            } else {
                // Default: use dist directly; no copy required
                assets.setSrcDirs(listOf("../../dist"))
            }
        }
    }

    dependencies {
        implementation(libs.androidx.core.ktx)
        implementation(libs.androidx.appcompat)
        implementation("com.tiktok.sparkling:sparkling:2.0.1")
        implementation("com.tiktok.sparkling:sparkling-method:2.0.1")

        implementation(libs.fresco)
        implementation(libs.fresco.animated.gif)
        implementation(libs.fresco.animated.webp)
        implementation(libs.fresco.webp.support)
        implementation(libs.fresco.animated.base)

        // BEGIN SPARKLING AUTOLINK
        listOf(
            project(":sparkling-navigation")
        ).forEach { dep -> add("implementation", dep) }
        // END SPARKLING AUTOLINK
    }
}

val validateReleaseApiBaseUrl = tasks.register("validateReleaseApiBaseUrl") {
    group = "verification"
    description = "Require a valid HTTPS API endpoint before release tasks run."
    doLast {
        requireHttpsApiBaseUrl(configuredApiBaseUrl())
    }
}

tasks.configureEach {
    if (name.contains("Release") && name != "validateReleaseApiBaseUrl") {
        dependsOn(validateReleaseApiBaseUrl)
    }
}
