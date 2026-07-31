import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.jvm.toolchain.JavaLanguageVersion
import org.gradle.jvm.toolchain.JavaToolchainService
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.kapt) apply false
}

// Sparkling emits Java 11 bytecode, but using the available LTS JDK keeps the
// build reproducible without installing an obsolete compiler.
val targetJavaVersion = JavaLanguageVersion.of(17)
val forcedKotlinVersion = "1.8.10"

subprojects {
    val javaToolchains = extensions.findByType(JavaToolchainService::class.java)
    if (javaToolchains != null) {
        tasks.withType<JavaCompile>().configureEach {
            javaCompiler.set(
                javaToolchains.compilerFor {
                    languageVersion.set(targetJavaVersion)
                },
            )
        }
    }
    tasks.withType<KotlinCompile>().configureEach {
        kotlinOptions.jvmTarget = "11"
    }

    // Align Kotlin deps to avoid pulling newer Kotlin metadata with older AGP
    configurations.configureEach {
        resolutionStrategy.eachDependency {
            if (requested.group == "org.jetbrains.kotlin") {
                useVersion(forcedKotlinVersion)
                because("Keep Kotlin libs aligned with Kotlin plugin/AGP")
            }
        }
    }
}
