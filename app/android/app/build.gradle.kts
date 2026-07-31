import java.net.URI
import org.gradle.jvm.toolchain.JavaLanguageVersion

plugins {
    alias(libs.plugins.android.application)
}

val debugApiBaseUrl = "http://10.0.2.2:8787"
val androidBytecodeVersion = JavaVersion.toVersion(libs.versions.javaBytecode.get())

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(libs.versions.javaToolchain.get().toInt())
    }
}

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
    compileSdk = libs.versions.androidCompileSdk.get().toInt()

    defaultConfig {
        applicationId = "rocks.routemaker.app"
        minSdk = libs.versions.androidMinSdk.get().toInt()
        targetSdk = libs.versions.androidTargetSdk.get().toInt()
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
        sourceCompatibility = androidBytecodeVersion
        targetCompatibility = androidBytecodeVersion
    }

    // The CLI's copy mode needs packaged assets; local builds can consume dist directly.
    val assetsDirectory =
        if (System.getenv("SPARKLING_USE_NATIVE_ASSETS").equals("true", ignoreCase = true)) {
            "src/main/assets"
        } else {
            "../../dist"
        }
    sourceSets.named("main") {
        assets.directories.clear()
        assets.directories.add(assetsDirectory)
    }

    dependencies {
        implementation(libs.androidx.appcompat)
        implementation(libs.sparkling)

        implementation(libs.fresco)
        implementation(libs.fresco.animated.gif)
        implementation(libs.fresco.animated.webp)

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
